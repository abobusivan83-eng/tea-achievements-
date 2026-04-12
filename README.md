# Чайные достижения

Full-stack проект кланового сайта достижений:
- `frontend`: React + Vite + TypeScript
- `backend`: Node.js + Express + Prisma
- `database`: PostgreSQL

## Локальный запуск

Windows:
- основной быстрый запуск: `run-site.bat`
- PowerShell-лаунчер: `run-site.ps1`

Ручной запуск:
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run seed
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

## Release Model

Проект подготовлен под две отдельные среды:

- `staging` / ZBT: `zbt.tea-achievements.com`
- `production`: `tea-achievements.com`

Критичное правило:
- новые функции всегда идут сначала в `staging`
- прямой deploy в `production` запрещен для обычных релизов

Workflow:
1. Разработка
2. Deploy в `staging`
3. Тестирование
4. Исправления
5. Повторная проверка
6. Deploy в `production`

## Environment Files

Backend:
- `backend/.env.staging`
- `backend/.env.production`

Frontend:
- `frontend/.env.staging`
- `frontend/.env.production`

Примеры лежат рядом:
- `backend/.env.staging.example`
- `backend/.env.production.example`
- `frontend/.env.staging.example`
- `frontend/.env.production.example`

Ключевые переменные:
- `DATABASE_URL`
- `JWT_SECRET`
- `PORT`
- `API_URL`

Дополнительно:
- `APP_ENV`
- `FRONTEND_ORIGIN`
- `PUBLIC_BASE_URL` (ссылки на загрузки `/uploads/...`)
- `TRUST_PROXY`
- `STAGING_ACCESS_TOKEN`
- `STAGING_IP_WHITELIST`

Сид администратора (опционально): `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NICKNAME` (см. `deploy/DEPLOY.md`).

## Staging Access

`staging` поддерживает ограничение доступа:
- по token через заголовок `X-Staging-Access-Token`
- по IP whitelist через `STAGING_IP_WHITELIST`

Это уже встроено в backend middleware.

## Deploy

- **С чего начать:** [deploy/QUICKSTART.md](deploy/QUICKSTART.md) — чеклист, ручные шаги, примеры ссылок
- **Бесплатно (Vercel + Render + Supabase):** [deploy/FREE_VERCEL_RENDER_SUPABASE.md](deploy/FREE_VERCEL_RENDER_SUPABASE.md) и [`render.yaml`](render.yaml)
- **Свой сервер (VPS):** [deploy/DEPLOY.md](deploy/DEPLOY.md)
- Релизы и откат: [deploy/RELEASE.md](deploy/RELEASE.md)
- Docker (опционально): корневой `docker-compose.yml`, `.env.docker.example`
- Nginx (примеры): `deploy/nginx/tea-achievements.com.conf`, `deploy/nginx/zbt.tea-achievements.com.conf`
- PM2: `ecosystem.config.cjs`
- Миграции/сид: `deploy/scripts/migrate-and-seed.sh`

Backend scripts:
- `npm run build`
- `npm run start:staging`
- `npm run start:production`
- `npm run prisma:migrate:deploy`

Frontend scripts:
- `npm run build:staging`
- `npm run build:production`

## Databases

Базы staging и production должны быть полностью раздельными.

Рекомендуемые имена:
- `tea_achievements_staging`
- `tea_achievements_production`

Никаких общих таблиц, volume или `DATABASE_URL`.
