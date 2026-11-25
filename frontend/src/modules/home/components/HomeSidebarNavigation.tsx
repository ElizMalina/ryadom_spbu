'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useId, useState } from 'react';

type NavigationItem = Readonly<{
  label: string;
  href: string;
}>;

const navigation: readonly NavigationItem[] = [
  { label: 'Главная', href: '/' },
  { label: 'Разобраться', href: '/focus' },
  { label: 'Накопилось', href: '/wall' },
  { label: 'Практики', href: '/practices' },
  { label: 'Помощь', href: '/appointments' },
  { label: 'Психопросвет', href: '/psychoeducation' },
  { label: 'События', href: '/events' },
];

export function HomeSidebarNavigation() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigationId = useId();

  return (
    <>
      <div className="homeSidebarHeader">
        <Link className="homeBrand" href="/" aria-label="Рядом — главная">
          <Image
            className="homeBrandLogo"
            src="/spbu-logo-white.png"
            alt="СПбГУ"
            width={75}
            height={61}
            priority
          />
          <span className="homeBrandText">
            <strong>Рядом</strong>
            <small>психологическая поддержка</small>
          </span>
        </Link>
        <button
          className="homeMenuButton"
          type="button"
          aria-controls={navigationId}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? 'Закрыть меню' : 'Меню'}
        </button>
      </div>

      <nav
        className="homeNavigation"
        id={navigationId}
        aria-label="Основные разделы"
        data-open={menuOpen}
      >
        {navigation.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className={href === '/' ? 'isActive' : undefined}
            aria-current={href === '/' ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
          >
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
