#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const frontend = path.resolve(__dirname, '..');
const requireLocal = createRequire(path.join(frontend, 'package.json'));
let ts;
try { ts = requireLocal('typescript'); }
catch { console.error('Run npm install in frontend before tests.'); process.exit(2); }
const source = p => fs.readFileSync(path.join(frontend, p), 'utf8');
function execute(p, stub) {
  const code = ts.transpileModule(source(p), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const exports = {};
  const module = { exports };
  Function('require', 'module', 'exports', code)(name => stub?.[name] ?? require(name), module, exports);
  return module.exports;
}
(async () => {
  const roles = execute('src/modules/auth/model/types.ts');
  assert.equal(roles.isUserRole('psychologist'), true);
  assert.equal(roles.ROLE_LABELS.psychologist, 'Психолог');
  const lib = execute('src/modules/events/model/types.ts');
  assert.equal(lib.isCalendarDate('2028-02-29'), true);
  assert.equal(lib.isCalendarDate('2027-02-29'), false);
  assert.equal(lib.isClockTime('23:59'), true);
  assert.equal(lib.isClockTime('24:00'), false);
  assert.ok(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(lib.nowInSpbuTimeZone()));
  const student1 = { id: 's1', username: 'student.demo', displayName: 'Алёна Студент' };
  const student2 = { id: 's2', username: 'ivanova.demo', displayName: 'Софья Иванова' };
  const staff = { id: 'p1', username: 'psychologist.demo', displayName: 'Ольга Психолог' };
  const example = (id, date, time) => ({ id, date, time, title: 'Рабочая встреча', address: 'Большая улица 12',
    organizer: staff, participants: [student1, student2], createdAt: '' });
  const events = [example('late', '2030-02-07', '15:30'), example('early', '2030-01-07', '09:00')];
  assert.deepEqual(lib.sortMeetings(events).map(x => x.id), ['early', 'late']);
  assert.deepEqual(lib.searchMeetings(events, 'Ольга 07.02.2030').map(x => x.id), ['late']);
  assert.deepEqual(lib.searchMeetings(events, 'ИВАНОВА 15:30').map(x => x.id), ['late']);
  assert.deepEqual(lib.searchMeetings(events, 'Большая встреча').length, 2);
  assert.deepEqual(lib.searchStudents([student1, student2], 'иванова Софья').map(x => x.id), ['s2']);
  assert.deepEqual(lib.searchStudents([student1, student2], 'алена').map(x => x.id), ['s1']);

  const accounts = [
    { ...staff, roles: ['psychologist'] },
    { id: 'c1', username: 'consultant.demo', displayName: 'Мария Консультант', roles: ['consultant'] },
    { ...student1, roles: ['student'] }, { ...student2, roles: ['student'] },
    { id: 'a1', username: 'admin.demo', displayName: 'Администратор', roles: ['admin'] },
  ];
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ryadom-meeting-test-'));
  const original = process.cwd();
  try {
    process.chdir(work);
    const service = execute('src/modules/events/server/demo-events.ts', {
      '@/modules/auth/model/types': roles,
      '@/modules/auth/server/demo-auth': { listDemoUsers: async () => accounts },
      '../model/types': lib,
    });
    assert.equal(service.canManageMeetings(accounts[0]), true);
    assert.equal(service.canManageMeetings(accounts[1]), true);
    assert.equal(service.canManageMeetings(accounts[2]), false);
    assert.equal((await service.listAvailableStudents(accounts[0])).length, 2);
    await assert.rejects(service.createMeeting(accounts[2], {}));
    await assert.rejects(service.createMeeting(accounts[0], { title: 'Bad', date: '2030-01-01', time: '09:00', address: 'A', studentIds: ['a1'] }), /invalid_students/);
    const first = await service.createMeeting(accounts[0], { title: 'Консультация', date: '2030-01-01', time: '09:00', address: 'СПбГУ, аудитория 5', studentIds: ['s1', 's2'] });
    assert.equal(first.participants.length, 2);
    const second = await service.createMeeting(accounts[1], { title: 'Другой консультант', date: '2030-01-02', time: '11:00', address: 'Онлайн', studentIds: ['s2'] });
    assert.ok(second.id);
    assert.equal((await service.listCreatedMeetings(accounts[0])).length, 1, 'specialist sees only own meetings');
    assert.equal((await service.listCreatedMeetings(accounts[1])).length, 1, 'consultant sees only own meetings');
    const s1Meetings = await service.listAssignedMeetings(accounts[2]);
    const s2Meetings = await service.listAssignedMeetings(accounts[3]);
    assert.equal(s1Meetings.length, 1);
    assert.equal(s2Meetings.length, 2);
    assert.equal('participants' in s1Meetings[0], false, 'student must not learn other attendees');
    assert.equal('studentIds' in s1Meetings[0], false, 'student IDs must not leak');
    assert.equal(s2Meetings[0].date, '2030-01-01', 'student dates chronological');
    await assert.rejects(service.listCreatedMeetings(accounts[2]));
    await assert.rejects(service.listAssignedMeetings(accounts[0]));
    // Meeting deletion must be enforced on the server; an attendee can only
    // withdraw themselves, while the creator can remove the entire meeting.
    assert.equal(await service.removeMeetingForUser(accounts[4], first.id), null, 'admin may not delete a private meeting');
    assert.equal(await service.removeMeetingForUser(accounts[1], first.id), null, 'a different specialist cannot delete it');
    assert.equal(await service.removeMeetingForUser(accounts[2], second.id), null, 'unassigned student has no access');
    assert.equal(await service.removeMeetingForUser(accounts[2], first.id), 'unassigned');
    assert.equal((await service.listAssignedMeetings(accounts[2])).length, 0, 'removed from this student only');
    assert.equal((await service.listAssignedMeetings(accounts[3])).length, 2, 'other student schedule intact');
    assert.deepEqual((await service.listCreatedMeetings(accounts[0]))[0].participants.map(p => p.id), ['s2']);
    assert.equal(await service.removeMeetingForUser(accounts[2], first.id), null, 'cannot withdraw twice');
    assert.equal(await service.removeMeetingForUser(accounts[0], first.id), 'deleted');
    assert.equal((await service.listCreatedMeetings(accounts[0])).length, 0);
    assert.equal((await service.listAssignedMeetings(accounts[3])).length, 1, 'creator deletion removes remaining assignees');
    assert.equal(await service.removeMeetingForUser(accounts[0], first.id), null, 'cannot delete twice');
    assert.equal(await service.removeMeetingForUser(accounts[1], second.id), 'deleted');
    assert.equal((await service.listAssignedMeetings(accounts[3])).length, 0);
  } finally { process.chdir(original); fs.rmSync(work, { recursive: true, force: true }); }
  console.log('PASS: role, search, date/time, creation, ownership, and participant privacy checks');
})().catch(e => { console.error(e); process.exitCode = 1; });
