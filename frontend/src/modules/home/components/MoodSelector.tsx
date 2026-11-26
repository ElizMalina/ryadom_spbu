'use client';

import { useState } from 'react';

const moods = ['Спокойно', 'Немного тревожно', 'Устал(а)', 'Нужна поддержка'] as const;
type Mood = (typeof moods)[number];

export function MoodSelector() {
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);

  return (
    <>
      <div className="homeMoodChips" role="group" aria-label="Выберите своё состояние">
        {moods.map((mood) => (
          <button
            key={mood}
            type="button"
            aria-pressed={selectedMood === mood}
            onClick={() => setSelectedMood((current) => (current === mood ? null : mood))}
          >
            {mood}
          </button>
        ))}
      </div>
      <p className="homeMoodNote" role="status" aria-live="polite">
        {selectedMood
          ? `Вы выбрали «${selectedMood}». Это не диагноз и никуда не отправляется.`
          : ''}
      </p>
    </>
  );
}
