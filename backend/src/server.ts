import "express-async-errors";
import express from "express";
import cors from "cors";
import path from "path";
import morgan from "morgan";
import helmet from "helmet";
import { env } from "./lib/env.js";
import { mapErrorToResponse } from "./lib/mapErrorResponse.js";
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
import { requireStagingAccess } from "./middleware/stagingAccess.js";

const app = express();
app.set("trust proxy", env.TRUST_PROXY);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

const allowedOrigins = env.FRONTEND_ORIGIN
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
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

// Статика загрузок: при UPLOAD_DIR=uploads файлы доступны как {PUBLIC_BASE_URL}/uploads/avatars/...
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

app.get("/api/health", (_req, res) => ok(res, { status: "ok", env: env.APP_ENV, apiUrl: env.API_URL }));
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
  if (mapped.logAsError) {
    console.error(`[${new Date().toISOString()}] ${line}`, err instanceof Error ? err.stack ?? err.message : err);
  } else if (mapped.status >= 500) {
    console.error(`[${new Date().toISOString()}] ${line}`, err);
  } else {
    console.warn(`[${new Date().toISOString()}] ${line} → ${mapped.status} ${mapped.message}`);
  }
  return fail(res, mapped.status, mapped.message);
});

app.listen(env.PORT, () => {
  console.log(`API listening on ${env.API_URL} [${env.APP_ENV}]`);
  if (process.env.RENDER === "true") {
    console.warn(
      "[tea] Render: диск эфемерный — файлы в uploads/ могут пропасть после деплоя/рестарта. Для продакшена планируйте S3 / Supabase Storage.",
    );
  }
});

