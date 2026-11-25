import Link from 'next/link';
import { HomeSidebarNavigation } from '@/modules/home/components/HomeSidebarNavigation';
import { MoodSelector } from '@/modules/home/components/MoodSelector';
import './home.css';

type HomeCard = Readonly<{
  title: string;
  description: string;
  href: string;
}>;

const paths: readonly HomeCard[] = [
  {
    title: 'Эмоциональное состояние',
    description: 'Узнать больше о своих чувствах',
    href: '/focus',
  },
  {
    title: 'Жизненные сферы',
    description: 'Учёба, отношения и повседневная жизнь',
    href: '/psychoeducation',
  },
  {
    title: 'Профессиональная помощь',
    description: 'Как связаться со специалистом',
    href: '/appointments',
  },
];

const todayCards: ReadonlyArray<Pick<HomeCard, 'title' | 'description'>> = [
  {
    title: 'Небольшая поддержка',
    description: 'Не нужно решать все задачи сразу.',
  },
  {
    title: 'События',
    description: 'Посмотрите встречи и мероприятия.',
  },
  {
    title: 'Практика',
    description: 'Сделайте короткую паузу и обратите внимание на дыхание.',
  },
];

export default function HomePage() {
  return (
    <div className="homeShell">
      <div className="homeSidebarColumn">
        <aside className="homeSidebar" aria-label="Навигация платформы">
          <HomeSidebarNavigation />
          <div className="homeSidebarBottom">
            <Link className="homeEmergencyLink" href="/crisis">
              Нужна срочная помощь
            </Link>
            <p className="homeDisclaimer">
              Платформа не ставит диагнозы и не заменяет экстренные службы
            </p>
          </div>
        </aside>
      </div>

      <main className="homeMain" id="main-content">
        <header className="homeTopbar">
          <label className="homeSearchField">
            <span className="homeSrOnly">Поиск по платформе</span>
            <input
              type="search"
              placeholder="Поиск по платформе (демо)"
              disabled
              aria-describedby="home-search-notice"
            />
          </label>
          <span className="homeSrOnly" id="home-search-notice">
            Поиск будет подключён позднее
          </span>
          <Link className="homeLogin" href="/login">Войти</Link>
        </header>

        <section className="homeHero" aria-labelledby="home-title">
          <p className="homeEyebrow">Психологическая поддержка СПбГУ</p>
          <h1 id="home-title">Вы не одни. Мы рядом.</h1>
          <p>
            Здесь можно разобраться в своём состоянии, найти полезные материалы
            или узнать, как обратиться за поддержкой.
          </p>
          <div className="homeActions">
            <Link href="/focus">Разобраться за 2 минуты</Link>
            <Link href="/appointments">Записаться к психологу</Link>
          </div>
        </section>

        <section className="homeSection" aria-labelledby="home-mood-title">
          <h2 id="home-mood-title">Как вы сейчас?</h2>
          <p>Выбор нужен только для навигации. Мы не сохраняем его в дневник.</p>
          <MoodSelector />
        </section>

        <section className="homeSection" aria-labelledby="home-path-title">
          <h2 id="home-path-title">Выберите путь</h2>
          <div className="homeGrid">
            {paths.map(({ title, description, href }) => (
              <Link href={href} className="homeTile" key={href}>
                <h3>{title}</h3>
                <p>{description}</p>
                <span>Перейти →</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="homeSection" aria-labelledby="home-today-title">
          <h2 id="home-today-title">На сегодня</h2>
          <div className="homeGrid">
            {todayCards.map(({ title, description }) => (
              <article className="homeTile" key={title}>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
