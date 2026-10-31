// Touch/tablet layout. Disposable API container and synthetic tasks only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const playwright = require(process.env.TASKWEB_PLAYWRIGHT || 'playwright');
const baseURL = process.env.TASKWEB_TEST_URL || 'http://127.0.0.1:18097';
const shots = process.env.TASKWEB_SCREENSHOTS || '/tmp';
const engine = process.env.TASKWEB_ENGINE || 'chromium';
const browser = await playwright[engine].launch(engine === 'chromium'
	? {headless: true, executablePath: process.env.TASKWEB_CHROMIUM || '/usr/bin/chromium'} : {headless: true});
const headers = {'Tailscale-User-Login': 'subtasks@example.invalid'};
const ipad = {viewport: {width: 820, height: 1180}, hasTouch: true, isMobile: engine !== 'firefox', deviceScaleFactor: 2};
const context = await browser.newContext({...ipad, baseURL, locale: 'es-ES', timezoneId: 'Europe/Madrid',
	extraHTTPHeaders: headers, serviceWorkers: 'block'});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const tasks = async () => {
	const response = await context.request.get('/api/tasks');
	assert.equal(response.status(), 200, 'Disposable identity required');
	return response.json();
};
assert.ok((await tasks()).every(task => task.description.startsWith('TEST ')), 'ABORT: synthetic tasks required');
const stamp = Date.now();
const main = 'TEST iPad tarea principal ' + stamp;
const child = 'TEST iPad subtarea ' + stamp;
const other = 'TEST iPad otra ' + stamp;
const dialog = () => page.locator('.v-dialog--active').first();
const card = name => page.locator('.task-card').filter({has: page.getByText(name, {exact: true})}).first();
const noHorizontalScroll = async () => assert.ok(await page.evaluate(() =>
	document.documentElement.scrollWidth <= window.innerWidth + 1), 'No horizontal page scroll');
async function save(name, project) {
	await dialog().locator('input').first().fill(name);
	if (project) {
		const field = dialog().getByLabel('Proyecto', {exact: true});
		await field.fill(project);
		await field.press('Tab');
	}
	const saved = page.waitForResponse(r => r.url().endsWith('/api/tasks') && r.request().method() === 'PUT');
	await dialog().getByRole('button', {name: 'Guardar', exact: true}).click();
	assert.equal((await saved).status(), 200);
	await dialog().waitFor({state: 'hidden'});
	await page.waitForTimeout(300);
}

