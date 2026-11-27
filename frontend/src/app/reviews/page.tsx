import { PublicShell } from '@/modules/navigation/components/PublicShell';
import { ReviewQueue } from '@/modules/auth/components/ReviewQueue';
import { PracticeReviewQueue } from '@/modules/practices/components/PracticeReviewQueue';
export default function ReviewsPage() {
  return <PublicShell>
    <div className="staffPage">
      <p className="staffKicker">Служебный раздел</p><h1>Рецензирование материалов</h1>
      <p className="staffLead">Клинический рецензент проверяет статьи и практики перед публикацией.</p>
      <h2>Статьи на проверке</h2>
      <ReviewQueue kind="article" />
      <PracticeReviewQueue />
    </div>
  </PublicShell>;
}
