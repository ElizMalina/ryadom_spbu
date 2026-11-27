import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(import.meta.dirname, '..');
const get = relative => readFile(path.join(root, relative), 'utf8');

test('No generic advice is inserted into the practice page', async () => {
  const view = await get('src/modules/practices/components/PracticeView.tsx');
  const kinds = await get('src/modules/practices/lib/kinds.ts');
  assert.doesNotMatch(view, /Можно остановиться в любой момент/);
  assert.doesNotMatch(view, /Эта практика относится к самопомощи/);
  assert.doesNotMatch(view, /practiceKindDescriptions/);
  assert.doesNotMatch(kinds, /Спокойные упражнения без сложных задержек дыхания/);
  assert.match(view, /hasBeforeStart &&/);
  assert.match(view, /important &&/);
});

test('Form has independent author-owned fields with no boilerplate', async () => {
  const form = await get('src/modules/practices/components/PracticeCreateForm.tsx');
  assert.match(form, /id="practice-before-start" value=\{beforeStart\}/);
  assert.match(form, /id="practice-important" value=\{important\}/);
  assert.match(form, /beforeStart: beforeStart\.trim\(\), important: important\.trim\(\)/);
  assert.doesNotMatch(form, /placeholder="Если возникает дискомфорт, остановитесь"/);
});

test('Server preserves author text, validates limits and accepts empty sections', async () => {
  const source = await get('src/modules/practices/server/demo-practices.ts');
  const transpiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const module = { exports: {} };
  const context = { module, exports: module.exports,
    require: id => id === '../lib/kinds' ? { practiceKindLabels: { breathing: 'Дыхание' } } : require(id),
  };
  vm.runInNewContext(transpiled, context);
  const { parsePracticeDraft } = module.exports;
  const base = { kind: 'breathing', title: 'Проверка текста', summary: 'Описание для проверки текста практики',
    durationMinutes: 5, steps: ['Шаг один'], tags: [], boundaries: [] };
  const authored = parsePracticeDraft({ ...base, beforeStart: '  Авторский текст перед началом  ', important: '  Авторское предупреждение  ' });
  assert.equal(authored.beforeStart, 'Авторский текст перед началом');
  assert.equal(authored.important, 'Авторское предупреждение');
  const empty = parsePracticeDraft(base);
  assert.equal(empty.beforeStart, undefined);
  assert.equal(empty.important, undefined);
  assert.equal(parsePracticeDraft({ ...base, important: 1 }), null);
  assert.equal(parsePracticeDraft({ ...base, beforeStart: 'x'.repeat(2001) }), null);
});

test('Modified TypeScript and TSX files parse', async () => {
  for (const file of [
    'src/modules/practices/model/types.ts',
    'src/modules/practices/components/PracticeView.tsx',
    'src/modules/practices/components/PracticeCreateForm.tsx',
    'src/modules/practices/server/demo-practices.ts',
    'src/modules/practices/components/PracticeReviewQueue.tsx',
    'src/modules/practices/lib/kinds.ts',
    'src/modules/practices/lib/filterPractices.ts',
  ]) {
    const source = await get(file);
    const result = ts.transpileModule(source, {fileName:file, reportDiagnostics:true,
      compilerOptions: {module:ts.ModuleKind.ESNext, jsx:ts.JsxEmit.Preserve,
        target:ts.ScriptTarget.ES2022}});
    assert.equal((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, file);
  }
});
