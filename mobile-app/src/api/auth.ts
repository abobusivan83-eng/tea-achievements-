import { apiRequest } from "./request";
import type { LoginResponse } from "../types/api";

export async function loginRequest(body: {
  login: string;
  password: string;
  rememberMe?: boolean;
}): Promise<LoginResponse> {
  return apiRequest.post<LoginResponse>("/api/auth/login", body);
}

/** Полный профиль как на сайте (уровень, рамки, URL медиа и т.д.). */
export async function fetchMe(): Promise<Record<string, unknown>> {
  return apiRequest.get<Record<string, unknown>>("/api/auth/me");
}
