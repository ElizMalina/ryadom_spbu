import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const page = read('../src/app/page.tsx');
const css = read('../src/app/home.css');
const navigation = read('../src/modules/home/components/HomeSidebarNavigation.tsx');
const moodSelector = read('../src/modules/home/components/MoodSelector.tsx');

test('the homepage keeps the expected public sections and crisis route', () => {
  for (const label of [
    'Разобраться за 2 минуты', 'Записаться к психологу',
    'Как вы сейчас?', 'Выберите путь', 'На сегодня',
  ]) {
    assert.ok(page.includes(label), label);
  }
  assert.match(page, /href="\/crisis"/);
});

test('all seven navigation destinations remain available', () => {
  for (const href of ['/', '/focus', '/wall', '/practices', '/appointments', '/psychoeducation', '/events']) {
    assert.ok(navigation.includes(`href: '${href}'`), href);
  }
});

test('mobile menu has a real toggle with accessible state', () => {
  assert.match(navigation, /aria-expanded=\{menuOpen\}/);
  assert.match(navigation, /aria-controls=\{navigationId\}/);
  assert.match(navigation, /onClick=\{\(\) => setMenuOpen\(\(open\) => !open\)\}/);
  assert.match(css, /\.homeNavigation\[data-open='true'\]/);
  assert.match(css, /\.homeNavigation\s*\{\s*display: none;/);
});

test('root remains server rendered; interactive islands are isolated', () => {
  assert.doesNotMatch(page, /['"]use client['"]/);
  assert.match(navigation, /['"]use client['"]/);
  assert.match(moodSelector, /['"]use client['"]/);
});

test('mood selection is local, typed and never persisted', () => {
  assert.match(moodSelector, /useState<Mood \| null>/);
  assert.match(moodSelector, /aria-pressed=/);
  for (const source of [page, navigation, moodSelector]) {
    assert.doesNotMatch(source, /localStorage|sessionStorage|fetch\(|XMLHttpRequest|navigator\.sendBeacon/);
  }
});

test('sidebar background follows the entire document height', () => {
  assert.match(css, /\.homeSidebarColumn\s*\{[^}]*min-height: 100%/s);
  assert.match(css, /\.homeSidebar\s*\{[^}]*position: sticky/s);
});

test('widths account for padding, and grid tracks can shrink', () => {
  assert.match(css, /\.homeShell \*,\s*\.homeShell \*::before,[^}]*box-sizing: border-box/s);
  assert.match(css, /grid-template-columns: 244px minmax\(0, 1fr\)/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(css, /overflow-x:\s*hidden\s*;/);
});

test('mobile layout collapses to one column and the actions stack', () => {
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.match(css, /\.homeGrid \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /\.homeActions \{ display: grid; grid-template-columns: minmax\(0, 1fr\); \}/);
});

test('mobile text can wrap, focus is visible and reduced motion is respected', () => {
  assert.match(css, /overflow-wrap: break-word/);
  assert.match(css, /\.homeShell a:focus-visible/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('user-generated markup is not interpolated unsafely', () => {
  for (const source of [page, navigation, moodSelector]) {
    assert.doesNotMatch(source, /dangerouslySetInnerHTML|eval\(|new Function\(/);
  }
});

test('SPbU brand is applied without replacing the responsive menu', () => {
  assert.match(navigation, /src="\/spbu-logo-white\.png"/);
  assert.match(navigation, /className="homeBrandLogo"/);
  assert.doesNotMatch(navigation, /navIcon|HouseIcon|HeartIcon/);
  assert.match(css, /--spbu-terracotta: #9f2d20/);
  assert.match(css, /--spbu-gray: #a8adb4/);
  assert.match(css, /Open Sans/);
  assert.match(css, /font-size: 9px/);
  assert.match(css, /font-size: 8px/);
});
