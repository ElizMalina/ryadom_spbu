'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { hasRole } from '@/modules/auth/model/types';
import { useAuth } from '@/modules/auth/components/AuthProvider';
import { EventCard } from './EventCard';
import { Pagination, PAGE_SIZES, usePaginatedItems } from '@/modules/ui/pagination/Pagination';
import { searchMeetings, searchStudents, sortMeetings,
  type EventUser, type StaffMeeting, type StudentMeeting } from '../model/types';

function StaffEvents({ userId }: { userId: string }) {
  const [meetings, setMeetings] = useState<StaffMeeting[]>([]);
  const [students, setStudents] = useState<EventUser[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [q, setQ] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [address, setAddress] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setState('loading');
    try {
      const [eventsResponse, studentsResponse] = await Promise.all([
        fetch('/api/demo-events?scope=created', { cache: 'no-store', signal }),
        fetch('/api/demo-events/students', { cache: 'no-store', signal }),
      ]);
      if (!eventsResponse.ok || !studentsResponse.ok) throw new Error('Не удалось загрузить встречи или студентов.');
      const [eventsData, studentsData]: [{ events: StaffMeeting[] }, { students: EventUser[] }] = await Promise.all([
        eventsResponse.json(), studentsResponse.json(),
      ]);
      if (!signal?.aborted) {
        setMeetings(sortMeetings(eventsData.events));
        setStudents(studentsData.students);
        setState('ready');
      }
    } catch { if (!signal?.aborted) setState('error'); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, userId]);

  const visibleMeetings = useMemo(() => searchMeetings(meetings, q), [meetings, q]);
  const foundStudents = useMemo(() => searchStudents(students, studentQuery), [students, studentQuery]);
  const pagedMeetings = usePaginatedItems(visibleMeetings, PAGE_SIZES.staff, q);
  const pagedStudents = usePaginatedItems(foundStudents, PAGE_SIZES.students, studentQuery);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected.length) { setNotice('Выберите хотя бы одного студента.'); return; }
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/demo-events', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, date, time, address, studentIds: selected }),
      });
      if (!response.ok) {
        const body: { error?: string } = await response.json().catch(() => ({}));
        throw new Error(body.error === 'past_meeting' ? 'Укажите будущие дату и время по Москве.'
          : body.error === 'invalid_students' ? 'Выбранный пользователь больше не имеет роль студента.'
          : 'Проверьте заполнение полей и попробуйте ещё раз.');
      }
      const result: { event: StaffMeeting } = await response.json();
      setMeetings(current => sortMeetings([...current, result.event]));
      setTitle(''); setDate(''); setTime(''); setAddress(''); setSelected([]); setStudentQuery('');
      setShowForm(false);
      setNotice('Встреча создана. Студенты увидят её в своих напоминаниях.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Не удалось создать встречу.'); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    setRemovingId(id); setNotice('');
    try {
      const response = await fetch(`/api/demo-events/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!response.ok) throw new Error('Не удалось удалить встречу. Обновите список и попробуйте ещё раз.');
      setMeetings(current => current.filter(meeting => meeting.id !== id));
      setNotice('Встреча удалена у всех участников.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Ошибка удаления.'); }
    finally { setRemovingId(null); }
  };

  return <div className="meetingLayout">
    <div className="meetingToolbar"><h2>Мои встречи</h2>
      <button type="button" className="uiButton" onClick={() => setShowForm(v => !v)}>
        {showForm ? 'Закрыть форму' : 'Добавить событие'}
      </button>
    </div>
    <p className="staffHint">Показаны только события, созданные вами. Время встреч — московское (СПбГУ).</p>
    {notice && <p className="meetingNotice" role="status">{notice}</p>}
    {showForm && <form onSubmit={e => void submit(e)} className="meetingForm staffCard">
      <h2>Новая встреча</h2>
      <label htmlFor="meeting-title">Заголовок встречи</label>
      <input required minLength={1} maxLength={160} id="meeting-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Например, консультация по адаптации" />
      <div className="meetingFormTwo">
        <div><label htmlFor="meeting-date">Дата</label><input required type="date" id="meeting-date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><label htmlFor="meeting-time">Время (МСК)</label><input required type="time" id="meeting-time" value={time} onChange={e => setTime(e.target.value)} /></div>
      </div>
      <label htmlFor="meeting-address">Адрес встречи</label>
      <input required minLength={1} maxLength={300} id="meeting-address" value={address} onChange={e => setAddress(e.target.value)} placeholder="Адрес, аудитория или ссылка на онлайн-встречу" />
      <fieldset className="meetingStudents">
        <legend>Участники — студенты ({selected.length} выбрано)</legend>
        <label htmlFor="student-search">Поиск по ФИ или логину</label>
        <input id="student-search" type="search" value={studentQuery} onChange={e => setStudentQuery(e.target.value)} placeholder="Имя, фамилия или student.demo" autoComplete="off" />
        {state === 'loading' && <p role="status">Загружаем список студентов…</p>}
        {state === 'error' && <p role="alert">Не удалось получить список студентов.</p>}
        {state === 'ready' && <div className="meetingStudentsList">
          {foundStudents.length === 0 && <p>Студенты не найдены.</p>}
          {pagedStudents.pageItems.map(student => <label className="meetingStudent" key={student.id}>
            <input type="checkbox" checked={selected.includes(student.id)} onChange={e =>
              setSelected(current => e.target.checked ? [...current, student.id] : current.filter(id => id !== student.id))
            } />
            <span><strong>{student.displayName}</strong><small>{student.username}</small></span>
          </label>)}
        </div>}
        {state === 'ready' && <Pagination {...pagedStudents} onPageChange={pagedStudents.setPage} label="выбор студентов" />}
      </fieldset>
      <button className="uiButton meetingSave" type="submit" disabled={busy || state !== 'ready' || !selected.length}>
        {busy ? 'Сохраняем…' : 'Назначить встречу'}
      </button>
    </form>}
    <label className="meetingSearchLabel" htmlFor="events-search">Поиск по событиям</label>
    <input className="meetingSearch" id="events-search" type="search" value={q} onChange={e => setQ(e.target.value)}
      placeholder="Название, дата, время, адрес, ФИ или логин участников" />
    {state === 'loading' && <p role="status">Загружаем события…</p>}
    {state === 'error' && <div role="alert">Встречи временно недоступны. <button type="button" onClick={() => void load()}>Повторить</button></div>}
    {state === 'ready' && <>
      <p className="meetingCount">Найдено: {visibleMeetings.length}. Сортировка: по дате и времени, сначала ближайшие.</p>
      {visibleMeetings.length === 0 ? <p className="staffNotice">{q ? 'По запросу встречи не найдены.' : 'Вы ещё не создавали встречи.'}</p>
        : <div className="meetingList">{pagedMeetings.pageItems.map(event => <EventCard key={event.id} event={event} onRemove={id => void remove(id)} removeBusy={removingId !== null} />)}</div>}
      <Pagination {...pagedMeetings} onPageChange={pagedMeetings.setPage} label="созданные встречи" />
    </>}
  </div>;
}

function StudentEvents({ userId }: { userId: string }) {
  const [events, setEvents] = useState<StudentMeeting[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [q, setQ] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/demo-events?scope=assigned', { signal: controller.signal, cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error('unavailable'); return response.json() as Promise<{events: StudentMeeting[]}>; })
      .then(data => { if (!controller.signal.aborted) { setEvents(sortMeetings(data.events)); setStatus('ready'); } })
      .catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, [userId]);
  const visible = useMemo(() => searchMeetings(events, q), [events, q]);
  const paged = usePaginatedItems(visible, PAGE_SIZES.staff, q);
  const remove = async (id: string) => {
    setRemovingId(id); setNotice('');
    try {
      const response = await fetch(`/api/demo-events/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!response.ok) throw new Error('Не удалось отменить участие во встрече.');
      setEvents(current => current.filter(event => event.id !== id));
      setNotice('Ваше участие отменено. Остальные участники сохраняют свои записи.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Ошибка отмены.'); }
    finally { setRemovingId(null); }
  };
  return <div className="meetingLayout">
    <h2>Мои встречи</h2><p className="staffHint">Здесь только напоминания о встречах, на которые вас записал специалист. Время московское.</p>
    {notice && <p role="status" className="meetingNotice">{notice}</p>}
    <label className="meetingSearchLabel" htmlFor="assigned-events-search">Поиск по названию, дате, времени и адресу</label>
    <input className="meetingSearch" id="assigned-events-search" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Найти встречу" />
    {status === 'loading' && <p role="status">Загружаем напоминания…</p>}
    {status === 'error' && <p role="alert">Не удалось загрузить встречи.</p>}
    {status === 'ready' && <>
      <p className="meetingCount">Найдено: {visible.length}. По дате и времени — хронологически.</p>
      {visible.length === 0 ? <p className="staffNotice">{q ? 'Ничего не найдено.' : 'Вам пока не назначены встречи.'}</p>
        : <div className="meetingList">{paged.pageItems.map(event => <EventCard key={event.id} event={event} onRemove={id => void remove(id)} removeBusy={removingId !== null} removeLabel="Отменить участие" />)}</div>}
      <Pagination {...paged} onPageChange={paged.setPage} label="назначенные встречи" />
    </>}
  </div>;
}

export function EventsClient() {
  const { user, status } = useAuth();
  if (status === 'loading') return <p role="status">Проверяем доступ…</p>;
  if (status === 'error') return <p role="alert">Не удалось проверить авторизацию.</p>;
  if (!user) return <div className="staffNotice"><p>Войдите, чтобы увидеть назначенные встречи.</p>
    <Link className="uiButton" href="/auth/sso?returnTo=%2Fevents">Войти через СПбГУ</Link></div>;
  if (hasRole(user, 'psychologist') || hasRole(user, 'consultant')) return <StaffEvents key={user.id} userId={user.id} />;
  if (hasRole(user, 'student')) return <StudentEvents key={user.id} userId={user.id} />;
  return <p className="staffNotice">Для просмотра встреч необходима роль студента, психолога или консультанта.</p>;
}
