import type { ExpoConfig } from "expo/config";

/** Разрешить HTTP (LAN/localhost на устройстве). Для тестового APK продакшен-API с HTTPS оставьте unset. */
const androidAllowCleartext = process.env.EXPO_ANDROID_ALLOW_CLEARTEXT === "true";

/**
 * Базовый URL API задаётся через EXPO_PUBLIC_API_BASE_URL (см. .env.example).
 * Не хардкодим production URL в коде.
 */
export default ({ config }: { config: ExpoConfig }): ExpoConfig => ({
  ...config,
  /** Уменьшает перекрытие полей вводом на Android при scroll + keyboard */
  android: {
    ...config.android,
    softwareKeyboardLayoutMode: "resize",
  },
  plugins: [
    ...(config.plugins ?? []),
    "expo-font",
    "expo-secure-store",
    "expo-system-ui",
    [
      "expo-image-picker",
      {
        photosPermission: "Доступ к фото для доказательств по заданиям.",
        cameraPermission: "Камера для съёмки доказательств.",
      },
    ],
    /** По умолчанию cleartext выключён (HTTPS). LAN/HTTP: EXPO_ANDROID_ALLOW_CLEARTEXT=true при prebuild. */
    [
      "expo-build-properties",
      {
        android: {
          usesCleartextTraffic: androidAllowCleartext,
          /** Hermes включён по умолчанию в RN 0.76+, не переопределяем. Включают minify на Expo после отладки Proguard/rules. */
          enableMinifyInReleaseBuilds: false,
          enableShrinkResourcesInReleaseBuilds: false,
        },
      },
    ],
  ],
  extra: {
    eas: {
      projectId: "9db84d8b-b0bd-4f5a-ab4c-8e499487ac58",
    },
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
    stagingAccessToken: process.env.EXPO_PUBLIC_STAGING_ACCESS_TOKEN ?? "",
  },
});
