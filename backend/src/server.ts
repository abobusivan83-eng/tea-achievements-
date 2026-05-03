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
import {
  bootstrapTelegramWebhook,
  isTelegramBotTokenSet,
  processTelegramUpdate,
} from "./lib/telegram.js";
import { startRegistrationOtpCleanup } from "./lib/registrationCleanup.js";
import { requireStagingAccess } from "./middleware/stagingAccess.js";
import { uploadPublicDir, uploadRootAbs } from "./lib/uploadPaths.js";
import { ensureDefaultProfileAssets } from "./lib/defaultProfileAssets.js";

ensureDefaultProfileAssets();

/** Диагностика БД без пароля и без полного URI (удобно проверять pooler/supabase-проект в Render). */
/** Сравнение ref проекта между pool DATABASE_URL и прямым DIRECT_URL (одинаковый ref обязателен). */
function supabaseProjectRefFromConnectionString(urlStr: string): string | null {
  try {
    const u = new URL(urlStr);
    const user = decodeURIComponent(u.username || "");
    const poolUser = user.match(/^postgres\.([a-z0-9]+)$/i);
    if (poolUser) return poolUser[1].toLowerCase();
    const dbHost = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    if (dbHost) return dbHost[1].toLowerCase();
    return null;
  } catch {
    return null;
  }
}

async function logSupabaseDatasourcePairSanity() {
  const direct = process.env.DIRECT_URL;
  if (!env.DATABASE_URL.startsWith("postgres") || !direct?.startsWith("postgres")) {
    logger.warn("[db] DIRECT_URL не задан или не Postgres — проверьте переменную в Render для Supabase.");
    return;
  }
  const refPool = supabaseProjectRefFromConnectionString(env.DATABASE_URL);
  const refDirect = supabaseProjectRefFromConnectionString(direct);
  logger.info("[db] Supabase: ref из DATABASE_URL (pool) и DIRECT_URL", {
    fromDatabaseUrl: refPool ?? "не распознан",
    fromDirectUrl: refDirect ?? "не распознан",
    refsMatch: refPool && refDirect ? refPool === refDirect : null,
  });
  if (refPool && refDirect && refPool !== refDirect) {
    logger.error(
      "[db] КРИТИЧНО: DATABASE_URL и DIRECT_URL разные проекты Supabase. migrate deploy попадает в одну базу, API в другую — отсюда P2022 и «нет колонки», при этом миграции «все применены».",
    );
  }
}

async function logTelegramBroadcastTemplateColumns() {
  try {
    const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'TelegramBroadcastTemplate'
      ORDER BY ordinal_position
    `;
    logger.info("[db] Колонки таблицы TelegramBroadcastTemplate сейчас в БД", {
      columns: cols.map((c) => c.column_name),
      count: cols.length,
    });
  } catch (e) {
    logger.warn("[db] Не удалось прочитать information_schema по TelegramBroadcastTemplate", {
      err: e instanceof Error ? e.message : String(e),
    });
  }
}

function databaseUrlDiagnostics(raw: string): Record<string, unknown> {
  if (raw.startsWith("file:")) {
    return { kind: "sqlite", hint: "schema file" };
  }
  try {
    const u = new URL(raw);
    const params: Record<string, string> = {};
    u.searchParams.forEach((v, k) => {
      params[k] = /password|passwd|secret|token|key/i.test(k) ? "****" : v;
    });
    const user = decodeURIComponent(u.username || "");
    return {
      kind: "postgresql",
      host: u.hostname,
      port: u.port || "default",
      database: u.pathname.replace(/^\//, "") || "(default)",
      userPreview: user ? `${user.slice(0, Math.min(3, user.length))}***` : "(none)",
      params,
    };
  } catch {
    return { kind: "invalid_url" };
  }
}

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
    skip: (req) => req.path === "/api/health" || req.path === "/api/telegraf-webhook",
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

/** Telegram Bot API webhook (HTTPS только). Ответ мгновенный 200, обработка вне hot path через setImmediate. */
app.post("/api/telegraf-webhook", (req: express.Request, res: express.Response) => {
  console.log("📥 Webhook received");
  const webhookBody = req.body as { update_id?: unknown } | null | undefined;
  const secret = env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const updateId =
    webhookBody &&
    typeof webhookBody === "object" &&
    webhookBody !== null &&
    typeof webhookBody.update_id === "number"
      ? webhookBody.update_id
      : undefined;
  logger.info("[telegram] Webhook received", {
    updateId,
    secretOk: Boolean(secret ? req.header("x-telegram-bot-api-secret-token")?.trim() === secret : true),
  });

  if (secret) {
    const got = req.header("x-telegram-bot-api-secret-token")?.trim();
    if (got !== secret) {
      logger.warn("[telegram] webhook отклонён: неверный X-Telegram-Bot-Api-Secret-Token");
      return res.sendStatus(401);
    }
  }

  const bodyOk =
    webhookBody !== null &&
    webhookBody !== undefined &&
    typeof webhookBody === "object" &&
    !Array.isArray(webhookBody);
  if (!bodyOk) {
    return res.sendStatus(400);
  }
  res.sendStatus(200);
  setImmediate(() => {
    void processTelegramUpdate(webhookBody as Parameters<typeof processTelegramUpdate>[0]).catch((err) =>
      logger.error("[telegram] processTelegramUpdate", {
        err: err instanceof Error ? err.stack ?? err.message : String(err),
      }),
    );
  });
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
  logger.info(`API listening on port ${port} (${env.API_URL}) [${env.APP_ENV}]`);
  logger.info("[boot] tea-backend: webhook telegram, без getUpdates/polling");
  logger.info("[db] DATABASE_URL (хост и параметры, без пароля)", databaseUrlDiagnostics(env.DATABASE_URL));
  const commit = process.env.RENDER_GIT_COMMIT?.trim();
  if (commit) {
    logger.info("[deploy] RENDER_GIT_COMMIT", { commit });
  }
  void logDatabaseEncoding();
  void logSupabaseDatasourcePairSanity();
  void logTelegramBroadcastTemplateColumns();
  if (process.env.RENDER === "true") {
    logger.warn(
      "[tea] Render: диск эфемерный — файлы в uploads/ могут пропасть после деплоя/рестарта.",
    );
  }
  if (isTelegramBotTokenSet()) {
    if (!env.TELEGRAM_BOT_USERNAME?.trim()) {
      logger.warn(
        "[telegram] TELEGRAM_BOT_USERNAME пустой — вход по коду может быть недоступен, но webhook регистрируем по токену.",
      );
    }
    void bootstrapTelegramWebhook().catch((e) =>
      logger.error("[telegram] bootstrap webhook", {
        err: e instanceof Error ? e.message : String(e),
      }),
    );
  }
  void startRegistrationOtpCleanup();
});
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
