import type { CurrentUser } from './types';

/** Search matches visible full name or login; multiple words may appear in any order. */
export function normalizeRoleSearch(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').trim();
}

export function filterUsersByNameOrLogin<T extends Pick<CurrentUser, 'displayName' | 'username'>>(
  users: readonly T[],
  query: string,
): T[] {
  const terms = normalizeRoleSearch(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [...users];
  return users.filter(user => {
    const searchable = normalizeRoleSearch(`${user.displayName} ${user.username}`);
    return terms.every(term => searchable.includes(term));
  });
}
