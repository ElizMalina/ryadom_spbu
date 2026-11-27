import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(path.join(root, f), 'utf8');
const header = read('src/modules/navigation/components/SiteHeader.tsx');
const shell = read('src/styles/shell.css');
const globals = read('src/app/globals.css');
const layout = read('src/app/layout.tsx');
const profile = read('src/modules/auth/components/ProfileMenu.tsx');

function cssBlock(css, selector) {
  const start = css.lastIndexOf(selector + ' {');
  assert.ok(start !== -1, `CSS selector ${selector} must exist`);
  const end = css.indexOf('}', start);
  return css.slice(start, end);
}

test('menu is one shared component for all public routes', () => {
  assert.match(read('src/modules/navigation/components/PublicShell.tsx'), /<SiteHeader/);
  assert.equal((header.match(/<nav className="siteNav"/g) || []).length, 1);
});

test('account/profile and crisis actions appear above every navigation link', () => {
  const a = header.indexOf('<div className="siteHeaderActions">');
  const p = header.indexOf('<ProfileMenu />');
  const c = header.indexOf('href="/crisis"');
  const n = header.indexOf('<nav className="siteNav"');
  assert.ok(a > 0 && a < p && p < c && c < n);
});

test('auth state still selects login versus profile, preserving role-aware navigation', () => {
  assert.match(profile, /if \(!user\)/);
  assert.match(profile, /href=\{`\/auth\/sso\?returnTo=/);
  assert.match(profile, /className="siteProfileButton"/);
  assert.match(header, /restrictedLinks\.filter/);
});

test('desktop logo is 68px, with no former 210px sidebar image', () => {
  const compactStart = globals.indexOf('/* BEGIN RYADOM_COMPACT_FLOWING_SIDEBAR */');
  assert.ok(compactStart > -1);
  const desktopOnly = globals.slice(compactStart, globals.indexOf('@media (max-width: 760px)', compactStart));
  assert.match(desktopOnly, /\.siteHeader \.siteBrandLogo\s*\{[^}]*width:\s*68px[^}]*height:\s*68px/s);
  assert.match(header, /src="\/spbu-emblem-white\.png"/);
});

test('sidebar uses entire document scroll instead of independent viewport scroll', () => {
  const primary = cssBlock(shell, '.siteHeaderInner');
  const override = cssBlock(globals, '.siteHeader .siteHeaderInner');
  assert.doesNotMatch(primary, /position:\s*(?:sticky|fixed)|overflow-y:\s*auto|height:\s*100d?vh/);
  assert.match(override, /position:\s*static/);
  assert.match(override, /overflow:\s*visible/);
  assert.match(override, /height:\s*auto/);
});

test('profile popover drops down and is not clipped by the sidebar', () => {
  const block = cssBlock(globals, '.siteHeader .siteProfileDropdown');
  assert.match(block, /top:\s*calc\(100% \+ 5px\)/);
  assert.match(block, /bottom:\s*auto/);
});

test('mobile retains focus states, accessible toggle and visible account action', () => {
  assert.match(header, /aria-controls=\{menuId\}/);
  assert.match(header, /aria-expanded=\{menuOpen\}/);
  assert.match(header, /Escape/);
  assert.match(globals, /\.siteHeader \.siteHeaderActions/);
  assert.match(read('src/styles/auth.css'), /\.siteHeaderActions \.siteLoginLink\{display:flex\}/);
});

test('global SPbU footer is rendered once, after app content', () => {
  assert.equal((layout.match(/<SiteFooter\s*\/>/g)||[]).length, 1);
  assert.ok(layout.indexOf('<SiteFooter />') > layout.indexOf('</AuthProvider>'));
  assert.match(globals, /RYADOM_GLOBAL_FOOTER_START/);
  assert.match(read('src/modules/navigation/components/SiteFooter.tsx'), /Санкт-Петербургский государственный университет/);
});

test('technical demo warning is absent from visitor profile', () => {
  assert.doesNotMatch(read('src/app/profile/page.tsx'), /Демонстрационный аккаунт/);
  assert.doesNotMatch(read('src/modules/auth/components/AdminRoleManager.tsx'), /\.demo-data\/roles\.json/);
});

test('restored crisis page includes the detailed SPbU and St Petersburg contacts', () => {
  const crisis = read('src/modules/crisis/components/CrisisScreen.tsx');
  const content = read('src/modules/crisis/content.ts');
  for (const label of ['Круглосуточная поддержка','Психологической клиники СПбГУ','Кризисный центр «812»',
    'Мне только спросить','Первая психологическая самопомощь','Как почувствовать себя по-настоящему отдохнувшим']) {
    assert.ok(crisis.includes(label), label);
  }
  assert.match(crisis, /crisisDisclosure/);
  assert.match(content, /tel:\+78005500122/);
  assert.match(content, /roundTheClock/);
});

test('crisis link uses the requested label', () => {
  assert.match(header, />Мне нужна помощь<\/Link>/);
  assert.doesNotMatch(header, />Нужна помощь<\/Link>/);
});
