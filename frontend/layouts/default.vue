<template>
	<v-app class="task-app">
		<SettingsDialog v-model="settingsDialog" />

		<v-snackbar
			v-model="snackbar"
			:color="notification.color"
			:timeout="4000"
		>
			{{ notification.text }}

			<template v-slot:action="{ attrs }">
				<v-btn
					dark
					text
					v-bind="attrs"
					@click="snackbar = false"
				>
					{{ $t('Close') }}
				</v-btn>
			</template>
		</v-snackbar>

		<v-app-bar height="54px" fixed app>
			<v-icon class="mr-2" color="blue">
				mdi-sticker-check-outline
			</v-icon>
			<v-toolbar-title class="d-none d-sm-flex">
				Taskwarrior WebUI
			</v-toolbar-title>
			<v-spacer />
			<v-menu offset-y>
				<template v-slot:activator="{ on, attrs }">
					<v-btn text small class="px-2" :title="$t('Language')" :aria-label="$t('Language')" v-bind="attrs" v-on="on">
						<v-icon small class="mr-1">mdi-translate</v-icon>
						{{ $language.toUpperCase() }}
					</v-btn>
				</template>
				<v-list dense>
					<v-list-item v-for="language in languageOptions" :key="language.value"
						:input-value="$language === language.value" @click="$language = language.value">
						<v-list-item-title>{{ language.text }}</v-list-item-title>
					</v-list-item>
				</v-list>
			</v-menu>
			<v-btn icon :title="$t('Theme')" :aria-label="$t('Theme')" @click="dark = !dark">
				<v-icon size="26px">{{ dark ? 'mdi-brightness-4' : 'mdi-brightness-7' }}</v-icon>
			</v-btn>
			<v-btn icon :title="$t('Settings')" :aria-label="$t('Settings')" @click="settingsDialog = true">
				<v-icon size="26px">mdi-cog</v-icon>
			</v-btn>
		</v-app-bar>

		<v-main>
			<v-container fluid>
				<nuxt />
			</v-container>
		</v-main>
	</v-app>
</template>

<script lang="ts">
import { defineComponent, useContext, useStore, computed, onErrorCaptured, ref, watch } from '@nuxtjs/composition-api';
import SettingsDialog from '../components/SettingsDialog.vue';
import { localeState } from '../utils/i18n';
import { accessorType  } from "../store";

export default defineComponent({
	head() {
		return { htmlAttrs: { lang: localeState.language } };
	},
	setup(_props, ctx) {
		const context = useContext();
		const store = useStore<typeof accessorType>();
		store.dispatch('fetchSettings');
		store.dispatch('fetchHiddenColumns');

		context.$vuetify.theme.dark = store.state.settings.dark;

		const dark = computed({
			get: () => context.$vuetify.theme.dark,
			set: val => {
				context.$vuetify.theme.dark = val;
				if (store.state.settings.dark !== val)
					store.dispatch('updateSettings', { ...store.state.settings, dark: val });
			}
		});

		const settingsDialog = ref(false);

		const notification = computed(() => store.state.notification);
		const snackbar = computed({
			get: () => store.state.snackbar,
			set: val => store.commit('setSnackbar', val)
		});

		onErrorCaptured((err: any) => {
			// axios error
			let notification: any;
			if (err?.response) {
				const { status, data } = err.response!;
				notification = {
					color: 'error',
					text: `Error ${status}: ${data}`
				};
			}
			else {
				const { name, message } = err as Error;
				notification = {
					color: 'error',
					text: `Error ${name}: ${message}`
				};
			}
			store.commit('setNotification', notification);
			return false;
		});

		return {
			languageOptions: [
				{ value: 'es', text: 'Español' },
				{ value: 'en', text: 'English' },
				{ value: 'ca', text: 'Català' }
			],
			dark,
			snackbar,
			notification,
			settingsDialog,

			SettingsDialog
		};
	}
});
</script>
