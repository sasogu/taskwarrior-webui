// Safe Taskwarrior wrapper.
//
// Replaces taskwarrior-lib, which built shell command strings from request
// data (uuids, dates, periods) and allowed command injection.
// Every call here uses execFileSync with an argument array: no shell involved.
import { execFileSync } from 'child_process';
import { Task } from 'taskwarrior-lib';
import { validateHierarchy } from './hierarchy';

export class TaskError extends Error {
	status: number;
	expose = true;

	constructor(message: string, status = 400) {
		super(message);
		this.status = status;
	}
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const DATE_FIELDS = ['due', 'until', 'wait', 'scheduled', 'start'] as const;

// Fixed rc overrides; the taskrc itself is mounted read-only
const RC = [
	'rc.confirmation=no',
	'rc.recurrence.confirmation=no',
	'rc.dependency.confirmation=no',
	'rc.json.array=on',
	'rc.json.depends.array=yes',
	'rc.bulk=0',
	'rc.verbose=nothing',
	'rc.color=off',
	'rc.uda.webparent.type=string',
	'rc.uda.webparent.label=Tarea principal',
	'rc.hooks=on'
];

function run(args: string[], input?: string): string {
	try {
		return execFileSync('task', [...RC, ...args], {
			encoding: 'utf8',
			maxBuffer: 200 * 1024 * 1024,
			input,
			timeout: 30000
		});
	}
	catch (err: any) {
		console.error('task failed:', args.join(' '), err.stderr || err.message);
		throw new TaskError('Task command error');
	}
}

export function checkUuid(uuid: unknown): string {
	if (typeof uuid !== 'string' || !UUID_RE.test(uuid))
		throw new TaskError('Invalid uuid');
	return uuid.toLowerCase();
}

// "calc" receives the expression as separate argv words, never through a shell.
// Expressions starting with "rc." could override configuration, so reject them.
function calc(expression: unknown): string | undefined {
	if (expression === undefined || expression === null || expression === '')
		return undefined;
	if (typeof expression !== 'string' || expression.length > 100 || /(^|\s)rc[.:]/.test(expression))
		throw new TaskError(`Invalid expression '${expression}'`);
	return run(['calc', ...expression.trim().split(/\s+/)]).trim();
}

function calcDate(expression: unknown) {
	// Dates exported by Taskwarrior (20261010T100000Z) are passed through unchanged
	if (typeof expression === 'string' && /^\d{8}T\d{6}Z$/.test(expression))
		return expression;
	const result = calc(expression);
	if (result && !ISO_RE.test(result))
		throw new TaskError(`Invalid date string '${expression}'`);
	return result;
}

function checkPeriod(period: unknown) {
	const result = calc(period);
	if (result && result.charAt(0) !== 'P')
		throw new TaskError(`Invalid period string '${period}'`);
}

export function load(): Task[] {
	return JSON.parse(run(['export']));
}

function loadOne(uuid: string): Task | undefined {
	const tasks: Task[] = JSON.parse(run([uuid, 'export']));
	return tasks[0];
}

/**
 * Add tasks without uuid; replace tasks with uuid.
 *
 * "task import" replaces the whole task, so an edit based on a stale copy
 * would silently drop changes made meanwhile by OpenClaw or the CLI.
 * Reject the update (409) if the task was modified after the client loaded it.
 */
export function update(tasks: Task[]): string {
	if (!Array.isArray(tasks) || tasks.length === 0)
		throw new TaskError('No tasks given');

	const prepared = tasks.map(task => {
		const t: any = { ...task };
		if (t.webparent === '' || t.webparent === null) delete t.webparent;
		if (typeof t.webparent === 'string') t.webparent = t.webparent.toLowerCase();
		checkPeriod(t.recur);
		for (const field of DATE_FIELDS)
			t[field] = calcDate(t[field]);

		if (t.uuid !== undefined) {
			t.uuid = checkUuid(t.uuid);
			const current: any = loadOne(t.uuid);
			if (current && current.modified !== t.modified)
				throw new TaskError('La tarea ha cambiado desde que se cargó. Recarga e inténtalo de nuevo.', 409);
			// Completing or restoring from the web only changes status: keep "end" coherent
			if (t.status === 'completed' && !t.end)
				t.end = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
			if (t.status === 'pending')
				delete t.end;
			delete t.urgency;
			delete t.id;
		}
		return t;
	});
	try {
		validateHierarchy(load(), prepared);
	}
	catch (error: any) { throw new TaskError(error.message); }

	return run(['import'], JSON.stringify(prepared));
}

export function del(uuids: unknown[]): string {
	if (!Array.isArray(uuids) || uuids.length === 0)
		throw new TaskError('No tasks given');
	const selected = new Set(uuids.map(checkUuid));
	const children = (load() as any[]).some(task => task.status !== 'deleted' &&
		selected.has(task.webparent) && !selected.has(task.uuid));
	if (children) throw new TaskError('Antes de eliminar esta tarea, mueve o elimina sus subtareas.');
	return run([...selected, 'delete']);
}
