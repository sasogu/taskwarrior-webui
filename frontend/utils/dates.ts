import moment from 'moment';
import 'moment/locale/es';
import 'moment/locale/ca';
import { Language } from './i18n';

export function readTaskDate(value: string) {
	return /^\d{8}T\d{6}Z$/.test(value)
		? moment.utc(value, 'YYYYMMDDTHHmmss[Z]', true).local()
		: moment(value, moment.ISO_8601, true);
}

export function formatTaskDate(value: string, language: Language): string {
	const date = readTaskDate(value).locale(language);
	if (!date.isValid()) return value;
	const time = date.hours() || date.minutes() || date.seconds()
		? date.format(date.seconds() ? 'HH:mm:ss' : 'HH:mm') : '';
	return date.format('LL') + (time ? ' · ' + time : '');
}

export function parseDateInput(value: string, language: Language): string {
	// Leave machine dates and Taskwarrior expressions intact. Readable dates
	// are converted only after the user edits the field, never on display.
	if (!value || readTaskDate(value).isValid()) return value;
	// Moment's Catalan formatter prefixes month names (d'octubre / de gener),
	// while its strict month parser expects their standalone spelling.
	const input = language === 'ca'
		? value.replace(/^(\d{1,2}) (?:de |d['’])/i, '$1 ') : value;
	const date = moment(input, ['LL', 'L', 'LL [·] HH:mm', 'LL [·] HH:mm:ss',
		'LL HH:mm', 'LL HH:mm:ss', 'L HH:mm', 'L HH:mm:ss'], language, true);
	if (!date.isValid()) return value;
	return date.format('YYYY-MM-DDTHH:mm:ss');
}
