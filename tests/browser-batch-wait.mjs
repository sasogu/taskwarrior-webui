// Test browser batch action: "Poner en espera" (put tasks on hold) and clear wait.
// Only run against a disposable container with an isolated Taskwarrior store.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.TASKWEB_PLAYWRIGHT || '/home/daizan/github/Edutictac/edutictac-commons/node_modules/playwright');
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const baseURL = process.env.TASKWEB_TEST_URL || 'http://127.0.0.1:18097';
const context = await browser.newContext({
	baseURL,
	locale: 'es-ES',
	timezoneId: 'Europe/Madrid',
	extraHTTPHeaders: { 'Tailscale-User-Login': 'subtasks@example.invalid' },
	serviceWorkers: 'block'
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));

const tasks = async () => {
	const response = await context.request.get('/api/tasks');
	assert.equal(response.status(), 200, 'Disposable identity required');
	return response.json();
};

const allTasks = await tasks();
assert.ok(allTasks.every(task => task.description.startsWith('TEST ')), 'ABORT: synthetic tasks required');

const dialog = () => page.locator('.v-dialog--active');

try {
	// Create two synthetic test tasks
	const t1 = 'TEST lote espera 1';
	const t2 = 'TEST lote espera 2';
	const createRes = await context.request.put('/api/tasks', {
		data: {
			tasks: [
				{ description: t1, tags: ['batchtest'] },
				{ description: t2, tags: ['batchtest'] }
			]
		}
	});
	assert.equal(createRes.status(), 200, 'Created test tasks');

	// 1. Desktop Table View
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/');
	await page.getByTitle('Nueva tarea', { exact: true }).waitFor();

	// Locate rows and select both tasks
	const row1 = page.locator('tbody tr', { hasText: t1 });
	const row2 = page.locator('tbody tr', { hasText: t2 });
	await row1.waitFor();
	await row2.waitFor();

	await row1.locator('.v-data-table__checkbox').click();
	await row2.locator('.v-data-table__checkbox').click();

	// Check table batch bar has "Poner en espera" button
	const waitBtnTable = page.getByTitle('Poner en espera', { exact: true });
	await waitBtnTable.waitFor();
	await waitBtnTable.click();

	// Dialog should open
	await dialog().waitFor();
	assert.ok((await dialog().textContent()).includes('Poner en espera'), 'Dialog title is Poner en espera');
	assert.ok((await dialog().textContent()).includes('2 seleccionadas'), 'Shows count of selected tasks');

	// Click preset "Mañana"
	await dialog().getByText('Mañana', { exact: true }).click();
	const saveWait = page.waitForResponse(r => r.url().endsWith('/api/tasks') && r.request().method() === 'PUT');
	await dialog().getByRole('button', { name: 'Guardar', exact: true }).click();
	assert.equal((await saveWait).status(), 200, 'PUT request succeeded');
	await dialog().waitFor({ state: 'hidden' });

	// Tasks should now have wait set and disappear from pending
	await row1.waitFor({ state: 'detached' });
	await row2.waitFor({ state: 'detached' });

	// Switch to "En espera" tab
	await page.getByRole('button', { name: /En espera/ }).click();
	const waitRow1 = page.locator('tbody tr', { hasText: t1 });
	const waitRow2 = page.locator('tbody tr', { hasText: t2 });
	await waitRow1.waitFor();
	await waitRow2.waitFor();
	assert.ok(await waitRow1.isVisible(), 'Task 1 visible in En espera');
	assert.ok(await waitRow2.isVisible(), 'Task 2 visible in En espera');

	// 2. Mobile/Tablet Card View
	await page.setViewportSize({ width: 800, height: 900 });
	await page.waitForTimeout(300);

	// Select task 1 in card view
	const card1 = page.locator('.task-card', { hasText: t1 });
	await card1.getByRole('button', { name: 'Seleccionar tarea', exact: true }).click();

	// Card batch bar appears
	const batchBar = page.locator('.task-batch-bar');
	await batchBar.waitFor();
	assert.ok(await batchBar.getByText('1 seleccionadas', { exact: true }).isVisible());

	// Click "Poner en espera" on batch bar
	await batchBar.getByRole('button', { name: 'Poner en espera' }).click();
	await dialog().waitFor();

	// Since task 1 is already in wait, "Quitar espera" button must be visible
	const clearBtn = dialog().getByRole('button', { name: 'Quitar espera', exact: true });
	await clearBtn.waitFor();
	const clearWaitReq = page.waitForResponse(r => r.url().endsWith('/api/tasks') && r.request().method() === 'PUT');
	await clearBtn.click();
	assert.equal((await clearWaitReq).status(), 200, 'PUT request succeeded for clear wait');
	await dialog().waitFor({ state: 'hidden' });

	// Task 1 should disappear from "En espera"
	await card1.waitFor({ state: 'detached' });

	// Switch back to "Pendientes"
	await page.getByRole('button', { name: /Pendientes/ }).click();
	const card1Pending = page.locator('.task-card', { hasText: t1 });
	await card1Pending.waitFor();
	assert.ok(await card1Pending.isVisible(), 'Task 1 returned to Pendientes');

	// Clean up test tasks
	const currentTasks = await tasks();
	const toDelete = currentTasks.filter(t => t.description.startsWith('TEST lote espera')).map(t => t.uuid);
	if (toDelete.length) {
		await context.request.delete('/api/tasks?' + toDelete.map(u => 'tasks=' + u).join('&'));
	}

	assert.deepEqual(errors, [], 'No JavaScript console errors');
	console.log('Batch action "Poner en espera" in table and card view, presets, and clear wait PASS');
}
finally {
	await browser.close();
}
