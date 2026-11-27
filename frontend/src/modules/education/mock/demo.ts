/**
 * Демо-статьи для локальной проверки интерфейса. Не используются в production.
 * Активируются только в development при PSYCHO_API_MODE=demo.
 */
import type { FilterOptions, MaterialDetail } from '../model/types';
import { generatedCoverUrl } from '../lib/generated-cover.ts';
import { bundledArticles } from './bundled-articles.ts';

export const isPsychoDemoEnabled = (): boolean =>
  process.env.NODE_ENV === 'development' && process.env.PSYCHO_API_MODE === 'demo';

const articles: readonly MaterialDetail[] = bundledArticles;

type ApprovedArticle = Readonly<{ id: string; title?: string; body: string; authorName?: string }>;

/** Map reviewed submissions to ordinary catalog articles. */
export function toDemoArticles(submissions: readonly ApprovedArticle[]): MaterialDetail[] {
  return submissions.map(({ id, title, body, authorName }) => ({
    slug: `article-${id}`,
    title: title ?? '',
    summary: body.replace(/\s+/g, ' ').trim().slice(0, 200),
    body,
    imageUrl: generatedCoverUrl({
      title: title ?? '',
      summary: body.replace(/\s+/g, ' ').trim().slice(0, 200),
      category: { slug: 'user-articles', name: 'Авторские статьи' },
    }),
    type: 'article',
    durationMinutes: Math.max(1, Math.ceil(body.length / 900)),
    contentWarning: null,
    category: { slug: 'user-articles', name: 'Авторские статьи' },
    tags: [],
    author: authorName,
    sources: [],
  }));
}

export function getDemoArticle(slug: string, extra: readonly MaterialDetail[] = []): MaterialDetail | null {
  return [...articles, ...extra].find((article) => article.slug === slug) ?? null;
}

export function getDemoFilters(extra: readonly MaterialDetail[] = []): FilterOptions {
  const categories = new Map<string, MaterialDetail['category']>();
  const tags = new Map<string, MaterialDetail['tags'][number]>();
  for (const article of [...articles, ...extra]) {
    categories.set(article.category.slug, article.category);
    for (const tag of article.tags) tags.set(tag.slug, tag);
  }
  return { types: ['article'], categories: [...categories.values()], tags: [...tags.values()] };
}

export function getDemoList(params: URLSearchParams, extra: readonly MaterialDetail[] = []) {
  const query = (params.get('q') ?? '').trim().toLocaleLowerCase('ru');
  const category = params.get('category');
  const type = params.get('type');
  const tags = params.getAll('tags');
  const filtered = [...articles, ...extra].filter((article) =>
    (!type || article.type === type) &&
    (!category || article.category.slug === category) &&
    tags.every((tag) => article.tags.some((item) => item.slug === tag)) &&
    (!query || `${article.title} ${article.summary}`.toLocaleLowerCase('ru').includes(query))
  );
  // В каталоге body/sources не передаются.
  const items = filtered.map(({ body: _body, sources: _sources, ...preview }) => preview);
  return { items, total: filtered.length };
}
