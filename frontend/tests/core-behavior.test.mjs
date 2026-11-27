import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasRole, isUserRole, safeReturnTo, USER_ROLES } from '../src/modules/auth/model/types.ts';
import { normalizeRoleSearch, filterUsersByNameOrLogin } from '../src/modules/auth/model/role-search.ts';
import { isCalendarDate, isClockTime, meetingSortKey, sortMeetings, nowInSpbuTimeZone,
  normalizeSearch, formatEventDate, searchMeetings, searchStudents } from '../src/modules/events/model/types.ts';
import { isHomeFeed } from '../src/modules/home/types.ts';
import { getDemoArticle, getDemoFilters, getDemoList, isPsychoDemoEnabled, toDemoArticles } from '../src/modules/education/mock/demo.ts';
import { createSubmission, reviewSubmission, listApprovedArticles, listPublicWall,
  listForReview } from '../src/modules/auth/server/demo-content.ts';

const me = { id: 'u1', username: 'sasha', displayName: 'Саша Лебедева', roles: ['student'] };

test('Homepage has one tile per destination (no React duplicate keys)', async () => {
  const currentFile = path.dirname(fileURLToPath(import.meta.url));
  const src = await readFile(path.join(currentFile, '../src/app/page.tsx'), 'utf8');
  const links = [...src.matchAll(/\bhref:\s*'([^']+)'/g)].map(match => match[1]);
  assert.ok(links.length >= 2);
  assert.equal(new Set(links).size, links.length);
  assert.equal(links.filter(href => href === '/psychoeducation').length, 1);
});

test('Role validation and SSO return paths reject forged destinations', () => {
  for (const role of USER_ROLES) assert.equal(isUserRole(role), true);
  for (const role of [null, false, 'guest', 'superadmin']) assert.equal(isUserRole(role), false);
  assert.equal(hasRole(me, 'student'), true);
  assert.equal(hasRole(me, 'admin'), false);
  assert.equal(hasRole(null, 'student'), false);
  assert.equal(safeReturnTo('/events?scope=assigned'), '/events?scope=assigned');
  for (const invalid of [null, 42, '', 'https://evil.example', '//evil.example', '/\\evil', '/bad\nurl', '/bad\rurl', '/'+'x'.repeat(1100)]) {
    assert.equal(safeReturnTo(invalid), '/', String(invalid));
  }
});

test('User search accepts name, surname, login, unicode case and ё/е', () => {
  const users = [
    { username: 'sofia.demo', displayName: 'Софья Иванова' },
    { username: 'a.demo', displayName: 'Алёна Ёлкина' },
  ];
  assert.equal(normalizeRoleSearch('  ЁЛКИНА  '), 'елкина');
  assert.deepEqual(filterUsersByNameOrLogin(users, 'иванова СОФЬЯ').map(u => u.username), ['sofia.demo']);
  assert.deepEqual(filterUsersByNameOrLogin(users, 'ёЛКИНА алёна').map(u => u.username), ['a.demo']);
  assert.equal(filterUsersByNameOrLogin(users, 'sofia.demo').length, 1);
  assert.equal(filterUsersByNameOrLogin(users, 'не существует').length, 0);
  assert.equal(filterUsersByNameOrLogin(users, ' ').length, 2);
});

test('Meetings validate leap dates, time, timezone, chronology and both search modes', () => {
  for (const date of ['2028-02-29','2030-12-31','2020-01-01']) assert.equal(isCalendarDate(date), true);
  for (const date of ['2027-02-29','2019-01-01','2101-01-01','2028-02-30','2028-13-01','oops','2028-2-1']) assert.equal(isCalendarDate(date), false);
  for (const time of ['00:00','09:59','23:59']) assert.equal(isClockTime(time), true);
  for (const time of ['24:00','9:00','10:60','abc']) assert.equal(isClockTime(time), false);
  assert.equal(nowInSpbuTimeZone(new Date('2030-01-01T00:30:00Z')), '2030-01-01T03:30');
  assert.equal(normalizeSearch(' Ёлка  ИВАНОВА  '), 'елка иванова');
  assert.equal(formatEventDate('2030-02-07'), '7 февраля 2030');
  assert.equal(formatEventDate('bad'), 'bad');
  const organizer = { id:'o1', username:'psychologist.demo', displayName:'Ольга Психолог' };
  const student = { id:'s1', username:'ivanova.demo', displayName:'Софья Иванова' };
  const meeting = (id, date, time, participants) => ({ id, title:'Индивидуальная консультация',
    date,time,address:'Большая улица 12',organizer,createdAt:'2030-01-01',...(participants ? {participants}: {}) });
  const a = meeting('b','2030-02-07','12:30',[student]);
  const b = meeting('a','2030-02-07','12:30',[student]);
  const c = meeting('c','2030-01-07','09:30');
  const source = [a,c,b];
  assert.equal(meetingSortKey(a),'2030-02-07T12:30');
  assert.deepEqual(sortMeetings(source).map(e=>e.id),['c','a','b']);
  assert.deepEqual(source.map(e=>e.id),['b','c','a']); // no mutation
  assert.deepEqual(searchMeetings(source,'ФЕВРАЛЯ 12:30').map(e=>e.id),['b','a']);
  assert.deepEqual(searchMeetings(source,'07.02.2030 иванова').map(e=>e.id),['b','a']);
  assert.deepEqual(searchMeetings(source,'psychologist.demo').map(e=>e.id),['b','c','a']);
  assert.equal(searchMeetings(source,'нет совпадений').length,0);
  assert.equal(searchMeetings(source,' ').length,3);
  assert.deepEqual(searchStudents([student],'иванова Софья'),[student]);
  assert.deepEqual(searchStudents([student],'ivanova.demo'),[student]);
  assert.deepEqual(searchStudents([student],'нет'),[]);
});

