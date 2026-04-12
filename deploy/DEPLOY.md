# Развёртывание «Чайные достижения»

Два типовых варианта:

1. **Рекомендуемый на VPS:** PostgreSQL + Node (PM2) + собранный Vite в `/var/www/...` + nginx + Let’s Encrypt.
2. **Опционально:** `docker compose` (см. корневой `docker-compose.yml` и `.env.docker.example`).

---

## 1. Подготовка сервера

- Ubuntu 22.04+ (или аналог), открытые порты `80`, `443`.
- Установите: **Node.js 22 LTS**, **nginx**, **certbot** (`python3-certbot-nginx` или официальный snap), **PostgreSQL 16+**, **PM2** (`npm i -g pm2`).

---

## 2. База данных

Создайте две БД (staging и production) и пользователя:

```sql
CREATE USER tea_app WITH PASSWORD 'strong_password';
CREATE DATABASE tea_achievements_production OWNER tea_app;
CREATE DATABASE tea_achievements_staging OWNER tea_app;
```

В `backend/.env.production` и `backend/.env.staging` задайте разные `DATABASE_URL`.

---

## 3. Миграции и сид

Из каталога `backend` (с нужным `DATABASE_URL` в окружении или `--env-file`):

```bash
npx prisma generate
npx prisma migrate deploy
```

Сид администратора и базовых данных (повторный запуск безопасен по данным upsert; **пароль админа обновится только если задан `ADMIN_PASSWORD`**):

```bash
ADMIN_EMAIL=admin@yourdomain.tld ADMIN_PASSWORD='сильный_пароль' npx prisma db seed
```

Или скрипт из репозитория:

```bash
chmod +x deploy/scripts/migrate-and-seed.sh
./deploy/scripts/migrate-and-seed.sh
```

---

## 4. Backend (PM2)

1. Склонируйте репозиторий, например в `/var/www/tea-achievements` (production) и `/var/www/tea-achievements-staging` (ЗБТ).
2. В каждом `backend`: `npm ci`, скопируйте `.env.production.example` → `.env.production` (или `.env.staging`) и заполните:
   - `JWT_SECRET` (≥ 16 символов)
   - `DATABASE_URL`
   - `API_URL` / `PUBLIC_BASE_URL` — публичный **https**-URL этого окружения
   - `FRONTEND_ORIGIN` — тот же домен фронта (можно несколько через запятую)
   - `TRUST_PROXY=true`
   - для ЗБТ: `APP_ENV=staging`, `STAGING_ACCESS_TOKEN`, при необходимости `STAGING_IP_WHITELIST`
3. **Staging:** в `.env.staging` укажите `PORT=4001`, чтобы не конфликтовать с production (`4000`).
4. Сборка и запуск:

```bash
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Поправьте `cwd` в `ecosystem.config.cjs` под реальные пути на сервере.

Логи приложения: stdout/stderr попадают в файлы PM2 (см. `error_file` / `out_file` в `ecosystem.config.cjs`). HTTP access/error по API дополнительно пишет **morgan** (`combined` в production) в тот же stdout.

---

## 5. Frontend (production build + nginx)

В каталоге `frontend`:

```bash
# Production
cp .env.production.example .env.production
# Укажите VITE_API_URL=https://tea-achievements.com
npm ci && npm run build:production
sudo mkdir -p /var/www/tea-achievements/frontend
sudo rsync -a dist/ /var/www/tea-achievements/frontend/dist/
```

Для ЗБТ:

```bash
cp .env.staging.example .env.staging
# VITE_API_URL=https://zbt.tea-achievements.com
npm run build:staging
sudo rsync -a dist/ /var/www/tea-achievements-staging/frontend/dist/
```

Если фронт и API на одном домене за nginx, в сборке можно не задавать `VITE_API_URL` (пустой same-origin режим в `src/lib/config.ts`).

---

## 6. Nginx

Примеры готовых серверных блоков:

- `deploy/nginx/tea-achievements.com.conf` — production
- `deploy/nginx/zbt.tea-achievements.com.conf` — ЗБТ

Маршрутизация:

- `/api/` → upstream Node (порт `4000` или `4001`)
- `/uploads/` → тот же upstream (статика от Express)
- `/` → `root` с `try_files` для SPA

Проверка и перезагрузка:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 7. SSL (certbot)

Первичная выдача (пример, HTTP-01 через nginx):

```bash
sudo mkdir -p /var/www/certbot
sudo certbot certonly --webroot -w /var/www/certbot -d tea-achievements.com -d www.tea-achievements.com
sudo certbot certonly --webroot -w /var/www/certbot -d zbt.tea-achievements.com
```

Либо `sudo certbot --nginx` после подключения черновых `server` на порту 80.

Автообновление: `sudo systemctl enable certbot.timer` (зависит от дистрибутива).

Убедитесь, что пути `ssl_certificate` в конфигах совпадают с каталогами Let’s Encrypt.

---

## 8. Docker Compose (опционально)

```bash
cp .env.docker.example .env
# отредактируйте секреты и PUBLIC_BASE_URL (URL в браузере)
docker compose up -d --build
docker compose run --rm backend sh -c "npx prisma migrate deploy && npx prisma db seed"
```

Первый запуск сидов с кастомным админом:

```bash
docker compose run --rm -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... backend sh -c "npx prisma migrate deploy && npx prisma db seed"
```

Сайт: `http://localhost:8080` (или порт из `HTTP_PORT`).

---

## 9. Логи и базовый мониторинг

| Источник | Назначение |
|----------|------------|
| PM2 `pm2 logs` | stdout/stderr Node, morgan access, `console.error` из error handler |
| `/var/log/nginx/*.log` | Запросы к статике и прокси |
| `pm2 monit` | CPU / память процессов |
| `curl /api/health` | Быстрая проверка API (в staging без токена доступен только health) |

Рекомендуется внешний uptime-check (Uptime Kuma, Better Stack и т.п.) по HTTPS.

---

## 10. Финальная проверка

- [ ] Сайт открывается по `https://tea-achievements.com` и `https://zbt.tea-achievements.com`
- [ ] `GET /api/health` возвращает `ok`
- [ ] Регистрация / вход
- [ ] Загрузка аватара и баннера, отображение по публичному URL `/uploads/...`
- [ ] Другой пользователь видит обновлённый профиль (после обновления страницы / интервала опроса)
- [ ] Staging защищён (токен/IP), production без лишнего доступа к ЗБТ-инструментам

Процесс релиза и отката: **`deploy/RELEASE.md`**.
