/** Единый расчёт страниц для каталогов и пользовательских списков. */
export const PAGE_SIZES = { catalog: 6, staff: 6, students: 8 } as const;

export function paginate<T>(items: readonly T[], requestedPage: number, perPage: number) {
  const size = Number.isFinite(perPage) ? Math.max(1, Math.trunc(perPage)) : 1;
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const normalizedPage = Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 1;
  const page = Math.min(pageCount, Math.max(1, normalizedPage));
  const offset = (page - 1) * size;
  return {
    page, pageCount, perPage: size, total,
    from: total ? offset + 1 : 0,
    to: Math.min(offset + size, total),
    pageItems: items.slice(offset, offset + size),
  };
}

/** Показывает номера поблизости от текущей страницы, сохраняя первую и последнюю. */
export function paginationPages(page: number, pageCount: number): Array<number | 'ellipsis'> {
  if (pageCount <= 1) return [1];
  const current = Math.min(pageCount, Math.max(1, Math.trunc(page) || 1));
  const values = new Set([1, pageCount, current - 1, current, current + 1, 2, pageCount - 1]);
  const sorted = [...values].filter(value => value >= 1 && value <= pageCount).sort((a, b) => a - b);
  const pages: Array<number | 'ellipsis'> = [];
  for (const value of sorted) {
    const previous = pages.at(-1);
    if (typeof previous === 'number' && value - previous > 1) pages.push('ellipsis');
    pages.push(value);
  }
  return pages;
}
