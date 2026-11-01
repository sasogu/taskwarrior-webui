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
		<div class="status-scroller px-1 pt-4">
			<v-btn-toggle v-model="status" mandatory background-color="rgba(0, 0, 0, 0)">
			<div class="d-flex flex-nowrap pa-2">
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
			</div>
		</v-btn-toggle>
		</div>

	<!-- Touch / narrow layout: cards with large tap targets -->
	<div v-if="cardView" class="task-cards pt-2">
		<div class="task-cards-toolbar d-flex align-center mb-2">
			<v-btn icon large :title="allSelected ? $t('Clear selection') : $t('Select all')"
				:aria-label="allSelected ? $t('Clear selection') : $t('Select all')"
				:disabled="!sortedItems.length" @click="toggleSelectAll">
				<v-icon>{{ allSelected ? 'mdi-checkbox-marked' : selected.length ? 'mdi-minus-box' : 'mdi-checkbox-blank-outline' }}</v-icon>
			</v-btn>
			<v-select
				v-model="sortKey"
				:items="sortOptions"
				:label="$t('Sort by')"
				class="task-sort mx-2"
				dense
				outlined
				hide-details
			/>
			<v-spacer />
			<v-btn icon large :title="$t('Refresh')" :aria-label="$t('Refresh')" @click="refresh">
				<v-icon>mdi-refresh</v-icon>
			</v-btn>
			<v-btn v-if="showSyncBtn" icon large :title="$t('Sync Tasks')" :aria-label="$t('Sync Tasks')" @click="syncTasks">
				<v-icon>mdi-sync</v-icon>
			</v-btn>
			<v-btn icon large :title="$t('Configure Columns')" :aria-label="$t('Configure Columns')" @click="showColumnDialog = true">
				<v-icon>mdi-cogs</v-icon>
			</v-btn>
			<v-btn icon large :title="$t('Table view')" :aria-label="$t('Table view')" @click="setLayout('table')">
				<v-icon>mdi-table</v-icon>
			</v-btn>
		</div>

		<v-sheet v-if="selected.length" rounded class="task-batch-bar d-flex align-center flex-wrap px-3 py-1 mb-2" color="primary" dark>
			<span class="mr-2">{{ $t('{count} selected', { count: selected.length }) }}</span>
			<v-spacer />
			<v-btn v-if="status === 'pending'" text large @click="completeTasks(selected)">
				<v-icon left>mdi-check</v-icon>{{ $t('Done') }}
			</v-btn>
			<v-btn v-if="status === 'completed' || status === 'deleted'" text large @click="restoreTasks(selected)">
				<v-icon left>mdi-restore</v-icon>{{ $t('Restore') }}
			</v-btn>
			<v-btn v-if="status !== 'deleted'" text large @click="deleteTasks(selected)">
				<v-icon left>mdi-delete</v-icon>{{ $t('Delete') }}
			</v-btn>
		</v-sheet>

		<div v-if="!sortedItems.length" class="text-center text--secondary py-12">{{ $t('No tasks') }}</div>

		<v-card
			v-for="item in sortedItems"
			:key="item.uuid"
			outlined
			class="task-card mb-2"
			:class="rowClass(item)"
		>
			<div class="task-card-main">
			<div class="task-card-head d-flex align-start">
				<v-btn icon large class="ma-1 flex-shrink-0"
					:aria-label="$t('Select task')"
					:aria-pressed="String(isSelected(item))"
					@click="toggleSelected(item)">
					<v-icon :color="isSelected(item) ? 'primary' : undefined">
						{{ isSelected(item) ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline' }}
					</v-icon>
				</v-btn>
				<div class="task-card-body flex-grow-1 py-3 pr-3" @click="cardClick($event, item)">
					<div class="task-card-title">
						<span v-html="linkify(item.description)" />
					</div>
					<div v-if="parentDescription(item)" class="caption text--secondary">{{ $t('Subtask of') }}: {{ parentDescription(item) }}</div>
					<div class="task-card-meta mt-1">
						<span v-if="shown('project') && item.project" class="task-meta"><v-icon small>mdi-folder-outline</v-icon>{{ item.project }}</span>
						<span v-if="shown('priority') && item.priority" class="task-meta" :class="'priority-' + item.priority"><v-icon small>mdi-flag-outline</v-icon>{{ $t(priorityNames[item.priority] || item.priority) }}</span>
						<span v-if="shown('due') && item.due && status !== 'waiting'" class="task-meta" :title="$t('Due')"><v-icon small>mdi-calendar-alert</v-icon>{{ displayDate(item.due) }}</span>
						<span v-if="shown('wait') && item.wait && status === 'waiting'" class="task-meta" :title="$t('Wait')"><v-icon small>mdi-pause</v-icon>{{ displayDate(item.wait) }}</span>
						<span v-if="shown('scheduled') && item.scheduled" class="task-meta" :title="$t('Scheduled')"><v-icon small>mdi-calendar-start</v-icon>{{ displayDate(item.scheduled) }}</span>
						<span v-if="shown('until') && item.until" class="task-meta" :title="$t('Until')"><v-icon small>mdi-calendar-end</v-icon>{{ displayDate(item.until) }}</span>
						<span v-if="shown('recur') && item.recur" class="task-meta" :title="$t('Recur')"><v-icon small>mdi-restart</v-icon>{{ item.recur }}</span>
						<span v-if="shown('urgency') && item.urgency" class="task-meta" :title="$t('Urgency')"><v-icon small>mdi-fire</v-icon>{{ Math.round(item.urgency * 10) / 10 }}</span>
						<template v-if="shown('tags')">
							<v-chip v-for="tag in item.tags" :key="tag" x-small class="mr-1">{{ tag }}</v-chip>
						</template>
					</div>
				</div>
			</div>
			<div class="task-card-actions d-flex align-center px-1">
				<v-btn v-if="children(item).length" text class="px-2"
					:aria-label="isExpanded(item) ? $t('Hide subtasks') : $t('Show subtasks')"
					:title="$t('Completed subtasks') + ': ' + progress(item)"
					@click="toggleExpanded(item)">
					<v-icon left>{{ isExpanded(item) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
					{{ progress(item) }}
				</v-btn>
				<v-spacer />
				<v-btn v-if="item.status !== 'deleted' && item.status !== 'recurring' && !item.recur"
					icon large :title="$t('Add subtask')" @click="newSubtask(item)"><v-icon>mdi-plus</v-icon></v-btn>
				<v-btn v-if="status === 'pending'" icon large color="success" :title="$t('Done')" @click="completeTasks([item])"><v-icon>mdi-check</v-icon></v-btn>
				<v-btn v-if="status === 'completed' || status === 'deleted'" icon large :title="$t('Restore')" @click="restoreTasks([item])"><v-icon>mdi-restore</v-icon></v-btn>
				<v-btn icon large :title="$t('Edit')" @click="editTask(item)"><v-icon>mdi-pencil</v-icon></v-btn>
				<v-btn v-if="status !== 'deleted'" icon large :title="$t('Delete')" @click="deleteTasks([item])"><v-icon>mdi-delete</v-icon></v-btn>
			</div>
			</div>
			<div v-if="isExpanded(item)" class="task-card-subtasks px-2 pb-2">
				<SubtaskTree :parent="item" :tasks="tasks"
					@add="newSubtask" @edit="editTask" @complete="completeTasks"
					@restore="restoreTasks" @delete="deleteTasks" />
			</div>
		</v-card>

		<v-btn
			class="new-task-fab"
			color="primary"
			fab
			large
			dark
			fixed
			bottom
			right
			:title="$t('New task')"
			:aria-label="$t('New task')"
			@click="newTask"
		>
			<v-icon>mdi-plus</v-icon>
		</v-btn>
	</div>

  <v-row v-else class="px-4 pt-4">
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
						<v-btn
							class="primary ml-1"
							fab
							dark
							small
							:title="$t('Card view')"
							@click="setLayout('cards')"
						>
							<v-icon>mdi-view-agenda-outline</v-icon>
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
import { defineComponent, useStore, useContext, computed, reactive, ref, watch, onMounted, onBeforeUnmount, ComputedRef, Ref } from '@nuxtjs/composition-api';
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

		// Layout: cards on tablets/phones and touch screens, table on wide desktop
		// screens. A manual choice is remembered per browser.
		const context = useContext();
		const layout = ref('auto');
		const coarsePointer = ref(false);
		let pointerQuery: MediaQueryList | null = null;
		const updatePointer = () => { coarsePointer.value = Boolean(pointerQuery?.matches); };
		onMounted(() => {
			try {
				const saved = localStorage.getItem('taskweb-layout');
				if (saved === 'cards' || saved === 'table') layout.value = saved;
			} catch { /* storage may be unavailable */ }
			if (window.matchMedia) {
				pointerQuery = window.matchMedia('(pointer: coarse)');
				updatePointer();
				pointerQuery.addEventListener?.('change', updatePointer);
			}
		});
		onBeforeUnmount(() => pointerQuery?.removeEventListener?.('change', updatePointer));
		const cardView = computed(() => layout.value === 'cards' || (layout.value === 'auto' &&
			(context.$vuetify.breakpoint.mdAndDown || coarsePointer.value)));
		const setLayout = (value: string) => {
			layout.value = value;
			try { localStorage.setItem('taskweb-layout', value); } catch { /* ignore */ }
		};

		const shown = (column: string) => !store.state.hiddenColumns.includes(column);
		const priorityNames: { [p: string]: string } = { L: 'Low', M: 'Medium', H: 'High' };
		// Sort order is remembered per browser.
		const sortKey = ref('urgency');
		const sortOptions = computed(() => [
			{ value: 'urgency', text: t('Urgency') },
			{ value: 'due', text: t('Due') },
			{ value: 'scheduled', text: t('Scheduled') },
			{ value: 'project', text: t('Project') },
			{ value: 'description', text: t('Description') }
		]);
		onMounted(() => {
			try {
				const saved = localStorage.getItem('taskweb-sort');
				if (saved && sortOptions.value.some(option => option.value === saved)) sortKey.value = saved;
			} catch { /* storage may be unavailable */ }
		});
		watch(sortKey, value => {
			try { localStorage.setItem('taskweb-sort', value); } catch { /* ignore */ }
		});
		const sortedItems = computed(() => {
			const items = [...rootItems.value] as TreeTask[];
			const key = sortKey.value;
			if (key === 'urgency')
				return items.sort((a, b) => (b.urgency || 0) - (a.urgency || 0));
			return items.sort((a, b) => {
				const x = (a as any)[key] || '';
				const y = (b as any)[key] || '';
				// Tasks without a value go last
				if (!x !== !y) return x ? -1 : 1;
				const order = String(x).localeCompare(String(y), localeState.language, { sensitivity: 'base' });
				return order || (b.urgency || 0) - (a.urgency || 0);
			});
		});
		const isSelected = (task: Task) => selected.value.some(value => value.uuid === task.uuid);
		const toggleSelected = (task: Task) => {
			selected.value = isSelected(task)
				? selected.value.filter(value => value.uuid !== task.uuid)
				: [...selected.value, task];
		};
		const allSelected = computed(() => sortedItems.value.length > 0 &&
			sortedItems.value.every(task => isSelected(task)));
		const toggleSelectAll = () => {
			selected.value = allSelected.value ? [] : [...sortedItems.value];
		};
		const isExpanded = (task: Task) => expanded.value.some(value => value.uuid === task.uuid);
		const toggleExpanded = (task: Task) => {
			expanded.value = isExpanded(task)
				? expanded.value.filter(value => value.uuid !== task.uuid)
				: [...expanded.value, task];
		};
		watch(status, () => { selected.value = []; });

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

		// Tapping the card body edits the task, except when a link was tapped.
		const cardClick = (event: MouseEvent, task: Task) => {
			if ((event.target as HTMLElement)?.closest?.('a')) return;
			editTask(task);
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
			cardView,
			setLayout,
			shown,
			priorityNames,
			sortKey,
			sortOptions,
			sortedItems,
			isSelected,
			toggleSelected,
			allSelected,
			toggleSelectAll,
			isExpanded,
			toggleExpanded,
			cardClick,

			TaskDialog,
			ConfirmationDialog,
			ColumnDialog,
			SubtaskTree,
		};
	}
});
</script>

<style>
.v-application tr.recur-task,
.v-application .task-card.recur-task {
  background-color: #2196F333;
}

.v-application tr.urgent-task,
.v-application .task-card.urgent-task {
  background-color: #F4433633;
}

.v-application tr.expired-task,
.v-application .task-card.expired-task {
  background-color: #79554844;
}

.status-scroller {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.status-scroller::-webkit-scrollbar {
  display: none;
}
.status-scroller .v-btn {
  min-height: 44px;
}

.task-cards {
  /* Leave room for the floating "new task" button */
  padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px));
}
.task-sort {
  max-width: 200px;
  min-width: 150px;
}
.task-card-body {
  min-width: 0;
  cursor: pointer;
  overflow-wrap: anywhere;
}
.task-card-title {
  font-size: 1.05rem;
  line-height: 1.4;
}
.task-card-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
  font-size: 0.875rem;
  opacity: 0.85;
}
.task-meta {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}
.task-meta .v-icon {
  margin-right: 3px;
}
.task-meta.priority-H {
  color: #E53935;
  font-weight: 600;
}
.task-meta.priority-M {
  color: #FB8C00;
}
/* Actions sit beside the task when there is room (tablet), below it on phones */
.task-card-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}
.task-card-head {
  flex: 1 1 340px;
  min-width: 0;
}
.task-card-actions {
  flex: 0 0 auto;
  min-height: 52px;
  margin-left: auto;
}
@media (max-width: 599px) {
  .task-card-actions {
    flex-basis: 100%;
    border-top: thin solid rgba(128, 128, 128, 0.2);
  }
  .task-sort {
    min-width: 120px;
    max-width: 150px;
  }
  .task-cards-toolbar .v-btn.v-btn--icon.v-size--large {
    width: 40px;
    height: 40px;
  }
}
.v-application .new-task-fab {
  bottom: calc(24px + env(safe-area-inset-bottom, 0px)) !important;
  right: calc(24px + env(safe-area-inset-right, 0px)) !important;
}
</style>
