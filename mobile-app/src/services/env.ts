import Constants from "expo-constants";

type Extra = {
  apiBaseUrl?: string;
  stagingAccessToken?: string;
};

function readExtra(): Extra {
  const e = Constants.expoConfig?.extra as Extra | undefined;
  return e ?? {};
}

/**
 * Базовый URL API. Источник: app.config.ts → extra (из EXPO_PUBLIC_* при сборке)
 * или переменные окружения в dev.
 */
export function getApiBaseUrl(): string {
  const fromExtra = readExtra().apiBaseUrl?.trim();
  if (fromExtra) return fromExtra.replace(/\/+$/, "");

  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  if (__DEV__) {
    return "http://localhost:4000";
  }

  throw new Error(
    "Задайте EXPO_PUBLIC_API_BASE_URL (или extra.apiBaseUrl в app.config) для production-сборки.",
  );
}

export function getStagingAccessToken(): string | undefined {
  const t = readExtra().stagingAccessToken?.trim() || process.env.EXPO_PUBLIC_STAGING_ACCESS_TOKEN?.trim();
  return t || undefined;
}
