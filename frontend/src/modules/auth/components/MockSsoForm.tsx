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

export function MockSsoForm({ returnTo, demoMode }: { returnTo: string; demoMode: boolean }) {
  const [username, setUsername] = useState(demoMode ? 'student.demo' : '');
  const [password, setPassword] = useState(demoMode ? 'Demo12345!' : '');
  const [displayName, setDisplayName] = useState('');
  const [registering, setRegistering] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const switchMode = () => {
    setRegistering(value => !value);
    setPassword('');
    setReveal(false);
    setError('');
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const name = displayName.trim();
    if (registering && !/^[a-z0-9][a-z0-9._-]{2,63}$/i.test(username.trim())) {
      setError('Логин должен содержать от 3 до 64 латинских букв, цифр, точек, дефисов или подчёркиваний и начинаться с буквы либо цифры.');
      return;
    }
    if (registering && (!name || [...name].length > 100)) {
      setError('Введите имя длиной от 1 до 100 символов.');
      return;
    }
    if (registering && ([...password].length < 12 || new TextEncoder().encode(password).length > 72)) {
      setError('Пароль должен содержать не менее 12 символов и занимать не более 72 байт.');
      return;
    }

    setBusy(true);
    try {
      const endpoint = registering ? '/api/demo-auth/register' : '/api/demo-auth/session';
      const data = registering ? { username, displayName: name, password } : { username, password };
      const response = await fetch(endpoint, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        if (registering && response.status === 409) setError('Этот логин уже занят.');
        else if (registering && response.status === 400) setError('Проверьте имя, логин и пароль.');
        else if (!registering && response.status === 401) setError('Неверный логин или пароль.');
        else if (response.status === 429) setError('Слишком много попыток. Попробуйте позже.');
        else setError(registering ? 'Не удалось создать аккаунт. Попробуйте позже.' : 'Сервис входа недоступен.');
        return;
      }
      window.location.assign(safeReturnTo(returnTo));
    } catch {
      setError(registering ? 'Не удалось создать аккаунт. Проверьте подключение.' : 'Не удалось выполнить вход. Проверьте подключение.');
    } finally { setBusy(false); }
  };
  return (
    <div className="ssoPage">
      <header className="ssoBrand">
        <Image className="ssoBrandLogo" src="/spbu-emblem-white.png" width={247} height={247} alt="Герб СПбГУ" priority />
      </header>
      <main className="ssoPanel">
        <h1>{registering ? 'Создание аккаунта' : 'Вход в учётную запись'}</h1>
        <form onSubmit={event => void submit(event)}>
          <label htmlFor="sso-username">Имя пользователя</label>
          <input id="sso-username" name="username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required minLength={1} maxLength={100} />
          {registering && <>
            <label htmlFor="sso-display-name">Имя</label>
            <input id="sso-display-name" name="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} autoComplete="name" required />
          </>}
          <label htmlFor="sso-password">Пароль</label>
          <div className="ssoPasswordField">
            {registering ? (
              <input id="sso-password" name="password" type={reveal ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required minLength={12} />
            ) : (
              <input id="sso-password" name="password" type={reveal ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required minLength={1} />
            )}
            <button type="button" onClick={() => setReveal(v => !v)} aria-label={reveal ? 'Скрыть пароль' : 'Показать пароль'}>{reveal ? 'Скрыть' : 'Показать'}</button>
          </div>
          {error && <p role="alert" className="ssoError">{error}</p>}
          <button className="ssoSubmit" disabled={busy} type="submit">
            {registering ? (busy ? 'Создаём аккаунт…' : 'Зарегистрироваться') : (busy ? 'Выполняется вход…' : 'Вход')}
          </button>
        </form>
        {demoMode ? <div className="ssoAccountChooser">
          <strong>Тестовые учётные записи</strong>
          <p>Выберите учётную запись. Пароль для всех: <code>Demo12345!</code>.</p>
          <div className="ssoAccounts">
            {TEST_ACCOUNTS.map(account => <button key={account.login} type="button" className={username === account.login ? 'isSelected' : ''} aria-pressed={username === account.login} onClick={() => setUsername(account.login)}>{account.label}</button>)}
          </div>
        </div> : <div className="ssoAccountChooser">
          <button type="button" className="ssoModeButton" disabled={busy} onClick={switchMode}>
            {registering ? 'Уже есть аккаунт? Войти' : 'Создать аккаунт'}
          </button>
        </div>}
        <a className="ssoCancel" href={safeReturnTo(returnTo)}>Вернуться без входа</a>
      </main>
    </div>
  );
}
