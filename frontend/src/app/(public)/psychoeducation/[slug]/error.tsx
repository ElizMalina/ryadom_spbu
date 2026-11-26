'use client';

export default function ArticleError({ reset }: { reset: () => void }) {
  return (
    <main>
      <h1>Не удалось загрузить статью</h1>
      <button type="button" onClick={reset}>Повторить</button>
    </main>
  );
}
