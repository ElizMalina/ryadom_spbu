'use client';
import { useCallback, useEffect, useState } from 'react';
import { RoleGate } from './RoleGate';
import { Pagination, PAGE_SIZES, usePaginatedItems } from '@/modules/ui/pagination/Pagination';

type Kind = 'wall' | 'article';
type Item = { id: string; title?: string; body: string; createdAt: string };
export function ReviewQueue({ kind }: { kind: Kind }) {
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const paged = usePaginatedItems(items, PAGE_SIZES.staff, kind);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/demo-content/${kind}?view=queue`, { cache: 'no-store', signal });
      if (!response.ok) throw new Error('queue_unavailable');
      const data: { items: Item[] } = await response.json();
      if (!signal?.aborted) { setItems(data.items); setStatus('ready'); }
    } catch { if (!signal?.aborted) setStatus('error'); }
  }, [kind]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const decide = async (id: string, decision: 'approved' | 'rejected') => {
    setBusy(id); setError('');
    try {
      const response = await fetch(`/api/demo-content/${kind}/${encodeURIComponent(id)}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: decision }) });
      if (!response.ok) throw new Error('Не удалось сохранить решение.');
      setItems(current => current.filter(item => item.id !== id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Ошибка.'); }
    finally { setBusy(null); }
  };
  return <RoleGate role={kind === 'wall' ? 'moderator' : 'reviewer'}>
    {status === 'loading' && <p role="status">Загружаем очередь…</p>}
    {status === 'error' && <div role="alert">Не удалось загрузить очередь. <button type="button" onClick={() => { setStatus('loading'); void load(); }}>Повторить</button></div>}
    {error && <p role="alert" className="staffError">{error}</p>}
    {status === 'ready' && (items.length ? <div className="staffFeed">{paged.pageItems.map(item => <article key={item.id} className="staffCard">
      {item.title && <h2>{item.title}</h2>}
      <small>На проверке · {new Date(item.createdAt).toLocaleDateString('ru-RU')}</small>
      <p className="staffPreserveLines">{item.body}</p>
      <div className="staffActions">
        <button type="button" className="uiButton" disabled={busy !== null} onClick={() => void decide(item.id, 'approved')}>Одобрить</button>
        <button type="button" className="uiButtonSecondary" disabled={busy !== null} onClick={() => void decide(item.id, 'rejected')}>Отклонить</button>
      </div>
    </article>)}</div> : <div className="staffCard"><h2>Очередь пуста</h2><p>Новых материалов на проверку пока нет.</p></div>)}
    {status === 'ready' && <Pagination {...paged} onPageChange={paged.setPage} label={kind === 'wall' ? 'очередь записей' : 'очередь статей'} />}
  </RoleGate>;
}
