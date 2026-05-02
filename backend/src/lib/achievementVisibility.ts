import type { Prisma } from "@prisma/client";

/**
 * Достижения, которые видны в каталоге / профиле (вкладка «достижения» и блок locked):
 * публичные; приватные с выданным доступом; приватные с активным заданием — только в окне по startsAt/endsAt.
 */
export function achievementWhereForCatalogOrProfile(userId: string, now: Date): Prisma.AchievementWhereInput {
  return {
    OR: [
      { isPublic: true },
      { accessGrants: { some: { userId } } },
      {
        isPublic: false,
        task: {
          is: {
            isActive: true,
            AND: [
              { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
              { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
            ],
          },
        },
      },
    ],
  };
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
