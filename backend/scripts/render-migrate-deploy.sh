#!/usr/bin/env sh
# Временная схема для Supabase: синхронизируем introspection-схему без опоры на историю migrate.
#
# DDL (CREATE TABLE …) через transaction pooler (pgbouncer) часто ненадёжен — если задан DIRECT_URL,
# db push идёт с ним; иначе fallback на DATABASE_URL + предупреждение в лог.
printf '%s\n' "[migrate] prisma db push --accept-data-loss (замена migrate deploy на этом этапе)" >&2

if [ -n "${DIRECT_URL:-}" ]; then
  printf '%s\n' "[migrate] db push через DIRECT_URL (сессионный Postgres, DDL)" >&2
  DATABASE_URL="$DIRECT_URL" npx prisma db push --accept-data-loss --skip-generate || exit $?
else
  printf '%s\n' "[migrate] WARN: DIRECT_URL пустой — db push через DATABASE_URL; при ошибках добавь DIRECT_URL из Supabase" >&2
  npx prisma db push --accept-data-loss --skip-generate || exit $?
fi

printf '%s\n' "[migrate] prisma generate перед node" >&2
npx prisma generate || exit $?

exec npm start
