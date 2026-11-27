import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = fileURLToPath(new URL('../src/app/', import.meta.url));
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const read = (root, file) => readFileSync(join(root, file));

test('favicon uses Windows icon format and offers sizes 16–256', () => {
  const icon = read(app, 'favicon.ico');
  assert.equal(icon.readUInt16LE(0), 0);
  assert.equal(icon.readUInt16LE(2), 1);
  const n = icon.readUInt16LE(4);
  assert.ok(n >= 6, 'expected multiple favicon sizes');
  const sizes = [];
  for (let i = 0; i < n; i++) {
    const p = 6 + 16 * i;
    sizes.push(icon[p] || 256);
    const byteCount = icon.readUInt32LE(p + 8);
    const offset = icon.readUInt32LE(p + 12);
    assert.ok(byteCount > 0);
    assert.ok(offset + byteCount <= icon.length);
  }
  for (const size of [16, 32, 48, 64, 128, 256]) {
    assert.ok(sizes.includes(size), `missing ${size}px favicon`);
  }
  assert.deepEqual(icon, read(publicDir, 'favicon.ico'));
});

test('Next.js icon PNGs and Apple icon use recognized file conventions', () => {
  for (const name of ['icon.png', 'apple-icon.png']) {
    const image = read(app, name);
    assert.deepEqual(image.subarray(0, 8), Buffer.from('89504e470d0a1a0a', 'hex'));
    assert.ok(image.readUInt32BE(16) >= 180);
    assert.ok(image.readUInt32BE(20) >= 180);
  }
});

test('favicon is enabled globally at the root app layout', () => {
  const layout = read(app, 'layout.tsx').toString('utf8');
  assert.match(layout, /export const metadata: Metadata/);
  assert.match(layout, /<html lang="ru">/);
  assert.doesNotMatch(layout, /icons:\s*\{[^}]*other-icon/s);
});
