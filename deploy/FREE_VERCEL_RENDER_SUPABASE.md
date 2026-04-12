# Бесплатный хостинг: Vercel + Render + Supabase

Цель: **два изолированных контура** (ЗБТ / production) без оплаты на старте.  
Репозиторий можно держать **публичным** (Render Free для приватных репозиториев недоступен).

---

## 1. Архитектура

| Компонент   | Staging (ЗБТ)              | Production              |
|------------|----------------------------|-------------------------|
| Frontend   | отдельный проект Vercel    | отдельный проект Vercel |
| Backend    | Web Service Render         | Web Service Render      |
| База       | проект Supabase «staging»  | проект Supabase «prod»  |

Примеры URL (замените на свои):

- ЗБТ: `https://tea-achievements-zbt.vercel.app` → API `https://tea-backend-staging.onrender.com`
- Prod: `https://tea-achievements.vercel.app` → API `https://tea-backend-production.onrender.com`

---

## 2. Supabase (2 проекта)

1. Создайте **два проекта** в [Supabase](https://supabase.com): например `tea-staging` и `tea-production`.
2. В каждом: **Project Settings → Database → Connection string**.
3. Для **Prisma / миграций** используйте **прямое** подключение (обычно порт **5432**, режим **Session / Direct**, не PgBouncer-only), строка вида:
   `postgresql://postgres.[ref]:[PASSWORD]@aws-0-....pooler.supabase.com:5432/postgres`  
   либо хост из вкладки **Database settings** (URI с `sslmode=require`, если просит документация).
4. Скопируйте **`DATABASE_URL`** отдельно для staging и production.

Локально один раз (с нужным `DATABASE_URL` в окружении):

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
```

Миграции также выполняются на **сборке Render** (см. `render.yaml`: `npx prisma migrate deploy` в `buildCommand`).

---

## 3. Backend (Render) — два сервиса

### Вариант A: Blueprint из репозитория

В корне репозитория лежит **`render.yaml`**. В Render: **Blueprints → New Blueprint Instance** → выберите репозиторий.

Задайте в UI переменные с `sync: false`:

- **`FRONTEND_ORIGIN`** — URL вашего фронта (можно несколько через запятую), например  
  `https://tea-achievements-zbt.vercel.app`  
- **`DATABASE_URL`** — из Supabase для **этого** окружения.

Для **staging** после деплоя скопируйте сгенерированные **`JWT_SECRET`** и **`STAGING_ACCESS_TOKEN`** в настройки **Vercel** (см. ниже).

### Вариант B: Вручную

Для **каждого** окружения создайте **Web Service**:

| Поле            | Значение |
|-----------------|----------|
| Root Directory  | `backend` |
| Build Command   | `npm ci && npm run build && npx prisma migrate deploy` |
| Start Command   | `node dist/server.js` |
| Health Check    | `/api/health` |

**Переменные окружения**

| Переменная | Staging | Production |
|------------|---------|------------|
| `DATABASE_URL` | Supabase staging | Supabase production |
| `JWT_SECRET` | случайная строка ≥ 16 символов | своя отдельная |
| `APP_ENV` | `staging` | `production` |
| `FRONTEND_ORIGIN` | URL ЗБТ Vercel (точный `https://…`) | URL prod Vercel |
| `STAGING_ACCESS_TOKEN` | случайная строка ≥ 12 символов | не задавать |
| `PUBLIC_BASE_URL` / `API_URL` | опционально; если пусто, подставится **`RENDER_EXTERNAL_URL`** |

Важно:

- На Render **`NODE_ENV` часто = `production`** даже для ЗБТ. Для включения staging-middleware задавайте именно **`APP_ENV=staging`**.
- **`TRUST_PROXY`** для Render включается автоматически, если задано окружение `RENDER=true` (так делает Render).

### Ограничения бесплатного Render

- Сервис **засыпает** после простоя; первый запрос **30+ секунд** — норма.
- **Диск эфемерный**: каталог **`uploads/`** не гарантируется после деплоя или сна. Аватары/баннеры могут пропасть. В логах при старте выводится предупреждение. Дальнейший шаг — **Supabase Storage / S3** (архитектура уже намечена в основном `deploy/`).

---

## 4. Frontend (Vercel) — два проекта

Рекомендуется **два проекта** (а не только Preview), чтобы были постоянные URL для ЗБТ и prod.

Общие настройки:

- **Framework Preset**: Vite  
- **Root Directory**: `frontend`  
- **Build Command**: `npm run build` (для ЗБТ можно `npm run build:staging`)  
- **Output Directory**: `dist`

### Production (Vercel)

**Environment Variables** (Production):

| Переменная      | Пример |
|-----------------|--------|
| `VITE_API_URL`  | `https://tea-backend-production.onrender.com` |

### Staging / ЗБТ (Vercel)

**Environment Variables** (Production в проекте ЗБТ):

| Переменная      | Пример |
|-----------------|--------|
| `VITE_API_URL`  | `https://tea-backend-staging.onrender.com` |
| `VITE_STAGING_ACCESS_TOKEN` | тот же, что **`STAGING_ACCESS_TOKEN`** на Render staging |

Без токена staging API вернёт **403** (кроме `/api/health`), т.к. IP пользователей Vercel не угнаться whitelist’ом.

Файл **`frontend/vercel.json`** уже настроен на SPA (`rewrites` → `index.html`).

### Автодеплой из GitHub

- Подключите репозиторий к Vercel и Render.
- **Staging frontend + Render staging**: ветка **`develop`** (или та, что указана в `render.yaml` для `tea-backend-staging`).
- **Production**: ветка **`main`**.

---

## 5. Связка и CORS

Бэкенд разрешает origin только из **`FRONTEND_ORIGIN`** (список через запятую).  
Укажите **полные** URL с `https://`, без завершающего `/`.

Публичные ссылки на загрузки формируются из **`PUBLIC_BASE_URL`** / **`API_URL`**; на Render при пустых значениях используется **`RENDER_EXTERNAL_URL`**, чтобы `/uploads/...` открывались с того же хоста, что и API.

---

## 6. Чеклист тестов

1. Открыть prod и ЗБТ сайты по HTTPS.  
2. Регистрация и логин на **каждом** окружении (разные БД → разные аккаунты).  
3. Пользователь A загружает аватар; пользователь B открывает профиль A (подождать несколько секунд или обновить — см. опрос на фронте).  
4. Проверить `GET https://<render-host>/api/health`.  
5. Убедиться, что с другого случайного origin запросы к API **блокируются** CORS.

---

## 7. Workflow разработки

1. Фича → merge в **`develop`** → деплой staging (Render + Vercel).  
2. Тесты на ЗБТ URL.  
3. Merge в **`main`** → деплой production.

---

## 8. Безопасность (уже в коде)

- CORS по whitelist.  
- Загрузки: только **JPEG / PNG / WebP / GIF**, лимиты размера Multer.  
- JWT с минимальным payload (`sub`, `role`).

Дополнительно на будущее: rate limit на `/api/auth/*`, object storage для медиа.
