import type { PrismaClient } from "@prisma/client";

export async function deleteUserWithDependencies(db: PrismaClient, params: { userId: string }): Promise<void> {
  const { userId } = params;

  // Почти все отношения имеют onDelete: Cascade в схеме Prisma, 
  // поэтому нам не нужно удалять их вручную.
  // Мы обрабатываем только те, где нужно сохранить историю или где onDelete: SetNull.

  await db.$transaction(async (tx) => {
    // 1. Уведомляем, что админ был удален в логах аудита (для тех логов, которые ОСТАНУТСЯ)
    // Но так как adminId имеет onDelete: Cascade, эти логи будут удалены. 
    // Если в будущем мы сменим Cascade на SetNull, эта логика пригодится.
    
    // 2. Очищаем ссылки в AdminAuditLog, где пользователь был ЦЕЛЬЮ (target)
    // Это уже делается автоматически через onDelete: SetNull, но мы можем обновить nickname для ясности.
    const target = await tx.user.findUnique({ where: { id: userId }, select: { nickname: true } });
    if (target) {
      await tx.adminAuditLog.updateMany({
        where: { targetUserId: userId },
        data: { targetNickname: `${target.nickname} (удален)` },
      });
    }

    // 3. Основное удаление пользователя - Prisma сама удалит каскадом:
    // Notifications, Suggestions, Reports, ShopPurchases, Gifts, UserAchievements, AchievementAccess, AdminAuditLogs (as actor)
    await tx.user.delete({ where: { id: userId } });
  });
}
