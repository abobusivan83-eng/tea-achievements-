import type { NextFunction, Request, Response } from "express";
import { getBearerToken, verifyToken } from "../lib/auth.js";
import { fail } from "../lib/http.js";

export type AuthedRequest = Request & {
  user?: { id: string; role: "USER" | "ADMIN" | "CREATOR" };
};

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = getBearerToken(req);
  if (!token) return fail(res, 401, "Not authenticated");

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return fail(res, 401, "Invalid token");
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return fail(res, 401, "Not authenticated");
  if (req.user.role !== "ADMIN") return fail(res, 403, "Admin only");
  return next();
}

/** Админ или создатель клана (доступ к достижениям в админ-API). */
export function requireStaff(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return fail(res, 401, "Not authenticated");
  if (req.user.role !== "ADMIN" && req.user.role !== "CREATOR") return fail(res, 403, "Forbidden");
  return next();
}

