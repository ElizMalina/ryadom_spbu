# Рядом — локальный запуск и интеграция с backend

## Требования

- Node.js 22+ и npm.
- Для проверки Go backend: Docker + Docker Compose (либо Go и PostgreSQL).

## Быстрый запуск интерфейса без backend

Из корня репозитория:

```bash
cd frontend
npm install
cp -n .env.example .env.local
```

Убедитесь, что в `frontend/.env.local` выставлены следующие значения (добавьте или замените их):

```dotenv
HOME_API_MODE=demo
PSYCHO_API_MODE=demo
PSYCHO_API_BASE_URL=http://localhost:8080
```

Далее:

```bash
npm run dev -- -H 0.0.0.0 -p 3000
```

Откройте http://localhost:3000. На телефоне в той же Wi-Fi сети используйте `http://<IP_вашего_Mac>:3000` (при необходимости настройте `allowedDevOrigins` в `next.config.ts` под адрес локальной сети).

В этом режиме статьи, практики, встречи и роли используют демонстрационные данные. Демонстрационный SSO — не настоящая авторизация СПбГУ. Не используйте его для реальных пользователей.

## Тестирование frontend

```bash
cd frontend
npm test
npm run test:coverage
npm run build
```

Команда `test:coverage` проверяет порог покрытия **только для перечисленных в `frontend/package.json` модулей**, не для всего приложения. Перед объединением PR важно отдельно проверить сборку и основные пользовательские сценарии в браузере.

## Подключение Go backend (публичный API психопросвета)

В одном терминале из корня репозитория:

```bash
cd backend
docker compose up --build -d
```

Проверка:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/api/v1/psychoeducation/materials
```

В `frontend/.env.local` оставьте `HOME_API_MODE=demo`, а режим психопросвета переключите:

```dotenv
PSYCHO_API_MODE=backend
PSYCHO_API_BASE_URL=http://localhost:8080
HOME_API_MODE=demo
```

Перезапустите `npm run dev`. Next.js проксирует запросы к Go backend. Описание текущего публичного API: `api/openapi.yaml`; инструкции Go: `backend/README.md`.

**Границы текущей интеграции:** Go backend реализует чтение материалов психопросвета, фильтры и health endpoints. Создание/модерация авторских материалов, роли/SSO, события и практики в этой версии работают через локальное demo API Next.js. Их нельзя считать интегрированными с Go backend; для production потребуется отдельная реализация маршрутов, постоянного хранения и авторизации.

## Данные, секреты и публикация

- Не коммитьте `frontend/.env.local`, `.demo-data/`, `.next/`, `node_modules/` и любые пользовательские данные.
- Используйте `.env.example` только для безопасных примерных настроек.
- Сырые документы для импорта материалов находятся в `docs/content-import/`; импортированные начальные данные и миграции уже присутствуют в коде.
- Не подключайте настоящий SSO или production-доступы к демо-формам.
