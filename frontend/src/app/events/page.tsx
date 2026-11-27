import { PublicShell } from '@/modules/navigation/components/PublicShell';
import { EventsClient } from '@/modules/events/components/EventsClient';

export default function EventsPage() {
  return <PublicShell activeHref="/events">
    <div className="staffPage meetingPage">
      <p className="staffKicker">Встречи и события</p>
      <h1>События</h1>
      <p className="staffLead">Напоминания для студентов и планирование встреч для психологов и консультантов.</p>
      <EventsClient />
    </div>
  </PublicShell>;
}
