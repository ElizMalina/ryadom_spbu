import { PublicShell } from '@/modules/navigation/components/PublicShell';
import { CatalogLoading } from '@/modules/education/components/CatalogStates';
import '../psychoeducation.css';

export default function Loading() {
  return (
    <PublicShell activeHref="/psychoeducation" mainClassName="route-psychoeducation">
      <section aria-label="Загружаем материал">
        <h1>Загружаем материал</h1>
        <CatalogLoading />
      </section>
    </PublicShell>
  );
}
