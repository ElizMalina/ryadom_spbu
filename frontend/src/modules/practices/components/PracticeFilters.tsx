import { practiceKindLabels } from '@/modules/practices/lib/kinds';
import type { PracticeKind } from '@/modules/practices/model/types';

const kinds = Object.entries(practiceKindLabels) as [PracticeKind, string][];

type Props = {
  query: string;
  selectedKind: PracticeKind | null;
  selectedTags: string[];
  availableTags: string[];
  onQueryChange: (value: string) => void;
  onKindChange: (kind: PracticeKind | null) => void;
  onTagsChange: (tags: string[]) => void;
  onReset: () => void;
};

export function PracticeFilters({ query, selectedKind, selectedTags, availableTags,
  onQueryChange, onKindChange, onTagsChange, onReset }: Props) {
  const hasFilters = Boolean(query.trim() || selectedKind || selectedTags.length);
  const toggleTag = (tag: string) => onTagsChange(
    selectedTags.includes(tag) ? selectedTags.filter(item => item !== tag) : [...selectedTags, tag],
  );
  return (
    <section className="practiceControls" aria-label="Поиск и фильтры практик">
      <label className="searchField">
        <span className="searchIcon" aria-hidden="true">⌕</span>
        <span className="visuallyHidden">Поиск практик</span>
        <input value={query} onChange={event => onQueryChange(event.target.value)}
          placeholder="Поиск по названию, теме и описанию" type="search" />
      </label>
      <div className="filterGroup">
        <span className="filterLabel">Тип практики</span>
        <div className="filterScroller">
          <button type="button" className={`filterChip ${selectedKind === null ? 'isSelected' : ''}`}
            onClick={() => onKindChange(null)} aria-pressed={selectedKind === null}>Все</button>
          {kinds.map(([kind, label]) => <button type="button" key={kind}
            className={`filterChip ${selectedKind === kind ? 'isSelected' : ''}`}
            onClick={() => onKindChange(kind)} aria-pressed={selectedKind === kind}>{label}</button>)}
        </div>
      </div>
      <div className="filterGroup">
        <span className="filterLabel">Теги</span>
        <div className="filterScroller">
          <button type="button" className={`filterChip ${selectedTags.length === 0 ? 'isSelected' : ''}`}
            onClick={() => onTagsChange([])} aria-pressed={selectedTags.length === 0}>Все</button>
          {availableTags.map(tag => <button type="button" key={tag}
            className={`filterChip ${selectedTags.includes(tag) ? 'isSelected' : ''}`}
            onClick={() => toggleTag(tag)} aria-pressed={selectedTags.includes(tag)}>{tag}</button>)}
        </div>
      </div>
      {hasFilters && <button className="resetButton" type="button" onClick={onReset}>Сбросить фильтры</button>}
    </section>
  );
}
