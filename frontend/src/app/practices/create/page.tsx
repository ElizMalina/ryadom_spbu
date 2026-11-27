import { PublicShell } from '@/modules/navigation/components/PublicShell';
import { PracticeCreateForm } from '@/modules/practices/components/PracticeCreateForm';
import '@/app/(public)/practices/practices.css';

export default function CreatePracticePage() {
  return <PublicShell activeHref="/practices" mainClassName="route-practices">
    <div className="staffPage">
      <p className="staffKicker">Практики</p><h1>Добавить практику</h1>
      <p className="staffLead">Опишите небольшое упражнение для самопомощи. Перед публикацией материал проверит клинический рецензент.</p>
      <PracticeCreateForm />
    </div>
  </PublicShell>;
}
