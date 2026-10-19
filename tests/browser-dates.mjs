// Only run against a disposable container with an empty synthetic store.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.TASKWEB_PLAYWRIGHT || 'playwright');
const browser = await chromium.launch({headless: true, executablePath: '/usr/bin/chromium'});
const context = await browser.newContext({locale: 'es-ES', baseURL: process.env.TASKWEB_TEST_URL || 'http://127.0.0.1:18097', timezoneId: 'Europe/Madrid', extraHTTPHeaders: {'Tailscale-User-Login': 'subtasks@example.invalid'}, serviceWorkers: 'block'});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const tasks = async () => {
 const response = await context.request.get('/api/tasks');
 assert.equal(response.status(), 200, 'Disposable identity required');
 return response.json();
};
assert.equal((await tasks()).length, 0, 'ABORT: empty disposable store required');
const dialog = () => page.locator('.v-dialog--active');
const labels = ['Vencimiento', 'Repetir hasta', 'Programada', 'Esperar hasta'];
try {
 await page.goto('/');
 await page.getByTitle('Nueva tarea', {exact: true}).click();
 await dialog().locator('input').first().fill('TEST calendario');
 for (const [index, label] of labels.entries()) {
  await dialog().getByRole('button', {name: 'Abrir calendario: ' + label, exact: true}).click();
  const picker = page.locator('.menuable__content__active .v-date-picker-table');
  await picker.waitFor();
  await picker.getByRole('button', {name: String(12 + index), exact: true}).click();
  assert.match(await dialog().getByRole('textbox', {name: label, exact: true}).inputValue(), new RegExp('^\\d{4}-\\d{2}-' + (12 + index) + '$'));
 }
 // A past until date makes Taskwarrior expire the task automatically.
 await dialog().getByRole('textbox', {name: 'Repetir hasta', exact: true}).fill('2099-12-31');
 const saved = page.waitForResponse(r => r.url().endsWith('/api/tasks') && r.request().method() === 'PUT');
 await dialog().getByRole('button', {name: 'Guardar', exact: true}).click();
 assert.equal((await saved).status(), 200);
 await dialog().waitFor({state: 'hidden'});
 const task = (await tasks())[0];
 for (const field of ['due', 'until', 'scheduled', 'wait']) assert.ok(task[field], field + ' persisted');
 await page.locator('tr').filter({hasText: 'TEST calendario'}).getByTitle('Editar', {exact: true}).click();
 const original = await dialog().getByRole('textbox', {name: 'Vencimiento', exact: true}).inputValue();
 await dialog().getByRole('button', {name: 'Abrir calendario: Vencimiento', exact: true}).click();
 await page.locator('.menuable__content__active .v-date-picker-table .v-btn--active').waitFor();
 await dialog().locator('input').first().click();
 assert.equal(await dialog().getByRole('textbox', {name: 'Vencimiento', exact: true}).inputValue(), original, 'Opening calendar preserves timestamp');
 await dialog().getByRole('textbox', {name: 'Vencimiento', exact: true}).fill('tomorrow');
 await dialog().getByRole('button', {name: 'Restablecer', exact: true}).click();
 assert.equal(await dialog().getByRole('textbox', {name: 'Vencimiento', exact: true}).inputValue(), original);
 await dialog().getByRole('button', {name: 'Cancelar', exact: true}).click();
 await page.waitForTimeout(300);
 await page.setViewportSize({width: 390, height: 844});
 await page.getByTitle('Nueva tarea', {exact: true}).click();
 await dialog().getByRole('button', {name: 'Abrir calendario: Programada', exact: true}).click();
 const menu = page.locator('.menuable__content__active');
 await menu.waitFor();
 const box = await menu.boundingBox();
 assert.ok(box.x >= 0 && box.x + box.width <= 390, 'Calendar fits mobile screen');
 await page.screenshot({path: '/tmp/taskwarrior-calendar-mobile.png', fullPage: true});
 await dialog().locator('input').first().click();
 const due = dialog().getByRole('textbox', {name: 'Vencimiento', exact: true});
 await due.fill('tomorrow');
 await dialog().locator('input').first().fill('TEST fecha relativa');
 const relative = page.waitForResponse(r => r.url().endsWith('/api/tasks') && r.request().method() === 'PUT');
 await dialog().getByRole('button', {name: 'Guardar', exact: true}).click();
 assert.equal((await relative).status(), 200, 'Relative dates still save');
 assert.ok((await tasks()).find(t => t.description === 'TEST fecha relativa').due);
 assert.deepEqual(errors, []);
 console.log('Calendar: four fields, persistence, existing timestamp, reset, relative dates and mobile PASS');
} finally { await browser.close(); }
