'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { RoleGate } from '@/modules/auth/components/RoleGate';
import { practiceKindLabels } from '../lib/kinds';
import type { PracticeKind } from '../model/types';

const kinds = Object.entries(practiceKindLabels) as [PracticeKind, string][];
const lines = (value: string) => value.split('\n').map(s => s.trim()).filter(Boolean);

export function PracticeCreateForm() {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [kind, setKind] = useState<PracticeKind>('breathing');
  const [duration, setDuration] = useState(5);
  const [tags, setTags] = useState('');
  const [steps, setSteps] = useState('');
  const [beforeStart, setBeforeStart] = useState('');
  const [important, setImportant] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const stepsList = lines(steps);
  const tagsList = tags.split(',').map(s => s.trim()).filter(Boolean);
  const valid = title.trim().length >= 1 && title.trim().length <= 120 &&
    summary.trim().length >= 1 && summary.trim().length <= 600 &&
    Number.isInteger(duration) && duration >= 1 && duration <= 60 &&
    stepsList.length >= 1 && stepsList.length <= 16 && stepsList.every(s => s.length <= 600) &&
    beforeStart.trim().length <= 2000 && important.trim().length <= 2000 &&
    tagsList.length <= 8 && tagsList.every(s => s.length <= 32);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/demo-practices', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          title: title.trim(), summary: summary.trim(), kind, durationMinutes: duration,
          tags: tagsList, steps: stepsList, boundaries: [],
          beforeStart: beforeStart.trim(), important: important.trim(),
        }) });
      if (!response.ok) throw new Error(response.status === 403 ? 'Недостаточно прав.' : 'Не удалось отправить практику.');
      setSent(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Ошибка отправки.'); }
    finally { setBusy(false); }
  }
  return <RoleGate role="consultant">
    {sent ? <div className="staffCard" role="status">
      <h2>Практика отправлена на рецензирование</h2>
      <p>После одобрения она появится в каталоге практик.</p>
      <Link className="uiButton" href="/practices">Вернуться к практикам</Link>
    </div> : <form className="staffCard staffForm practiceCreateForm" onSubmit={e => void submit(e)}>
      <label htmlFor="practice-title">Название</label>
      <input id="practice-title" value={title} onChange={e => setTitle(e.target.value)} required minLength={1} maxLength={120}/>
      <label htmlFor="practice-summary">Краткое описание</label>
      <textarea id="practice-summary" value={summary} onChange={e => setSummary(e.target.value)} rows={3} minLength={1} maxLength={600} required />
      <label htmlFor="practice-kind">Тип практики</label>
      <select id="practice-kind" value={kind} onChange={e => setKind(e.target.value as PracticeKind)}>
        {kinds.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>
      <label htmlFor="practice-duration">Продолжительность, минут</label>
      <input id="practice-duration" type="number" min={1} max={60} required value={duration}
        onChange={e => setDuration(e.target.value === '' ? 0 : Number(e.target.value))}/>
      <label htmlFor="practice-tags">Теги через запятую (не более 8)</label>
      <input id="practice-tags" value={tags} onChange={e => setTags(e.target.value)} placeholder="Тревога, отдых, учёба" minLength={1}/>
      <label htmlFor="practice-steps">Шаги выполнения (один шаг на строку)</label>
      <textarea id="practice-steps" value={steps} onChange={e => setSteps(e.target.value)} rows={7} minLength={1} required
        placeholder={'Сядьте удобно\nОбратите внимание на дыхание\nВернитесь к обычным делам'} />
      <label htmlFor="practice-before-start">Перед началом (текст автора, необязательно)</label>
      <textarea id="practice-before-start" value={beforeStart} onChange={e => setBeforeStart(e.target.value)}
        rows={5} maxLength={2000} minLength={1} />
      <label htmlFor="practice-important">Важно (текст автора, необязательно)</label>
      <textarea id="practice-important" value={important} onChange={e => setImportant(e.target.value)}
        rows={5} maxLength={2000} minLength={1} />
      {error && <p className="staffError" role="alert">{error}</p>}
      <button className="uiButton" type="submit" disabled={!valid || busy}>{busy ? 'Отправляем…' : 'Отправить на рецензирование'}</button>
    </form>}
  </RoleGate>;
}
