import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { CurrentUser } from '../model/types';
import { DEMO_USERS } from '../model/demo-accounts.ts';
import { surnameFirst } from '../../education/lib/author.ts';

export type Kind = 'wall' | 'article';
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';
export interface DemoSubmission {
  id: string;
  kind: Kind;
  title?: string;
  body: string;
  authorId: string; // Never sent to the public wall.
  authorName?: string; // Public display name for approved articles; not exposed on wall.
  status: SubmissionStatus;
  createdAt: string;
}
const file = () => path.join(process.cwd(), '.demo-data', 'submissions.json');
let queue: Promise<unknown> = Promise.resolve();
async function readAll(): Promise<DemoSubmission[]> {
  try {
    const value: unknown = JSON.parse(await readFile(file(), 'utf8'));
    if (!Array.isArray(value)) throw new Error('Invalid demo content');
    return value as DemoSubmission[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}
async function persist(items: DemoSubmission[]): Promise<void> {
  await mkdir(path.dirname(file()), { recursive: true });
  const temporary = `${file()}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(items, null, 2), { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, file());
}
function serialize<T>(action: () => Promise<T>): Promise<T> {
  const next = queue.then(action, action);
  queue = next.then(() => undefined, () => undefined);
  return next;
}
export async function listPublicWall(): Promise<Array<Pick<DemoSubmission, 'id' | 'body' | 'createdAt'>>> {
  const posts = (await readAll()).filter(x => x.kind === 'wall' && x.status === 'approved');
  return posts.map(({ id, body, createdAt }) => ({ id, body, createdAt }));
}
/** Published demo articles, never exposing their authors' account identifiers. */
export async function listApprovedArticles(): Promise<Array<Pick<DemoSubmission, 'id' | 'title' | 'body' | 'authorName'>>> {
  return (await readAll())
    .filter(item => item.kind === 'article' && item.status === 'approved')
    .map(({ id, title, body, authorName, authorId }) => ({
      id, title, body,
      authorName: authorName ?? surnameFirst(DEMO_USERS.find(user => user.id === authorId)?.displayName ?? ''),
    }));
}

/** Only the author can see their own drafts, publication history and rejected articles. */
export async function listOwnArticles(user: CurrentUser): Promise<DemoSubmission[]> {
  return (await readAll()).filter(item => item.kind === 'article' && item.authorId === user.id);
}

/** Editing an approved article withdraws it from the public catalog until re-approval. */
export function reviseOwnArticle(user: CurrentUser, id: string, title: string, body: string): Promise<DemoSubmission | null> {
  return serialize(async () => {
    const all = await readAll();
    const article = all.find(item => item.id === id && item.kind === 'article' && item.authorId === user.id);
    if (!article) return null;
    article.title = title;
    article.body = body;
    article.status = 'pending';
    article.authorName = surnameFirst(user.displayName);
    await persist(all);
    return article;
  });
}

/** A submitted article is removable by its owner, regardless of review status. */
export function deleteOwnArticle(user: CurrentUser, id: string): Promise<boolean> {
  return serialize(async () => {
    const all = await readAll();
    const index = all.findIndex(item => item.id === id && item.kind === 'article' && item.authorId === user.id);
    if (index === -1) return false;
    all.splice(index, 1);
    await persist(all);
    return true;
  });
}

export async function listForReview(kind: Kind): Promise<DemoSubmission[]> {
  return (await readAll()).filter(x => x.kind === kind && x.status === 'pending');
}
export function createSubmission(kind: Kind, user: CurrentUser, title: string, body: string): Promise<DemoSubmission> {
  return serialize(async () => {
    const item: DemoSubmission = {
      id: randomUUID(), kind, authorId: user.id,
      authorName: kind === 'article' ? surnameFirst(user.displayName) : undefined,
      title: kind === 'article' ? title : undefined, body,
      status: 'pending', createdAt: new Date().toISOString(),
    };
    const all = await readAll();
    all.unshift(item);
    await persist(all);
    return item;
  });
}
export function reviewSubmission(kind: Kind, id: string, status: 'approved' | 'rejected'): Promise<DemoSubmission | null> {
  return serialize(async () => {
    const all = await readAll();
    const item = all.find(x => x.id === id && x.kind === kind && x.status === 'pending');
    if (!item) return null;
    item.status = status;
    await persist(all);
    return item;
  });
}
