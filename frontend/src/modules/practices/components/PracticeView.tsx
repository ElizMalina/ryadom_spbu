import Link from 'next/link';
import { practiceKindLabels } from '@/modules/practices/lib/kinds';
import type { Practice } from '@/modules/practices/model/types';

export function PracticeView({ practice }: { practice: Practice }) {
  const beforeStart = practice.beforeStart?.trim();
  const important = practice.important?.trim();
  // Keep author-entered precautions from practices created before the new fields existed.
  const legacyBoundaries = practice.boundaries ?? [];
  const hasBeforeStart = Boolean(beforeStart) || legacyBoundaries.length > 0;

  return (
    <article className="practiceDetail">
      <Link className="backLink" href="/practices">← Все практики</Link>

      <header className="practiceDetailHeader">
        <p className="eyebrow">{practiceKindLabels[practice.kind]}</p>
        <h1>{practice.title}</h1>
        <p className="practiceLead">{practice.summary}</p>
        <div className="practiceDetailMeta">
          <span>{practice.durationEstimated ? '≈ ' : ''}{practice.durationMinutes} мин</span>
        </div>
      </header>

      {hasBeforeStart && (
        <section className="practiceBoundaryNote" aria-labelledby="practice-boundaries">
          <h2 id="practice-boundaries">Перед началом</h2>
          {beforeStart ? (
            <p style={{ whiteSpace: 'pre-wrap' }}>{beforeStart}</p>
          ) : (
            <ul>{legacyBoundaries.map((boundary, index) => <li key={index}>{boundary}</li>)}</ul>
          )}
        </section>
      )}

      <section className="practiceSteps" aria-labelledby="practice-steps">
        <h2 id="practice-steps">Как выполнить</h2>
        <ol reversed={practice.slug === 'grounding-5-4-3-2-1'} start={practice.slug === 'grounding-5-4-3-2-1' ? 5 : undefined}>{practice.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
      </section>

      {important && (
        <div className="practiceClosingNote">
          <strong>Важно</strong>
          <p style={{ whiteSpace: 'pre-wrap' }}>{important}</p>
        </div>
      )}
    </article>
  );
}
