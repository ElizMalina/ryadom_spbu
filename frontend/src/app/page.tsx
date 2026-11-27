import { PublicShell } from '@/modules/navigation/components/PublicShell';
import { HomeToday } from '@/modules/home/HomeToday';
import Link from 'next/link';
import { MoodSelector } from '@/modules/home/components/MoodSelector';
import './home.css';

type HomeCard = Readonly<{
  title: string;
  description: string;
  href: string;
}>;

const paths: readonly HomeCard[] = [
  {
    title: 'Практики самопомощи',
    description: 'Упражнения и техники для поддержки себя',
    href: '/practices',
  },
  {
    title: 'Материалы психопросвета',
    description: 'Статьи и материалы по психологии',
    href: '/psychoeducation',
  },
];

export default function HomePage() {
  return (
    <PublicShell activeHref="/" mainClassName="route-home" mainId="main-content">
        <section className="homeHero" aria-labelledby="home-title">
          <p className="homeEyebrow">Психологическая поддержка СПбГУ</p>
          <h1 id="home-title">Вы не одни. Мы рядом.</h1>
          <p>
            Здесь можно разобраться в своём состоянии, найти полезные материалы
            или узнать, как обратиться за поддержкой.
          </p>
        </section>

        <section className="homeSection" aria-labelledby="home-mood-title">
          <h2 id="home-mood-title">Как вы сейчас?</h2>
          <MoodSelector />
        </section>

        <section className="homeSection" aria-labelledby="home-path-title">
          <h2 id="home-path-title">Выберите путь</h2>
          <div className="homeGrid">
            {paths.map(({ title, description, href }) => (
              <Link href={href} className="homeTile" key={href}>
                <h3>{title}</h3>
                <p>{description}</p>
                <span>Перейти</span>
              </Link>
            ))}
          </div>
        </section>

        <HomeToday />
    </PublicShell>
  );
}
