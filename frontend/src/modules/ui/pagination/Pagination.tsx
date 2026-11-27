'use client';

import { useEffect, useState } from 'react';
import { paginate, paginationPages } from './model';

export { PAGE_SIZES } from './model';

/** Сбрасывает страницу при изменении фильтров; при удалении элементов страница ограничивается автоматически. */
export function usePaginatedItems<T>(items: readonly T[], perPage: number, resetKey = '') {
  const [requestedPage, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [resetKey]);
  return { ...paginate(items, requestedPage, perPage), setPage };
}

type Props = {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  onPageChange: (page: number) => void;
  label: string;
};

export function Pagination({ page, pageCount, total, from, to, onPageChange, label }: Props) {
  if (total === 0 || pageCount <= 1) return null;
  return <nav className="uiPagination" aria-label={`Страницы: ${label}`}>
    <p className="uiPaginationSummary">Показаны {from}–{to} из {total}</p>
    <div className="uiPaginationButtons">
      <button type="button" className="uiPaginationButton" disabled={page === 1} onClick={() => onPageChange(page - 1)} aria-label="Предыдущая страница">Назад</button>
      {paginationPages(page, pageCount).map((value, index) => value === 'ellipsis'
        ? <span className="uiPaginationDots" key={`gap-${index}`} aria-hidden="true">…</span>
        : <button type="button" key={value} className={`uiPaginationButton ${value === page ? 'isCurrent' : ''}`}
            aria-current={value === page ? 'page' : undefined}
            aria-label={`Страница ${value}`} onClick={() => onPageChange(value)}>{value}</button>)}
      <button type="button" className="uiPaginationButton" disabled={page === pageCount} onClick={() => onPageChange(page + 1)} aria-label="Следующая страница">Далее</button>
    </div>
  </nav>;
}
