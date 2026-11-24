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

const tagSelect = () => page.getByLabel('Etiqueta', {exact: true});
const tagBox = () => page.locator('.v-input:has(label:text-is("Etiqueta"))');
const tagValue = () => tagBox().locator('.v-select__selection').textContent();
const waitTagValue = async value => {
	for (let i = 0; i < 50; i++) {
		if (await tagValue() === value) return;
		await page.waitForTimeout(100);
	}
	assert.equal(await tagValue(), value, 'Tag filter value updates');
};
const chooseTag = async text => {
	await tagSelect().click();
	await page.locator('.menuable__content__active').getByText(text, {exact: true}).click();
	await waitTagValue(text);
};
const visible = description => page.getByText(description, {exact: true}).isVisible();

try {
	await page.goto('/');
	await page.getByTitle('Nueva tarea', {exact: true}).waitFor();
	assert.equal(await tagValue(), 'Todas las etiquetas', 'Starts without a tag filter');

	await chooseTag('work');
	assert.ok(await visible('TEST alpha work'), 'Matching tag stays visible');
	assert.ok(await visible('TEST beta work'), 'Other project with matching tag stays visible');
	assert.equal(await visible('TEST alpha home'), false, 'Other tags are hidden');

	await chooseTag('home');
	assert.ok(await visible('TEST alpha home'), 'Changing tag filters again');
	assert.equal(await visible('TEST alpha work'), false, 'Previous tag tasks are hidden');

	await chooseTag('Todas las etiquetas');
	assert.equal(await tagValue(), 'Todas las etiquetas', 'All tags clears the filter');
	assert.ok(await visible('TEST alpha work'), 'Clearing the filter restores every task');
	assert.ok(await visible('TEST beta work'), 'Clearing the filter restores other projects');

	await page.getByLabel('Vista', {exact: true}).click();
	await page.locator('.menuable__content__active').getByText('Proyectos', {exact: true}).click();
	await page.waitForFunction(() => document.querySelector('.headline')?.textContent === 'Proyectos');
	await page.getByLabel('Proyecto', {exact: true}).click();
	await page.locator('.menuable__content__active').getByText('Alpha', {exact: true}).click();
	await chooseTag('work');
	assert.ok(await visible('TEST alpha work'), 'Project and tag filters combine');
	assert.equal(await visible('TEST beta work'), false, 'Tag filter is scoped to the selected project');

	assert.deepEqual(errors, [], 'No JavaScript errors');

	const mobileContext = await browser.newContext({baseURL, locale: 'es-ES', timezoneId: 'Europe/Madrid',
		viewport: {width: 390, height: 844}, hasTouch: true,
		extraHTTPHeaders: {'Tailscale-User-Login': 'subtasks@example.invalid'}, serviceWorkers: 'block'});
	const mobile = await mobileContext.newPage();
	await mobile.goto('/');
	await mobile.getByLabel('Etiqueta', {exact: true}).click();
	await mobile.locator('.menuable__content__active').getByText('work', {exact: true}).click();
	await mobile.waitForFunction(() => document.querySelector('.task-card')?.innerText.includes('TEST alpha work'));
	assert.ok(await mobile.getByText('TEST alpha work', {exact: true}).isVisible(), 'Tag filter works on mobile cards');
	assert.equal(await mobile.getByText('TEST alpha home', {exact: true}).count(), 0, 'Mobile card filter hides other tags');
	await mobileContext.close();

	console.log('tag filter: PASS');
}
finally {
	await browser.close();
}
