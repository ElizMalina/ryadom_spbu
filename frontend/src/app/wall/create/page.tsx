import { PublicShell } from '@/modules/navigation/components/PublicShell';
import { SubmissionForm } from '@/modules/auth/components/SubmissionForm';
export default function CreateWallPage() {
  return <PublicShell activeHref="/wall"><div className="staffPage"><p className="staffKicker">Накопилось</p><h1>Написать анонимную публикацию</h1><p className="staffLead">Публикация проходит предварительную проверку модератором.</p><SubmissionForm kind="wall" /></div></PublicShell>;
}
