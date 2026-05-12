import axios from "axios";
import type { ApiResponse } from "../types/api";
import { getApiClient } from "./client";
import { ApiError } from "./http";
import { apiRequest } from "./request";
import type { GiftInboxItem, GiftOutboxItem } from "../types/gifts";

export async function fetchGiftsInbox(): Promise<GiftInboxItem[]> {
  return apiRequest.get<GiftInboxItem[]>("/api/gifts/inbox");
}

export async function fetchGiftsOutbox(): Promise<GiftOutboxItem[]> {
  return apiRequest.get<GiftOutboxItem[]>("/api/gifts/outbox");
}

export async function markGiftsReadAll(): Promise<void> {
  await apiRequest.post<unknown>("/api/gifts/read", { markAll: true });
}

function newIdempotencyKey() {
  return `app-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

export async function sendGiftRequest(body: {
  toUserId: string;
  xpAmount: number;
  message?: string | null;
}): Promise<unknown> {
  const client = getApiClient();
  try {
    const res = await client.post<ApiResponse<unknown>>("/api/gifts/send", body, {
      headers: { "Idempotency-Key": newIdempotencyKey() },
    });
    const json = res.data;
    if (!json || typeof json !== "object" || !("ok" in json)) {
      throw new ApiError("Некорректный ответ", res.status);
    }
    if (!json.ok) throw new ApiError(json.error.message, res.status);
    return json.data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (axios.isAxiosError(e)) {
      const data = e.response?.data as ApiResponse<unknown> | undefined;
      if (data && typeof data === "object" && "ok" in data && data.ok === false) {
        throw new ApiError((data as { error: { message: string } }).error.message, e.response?.status);
      }
      if (!e.response) throw new ApiError("Сеть недоступна", 0);
      throw new ApiError(`Ошибка ${e.response.status}`, e.response.status);
    }
    throw e;
  }
}
