import { PublicShell } from '@/modules/navigation/components/PublicShell';
import { ReviewQueue } from '@/modules/auth/components/ReviewQueue';
export default function ModerationPage() { return <PublicShell><div className="staffPage"><p className="staffKicker">Служебный раздел</p><h1>Модерация «Накопилось»</h1><p className="staffLead">Публикации ожидают решения модератора.</p><ReviewQueue kind="wall" /></div></PublicShell>; }
