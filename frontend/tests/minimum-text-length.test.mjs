import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(root, relative), 'utf8');
const require = createRequire(import.meta.url);
const ts = require('typescript');

test('Practice draft accepts single non-whitespace character in required text fields', async () => {
  const source = await read('src/modules/practices/server/demo-practices.ts');
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module, exports: module.exports,
    require: id => id === '../lib/kinds'
      ? { practiceKindLabels: { breathing: 'Дыхание' } } : require(id),
  });
  const { parsePracticeDraft } = module.exports;
  const base = { kind: 'breathing', title: 'А', summary: 'Б', durationMinutes: 5,
    steps: ['В'], tags: [], boundaries: [] };
  assert.equal(parsePracticeDraft(base)?.title, 'А');
  assert.equal(parsePracticeDraft(base)?.summary, 'Б');
  assert.equal(parsePracticeDraft({ ...base, beforeStart: '', important: '' })?.steps[0], 'В');
  assert.equal(parsePracticeDraft({ ...base, title: '   ' }), null);
  assert.equal(parsePracticeDraft({ ...base, summary: '' }), null);
  assert.equal(parsePracticeDraft({ ...base, steps: ['   '] }), null);
});

test('Practice form has minimum one, but optional author sections may remain empty', async () => {
  const form = await read('src/modules/practices/components/PracticeCreateForm.tsx');
  assert.doesNotMatch(form, /Поля «Перед началом» и «Важно» не заполняются автоматически/);
  assert.match(form, /title\.trim\(\)\.length >= 1/);
  assert.match(form, /summary\.trim\(\)\.length >= 1/);
  for (const id of ['practice-title', 'practice-summary', 'practice-steps']) {
    assert.match(form, new RegExp(`id="${id}"[\\s\\S]{0,200}?minLength=\\{1\\}`), id);
  }
  assert.match(form, /beforeStart\.trim\(\)\.length <= 2000/);
  assert.match(form, /important\.trim\(\)\.length <= 2000/);
  assert.doesNotMatch(form, /minLength=\{(?:5|10|15)\}/);
});

test('Article and wall creation and editing accept one character end-to-end', async () => {
  const submission = await read('src/modules/auth/components/SubmissionForm.tsx');
  const own = await read('src/modules/auth/components/MyArticles.tsx');
  const post = await read('src/app/api/demo-content/[kind]/route.ts');
  const patch = await read('src/app/api/demo-content/[kind]/[id]/route.ts');
  assert.match(submission, /body\.trim\(\)\.length >= 1/);
  assert.match(submission, /title\.trim\(\)\.length >= 1/);
  assert.match(submission, /минимум 1/);
  assert.doesNotMatch(submission, /минимум 10|От 5 до/);
  assert.match(own, /minLength=\{1\} maxLength=\{160\}/);
  assert.match(own, /minLength=\{1\} maxLength=\{5000\}/);
  assert.match(post, /body\.length < 1/);
  assert.match(post, /title\.length < 1/);
  assert.match(patch, /title\.length < 1/);
  assert.match(patch, /body\.length < 1/);
  assert.doesNotMatch(submission + own + post + patch, /length (?:<|>=) (?:5|10|15)|minLength=\{(?:5|10|15)\}/);
});

test('Other required fields use one character including meeting text and demo name', async () => {
  const events = await read('src/modules/events/components/EventsClient.tsx');
  const sso = await read('src/modules/auth/components/MockSsoForm.tsx');
  const demo = await read('src/modules/ui-states/components/ScenarioScreen.tsx');
  assert.match(events, /required minLength=\{1\} maxLength=\{160\} id="meeting-title"/);
  assert.match(events, /required minLength=\{1\} maxLength=\{300\} id="meeting-address"/);
  assert.match(sso, /username" required minLength=\{1\}/);
  assert.match(sso, /current-password" required minLength=\{1\}/);
  assert.match(demo, /name\.trim\(\)\.length >= 1/);
  assert.match(demo, /не менее одного символа/);
});
