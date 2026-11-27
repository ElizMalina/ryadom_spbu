import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatedCoverUrl, generateArticleCover } from '../src/modules/education/lib/generated-cover.ts';
import { surnameFirst } from '../src/modules/education/lib/author.ts';
import { createSubmission, listApprovedArticles, reviewSubmission } from '../src/modules/auth/server/demo-content.ts';
import { toDemoArticles, getDemoList } from '../src/modules/education/mock/demo.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = relative => readFile(path.join(here, '..', relative), 'utf8');

test('all new published articles have an automatically generated cover URL', () => {
  const articles = toDemoArticles([{
    id: '123', title: 'Снижение тревоги перед экзаменом',
    body: 'Несколько способов сохранять спокойствие и внимание к отдыху.',
    authorName: 'Соколова Мария',
  }]);
  assert.equal(articles.length, 1);
  assert.match(articles[0].imageUrl, /^\/api\/article-cover\?/);
  assert.equal(articles[0].author, 'Соколова Мария');
  assert.equal(getDemoList(new URLSearchParams('q=тревоги'), articles).items[0].imageUrl, articles[0].imageUrl);
  const query = new URL(articles[0].imageUrl, 'http://localhost:3000').searchParams;
  assert.equal(query.get('title'), articles[0].title);
  assert.equal(query.get('topic'), 'Авторские статьи');
});

test('missing externally supplied covers use the generated cover on card and article', async () => {
  for (const component of ['src/modules/education/components/MaterialCard.tsx','src/modules/education/components/ArticleView.tsx']) {
    const code = await source(component);
    assert.match(code, /material\.imageUrl \|\| generatedCoverUrl\(material\)/);
    assert.doesNotMatch(code, /У материала нет обложки/);
  }
  const url = generatedCoverUrl({ title: 'Новая статья', summary: 'Короткий анонс', category: {slug:'study', name:'Учёба'} });
  const p = new URL(url, 'http://localhost:3000').searchParams;
  assert.equal(p.get('title'), 'Новая статья');
  assert.equal(p.get('summary'), 'Короткий анонс');
  assert.equal(p.get('topic'), 'Учёба');
});

test('generated artwork is deterministic, title-specific and valid XML text', () => {
  const title = 'Отношения & <script>alert("x")</script>';
  const a = generateArticleCover(title, 'Поддержка', 'Сложные отношения');
  const b = generateArticleCover(title, 'Поддержка', 'Сложные отношения');
  const other = generateArticleCover('Сон и восстановление', 'Самочувствие', 'Сон');
  assert.equal(a, b);
  assert.notEqual(a, other);
  assert.match(a, /<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(a, /&lt;script&gt;/);
  assert.doesNotMatch(a, /<script>|<foreignObject>|onload=/);
  assert.match(a, /1280.*720/);
  for (const text of ['','  \n\t','длинное '.repeat(100)]) {
    const image = generateArticleCover(text, text, text);
    assert.ok(image.length < 5000);
    assert.match(image, /<\/svg>$/);
  }
});

test('author display name is surname-first, and role labels are not a fallback', () => {
  assert.equal(surnameFirst('Мария Соколова'), 'Соколова Мария');
  assert.equal(surnameFirst(' Анна  Иванова  Сергеевна '), 'Иванова Анна');
  assert.equal(surnameFirst('Консультант'), undefined);
  assert.equal(surnameFirst('  '), undefined);
  assert.equal(toDemoArticles([{id:'noauthor',title:'Статья',body:'Содержание'}])[0].author, undefined);
});

test('new and legacy approved articles publish the account name, not the role or account ID', async () => {
  const previous = process.cwd();
  const temp = await mkdtemp(path.join(tmpdir(),'ryadom-author-and-cover-'));
  try {
    process.chdir(temp);
    const user = {id:'demo-002',username:'consultant.demo',displayName:'Мария Соколова',roles:['consultant']};
    const created = await createSubmission('article',user,'Первая авторская статья','Материал об учёбе и поддержке студентов.');
    await reviewSubmission('article',created.id,'approved');
    const legacy = [{id:'legacy-post',kind:'article',authorId:'demo-002',title:'Старая статья',body:'Содержимое',status:'approved',createdAt:'2026-01-01T00:00:00.000Z'}];
    const saved = JSON.parse(await readFile(path.join(temp,'.demo-data','submissions.json'),'utf8'));
    await writeFile(path.join(temp,'.demo-data','submissions.json'),JSON.stringify([...saved,...legacy]));
    const published = await listApprovedArticles();
    assert.equal(published.length, 2);
    for (const entry of published) {
      assert.equal(entry.authorName, 'Соколова Мария');
      assert.equal('authorId' in entry, false);
      const article = toDemoArticles([entry])[0];
      assert.equal(article.author, 'Соколова Мария');
      assert.match(article.imageUrl, /^\/api\/article-cover\?/);
    }
  } finally {
    process.chdir(previous);
    await rm(temp,{recursive:true,force:true});
  }
});

test('crisis screen includes original detailed contacts and collapsible reference content', async () => {
  const code = await source('src/modules/crisis/components/CrisisScreen.tsx');
  const content = await source('src/modules/crisis/content.ts');
  assert.match(code, /Кризисный центр «812»/);
  assert.match(code, /Психологической клиники СПбГУ/);
  assert.match(code, /<details className="crisisDisclosure">/);
  for (const part of ['roundTheClock','selfHelp','restSections','spbuTrustPhone','crisis812Phone']) {
    assert.ok(content.includes(part), part);
  }
});

test('sidebar and wall use exactly the user-requested public wording', async () => {
  const sidebar = await source('src/modules/navigation/components/SiteHeader.tsx');
  const wall = await source('src/app/wall/page.tsx');
  assert.match(sidebar, />Мне нужна помощь<\/Link>/);
  assert.doesNotMatch(wall, /При непосредственной опасности используйте 112/);
});
