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
assert.equal((await response.json()).length, 0, 'ABORT: empty synthetic store required');

const sortSelect = () => page.locator('.task-sort');
const sortValue = () => sortSelect().locator('input[type="hidden"]').inputValue();
const savedSort = () => page.evaluate(() => localStorage.getItem('taskweb-sort'));

try {
	const created = await context.request.put('/api/tasks', {data: {tasks: [
		{description: 'TEST prioridad baja', priority: 'L'},
		{description: 'TEST prioridad alta', priority: 'H'},
		{description: 'TEST prioridad media', priority: 'M'}
	]}});
	assert.equal(created.status(), 200, 'Synthetic tasks created');
	await page.goto('/');
	await page.getByTitle('Vista de tarjetas', {exact: true}).click();
	await sortSelect().waitFor();
	assert.equal(await sortValue(), 'urgency', 'Starts sorted by urgency');

	await sortSelect().click();
	await page.locator('.menuable__content__active').getByText('Vencimiento', {exact: true}).click();
	await page.waitForFunction(() => localStorage.getItem('taskweb-sort') === 'due');
	assert.equal(await savedSort(), 'due', 'Sort choice is saved');

	await page.reload();
	await sortSelect().waitFor();
	await page.waitForFunction(() => document.querySelector('.task-sort input[type="hidden"]')?.value === 'due');
	assert.equal(await sortValue(), 'due', 'Sort choice survives reload');
	assert.equal(await sortSelect().locator('.v-select__selection').textContent(), 'Vencimiento');

	await sortSelect().click();
	await page.locator('.menuable__content__active').getByText('Prioridad', {exact: true}).click();
	await page.waitForFunction(() => localStorage.getItem('taskweb-sort') === 'priority');
	assert.deepEqual(await page.locator('.task-card-title').allTextContents(), [
		'TEST prioridad alta', 'TEST prioridad media', 'TEST prioridad baja'
	], 'Cards sort high, medium, low');

	await page.getByTitle('Vista de tabla', {exact: true}).click();
	await page.getByRole('columnheader', {name: 'Prioridad'}).click();
	const rows = await page.locator('tbody tr').allTextContents();
	assert.deepEqual(rows.map(row => row.match(/TEST prioridad (alta|media|baja)/)?.[0]).filter(Boolean), [
		'TEST prioridad alta', 'TEST prioridad media', 'TEST prioridad baja'
	], 'Table sorts high, medium, low');

	assert.deepEqual(errors, [], 'No JavaScript errors');
	console.log('sort persistence: PASS');
}
finally {
	await browser.close();
}
