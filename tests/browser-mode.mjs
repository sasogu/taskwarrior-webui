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

const heading = () => page.locator('.headline');
const savedMode = () => page.evaluate(() => localStorage.getItem('taskweb-mode'));
const switchMode = async name => {
	await page.getByLabel('Vista', {exact: true}).click();
	await page.locator('.menuable__content__active').getByText(name, {exact: true}).click();
};

try {
	await page.goto('/');
	await page.getByTitle('Nueva tarea', {exact: true}).waitFor();
	assert.equal(await heading().textContent(), 'Tareas', 'Starts in tasks view');

	await switchMode('Proyectos');
	await page.waitForFunction(() => document.querySelector('.headline')?.textContent === 'Proyectos');
	assert.equal(await savedMode(), 'Projects', 'Switching saves the display mode');

	await page.reload();
	await page.getByTitle('Nueva tarea', {exact: true}).waitFor();
	await page.waitForFunction(() => document.querySelector('.headline')?.textContent === 'Proyectos');
	assert.equal(await heading().textContent(), 'Proyectos', 'Projects view survives reload');

	await switchMode('Tareas');
	await page.waitForFunction(() => document.querySelector('.headline')?.textContent === 'Tareas');
	assert.equal(await savedMode(), 'Tasks', 'Switching back saves the display mode');

	await page.reload();
	await page.getByTitle('Nueva tarea', {exact: true}).waitFor();
	await page.waitForTimeout(500);
	assert.equal(await heading().textContent(), 'Tareas', 'Tasks view survives reload');

	assert.deepEqual(errors, [], 'No JavaScript errors');
	console.log('display mode persistence: PASS');
}
finally {
	await browser.close();
}
