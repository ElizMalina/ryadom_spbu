'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/modules/auth/components/AuthProvider';
import { hasRole } from '@/modules/auth/model/types';
import { EventCard } from './EventCard';
import { meetingSortKey, nowInSpbuTimeZone, sortMeetings, type StudentMeeting } from '../model/types';

/** Reminder only; no editing or attendee list for a student. */
export function StudentEventReminders() {
  const { user, status } = useAuth();
  const studentId = status === 'ready' && hasRole(user, 'student') ? user!.id : null;
  const [events, setEvents] = useState<StudentMeeting[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!studentId) return;
    const controller = new AbortController();
    void fetch('/api/demo-events?scope=assigned', { cache: 'no-store', signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error('unavailable'); return r.json() as Promise<{ events: StudentMeeting[] }>; })
      .then(data => { if (!controller.signal.aborted) { setEvents(sortMeetings(data.events)); setState('ready'); } })
      .catch(() => { if (!controller.signal.aborted) setState('error'); });
    return () => controller.abort();
  }, [studentId]);
  const upcoming = useMemo(() => events.filter(e => meetingSortKey(e) >= nowInSpbuTimeZone()).slice(0, 3), [events]);
  const remove = async (id: string) => {
    setRemovingId(id); setNotice('');
    try {
      const response = await fetch(`/api/demo-events/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!response.ok) throw new Error('Не удалось отменить участие во встрече.');
      setEvents(current => current.filter(event => event.id !== id));
      setNotice('Ваше участие во встрече отменено.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Ошибка отмены.'); }
    finally { setRemovingId(null); }
  };
  if (!studentId) return null;
  return <div className="meetingReminders">
    <div className="meetingRemindersTitle"><h3>Ваши ближайшие встречи</h3><Link href="/events">Все события</Link></div>
    {notice && <p className="meetingNotice" role="status">{notice}</p>}
    {state === 'loading' && <p role="status">Загружаем напоминания…</p>}
    {state === 'error' && <p role="alert">Напоминания временно недоступны.</p>}
    {state === 'ready' && (upcoming.length === 0 ? <p className="staffHint">Предстоящих встреч пока нет.</p>
      : <div className="meetingRemindersList">{upcoming.map(event => <EventCard key={event.id} event={event} onRemove={id => void remove(id)} removeBusy={removingId !== null} removeLabel="Отменить участие" />)}</div>)}
  </div>;
}
