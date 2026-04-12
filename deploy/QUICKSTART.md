# Быстрый старт и деплой «Чайные достижения»

Краткая инструкция после настройки кода в репозитории.

---

## 1. Что уже настроено в проекте

- **Backend (Express):** порт из **`PORT`** (Render подставляет автоматически); **CORS** по **`FRONTEND_ORIGIN`** (несколько origin через запятую); **глобальный error handler**; **`GET /api/health`**; **helmet**; **morgan**; **`express-async-errors`**.
- **Статика загрузок:** `app.use('/' + UPLOAD_DIR, static(...))` при **`UPLOAD_DIR=uploads`** эквивалентно пути **`/uploads/...`**. Папки **`uploads/avatars`**, **`uploads/banners`**, **`uploads/misc`** создаются при старте (middleware).
- **⚠️ Render:** диск **не постоянный** — файлы в **`/uploads`** могут пропасть после сна сервиса или деплоя. Для бесплатного этапа оставлено как есть; позже — S3 / Supabase Storage.
- **Prisma:** в модели **User** есть **`avatarUrl`**, **`bannerUrl`** (и legacy **`avatarPath`**, **`bannerPath`**).
- **Frontend:** **`VITE_API_URL`** в прод-сборке; в **dev** без переменной используется `http://localhost:4000`; при пустом URL в production — запросы на **тот же origin** (если фронт и API на одном домене).
- **Render:** корневой **`render.yaml`**: **`rootDir: backend`**, ветки **`develop`** (staging) и **`main`** (production), build с **`prisma generate`**, **`migrate deploy`**, start **`node dist/server.js`**.
- **Vercel:** **`frontend/vercel.json`** — SPA **rewrites** на `index.html`.
- **Staging:** пропуск **OPTIONS** (CORS preflight) и **`/api/health`** для middleware ЗБТ.

---

## 2. Что сделать вручную

### A. Supabase (два проекта)

1. Создайте проект **production** и проект **staging**.
2. В каждом: **Settings → Database → Connection string** — возьмите **URI** для приложения (для Prisma миграций обычно нужен **прямой** доступ, порт **5432**, при необходимости `?sslmode=require`).
3. Сохраните два значения **`DATABASE_URL`** — отдельно для prod и staging.

При желании первый раз прогнать миграции с локальной машины:

```bash
cd backend
set DATABASE_URL=...staging_url...   # Windows; на macOS/Linux: export DATABASE_URL=...
npx prisma generate
npx prisma migrate deploy
```

Повторите с **production** `DATABASE_URL` (или полагайтесь на миграции в **build** на Render).

### B. Render (два Web Service)

1. Подключите репозиторий → **Blueprint** из **`render.yaml`** или создайте два сервиса вручную (**Root Directory:** `backend`).
2. Для **каждого** сервиса задайте:
   - **`DATABASE_URL`** — свой из Supabase;
   - **`FRONTEND_ORIGIN`** — точный **`https://...`** вашего фронта на Vercel (staging-сервис → URL ЗБТ-фронта; prod → URL prod-фронта). Несколько origin — **через запятую без пробелов** или с пробелами (они обрезаются при парсинге).
   - **`JWT_SECRET`** — ≥ 16 символов (или оставьте сгенерированный Render из blueprint).
3. **Staging-сервис:** **`APP_ENV=staging`**, задайте **`STAGING_ACCESS_TOKEN`** (≥ 12 символов). Скопируйте токен — он понадобится в Vercel.
4. **Production-сервис:** **`APP_ENV=production`**, **`STAGING_ACCESS_TOKEN`** не нужен.
5. **`PORT`** на Render задавать **не обязательно** — платформа подставит сама; приложение читает **`process.env.PORT`**.

После деплоя скопируйте публичные URL сервисов (например `https://tea-backend-staging.onrender.com` и `https://tea-backend-production.onrender.com`).  
Если не заданы **`PUBLIC_BASE_URL` / `API_URL`**, для ссылок на файлы используется **`RENDER_EXTERNAL_URL`**.

### C. Vercel (два проекта фронта)

Рекомендуется **два проекта** (ЗБТ и prod).

| Настройка | Значение |
|-----------|----------|
| Framework | Vite |
| Root Directory | `frontend` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

**Переменные окружения (Production в каждом проекте):**

| Переменная | Проект staging (ЗБТ) | Проект production |
|------------|----------------------|-------------------|
| `VITE_API_URL` | URL **staging** Render API (`https://....onrender.com`) | URL **production** Render API |
| `VITE_STAGING_ACCESS_TOKEN` | Тот же, что **`STAGING_ACCESS_TOKEN`** на Render staging | не задавать |

Подключите GitHub: для ЗБТ-проекта можно привязать ветку **`develop`**, для prod — **`main`**.

---

## 3. Какие ссылки вы получите

Примеры (ваши будут другими):

| Роль | Пример URL |
|------|------------|
| Frontend (prod) | `https://tea-achievements.vercel.app` |
| Frontend (staging) | `https://tea-achievements-zbt.vercel.app` |
| Backend (prod) | `https://tea-backend-production.onrender.com` |
| Backend (staging) | `https://tea-backend-staging.onrender.com` |

Точные URL видны в дашбордах **Vercel** и **Render** после первого успешного деплоя.

---

## 4. Чеклист «всё работает»

1. **Backend prod:** открыть `https://<prod-backend>/api/health` → JSON с `"ok": true`.
2. **Backend staging:** то же для staging URL (без заголовка токена health должен отвечать).
3. **CORS:** с фронта выполнить регистрацию/логин без ошибки в консоли браузера.
4. **Staging фронт:** в Network видно заголовок **`x-staging-access-token`** (если задан `VITE_STAGING_ACCESS_TOKEN`), иначе API вернёт 403 (кроме health).
5. **Регистрация и логин** на prod и staging (разные БД — разные аккаунты).
6. **Аватар:** пользователь A загружает аватар; пользователь B открывает профиль A (при необходимости подождать несколько секунд или обновить страницу).
7. **Картинка по прямой ссылке:** URL из поля `avatarUrl` в профиле открывается в браузере (если файл ещё на диске Render).

---

## Локальный запуск (без облака)

```bash
# PostgreSQL локально, создайте БД и пропишите backend/.env по образцу backend/.env.example

cd backend
npm ci
npx prisma migrate dev
npm run dev

cd ../frontend
npm ci
npm run dev
```

Фронт: `http://localhost:3000`, API: `http://localhost:4000` (при стандартных портах).

---

Подробнее про бесплатный стек: **[FREE_VERCEL_RENDER_SUPABASE.md](./FREE_VERCEL_RENDER_SUPABASE.md)**.  
Свой VPS/nginx: **[DEPLOY.md](./DEPLOY.md)**.
