<template>
	<v-dialog
		v-model="showDialog"
		max-width="400px"
		@keydown.esc="closeDialog"
	>
		<v-card>
			<v-card-title>
				{{ $t('Settings') }}
			</v-card-title>
			<v-card-text>
				<v-form ref="formRef">
					<v-list-item>
						<v-list-item-content>
							<v-list-item-title>
								{{ $t('Dark') }}
							</v-list-item-title>
							<v-list-item-subtitle>
								{{ $t('Default theme') }}
							</v-list-item-subtitle>
						</v-list-item-content>
						<v-list-item-action>
							<v-checkbox v-model="settings.dark" />
						</v-list-item-action>
					</v-list-item>

					<v-list-item>
						<v-list-item-content>
							<v-list-item-title>
								{{ $t('Auto Refresh') }}
							</v-list-item-title>
							<v-list-item-subtitle>
								{{ $t('In minutes (0 disables refresh)') }}
							</v-list-item-subtitle>
						</v-list-item-content>
						<v-list-item-action>
							<v-text-field
								v-model="settings.autoRefresh"
								style="width: 40px"
								:rules="numberRules"
							/>
						</v-list-item-action>
					</v-list-item>

					<v-list-item>
						<v-list-item-content>
							<v-list-item-title class="pb-1">
								{{ $t('Auto Sync') }}
								<v-icon size="18px" class="ml-2" @click="sync" :title="$t('Sync immediately')">
									mdi-sync
								</v-icon>
							</v-list-item-title>
							<v-list-item-subtitle>
								{{ $t('In minutes (0 disables auto sync)') }}<br />
								{{ $t('Run task sync periodically') }}
							</v-list-item-subtitle>
						</v-list-item-content>
						<v-list-item-action>
							<v-text-field
								v-model="settings.autoSync"
								style="width: 40px"
								:rules="numberRules"
							/>
						</v-list-item-action>
					</v-list-item>
				</v-form>
			</v-card-text>
			<v-card-actions>
				<v-spacer />
				<v-btn text @click="closeDialog">
					{{ $t('Cancel') }}
				</v-btn>
				<v-btn @click="reset">
					{{ $t('Reset') }}
				</v-btn>
				<v-btn color="primary" @click="save">
					{{ $t('Save') }}
				</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script lang="ts">
import { t } from '../utils/i18n';
import { watch, defineComponent, useStore, computed, ref, reactive } from '@nuxtjs/composition-api';
import { accessorType  } from "../store";

export default defineComponent({
	props: {
		value: Boolean,
	},

	setup(props, ctx) {
		const store = useStore<typeof accessorType>();

		const showDialog = computed({
			get: () => props.value,
			set: val => ctx.emit('input', val)
		});

		const numberRules = [
			(str: string) => (str && !isNaN(+str) && +str >= 0) || t('Invalid number')
		];

		const formRef = ref(null);
		const settings = reactive({
			dark: store.state.settings.dark,
			autoRefresh: store.state.settings.autoRefresh,
			autoSync: store.state.settings.autoSync
		});

		const reset = () => {
			settings.dark = store.state.settings.dark;
			settings.autoRefresh = store.state.settings.autoRefresh;
			settings.autoSync = store.state.settings.autoSync;
		};

		const closeDialog = () => {
			showDialog.value = false;
			reset();
		};

		const save = () => {
			const valid = (formRef as any).value.validate();
			if (valid) {
				store.dispatch('updateSettings', {
					...settings
				});
				closeDialog();
			}
		};

		const sync = async () => {
			await store.dispatch('syncTasks');
		};

		return {
			sync,
			showDialog,
			closeDialog,
			save,
			reset,
			settings,
			numberRules,
			formRef
		};
	}
});
</script>
