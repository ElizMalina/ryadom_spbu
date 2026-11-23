import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const page = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/app/home.css', import.meta.url), 'utf8');
test('7 sections shown in sidebar', () => {
 for (const label of ['Главная', 'Разобраться', 'Накопилось', 'Практики', 'Помощь', 'Психопросвет', 'События']) assert.ok(page.includes(label), label);
});
test('essential homepage blocks', () => {
 for (const label of ['Разобраться за 2 минуты','Записаться к психологу','Как вы сейчас?','Выберите путь','На сегодня']) assert.ok(page.includes(label),label);
});
test('crisis route in navigation', () => assert.match(page, /href="\/crisis"/));
test('selection is local client state and not persisted', () => {
 assert.ok(page.includes('useState'));
 assert.ok(!page.includes('localStorage'));
});
test('keyboard focus and responsive breakpoints are present', () => {
 assert.ok(styles.includes('max-width:600px'));
 assert.ok(readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8').includes('focus-visible'));
});
