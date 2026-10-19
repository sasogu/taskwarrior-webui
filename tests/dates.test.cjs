const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require(process.env.TASKWEB_TYPESCRIPT || '../frontend/node_modules/typescript');
const filename = path.resolve(__dirname, '../frontend/utils/dates.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018, esModuleInterop: true }
});
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(compiled.outputText, filename);
const { readTaskDate, formatTaskDate, parseDateInput, setTaskDay, setTaskTime } = loaded.exports;
process.env.TZ = 'Europe/Madrid';

test('exported timestamps display local dates with readable months and exact times', () => {
	assert.equal(formatTaskDate('20261022T131507Z', 'es'), '22 de octubre de 2026 · 15:15:07');
	assert.equal(formatTaskDate('20261021T220000Z', 'ca'), "22 d'octubre de 2026");
	assert.equal(formatTaskDate('2026-10-22', 'en'), 'October 22, 2026');
});

test('day and time selectors preserve the other part and use the correct UTC offset', () => {
	assert.equal(setTaskTime('20261022T131507Z', '17:45'), '20261022T154500Z');
	assert.equal(setTaskTime('20261022T131507Z', '00:30'), '20261021T223000Z');
	assert.equal(setTaskDay('20261024T131507Z', '2026-10-26'), '20261026T141507Z');
	assert.equal(setTaskDay('', '2026-10-22'), '20261021T220000Z');
	for (const invalid of ['24:00', '17:99', '', 'tomorrow']) {
		assert.equal(setTaskTime('20261022T131507Z', invalid), '20261022T131507Z');
	}
	assert.equal(setTaskTime('tomorrow', '17:45'), 'tomorrow');
	assert.equal(setTaskDay('20261022T131507Z', 'invalid'), '20261022T131507Z');
});

test('numeric and readable dates parse according to language; expressions stay intact', () => {
	for (const language of ['en', 'es', 'ca']) {
		const original = '20261022T131507Z';
		const input = formatTaskDate(original, language);
		assert.equal(readTaskDate(parseDateInput(input, language)).valueOf(), readTaskDate(original).valueOf(), language + ": " + input + " => " + parseDateInput(input, language));
		assert.equal(parseDateInput(original, language), original);
		for (const value of ['', 'tomorrow', '+1w', 'not a date']) {
			assert.equal(parseDateInput(value, language), value);
			assert.equal(formatTaskDate(value, language), value);
		}
	}
	assert.equal(parseDateInput('22/10/2026', 'es'), '2026-10-22T00:00:00');
	assert.equal(parseDateInput('22/10/2026', 'ca'), '2026-10-22T00:00:00');
	assert.equal(parseDateInput('10/22/2026', 'en'), '2026-10-22T00:00:00');
	assert.equal(parseDateInput('31/02/2026', 'es'), '31/02/2026');
	assert.equal(parseDateInput('22 de octubre de 2026 17:45', 'es'), '2026-10-22T17:45:00');
	for (let month = 1; month <= 12; month++) {
		const original = `2026-${String(month).padStart(2, '0')}-22`;
		assert.equal(readTaskDate(parseDateInput(formatTaskDate(original, 'ca'), 'ca')).valueOf(), readTaskDate(original).valueOf());
	}
});
