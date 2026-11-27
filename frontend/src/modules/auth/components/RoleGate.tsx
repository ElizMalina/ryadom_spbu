'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { hasRole, ROLE_LABELS, type UserRole } from '../model/types';
import { useAuth } from './AuthProvider';

export function RoleGate({ role, children }: { role: UserRole; children: ReactNode }) {
  const { user, status } = useAuth();
  const pathname = usePathname();
  if (status === 'loading') return <p role="status">Проверяем доступ…</p>;
  if (status === 'error') return <p role="alert">Сервис авторизации сейчас недоступен.</p>;
  if (!user) return <div className="staffNotice"><h2>Требуется вход</h2><p>Войдите, чтобы продолжить.</p><Link className="uiButton" href={`/auth/sso?returnTo=${encodeURIComponent(pathname)}`}>Войти через СПбГУ</Link></div>;
  if (!hasRole(user, role)) return <div className="staffNotice" role="alert"><h2>Недостаточно прав</h2><p>Эта страница доступна пользователю с ролью «{ROLE_LABELS[role]}».</p></div>;
  return <>{children}</>;
}
