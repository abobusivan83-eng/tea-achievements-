import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
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
