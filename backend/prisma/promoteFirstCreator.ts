/**
 * Идемпотентно выставляет роль CREATOR целевому пользователю (для облака без локального доступа к БД).
 *
 * Порядок поиска:
 * 1) email === admin@clan.local
 * 2) nickname === Salamanca (без учёта регистра)
 * 3) пользователь с publicId === 1 (как в UI: сортировка createdAt asc, id asc, нумерация с 1)
 *
 * Переопределение через env: PROMOTE_USER_EMAIL, PROMOTE_USER_ID (uuid), PROMOTE_USER_NICKNAME
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { attachPublicIds } from "../src/lib/userPublicId.js";

const prisma = new PrismaClient();

const DEFAULT_EMAIL = "admin@clan.local";
const DEFAULT_NICKNAME = "Salamanca";

async function main() {
  const envEmail = process.env.PROMOTE_USER_EMAIL?.trim();
  const envId = process.env.PROMOTE_USER_ID?.trim();
  const envNick = process.env.PROMOTE_USER_NICKNAME?.trim();

  const select = { id: true, nickname: true, email: true, role: true, createdAt: true } as const;

  let user: {
    id: string;
    nickname: string;
    email: string;
    role: string;
    createdAt: Date;
  } | null = null;

  if (envId) {
    user = await prisma.user.findUnique({ where: { id: envId }, select });
  } else if (envEmail) {
    user = await prisma.user.findUnique({ where: { email: envEmail }, select });
  } else {
    user = await prisma.user.findUnique({
      where: { email: DEFAULT_EMAIL },
      select,
    });

    if (!user) {
      const nick = envNick || DEFAULT_NICKNAME;
      user = await prisma.user.findFirst({
        where: { nickname: { equals: nick, mode: "insensitive" } },
        select,
      });
    }

    if (!user) {
      const rows = await prisma.user.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select,
      });
      const withPublic = attachPublicIds(rows);
      const first = withPublic.find((u) => u.publicId === 1);
      user = first ?? null;
    }
  }

  if (!user) {
    console.warn("[promote:creator] Пользователь не найден (email / ник / publicId #1) — пропуск.");
    return;
  }

  if (user.role === "CREATOR") {
    console.log("[promote:creator] Уже CREATOR:", user.email, user.nickname, "id=", user.id);
    return;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: "CREATOR" },
    select: { id: true, nickname: true, email: true, role: true },
  });

  console.log("[promote:creator] Роль CREATOR установлена:", updated);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
