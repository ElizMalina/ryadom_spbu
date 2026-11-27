import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = relative => readFileSync(path.join(frontend, relative), 'utf8');
const exists = relative => existsSync(path.join(frontend, relative));
const pages = [
  'src/app/page.tsx',
  'src/app/(public)/practices/page.tsx',
  'src/app/(public)/practices/[slug]/page.tsx',
  'src/app/(public)/psychoeducation/page.tsx',
  'src/app/(public)/psychoeducation/[slug]/page.tsx',
  'src/app/(public)/crisis/page.tsx',
];

test('all existing public pages use PublicShell instead of duplicated sidebars', () => {
  for (const p of pages.filter(exists)) {
    const src = file(p);
    if (p === 'src/app/page.tsx' && /\bredirect\(['"]\/[^'"]*['"]\)/.test(src)) continue;
    assert.match(src, /<PublicShell/, `${p}: missing common layout`);
    assert.doesNotMatch(src, /<(?:PracticesSidebar|PsychoeducationSidebar|CrisisSidebar|HomeSidebarNavigation)\s*\/>/, `${p}: duplicate sidebar`);
  }
});

test('UI states use the same shell', () => {
  const p = 'src/modules/ui-states/components/UiStatesShell.tsx';
  if (exists(p)) assert.match(file(p), /<PublicShell/);
});

test('centralized SPbU colors and fonts', () => {
  const tokens = file('src/styles/tokens.css');
  assert.match(tokens, /#9f2d20/i);
  assert.match(tokens, /#a8adb4/i);
  assert.match(tokens, /PT Sans/);
  assert.match(tokens, /PT Serif/);
  assert.match(tokens, /--ui-sidebar-width:\s*244px/);
});

test('one global stylesheet loads design layers', () => {
  const globals = file('src/app/globals.css');
  for (const f of ['tokens.css','shell.css','components.css']) assert.ok(globals.includes(`styles/${f}`), f);
});

test('common navigation is keyboard accessible', () => {
  const component = file('src/modules/navigation/components/SiteHeader.tsx');
  for (const token of ['aria-expanded','aria-controls','Escape','usePathname','setMenuOpen(false)','aria-current']) assert.ok(component.includes(token), token);
});

test('no horizontal menu rail on mobile; sidebar height follows page', () => {
  const css = file('src/styles/shell.css');
  assert.match(css, /\.siteNav\[data-open='true'\]/);
  assert.match(css, /\.siteHeader\s*\{[^}]*min-height:\s*100%/s);
  assert.match(css, /grid-template-columns:\s*var\(--ui-sidebar-width\)\s+minmax\(0,\s*1fr\)/);
});

test('mobile inputs avoid iOS Safari focus zoom', () => {
  const css = file('src/styles/components.css');
  assert.match(css, /max-width:\s*760px/);
  assert.match(css, /font-size:\s*16px/);
});

test('local white SPbU logo exists, not a remote image', () => {
  assert.ok(exists('public/spbu-emblem-white.png'));
  assert.match(file('src/modules/navigation/components/SiteHeader.tsx'), /src="\/spbu-emblem-white\.png"/);
});

test('page CSS is scoped and has no independent :root token definitions', () => {
  for (const route of ['practices','psychoeducation','crisis','ui-states']) {
    const p = `src/app/(public)/${route}/${route}.css`;
    if (!exists(p)) continue;
    const css = file(p);
    assert.match(css, /Route-scoped styles/);
    assert.doesNotMatch(css, /^\s*:root\s*\{/m);
  }
});
