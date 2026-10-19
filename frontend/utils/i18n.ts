import Vue from 'vue';
import en from '../locales/en.json';
import es from '../locales/es.json';
import ca from '../locales/ca.json';

export type Language = 'en' | 'es' | 'ca';
export const languages: Language[] = ['en', 'es', 'ca'];
const messages: Record<Language, Record<string, string>> = { en, es, ca };
export const localeState = Vue.observable({ language: 'es' as Language });

export function detectLanguage(preferences: readonly string[]): Language {
	for (const preference of preferences) {
		const language = preference.toLowerCase().split(/[-_]/)[0] as Language;
		if (languages.includes(language)) return language;
	}
	return 'en';
}

export function t(key: string, params: Record<string, string | number> = {}): string {
	const translated = messages[localeState.language][key];
	const fallback = messages.en[key];
	const text = typeof translated === 'string' ? translated
		: typeof fallback === 'string' ? fallback : key;
	return text.replace(/\{(\w+)\}/g, (match, name) =>
		params[name] === undefined ? match : String(params[name]));
}

export function setLanguage(language: Language) {
	if (!languages.includes(language)) return;
	localeState.language = language;
	try { localStorage.setItem('taskweb-language', language); }
	catch { /* Language switching also works when storage is unavailable. */ }
}
