'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { RoleGate } from './RoleGate';
import { useAuth } from './AuthProvider';
import { Pagination, PAGE_SIZES, usePaginatedItems } from '@/modules/ui/pagination/Pagination';

type MyArticle = Readonly<{
  id: string;
  title?: string;
  body: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
}>;
const LABELS: Record<MyArticle['status'], string> = {
  pending: 'На проверке', approved: 'Опубликована', rejected: 'Отклонена',
};

export function MyArticles({ refreshKey }: { refreshKey: number }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [items, setItems] = useState<MyArticle[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const paged = usePaginatedItems(items, PAGE_SIZES.staff, userId ?? '');
  const load = useCallback(async (signal?: AbortSignal) => {
    setState('loading');
    try {
      const response = await fetch('/api/demo-content/article?view=mine', { cache: 'no-store', credentials: 'same-origin', signal });
      if (!response.ok) throw new Error('unavailable');
      const data: { items: MyArticle[] } = await response.json();
      if (!signal?.aborted) { setItems(data.items); setLoadedFor(userId); setState('ready'); }
    } catch { if (!signal?.aborted) setState('error'); }
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refreshKey, userId]);

  const edit = (article: MyArticle) => {
    setEditing(article.id); setConfirming(null); setTitle(article.title ?? ''); setBody(article.body);
    setAccepted(false); setError(''); setNotice('');
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || !accepted || title.trim().length < 1 || body.trim().length < 1 || busy) {
      setError('Проверьте текст и подтвердите отправку на проверку.'); return;
    }
    setBusy(editing); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/demo-content/article/${encodeURIComponent(editing)}`, {
        method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      if (!response.ok) throw new Error(response.status === 404 ? 'Статья не найдена или недоступна.' : 'Не удалось отправить изменения.');
      setItems(current => current.map(article => article.id === editing
        ? { ...article, title: title.trim(), body: body.trim(), status: 'pending' } : article));
      setEditing(null); setNotice('Изменения отправлены на проверку. До одобрения статья не отображается в каталоге.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Ошибка при сохранении.'); }
    finally { setBusy(null); }
  };
  const remove = async (id: string) => {
    setBusy(id); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/demo-content/article/${encodeURIComponent(id)}`, {
        method: 'DELETE', credentials: 'same-origin',
      });
      if (!response.ok) throw new Error(response.status === 404 ? 'Статья не найдена или уже удалена.' : 'Не удалось удалить статью.');
      setItems(current => current.filter(article => article.id !== id));
      setConfirming(null); if (editing === id) setEditing(null);
      setNotice('Статья удалена.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Ошибка при удалении.'); }
    finally { setBusy(null); }
  };
  return <RoleGate role="consultant">
    <section id="my-articles" className="staffPage myArticles" aria-labelledby="own-articles-title">
      <div className="staffActions myArticlesHeading">
        <h2 id="own-articles-title">Мои статьи</h2>
        <button type="button" className="uiButtonSecondary" disabled={busy !== null} onClick={() => void load()}>Обновить список</button>
      </div>
      <p className="staffHint">Вы можете редактировать и удалять свои статьи. Изменённая статья повторно направляется на рецензирование.</p>
      {notice && <p role="status" className="meetingNotice">{notice}</p>}
      {error && <p role="alert" className="staffError">{error}</p>}
      {(state === 'loading' || loadedFor !== userId) && <p role="status">Загружаем статьи…</p>}
      {state === 'error' && userId !== null && <p role="alert">Не удалось загрузить статьи. <button type="button" onClick={() => void load()}>Повторить</button></p>}
      {state === 'ready' && loadedFor === userId && (items.length === 0 ? <p className="staffNotice">Вы ещё не отправляли статьи.</p> :
        <div className="staffFeed">{paged.pageItems.map(article => <article className="staffCard" key={article.id}>
          <h3>{article.title}</h3>
          <p className="staffHint">{LABELS[article.status]} · {new Date(article.createdAt).toLocaleDateString('ru-RU')}</p>
          {editing === article.id ? <form className="staffForm" onSubmit={event => void submit(event)}>
            <label htmlFor={`edit-title-${article.id}`}>Название статьи</label>
            <input id={`edit-title-${article.id}`} value={title} onChange={event => setTitle(event.target.value)} minLength={1} maxLength={160} required />
            <label htmlFor={`edit-body-${article.id}`}>Текст статьи</label>
            <textarea id={`edit-body-${article.id}`} value={body} onChange={event => setBody(event.target.value)} minLength={1} maxLength={5000} rows={8} required />
            <small>{body.trim().length}/5000 символов</small>
            <label className="staffCheckbox"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} /><span>Отправить изменённую статью на повторное рецензирование</span></label>
            <div className="staffActions">
              <button className="uiButton" type="submit" disabled={busy !== null || !accepted || title.trim().length < 1 || body.trim().length < 1 || title.trim().length > 160}>Отправить на проверку</button>
              <button className="uiButtonSecondary" type="button" disabled={busy !== null} onClick={() => setEditing(null)}>Отмена</button>
            </div>
          </form> : <>
            <p className="staffPreserveLines myArticleExcerpt">{article.body.slice(0, 250)}{article.body.length > 250 ? '…' : ''}</p>
            <div className="staffActions">
              {article.status === 'approved' && <Link className="uiButtonSecondary" href={`/psychoeducation/article-${article.id}`}>Открыть</Link>}
              <button type="button" className="uiButtonSecondary" disabled={busy !== null} onClick={() => edit(article)}>Изменить</button>
              <button type="button" className="uiButtonSecondary" disabled={busy !== null} onClick={() => { setConfirming(article.id); setError(''); }}>Удалить</button>
            </div>
          </>}
          {confirming === article.id && <div className="myArticleDeleteConfirm">
            <p>Удалить статью «{article.title}» без возможности восстановления?</p>
            <div className="staffActions">
              <button type="button" className="uiButton" disabled={busy !== null} onClick={() => void remove(article.id)}>{busy === article.id ? 'Удаляем…' : 'Да, удалить'}</button>
              <button type="button" className="uiButtonSecondary" disabled={busy !== null} onClick={() => setConfirming(null)}>Отмена</button>
            </div>
          </div>}
        </article>)}</div>)}
      {state === 'ready' && loadedFor === userId && <Pagination {...paged} onPageChange={paged.setPage} label="мои статьи" />}
    </section>
  </RoleGate>;
}
