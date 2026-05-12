/**
 * HTTP-клиент приложения.
 *
 * Бэкенд: только JWT в `Authorization: Bearer` (см. backend/src/lib/auth.ts).
 * Нет httpOnly cookies, нет refresh token — срок 7d или 30d (`rememberMe`).
 * После истечения exp на клиенте или 401 на защищённом маршруте — сессия сбрасывается, нужен повторный вход.
 */
import axios, { type AxiosInstance } from "axios";
import axiosRetry from "axios-retry";
import { getApiBaseUrl, getStagingAccessToken } from "../services/env";
import { useAuthStore } from "../store/authStore";
import { isPublicAuthUrl } from "./authPaths";
import { API_MAX_RETRIES, API_TIMEOUT_MS } from "./config";
import { isJwtExpired } from "../lib/jwt";
import { registerHttpClientInvalidator } from "./sessionTransport";

let instance: AxiosInstance | null = null;

function buildInstance(): AxiosInstance {
  const client = axios.create({
    baseURL: getApiBaseUrl(),
    timeout: API_TIMEOUT_MS,
    headers: { "Content-Type": "application/json" },
    validateStatus: (s) => s >= 200 && s < 300,
  });

  axiosRetry(client, {
    retries: API_MAX_RETRIES,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
      const status = error.response?.status;
      if (status != null && status >= 500 && status < 600) return true;
      return axiosRetry.isNetworkError(error);
    },
  });

  client.interceptors.request.use(async (config) => {
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    const token = useAuthStore.getState().token;
    if (token) {
      if (isJwtExpired(token)) {
        await useAuthStore.getState().clearSession();
        return Promise.reject(
          new axios.AxiosError("Сессия истекла", "ERR_SESSION_EXPIRED", config, undefined, undefined),
        );
      }
      config.headers.Authorization = `Bearer ${token}`;
    }

    const staging = getStagingAccessToken();
    if (staging) {
      config.headers["x-staging-access-token"] = staging;
    }

    return config;
  });

  client.interceptors.response.use(
    (res) => res,
    async (error: unknown) => {
      if (!axios.isAxiosError(error)) return Promise.reject(error);
      const status = error.response?.status;
      const url = error.config?.url ?? "";
      if (
        status === 401 &&
        !isPublicAuthUrl(url) &&
        useAuthStore.getState().token &&
        error.config?.headers?.Authorization
      ) {
        await useAuthStore.getState().clearSession();
      }
      return Promise.reject(error);
    },
  );

  return client;
}

export function getApiClient(): AxiosInstance {
  if (!instance) {
    instance = buildInstance();
  }
  return instance;
}

registerHttpClientInvalidator(() => {
  instance = null;
});
