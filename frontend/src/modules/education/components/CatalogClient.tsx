'use client';

import { useEffect, useState } from 'react';
import { getCatalog, getFilters } from '../lib/api';
import type { CatalogFilters as Filters, FilterOptions, MaterialPreview } from '../model/types';
import { CatalogFilters } from './CatalogFilters';
import { MaterialCard } from './MaterialCard';
import { CatalogLoading, CatalogEmpty, CatalogError } from './CatalogStates';

const initial: Filters = { q: '', category: null, tags: [], type: 'article' };

type Result<T> =
  | { status: 'loading' | 'error' }
  | { status: 'ready'; data: T };

export function CatalogClient() {
  const [filters, setFilters] = useState(initial);
  const [options, setOptions] = useState<Result<FilterOptions>>({ status: 'loading' });
  const [materials, setMaterials] = useState<Result<MaterialPreview[]>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    getFilters(signal)
      .then((data) => {
        if (!signal.aborted) setOptions({ status: 'ready', data });
      })
      .catch(() => {
        if (!signal.aborted) setOptions({ status: 'error' });
      });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const timer = window.setTimeout(() => {
      getCatalog(filters, signal)
        .then((data) => {
          if (!signal.aborted) setMaterials({ status: 'ready', data });
        })
        .catch(() => {
          if (!signal.aborted) setMaterials({ status: 'error' });
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [filters, attempt]);

  const changeFilters = (next: Filters) => {
    if (next === filters) return;
    setMaterials({ status: 'loading' });
    setFilters(next);
  };
  const reset = () => changeFilters(initial);
  const retry = () => {
    setOptions({ status: 'loading' });
    setMaterials({ status: 'loading' });
    setAttempt((value) => value + 1);
  };
  const hasError = options.status === 'error' || materials.status === 'error';

  return (
    <>
      {options.status === 'ready' && (
        <CatalogFilters filters={filters} options={options.data} onChange={changeFilters} onReset={reset} />
      )}

      {hasError ? (
        <CatalogError onRetry={retry} />
      ) : options.status !== 'ready' || materials.status !== 'ready' ? (
        <CatalogLoading />
      ) : (
        <>
          <div className="catalogResultMeta" aria-live="polite">
            {materials.data.length === 1
              ? 'Найден 1 материал'
              : `Найдено материалов: ${materials.data.length}`}
          </div>
          {materials.data.length === 0 ? (
            <CatalogEmpty onReset={reset} />
          ) : (
            <div className="materialsGrid">
              {materials.data.map((material) => (
                <MaterialCard key={material.slug} material={material} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
