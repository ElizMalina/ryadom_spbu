'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ROLE_LABELS, USER_ROLES, type CurrentUser, type UserRole } from '../model/types';
import { filterUsersByNameOrLogin } from '../model/role-search';
import { RoleGate } from './RoleGate';
import { Pagination, PAGE_SIZES, usePaginatedItems } from '@/modules/ui/pagination/Pagination';

export function AdminRoleManager() {
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const visibleUsers = useMemo(
    () => filterUsersByNameOrLogin(users, searchQuery),
    [users, searchQuery],
  );

  const paged = usePaginatedItems(visibleUsers, PAGE_SIZES.staff, searchQuery);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/demo-auth/users', { signal, cache: 'no-store' });
      if (!response.ok) throw new Error('unavailable');
      const data: { users: CurrentUser[] } = await response.json();
      if (!signal?.aborted) {
        setUsers(data.users);
        setStatus('ready');
      }
    } catch {
      if (!signal?.aborted) setStatus('error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const setRole = async (username: string, role: UserRole, checked: boolean) => {
    const current = users.find(user => user.username === username);
    if (!current) return;
    const roles = checked
      ? [...new Set([...current.roles, role])]
      : current.roles.filter(existing => existing !== role);
    if (!roles.length) {
      setMessage('У пользователя должна оставаться хотя бы одна роль.');
      return;
    }

    setBusyUser(username);
    setMessage('');
    try {
      const response = await fetch('/api/demo-auth/users', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, roles }),
      });
      if (!response.ok) throw new Error('Не удалось назначить роли.');
      const data: { user: CurrentUser } = await response.json();
      setUsers(all => all.map(user => user.username === username ? data.user : user));
      setMessage(`Роли пользователя ${data.user.displayName} обновлены.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ошибка.');
    } finally {
      setBusyUser(null);
    }
  };

  return (
    <RoleGate role="admin">
      {status === 'loading' && <p role="status">Загружаем пользователей…</p>}
      {status === 'error' && (
        <p role="alert">
          Список недоступен.{' '}
          <button type="button" onClick={() => { setStatus('loading'); void load(); }}>
            Повторить
          </button>
        </p>
      )}
      {message && <p role="status" className="staffHint">{message}</p>}

      {status === 'ready' && (
        <>
          <div className="staffUserSearch">
            <label htmlFor="role-user-search">Поиск по имени, фамилии или логину</label>
            <div className="staffUserSearchRow">
              <input
                id="role-user-search"
                type="search"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Например, Алексей, Студент или student.demo"
                autoComplete="off"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')}>
                  Сбросить
                </button>
              )}
            </div>
            <p className="staffUserSearchCount" role="status" aria-live="polite">
              Найдено: {visibleUsers.length} из {users.length}
            </p>
          </div>

          {visibleUsers.length > 0 ? (
            <div className="staffFeed">
              {paged.pageItems.map(user => (
                <section className="staffCard" key={user.id}>
                  <h2>{user.displayName}</h2>
                  <p>{user.username}</p>
                  <div className="staffRoleGrid">
                    {USER_ROLES.map(role => (
                      <label className="staffCheckbox" key={role}>
                        <input
                          type="checkbox"
                          checked={user.roles.includes(role)}
                          disabled={busyUser !== null || user.username === 'admin.demo'}
                          onChange={event => void setRole(user.username, role, event.target.checked)}
                        />
                        <span>{ROLE_LABELS[role]}</span>
                      </label>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="staffCard staffNoSearchResults" role="status">
              <h2>Пользователи не найдены</h2>
              <p>Попробуйте ввести другую часть имени, фамилии или логина.</p>
            </div>
          )}
          <Pagination {...paged} onPageChange={paged.setPage} label="пользователи" />
        </>
      )}
    </RoleGate>
  );
}
