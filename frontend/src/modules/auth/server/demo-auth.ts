import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cookies } from 'next/headers';
import { isUserRole, type CurrentUser, type UserRole } from '../model/types';
import { DEMO_USERS } from '../model/demo-accounts';

export const DEMO_COOKIE_NAME = 'ryadom_demo_sso';
export const DEMO_TTL_SECONDS = 60 * 60 * 8;
const DEMO_PASSWORD = 'Demo12345!';
const DEMO_SECRET = process.env.DEMO_AUTH_SECRET || 'ryadom-local-dev-only-not-for-production';
const DEFAULT_ROLES: Readonly<Record<string, readonly UserRole[]>> = {
  'student.demo': ['student'],
  'consultant.demo': ['consultant'],
  'psychologist.demo': ['psychologist'],
  'student2.demo': ['student'],
  'student3.demo': ['student'],
  'moderator.demo': ['moderator'],
  'reviewer.demo': ['reviewer'],
  'admin.demo': ['admin'],
};

type RoleMap = Record<string, UserRole[]>;
const storeFile = () => path.join(process.cwd(), '.demo-data', 'roles.json');
export const demoEnabled = () => process.env.NODE_ENV === 'development';

async function readRoles(): Promise<RoleMap> {
  try {
    const text = await readFile(storeFile(), 'utf8');
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Bad roles data');
    const map: RoleMap = {};
    for (const [name, value] of Object.entries(parsed)) {
      if (Array.isArray(value) && value.length && value.every(isUserRole)) map[name] = value;
    }
    return map;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

function sign(payload: string): string {
  return createHmac('sha256', DEMO_SECRET).update(payload).digest('base64url');
}
export function createDemoSession(username: string): string {
  const payload = Buffer.from(JSON.stringify({ username, exp: Date.now() + DEMO_TTL_SECONDS * 1000 }), 'utf8').toString('base64url');
  return `${payload}.${sign(payload)}`;
}
function decodeSession(value: string): string | null {
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) return null;
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    const claim = parsed as { username?: unknown; exp?: unknown };
    if (typeof claim.username !== 'string' || typeof claim.exp !== 'number' || claim.exp <= Date.now()) return null;
    return claim.username;
  } catch { return null; }
}

async function resolveUser(username: string): Promise<CurrentUser | null> {
  const account = DEMO_USERS.find(user => user.username === username);
  if (!account) return null;
  const roles = await readRoles();
  return { ...account, roles: roles[username] ?? DEFAULT_ROLES[username] ?? ['student'] };
}

export async function getDemoUser(): Promise<CurrentUser | null> {
  if (!demoEnabled()) return null;
  const token = (await cookies()).get(DEMO_COOKIE_NAME)?.value;
  const username = token ? decodeSession(token) : null;
  return username ? resolveUser(username) : null;
}
export async function authenticateDemoUser(username: string, password: string): Promise<CurrentUser | null> {
  if (!demoEnabled() || password !== DEMO_PASSWORD) return null;
  return resolveUser(username.trim().toLowerCase());
}
export async function listDemoUsers(): Promise<CurrentUser[]> {
  if (!demoEnabled()) return [];
  return Promise.all(DEMO_USERS.map(user => resolveUser(user.username))).then(users => users.filter((u): u is CurrentUser => u !== null));
}
let roleWriteQueue: Promise<unknown> = Promise.resolve();
export function updateDemoRoles(username: string, nextRoles: readonly UserRole[]): Promise<CurrentUser> {
  const run = async (): Promise<CurrentUser> => {
    if (!demoEnabled() || username === 'admin.demo') throw new Error('role_change_forbidden');
    if (!DEMO_USERS.some(user => user.username === username) || !nextRoles.length || !nextRoles.every(isUserRole)) throw new Error('invalid_roles');
    const directory = path.dirname(storeFile());
    await mkdir(directory, { recursive: true });
    const roles = await readRoles();
    roles[username] = [...new Set(nextRoles)];
    const tmp = `${storeFile()}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(roles, null, 2), { encoding: 'utf8', mode: 0o600 });
    await rename(tmp, storeFile());
    const updated = await resolveUser(username);
    if (!updated) throw new Error('user_not_found');
    return updated;
  };
  const task = roleWriteQueue.then(run, run);
  roleWriteQueue = task.then(() => undefined, () => undefined);
  return task;
}
