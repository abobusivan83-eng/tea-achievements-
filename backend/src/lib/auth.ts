import jwt from "jsonwebtoken";
import type { Request } from "express";
import { env } from "./env.js";

export type JwtUser = {
  sub: string;
  role: "USER" | "ADMIN" | "CREATOR";
};

export function signToken(payload: JwtUser) {
  // Минимальный payload: sub (user id) и role для UI; права на сервере всегда перепроверяются.
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtUser {
  return jwt.verify(token, env.JWT_SECRET) as JwtUser;
}

export function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

