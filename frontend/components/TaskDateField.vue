<template>
	<div class="task-date-field">
	<v-text-field
		:value="displayValue"
		:label="label"
		:rules="rules"
		:required="required"
		clearable
		:hint="$t('Choose a day in the calendar or type a date or expression such as tomorrow.')"
		@input="updateValue"
		@focus="beginEdit"
		@blur="editing = false"
	>
		<template v-slot:append>
			<v-menu
				v-model="open"
				:close-on-content-click="false"
				:offset-y="true"
				min-width="0"
			>
				<template v-slot:activator="{ on, attrs }">
					<v-btn
						icon small
						:aria-label="$t('Open calendar') + ': ' + label"
						:title="$t('Open calendar') + ': ' + label"
						v-bind="attrs"
						v-on="on"
					>
						<v-icon>mdi-calendar</v-icon>
					</v-btn>
				</template>
				<v-date-picker
					:value="calendarDate"
					:locale="$language"
					:first-day-of-week="1"
					width="280"
					@input="selectDate"
				/>
			</v-menu>
		</template>
	</v-text-field>
	<v-menu v-model="timeOpen" :close-on-content-click="false" offset-y min-width="0" :disabled="!calendarDate">
		<template v-slot:activator="{ on, attrs }">
			<v-text-field
				:value="timeValue"
				:label="$t('Time')"
				:aria-label="$t('Time') + ': ' + label"
				:disabled="!calendarDate"
				:hint="!calendarDate ? $t('Choose a date first') : ''"
				persistent-hint
				dense readonly
				append-icon="mdi-clock-outline"
				class="task-time-field mb-3"
				v-bind="attrs" v-on="on"
				@click:append="timeOpen = true"
			/>
		</template>
		<v-time-picker v-if="timeOpen" v-model="draftTime" format="24hr" width="280" scrollable>
			<v-spacer />
			<v-btn text @click="timeOpen = false">{{ $t('Cancel') }}</v-btn>
			<v-btn text color="primary" @click="applyTime">{{ $t('Save') }}</v-btn>
		</v-time-picker>
	</v-menu>
	</div>
</template>

<script lang="ts">
import { computed, defineComponent, ref, watch } from '@nuxtjs/composition-api';
import { localeState } from '../utils/i18n';
import { formatTaskDate, parseDateInput, readTaskDate, setTaskDay, setTaskTime } from '../utils/dates';

export default defineComponent({
	props: {
		value: { type: String, default: '' },
		label: { type: String, required: true },
		rules: { type: Array, default: () => [] },
		required: Boolean
	},
	setup(props, { emit }) {
		const open = ref(false);
		const timeOpen = ref(false);
		const draftTime = ref('00:00');
		const editing = ref(false);
		const draft = ref('');
		const displayValue = computed(() => editing.value ? draft.value
			: formatTaskDate(props.value, localeState.language));
		const beginEdit = () => {
			draft.value = formatTaskDate(props.value, localeState.language);
			editing.value = true;
		};
		const updateValue = (value: string | null) => {
			draft.value = value || '';
			if (value === formatTaskDate(props.value, localeState.language)) return;
			emit('input', parseDateInput(value || '', localeState.language));
		};
		const calendarDate = computed(() => {
			// Read exported UTC timestamps in local time without rewriting the field.
			// Relative expressions remain untouched until a day is selected.
			const date = readTaskDate(props.value);
			return date.isValid() ? date.format('YYYY-MM-DD') : null;
		});
		const timeValue = computed(() => {
			const date = readTaskDate(props.value);
			return date.isValid() ? date.format('HH:mm') : '';
		});
		watch(timeOpen, value => {
			if (value) draftTime.value = timeValue.value || '00:00';
		});
		const applyTime = () => {
			editing.value = false;
			emit('input', setTaskTime(props.value, draftTime.value));
			timeOpen.value = false;
		};
		const selectDate = (date: string) => {
			editing.value = false;
			emit('input', setTaskDay(props.value, date));
			open.value = false;
		};
		return { open, calendarDate, selectDate, displayValue, updateValue, beginEdit, editing,
			timeOpen, draftTime, timeValue, applyTime };
	}
});
</script>

<style scoped>
.task-time-field { max-width: 180px; }
</style>
