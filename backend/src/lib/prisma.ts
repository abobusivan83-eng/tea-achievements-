import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";
import { logger } from "./logger.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "production"
        ? [{ emit: "event", level: "query" }, "error"]
        : [{ emit: "event", level: "query" }, "warn", "error"],
  });

prisma.$on("query", (event) => {
  if (event.duration >= env.PRISMA_SLOW_QUERY_MS) {
    logger.warn("slow_prisma_query", {
      elapsedMs: event.duration,
      target: event.target,
    });
  }
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

async function disconnect() {
  await prisma.$disconnect().catch(() => {});
}

process.once("SIGINT", () => {
  void disconnect();
});
process.once("SIGTERM", () => {
  void disconnect();
});
