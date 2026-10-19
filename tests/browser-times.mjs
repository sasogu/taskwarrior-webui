// Disposable API container and synthetic tasks only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.TASKWEB_PLAYWRIGHT || 'playwright');
const browser = await chromium.launch({headless: true, executablePath: '/usr/bin/chromium'});
const context = await browser.newContext({baseURL: process.env.TASKWEB_TEST_URL || 'http://127.0.0.1:18097',
	locale: 'es-ES', timezoneId: 'Europe/Madrid', extraHTTPHeaders: {'Tailscale-User-Login': 'subtasks@example.invalid'}, serviceWorkers: 'block'});
const page = await context.newPage();
const errors = [];
const taskName = 'TEST selector hora ' + Date.now();
page.on('pageerror', error => errors.push(error.message));
const tasks = async () => {
	const response = await context.request.get('/api/tasks');
	assert.equal(response.status(), 200, 'Disposable identity required');
	return response.json();
};
assert.ok((await tasks()).every(task => task.description.startsWith('TEST ')), 'ABORT: synthetic tasks required');
const dialog = () => page.locator('.v-dialog--active');
const menu = () => page.locator('.menuable__content__active');
async function clock(hour, minute) {
	await menu().locator('.v-time-picker-clock__item').filter({hasText: new RegExp('^' + hour + '$')}).click();
	await menu().locator('.v-time-picker-clock__item').filter({hasText: new RegExp('^' + minute + '$')}).click();
}
try {
	await page.goto('/');
	await page.getByTitle('Nueva tarea', {exact: true}).click();
	await dialog().locator('input').first().fill(taskName);
	const labels = ['Vencimiento', 'Repetir hasta', 'Programada', 'Esperar hasta'];
	for (const label of labels) {
		const time = dialog().getByLabel('Hora: ' + label, {exact: true});
		assert.ok(await time.isDisabled(), 'A date is needed before choosing a time');
		await dialog().getByRole('textbox', {name: label, exact: true}).fill('2099-12-22');
		if (label === 'Vencimiento') {
			await dialog().locator('.task-date-field').filter({has: page.getByRole('textbox', {name: label, exact: true})})
				.locator('.task-time-field .v-input__icon--append').click();
		} else await time.click();
		await clock(17, 45);
		await menu().getByRole('button', {name: 'Guardar', exact: true}).click();
		assert.equal(await time.inputValue(), '17:45');
	}
	const dueTime = dialog().getByLabel('Hora: Vencimiento', {exact: true});
	await dueTime.click();
	await clock(18, 30);
	await menu().getByRole('button', {name: 'Cancelar', exact: true}).click();
	assert.equal(await dueTime.inputValue(), '17:45', 'Cancel preserves the previous time');
	await dialog().getByRole('button', {name: 'Abrir calendario: Vencimiento', exact: true}).click();
	await menu().getByRole('button', {name: '23', exact: true}).click();
	assert.equal(await dueTime.inputValue(), '17:45', 'Changing day preserves time');
	await page.setViewportSize({width: 390, height: 844});
	await page.waitForTimeout(500);
	await dialog().getByLabel('Hora: Repetir hasta', {exact: true}).click();
	await menu().locator('.v-time-picker-clock').waitFor();
	const box = await menu().boundingBox();
	assert.ok(box.x >= 0 && box.x + box.width <= 390, 'Time picker fits mobile');
	await clock(18, 30);
	await page.screenshot({path: '/tmp/taskwarrior-time-picker-mobile.png', fullPage: true});
	await menu().getByRole('button', {name: 'Guardar', exact: true}).click();
	const saved = page.waitForResponse(r => r.url().endsWith('/api/tasks') && r.request().method() === 'PUT');
	await dialog().getByRole('button', {name: 'Guardar', exact: true}).click();
	assert.equal((await saved).status(), 200);
	const task = (await tasks()).find(task => task.description === taskName);
	assert.equal(task.due, '20991223T164500Z');
	assert.equal(task.until, '20991222T173000Z');
	assert.equal(task.scheduled, '20991222T164500Z');
	assert.equal(task.wait, '20991222T164500Z');
	assert.deepEqual(errors, []);
	console.log('Time selector: all four fields, 24h selection, cancel, preserved time on day change, mobile and exact API persistence PASS');
} catch (error) {
	await page.screenshot({path: '/tmp/taskwarrior-time-picker-failure.png', fullPage: true});
	throw error;
} finally { await browser.close(); }
