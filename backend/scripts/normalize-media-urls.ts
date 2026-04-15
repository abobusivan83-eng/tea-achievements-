import { prisma } from "../src/lib/prisma.js";
import { resolveStoredMediaUrl } from "../src/lib/storedMediaUrl.js";

async function run() {
  const users = await prisma.user.findMany({
    select: { id: true, avatarUrl: true, avatarPath: true, bannerUrl: true, bannerPath: true },
    take: 10_000,
  });

  let fixedUsers = 0;
  for (const user of users) {
    const nextAvatar = resolveStoredMediaUrl(user.avatarUrl, user.avatarPath);
    const nextBanner = resolveStoredMediaUrl(user.bannerUrl, user.bannerPath);
    if (nextAvatar !== user.avatarUrl || nextBanner !== user.bannerUrl) {
      await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: nextAvatar, bannerUrl: nextBanner },
      });
      fixedUsers += 1;
    }
  }

  const achievements = await prisma.achievement.findMany({
    select: { id: true, iconPath: true },
    take: 10_000,
  });

  let fixedAchievements = 0;
  for (const ach of achievements) {
    const normalized = resolveStoredMediaUrl(ach.iconPath, null);
    if (normalized && normalized !== ach.iconPath) {
      await prisma.achievement.update({
        where: { id: ach.id },
        data: { iconPath: normalized },
      });
      fixedAchievements += 1;
    }
  }

  console.log(`[normalize-media-urls] users fixed: ${fixedUsers}`);
  console.log(`[normalize-media-urls] achievements fixed: ${fixedAchievements}`);
}

run()
  .catch((e) => {
    console.error("[normalize-media-urls] failed", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

