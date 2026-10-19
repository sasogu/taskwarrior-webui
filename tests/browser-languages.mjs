// Only use a disposable API container containing synthetic tasks.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.TASKWEB_PLAYWRIGHT || 'playwright');
const browser = await chromium.launch({headless: true, executablePath: '/usr/bin/chromium'});
const baseURL = process.env.TASKWEB_TEST_URL || 'http://127.0.0.1:18097';
const context = await browser.newContext({baseURL, locale: 'ca-ES', timezoneId: 'Europe/Madrid',
	extraHTTPHeaders: {'Tailscale-User-Login': 'subtasks@example.invalid'}, serviceWorkers: 'block'});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const response = await context.request.get('/api/tasks');
assert.equal(response.status(), 200, 'Disposable identity required');
assert.ok((await response.json()).every(task => task.description.startsWith('TEST ')), 'ABORT: synthetic tasks required');
const dialog = () => page.locator('.v-dialog--active');
async function switchLanguage(name) {
	await page.locator('header').getByRole('button', {name: /^(Idioma|Language)$/}).click();
	await page.locator('.menuable__content__active').getByText(name, {exact: true}).click();
}
try {
	await page.goto('/');
	await page.getByTitle('Tasca nova', {exact: true}).waitFor();
	await page.waitForFunction(() => document.documentElement.lang === 'ca');
	assert.equal(await page.locator('html').getAttribute('lang'), 'ca', 'Detect Catalan browser');
	for (const [language, name, newTask, due, calendar, cancel, settings] of [
		['es', 'Español', 'Nueva tarea', 'Vencimiento', 'Abrir calendario', 'Cancelar', 'Ajustes'],
		['en', 'English', 'New task', 'Due', 'Open calendar', 'Cancel', 'Settings'],
		['ca', 'Català', 'Tasca nova', 'Venciment', 'Obri el calendari', 'Cancel·la', 'Configuració']
	]) {
		await switchLanguage(name);
		await page.getByTitle(newTask, {exact: true}).waitFor();
		await page.waitForFunction(language => document.documentElement.lang === language, language);
		assert.equal(await page.locator('html').getAttribute('lang'), language);
		assert.equal(await page.evaluate(() => localStorage.getItem('taskweb-language')), language);
		const description = {es: 'Descripción', en: 'Description', ca: 'Descripció'}[language];
		assert.equal(await page.locator('th').filter({hasText: description}).count(), 1);
		assert.ok((await page.locator('.v-data-footer__select').textContent()).includes({es: 'Filas por página', en: 'Rows per page', ca: 'Files per pàgina'}[language]));
		await page.getByTitle(newTask, {exact: true}).click();
		await dialog().locator('input').first().fill('TEST text català: reunió');
		await dialog().getByRole('textbox', {name: due, exact: true}).fill('2099-12-22');
		await dialog().getByRole('button', {name: calendar + ': ' + due, exact: true}).click();
		await page.locator('.menuable__content__active .v-date-picker-table').waitFor();
		assert.ok((await page.locator('.menuable__content__active .v-date-picker-header').textContent()).toLowerCase().includes(
			new Intl.DateTimeFormat(language, {month: 'long'}).format(new Date(2099, 11, 22)).toLowerCase()));
		await dialog().locator('input').first().click();
		assert.equal(await dialog().getByRole('textbox', {name: due, exact: true}).inputValue(), '2099-12-22');
		await dialog().getByRole('button', {name: cancel, exact: true}).click();
		await page.waitForTimeout(300);
		await page.getByTitle(settings, {exact: true}).click();
		await dialog().getByRole('button', {name: cancel, exact: true}).click();
		await page.waitForTimeout(300);
		await page.reload();
		await page.getByTitle(newTask, {exact: true}).waitFor();
		await page.waitForFunction(language => document.documentElement.lang === language, language);
		assert.equal(await page.locator('html').getAttribute('lang'), language, 'Saved choice overrides browser');
	}
	await page.setViewportSize({width: 390, height: 844});
	await page.waitForTimeout(500);
	await switchLanguage('English');
	await page.getByTitle('New task', {exact: true}).waitFor();
	const languageButton = page.locator('header').getByRole('button', {name: 'Language', exact: true});
	const box = await languageButton.boundingBox();
	assert.ok(box.x >= 0 && box.x + box.width <= 390, 'Selector fits mobile');
	await page.screenshot({path: '/tmp/taskwarrior-languages-mobile.png', fullPage: true});
	assert.deepEqual(errors, []);
	console.log('Languages: browser detection, ES/EN/CA switching, forms, calendars, settings, persistence and mobile PASS');
} finally { await browser.close(); }
