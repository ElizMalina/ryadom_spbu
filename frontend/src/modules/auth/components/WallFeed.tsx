'use client';
import { useCallback, useEffect, useState } from 'react';
import { Pagination, PAGE_SIZES, usePaginatedItems } from '@/modules/ui/pagination/Pagination';

type PublicPost = { id: string; body: string; createdAt: string };
export function WallFeed() {
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const paged = usePaginatedItems(posts, PAGE_SIZES.staff);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/demo-content/wall', { cache: 'no-store', signal });
      if (!response.ok) throw new Error('unavailable');
      const json: { items: PublicPost[] } = await response.json();
      if (!signal?.aborted) { setPosts(json.items); setState('ready'); }
    } catch { if (!signal?.aborted) setState('error'); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  if (state === 'loading') return <p role="status">Загружаем записи…</p>;
  if (state === 'error') return <p role="alert">Публикации временно недоступны. <button type="button" onClick={() => { setState('loading'); void load(); }}>Повторить</button></p>;
  if (!posts.length) return <div className="staffCard"><h2>Пока нет опубликованных записей</h2><p>После проверки модератором новые записи появятся здесь. Читать их можно без входа.</p></div>;
  return <><div className="staffFeed">{paged.pageItems.map(post => <article className="staffCard" key={post.id}><small>Анонимно · {new Date(post.createdAt).toLocaleDateString('ru-RU')}</small><p className="staffPreserveLines">{post.body}</p></article>)}</div><Pagination {...paged} onPageChange={paged.setPage} label="публикации Накопилось" /></>;
}
