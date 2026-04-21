import type { PrismaClient } from "@prisma/client";

export async function deleteUserWithDependencies(db: PrismaClient, params: { userId: string }): Promise<void> {
  const { userId } = params;

  await db.$transaction(async (tx) => {
    await tx.adminAuditLog.updateMany({
      where: { targetUserId: userId },
      data: { targetUserId: null, targetNickname: null },
    });

    await tx.taskSubmission.updateMany({
      where: { reviewedById: userId },
      data: { reviewedById: null },
    });

    await tx.task.updateMany({
      where: { createdById: userId },
      data: { createdById: null },
    });

    await tx.achievement.updateMany({
      where: { createdById: userId },
      data: { createdById: null },
    });

    await tx.notification.deleteMany({ where: { userId } });
    await tx.suggestion.deleteMany({ where: { authorId: userId } });
    await tx.report.deleteMany({ where: { reporterId: userId } });
    await tx.report.deleteMany({ where: { reportedId: userId } });
    await tx.shopPurchase.deleteMany({ where: { userId } });
    await tx.taskSubmission.deleteMany({ where: { userId } });
    await tx.giftSendRequest.deleteMany({ where: { senderId: userId } });
    await tx.gift.deleteMany({ where: { fromUserId: userId } });
    await tx.gift.deleteMany({ where: { toUserId: userId } });
    await tx.userAchievement.deleteMany({ where: { userId } });
    await tx.achievementAccess.deleteMany({ where: { userId } });
    await tx.adminAuditLog.deleteMany({ where: { adminId: userId } });

    await tx.user.delete({ where: { id: userId } });
  });
}
