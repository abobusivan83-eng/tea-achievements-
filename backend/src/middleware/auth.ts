import type { NextFunction, Request, Response } from "express";
import { getBearerToken, verifyToken } from "../lib/auth.js";
import { fail } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

export type AuthedRequest = Request & {
  user?: { id: string; role: "USER" | "ADMIN" | "CREATOR" };
};

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = getBearerToken(req);
  if (!token) return fail(res, 401, "Not authenticated");

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, role: payload.role };

    // Presence heartbeat: update timestamp only if it's been enough time since last update.
    // This avoids writing on every single request while still letting UI compute offline reliably.
    try {
      const now = new Date();
      const threshold = new Date(now.getTime() - 15_000);
      await prisma.user.updateMany({
        where: {
          id: payload.sub,
          OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: threshold } }],
        },
        data: { lastActiveAt: now },
      });
    } catch {
      // If migration is not applied yet, keep auth working.
    }

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

