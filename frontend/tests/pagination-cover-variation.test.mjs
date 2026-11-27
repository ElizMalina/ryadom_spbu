import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { paginate, paginationPages, PAGE_SIZES } from '../src/modules/ui/pagination/model.ts';
import { generatedCoverUrl, generateArticleCover, COVER_MOTIF_COUNT, COVER_COLOR_SCHEMES } from '../src/modules/education/lib/generated-cover.ts';
const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('catalog fits two rows of three cards before showing pagination', () => {
  assert.equal(PAGE_SIZES.catalog, 6);
  const a = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const first = paginate(a, 1, PAGE_SIZES.catalog);
  assert.deepEqual(first.pageItems, a.slice(0, 6));
  assert.equal(first.pageCount, 2);
  assert.deepEqual([first.from, first.to, first.total], [1, 6, 7]);
  const second = paginate(a, 2, 6);
  assert.deepEqual(second.pageItems, ['g']);
  assert.deepEqual([second.from, second.to], [7, 7]);
});

test('pagination clamps after filtering, deletions and out of range values', () => {
  const a = Array.from({length: 19}, (_, n) => n);
  assert.deepEqual(paginate(a, 2, 6).pageItems, [6,7,8,9,10,11]);
  assert.equal(paginate(a, 100, 6).page, 4);
  assert.equal(paginate(a.slice(0, 12), 4, 6).page, 2);
  assert.equal(paginate([], 100, 6).page, 1);
  assert.equal(paginate([], 100, 6).from, 0);
  assert.equal(paginate([], 1, 6).to, 0);
  assert.equal(paginate(a, -100, 6).page, 1);
  assert.equal(paginate(a, NaN, 0).perPage, 1);
  assert.equal(paginate(a, Infinity, Infinity).perPage, 1);
});

test('pagination pages have first, last, current, adjacent, and gaps', () => {
  assert.deepEqual(paginationPages(1, 1), [1]);
  assert.deepEqual(paginationPages(1, 20), [1, 2, 'ellipsis', 19, 20]);
  assert.deepEqual(paginationPages(10, 20), [1, 2, 'ellipsis', 9, 10, 11, 'ellipsis', 19, 20]);
  assert.deepEqual(paginationPages(20, 20), [1, 2, 'ellipsis', 19, 20]);
  assert.deepEqual(paginationPages(-3, 4), [1, 2, 3, 4]);
});

test('pagination in all dynamic public and private lists', () => {
  const clients = [
    '../src/modules/education/components/CatalogClient.tsx',
    '../src/modules/practices/components/PracticeCatalogClient.tsx',
    '../src/modules/auth/components/WallFeed.tsx',
    '../src/modules/auth/components/MyArticles.tsx',
    '../src/modules/auth/components/ReviewQueue.tsx',
    '../src/modules/practices/components/PracticeReviewQueue.tsx',
    '../src/modules/auth/components/AdminRoleManager.tsx',
    '../src/modules/events/components/EventsClient.tsx',
  ];
  for (const client of clients) {
    const s = source(client);
    assert.match(s, /usePaginatedItems\(/, client);
    assert.match(s, /<Pagination\s/, client);
    assert.match(s, /paged\w*\.pageItems/, client);
  }
  const events = source('../src/modules/events/components/EventsClient.tsx');
  assert.equal((events.match(/<Pagination\s/g) || []).length, 3, 'student selector, created events and assigned events');
  const component = source('../src/modules/ui/pagination/Pagination.tsx');
  assert.match(component, /aria-current=/);
  assert.match(component, /disabled=\{page === 1\}/);
  assert.match(component, /disabled=\{page === pageCount\}/);
  assert.match(component, /setPage\(1\)/);
});

test('article previews use the full hue circle, six schemes and 20 designs', () => {
  assert.equal(COVER_MOTIF_COUNT, 20);
  assert.equal(COVER_COLOR_SCHEMES, 6);
  const patterns = new Set();
  const colors = new Set();
  for (let i = 0; i < 1000; i++) {
    const cover = generateArticleCover(`Статья номер ${i}`, 'Психопросвет', 'Описание');
    const motif = cover.match(/data-motif="(\d+)"/);
    assert.ok(motif, 'motif identifier embedded');
    patterns.add(Number(motif[1]));
    const background = cover.match(/<rect width="1280" height="720" fill="([^"]+)"/);
    assert.ok(background);
    colors.add(background[1]);
  }
  assert.equal(patterns.size, COVER_MOTIF_COUNT, 'all motif designs reachable');
  assert.ok(colors.size > 300, `too few colors: ${colors.size}`);
});

test('cover SVGs remain deterministic and escape untrusted titles', () => {
  const input = '<script onload="alert(1)">& со словами';
  const cover = generateArticleCover(input, input, input);
  assert.equal(cover, generateArticleCover(input, input, input));
  assert.doesNotMatch(cover, /<script|\sonload="/);
  assert.match(cover, /&lt;script/);
  assert.match(cover, /1280/);
  const url = generatedCoverUrl({title: input, summary: input, category: {slug: 'x', name: input}});
  assert.equal(new URL(url, 'http://localhost').searchParams.get('title'), input);
});
