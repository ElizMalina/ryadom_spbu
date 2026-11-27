/** Local demo meetings. Times are entered and displayed in the university time zone (Europe/Moscow). */
export const EVENT_TIME_ZONE = 'Europe/Moscow';

export type EventUser = Readonly<{ id: string; username: string; displayName: string }>;

export type MeetingBase = Readonly<{
  id: string;
  title: string;
  date: string; // YYYY-MM-DD, SPb local calendar date
  time: string; // HH:mm, SPb local time
  address: string;
  organizer: EventUser;
  createdAt: string;
}>;

/** Only a creator can receive the participant list. */
export type StaffMeeting = MeetingBase & Readonly<{ participants: EventUser[] }>;
/** Student responses intentionally omit other participants. */
export type StudentMeeting = MeetingBase;
export type MeetingView = StudentMeeting | StaffMeeting;

export type CreateMeetingInput = Readonly<{
  title: string;
  date: string;
  time: string;
  address: string;
  studentIds: string[];
}>;

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 2020 || year > 2100) return false;
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
}

export function isClockTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function meetingSortKey(meeting: Pick<MeetingBase, 'date' | 'time'>): string {
  return `${meeting.date}T${meeting.time}`;
}

export function sortMeetings<T extends Pick<MeetingBase, 'date' | 'time' | 'id'>>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => meetingSortKey(a).localeCompare(meetingSortKey(b)) || a.id.localeCompare(b.id));
}

export function nowInSpbuTimeZone(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: EVENT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

export const normalizeSearch = (text: string): string => text
  .normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export function formatEventDate(date: string): string {
  if (!isCalendarDate(date)) return date;
  const [year, month, day] = date.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export function searchMeetings<T extends MeetingView>(meetings: readonly T[], query: string): T[] {
  const terms = normalizeSearch(query).split(' ').filter(Boolean);
  if (!terms.length) return [...meetings];
  return meetings.filter(meeting => {
    const dateParts = meeting.date.split('-');
    const participantFields = 'participants' in meeting
      ? meeting.participants.flatMap(p => [p.displayName, p.username]) : [];
    const haystack = normalizeSearch([
      meeting.title, meeting.address, meeting.date, meeting.time,
      formatEventDate(meeting.date), `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}`,
      meeting.organizer.displayName, meeting.organizer.username,
      ...participantFields,
    ].join(' '));
    return terms.every(term => haystack.includes(term));
  });
}

export function searchStudents(students: readonly EventUser[], query: string): EventUser[] {
  const terms = normalizeSearch(query).split(' ').filter(Boolean);
  return students.filter(student => {
    const fields = normalizeSearch(`${student.displayName} ${student.username}`);
    return terms.every(term => fields.includes(term));
  });
}
