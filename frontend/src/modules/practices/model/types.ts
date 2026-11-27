export type PracticeKind =
  | 'breathing'
  | 'grounding'
  | 'stress'
  | 'mindfulness'
  | 'checklist';

export type Practice = {
  slug: string;
  kind: PracticeKind;
  title: string;
  summary: string;
  durationMinutes: number;
  /** Оценка для материалов без длительности в исходном документе. */
  durationEstimated?: boolean;
  tags: string[];
  steps: string[];
  /** Legacy author-provided precautions. Kept for previously published practices. */
  boundaries: string[];
  /** Author's own text for the «Перед началом» section. */
  beforeStart?: string;
  /** Author's own text for the «Важно» section. */
  important?: string;
};
