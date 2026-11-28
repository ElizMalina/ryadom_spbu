'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ROLE_LABELS, safeReturnTo } from '../model/types';
import { useAuth } from './AuthProvider';
import { usePathname } from 'next/navigation';

export function ProfileMenu() {
  const { user, status, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [error, setError] = useState('');
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  useEffect(() => { setOpen(false); setConfirmExit(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); button.current?.focus(); }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('pointerdown', onPointerDown); window.removeEventListener('keydown', onKeyDown); };
  }, [open]);

  if (status === 'loading') return <span className="siteAuthStatus" role="status">Проверка входа…</span>;
  if (status === 'error') return <span className="siteAuthStatus" role="status">Сервис входа недоступен</span>;
  if (!user) {
    return <Link className="siteLoginLink" href={`/auth/sso?returnTo=${encodeURIComponent(safeReturnTo(pathname))}`}>Войти</Link>;
  }
  const label = user.roles.map(role => ROLE_LABELS[role]).join(', ') || 'Роли пока не назначены';
  const handleLogout = async () => {
    setBusy(true); setError('');
    try { await logout(); } catch { setError('Не удалось выйти. Попробуйте ещё раз.'); setBusy(false); }
  };
  return (
    <div className="siteProfile" ref={wrapper}>
      <button
        ref={button}
        type="button"
        className="siteProfileButton"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="site-profile-dropdown"
        onClick={() => setOpen(value => !value)}
      >
        <span>Профиль</span><span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && <div id="site-profile-dropdown" className="siteProfileDropdown">
        <div className="siteProfileIdentity">
          <strong>{user.displayName}</strong>
          <small>{label}</small>
        </div>
        <Link href="/profile" onClick={() => setOpen(false)}>Мой профиль</Link>
        {!confirmExit ? (
          <button type="button" onClick={() => setConfirmExit(true)}>Выйти</button>
        ) : (
          <div className="siteLogoutConfirm">
            <p>После выхода личные функции станут недоступны, но открытые материалы останутся доступны.</p>
            <button type="button" disabled={busy} onClick={() => void handleLogout()}>{busy ? 'Выходим…' : 'Подтвердить выход'}</button>
            <button type="button" disabled={busy} onClick={() => setConfirmExit(false)}>Отмена</button>
          </div>
        )}
      </div>}
      {error && <p role="alert" className="siteProfileError">{error}</p>}
    </div>
  );
}
