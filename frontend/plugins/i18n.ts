import Vue from 'vue';
import { Plugin } from '@nuxt/types';
import moment from 'moment';
import 'moment/locale/es';
import 'moment/locale/ca';
import en from 'vuetify/es5/locale/en';
import es from 'vuetify/es5/locale/es';
import ca from 'vuetify/es5/locale/ca';
import { detectLanguage, languages, Language, localeState, setLanguage, t } from '../utils/i18n';

Vue.mixin({
	methods: { $t: t },
	computed: {
		$language: {
			get: () => localeState.language,
			set: (language: Language) => setLanguage(language)
		}
	}
});

const plugin: Plugin = (context) => {
	let saved: string | null = null;
	try { saved = localStorage.getItem('taskweb-language'); }
	catch { /* Fall back to the browser preferences. */ }
	localeState.language = languages.includes(saved as Language)
		? saved as Language : detectLanguage(navigator.languages || [navigator.language]);
	const vuetify = (context as any).$vuetify;
	Object.assign(vuetify.lang.locales, { en, es, ca });
	const apply = () => {
		vuetify.lang.current = localeState.language;
		moment.locale(localeState.language);
		document.documentElement.lang = localeState.language;
	};
	apply();
	new Vue().$watch(() => localeState.language, apply);
};

export default plugin;
