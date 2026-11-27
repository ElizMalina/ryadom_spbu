import Link from 'next/link';
import { PublicShell } from '@/modules/navigation/components/PublicShell';
export default function NotFound() {
  return <PublicShell mainClassName="route-not-found">
    <section className="uiCard" style={{ padding: 24 }}>
      <h1>Страница не найдена</h1><p>Возможно, ссылка устарела.</p>
      <Link className="uiButton" href="/">На главную</Link>
    </section>
  </PublicShell>;
}
