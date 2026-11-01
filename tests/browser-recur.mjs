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

const dialog = () => page.locator('.v-dialog--active');
const periodSelect = () => dialog().locator('.v-select', {hasText: 'Periodo'});
const periodValue = () => periodSelect().locator('input[type="hidden"]').inputValue();
const periodCustom = () => dialog().locator('.v-input', {hasText: 'Sintaxis de repetición'}).locator('input');
const findTask = async description => (await context.request.get('/api/tasks')).json()
	.then(tasks => tasks.find(task => task.description === description));

try {
	await page.goto('/');
	await page.getByTitle('Nueva tarea', {exact: true}).click();
	await dialog().waitFor();
	await dialog().locator('input').first().fill('TEST tarea recurrente');
	await dialog().getByRole('textbox', {name: 'Vencimiento', exact: true}).fill('2099-12-22');
	await dialog().locator('.v-input--selection-controls__input').first().click();
	await page.waitForFunction(() => [...document.querySelectorAll('.v-dialog--active input[type="hidden"]')]
		.some(input => input.value === 'weekly'));
	await periodSelect().click();
	await page.locator('.menuable__content__active').getByText('Mensual', {exact: true}).click();
	await dialog().getByRole('button', {name: 'Guardar', exact: true}).click();
	await dialog().waitFor({state: 'hidden'});
	const created = await findTask('TEST tarea recurrente');
	assert.equal(created?.recur, 'monthly', 'Preset monthly is saved as recur:monthly');
	assert.equal(created?.status, 'recurring', 'Recurring template created');

	await page.getByRole('button', {name: /Recurrentes/}).click();
	await page.getByTitle('Editar', {exact: true}).first().click();
	await dialog().waitFor();
	assert.equal(await periodValue(), 'monthly', 'Existing preset is selected when editing');
	await periodSelect().click();
	await page.locator('.menuable__content__active').getByText('Personalizado…', {exact: true}).click();
	await periodCustom().waitFor();
	await periodCustom().fill('2w');
	await dialog().getByRole('button', {name: 'Guardar', exact: true}).click();
	await dialog().waitFor({state: 'hidden'});
	const edited = await findTask('TEST tarea recurrente');
	assert.equal(edited?.recur, '2w', 'Custom recurrence syntax is preserved');

	assert.deepEqual(errors, [], 'No JavaScript errors');
	console.log('recurrence selector: PASS');
}
finally {
	await browser.close();
}
