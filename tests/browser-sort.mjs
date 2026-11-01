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

const sortSelect = () => page.locator('.task-sort');
const sortValue = () => sortSelect().locator('input[type="hidden"]').inputValue();
const savedSort = () => page.evaluate(() => localStorage.getItem('taskweb-sort'));

try {
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

	assert.deepEqual(errors, [], 'No JavaScript errors');
	console.log('sort persistence: PASS');
}
finally {
	await browser.close();
}
