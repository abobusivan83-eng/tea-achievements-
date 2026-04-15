import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

const requestedAppEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";
const appEnv = requestedAppEnv === "production" || requestedAppEnv === "staging" ? requestedAppEnv : "development";

const envDir = process.cwd();
const envFiles = [
  `.env.${appEnv}.local`,
  `.env.${appEnv}`,
  ".env.local",
  ".env",
];

for (const file of envFiles) {
  const fullPath = path.resolve(envDir, file);
  if (fs.existsSync(fullPath)) {
    dotenv.config({ path: fullPath, override: false });
  }
}

const EnvSchema = z.object({
  APP_ENV: z.enum(["development", "staging", "production"]).default(appEnv),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  /** Render задаёт PORT; иначе 3000 (как в process.env.PORT || 3000). */
  PORT: z
    .union([z.string(), z.undefined()])
    .transform((s) => {
      if (s === undefined || s === "") return 3000;
      const n = Number(s);
      return Number.isFinite(n) && n > 0 ? n : 3000;
    }),
  API_URL: z.string().url().optional(),
  PUBLIC_BASE_URL: z.string().url().optional(),
  FRONTEND_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  CORS_ORIGINS: z.string().optional(),
  UPLOAD_DIR: z.string().min(1).default("uploads"),
  TRUST_PROXY: z.preprocess((val) => {
    if (val !== undefined && val !== "") return val;
    if (process.env.RENDER === "true") return "true";
    return val;
  }, z.coerce.boolean().default(false)),
  STAGING_ACCESS_TOKEN: z.string().min(12).optional(),
  STAGING_IP_WHITELIST: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().min(1).optional()),
  /** Имя бота без @ (для ссылки t.me/...). */
  TELEGRAM_BOT_USERNAME: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().min(1).optional()),
  SLOW_REQUEST_MS: z.coerce.number().int().min(50).max(60_000).default(800),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300_000).default(20_000),
  PRISMA_SLOW_QUERY_MS: z.coerce.number().int().min(10).max(60_000).default(300),
  CLOUDINARY_URL: z.string().min(1).optional(),
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
});

const parsed = EnvSchema.parse(process.env);

/** Публичный URL сервиса на Render (без завершающего /). */
function renderPublicUrl(): string | undefined {
  const u = process.env.RENDER_EXTERNAL_URL?.trim().replace(/\/$/, "");
  if (!u) return undefined;
  try {
    new URL(u);
    return u;
  } catch {
    return undefined;
  }
}

const localhostBase = `http://localhost:${parsed.PORT}`;
const autoBase = renderPublicUrl() ?? localhostBase;

export const env = {
  ...parsed,
  API_URL: parsed.API_URL ?? parsed.PUBLIC_BASE_URL ?? autoBase,
  PUBLIC_BASE_URL: parsed.PUBLIC_BASE_URL ?? parsed.API_URL ?? autoBase,
};

/** Тип распарсенных переменных окружения (без вычисляемых API_URL / PUBLIC_BASE_URL). */
export type EnvFromProcess = z.infer<typeof EnvSchema>;
export type AppEnv = typeof env;