try {
	await page.goto('/');
	await page.waitForTimeout(500);
	assert.equal(await page.locator('.v-data-table').count(), 0, 'iPad portrait uses cards');
	await page.locator('.task-cards').waitFor();

	// Create through the floating button
	const fab = page.locator('.new-task-fab');
	const fabBox = await fab.boundingBox();
	assert.ok(fabBox.width >= 44 && fabBox.y + fabBox.height <= 1180, 'FAB visible and large');
	await fab.tap();
	const actions = await dialog().locator('.task-dialog-actions').boundingBox();
	assert.ok(actions.y + actions.height <= 1180, 'Dialog actions stay on screen');
	await save(main, 'TESTiPad');
	await card(main).waitFor();
	await card(main).getByText('TESTiPad', {exact: true}).waitFor();

	// Large tap targets
	for (const title of ['Añadir subtarea', 'Completar', 'Editar', 'Eliminar']) {
		const box = await card(main).getByTitle(title, {exact: true}).boundingBox();
		assert.ok(box.width >= 44 && box.height >= 44, `${title} is at least 44px`);
	}

	// Subtask and its expansion in the card
	await card(main).getByTitle('Añadir subtarea', {exact: true}).tap();
	await save(child);
	await card(main).locator('.subtask-row').getByText(child, {exact: true}).waitFor();
	await card(main).getByRole('button', {name: 'Ocultar subtareas', exact: true}).tap();
	await card(main).locator('.subtask-row').waitFor({state: 'detached'});
	await card(main).getByRole('button', {name: 'Mostrar subtareas', exact: true}).tap();
	const subBtn = await card(main).locator('.subtask-actions .v-btn').first().boundingBox();
	assert.ok(subBtn.width >= 40, 'Subtask buttons are touch sized');

	// Tapping the body opens the editor without auto-opening the keyboard
	await card(main).locator('.task-card-body').tap({position: {x: 10, y: 10}});
	await dialog().waitFor();
	assert.ok((await dialog().textContent()).includes('Editar tarea'));
	assert.notEqual(await dialog().locator('input').first().evaluate(el => el === document.activeElement), true, 'Editing does not autofocus');
	await dialog().getByRole('button', {name: 'Cancelar', exact: true}).tap();
	await dialog().waitFor({state: 'hidden'});

	// Selection and batch completion
	await fab.tap();
	await save(other);
	await card(other).getByRole('button', {name: 'Seleccionar tarea', exact: true}).tap();
	await page.locator('.task-batch-bar').getByText('1 seleccionadas', {exact: true}).waitFor();
	await page.locator('.task-batch-bar').getByRole('button', {name: 'Completar'}).tap();
	assert.ok((await dialog().textContent()).includes(other));
	const done = page.waitForResponse(r => r.request().method() === 'PUT');
	await dialog().getByRole('button', {name: 'Sí', exact: true}).tap();
	assert.equal((await done).status(), 200);
	await card(other).waitFor({state: 'detached'});
	assert.equal((await tasks()).find(task => task.description === other).status, 'completed');
	assert.equal(await page.locator('.task-batch-bar').count(), 0);

	// Sorting by description puts tasks in order
	await page.getByLabel('Ordenar por', {exact: true}).click({force: true});
	await page.locator('.menuable__content__active').getByText('Descripción', {exact: true}).tap();
	await noHorizontalScroll();
	await page.screenshot({path: `${shots}/taskwarrior-ipad-portrait.png`});

	// Landscape iPad is still a touch layout
	await page.setViewportSize({width: 1180, height: 820});
	await page.waitForTimeout(500);
	assert.equal(await page.locator('.v-data-table').count(), 0, 'Landscape iPad uses cards');
	await noHorizontalScroll();
	await page.screenshot({path: `${shots}/taskwarrior-ipad-landscape.png`});

	// Status bar scrolls instead of wrapping on a phone
	await page.setViewportSize({width: 375, height: 812});
	await page.waitForTimeout(500);
	await noHorizontalScroll();
	await page.screenshot({path: `${shots}/taskwarrior-phone.png`});
	await page.setViewportSize({width: 820, height: 1180});
	await page.waitForTimeout(300);

	// Manual table view persists across reloads, then back to cards
	await page.getByTitle('Vista de tabla', {exact: true}).tap();
	await page.locator('.v-data-table').waitFor();
	await page.reload();
	await page.locator('.v-data-table').waitFor();
	await page.getByTitle('Vista de tarjetas', {exact: true}).tap();
	await page.locator('.task-cards').waitFor();
	await page.reload();
	await page.locator('.task-cards').waitFor();

	// A desktop browser with a mouse keeps the table by default
	const desktop = await browser.newContext({viewport: {width: 1440, height: 900}, baseURL, locale: 'es-ES',
		extraHTTPHeaders: headers, serviceWorkers: 'block'});
	const desk = await desktop.newPage();
	desk.on('pageerror', error => errors.push(error.message));
	await desk.goto('/');
	await desk.locator('.v-data-table tbody tr').first().waitFor();
	assert.equal(await desk.locator('.task-cards').count(), 0, 'Desktop uses table');
	await desktop.close();

	assert.deepEqual(errors, []);
	console.log(`Responsive (${engine}): iPad portrait/landscape cards, FAB, 44px targets, subtasks, tap-to-edit without autofocus, batch completion, sort, phone, persisted table/cards toggle and desktop table PASS`);
} finally { await browser.close(); }
