**Release Flow**
`development -> staging (ZBT) -> production`

Новые функции сначала попадают только в `staging`, проходят проверку, и только потом выкатываются в `production`.

**Environments**
- `staging`: `zbt.tea-achievements.com`
- `production`: `tea-achievements.com`

У каждой среды должны быть:
- свой backend instance
- своя PostgreSQL база
- свой `.env`
- свой compose stack / volume

**Env Files**
Backend:
- `backend/.env.staging`
- `backend/.env.production`

Frontend:
- `frontend/.env.staging`
- `frontend/.env.production`

Минимальные параметры:
- `DATABASE_URL`
- `JWT_SECRET`
- `PORT`
- `API_URL`

Рекомендуемые дополнительные параметры:
- `FRONTEND_ORIGIN`
- `APP_ENV`
- `TRUST_PROXY`
- `STAGING_ACCESS_TOKEN`
- `STAGING_IP_WHITELIST`

**Staging Access**
Для `staging` проект поддерживает два способа доступа:
- IP whitelist через `STAGING_IP_WHITELIST`
- token через заголовок `X-Staging-Access-Token`

Бэкенд сам блокирует запросы к staging API, если клиент не прошел ни по токену, ни по whitelist.

Дополнительно для полного ограничения фронтенда используй reverse proxy:
- `deploy/nginx.staging.conf`

**Database Separation**
Нельзя использовать одну и ту же БД для staging и production.

Примеры:
- `tea_achievements_staging`
- `tea_achievements_production`

**Deploy Commands**
Staging:
```bash
cp backend/.env.staging.example backend/.env.staging
cp frontend/.env.staging.example frontend/.env.staging
docker compose -f deploy/docker-compose.staging.yml up -d --build
docker compose -f deploy/docker-compose.staging.yml exec staging-backend npx prisma migrate deploy
```

Production:
```bash
cp backend/.env.production.example backend/.env.production
cp frontend/.env.production.example frontend/.env.production
docker compose -f deploy/docker-compose.production.yml up -d --build
docker compose -f deploy/docker-compose.production.yml exec production-backend npx prisma migrate deploy
```

**Release Rules**
- никакого прямого deploy в production для новых функций
- hotfix в production допустим только для критических аварий
- после hotfix изменения должны быть возвращены в staging
- перед production deploy обязательно прогонять ZBT-проверку

**Recommended Workflow**
1. Разработка локально.
2. Выкатка в `staging`.
3. Тестирование ZBT.
4. Исправление найденных багов.
5. Повторная проверка staging.
6. Перенос той же проверенной версии в `production`.
