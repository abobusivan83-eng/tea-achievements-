import type { Prisma } from "@prisma/client";

/**
 * Каталог «Достижения» и блок locked в профиле:
 * — все публичные (график открытия задания отдаётся в API отдельными полями для замка/таймера);
 * — приватные только если уже выданы пользователю (не показываем приватные до выдачи, даже при активном задании).
 */
export function achievementCatalogWhereForUser(catalogUserId: string): Prisma.AchievementWhereInput {
  return {
    OR: [{ isPublic: true }, { awards: { some: { userId: catalogUserId } } }],
  };
}

/** @deprecated используйте achievementCatalogWhereForUser */
export function achievementWhereForCatalogOrProfile(userId: string, _now: Date): Prisma.AchievementWhereInput {
  return achievementCatalogWhereForUser(userId);
}

/** Достижения, привязанные к заданиям в списке /api/tasks (включая приватные с активным заданием до старта ивента). */
export function achievementWhereForTaskList(userId: string): Prisma.AchievementWhereInput {
  return {
    OR: [
      { isPublic: true },
      { accessGrants: { some: { userId } } },
      { isPublic: false, task: { is: { isActive: true } } },
    ],
  };
}
