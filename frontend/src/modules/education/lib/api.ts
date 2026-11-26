import type { CatalogFilters, FilterOptions, MaterialDetail, MaterialPreview } from '../model/types';

const materialsPath = '/api/v1/psychoeducation/materials';

export async function getCatalog(filters: CatalogFilters, signal: AbortSignal) {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.category) params.set('category', filters.category);
  if (filters.type) params.set('type', filters.type);
  for (const tag of filters.tags) params.append('tags', tag);

  const response = await fetch(`${materialsPath}?${params}`, { signal });
  if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
  return (await response.json() as { items: MaterialPreview[] }).items;
}

export async function getFilters(signal: AbortSignal): Promise<FilterOptions> {
  const response = await fetch('/api/v1/psychoeducation/filters', { signal });
  if (!response.ok) throw new Error(`Filters request failed: ${response.status}`);
  return response.json();
}

export async function getArticle(slug: string): Promise<MaterialDetail | null> {
  const origin = process.env.BACKEND_ORIGIN || 'http://localhost:8080';
  const url = new URL(`${materialsPath}/${encodeURIComponent(slug)}`, origin);
  const response = await fetch(url, { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Article request failed: ${response.status}`);
  return response.json();
}
