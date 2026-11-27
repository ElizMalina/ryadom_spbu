'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '@/modules/auth/components/AuthProvider';
import { ProfileMenu } from '@/modules/auth/components/ProfileMenu';
import { hasRole, type UserRole } from '@/modules/auth/model/types';

type Item = Readonly<{ href: string; label: string }>;
type RestrictedItem = Item & Readonly<{ role: UserRole }>;

const publicLinks: readonly Item[] = [
  { href: '/', label: 'Главная' },
  { href: '/wall', label: 'Накопилось' },
  { href: '/practices', label: 'Практики' },
  { href: '/psychoeducation', label: 'Психопросвет' },
  { href: '/events', label: 'События' },
];
const restrictedLinks: readonly RestrictedItem[] = [
  { href: '/moderation', label: 'Модерация', role: 'moderator' },
  { href: '/reviews', label: 'Рецензирование', role: 'reviewer' },
  { href: '/admin/roles', label: 'Управление ролями', role: 'admin' },
];

export function SiteHeader({ activeHref }: { activeHref?: string }) {
  const pathname = usePathname();
  const { user, status } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [menuOpen]);
  const current = activeHref ?? pathname ?? '/';
  const isCurrent = (href: string): boolean => href === '/' ? current === '/' : current === href || current.startsWith(`${href}/`);
  const displayLink = ({ href, label }: Item) => <Link
    key={href}
    href={href}
    className={`siteNavLink${isCurrent(href) ? ' isActive' : ''}`}
    aria-current={isCurrent(href) ? 'page' : undefined}
    onClick={() => setMenuOpen(false)}
  >{label}</Link>;
  return <aside className="siteHeader" aria-label="Меню платформы Рядом">
    <div className="siteHeaderInner">
      <div className="siteHeaderTop">
        <Link className="siteBrand" href="/" aria-label="Платформа психологической поддержки «Рядом» — главная">
          <Image className="siteBrandLogo" src="/spbu-emblem-white.png" alt="Герб СПбГУ" width={247} height={247} priority />
          <span className="siteBrandText">Платформа психологической поддержки «Рядом»</span>
        </Link>
        <button
          ref={menuButton}
          className="siteMenuButton"
          type="button"
          aria-controls={menuId}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(open => !open)}
        >{menuOpen ? 'Закрыть меню' : 'Меню'}</button>
      </div>
      <div className="siteHeaderActions">
        <ProfileMenu />
        <Link className="siteCrisisLink" href="/crisis">Мне нужна помощь</Link>
      </div>
      <nav className="siteNav" id={menuId} data-open={menuOpen} aria-label="Основные разделы">
        {publicLinks.map(displayLink)}
        {status === 'ready' && user && restrictedLinks.some(item => hasRole(user, item.role)) && <>
          <span className="siteRoleNavigationTitle">Служебные разделы</span>
          {restrictedLinks.filter(item => hasRole(user, item.role)).map(displayLink)}
        </>}
      </nav>
    </div>
  </aside>;
}
