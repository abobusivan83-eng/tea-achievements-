import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";
import { logger } from "./logger.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Короткий connect_timeout для бесплатного Supabase после «пробуждения» — не висеть десятки секунд на установке соединения.
 * Pooler: pool_timeout задаёт время ожидания свободного слота из пула Prisma (сек).
 */
function withPgClientDefaults(databaseUrl: string): string {
  if (databaseUrl.startsWith("file:")) return databaseUrl;
  try {
    const u = new URL(databaseUrl);
    /** Разумный дефолт для одного Render free dyno на Supabase pooler (:6543 пул). Не переопределяем, если заданы в строке .env. */
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "10");
    if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "15");
    if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "20");
    return u.toString();
  } catch {
    return databaseUrl;
  }
}

/* PrismaClient — один экспорт ниже через globalForPrisma (не создаём новый экземпляр на каждый HTTP-запрос). */

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: { url: withPgClientDefaults(env.DATABASE_URL) },
    },
    log:
      process.env.NODE_ENV === "production"
        ? [{ emit: "event", level: "query" }, "error"]
        : [{ emit: "event", level: "query" }, "warn", "error"],
  });

// Один процесс Render = один клиент БД (важнее в dev/HMR и при повторном require).
globalForPrisma.prisma ??= prisma;

prisma.$on("query", (event) => {
  if (event.duration >= env.PRISMA_SLOW_QUERY_MS) {
    logger.warn("slow_prisma_query", {
      elapsedMs: event.duration,
      target: event.target,
    });
  }
});

async function disconnect() {
  await prisma.$disconnect().catch(() => {});
}

process.once("SIGINT", () => {
  void disconnect();
});
process.once("SIGTERM", () => {
  void disconnect();
});
