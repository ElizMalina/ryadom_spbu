'use client';

import { useState } from 'react';
import { SubmissionForm } from './SubmissionForm';
import { MyArticles } from './MyArticles';

export function ArticleWorkspace() {
  const [revision, setRevision] = useState(0);
  return <>
    <SubmissionForm kind="article" onSubmitted={() => setRevision(current => current + 1)} />
    <MyArticles refreshKey={revision} />
  </>;
}
