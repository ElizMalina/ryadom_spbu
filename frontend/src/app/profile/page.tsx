'use client';
import { PublicShell } from '@/modules/navigation/components/PublicShell';
import { useAuth } from '@/modules/auth/components/AuthProvider';
import { ROLE_LABELS } from '@/modules/auth/model/types';
export default function ProfilePage() {
  const { user, status } = useAuth();
  return <PublicShell><div className="staffPage"><h1>Профиль</h1>
    {status === 'loading' ? <p>Проверяем сессию…</p> : status === 'error' ? <p role="alert">Профиль временно недоступен.</p> : user ?
      <div className="staffCard"><h2>{user.displayName}</h2><p>Логин: {user.username}</p><p>Роли: {user.roles.map(role => ROLE_LABELS[role]).join(', ')}</p></div> :
      <p>Вы просматриваете публичные материалы без входа.</p>}
  </div></PublicShell>;
}
