import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from "axios";
import type { ApiResponse } from "../types/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function extractData<T>(res: AxiosResponse<ApiResponse<T>>): T {
  const json = res.data;
  if (!json || typeof json !== "object" || !("ok" in json)) {
    throw new ApiError("Некорректный ответ сервера", res.status);
  }
  if (!json.ok) {
    throw new ApiError(json.error.message, res.status);
  }
  return json.data;
}

function extractFromAxiosError<T>(e: AxiosError<ApiResponse<T>>): never {
  if (e.code === "ERR_SESSION_EXPIRED") {
    throw new ApiError("Сессия истекла. Войдите снова.", 401, e.code);
  }

  const status = e.response?.status;
  const data = e.response?.data;

  if (data && typeof data === "object" && "ok" in data && data.ok === false && "error" in data) {
    throw new ApiError(data.error.message, status, e.code);
  }

  if (!e.response) {
    throw new ApiError("Сервер недоступен. Проверьте сеть.", 0, e.code);
  }

  throw new ApiError(`Ошибка ${status ?? 0}`, status, e.code);
}

/**
 * Унифицированный разбор ответа бэкенда `{ ok, data | error }`.
 * Axios: успех только 2xx; retry обрабатывается в `axios-retry` на уровне клиента.
 */
export async function parseEnvelope<T>(instance: AxiosInstance, config: AxiosRequestConfig): Promise<T> {
  try {
    const res = await instance.request<ApiResponse<T>>(config);
    return extractData(res);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (axios.isAxiosError(e)) {
      return extractFromAxiosError(e as AxiosError<ApiResponse<T>>);
    }
    throw new ApiError("Сервер недоступен. Проверьте сеть.", 0);
  }
}
