import type { NextFunction, Request, Response } from "express";
import { env } from "../lib/env.js";
import { fail } from "../lib/http.js";

function normalizeIp(ip: string | undefined): string | null {
  if (!ip) return null;
  const cleaned = ip.replace("::ffff:", "").trim();
  return cleaned === "::1" ? "127.0.0.1" : cleaned;
}

function getAllowedIps() {
  return new Set(
    (env.STAGING_IP_WHITELIST ?? "")
      .split(",")
      .map((part) => normalizeIp(part))
      .filter((value): value is string => Boolean(value)),
  );
}

function hasValidToken(req: Request) {
  const expected = env.STAGING_ACCESS_TOKEN?.trim();
  if (!expected) return false;

  const headerToken =
    req.header("x-staging-access-token")?.trim() ??
    req.header("x-zbt-token")?.trim() ??
    undefined;
  if (headerToken && headerToken === expected) return true;

  const auth = req.header("authorization");
  if (auth?.startsWith("Bearer ")) {
    const bearer = auth.slice("Bearer ".length).trim();
    if (bearer === expected) return true;
  }

  return false;
}

export function requireStagingAccess(req: Request, res: Response, next: NextFunction) {
  if (env.APP_ENV !== "staging") return next();
  if (req.method === "OPTIONS") return next();
  if (req.path === "/api/health") return next();

  const allowedIps = getAllowedIps();
  const requestIp = normalizeIp(req.ip) ?? normalizeIp(req.socket.remoteAddress ?? undefined);
  if (requestIp && allowedIps.has(requestIp)) return next();
  if (hasValidToken(req)) return next();

  return fail(res, 403, "Staging access denied");
}
