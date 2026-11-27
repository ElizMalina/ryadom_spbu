import { PublicShell } from '@/modules/navigation/components/PublicShell';
import { notFound } from 'next/navigation';
import { PracticeView } from '@/modules/practices/components/PracticeView';
import { practices } from '@/modules/practices/mock/practices';
import { demoEnabled } from '@/modules/auth/server/demo-auth';
import { getPublishedPractice } from '@/modules/practices/server/demo-practices';
import '../practices.css';

export const dynamic = 'force-dynamic';

export default async function PracticePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const practice = practices.find(item => item.slug === slug) ||
    (demoEnabled() ? await getPublishedPractice(slug) : null);
  if (!practice) notFound();
  return <PublicShell activeHref="/practices" mainClassName="route-practices">
    <PracticeView practice={practice} />
  </PublicShell>;
}
