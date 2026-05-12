# RELEASE — сборка APK / релиз

Мобильное приложение «Чайные достижения» (Expo SDK 52, React Native).

## Коммуникации с сервером

- **HTTPS** подразумевается для тестового и продакшен-билдов. По умолчанию **HTTP (cleartext) выключен** для нативного Android (см. `app.config.ts` + флаг только при необходимости `EXPO_ANDROID_ALLOW_CLEARTEXT=true` в `.env` при локальном prebuild к LAN-серверу).
- Если в release не задан `EXPO_PUBLIC_API_BASE_URL`, при старте показывается экран ошибки конфигурации (`ApiReleaseGate`).

---

## Одна команда к APK в облаке (после первичной настройки аккаунта)

Требование: один раз выполнены **Expo login** и **`npm run eas:init`** (появился `extra.eas.projectId` или `.eas/project.json`), а URL API указан локально или в Expo Environment Variables.

Из каталога `mobile-app`:

```bash
npm ci
npm run build:apk:cloud
```

Скрипт `scripts/cloud-apk.cjs` проверит привязку проекта, сессию (`eas whoami` или `EXPO_TOKEN`) и запустит `eas build ... --profile preview-apk --non-interactive --wait`.

**Профиль по умолчанию:** `preview-apk`.

**Другой профиль:**

```bash
node scripts/cloud-apk.cjs production-aab
# или переменная:
EAS_PROFILE=production-aab npm run build:apk:cloud
```

Из GitHub используйте workflow **Mobile Android APK (EAS Cloud)** — он выставляет `EAS_PROFILE` из поля формы и вызывает `npm run build:apk:cloud`.

---

## Как скачать APK после сборки

1. Откройте [Expo Dashboard](https://expo.dev) → проект приложения → **Builds**.
2. Выберите завершённый Android build (профиль `preview-apk`).
3. **Download** на артефакт **`.apk`** (размер см. на странице билда или в свойствах скачанного файла).

---

## Как установить APK на Android

1. Скопируйте файл на телефон (Drive, Telegram, USB, ADB и т.д.).
2. На устройстве откройте файл и разрешите «установку из этого источника» при необходимости (зависит от версии Android и OEM).
3. Либо с ПК при включённом USB-режиме отладки:

   ```bash
   adb install -r chai-achievements.apk
   ```

Не нужен Expo Go и Metro: это **standalone** сборка.

---

## Инкремент версий перед выкладкой

| Поле | Где задаётся | Когда повышать |
|------|----------------|----------------|
| **Версия пользователю** `expo.version` | `app.json` (`"version":"0.x.y"`) | Каждый значимый релиз для тестеров и стора |
| **`android.versionCode`** | `app.json` → `expo.android.versionCode` | Каждый новый файл в Play / при конфликте «установка поверх старой сборки» |
| **runtimeVersion** | `app.json` → `runtimeVersion.policy: appVersion` | Синхронизируется с `expo.version` по политике |

> **Не включали `autoIncrement` в eas.json**, т.к. при динамическом `app.config.ts` возможны ошибки EAS CLI; см. обсуждения в expo/eas-cli. Надёжный путь — ручное увеличение `versionCode` перед сборкой продакшен-AAB.

---

## Production release vs Google Play

| Цель | Команда / профиль | Артефакт |
|------|-------------------|----------|
| Внутреннее тестирование | `npm run build:apk:cloud` → `preview-apk` | **APK** |
| Google Play (internal / production трек) | `npm run build:apk:cloud:submit` → `production-aab` | **AAB** (+ далее Submit в консоли Play или `eas submit`) |

Подробности по ключам Expo, токенам и CI см. **`BUILD_GUIDE.md`**.

---

## Ресурсы брендинга перед публичным релизом

Сейчас в `assets/` могут быть **временные** иконки/splash — см. `assets/README.md`. Замените на финальные PNG перед загрузкой в магазин.

---

## См. также

- **`BUILD_GUIDE.md`** — аккаунт, EAS Init, секреты, локальная и CI сборка  
- **`TEST_CHECKLIST.md`** — ручной регресс на устройстве  
