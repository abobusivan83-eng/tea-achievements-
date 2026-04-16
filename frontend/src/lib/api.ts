import { API_BASE_URL, STAGING_ACCESS_TOKEN } from "./config";
import { useLoading } from "../state/loading";
import { getStoredAuthToken } from "./authStorage";

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error: { message: string } };
type ApiResp<T> = ApiOk<T> | ApiErr;

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

function getToken() {
  return getStoredAuthToken();
}

type ApiFetchOptions = RequestInit & {
  silent?: boolean;
};

export async function apiFetch<T>(path: string, init?: ApiFetchOptions): Promise<T> {
  const token = getToken();
  const { silent, ...requestInit } = init ?? {};
  if (!silent) {
    useLoading.getState().start();
  }
  try {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}${path}`, {
        ...requestInit,
        headers: {
          ...(requestInit.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(STAGING_ACCESS_TOKEN ? { "x-staging-access-token": STAGING_ACCESS_TOKEN } : {}),
        },
      });
    } catch {
      throw new ApiError("Сервер недоступен. Проверьте сеть или попробуйте позже.", 0);
    }

    const text = await res.text();
    let json: ApiResp<T> | null = null;
    if (text) {
      try {
        json = JSON.parse(text) as ApiResp<T>;
      } catch {
        throw new ApiError("Некорректный ответ сервера", res.status);
      }
    }

    if (!res.ok) {
      const msg =
        json && "ok" in json && !json.ok ? json.error.message : res.statusText || "Request failed";
      throw new ApiError(msg, res.status);
    }
    if (!json || !("ok" in json) || !json.ok) {
      throw new ApiError((json as ApiErr)?.error?.message ?? "Request failed", res.status);
    }
    return (json as ApiOk<T>).data;
  } finally {
    if (!silent) {
      useLoading.getState().end();
    }
  }
}

export async function apiDelete<T>(path: string) {
  return apiFetch<T>(path, { method: "DELETE" });
}

export async function apiJson<T>(
  path: string,
  body: unknown,
  method: string = "POST",
  extraHeaders?: Record<string, string>,
  options?: ApiFetchOptions,
) {
  return apiFetch<T>(path, {
    ...(options ?? {}),
    method,
    headers: { "Content-Type": "application/json", ...(extraHeaders ?? {}) },
    body: JSON.stringify(body),
  });
}

export async function apiUpload<T>(path: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<T>(path, { method: "POST", body: form });
}

export async function apiUploadMany<T>(path: string, files: File[]) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  return apiFetch<T>(path, { method: "POST", body: form });
}

