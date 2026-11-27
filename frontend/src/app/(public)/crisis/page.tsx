import { PublicShell } from '@/modules/navigation/components/PublicShell';
import { CrisisScreen } from '@/modules/crisis/components/CrisisScreen';
import './crisis.css';

export default function CrisisPage() {
  return (
    <PublicShell activeHref="/crisis" mainClassName="route-crisis">
<CrisisScreen />
      </PublicShell>
  );
}
