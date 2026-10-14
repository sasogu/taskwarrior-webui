export type HierarchyTask = {
	uuid?: string;
	webparent?: string;
	status?: string;
	recur?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Validate the whole proposed graph before importing any of the tasks.
export function validateHierarchy(existing: HierarchyTask[], updates: HierarchyTask[]): void {
	const previous = new Map(existing.map(task => [task.uuid, task]));
	const tasks = new Map(previous);
	updates.forEach((task, index) => tasks.set(task.uuid || `new-${index}`, task));
	for (const task of updates) {
		if (task.webparent === undefined || task.webparent === '') continue;
		if (typeof task.webparent !== 'string' || !UUID.test(task.webparent))
			throw new Error('La tarea principal debe tener un UUID válido.');
		const parent = tasks.get(task.webparent);
		if (!parent) throw new Error('La tarea principal ya no existe. Recarga la lista.');
		if (task.uuid === task.webparent) throw new Error('Una tarea no puede ser su propia subtarea.');
		if (previous.get(task.uuid)?.webparent !== task.webparent &&
			(parent.status === 'deleted' || parent.status === 'recurring' || parent.recur))
			throw new Error('No puedes añadir subtareas a una tarea eliminada o recurrente.');
		if (task.recur || task.status === 'recurring')
			throw new Error('Las tareas recurrentes no pueden ser subtareas.');
		const visited = new Set<string>();
		if (task.uuid) visited.add(task.uuid);
		let ancestor: HierarchyTask | undefined = parent;
		while (ancestor?.uuid) {
			if (visited.has(ancestor.uuid)) throw new Error('Esta relación crearía un ciclo entre subtareas.');
			visited.add(ancestor.uuid);
			ancestor = ancestor.webparent ? tasks.get(ancestor.webparent) : undefined;
		}
	}
}
