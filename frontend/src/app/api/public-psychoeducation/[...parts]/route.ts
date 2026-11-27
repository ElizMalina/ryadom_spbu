import { isPsychoDemoEnabled, getDemoList, getDemoFilters, getDemoArticle, toDemoArticles } from '@/modules/education/mock/demo';
import { listApprovedArticles } from '@/modules/auth/server/demo-content';
import { NextRequest, NextResponse } from 'next/server';
import { upstreamPath } from '@/modules/education/lib/server-api';
import { filters, list, detail } from '@/modules/education/lib/api-client';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest,{params}:{params:Promise<{parts:string[]}>}) {
 const {parts}=await params;
  // Явный локальный demo — в production ветка никогда не активируется.
  if (isPsychoDemoEnabled()) {
    const approved = toDemoArticles(await listApprovedArticles());
    if (parts.length === 1 && parts[0] === 'filters')
      return NextResponse.json(getDemoFilters(approved), { headers: { 'Cache-Control': 'no-store' } });
    if (parts.length === 1 && parts[0] === 'materials')
      return NextResponse.json(getDemoList(req.nextUrl.searchParams, approved), { headers: { 'Cache-Control': 'no-store' } });
    if (parts.length === 2 && parts[0] === 'materials') {
      const article = getDemoArticle(parts[1], approved);
      return article
        ? NextResponse.json(article, { headers: { 'Cache-Control': 'no-store' } })
        : NextResponse.json({ message: 'Не найдено' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Не найдено' }, { status: 404 });
  }

 const allowed=(parts.length===1 && ['materials','filters'].includes(parts[0])) ||
 (parts.length===2 && parts[0]==='materials' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parts[1]));
 if(!allowed)return NextResponse.json({message:'Не найдено'}, {status:404});
 const query=new URLSearchParams();
 for(const [k,v] of req.nextUrl.searchParams)if(['q','type','category','tags'].includes(k))query.append(k,v);
 let url:string;try{url=upstreamPath(parts,query.size?'?'+query.toString():'');}catch{return NextResponse.json({message:'Сервис недоступен'}, {status:503})}
 try {
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!response.ok)return NextResponse.json({message:response.status===400?'Проверьте фильтры':'Не удалось загрузить данные'}, {status:[400,404].includes(response.status)?response.status:503});
  const raw:unknown=await response.json();
  const data=parts[0]==='filters'?filters(raw):parts.length===2?detail(raw):list(raw);
  return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({message:'Сервис временно недоступен'}, {status:503})}
}
