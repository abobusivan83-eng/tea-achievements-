#!/bin/bash

# Скрипт автоматического деплоя для Clan Salamanca
# Использование: ./deploy-vps.sh [branch_name]
# По умолчанию используется ветка main

BRANCH=${1:-main}
PROJECT_ROOT="/var/www/clan-salamanca" # Поправьте путь, если он отличается
NGINX_DIST="/var/www/clan-salamanca/frontend/dist" # Путь, куда rsync копирует файлы

echo "🚀 Начинаем деплой ветки $BRANCH..."

# 1. Переход в папку проекта
cd $PROJECT_ROOT || { echo "❌ Ошибка: папка $PROJECT_ROOT не найдена"; exit 1; }

# 2. Обновление кода
echo "📥 Затягиваем изменения из Git..."
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH

# 3. Сборка фронтенда
echo "🏗️ Собираем фронтенд..."
cd frontend
npm ci
npm run build

# 4. Обновление файлов для Nginx
echo "📂 Копируем файлы в директорию Nginx..."
# Если папка сборки отличается от той, что в Nginx, используем rsync
# В большинстве случаев Nginx просто смотрит в frontend/dist
# Но если нужно копировать отдельно:
# sudo rsync -a dist/ $NGINX_DIST/

echo "✅ Деплой завершен успешно!"
echo "💡 Не забудьте обновить кеш в браузере (Ctrl+F5)."
