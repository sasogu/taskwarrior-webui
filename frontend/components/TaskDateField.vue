<template>
	<v-text-field
		:value="value"
		:label="label"
		:rules="rules"
		:required="required"
		clearable
		hint="AAAA-MM-DD o una expresión como tomorrow o +1w"
		@input="$emit('input', $event || '')"
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
						:aria-label="'Abrir calendario: ' + label"
						:title="'Abrir calendario: ' + label"
						v-bind="attrs"
						v-on="on"
					>
						<v-icon>mdi-calendar</v-icon>
					</v-btn>
				</template>
				<v-date-picker
					:value="calendarDate"
					locale="es"
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
import moment from 'moment';

export default defineComponent({
	props: {
		value: { type: String, default: '' },
		label: { type: String, required: true },
		rules: { type: Array, default: () => [] },
		required: Boolean
	},
	setup(props, { emit }) {
		const open = ref(false);
		const calendarDate = computed(() => {
			// Read exported UTC timestamps in local time without rewriting the field.
			// Relative expressions remain untouched until a day is selected.
			const date = /^\d{8}T\d{6}Z$/.test(props.value)
				? moment.utc(props.value, 'YYYYMMDDTHHmmss[Z]', true).local()
				: moment(props.value, moment.ISO_8601, true);
			return date.isValid() ? date.format('YYYY-MM-DD') : null;
		});
		const selectDate = (date: string) => {
			emit('input', date);
			open.value = false;
		};
		return { open, calendarDate, selectDate };
	}
});
</script>
