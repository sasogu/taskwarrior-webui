<template>
	<div>
		<ConfirmationDialog
			v-model="showConfirmationDialog"
			:title="confirmation.title"
			:text="confirmation.text"
			@yes="confirmation.handler"
		/>
		<TaskDialog v-model="showTaskDialog" :task="currentTask || undefined" :parent-task="parentTask || undefined" />
		<ColumnDialog v-model="showColumnDialog" :active-columns="headers"/>
		<v-row class="px-4 pt-4">
			<v-btn-toggle v-model="status" mandatory background-color="rgba(0, 0, 0, 0)">
			<v-row class="pa-3">
				<v-btn
					v-for="st in allStatus"
					:key="st"
					:value="st"
					:color="st === status ? 'primary' : undefined"
					text
					@click="st !== status && (selected = [])"
				>
					<v-icon
						class="mr-1"
						:color="st === status ? 'primary' : undefined"
					>
						{{ statusIcons[st] }}
					</v-icon>
					{{ $t(st) }}
					<v-badge
						v-if="st === 'pending' && classifiedTasks[st].value && classifiedTasks[st].value.length"
						:content="classifiedTasks[st].value.length"
						:color="st === status ? 'primary' : 'grey'"
						inline
					/>
				</v-btn>
			</v-row>
		</v-btn-toggle>
  </v-row>

  <v-row class="px-4 pt-4">
		<v-data-table
			:items="rootItems"
			:expanded.sync="expanded"
			show-expand
			:headers="filteredHeaders"
			show-select
			item-key="uuid"
			:item-class="rowClass"
			v-model="selected"
			class="elevation-1"
			style="width: 100%"
		>
			<template v-slot:top>
				<v-row class="px-4">
					<!-- Batch actions -->
					<div class="pl-2 pt-2" v-show="selected.length">
						<v-btn
							v-show="status === 'pending'"
							class="ma-1 green"
							fab
							small
							dark
							:title="$t('Done')"
							@click="completeTasks(selected)"
						>
							<v-icon>mdi-check</v-icon>
						</v-btn>
						<v-btn
							v-show="status === 'completed' || status === 'deleted'"
							class="ma-1"
							color="primary"
							fab
							dark
							small
							:title="$t('Restore')"
							@click="restoreTasks(selected)"
						>
							<v-icon>mdi-restore</v-icon>
						</v-btn>
						<v-btn
							v-show="status !== 'deleted'"
							class="ma-1 red"
							fab
							dark
							small
							:title="$t('Delete')"
							@click="deleteTasks(selected)"
						>
							<v-icon>mdi-delete</v-icon>
						</v-btn>
					</div>

					<v-spacer />

					<!-- Global Actions -->
					<div class="ma-2">
						<v-btn
							class="green ml-1"
							fab
							dark
							:title="$t('Refresh')"
							@click="refresh"
						>
							<v-icon>mdi-refresh</v-icon>
						</v-btn>

						<v-btn
								v-if="showSyncBtn"
								class="green ml-1"
								fab
								dark
								:title="$t('Sync Tasks')"
								@click="syncTasks"
							>
								<v-icon>mdi-sync</v-icon>
						</v-btn>

						<v-btn
							class="primary ml-1"
							fab
							dark
							:title="$t('New task')"
							@click="newTask"
						>
							<v-icon>mdi-plus</v-icon>
						</v-btn>
						<v-btn
							class="primary ml-1"
							fab
							dark
							small
							:title="$t('Configure Columns')"
							@click="showColumnDialog = true"
						>
							<v-icon>mdi-cogs</v-icon>
						</v-btn>
					</div>
				</v-row>
			</template>

			<template v-slot:item.description="{ item }">
				<span v-html="linkify(item.description)" />
				<v-chip v-if="children(item).length" small class="ml-2" :title="$t('Completed subtasks') + ': ' + progress(item)">{{ progress(item) }}</v-chip>
				<div v-if="parentDescription(item)" class="caption text--secondary">{{ $t('Subtask of') }}: {{ parentDescription(item) }}</div>
			</template>

			<template v-slot:item.data-table-expand="{ item, isExpanded, expand }">
				<v-btn v-if="children(item).length" icon small
					:aria-label="isExpanded ? $t('Hide subtasks') : $t('Show subtasks')" @click="expand(!isExpanded)">
					<v-icon>{{ isExpanded ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
				</v-btn>
			</template>
			<template v-slot:expanded-item="{ item, headers }">
				<td :colspan="headers.length" class="py-2">
					<SubtaskTree :parent="item" :tasks="tasks"
						@add="newSubtask" @edit="editTask" @complete="completeTasks"
						@restore="restoreTasks" @delete="deleteTasks" />
				</td>
			</template>

			<template v-if="status === 'waiting'" v-slot:item.wait="{ item }">
				{{ displayDate(item.wait) }}
			</template>
			<template v-slot:item.scheduled="{ item }">
				{{ displayDate(item.scheduled) }}
			</template>
			<template v-slot:item.due="{ item }">
				{{ displayDate(item.due) }}
			</template>
			<template v-slot:item.until="{ item }">
				{{ displayDate(item.until) }}
			</template>

			<template v-slot:item.tags="{ item }">
				<v-chip
					v-for="tag in item.tags"
					:key="tag"
					small
				>
					{{ tag }}
				</v-chip>
			</template>

			<template v-slot:item.urgency="{ item }">
				{{ item.urgency }}
			</template>

			<template v-slot:item.actions="{ item }">
				<v-icon v-if="item.status !== 'deleted' && item.status !== 'recurring' && !item.recur"
					class="ml-2" size="20px" :title="$t('Add subtask')" @click="newSubtask(item)">mdi-plus</v-icon>
				<v-icon
					v-show="status === 'pending'"
					size="20px"
					class="ml-2"
					@click="completeTasks([item])"
					:title="$t('Done')"
				>
					mdi-check
				</v-icon>
				<v-icon
					v-show="status === 'completed' || status === 'deleted'"
					size="20px"
					class="ml-2"
					@click="restoreTasks([item])"
					:title="$t('Restore')"
				>
					mdi-restore
				</v-icon>
				<v-icon
					class="ml-2"
					size="20px"
					@click="editTask(item)"
					:title="$t('Edit')"
				>
					mdi-pencil
				</v-icon>
				<v-icon
					v-show="status !== 'deleted'"
					class="ml-2"
					size="20px"
					@click="deleteTasks([item])"
					:title="$t('Delete')"
				>
					mdi-delete
				</v-icon>
			</template>
		</v-data-table>
  </v-row>
  </div>
</template>

<script lang="ts">
import { t, localeState } from '../utils/i18n';
import { formatTaskDate } from '../utils/dates';
import { defineComponent, useStore, computed, reactive, ref, ComputedRef, Ref } from '@nuxtjs/composition-api';
import { Task } from 'taskwarrior-lib';
import _ from 'lodash';
import TaskDialog from '../components/TaskDialog.vue';
import ConfirmationDialog from '../components/ConfirmationDialog.vue';
import ColumnDialog from '../components/ColumnDialog.vue';
import moment from 'moment';
import urlRegex from 'url-regex-safe';
import normalizeUrl from 'normalize-url';
import { accessorType  } from "../store";
import SubtaskTree from './SubtaskTree.vue';
import { TreeTask, childrenOf, descendantsOf, progressOf, rootTasks } from '../utils/hierarchy';

function displayDate(str?: string) {
	const language = localeState.language;
	if (!str)
		return str;

	const date = moment(str);
	const diff = moment.duration(date.diff(moment()));
	if (Math.abs(diff.asDays()) < 1)
		return diff.locale(language).humanize(true);
	return formatTaskDate(str, language);
}

function urgentDate(str?: string) {
	if (!str)
		return false;

	const date = moment(str);
	const diff = moment.duration(date.diff(moment()));
	const days = diff.asDays();
	if (days > 0 && days < 1)
		return true;

	return false;
}

function expiredDate(str?: string) {
	if (!str)
		return false;

	const date = moment(str);
	return date.isBefore(moment());
}

function futureDate(str?: string) {
	if (!str)
		return false;

	const date = moment(str);
	return date.isAfter(moment());
}

function linkify(text: string) {
	const regex = urlRegex();

	let match;
	let lastIndex = 0;
	let result = '';
	while ((match = regex.exec(text)) !== null) {
		const str = text.substring(lastIndex, match.index);
		const url = `<a target="_blank" href=${normalizeUrl(match[0])}>${match[0]}</a>`;
		result = `${result}${str}${url}`;
		lastIndex = match.index + match[0].length;
	}
	result += text.substring(lastIndex);

	return result;
}

export default defineComponent({
	props: {
		tasks: {
			type: Array as () => Task[],
			required: true
		}
	},

	setup(props) {
		const store = useStore<typeof accessorType>();
		const selected = ref([] as Task[]);

		const status = ref('pending');
		const allStatus = ['pending', 'waiting', 'completed', 'deleted', 'recurring'];
		const statusIcons: { [st: string]: string } = {
			pending: 'mdi-clock-outline',
			waiting: 'mdi-pause',
			completed: 'mdi-check',
			deleted: 'mdi-delete',
			recurring: 'mdi-restart'
		};
		const headers = computed(() => [
			{ text: t('Project'), value: 'project' },
			{ text: t('Description'), value: 'description' },
			{ text: t('Priority'), value: 'priority' },
			{ text: t('Scheduled'), value: 'scheduled' },
			...(status.value === 'recurring'
				? [{ text: t('Recur'), value: 'recur' }]
				: []),
			...(status.value !== 'waiting'
				? [{ text: t('Due'), value: 'due' }]
				: [{ text: t('Wait'), value: 'wait' }]),
			{ text: t('Until'), value: 'until' },
			{ text: t('Tags'), value: 'tags' },
			{ text: t('Urgency'), value: 'urgency', sort: (a: number, b: number) => b - a },
			{ text: t('Actions'), value: 'actions', sortable: false }
		]);

		const filteredHeaders = computed(()=>
			headers.value.filter((v)=> !store.state.hiddenColumns.includes(v.value))
		)

		const showColumnDialog = ref(false);

		const tempTasks: { [key: string]: ComputedRef<Task[]> } = {};
		for (const status of allStatus) {
			tempTasks[status] = computed((): Task[] => props.tasks?.filter(task => {
				if (status === "waiting" || status === "pending") {
					const waiting = (task.wait && !expiredDate(task.wait))
						|| (task.scheduled && futureDate(task.scheduled));
					return task.status === "pending" && (status === "pending" ? !waiting : waiting);
				}
				else if (status === "pending") {
					return task.status === "pending" && !(task.wait && !expiredDate(task.wait));
				}
				else {
					return task.status === status;
				}
			}));
		}
		// Vue 2 unwraps refs on the reactive object; retain the original refs
		// separately for script-side access as well as the template's arrays.
		const statusLists = new Map(Object.entries(tempTasks));
		const classifiedTasks = reactive(tempTasks);
		const rootItems = computed(() => rootTasks(statusLists.get(status.value)!.value, props.tasks));
		const expanded = ref([] as Task[]);
		const children = (task: TreeTask) => childrenOf(task, props.tasks);
		const progress = (task: TreeTask) => progressOf(task, store.state.tasks);
		const parentDescription = (task: TreeTask) => task.webparent
			? (store.state.tasks as TreeTask[]).find(parent => parent.uuid === task.webparent)?.description : '';

		const refresh = () => {
			store.dispatch('fetchTasks');
		};

		const showConfirmationDialog = ref(false);
		const confirmation = reactive({
			title: t('Confirm'),
			text: '',
			handler: () => {}
		});

		const showTaskDialog = ref(false);
		const currentTask: Ref<Task | null> = ref(null);
		const parentTask: Ref<TreeTask | null> = ref(null);

		const showSyncBtn = computed(() => {
			return store.state.settings.autoSync !== '0';
		});

		const syncTasks = async () => {
			try {
				await store.dispatch('syncTasks');
				store.commit('setNotification', {
					color: 'success',
					text: t('Tasks synced.')
				});
			} catch (error) {
				store.commit('setNotification', {
					color: 'error',
					text: t('Could not sync tasks.')
				});
			}
		};

		const newTask = () => {
			parentTask.value = null;
			showTaskDialog.value = true;
			currentTask.value = null;
		};

		const editTask = (task: Task) => {
			parentTask.value = null;
			showTaskDialog.value = true;
			currentTask.value = _.cloneDeep(task);
		};

		const newSubtask = (task: TreeTask) => {
			currentTask.value = null;
			parentTask.value = task;
			if (!expanded.value.some(value => value.uuid === task.uuid)) expanded.value.push(task);
			showTaskDialog.value = true;
		};

		const applyCompletion = async (tasks: Task[]) => {
			try {
				await store.dispatch('updateTasks', tasks.map(task => {
					return {
						...task,
						status: 'completed'
					};
				}));
			}
			catch {
				return;
			}
			selected.value = selected.value.filter(task => tasks.findIndex(t => t.uuid === task.uuid) === -1);
			store.commit('setNotification', {
				color: 'success',
				text: t('Tasks completed.')
			});
		};

		const completeTasks = (tasks: Task[]) => {
			const selectedIds = new Set(tasks.map(task => task.uuid));
			const unfinished = new Set(tasks.flatMap(task => descendantsOf(task, store.state.tasks))
				.filter(task => task.status !== 'completed' && !selectedIds.has(task.uuid)).map(task => task.uuid));
			confirmation.title = t('Complete task');
			confirmation.text = t('Mark as completed?') + '\n' + tasks.map(task => '• ' + task.description).join('\n') +
				(unfinished.size ? '\n' + t('There are {count} pending subtasks. They will not be completed automatically.', {count: unfinished.size}) : '');
			confirmation.handler = () => { void applyCompletion(tasks); };
			showConfirmationDialog.value = true;
		};

		const deleteTasks = (tasks: Task[]) => {
			confirmation.title = t('Delete task');
			confirmation.text = t('Delete the selected tasks?');
			confirmation.handler = async () => {
				try { await store.dispatch('deleteTasks', tasks); }
				catch { return; }
				selected.value = selected.value.filter(task => tasks.findIndex(t => t.uuid === task.uuid) === -1);
				store.commit('setNotification', {
					color: 'success',
					text: t('Tasks deleted.')
				});
			};
			showConfirmationDialog.value = true;
		};

		const restoreTasks = (tasks: Task[]) => {
			confirmation.title = t('Restore task');
			confirmation.text = t('Restore the selected tasks?');
			confirmation.handler = async () => {
				try {
					await store.dispatch('updateTasks', tasks.map(task => {
						return {
							...task,
							status: 'pending'
						};
					}));
				}
				catch {
					return;
				}
				selected.value = selected.value.filter(task => tasks.findIndex(t => t.uuid === task.uuid) === -1);
				store.commit('setNotification', {
					color: 'success',
					text: t('Tasks restored.')
				});
			};
			showConfirmationDialog.value = true;
		};

		const rowClass = (item: Task) => {
			if (item.mask)
				return 'recur-task';
			else if (status.value !== 'completed' && urgentDate(item.due))
				return 'urgent-task';
			else if (status.value !== 'completed' && expiredDate(item.due))
				return 'expired-task';
			return undefined;
		};

		return {
			linkify,
			refresh,
			headers,
			filteredHeaders,
			classifiedTasks,
			rootItems,
			expanded,
			children,
			progress,
			parentDescription,
			status,
			allStatus,
			statusIcons,
			selected,
			showSyncBtn,
			syncTasks,
			newTask,
			currentTask,
			parentTask,
			newSubtask,
			editTask,
			deleteTasks,
			completeTasks,
			restoreTasks,
			showTaskDialog,
			showConfirmationDialog,
			showColumnDialog,
			confirmation,
			displayDate,
			rowClass,

			TaskDialog,
			ConfirmationDialog,
			ColumnDialog,
			SubtaskTree,
		};
	}
});
</script>

<style>
.v-application tr.recur-task {
  background-color: #2196F333;
}

.v-application tr.urgent-task {
  background-color: #F4433633;
}

.v-application tr.expired-task {
  background-color: #79554844;
}
</style>
