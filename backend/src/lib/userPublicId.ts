import type { PrismaClient } from "@prisma/client";

export async function computeUserPublicId(prisma: PrismaClient, userId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, createdAt: true },
  });
  if (!user) return null;
  const before = await prisma.user.count({
    where: {
      OR: [
        { createdAt: { lt: user.createdAt } },
        { createdAt: user.createdAt, id: { lte: user.id } },
      ],
    },
  });
  return before;
}

export function attachPublicIds<T extends { id: string; createdAt: Date }>(rows: T[]): Array<T & { publicId: number }> {
  const sorted = [...rows].sort((a, b) => {
    const byDate = +new Date(a.createdAt) - +new Date(b.createdAt);
    if (byDate !== 0) return byDate;
    return a.id.localeCompare(b.id);
  });
  const order = new Map<string, number>();
  sorted.forEach((x, i) => order.set(x.id, i + 1));
  return rows.map((x) => ({ ...x, publicId: order.get(x.id) ?? 0 }));
}
