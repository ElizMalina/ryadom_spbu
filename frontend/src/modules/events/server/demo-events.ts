import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hasRole, type CurrentUser } from '@/modules/auth/model/types';
import { listDemoUsers } from '@/modules/auth/server/demo-auth';
import {
  isCalendarDate, isClockTime, nowInSpbuTimeZone, sortMeetings,
  type CreateMeetingInput, type EventUser, type StaffMeeting, type StudentMeeting,
} from '../model/types';

type StoredMeeting = CreateMeetingInput & Readonly<{
  id: string;
  creatorId: string;
  createdAt: string;
}>;
const storagePath = () => path.join(process.cwd(), '.demo-data', 'events.json');
let mutationQueue: Promise<unknown> = Promise.resolve();

export const canManageMeetings = (user: CurrentUser | null): boolean =>
  hasRole(user, 'psychologist') || hasRole(user, 'consultant');

function publicUser(user: CurrentUser): EventUser {
  return { id: user.id, username: user.username, displayName: user.displayName };
}

async function readAll(): Promise<StoredMeeting[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(storagePath(), 'utf8'));
    if (!Array.isArray(parsed)) throw new Error('invalid_events_store');
    return parsed as StoredMeeting[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function persist(items: StoredMeeting[]): Promise<void> {
  await mkdir(path.dirname(storagePath()), { recursive: true });
  const tmp = `${storagePath()}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(items, null, 2), { mode: 0o600, encoding: 'utf8' });
  await rename(tmp, storagePath());
}

/** A specialist only sees meetings they created, never all meetings globally. */
export async function listCreatedMeetings(user: CurrentUser): Promise<StaffMeeting[]> {
  if (!canManageMeetings(user)) throw new Error('forbidden');
  const accounts = await listDemoUsers();
  const byId = new Map(accounts.map(a => [a.id, a]));
  return sortMeetings((await readAll()).filter(m => m.creatorId === user.id).map(meeting => ({
    id: meeting.id, title: meeting.title, date: meeting.date, time: meeting.time,
    address: meeting.address, createdAt: meeting.createdAt,
    organizer: publicUser(user),
    participants: meeting.studentIds.map(id => byId.get(id)).filter((a): a is CurrentUser => Boolean(a)).map(publicUser),
  })));
}

/** Do not include participants: a student cannot learn other attendees' identities. */
export async function listAssignedMeetings(user: CurrentUser): Promise<StudentMeeting[]> {
  if (!hasRole(user, 'student')) throw new Error('forbidden');
  const accounts = await listDemoUsers();
  const byId = new Map(accounts.map(a => [a.id, a]));
  return sortMeetings((await readAll()).filter(m => m.studentIds.includes(user.id)).map(meeting => {
    const organizer = byId.get(meeting.creatorId);
    return {
      id: meeting.id, title: meeting.title, date: meeting.date, time: meeting.time,
      address: meeting.address, createdAt: meeting.createdAt,
      organizer: organizer ? publicUser(organizer) : { id: meeting.creatorId, displayName: 'Специалист', username: '' },
    };
  }));
}

/** Only specialists can access the student directory (demo users only). */
export async function listAvailableStudents(user: CurrentUser): Promise<EventUser[]> {
  if (!canManageMeetings(user)) throw new Error('forbidden');
  const accounts = await listDemoUsers();
  return accounts.filter(u => hasRole(u, 'student')).map(publicUser)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru'));
}

export class MeetingInputError extends Error {}

export async function createMeeting(user: CurrentUser, data: unknown): Promise<StaffMeeting> {
  if (!canManageMeetings(user)) throw new Error('forbidden');
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new MeetingInputError('invalid_request');
  const raw = data as Record<string, unknown>;
  if (typeof raw.title !== 'string' || typeof raw.address !== 'string' ||
      typeof raw.date !== 'string' || typeof raw.time !== 'string' || !Array.isArray(raw.studentIds)) {
    throw new MeetingInputError('invalid_fields');
  }
  const title = raw.title.trim();
  const address = raw.address.trim();
  const date = raw.date;
  const time = raw.time;
  const ids = raw.studentIds;
  if (!title || title.length > 160 || !address || address.length > 300 ||
      !isCalendarDate(date) || !isClockTime(time) || ids.length === 0 || ids.length > 100 ||
      ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) {
    throw new MeetingInputError('invalid_fields');
  }
  if (`${date}T${time}` < nowInSpbuTimeZone()) {
    throw new MeetingInputError('past_meeting');
  }
  return enqueue(async () => {
    // Re-check active student roles inside the write lock: role changes may invalidate selection.
    const accounts = await listDemoUsers();
    const validStudentIds = new Set(accounts.filter(u => hasRole(u, 'student')).map(u => u.id));
    if (!ids.every(id => validStudentIds.has(id as string))) throw new MeetingInputError('invalid_students');
    const meeting: StoredMeeting = {
      id: randomUUID(), creatorId: user.id, createdAt: new Date().toISOString(),
      title, date, time, address, studentIds: ids as string[],
    };
    const existing = await readAll();
    await persist([...existing, meeting]);
    const participants = accounts.filter(u => meeting.studentIds.includes(u.id)).map(publicUser);
    return {
      id: meeting.id, title, date, time, address, createdAt: meeting.createdAt,
      organizer: publicUser(user), participants,
    };
  });
}

/** Only creator may remove an entire meeting. A student may withdraw only their own assignment. */
export function removeMeetingForUser(user: CurrentUser, id: string): Promise<'deleted' | 'unassigned' | null> {
  return enqueue(async () => {
    const all = await readAll();
    const index = all.findIndex(meeting => meeting.id === id);
    if (index === -1) return null;
    const meeting = all[index];
    if (meeting.creatorId === user.id && canManageMeetings(user)) {
      all.splice(index, 1);
      await persist(all);
      return 'deleted';
    }
    if (hasRole(user, 'student') && meeting.studentIds.includes(user.id)) {
      all[index] = { ...meeting, studentIds: meeting.studentIds.filter(studentId => studentId !== user.id) };
      await persist(all);
      return 'unassigned';
    }
    // Hide existence of other people's meetings from unauthorized users.
    return null;
  });
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const task = mutationQueue.then(fn, fn);
  mutationQueue = task.then(() => undefined, () => undefined);
  return task;
}
