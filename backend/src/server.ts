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
import { startTelegramLongPolling } from "./lib/telegram.js";
import { startRegistrationOtpCleanup } from "./lib/registrationCleanup.js";
import { requireStagingAccess } from "./middleware/stagingAccess.js";

const app = express();
app.set("trust proxy", env.TRUST_PROXY);

const corsOrigins = Array.from(
  new Set(
    [
      "https://tea-achievements.vercel.app",
      "http://localhost:5173",
      env.FRONTEND_ORIGIN,
      env.CORS_ORIGINS,
      process.env.CORS_ORIGINS,
    ]
      .flatMap((v) => String(v ?? "").split(","))
      .map((x) => x.trim())
      .filter(Boolean),
  ),
);

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
      if (req.path.startsWith(`/${env.UPLOAD_DIR}`)) return false;
      return compression.filter(req, res);
    },
  }),
);

// НАСТРОЙКА CORS: Разрешаем доступ вашему сайту на Vercel
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id", "Idempotency-Key"],
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
  `/${env.UPLOAD_DIR}`,
  express.static(path.resolve(process.cwd(), env.UPLOAD_DIR), {
    maxAge: "7d",
    immutable: true,
    setHeaders(res) {
      res.setHeader("X-Content-Type-Options", "nosniff");
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
  return fail(res, mapped.status, mapped.message);
});

const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, () => {
  console.log(`API listening on port ${port} (${env.API_URL}) [${env.APP_ENV}]`);
  if (process.env.RENDER === "true") {
    console.warn(
      "[tea] Render: диск эфемерный — файлы в uploads/ могут пропасть после деплоя/рестарта.",
    );
  }
  startTelegramLongPolling();
  startRegistrationOtpCleanup();
});
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;