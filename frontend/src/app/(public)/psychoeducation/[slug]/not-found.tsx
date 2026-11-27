import Link from 'next/link';
import { PublicShell } from '@/modules/navigation/components/PublicShell';
import '../psychoeducation.css';

export default function NotFound() {
  return (
    <PublicShell activeHref="/psychoeducation" mainClassName="route-psychoeducation">
      <section className="uiCard" style={{ padding: 24 }}>
        <h1>Материал не найден</h1>
        <p>Возможно, он был удалён или ещё не опубликован.</p>
        <Link className="uiButton" href="/psychoeducation">Вернуться в каталог</Link>
      </section>
    </PublicShell>
  );
}
