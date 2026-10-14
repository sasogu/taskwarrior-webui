const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require(process.env.TASKWEB_TYPESCRIPT || '../frontend/node_modules/typescript');

function load(relative) {
	const filename = path.resolve(__dirname, relative);
	const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
		compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018 }
	});
	const compiledModule = new Module(filename, module);
	compiledModule._compile(compiled.outputText, filename);
	return compiledModule.exports;
}
const { validateHierarchy } = load('../backend/src/hierarchy.ts');
const { childrenOf, descendantsOf, rootTasks, progressOf } = load('../frontend/utils/hierarchy.ts');
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const task = (n, parent, status = 'pending') => ({ uuid: uuid(n), webparent: parent ? uuid(parent) : undefined, status });

test('multilevel hierarchy preserves independent tasks and completion progress', () => {
	const tasks = [task(1), task(2, 1), task(3, 2, 'completed'), task(4, 1, 'completed'), task(5), task(6, 1, 'deleted')];
	validateHierarchy([], tasks);
	assert.deepEqual(rootTasks(tasks.filter(t => t.status === 'pending'), tasks).map(t => t.uuid), [uuid(1), uuid(5)]);
	assert.deepEqual(childrenOf(tasks[0], tasks).map(t => t.uuid), [uuid(2), uuid(4)]);
	assert.equal(progressOf(tasks[0], tasks), '2/3');
	assert.equal(descendantsOf(tasks[0], tasks).length, 3);
});

test('filtered children stay visible when the parent is absent, waiting or completed', () => {
	const tasks = [task(1, undefined, 'completed'), task(2, 1), task(3, 2)];
	assert.deepEqual(rootTasks(tasks.slice(1), tasks).map(t => t.uuid), [uuid(2)]);
	assert.deepEqual(rootTasks([tasks[2]], [tasks[2]]).map(t => t.uuid), [uuid(3)]);
});

test('parent references must be valid and exist; self parenting and recurring parents are rejected', () => {
	const tasks = [task(1)];
	for (const parent of ['not-a-uuid', uuid(99), false, 3])
		assert.throws(() => validateHierarchy(tasks, [{ ...task(2), webparent: parent }]));
	assert.throws(() => validateHierarchy(tasks, [task(1, 1)]));
	assert.throws(() => validateHierarchy([{ ...task(1), recur: 'daily' }], [task(2, 1)]));
	assert.throws(() => validateHierarchy([task(1)], [{ ...task(2, 1), recur: 'daily' }]));
});

test('reparenting and batch edits cannot introduce cycles', () => {
	const tasks = [task(1), task(2, 1), task(3, 2)];
	assert.throws(() => validateHierarchy(tasks, [task(1, 3)]));
	assert.throws(() => validateHierarchy([task(1), task(2)], [task(1, 2), task(2, 1)]));
	assert.doesNotThrow(() => validateHierarchy(tasks, [task(2)]));
});

test('a malformed external cycle is bounded and does not hide the whole branch', () => {
	const tasks = [task(1, 2), task(2, 1), task(3, 2)];
	assert.deepEqual(rootTasks(tasks, tasks).map(t => t.uuid), [uuid(1)]);
	assert.equal(descendantsOf(tasks[0], tasks).length, 2);
});

test('external parent deletion does not prevent an unchanged child from being edited or detached', () => {
	const tasks = [task(1, undefined, 'deleted'), task(2, 1)];
	assert.doesNotThrow(() => validateHierarchy(tasks, [{ ...tasks[1], description: 'edited' }]));
	assert.doesNotThrow(() => validateHierarchy(tasks, [task(2)]));
	assert.throws(() => validateHierarchy(tasks, [task(3, 1)]));
});
