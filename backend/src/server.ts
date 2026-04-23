import "express-async-errors";
import express from "express";
import cors from "cors";
import path from "path";
import { randomUUID } from "crypto";
import compression from "compression";
import morgan from "morgan";
import helmet from "helmet";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { mapErrorToResponse } from "./lib/mapErrorResponse.js";
import { prisma } from "./lib/prisma.js";
import { logAdminAction } from "./lib/adminAudit.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { achievementsRouter } from "./routes/achievements.js";
import { leaderboardRouter } from "./routes/leaderboard.js";
import { adminRouter } from "./routes/admin.js";
import { supportRouter } from "./routes/support.js";
import { shopRouter } from "./routes/shop.js";
import { giftsRouter } from "./routes/gifts.js";
import { tasksRouter } from "./routes/tasks.js";
import { fail, ok } from "./lib/http.js";
import { isTelegramConfigured, startTelegramLongPolling } from "./lib/telegram.js";
import { startRegistrationOtpCleanup } from "./lib/registrationCleanup.js";
import { requireStagingAccess } from "./middleware/stagingAccess.js";
import { uploadPublicDir, uploadRootAbs } from "./lib/uploadPaths.js";

const app = express();
app.set("trust proxy", env.TRUST_PROXY);

const port = process.env.PORT || env.PORT || 3000;

async function logDatabaseEncoding() {
  try {
    // В PostgreSQL проверяем кодировку, в SQLite пропускаем
    if (env.DATABASE_URL.startsWith("file:")) {
      logger.info("database_type", { type: "sqlite" });
      return;
    }
    const rows = await prisma.$queryRaw<Array<{ server_encoding: string; client_encoding: string }>>`
      SELECT
        current_setting('server_encoding') AS server_encoding,
        current_setting('client_encoding') AS client_encoding
    `;
    const encoding = rows[0];
    if (!encoding) return;
    logger.info("database_encoding", encoding);
    if (encoding.server_encoding !== "UTF8" || encoding.client_encoding !== "UTF8") {
      logger.warn("database_encoding_not_utf8", encoding);
    }
    console.log("✅ Успешное подключение к Supabase (Pooler IPv4)");
  } catch (error) {
    logger.warn("database_encoding_check_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const corsOrigins = ["https://tea-achievements.vercel.app", "http://localhost:5173"];

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(
  compression({
    threshold: 512,
    filter: (req, res) => {
      if (req.path.startsWith(`/${uploadPublicDir}`)) return false;
      return compression.filter(req, res);
    },
  }),
);

// НАСТРОЙКА CORS: Разрешаем доступ вашему сайту на Vercel
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
);

app.use(requireStagingAccess);
app.use(
  morgan(env.APP_ENV === "production" ? "combined" : "dev", {
    skip: (req) => req.path === "/api/health",
  }),
);
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const reqId = String(req.headers["x-request-id"] ?? randomUUID());
  res.setHeader("X-Request-Id", reqId);
  const started = Date.now();
  req.setTimeout(env.REQUEST_TIMEOUT_MS);
  res.setTimeout(env.REQUEST_TIMEOUT_MS);
  res.on("finish", () => {
    if (req.path === "/api/health" || req.path === "/api/ready") return;
    const elapsedMs = Date.now() - started;
    if (elapsedMs >= env.SLOW_REQUEST_MS) {
      logger.warn("slow_http_request", {
        reqId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        elapsedMs,
      });
    }
  });
  next();
});

// Статика загрузок
app.use(
  `/${uploadPublicDir}`,
  express.static(uploadRootAbs, {
    maxAge: "30d",
    immutable: true,
    setHeaders(res) {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
    },
  }),
);

app.get("/", (_req, res) => res.send("Tea Cabinet API is alive!"));
app.get("/api/health", (_req, res) => ok(res, { status: "ok", env: env.APP_ENV, apiUrl: env.API_URL }));
app.get("/api/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return ok(res, { status: "ready" });
  } catch (e: unknown) {
    logger.error("readiness_failed", { err: e instanceof Error ? e.message : String(e) });
    return fail(res, 503, "Service unavailable");
  }
});
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/achievements", achievementsRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/admin", adminRouter);
app.use("/api/support", supportRouter);
app.use("/api/shop", shopRouter);
app.use("/api/gifts", giftsRouter);
app.use("/api/tasks", tasksRouter);

let cachedAuditActorId: string | null = null;
let cachedAuditActorPromise: Promise<string> | null = null;

async function getAuditActorId() {
  if (cachedAuditActorId) return cachedAuditActorId;
  if (!cachedAuditActorPromise) {
    cachedAuditActorPromise = prisma.user
      .findFirst({
        where: { role: { in: ["ADMIN", "CREATOR"] } },
        select: { id: true },
      })
      .then((u) => {
        cachedAuditActorId = u?.id ?? null;
        if (!cachedAuditActorId) throw new Error("No admin/creator user found to write audit logs");
        return cachedAuditActorId;
      });
  }
  return cachedAuditActorPromise;
}

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const mapped = mapErrorToResponse(err);
  const line = `${req.method} ${req.originalUrl}`;
  const errMeta =
    err instanceof Error
      ? { message: err.message, stack: err.stack, status: mapped.status }
      : { err: String(err), status: mapped.status };
  if (mapped.logAsError) {
    logger.error(`HTTP ${line}`, errMeta);
  } else if (mapped.status >= 500) {
    logger.error(`HTTP ${line}`, errMeta);
  } else {
    logger.warn(`HTTP ${line}`, { status: mapped.status, message: mapped.message });
  }

  // Админ-аудит для фикса: пишем в `AdminAuditLog`, даже если ошибку получил не админ.
  // Логирование делаем "best-effort", чтобы не ломать обработку ошибки.
  if (mapped.logAsError || mapped.status >= 500) {
    const anyErr = err as any;
    const reqId = String(req.headers["x-request-id"] ?? "");
    void (async () => {
      try {
        const adminId = await getAuditActorId();
        await logAdminAction(prisma, {
          adminId,
          action: "http.error",
          summary: `Ошибка HTTP ${mapped.status}: ${mapped.message}`,
            targetUserId: anyErr?.reqUserId ?? (req as any)?.user?.id ?? null,
          meta: {
            requestId: reqId || undefined,
            method: req.method,
            path: req.originalUrl,
            mapped,
            errMessage: anyErr?.message ?? (err instanceof Error ? err.message : String(err)),
            errStack: err instanceof Error ? err.stack : undefined,
            prismaCode: typeof anyErr?.code === "string" ? anyErr.code : null,
            prismaMeta: anyErr?.meta ?? null,
          },
        });
      } catch {
        // ignore
      }
    })();
  }

  return fail(res, mapped.status, mapped.message);
});

const server = app.listen(port, () => {
  const maskedUrl = env.DATABASE_URL.replace(/:([^:@]+)@/, ":****@");
  logger.info(`API listening on port ${port} (${env.API_URL}) [${env.APP_ENV}]`);
  logger.info(`Using DATABASE_URL: ${maskedUrl}`);
  void logDatabaseEncoding();
  if (process.env.RENDER === "true") {
    logger.warn(
      "[tea] Render: диск эфемерный — файлы в uploads/ могут пропасть после деплоя/рестарта.",
    );
  }
  if (isTelegramConfigured()) {
    void startTelegramLongPolling();
  }
  void startRegistrationOtpCleanup();
});
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
