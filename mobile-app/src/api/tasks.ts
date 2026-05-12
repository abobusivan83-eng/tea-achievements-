import axios from "axios";
import type { ApiResponse } from "../types/api";
import { apiRequest } from "./request";
import { getApiClient } from "./client";
import { ApiError } from "./http";
import type { TaskItem } from "../types/tasks";

export type { TaskItem } from "../types/tasks";

export async function fetchTasks(): Promise<TaskItem[]> {
  const list = await apiRequest.get<TaskItem[]>("/api/tasks");
  return list.map((task) => ({
    ...task,
    mySubmission: task.mySubmission ?? task.submission ?? null,
  }));
}

export type TaskEvidencePick = { uri: string; name: string; type: string };

export async function submitTaskWithProgress(
  taskId: string,
  message: string,
  files: TaskEvidencePick[],
  onProgress: (pct: number, status: string) => void,
): Promise<unknown> {
  const client = getApiClient();
  const form = new FormData();
  form.append("message", message);
  for (const f of files) {
    form.append("files", { uri: f.uri, name: f.name, type: f.type } as unknown as Blob);
  }
  onProgress(0, "Отправка…");
  try {
    const res = await client.post<ApiResponse<unknown>>(`/api/tasks/${taskId}/submit`, form, {
      onUploadProgress: (ev) => {
        if (ev.total) {
          const pct = Math.min(100, Math.max(1, Math.round((ev.loaded / ev.total) * 100)));
          onProgress(pct, "Загрузка файлов…");
        }
      },
    });
    const json = res.data;
    if (!json || typeof json !== "object" || !("ok" in json)) {
      throw new ApiError("Некорректный ответ сервера", res.status);
    }
    if (!json.ok) throw new ApiError(json.error.message, res.status);
    onProgress(100, "Готово");
    return json.data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (axios.isAxiosError(e)) {
      const data = e.response?.data as ApiResponse<unknown> | undefined;
      if (data && typeof data === "object" && "ok" in data && data.ok === false && "error" in data) {
        throw new ApiError((data as { error: { message: string } }).error.message, e.response?.status);
      }
      if (!e.response) throw new ApiError("Сеть недоступна. Повторите попытку.", 0);
      throw new ApiError(`Ошибка ${e.response.status}`, e.response.status);
    }
    throw e;
  }
}
