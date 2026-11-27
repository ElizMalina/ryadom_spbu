'use client';
import { useState } from 'react';
import { formatEventDate, type MeetingView } from '../model/types';

export function EventCard({ event, onRemove, removeBusy = false, removeLabel = 'Удалить встречу' }: {
  event: MeetingView;
  onRemove?: (id: string) => void;
  removeBusy?: boolean;
  removeLabel?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [, , day] = event.date.split('-');
  const monthName = new Intl.DateTimeFormat('ru-RU', { month: 'short', timeZone: 'UTC' })
    .format(new Date(`${event.date}T12:00:00Z`)).replace('.', '');
  return <article className="meetingCard">
    <div className="meetingDateBadge" aria-label={formatEventDate(event.date)}>
      <strong>{day}</strong><span>{monthName}</span>
    </div>
    <div className="meetingCardContent">
      <h3>{event.title}</h3>
      <p className="meetingDetails"><time dateTime={`${event.date}T${event.time}`}>{event.time} · {formatEventDate(event.date)}</time></p>
      <p className="meetingDetails">{event.address}</p>
      {'participants' in event && <p className="meetingAttendees">
        <strong>Участники:</strong> {event.participants.map(p => `${p.displayName} (${p.username})`).join(', ') || 'Нет участников'}
      </p>}
      {onRemove && <div className="meetingCardActions">
        {!confirming ? <button type="button" className="uiButtonSecondary" disabled={removeBusy} onClick={() => setConfirming(true)}>{removeLabel}</button>
          : <div className="meetingRemoveConfirm">
            <p>{removeLabel === 'Удалить встречу' ? 'Удалить встречу для всех участников?' : 'Отменить ваше участие в этой встрече?'}</p>
            <div className="staffActions">
              <button type="button" className="uiButton" disabled={removeBusy} onClick={() => onRemove(event.id)}>{removeBusy ? 'Удаляем…' : 'Подтвердить'}</button>
              <button type="button" className="uiButtonSecondary" disabled={removeBusy} onClick={() => setConfirming(false)}>Отмена</button>
            </div>
          </div>}
      </div>}
    </div>
  </article>;
}
