<template>
	<div class="px-md-6 px-lg-12">
		<v-row class="px-4 pt-4">
			<div class="headline d-flex align-center">{{ $t(mode) }}</div>
			<template v-if="mode === 'Projects'">
				<v-icon class="mx-2">
					mdi-chevron-right
				</v-icon>

				<v-select
					class="mb-3"
					:items="projects"
					:label="$t('Project')"
					v-model="project"
					style="max-width: 220px; min-width: 120px"
					hide-details
				/>
				<div class="ml-6 d-flex align-center">
					<v-progress-circular
						:size="54"
						:width="5"
						:value="progress"
						color="primary"
					>
						{{ progress }}%
					</v-progress-circular>
				</div>
			</template>

			<v-select
				class="mb-3 ml-3"
				:items="tagOptions"
				:label="$t('Tag')"
				v-model="tag"
				style="max-width: 200px; min-width: 120px"
				hide-details
				clearable
			/>

			<v-spacer />
			<v-select
				class="mb-3 ml-3"
				:items="allModes.map(value => ({ value, text: $t(value) }))"
				:label="$t('Display Mode')"
				v-model="mode"
				style="max-width: 120px"
				hide-details
			/>
		</v-row>

		<TaskList :tasks="tasks" />
	</div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted, ComputedRef, useStore, useContext } from '@nuxtjs/composition-api';
import TaskList from '../components/TaskList.vue';
import { Task } from 'taskwarrior-lib';
import { accessorType  } from "../store";
import { t, localeState } from "../utils/i18n";

export default defineComponent({
	setup() {
		const store = useStore<typeof accessorType>();
		const context = useContext();
		store.dispatch('fetchTasks');

		// Auto Refresh
		let refreshInterval: NodeJS.Timeout | null = null;
		const setAutoRefresh = () => {
			if (refreshInterval)
				clearInterval(refreshInterval);
			const freq = +store.state.settings.autoRefresh;
			if (freq > 0) {
				refreshInterval = setInterval(() => {
					store.dispatch('fetchTasks');
				}, +store.state.settings.autoRefresh * 60000);
			}
		};
		setAutoRefresh();

		// Auto Sync
		let syncInterval: NodeJS.Timeout | null = null;
		const setAutoSync = () => {
			if (syncInterval)
				clearInterval(syncInterval);
			const freq = +store.state.settings.autoSync;
			if (freq > 0) {
				syncInterval = setInterval(() => {
					store.dispatch('syncTasks');
				}, +store.state.settings.autoSync * 60000);
			}
		};
		setAutoSync();

		// Update settings
		watch(() => store.state.settings, () => {
			setAutoSync();
			setAutoRefresh();
			context.$vuetify.theme.dark = store.state.settings.dark;
		});

		// Display mode is remembered per browser.
		const allModes = ['Tasks', 'Projects'];
		const mode = ref('Tasks');
		onMounted(() => {
			try {
				const saved = localStorage.getItem('taskweb-mode');
				if (saved === 'Tasks' || saved === 'Projects') mode.value = saved;
			} catch { /* storage may be unavailable */ }
		});
		watch(mode, value => {
			try { localStorage.setItem('taskweb-mode', value); } catch { /* ignore */ }
		});

		const project = ref('');
		const projects: ComputedRef<string[]> = computed(() => store.getters.projects);
		watch(projects, () => {
			if (projects.value.includes(project.value))
				return;
			if (projects.value.length)
				project.value = projects.value[0];
			else
				project.value = '';
		});

		// Tag filter, available in both display modes.
		const tag = ref('');
		const tags: ComputedRef<string[]> = computed(() => [...new Set(store.state.tasks
			.filter((task: Task) => task.status === 'pending' || task.status === 'waiting')
			.reduce((all: string[], task: Task) => all.concat(task.tags || []), []))].sort());
		const tagOptions = computed(() => {
			// Read the reactive language so the options follow language changes.
			localeState.language;
			return [
				{ value: '', text: t('All tags') },
				...tags.value.map(value => ({ value, text: value }))
			];
		});
		watch(tags, () => {
			if (tag.value && !tags.value.includes(tag.value)) tag.value = '';
		});

		const matchesTag = (task: Task) => !tag.value || (task.tags || []).includes(tag.value);

		const tasks: ComputedRef<Task[]> = computed(() => {
			if (mode.value === 'Tasks')
				return store.state.tasks.filter(matchesTag);

			if (project.value)
				return store.state.tasks.filter(
					(task: Task) => task.project === project.value && matchesTag(task)
				);

			return [];
		});

		const progress = computed(() => {
			if (mode.value === 'Projects' && project.value) {
				const completed = tasks.value.reduce((acc: number, task) => task.status === 'completed' ? acc + 1 : acc, 0);
				const pending = tasks.value.reduce((acc: number, task) => task.status === 'pending' ? acc + 1 : acc, 0);
				return completed + pending === 0
					? 100
					: Math.ceil(100 * completed / (completed + pending));
			}
			return 0;
		});

		return {
			mode,
			allModes,
			TaskList,
			tasks,
			projects,
			project,
			tag,
			tagOptions,
			progress
		};
	}
});
</script>
