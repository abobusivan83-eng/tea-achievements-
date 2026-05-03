#!/usr/bin/env sh
# Перед migrate deploy снимает «failed», если миграция когда-то упала (Prisma P3009).
FAILED_MIGRATION="20260503181500_repair_telegram_broadcast_template_media_columns"

if npx prisma migrate resolve --rolled-back "$FAILED_MIGRATION"; then
  printf '%s\n' "[migrate] failed migration помечена как rolled-back: $FAILED_MIGRATION" >&2
else
  printf '%s\n' "[migrate] migrate resolve exit $? (обычно норма, если нет висящего failed)" >&2
fi

npx prisma migrate deploy || exit $?
exec npm start
