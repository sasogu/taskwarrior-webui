<template>
	<v-dialog
		v-model="showDialog"
		max-width="480px"
		@keydown.esc="close"
	>
		<v-card>
			<v-card-title class="headline d-flex align-center">
				<v-icon left color="orange darken-2">mdi-pause</v-icon>
				{{ $t('Put on hold') }}
			</v-card-title>

			<v-card-text class="pt-2">
				<div class="mb-3 text--secondary text-truncate">
					<template v-if="tasks.length === 1">
						<strong>{{ tasks[0].description }}</strong>
					</template>
					<template v-else>
						{{ $t('{count} selected', { count: tasks.length }) }}
					</template>
				</div>

				<div class="mb-2">
					<span class="text-caption text--secondary d-block mb-1">{{ $t('Quick presets') }}</span>
					<v-chip
						v-for="preset in presets"
						:key="preset.id"
						small
						class="mr-2 mb-2"
						:color="selectedPreset === preset.id ? 'primary' : undefined"
						:outlined="selectedPreset !== preset.id"
						@click="applyPreset(preset)"
					>
						{{ preset.label }}
					</v-chip>
				</div>

				<task-date-field
					v-model="waitDate"
					:label="$t('Wait')"
					required
					@input="selectedPreset = ''"
				/>
			</v-card-text>

			<v-card-actions class="px-4 pb-4">
				<v-btn
					v-if="hasWaitTasks"
					text
					color="orange darken-2"
					@click="clearWait"
				>
					<v-icon left small>mdi-play</v-icon>
					{{ $t('Clear wait') }}
				</v-btn>
				<v-spacer />
				<v-btn text @click="close">{{ $t('Cancel') }}</v-btn>
				<v-btn
					color="primary"
					:disabled="!waitDate"
					@click="submit"
				>
					{{ $t('Save') }}
				</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script lang="ts">
import { computed, defineComponent, ref, watch } from '@nuxtjs/composition-api';
import { Task } from 'taskwarrior-lib';
import moment from 'moment';
import { t } from '../utils/i18n';
import { setTaskDay } from '../utils/dates';

export default defineComponent({
	props: {
		value: Boolean,
		tasks: {
			type: Array as () => Task[],
			default: () => []
		}
	},

	setup(props, { emit }) {
		const showDialog = computed({
			get: () => props.value,
			set: val => emit('input', val)
		});

		const waitDate = ref('');
		const selectedPreset = ref('');

		const presets = computed(() => [
			{ id: 'tomorrow', label: t('Tomorrow'), getDay: () => moment().add(1, 'day').format('YYYY-MM-DD') },
			{ id: '2d', label: t('+2 days'), getDay: () => moment().add(2, 'days').format('YYYY-MM-DD') },
			{ id: 'week', label: t('Next week'), getDay: () => moment().add(1, 'week').format('YYYY-MM-DD') },
			{ id: 'month', label: t('1 month'), getDay: () => moment().add(1, 'month').format('YYYY-MM-DD') }
		]);

		const hasWaitTasks = computed(() => props.tasks.some(task => !!task.wait));

		watch(() => props.value, open => {
			if (open) {
				selectedPreset.value = '';
				if (props.tasks.length === 1 && props.tasks[0].wait) {
					waitDate.value = props.tasks[0].wait;
				} else {
					waitDate.value = '';
				}
			}
		});

		const applyPreset = (preset: { id: string; getDay: () => string }) => {
			selectedPreset.value = preset.id;
			waitDate.value = setTaskDay('', preset.getDay());
		};

		const close = () => {
			showDialog.value = false;
		};

		const submit = () => {
			if (!waitDate.value) return;
			emit('apply', waitDate.value);
			showDialog.value = false;
		};

		const clearWait = () => {
			emit('clear');
			showDialog.value = false;
		};

		return {
			showDialog,
			waitDate,
			selectedPreset,
			presets,
			hasWaitTasks,
			applyPreset,
			close,
			submit,
			clearWait
		};
	}
});
</script>
