import { PublicShell } from '@/modules/navigation/components/PublicShell';
import { RoleLink } from '@/modules/auth/components/RoleLink';
import { WallFeed } from '@/modules/auth/components/WallFeed';
export default function WallPage() {
  return <PublicShell activeHref="/wall"><div className="staffPage">
    <p className="staffKicker">Доска поддержки</p><h1>Накопилось</h1>
    <p className="staffLead">Анонимное пространство, чтобы быть услышанным. Без комментариев, лайков и публичных профилей.</p>
    <div className="staffContextAction"><RoleLink role="student" href="/wall/create">Написать в «Накопилось»</RoleLink></div>
    <WallFeed />
    <div className="staffHint">Публикации проходят модерацию. Не указывайте персональные данные.</div>
  </div></PublicShell>;
}
