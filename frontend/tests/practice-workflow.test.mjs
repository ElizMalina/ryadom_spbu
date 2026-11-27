import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const frontendRoot = path.resolve(import.meta.dirname, '..');
const kindLabels = { breathing: 'Дыхание', grounding: 'Заземление', stress: 'Стресс', mindfulness: 'Осознанность', checklist: 'Чек-лист' };

async function loadTs(relativePath, mocks = {}, workingDir = frontendRoot) {
  const text = await readFile(path.join(frontendRoot, relativePath), 'utf8');
  const result = ts.transpileModule(text, {
    fileName: relativePath,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics || []).filter(x => x.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `TypeScript syntax of ${relativePath}`);
  const module = { exports: {} };
  const sandbox = { exports: module.exports, module, process: { cwd: () => workingDir, pid: process.pid },
    require: id => id in mocks ? mocks[id] : require(id), console, Buffer };
  vm.runInNewContext(result.outputText, sandbox, { filename: relativePath });
  return module.exports;
}

const valid = {
  kind: 'breathing', title: 'Мягкое дыхание', summary: 'Короткое упражнение для паузы между заданиями.',
  durationMinutes: 5, tags: ['стресс', 'учёба'],
  steps: ['Сядьте удобно', 'Дышите естественно'],
  boundaries: ['Остановитесь при дискомфорте'],
};

test('практика проходит серверную валидацию, неверная не проходит', async () => {
  const mod = await loadTs('src/modules/practices/server/demo-practices.ts', { '../lib/kinds': { practiceKindLabels: kindLabels } });
  const accepted = mod.parsePracticeDraft(valid);
  assert.equal(accepted.title, valid.title);
  assert.equal(mod.parsePracticeDraft({ ...valid, kind: 'not-a-kind' }), null);
  assert.equal(mod.parsePracticeDraft({ ...valid, durationMinutes: 0 }), null);
  assert.equal(mod.parsePracticeDraft({ ...valid, boundaries: [] }).boundaries.length, 0);
  assert.equal(mod.parsePracticeDraft({ ...valid, boundaries: [], beforeStart: '', important: '' }).important, undefined);
  assert.equal(mod.parsePracticeDraft({ ...valid, beforeStart: 42 }), null);
  assert.equal(mod.parsePracticeDraft({ ...valid, important: 'x'.repeat(2001) }), null);
  assert.equal(mod.parsePracticeDraft({ ...valid, steps: [''] }), null);
  assert.equal(mod.parsePracticeDraft({ ...valid, title: 'x'.repeat(121) }), null);
  assert.equal(mod.parsePracticeDraft({ ...valid, steps: ['x'.repeat(601)] }), null);
});

test('создание -> рецензирование -> публикация, до одобрения материал скрыт', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'ryadom-practices-test-'));
  try {
    const mod = await loadTs('src/modules/practices/server/demo-practices.ts', { '../lib/kinds': { practiceKindLabels: kindLabels } }, tmp);
    const draft = mod.parsePracticeDraft(valid);
    const submitted = await mod.submitPractice('consultant.demo', draft);
    assert.equal(submitted.status, 'pending');
    assert.equal((await mod.listPublishedPractices()).length, 0);
    assert.equal(await mod.getPublishedPractice(submitted.practice.slug), null);
    assert.equal((await mod.listPendingPractices()).length, 1);
    assert.equal((await mod.decidePractice(submitted.id, 'approved')).status, 'approved');
    assert.equal((await mod.listPublishedPractices()).length, 1);
    assert.equal((await mod.getPublishedPractice(submitted.practice.slug)).title, valid.title);
    assert.equal((await mod.listPendingPractices()).length, 0);
    assert.equal(await mod.decidePractice(submitted.id, 'rejected'), null);
    const second = await mod.submitPractice('consultant.demo', draft);
    await mod.decidePractice(second.id, 'rejected');
    assert.equal((await mod.listPublishedPractices()).length, 1);
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('поиск практик по словам, типу и нескольким тегам', async () => {
  const mod = await loadTs('src/modules/practices/lib/filterPractices.ts', { './kinds': { practiceKindLabels: kindLabels } });
  const items = [{slug:'a',...valid}, {slug:'b',...valid,title:'Заземление в моменте',kind:'grounding',tags:['осознанность']}];
  assert.equal(mod.filterPractices(items, 'дыХаниЕ', null).length, 1);
  assert.equal(mod.filterPractices(items, 'мягкое паузы', null).length, 1);
  assert.equal(mod.filterPractices(items, '', 'grounding').length, 1);
  assert.equal(mod.filterPractices(items, '', null, ['учёба','стресс']).length, 1);
  assert.equal(mod.filterPractices(items, '', null, ['учёба','осознанность']).length, 0);
});

test('у обоих каталогов действие находится справа от заголовка', async () => {
  for (const page of ['psychoeducation', 'practices']) {
    const s = await readFile(path.join(frontendRoot, `src/app/(public)/${page}/page.tsx`),'utf8');
    assert.match(s,/className="catalogTitleRow"/);
    assert.ok(s.indexOf('className="catalogHero"') < s.indexOf('CreateAction />'));
  }
});

test('маршруты назначения и рецензирования проверяют роли на сервере', async () => {
  const creation = await readFile(path.join(frontendRoot,'src/app/api/demo-practices/route.ts'),'utf8');
  const review = await readFile(path.join(frontendRoot,'src/app/api/demo-practices/[id]/route.ts'),'utf8');
  assert.match(creation, /hasRole\(user, 'consultant'\)/);
  assert.match(creation, /hasRole\(user, 'reviewer'\)/);
  assert.match(review, /hasRole\(user, 'reviewer'\)/);
  assert.match(creation, /parsePracticeDraft\(data\)/);
});
