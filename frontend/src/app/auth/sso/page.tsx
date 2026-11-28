import { MockSsoForm } from '@/modules/auth/components/MockSsoForm';
import { safeReturnTo } from '@/modules/auth/model/types';
import { demoEnabled } from '@/modules/auth/server/demo-auth';
export default async function SsoPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const query = await searchParams;
  return <MockSsoForm returnTo={safeReturnTo(query.returnTo)} demoMode={demoEnabled()} />;
}
