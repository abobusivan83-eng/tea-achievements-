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
    // После простоя Supabase free — коннект дольше; не рвём сессию из-за малого pool_timeout у Prisma runtime.
    if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "14");
    if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "22");
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
