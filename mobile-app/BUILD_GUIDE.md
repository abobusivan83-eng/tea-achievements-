# BUILD GUIDE — от нуля до APK

Целевое дерево всегда имеет каталог-приложения **`mobile-app/`** в корне репозитория `clan-salamanca`.

---

## 1. Установить зависимости

```bash
cd mobile-app
npm ci
```

Периодические проверки:

```bash
npm run lint      # TypeScript без emit
npm run doctor    # expo-doctor
```

---

## 2. Указать API (обязательно для релизной сборки)

### Вариант A — файл `.env` (локально перед `eas build`)

```bash
cp .env.example .env
```

Задайте (без завершающего `/`):

```env
EXPO_PUBLIC_API_BASE_URL=https://ваш-бэкенд.example.com
# опционально
EXPO_PUBLIC_STAGING_ACCESS_TOKEN=...
```

`scripts/cloud-apk.cjs` при запуске подхватит строки из `.env` если переменная ещё не задана в окружении.

### Вариант B — Expo Dashboard (удобно для команды без коммита URL)

На [expo.dev](https://expo.dev) → ваш проект → **Environment variables** (или **Secrets**) → добавить `EXPO_PUBLIC_API_BASE_URL` (и опционально `EXPO_PUBLIC_STAGING_ACCESS_TOKEN`) для нужного профиля/окружения.

Тогда локальный `.env` может отсутствовать; скрипт предупредит, но сборка может пройти, если переменные заданы на стороне Expo.

---

## 3. Войти в Expo (интерактивно)

```bash
cd mobile-app
npx eas-cli@latest login
```

Проверка:

```bash
npm run eas:whoami
```

### Для CI / GitHub Actions (без интерактива)

На [Expo Dashboard](https://expo.dev/settings/access-tokens) создайте **Access Token** и сохраните в секрет **`EXPO_TOKEN`** (в GitHub: Settings → Secrets and variables → Actions).

---

## 4. Связать репозиторий с Expo (один раз)

```bash
cd mobile-app
npm run eas:init
```

После успешной инициализации один из следующих источников подхватится `npm run build:apk:cloud`:

- в смерженном конфиге появится `extra.eas.projectId`, **или**
- создаётся `.eas/project.json` (можно закоммитить — см. официальные рекомендации Expo).

Без этого шага команда сборки завершится с явной ошибкой — это ожидаемо.

---

## 5. Конфигурация EAS (`eas.json`)

| Профиль | Нода | Выходной артефакт |
|---------|------|-------------------|
| `preview-apk` | 20.18.1 | **APK** (internal distribution) |
| `production-aab` | 20.18.1 | **AAB** (store) |

`credentialsSource: remote` — keystores управляются EAS Credentials.

Запись в файл с менять только при необходимости изменить версию Node или тип билда.

---

## 6. Команды сборки (шпаргалка)

```bash
cd mobile-app

# Облако, тестовый APK (+ проверки в scripts/cloud-apk.cjs), дождаться окончания
npm run build:apk:cloud

# То же без --wait (закончить CLI сразу после постановки в очередь)
EAS_WAIT=0 npm run build:apk:cloud    # Unix
set EAS_WAIT=0&& npm run build:apk:cloud   # cmd Windows
$env:EAS_WAIT="0"; npm run build:apk:cloud # PowerShell

# Облако, AAB для Google Play (профиль из package.json alias)
npm run build:apk:cloud:submit

# Локальный билд машиной вашего разработчика (Docker/SDK по документам EAS Local)
npm run build:apk:local

# Только генерация каталога android/ (Gradle дальше вручную)
npm run prebuild:android
```

Размер локального Gradle artifact при ручном `assembleRelease`:

`mobile-app/android/app/build/outputs/apk/release/app-release.apk`

(После успешного `expo prebuild` и наличии JDK/SDK.)

---

## 7. Переменные окружения: сводка

| Переменная | Обязательная | Зачем |
|------------|----------------|-------|
| `EXPO_PUBLIC_API_BASE_URL` | Да для рабочего клиента против прод-API | Подстановка в `extra` через `app.config.ts` при сборке |
| `EXPO_PUBLIC_STAGING_ACCESS_TOKEN` | Нет | Заголовок `x-staging-access-token`, если ваш бэкенд так защищён |
| `EXPO_TOKEN` | Да для CI без `eas login` | Неинтерактивный доступ к API Expo |
| `EXPO_ANDROID_ALLOW_CLEARTEXT` | Только если осознанно собираете **HTTP LAN** билд локальным `prebuild` | Включает cleartext в манифесте |
| `EAS_PROFILE` | Нет | Профиль EAS если не задаёте вторым аргументом скриптом |
| `EAS_WAIT` | Нет | `0` = не передаётся `--wait` в `eas build` |

Никогда не коммитьте реальные токены в репозиторий.

---

## 8. GitHub Actions

Файл: **`.github/workflows/mobile-android-eas-apk.yml`**

Секреты репозитория:

- `EXPO_TOKEN`
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_STAGING_ACCESS_TOKEN` (опционально)

В форме workflow параметр **`profile`** по умолчанию `preview-apk`; он экспортируется как `EAS_PROFILE`.

---

## 9. NPM audit без поломки Expo

В проектной цепочке остаются уязвимости в транзитивных пакетах Expo CLI (`xmldom`, `tar`, `postcss`).  
**Не выполнять** `npm audit fix --force`** — это откатит `expo` на несовместимую версию.

Допускается только:

```bash
npm audit fix
```

без флагов, пока экспо остаётся на `~52.0.x`.

---

## Релиз и тест-план поверх сборки

- **`RELEASE.md`** — куда сохранился APK и как ставить на телефон  
- **`TEST_CHECKLIST.md`** — что именно протестировать на устройстве  
