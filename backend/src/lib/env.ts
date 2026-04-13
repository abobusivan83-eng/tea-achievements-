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
  PORT: z.coerce.number().int().positive().default(4000),
  API_URL: z.string().url().optional(),
  PUBLIC_BASE_URL: z.string().url().optional(),
  FRONTEND_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  UPLOAD_DIR: z.string().min(1).default("uploads"),
  TRUST_PROXY: z.preprocess((val) => {
    if (val !== undefined && val !== "") return val;
    if (process.env.RENDER === "true") return "true";
    return val;
  }, z.coerce.boolean().default(false)),
  STAGING_ACCESS_TOKEN: z.string().min(12).optional(),
  STAGING_IP_WHITELIST: z.string().optional(),
  /** Пустая строка в панели хостинга трактуется как «не задано». */
  SMTP_HOST: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().min(1).optional()),
  SMTP_PORT: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().positive().optional()),
  SMTP_SECURE: z.preprocess((v) => {
    if (v === "" || v === undefined) return undefined;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (s === "true" || s === "1" || s === "yes") return true;
      if (s === "false" || s === "0" || s === "no") return false;
    }
    return v;
  }, z.boolean().optional()),
  SMTP_USER: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().optional()),
  SMTP_PASS: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().optional()),
  SMTP_FROM: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().min(1).optional()),
  /** Логировать SMTP-трафик (только для отладки). */
  SMTP_DEBUG: z.preprocess((v) => {
    if (v === "" || v === undefined) return false;
    if (typeof v === "string") return ["1", "true", "yes"].includes(v.trim().toLowerCase());
    return Boolean(v);
  }, z.boolean().default(false)),
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

