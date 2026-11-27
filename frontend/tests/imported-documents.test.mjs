import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bundledArticles } from '../src/modules/education/mock/bundled-articles.ts';
import { getDemoArticle, getDemoList, getDemoFilters } from '../src/modules/education/mock/demo.ts';
import { practices } from '../src/modules/practices/mock/practices.ts';
import { generateArticleCover } from '../src/modules/education/lib/generated-cover.ts';

const catalog = JSON.parse(readFileSync(new URL('../../docs/content-import/catalog.json', import.meta.url), 'utf8'));
const oldArticleSlugs = ['exam-stress', 'burnout', 'sleep', 'adaptation'];
const oldPracticeSlugs = ['long-exhale', 'even-breathing', 'five-four-three-two-one', 'feet-support', 'two-minute-pause'];

test('трёх исходных статей достаточно для публичного каталога без старых заглушек', () => {
  assert.equal(bundledArticles.length, 3);
  assert.equal(getDemoList(new URLSearchParams()).total, 3);
  assert.deepEqual(bundledArticles.map(x => x.slug),
    ['exam-preparation-myths', 'stress-during-exams', 'year-results-and-values']);
  for (const slug of oldArticleSlugs) assert.equal(getDemoArticle(slug), null, slug);
  assert.equal(getDemoList(new URLSearchParams('category=study')).total, 2);
  assert.equal(getDemoList(new URLSearchParams('tags=exams&tags=stress')).total, 2);
  assert.equal(getDemoList(new URLSearchParams('tags=values&tags=reflection')).total, 1);
});

test('полные тексты трёх статей и авторы совпадают с данными импорта DOCX', () => {
  assert.deepEqual(bundledArticles, catalog.articles);
  const authors = [
    'Сердюкова Валерия, Шалина Анжелика',
    'Масленникова Ксения, Сафоева Гулрух',
    'Переслегина Валентина, Панина Светлана',
  ];
  for (const [index, article] of bundledArticles.entries()) {
    assert.equal(article.author, authors[index]);
    assert.ok(article.body.length > 2000, `article ${index + 1} not truncated`);
    assert.equal(article.reviewer, undefined, 'no invented reviewer');
    assert.equal(article.reviewedAt, undefined, 'no invented review date');
    assert.equal(article.imageUrl, null, 'automatic SVG cover enabled');
  }
  assert.match(bundledArticles[0].body, /\n1\. Учите материал частями[^]*\n2\. Обязательно делайте перерывы/);
  assert.match(bundledArticles[2].body, /\n- ✅ Объективно оценивайте свои возможности\n- ✅/);
  assert.match(bundledArticles[1].body, /Помидорная техника/);
});

test('поиск, категории и SVG-превью используют новые статьи', () => {
  const filters = getDemoFilters();
  assert.deepEqual(filters.categories.map(x => x.slug).sort(), ['study','wellbeing']);
  assert.equal(getDemoList(new URLSearchParams('q=помидорная')).total, 0,
    'search is intentionally title/summary-only');
  assert.equal(getDemoList(new URLSearchParams('q=Мифы')).total, 1);
  const images = bundledArticles.map(a => generateArticleCover(a.title, a.category.name, a.summary));
  assert.equal(new Set(images).size, 3);
  for (const svg of images) assert.match(svg, /<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
});

test('6 уникальных практик заменяют старый набор; тексты и шаги полные', () => {
  assert.equal(practices.length, 6);
  assert.deepEqual(practices, catalog.practices);
  assert.equal(new Set(practices.map(x => x.title)).size, 6);
  for (const slug of oldPracticeSlugs) assert.ok(!practices.some(x => x.slug === slug), slug);
  assert.equal(practices.filter(p => p.title === 'Упражнение «Три хороших события»').length, 1);
  for (const practice of practices) {
    assert.equal(practice.durationEstimated, true);
    assert.ok(practice.steps.length > 0);
    assert.ok(practice.steps.every(x => x.trim().length > 0));
  }
  assert.equal(practices.find(x => x.slug === 'grounding-5-4-3-2-1')?.steps.length, 5);
  assert.match(practices.find(x => x.slug === 'muscle-relaxation')?.important, /30–40 секунд/);
  assert.match(practices.find(x => x.slug === 'breathing-4-7-8')?.steps.join(' '), /Повторите упражнение 5–7 раз/);
  assert.match(practices.find(x => x.slug === 'three-good-events')?.steps.join(' '), /эмоции вы испытывали/);
});

test('практики без указанной длительности показывают приблизительное время, а заземление — 5–1', () => {
  const view = readFileSync(new URL('../src/modules/practices/components/PracticeView.tsx', import.meta.url),'utf8');
  const card = readFileSync(new URL('../src/modules/practices/components/PracticeCard.tsx', import.meta.url),'utf8');
  assert.match(card, /durationEstimated/);
  assert.match(view, /durationEstimated/);
  assert.match(view, /reversed=\{practice.slug === 'grounding-5-4-3-2-1'\}/);
  assert.match(view, /start=\{practice.slug === 'grounding-5-4-3-2-1' \? 5 : undefined\}/);
});

test('SQL-миграция заменяет только известные демо slug без вымышленных рецензентов', () => {
  const sql = readFileSync(new URL('../../backend/internal/data/000002_import_articles.up.sql', import.meta.url),'utf8');
  assert.match(sql, /DELETE FROM materials WHERE slug IN \('exam-stress'/);
  for (const article of bundledArticles) {
    assert.ok(sql.includes(`'${article.slug}'`));
    assert.ok(sql.includes(article.title));
    assert.ok(sql.includes(article.author));
  }
  assert.ok(sql.includes("'', NOW(), 'published', NOW()"));
});
