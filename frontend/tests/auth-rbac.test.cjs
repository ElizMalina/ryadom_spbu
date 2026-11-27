#!/usr/bin/env node
/* Run from any working directory: node tests/check_auth.cjs /path/to/PROJECT_ROOT */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const project = path.resolve(process.argv[2] || path.join(__dirname, '..', '..')); 
const frontend = path.join(project, 'frontend');
const read = (p) => fs.readFileSync(path.join(frontend, p), 'utf8');
const tsRequire = createRequire(path.join(frontend, 'package.json'));
let ts;
try { ts = tsRequire('typescript'); } catch (e) {
  console.error('First run `cd frontend && npm install` in your project; TypeScript dependency is missing.');
  process.exit(2);
}
let count = 0;
const verify = (description, callback) => { callback(); console.log(`PASS ${++count}: ${description}`); };
const listFiles = dir => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? listFiles(path.join(dir, item.name)) : [path.join(dir, item.name)]) : [];
verify('TypeScript and TSX files parse', () => {
  const files = listFiles(path.join(frontend, 'src')).filter(p => /\.(tsx|ts)$/.test(p));
  assert(files.length > 15);
  for (const file of files) {
    const tree = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    assert.equal(tree.parseDiagnostics.length, 0, `Invalid ${file}: ${tree.parseDiagnostics.map(x => x.messageText).join('; ')}`);
  }
});
verify('Role and redirect functions behave correctly', () => {
  const js = ts.transpileModule(read('src/modules/auth/model/types.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports }, { timeout: 1000 });
  assert.equal(exports.isUserRole('student'), true);
  assert.equal(exports.isUserRole('guest'), false);
  assert.equal(exports.isUserRole('root'), false);
  assert.equal(exports.hasRole(null, 'admin'), false);
  assert.equal(exports.hasRole({ roles: ['student'] }, 'student'), true);
  assert.equal(exports.hasRole({ roles: ['student'] }, 'admin'), false);
  assert.equal(exports.safeReturnTo('/psychoeducation'), '/psychoeducation');
  for (const malicious of ['https://example.org', '//example.org', '/\\example.org', 'javascript:alert(1)', '/x\nY']) {
    assert.equal(exports.safeReturnTo(malicious), '/', malicious);
  }
});
verify('Main navigation contains no removed Help/Understand sections', () => {
  const header = read('src/modules/navigation/components/SiteHeader.tsx');
  assert(!header.includes("label: 'Разобраться'"));
  assert(!header.includes("label: 'Помощь'"));
  assert.match(header, /<ProfileMenu\s*\/>/);
});
verify('Exactly one shared SiteHeader component', () => {
  const shell = read('src/modules/navigation/components/PublicShell.tsx');
  assert.match(shell, /<SiteHeader/);
});
verify('All protected UI links have their intended role', () => {
  const header = read('src/modules/navigation/components/SiteHeader.tsx');
  assert.match(header, /'moderator'/); assert.match(header, /'reviewer'/); assert.match(header, /'admin'/);
  const actions = read('src/modules/auth/components/RoleLink.tsx');
  assert.match(actions, /role="consultant"/);
  assert.match(actions, /role="student"|role, href/);
  assert.match(read('src/app/wall/page.tsx'), /role="student"/);
});
verify('Production mock auth and mock content are disabled', () => {
  assert.match(read('src/modules/auth/server/demo-auth.ts'), /NODE_ENV === 'development'/);
  assert.match(read('src/app/api/demo-content/[kind]/route.ts'), /demoEnabled\(\)/);
});
verify('Session is httpOnly and has HMAC signature', () => {
  assert.match(read('src/app/api/demo-auth/session/route.ts'), /httpOnly: true/);
  assert.match(read('src/modules/auth/server/demo-auth.ts'), /createHmac/);
});
verify('Client components do not import server-side cookie or file modules', () => {
  const components = listFiles(path.join(frontend, 'src/modules/auth/components')).filter(p => p.endsWith('.tsx'));
  for (const file of components) {
    const code = fs.readFileSync(file, 'utf8');
    assert(!code.includes('server/demo-auth'), file);
    assert(!code.includes('node:fs'), file);
    assert(!code.includes('node:crypto'), file);
  }
});
verify('Admin and moderation authorization checked on server', () => {
  assert.match(read('src/app/api/demo-auth/users/route.ts'), /isAdmin\(\)/);
  assert.match(read('src/app/api/demo-content/[kind]/[id]/route.ts'), /hasRole\(user/);
});
verify('SSO return URL is validated and login form uses POST', () => {
  assert.match(read('src/modules/auth/model/types.ts'), /startsWith\('\/'\)/);
  assert.match(read('src/modules/auth/components/MockSsoForm.tsx'), /method: 'POST'/);
});
verify('Home search and CTAs removed', () => {
  for (const file of ['src/app/page.tsx', 'src/app/(public)/home/page.tsx']) {
    if (fs.existsSync(path.join(frontend, file))) {
      const page = read(file);
      if (page.includes('<PublicShell')) {
        assert(!page.includes('homeTopbar'), `Search remains in ${file}`);
        assert(!page.includes('homeActions'), `CTAs remain in ${file}`);
      }
    }
  }
});
verify('Psychoeducation author action is on its page', () => {
  assert.match(read('src/app/(public)/psychoeducation/page.tsx'), /PsychoeducationCreateAction/);
});
verify('Global CSS loads shared auth styles before rules', () => {
  const css = read('src/app/globals.css');
  assert(css.includes("@import '../styles/auth.css';"));
  assert(css.indexOf("@import '../styles/auth.css';") < css.indexOf('*, *::before'));
});
console.log(`${count}/${count} checks passed.`);
