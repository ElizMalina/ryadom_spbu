import { PsychoeducationCreateAction } from '@/modules/auth/components/RoleLink';
import { PublicShell } from '@/modules/navigation/components/PublicShell';
import { Suspense } from 'react';
import { CatalogClient } from '@/modules/education/components/CatalogClient';
import { CatalogLoading } from '@/modules/education/components/CatalogStates';
import './psychoeducation.css';

export default function Page() {
  return (
    <PublicShell activeHref="/psychoeducation" mainClassName="route-psychoeducation">
      <div className="catalogTitleRow">
        <section className="catalogHero">
          <p className="eyebrow">Психопросвет</p>
          <h1>Материалы, которые помогают разобраться</h1>
          <p>Проверенные статьи о тревоге, стрессе, учёбе, отношениях и самопомощи.</p>
        </section>
        <PsychoeducationCreateAction />
      </div>
      <Suspense fallback={<CatalogLoading />}>
        <CatalogClient />
      </Suspense>
    </PublicShell>
  );
}
