import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Practice, PracticeKind } from '../model/types';
import { practiceKindLabels } from '../lib/kinds';

export type PracticeStatus = 'pending' | 'approved' | 'rejected';
export type PracticeDraft = Omit<Practice, 'slug'>;
export interface StoredPractice { id: string; authorId: string; status: PracticeStatus; createdAt: string; practice: Practice; }
const filename = () => path.join(process.cwd(), '.demo-data', 'practices.json');
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(action: () => Promise<T>): Promise<T> {
  const next = queue.then(action, action);
  queue = next.then(() => undefined, () => undefined);
  return next;
}
async function readAll(): Promise<StoredPractice[]> {
  try {
    const value: unknown = JSON.parse(await readFile(filename(), 'utf8'));
    if (!Array.isArray(value)) throw new Error('Invalid demo practices store');
    return value as StoredPractice[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}
async function persist(items: StoredPractice[]): Promise<void> {
  await mkdir(path.dirname(filename()), { recursive: true });
  const temporary = `${filename()}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(items, null, 2), { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, filename());
}
function trimmed(value: unknown, min: number, max: number): string | null {
  if (typeof value !== 'string') return null;
  const result = value.trim();
  return result.length >= min && result.length <= max ? result : null;
}
function stringList(value: unknown, minItems: number, maxItems: number, maxLength: number): string[] | null {
  if (!Array.isArray(value) || value.length < minItems || value.length > maxItems) return null;
  const lines = value.map(item => trimmed(item, 1, maxLength));
  if (lines.some(item => item === null)) return null;
  return lines as string[];
}
function optionalAuthorText(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length <= maxLength ? text : null;
}
/** Shared validation is used by the API; clients cannot bypass draft constraints. */
export function parsePracticeDraft(value: unknown): PracticeDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  if (typeof o.kind !== 'string' || !Object.prototype.hasOwnProperty.call(practiceKindLabels, o.kind)) return null;
  const kind = o.kind as PracticeKind;
  const title = trimmed(o.title, 1, 120);
  const summary = trimmed(o.summary, 1, 600);
  const durationMinutes = o.durationMinutes;
  const tags = stringList(o.tags, 0, 8, 32);
  const steps = stringList(o.steps, 1, 16, 600);
  // Empty sections are allowed: the reader page simply omits them.
  // Legacy precautions are still supported for previously created practices.
  const boundaries = stringList(o.boundaries ?? [], 0, 8, 600);
  const beforeStart = optionalAuthorText(o.beforeStart, 2000);
  const important = optionalAuthorText(o.important, 2000);
  if (!title || !summary || typeof durationMinutes !== 'number' || !Number.isInteger(durationMinutes) ||
      durationMinutes < 1 || durationMinutes > 60 || !tags || !steps || !boundaries ||
      beforeStart === null || important === null) return null;
  return { kind, title, summary, durationMinutes, tags: Array.from(new Set(tags)), steps, boundaries,
    ...(beforeStart ? { beforeStart } : {}), ...(important ? { important } : {}) };
}
export async function listPublishedPractices(): Promise<Practice[]> {
  return (await readAll()).filter(p => p.status === 'approved').map(p => p.practice);
}
export async function getPublishedPractice(slug: string): Promise<Practice | null> {
  const result = (await readAll()).find(p => p.practice.slug === slug && p.status === 'approved');
  return result?.practice ?? null;
}
export async function listPendingPractices(): Promise<StoredPractice[]> {
  return (await readAll()).filter(p => p.status === 'pending');
}
export function submitPractice(authorId: string, draft: PracticeDraft): Promise<StoredPractice> {
  return serialize(async () => {
    const id = randomUUID();
    const record: StoredPractice = { id, authorId, status: 'pending', createdAt: new Date().toISOString(),
      practice: { slug: `custom-${id}`, ...draft } };
    const all = await readAll();
    all.unshift(record);
    await persist(all);
    return record;
  });
}
export function decidePractice(id: string, status: 'approved' | 'rejected'): Promise<StoredPractice | null> {
  return serialize(async () => {
    const all = await readAll();
    const record = all.find(p => p.id === id && p.status === 'pending');
    if (!record) return null;
    record.status = status;
    await persist(all);
    return record;
  });
}
