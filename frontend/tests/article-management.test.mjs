import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createSubmission, deleteOwnArticle, listApprovedArticles, listForReview,
  listOwnArticles, reviseOwnArticle, reviewSubmission,
} from '../src/modules/auth/server/demo-content.ts';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = relative => readFile(path.join(root, '..', relative), 'utf8');
const a = { id: 'demo-002', username: 'consultant.demo', displayName: 'Мария Соколова', roles: ['consultant'] };
const b = { id: 'other-consultant', username: 'other.demo', displayName: 'Ирина Орлова', roles: ['consultant'] };

test('an author alone can change/delete their articles, and editing withdraws publication', async () => {
  const previous = process.cwd();
  const directory = await mkdtemp(path.join(tmpdir(), 'ryadom-my-articles-'));
  try {
    process.chdir(directory);
    const article = await createSubmission('article', a, 'Оригинальный заголовок', 'Образец текста для проверки редакторской формы.');
    const other = await createSubmission('article', b, 'Чужая публикация', 'Содержимое второй авторской статьи для теста.');
    const wall = await createSubmission('wall', a, '', 'Анонимная запись в раздел накопилось.');
    assert.equal((await listOwnArticles(a)).length, 1);
    assert.equal((await listOwnArticles(b)).length, 1);
    assert.equal((await listOwnArticles(a))[0].id, article.id);
    assert.equal(await reviseOwnArticle(b, article.id, 'Попытка чужой правки', 'Не разрешённый владельцем текст'), null);
    assert.equal(await deleteOwnArticle(b, article.id), false);
    assert.equal(await reviseOwnArticle(a, wall.id, 'Подмена публикации', 'Запись на стене нельзя менять через API статей'), null);
    assert.equal(await deleteOwnArticle(a, wall.id), false);
    await reviewSubmission('article', article.id, 'approved');
    assert.equal((await listApprovedArticles()).length, 1);
    const edited = await reviseOwnArticle(a, article.id, 'Изменённая авторская статья', 'Новый текст, требующий дополнительной проверки.');
    assert.equal(edited?.status, 'pending');
    assert.equal(edited?.title, 'Изменённая авторская статья');
    assert.equal((await listApprovedArticles()).length, 0, 'an edited published article must disappear from public catalog pending review');
    assert.equal((await listForReview('article')).length, 2, 'edit must return article to existing review queue');
    await reviewSubmission('article', article.id, 'approved');
    assert.equal((await listApprovedArticles()).length, 1);
    assert.equal(await deleteOwnArticle(a, article.id), true);
    assert.equal(await deleteOwnArticle(a, article.id), false);
    assert.equal((await listOwnArticles(a)).length, 0);
    assert.equal((await listApprovedArticles()).length, 0);
    assert.equal((await listOwnArticles(b))[0].id, other.id);
    assert.equal((await listForReview('wall')).length, 1, 'other content unaffected');
  } finally {
    process.chdir(previous); await rm(directory, { recursive: true, force: true });
  }
});

test('author management and meeting deletion routes check server-side ownership and permission', async () => {
  const index = await read('src/app/api/demo-content/[kind]/route.ts');
  const route = await read('src/app/api/demo-content/[kind]/[id]/route.ts');
  const meetingRoute = await read('src/app/api/demo-events/[id]/route.ts');
  const page = await read('src/modules/auth/components/MyArticles.tsx');
  const eventCard = await read('src/modules/events/components/EventCard.tsx');
  assert.match(index, /view'\) === 'mine'/);
  assert.match(index, /listOwnArticles\(author\)/);
  assert.match(route, /reviseOwnArticle\(user, id, title, body\)/);
  assert.match(route, /deleteOwnArticle\(user, id\)/);
  assert.match(route, /hasRole\(user, 'consultant'\)/);
  assert.match(meetingRoute, /removeMeetingForUser\(user, id\)/);
  assert.match(page, /Отправить на проверку/);
  assert.match(page, /Да, удалить/);
  assert.match(eventCard, /Подтвердить/);
  assert.match(eventCard, /Отменить ваше участие/);
});

test('SSO is smaller on desktop, locale removed, and psychoeducation chips match practices', async () => {
  const form = await read('src/modules/auth/components/MockSsoForm.tsx');
  const css = await read('src/styles/auth.css');
  const psycho = await read('src/app/(public)/psychoeducation/psychoeducation.css');
  const practices = await read('src/app/(public)/practices/practices.css');
  assert.doesNotMatch(form, /ssoLocale|русский/);
  assert.match(css, /@media \(min-width: 761px\)/);
  assert.match(css, /\.ssoPanel \{ max-width: 470px/);
  const font = s => /\.filterChip\s*\{[^}]*font-size:\s*13px/s.test(s);
  assert.ok(font(psycho)); assert.ok(font(practices));
  assert.match(psycho, /\.filterLabel\s*\{[^}]*font-size:\s*14px/s);
});
