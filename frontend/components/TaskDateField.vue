<template>
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
</template>

<script lang="ts">
import { computed, defineComponent, ref } from '@nuxtjs/composition-api';
import { localeState } from '../utils/i18n';
import { formatTaskDate, parseDateInput, readTaskDate } from '../utils/dates';

export default defineComponent({
	props: {
		value: { type: String, default: '' },
		label: { type: String, required: true },
		rules: { type: Array, default: () => [] },
		required: Boolean
	},
	setup(props, { emit }) {
		const open = ref(false);
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
		const selectDate = (date: string) => {
			editing.value = false;
			emit('input', date);
			open.value = false;
		};
		return { open, calendarDate, selectDate, displayValue, updateValue, beginEdit, editing };
	}
});
</script>
