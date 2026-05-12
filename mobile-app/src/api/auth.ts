import { apiRequest } from "./request";
import type { LoginResponse, RegisterRequestResponse } from "../types/api";

export async function loginRequest(body: {
  login: string;
  password: string;
  rememberMe?: boolean;
}): Promise<LoginResponse> {
  return apiRequest.post<LoginResponse>("/api/auth/login", body);
}

export async function registerRequest(body: {
  nickname: string;
  password: string;
  telegramUsername: string;
}): Promise<RegisterRequestResponse> {
  return apiRequest.post<RegisterRequestResponse>("/api/auth/register/request", body);
}

export async function registerVerify(body: {
  linkToken: string;
  code: string;
  rememberMe?: boolean;
}): Promise<LoginResponse> {
  return apiRequest.post<LoginResponse>("/api/auth/register/verify", body);
}

/** Полный профиль как на сайте (уровень, рамки, URL медиа и т.д.). */
export async function fetchMe(): Promise<Record<string, unknown>> {
  return apiRequest.get<Record<string, unknown>>("/api/auth/me");
}
