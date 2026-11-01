// Only use a disposable container with an isolated Taskwarrior store.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.TASKWEB_PLAYWRIGHT || 'playwright');
const browser = await chromium.launch({headless: true, executablePath: '/usr/bin/chromium'});
const baseURL = process.env.TASKWEB_TEST_URL || 'http://127.0.0.1:18097';
const context = await browser.newContext({baseURL, locale: 'es-ES', timezoneId: 'Europe/Madrid',
	extraHTTPHeaders: {'Tailscale-User-Login': 'subtasks@example.invalid'}, serviceWorkers: 'block'});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const response = await context.request.get('/api/tasks');
assert.equal(response.status(), 200, 'Disposable identity required');
assert.ok((await response.json()).every(task => task.description.startsWith('TEST ')), 'ABORT: synthetic tasks required');

const isDark = () => page.evaluate(() => document.querySelector('.v-application').classList.contains('theme--dark'));
const savedDark = () => page.evaluate(() => JSON.parse(localStorage.getItem('settings') || '{}').dark);
const themeButton = () => page.locator('header').getByRole('button', {name: 'Tema', exact: true});

try {
	await page.goto('/');
	await page.getByTitle('Nueva tarea', {exact: true}).waitFor();
	assert.equal(await isDark(), false, 'Starts in light theme');

	await themeButton().click();
	await page.waitForFunction(() => document.querySelector('.v-application').classList.contains('theme--dark'));
	assert.equal(await isDark(), true, 'Toolbar toggle applies dark theme');
	assert.equal(await savedDark(), true, 'Toolbar toggle persists dark theme');

	await page.reload();
	await page.getByTitle('Nueva tarea', {exact: true}).waitFor();
	await page.waitForFunction(() => document.querySelector('.v-application').classList.contains('theme--dark'));
	assert.equal(await isDark(), true, 'Dark theme survives reload');

	await page.getByTitle('Ajustes', {exact: true}).click();
	const dialog = page.locator('.v-dialog--active');
	await dialog.waitFor();
	assert.equal(await dialog.getByRole('checkbox').isChecked(), true, 'Settings show dark theme enabled');
	await dialog.getByRole('button', {name: 'Cancelar', exact: true}).click();
	await page.waitForTimeout(300);

	await themeButton().click();
	await page.waitForFunction(() => !document.querySelector('.v-application').classList.contains('theme--dark'));
	assert.equal(await savedDark(), false, 'Toolbar toggle persists light theme');

	await page.reload();
	await page.getByTitle('Nueva tarea', {exact: true}).waitFor();
	await page.waitForTimeout(500);
	assert.equal(await isDark(), false, 'Light theme survives reload');

	await page.getByTitle('Ajustes', {exact: true}).click();
	await dialog.waitFor();
	await dialog.locator('.v-input--selection-controls__input').click();
	await dialog.getByRole('button', {name: 'Guardar', exact: true}).click();
	await page.waitForFunction(() => document.querySelector('.v-application').classList.contains('theme--dark'));
	assert.equal(await savedDark(), true, 'Settings dialog saves dark theme');
	await page.reload();
	await page.getByTitle('Nueva tarea', {exact: true}).waitFor();
	await page.waitForFunction(() => document.querySelector('.v-application').classList.contains('theme--dark'));
	assert.equal(await isDark(), true, 'Theme from settings survives reload');

	assert.deepEqual(errors, [], 'No JavaScript errors');
	console.log('theme persistence: PASS');
}
finally {
	await browser.close();
}
