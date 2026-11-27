'use client';
import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import { safeReturnTo } from '../model/types';

const TEST_ACCOUNTS = [
  { login: 'student.demo', label: 'Студент' },
  { login: 'consultant.demo', label: 'Консультант' },
  { login: 'psychologist.demo', label: 'Психолог' },
  { login: 'student2.demo', label: 'Студент 2' },
  { login: 'student3.demo', label: 'Студент 3' },
  { login: 'moderator.demo', label: 'Модератор' },
  { login: 'reviewer.demo', label: 'Клинический рецензент' },
  { login: 'admin.demo', label: 'Администратор' },
] as const;

export function MockSsoForm({ returnTo }: { returnTo: string }) {
  const [username, setUsername] = useState('student.demo');
  const [password, setPassword] = useState('Demo12345!');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/demo-auth/session', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        setError(response.status === 401 ? 'Неверный логин или пароль.' : 'Сервис входа недоступен.');
        return;
      }
      window.location.assign(safeReturnTo(returnTo));
    } catch {
      setError('Не удалось выполнить вход. Проверьте подключение.');
    } finally { setBusy(false); }
  };
  return (
    <div className="ssoPage">
      <header className="ssoBrand">
        <Image className="ssoBrandLogo" src="/spbu-emblem-white.png" width={247} height={247} alt="Герб СПбГУ" priority />
      </header>
      <main className="ssoPanel">
        <h1>Вход в учетную запись</h1>
        <form onSubmit={event => void submit(event)}>
          <label htmlFor="sso-username">Имя пользователя</label>
          <input id="sso-username" name="username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required minLength={1} maxLength={100} />
          <label htmlFor="sso-password">Пароль</label>
          <div className="ssoPasswordField">
            <input id="sso-password" name="password" type={reveal ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required minLength={1} />
            <button type="button" onClick={() => setReveal(v => !v)} aria-label={reveal ? 'Скрыть пароль' : 'Показать пароль'}>{reveal ? 'Скрыть' : 'Показать'}</button>
          </div>
          {error && <p role="alert" className="ssoError">{error}</p>}
          <button className="ssoSubmit" disabled={busy} type="submit">{busy ? 'Выполняется вход…' : 'Вход'}</button>
        </form>
        <div className="ssoAccountChooser">
          <strong>Тестовые учётные записи</strong>
          <p>Выберите учётную запись. Пароль для всех: <code>Demo12345!</code>.</p>
          <div className="ssoAccounts">
            {TEST_ACCOUNTS.map(account => <button key={account.login} type="button" className={username === account.login ? 'isSelected' : ''} aria-pressed={username === account.login} onClick={() => setUsername(account.login)}>{account.label}</button>)}
          </div>
        </div>
        <a className="ssoCancel" href={safeReturnTo(returnTo)}>Вернуться без входа</a>
      </main>
    </div>
  );
}
