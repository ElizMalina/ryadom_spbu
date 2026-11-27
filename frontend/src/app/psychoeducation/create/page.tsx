import { PublicShell } from '@/modules/navigation/components/PublicShell';
import { ArticleWorkspace } from '@/modules/auth/components/ArticleWorkspace';
export default function CreateArticlePage() {
  return <PublicShell activeHref="/psychoeducation"><div className="staffPage"><p className="staffKicker">Психопросвет</p><h1>Написать статью</h1><p className="staffLead">Материал будет доступен читателям только после рецензирования и последующей публикации.</p><ArticleWorkspace /></div></PublicShell>;
}
