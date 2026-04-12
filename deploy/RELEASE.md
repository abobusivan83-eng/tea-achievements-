# Релизный цикл: staging (ЗБТ) → production

## Роли окружений

| Окружение | Домен (пример)        | База данных                    | Backend порт |
|----------|------------------------|--------------------------------|--------------|
| Staging  | `zbt.tea-achievements.com` | отдельная БД (например `tea_achievements_staging`) | `4001` |
| Production | `tea-achievements.com`   | отдельная БД (`tea_achievements_production`) | `4000` |

Фронтенд собирается отдельно для каждого режима (`VITE_API_URL` указывает на свой домен, для ЗБТ при необходимости задайте `VITE_STAGING_ACCESS_TOKEN`).

## Стандартный выпуск

1. **Слить изменения в ветку для ЗБТ** (например `staging` или `develop`) и задеплоить на сервер ЗБТ.
2. **Проверить** чеклист из `deploy/DEPLOY.md` (раздел «Финальная проверка») на `zbt.tea-achievements.com`.
3. После подтверждения **слить в `main` / production-ветку** и задеплоить на production.
4. На каждом окружении после обновления кода:
   - `npm ci && npm run build` в `backend` и `frontend`
   - `npx prisma migrate deploy` (из `backend`, с верным `DATABASE_URL`)
   - при необходимости `npx prisma db seed` (идемпотентный upsert; пароль админа меняется только если задан `ADMIN_PASSWORD`)

## Откат (rollback)

1. **Код:** вернуть предыдущий тег коммита (`git checkout <tag>` или `git revert`), пересобрать фронт и бэкенд, перезапустить PM2 (`pm2 restart tea-backend-production` и т.д.).
2. **Миграции БД:** откат миграций вниз (`prisma migrate resolve` / ручной SQL) делайте только осознанно; для критичных релизов держите бэкап БД перед `migrate deploy`.
3. **Статика и загрузки:** при откате бэкенда старые файлы в `uploads/` обычно остаются совместимыми; при смене схемы URL проверяйте `PUBLIC_BASE_URL` / `API_URL`.

## Мониторинг после релиза

- `pm2 status`, `pm2 logs tea-backend-production --lines 200`
- `tail -f /var/log/nginx/tea-achievements.error.log`
- `curl -sS https://tea-achievements.com/api/health | jq`

## Рекомендации

- Деплой в production только из защищённой ветки и после зелёного CI (lint, build, prisma validate).
- Храните секреты вне репозитория; для ЗБТ ограничьте доступ токеном `STAGING_ACCESS_TOKEN` и при необходимости `STAGING_IP_WHITELIST`.
