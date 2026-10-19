// Disposable API container and synthetic tasks only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.TASKWEB_PLAYWRIGHT || 'playwright');
const browser = await chromium.launch({headless: true, executablePath: '/usr/bin/chromium'});
const context = await browser.newContext({baseURL: process.env.TASKWEB_TEST_URL || 'http://127.0.0.1:18097',
	locale: 'es-ES', timezoneId: 'Europe/Madrid', extraHTTPHeaders: {'Tailscale-User-Login': 'subtasks@example.invalid'}, serviceWorkers: 'block'});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
async function tasks() {
	const response = await context.request.get('/api/tasks');
	assert.equal(response.status(), 200, 'Disposable identity required');
	return response.json();
}
assert.ok((await tasks()).every(task => task.description.startsWith('TEST ')), 'ABORT: synthetic tasks required');
const name = 'TEST anotaciones ' + Date.now();
const entry = '20260101T120000Z';
const original = ['TEST primera anotación', 'TEST segunda anotación'];
const edited = 'TEST nota editada con ñ\nSegunda línea <b>texto literal</b>';
const dialog = () => page.locator('.v-dialog--active').filter({has: page.locator('.task-annotations')});
const confirmation = () => page.locator('.v-dialog--active').filter({hasText: '¿Eliminar esta anotación?'});
const row = text => dialog().locator('.annotation-row').filter({hasText: text});
const saved = async () => (await tasks()).find(task => task.description === name);
async function open(edit = 'Editar') {
	await page.locator('tr').filter({hasText: name}).getByTitle(edit, {exact: true}).click();
}
async function saveTask(status = 200) {
	const response = page.waitForResponse(r => r.url().endsWith('/api/tasks') && r.request().method() === 'PUT');
	await dialog().getByRole('button', {name: 'Guardar', exact: true}).click();
	assert.equal((await response).status(), status);
	if (status === 200) {
		await dialog().waitFor({state: 'hidden'});
		await page.waitForTimeout(250);
	}
}
async function change(text, next) {
	await row(text).getByRole('button', {name: 'Editar anotación', exact: true}).click();
	await dialog().getByRole('textbox', {name: 'Editar anotación', exact: true}).fill(next);
	await dialog().getByRole('button', {name: 'Guardar anotación', exact: true}).click();
}
try {
	const created = await context.request.put('/api/tasks', {data: {tasks: [{description: name,
		project: 'prueba', priority: 'H', due: '20991222T120007Z', tags: ['prueba'],
		annotations: original.map(description => ({entry, description}))}]}});
	assert.equal(created.status(), 200);
	const baseline = await saved();
	assert.equal(baseline.annotations.length, 2, 'Duplicate timestamps supported');
	await page.goto('/');
	await open();
	assert.ok(await dialog().getByRole('button', {name: 'Añadir anotación', exact: true}).isDisabled());
	await row(original[0]).getByRole('button', {name: 'Editar anotación', exact: true}).click();
	await dialog().getByRole('textbox', {name: 'Editar anotación', exact: true}).fill('   ');
	assert.ok(await dialog().getByRole('button', {name: 'Guardar anotación', exact: true}).isDisabled());
	assert.ok(await dialog().getByRole('button', {name: 'Guardar', exact: true}).isDisabled());
	await dialog().getByRole('button', {name: 'Cancelar edición', exact: true}).click();
	await change(original[0], edited);
	assert.equal(await row(edited).locator('.annotation-description').textContent(), edited);
	assert.deepEqual((await saved()).annotations, baseline.annotations, 'Draft changes do not persist early');
	await dialog().getByRole('button', {name: 'Restablecer', exact: true}).click();
	await row(original[0]).waitFor();
	await change(original[0], edited);
	await saveTask();
	let task = await saved();
	assert.equal(task.annotations.find(a => a.description === edited).entry, entry);
	assert.ok(task.annotations.some(a => a.description === original[1]));
	for (const key of ['due', 'tags', 'project', 'priority']) assert.deepEqual(task[key], baseline[key]);

	await open();
	await row(original[1]).getByRole('button', {name: 'Eliminar anotación', exact: true}).click();
	assert.ok((await confirmation().textContent()).includes(original[1]));
	await confirmation().getByRole('button', {name: 'Cancelar', exact: true}).click();
	await row(original[1]).waitFor();
	await row(original[1]).getByRole('button', {name: 'Eliminar anotación', exact: true}).click();
	await confirmation().press('Escape');
	await confirmation().waitFor({state: 'hidden'});
	assert.ok(await dialog().isVisible(), 'Escape dismisses confirmation without closing the task');
	await row(original[1]).getByRole('button', {name: 'Eliminar anotación', exact: true}).click();
	await confirmation().getByRole('button', {name: 'Eliminar anotación', exact: true}).click();
	await row(original[1]).waitFor({state: 'hidden'});
	await dialog().getByRole('button', {name: 'Cancelar', exact: true}).click();
	await page.waitForTimeout(250);
	assert.equal((await saved()).annotations.length, 2, 'Cancel task discards deletion');
	await open();
	await row(original[1]).getByRole('button', {name: 'Eliminar anotación', exact: true}).click();
	await confirmation().getByRole('button', {name: 'Eliminar anotación', exact: true}).click();
	await saveTask();
	assert.deepEqual((await saved()).annotations, [{entry, description: edited}]);
	await open();
	await row(edited).getByRole('button', {name: 'Eliminar anotación', exact: true}).click();
	await confirmation().getByRole('button', {name: 'Eliminar anotación', exact: true}).click();
	await saveTask();
	assert.equal(((await saved()).annotations || []).length, 0, 'Last annotation removed');

	await open();
	await dialog().getByRole('textbox', {name: 'Texto de la anotación', exact: true}).fill('TEST nueva anotación');
	await dialog().getByRole('button', {name: 'Añadir anotación', exact: true}).click();
	await saveTask();
	await open();
	await change('TEST nueva anotación', 'TEST cambio antiguo');
	await page.waitForTimeout(1100); // Taskwarrior modified uses whole seconds.
	task = await saved();
	task.annotations.push({entry: '20260102T120000Z', description: 'TEST cambio externo'});
	assert.equal((await context.request.put('/api/tasks', {data: {tasks: [task]}})).status(), 200);
	await saveTask(409);
	assert.ok((await saved()).annotations.some(a => a.description === 'TEST cambio externo'));
	assert.ok(!(await saved()).annotations.some(a => a.description === 'TEST cambio antiguo'));
	await dialog().getByRole('button', {name: 'Cancelar', exact: true}).click();
	await page.waitForTimeout(250);

	await page.setViewportSize({width: 390, height: 844});
	for (const [language, edit, editNote, deleteNote, cancel, question, saveNote, cancelEdit] of [
		['English', 'Edit', 'Edit annotation', 'Delete annotation', 'Cancel', 'Delete this annotation?', 'Save annotation', 'Cancel editing'],
		['Català', 'Edita', 'Edita l’anotació', 'Elimina l’anotació', 'Cancel·la', 'Vols eliminar aquesta anotació?', 'Desa l’anotació', 'Cancel·la l’edició']
	]) {
		await page.locator('header').getByRole('button', {name: /^(Idioma|Language)$/}).click();
		await page.locator('.menuable__content__active').getByText(language, {exact: true}).click();
		await open(edit);
		assert.equal(await dialog().getByRole('button', {name: editNote, exact: true}).count(), 2);
		await dialog().getByRole('button', {name: editNote, exact: true}).first().click();
		await dialog().getByRole('textbox', {name: editNote, exact: true}).fill('TEST edició mòbil');
		await dialog().getByRole('button', {name: saveNote, exact: true}).scrollIntoViewIfNeeded();
		const editBounds = await dialog().getByRole('button', {name: saveNote, exact: true}).boundingBox();
		assert.ok(editBounds.x >= 0 && editBounds.x + editBounds.width <= 390, 'Editor buttons fit mobile');
		await dialog().getByRole('button', {name: cancelEdit, exact: true}).click();
		await dialog().getByRole('button', {name: deleteNote, exact: true}).first().click();
		const confirm = page.locator('.v-dialog--active').filter({hasText: question});
		await confirm.getByRole('button', {name: cancel, exact: true}).click();
		const bounds = await dialog().getByRole('button', {name: editNote, exact: true}).first().boundingBox();
		assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, 'Annotation actions fit mobile');
		await page.screenshot({path: '/tmp/taskwarrior-annotations-mobile.png', fullPage: true});
		await dialog().getByRole('button', {name: cancel, exact: true}).click();
		await page.waitForTimeout(250);
	}
	assert.deepEqual(errors, []);
	console.log('Annotations: edit, timestamps, duplicate entries, multiline text, reset/cancel, delete confirmation/Escape, delete last, add, 409 conflict, ES/EN/CA and mobile PASS');
} catch (error) {
	await page.screenshot({path: '/tmp/taskwarrior-annotations-failure.png', fullPage: true});
	throw error;
} finally { await browser.close(); }
