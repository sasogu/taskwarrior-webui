<template>
	<div class="subtask-tree">
		<div v-for="task in children" :key="task.uuid" class="subtask-node">
			<div class="subtask-row d-flex align-center py-2">
				<v-btn v-if="hasChildren(task)" icon small
					:aria-label="collapsed.includes(task.uuid) ? $t('Show subtasks') : $t('Hide subtasks')"
					@click="toggle(task.uuid)">
					<v-icon>{{ collapsed.includes(task.uuid) ? 'mdi-chevron-right' : 'mdi-chevron-down' }}</v-icon>
				</v-btn>
				<span v-else class="subtask-indent" />
				<v-icon small class="mr-2" :color="task.status === 'completed' ? 'success' : undefined">
					{{ task.status === 'completed' ? 'mdi-check-circle-outline' : 'mdi-circle-outline' }}
				</v-icon>
				<div class="subtask-description flex-grow-1">
					<span :class="{ 'completed-subtask': task.status === 'completed' }">{{ task.description }}</span>
					<v-chip v-if="hasChildren(task)" x-small class="ml-2" :title="$t('Completed subtasks') + ': ' + progress(task)">{{ progress(task) }}</v-chip>
					<span class="caption ml-2 text--secondary">{{ task.status === 'completed' ? $t('Completed') : $t('Pending') }}</span>
				</div>
				<div class="subtask-actions d-flex">
					<v-btn v-if="task.status === 'pending'" icon small :title="$t('Complete subtask')" @click="$emit('complete', [task])"><v-icon small>mdi-check</v-icon></v-btn>
					<v-btn v-if="task.status === 'completed'" icon small :title="$t('Restore subtask')" @click="$emit('restore', [task])"><v-icon small>mdi-restore</v-icon></v-btn>
					<v-btn icon small :title="$t('Add subtask')" @click="$emit('add', task)"><v-icon small>mdi-plus</v-icon></v-btn>
					<v-btn icon small :title="$t('Edit subtask')" @click="$emit('edit', task)"><v-icon small>mdi-pencil</v-icon></v-btn>
					<v-btn icon small :title="$t('Delete subtask')" @click="$emit('delete', [task])"><v-icon small>mdi-delete</v-icon></v-btn>
				</div>
			</div>
			<SubtaskTree v-if="hasChildren(task) && !collapsed.includes(task.uuid)"
				:parent="task" :tasks="tasks" :ancestors="[...ancestors, parent.uuid]"
				@complete="$emit('complete', $event)" @restore="$emit('restore', $event)"
				@add="$emit('add', $event)" @edit="$emit('edit', $event)" @delete="$emit('delete', $event)" />
		</div>
	</div>
</template>

<script lang="ts">
import { defineComponent, computed, ref } from '@nuxtjs/composition-api';
import { TreeTask, childrenOf, progressOf } from '../utils/hierarchy';

export default defineComponent({
	name: 'SubtaskTree',
	props: {
		parent: { type: Object as () => TreeTask, required: true },
		tasks: { type: Array as () => TreeTask[], required: true },
		ancestors: { type: Array as () => string[], default: () => [] }
	},
	setup(props) {
		const collapsed = ref([] as string[]);
		const children = computed(() => childrenOf(props.parent, props.tasks)
			.filter(task => !props.ancestors.includes(task.uuid || '')));
		const hasChildren = (task: TreeTask) => childrenOf(task, props.tasks)
			.some(child => ![...props.ancestors, props.parent.uuid, task.uuid].includes(child.uuid));
		const toggle = (uuid: string) => {
			collapsed.value = collapsed.value.includes(uuid)
				? collapsed.value.filter(value => value !== uuid) : [...collapsed.value, uuid];
		};
		return { children, collapsed, hasChildren, toggle, progress: (task: TreeTask) => progressOf(task, props.tasks) };
	}
});
</script>

<style scoped>
.subtask-tree { padding-left: 20px; border-left: 2px solid rgba(128, 128, 128, .25); }
.subtask-row { gap: 4px; }
.subtask-indent { width: 28px; flex-shrink: 0; }
.subtask-description { min-width: 0; overflow-wrap: anywhere; }
.completed-subtask { text-decoration: line-through; opacity: .7; }
@media (max-width: 600px) {
	.subtask-tree { padding-left: 8px; }
	.subtask-row { flex-wrap: wrap; }
	.subtask-actions { margin-left: auto; }
}
</style>
