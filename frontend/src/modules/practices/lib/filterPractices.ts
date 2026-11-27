import { practiceKindLabels } from './kinds';
import type { Practice, PracticeKind } from '../model/types';

export function filterPractices(
  items: Practice[], query: string, selectedKind: PracticeKind | null,
  selectedTags: string[] = [],
): Practice[] {
  const terms = query.normalize('NFKC').trim().toLocaleLowerCase('ru').replaceAll('ё', 'е').split(/\s+/).filter(Boolean);
  return items.filter(practice => {
    if (selectedKind && practice.kind !== selectedKind) return false;
    if (selectedTags.some(tag => !practice.tags.includes(tag))) return false;
    const searchable = [practice.title, practice.summary, practiceKindLabels[practice.kind],
      ...practice.tags, ...practice.steps, ...(practice.boundaries ?? []),
      practice.beforeStart ?? '', practice.important ?? ''].join(' ')
      .normalize('NFKC').toLocaleLowerCase('ru').replaceAll('ё', 'е');
    return terms.every(term => searchable.includes(term));
  });
}
