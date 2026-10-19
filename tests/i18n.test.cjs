const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require(process.env.TASKWEB_TYPESCRIPT || '../frontend/node_modules/typescript');
const filename = path.resolve(__dirname, '../frontend/utils/i18n.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018, esModuleInterop: true }
});
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(compiled.outputText, filename);
const { detectLanguage, localeState, setLanguage, t } = loaded.exports;
const dictionaries = Object.fromEntries(['en', 'es', 'ca'].map(language =>
	[language, JSON.parse(fs.readFileSync(path.resolve(__dirname, `../frontend/locales/${language}.json`), 'utf8'))]));

test('all languages cover the same messages and interpolation parameters', () => {
	for (const dictionary of Object.values(dictionaries)) {
		assert.deepEqual(Object.keys(dictionary).sort(), Object.keys(dictionaries.en).sort());
		for (const key of Object.keys(dictionaries.en)) {
			assert.ok(dictionary[key].trim());
			assert.deepEqual(dictionary[key].match(/\{\w+\}/g), dictionaries.en[key].match(/\{\w+\}/g));
		}
	}
});

test('browser language detection honors preferences, variants and fallback', () => {
	assert.equal(detectLanguage(['ca-ES-valencia', 'es-ES']), 'ca');
	assert.equal(detectLanguage(['fr-FR', 'es-ES', 'en']), 'es');
	assert.equal(detectLanguage(['EN_us']), 'en');
	assert.equal(detectLanguage(['fr-FR']), 'en');
});

test('language changes translate messages, interpolate and tolerate blocked storage', () => {
	global.localStorage = { setItem() { throw new Error('Storage blocked'); } };
	setLanguage('ca');
	assert.equal(localeState.language, 'ca');
	assert.equal(t('New task'), 'Tasca nova');
	assert.ok(t('There are {count} pending subtasks. They will not be completed automatically.', { count: 3 }).includes('3 subtasques'));
	assert.equal(t('Unknown message'), 'Unknown message');
	assert.equal(t('toString'), 'toString');
	setLanguage('xx');
	assert.equal(localeState.language, 'ca');
	delete global.localStorage;
});
