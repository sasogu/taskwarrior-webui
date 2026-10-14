import { Task } from 'taskwarrior-lib';

export type TreeTask = Task & { webparent?: string; urgency?: number };

export function childrenOf(task: TreeTask, tasks: TreeTask[]): TreeTask[] {
	return tasks.filter(child => child.webparent === task.uuid && child.uuid !== task.uuid &&
		child.status !== 'deleted' && child.status !== 'recurring')
		.sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed') ||
			(b.urgency || 0) - (a.urgency || 0));
}

export function descendantsOf(task: TreeTask, tasks: TreeTask[]): TreeTask[] {
	const result: TreeTask[] = [];
	const seen = new Set([task.uuid]);
	const visit = (parent: TreeTask) => {
		for (const child of childrenOf(parent, tasks)) {
			if (seen.has(child.uuid)) continue;
			seen.add(child.uuid);
			result.push(child);
			visit(child);
		}
	};
	visit(task);
	return result;
}

export function rootTasks(visible: TreeTask[], tasks: TreeTask[]): TreeTask[] {
	const candidates = new Set(visible.map(task => task.uuid));
	const all = new Map(tasks.filter(task => task.status !== 'deleted').map(task => [task.uuid, task]));
	return visible.filter(task => {
		const seen = new Set([task.uuid]);
		let parent = task.webparent ? all.get(task.webparent) : undefined;
		let nested = false;
		while (parent) {
			if (seen.has(parent.uuid)) {
				// A malformed CLI import must never hide every task in a cycle.
				return task.uuid === [...seen].filter(uuid => candidates.has(uuid)).sort()[0];
			}
			seen.add(parent.uuid);
			if (candidates.has(parent.uuid)) nested = true;
			parent = parent.webparent ? all.get(parent.webparent) : undefined;
		}
		return !nested;
	});
}

export function progressOf(task: TreeTask, tasks: TreeTask[]): string {
	const children = descendantsOf(task, tasks);
	return `${children.filter(child => child.status === 'completed').length}/${children.length}`;
}
