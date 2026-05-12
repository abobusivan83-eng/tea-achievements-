import type { AxiosRequestConfig } from "axios";
import { getApiClient } from "./client";
import { parseEnvelope } from "./http";

/**
 * Централизованный доступ к API (все методы проходят через один axios + interceptors).
 */
export const apiRequest = {
  get<T>(url: string, config?: AxiosRequestConfig) {
    return parseEnvelope<T>(getApiClient(), { ...config, method: "GET", url });
  },

  delete<T>(url: string, config?: AxiosRequestConfig) {
    return parseEnvelope<T>(getApiClient(), { ...config, method: "DELETE", url });
  },

  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return parseEnvelope<T>(getApiClient(), { ...config, method: "POST", url, data });
  },

  patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return parseEnvelope<T>(getApiClient(), { ...config, method: "PATCH", url, data });
  },

  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return parseEnvelope<T>(getApiClient(), { ...config, method: "PUT", url, data });
  },

  /** Низкоуровневый доступ для нестандартных случаев. */
  raw: parseEnvelope,
  client: getApiClient,
};
