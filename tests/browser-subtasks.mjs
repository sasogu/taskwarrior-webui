// Run against the disposable API test container, with synthetic tasks only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.TASKWEB_PLAYWRIGHT || 'playwright');
const baseURL = process.env.TASKWEB_TEST_URL || 'http://127.0.0.1:18097';
const browser = await chromium.launch({headless: true, executablePath: process.env.TASKWEB_CHROMIUM || '/usr/bin/chromium'});
const context = await browser.newContext({locale: 'es-ES', baseURL, extraHTTPHeaders: {'Tailscale-User-Login': 'subtasks@example.invalid'}, serviceWorkers: 'block'});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const tasks = async () => {
	const response = await context.request.get('/api/tasks');
	assert.equal(response.status(), 200, 'Only the disposable test identity may run these tests');
	return response.json();
};
assert.ok((await tasks()).every(task => task.description.startsWith('TEST ')), 'ABORT: synthetic tasks required');
const main = 'TEST UI preparar sesión';
const child = 'TEST UI crear presentación';
const grandchild = 'TEST UI preparar ejercicio';
const sibling = 'TEST UI materiales';
const dialog = () => page.locator('.v-dialog--active');
const row = name => page.locator('tr').filter({has: page.getByText(name, {exact: true})}).first();
const subrow = name => page.locator('.subtask-row').filter({has: page.getByText(name, {exact: true})});
async function save(name) {
	await dialog().locator('input').first().fill(name);
	const saved = page.waitForResponse(response => response.url().endsWith('/api/tasks') && response.request().method() === 'PUT');
	await dialog().getByRole('button', {name: 'Guardar', exact: true}).click();
	assert.equal((await saved).status(), 200);
	await dialog().waitFor({state: 'hidden'});
	await page.waitForTimeout(300); // Let Vuetify finish the dialog's exit transition.
	await page.getByText(name, {exact: true}).waitFor();
}

try {
	await page.goto('/');
	await page.getByTitle('Nueva tarea', {exact: true}).click();
	await save(main);
	await row(main).getByTitle('Añadir subtarea', {exact: true}).click();
	await save(child);
	assert.equal((await tasks()).find(task => task.description === child).webparent,
		(await tasks()).find(task => task.description === main).uuid);
	await subrow(child).getByTitle('Añadir subtarea', {exact: true}).click();
	await save(grandchild);
	await subrow(grandchild).getByTitle('Completar subtarea', {exact: true}).click();
	assert.ok((await dialog().textContent()).includes(grandchild));
	await dialog().getByRole('button', {name: 'No', exact: true}).click();
	assert.equal((await tasks()).find(task => task.description === grandchild).status, 'pending');
	await subrow(grandchild).getByTitle('Completar subtarea', {exact: true}).click();
	const done = page.waitForResponse(response => response.request().method() === 'PUT');
	await dialog().getByRole('button', {name: 'Sí', exact: true}).click();
	assert.equal((await done).status(), 200);
	await subrow(grandchild).getByText('Terminada', {exact: true}).waitFor();
	assert.equal((await tasks()).find(task => task.description === main).status, 'pending');
	await row(main).getByTitle('Añadir subtarea', {exact: true}).click();
	await save(sibling);
	await row(main).getByText('1/3', {exact: true}).waitFor();
	await page.screenshot({path: '/tmp/taskwarrior-subtasks-desktop.png', fullPage: true});
	await row(main).getByRole('button', {name: 'Ocultar subtareas', exact: true}).click();
	await page.getByText(child, {exact: true}).waitFor({state: 'hidden'});
	await row(main).getByRole('button', {name: 'Mostrar subtareas', exact: true}).click();
	await page.getByText(grandchild, {exact: true}).waitFor();
	await row(main).getByTitle('Completar', {exact: true}).click();
	assert.ok((await dialog().textContent()).includes('subtareas pendientes'));
	await dialog().getByRole('button', {name: 'No', exact: true}).click();

	// Detach an existing subtask through the parent selector.
	await subrow(sibling).getByTitle('Editar subtarea', {exact: true}).click();
	await dialog().locator('.v-autocomplete .v-input__icon--clear').click();
	await save(sibling);
	assert.equal((await tasks()).find(task => task.description === sibling).webparent, undefined);
	await row(main).getByText('1/2', {exact: true}).waitFor();

	// Parent options must exclude descendants, while other roots remain selectable.
	await row(main).getByTitle('Editar', {exact: true}).click();
	const selector = dialog().getByRole('textbox', {name: 'Tarea principal', exact: true});
	await selector.fill(child);
	await page.waitForTimeout(150);
	assert.equal(await page.locator('.v-menu__content.menuable__content__active .v-list-item__title').filter({hasText: child}).count(), 0);
	await dialog().getByRole('button', {name: 'Cancelar', exact: true}).click();
	await page.waitForTimeout(300);

	await page.setViewportSize({width: 390, height: 844});
	await page.waitForTimeout(500); // Vuetify debounces the mobile breakpoint.
	await page.getByText(grandchild, {exact: true}).waitFor();
	assert.ok(await page.locator('.subtask-actions').evaluateAll(nodes =>
		nodes.every(node => node.getBoundingClientRect().right <= window.innerWidth)));
	await page.screenshot({path: '/tmp/taskwarrior-subtasks-mobile.png', fullPage: true});
	assert.deepEqual(errors, []);
	console.log('Browser: create, two levels, confirmation/cancel, completion, progress, fold/unfold, detach, parent filtering and mobile PASS');
} finally {
	await browser.close();
}
