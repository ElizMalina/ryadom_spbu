import { PublicShell } from '@/modules/navigation/components/PublicShell';
import { Suspense } from 'react';
import { PracticeCatalogClient } from '@/modules/practices/components/PracticeCatalogClient';
import { PracticeCatalogLoading } from '@/modules/practices/components/PracticeCatalogStates';
import { PracticeCreateAction } from '@/modules/auth/components/RoleLink';
import './practices.css';

export default function PracticesPage() {
  return (
    <PublicShell activeHref="/practices" mainClassName="route-practices">
      <div className="catalogTitleRow">
        <section className="catalogHero">
          <p className="eyebrow">Практики</p>
          <h1>Небольшие действия, которые можно попробовать сейчас</h1>
          <p>Дыхание, заземление, работа со стрессом, осознанность и короткие чек-листы.</p>
        </section>
        <PracticeCreateAction />
      </div>
      <Suspense fallback={<PracticeCatalogLoading />}>
        <PracticeCatalogClient />
      </Suspense>
    </PublicShell>
  );
}
