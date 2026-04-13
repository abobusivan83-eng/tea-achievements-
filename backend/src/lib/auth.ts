import jwt from "jsonwebtoken";
import type { Request } from "express";
import { env } from "./env.js";

export type JwtUser = {
  sub: string;
  role: "USER" | "ADMIN" | "CREATOR";
};

const JWT_EXPIRES_SESSION = "7d";
const JWT_EXPIRES_REMEMBER = "30d";

export function signToken(payload: JwtUser, options?: { rememberMe?: boolean }) {
  const expiresIn = options?.rememberMe ? JWT_EXPIRES_REMEMBER : JWT_EXPIRES_SESSION;
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
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

