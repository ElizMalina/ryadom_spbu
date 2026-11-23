# Crisis UI — standalone

Автономный минимальный Next.js-проект только для кризисного экрана платформы «Рядом».

## Запуск

```bash
cd frontend
npm install
npm run dev
```

Открыть:

- http://localhost:3000/crisis
- http://localhost:3000 — автоматически перенаправляет на `/crisis`

## Проверка сборки

```bash
npm run build
```

## Что относится к кризисному экрану

- `src/app/(public)/crisis/`
- `src/modules/crisis/`

## Что является только минимальным каркасом Next.js

- `package.json`
- `tsconfig.json`
- `next.config.ts`
- `next-env.d.ts`
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/app/page.tsx`

Эти файлы нужны только для автономного запуска архива. При переносе в существующий `Ryadom_spbu/frontend` их заменять не нужно: копируйте только два кризисных каталога выше.

Если dev-сервер открывается по LAN-IP, а не через `localhost`, может потребоваться `allowedDevOrigins` в `next.config.ts`.
