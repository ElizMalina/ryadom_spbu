import Link from 'next/link';
import type { ReactNode } from 'react';
import { PublicShell } from '@/modules/navigation/components/PublicShell';
import { scenarioGroups, scenarios, type ScenarioId } from '../model/scenarios';

export function UiStatesShell({ children, activeScenario }: Readonly<{ children: ReactNode; activeScenario: ScenarioId }>) {
  return (
    <PublicShell mainClassName="route-ui-states">
      <div className="ux-container">
        <div className="ux-workspace">
          <nav className="ux-scenarios" aria-label="Демонстрационные сценарии">
            <div className="ux-scenarios-top"><strong>Сценарии</strong><span>{scenarios.length}</span></div>
            {scenarioGroups.map(group => (
              <div key={group} className="ux-scenario-group">
                <div className="ux-scenario-category">{group}</div>
                {scenarios.filter(s => s.category === group).map(s => (
                  <Link key={s.id} href={`/ui-states/${s.id}`}
                    aria-current={activeScenario === s.id ? 'page' : undefined}
                    className={`ux-scenario-link ${activeScenario === s.id ? 'ux-scenario-active' : ''}`}>
                    {s.title}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="ux-content">{children}</div>
        </div>
      </div>
    </PublicShell>
  );
}
