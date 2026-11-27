'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { RoleGate } from './RoleGate';

type SubmissionType = 'wall' | 'article';
export function SubmissionForm({ kind, onSubmitted }: { kind: SubmissionType; onSubmitted?: () => void }) {
  const isWall = kind === 'wall';
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const valid = body.trim().length >= 1 && body.trim().length <= 5000 && (isWall || (title.trim().length >= 1 && title.trim().length <= 160));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid || !accepted || busy) { setError('Проверьте текст и отметьте согласие на отправку.'); return; }
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/demo-content/${kind}`, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      });
      if (!response.ok) throw new Error(response.status === 403 ? 'Недостаточно прав для отправки.' : 'Не удалось отправить текст.');
      setSent(true);
      onSubmitted?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Ошибка отправки.'); }
    finally { setBusy(false); }
  };
  return (
    <RoleGate role={isWall ? 'student' : 'consultant'}>
      {sent ? <div className="staffCard" role="status"><h2>Отправлено на проверку</h2><p>{isWall ? 'Публикация появится на доске только после одобрения модератором. Автор публично не отображается.' : 'Статья направлена на рецензирование и пока не опубликована.'}</p><Link className="uiButton" href={isWall ? '/wall' : '/psychoeducation'}>Вернуться в раздел</Link></div> :
      <form className="staffCard staffForm" onSubmit={event => void submit(event)} noValidate>
        {!isWall && <><label htmlFor="submission-title">Название статьи</label><input id="submission-title" value={title} onChange={event => setTitle(event.target.value)} minLength={1} maxLength={160} required aria-describedby="submission-title-help"/><small id="submission-title-help">От 1 до 160 символов</small></>}
        <label htmlFor="submission-body">{isWall ? 'Что вы хотите оставить здесь?' : 'Текст статьи'}</label>
        <textarea id="submission-body" value={body} onChange={event => setBody(event.target.value)} minLength={1} maxLength={5000} required rows={9} placeholder={isWall ? 'Расскажите о том, что вас беспокоит, без личных данных…' : 'Напишите материал для последующей проверки…'} />
        <small>{body.trim().length}/5000 символов; минимум 1</small>
        <label className="staffCheckbox"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)}/><span>{isWall ? 'Согласен отправить запись на премодерацию. Публикация будет анонимной для читателей.' : 'Согласен передать статью на клиническое рецензирование.'}</span></label>
        <p className="staffHint">Не указывайте имена, номера телефонов или другие персональные данные.</p>
        {error && <p className="staffError" role="alert">{error}</p>}
        <button type="submit" className="uiButton" disabled={busy || !valid || !accepted}>{busy ? 'Отправляем…' : (isWall ? 'Отправить на модерацию' : 'Отправить на рецензирование')}</button>
      </form>}
    </RoleGate>
  );
}