test('Home API shape validation rejects incomplete and mismatched payloads', () => {
  const valid = { message:'Поддержка дня', practice:{ title:'Пауза', description:'Описание', href:'/practices' }, event:null };
  assert.equal(isHomeFeed(valid),true);
  assert.equal(isHomeFeed({...valid,event:{title:'Встреча',description:'Завтра',href:'/events'}}),true);
  for (const invalid of [null,42,[],{}, {message:2,event:null,practice:null},
    {message:'ok',event:undefined,practice:null}, {message:'ok',event:null,practice:{href:'/practices'}},
    {message:'ok',event:'x',practice:null}]) assert.equal(isHomeFeed(invalid),false);
});

test('Demo catalog search, filters and approved article conversion', () => {
  const prevNodeEnv=process.env.NODE_ENV;
  const prevMode=process.env.PSYCHO_API_MODE;
  try {
    process.env.NODE_ENV='development';process.env.PSYCHO_API_MODE='demo';
    assert.equal(isPsychoDemoEnabled(),true);
    process.env.NODE_ENV='production';assert.equal(isPsychoDemoEnabled(),false);
  } finally {process.env.NODE_ENV=prevNodeEnv;process.env.PSYCHO_API_MODE=prevMode;}
  assert.ok(getDemoArticle('exam-preparation-myths')?.body);
  assert.equal(getDemoArticle('not-existing'),null);
  const filters = getDemoFilters();
  assert.ok(filters.categories.some(c=>c.slug==='study'));
  assert.ok(filters.tags.some(t=>t.slug==='stress'));
  assert.equal(getDemoList(new URLSearchParams('q=МИФЫ')).total,1);
  assert.equal(getDemoList(new URLSearchParams('category=study')).total,2);
  assert.equal(getDemoList(new URLSearchParams('type=not-existing')).total,0);
  assert.equal(getDemoList(new URLSearchParams('tags=exams')).total,2);
  assert.equal(getDemoList(new URLSearchParams('tags=values&tags=reflection')).total,1);
  const transformed=toDemoArticles([{id:'abc',title:'Опубликованная статья',body:'  Текст\n \n о работе.  '}]);
  assert.equal(transformed[0].slug,'article-abc');
  assert.equal(transformed[0].summary,'Текст о работе.');
  assert.equal(transformed[0].durationMinutes,1);
  assert.equal(getDemoArticle('article-abc',transformed)?.title,'Опубликованная статья');
  assert.equal(getDemoList(new URLSearchParams('q=опубликованная'),transformed).total,1);
  assert.equal(getDemoFilters(transformed).categories.some(c=>c.slug==='user-articles'),true);
  const list = getDemoList(new URLSearchParams('category=user-articles'),transformed);
  assert.equal(list.total,1);
  assert.equal(Object.hasOwn(list.items[0],'body'),false);
  assert.equal(Object.hasOwn(list.items[0],'sources'),false);
  assert.equal(toDemoArticles([{id:'big',body:'a'.repeat(2000)}])[0].durationMinutes,3);
});

test('Approved submissions appear in catalog only after review; wall hides author IDs', async () => {
  const original = process.cwd();
  const temporary = await mkdtemp(path.join(tmpdir(),'ryadom-reviewed-article-'));
  try {
    process.chdir(temporary);
    const consultant = { ...me, id:'c1', roles:['consultant'] };
    const title = 'Новая статья для каталога';
    const submission = await createSubmission('article',consultant,title,'Текст статьи, который появится после рецензирования.');
    assert.equal((await listApprovedArticles()).length,0);
    assert.equal((await listForReview('article')).length,1);
    assert.equal((await listPublicWall()).length,0);
    assert.equal((await reviewSubmission('article',submission.id,'approved'))?.status,'approved');
    const approved = await listApprovedArticles();
    assert.equal(approved.length,1);
    assert.equal('authorId' in approved[0],false);
    const converted = toDemoArticles(approved);
    assert.equal(getDemoList(new URLSearchParams('q=новая'),converted).total,1);
    assert.equal(getDemoArticle(converted[0].slug, converted)?.body,submission.body);
    assert.equal(await reviewSubmission('article',submission.id,'rejected'),null);
    const wall=await createSubmission('wall',me,'','Текст анонимного сообщения');
    await reviewSubmission('wall',wall.id,'approved');
    assert.equal((await listPublicWall()).length,1);
    assert.equal('authorId' in (await listPublicWall())[0],false);
    const second=await createSubmission('article', consultant, 'Отклонённая статья', 'Текст, который не появится в каталоге');
    await reviewSubmission('article',second.id,'rejected');
    assert.equal((await listApprovedArticles()).length,1);
  } finally {process.chdir(original);await rm(temporary,{recursive:true,force:true});}
});
