'use client';
import { useCallback, useEffect, useState } from 'react';
import { RoleGate } from '@/modules/auth/components/RoleGate';
import { practiceKindLabels } from '../lib/kinds';
import type { Practice } from '../model/types';
import { Pagination, PAGE_SIZES, usePaginatedItems } from '@/modules/ui/pagination/Pagination';

type Item = { id: string; createdAt: string; practice: Practice };
export function PracticeReviewQueue() {
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const paged = usePaginatedItems(items, PAGE_SIZES.staff);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/demo-practices?view=queue', { cache: 'no-store', signal });
      if (!response.ok) throw new Error('queue_unavailable');
      const data: { items: Item[] } = await response.json();
      if (!signal?.aborted) { setItems(data.items); setStatus('ready'); }
    } catch { if (!signal?.aborted) setStatus('error'); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  async function decide(id: string, decision: 'approved' | 'rejected') {
    setBusy(id); setError('');
    try {
      const response = await fetch(`/api/demo-practices/${encodeURIComponent(id)}`, { method: 'PATCH',
        credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: decision }) });
      if (!response.ok) throw new Error('Не удалось сохранить решение.');
      setItems(current => current.filter(item => item.id !== id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Ошибка.'); }
    finally { setBusy(null); }
  }
  return <RoleGate role="reviewer">
    <h2>Практики на проверке</h2>
    {status === 'loading' && <p role="status">Загружаем практики…</p>}
    {status === 'error' && <div role="alert">Не удалось загрузить практики. <button type="button" onClick={() => { setStatus('loading'); void load(); }}>Повторить</button></div>}
    {error && <p className="staffError" role="alert">{error}</p>}
    {status === 'ready' && (items.length ? <div className="staffFeed">{paged.pageItems.map(({ id, practice, createdAt }) =>
      <article key={id} className="staffCard">
        <h3>{practice.title}</h3>
        <small>{practiceKindLabels[practice.kind]} · {practice.durationMinutes} мин · {new Date(createdAt).toLocaleDateString('ru-RU')}</small>
        <p>{practice.summary}</p>
        <strong>Шаги:</strong><ol>{practice.steps.map((step, i) => <li key={i}>{step}</li>)}</ol>
        {(practice.beforeStart?.trim() || practice.boundaries?.length) ? <>
          <strong>Перед началом:</strong>
          {practice.beforeStart?.trim()
            ? <p style={{ whiteSpace: 'pre-wrap' }}>{practice.beforeStart}</p>
            : <ul>{practice.boundaries.map((item, i) => <li key={i}>{item}</li>)}</ul>}
        </> : null}
        {practice.important?.trim() && <>
          <strong>Важно:</strong>
          <p style={{ whiteSpace: 'pre-wrap' }}>{practice.important}</p>
        </>}
        <div className="staffActions">
          <button type="button" className="uiButton" disabled={busy !== null} onClick={() => void decide(id, 'approved')}>Одобрить</button>
          <button type="button" className="uiButtonSecondary" disabled={busy !== null} onClick={() => void decide(id, 'rejected')}>Отклонить</button>
        </div>
      </article>)}</div> : <div className="staffCard"><h2>Очередь пуста</h2><p>Практик на рецензирование пока нет.</p></div>)}
    {status === 'ready' && <Pagination {...paged} onPageChange={paged.setPage} label="очередь практик" />}
  </RoleGate>;
}
