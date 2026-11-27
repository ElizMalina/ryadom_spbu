import { PublicShell } from '@/modules/navigation/components/PublicShell';
import { notFound } from 'next/navigation';
import { ArticleView } from '@/modules/education/components/ArticleView';
import { getMaterial } from '@/modules/education/lib/server-api';
import { PublicApiError } from '@/modules/education/lib/api-client';
import Link from 'next/link';
import '../psychoeducation.css';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 let material;
 try{material=await getMaterial(slug)}catch(e){if(e instanceof PublicApiError&&e.status===404)notFound();
 return <PublicShell activeHref="/psychoeducation" mainClassName="route-psychoeducation"><h1>Материал временно недоступен</h1><p>Попробуйте открыть его позже.</p><Link href="/psychoeducation">Назад в каталог</Link></PublicShell>}
 return <PublicShell activeHref="/psychoeducation" mainClassName="route-psychoeducation"><ArticleView material={material}/></PublicShell>;
}
