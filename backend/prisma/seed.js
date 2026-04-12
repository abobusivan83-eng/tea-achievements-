import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";
async function main() {
    const adminEmail = "admin@clan.local";
    const adminPassword = "admin12345";
    const adminHash = await bcrypt.hash(adminPassword, 10);
    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        create: {
            email: adminEmail,
            nickname: "Clan Admin",
            passwordHash: adminHash,
            role: "ADMIN",
            frameKey: "legendary-animated",
            badgesJson: ["founder", "moderator"],
        },
        update: { role: "ADMIN" },
        select: { id: true, email: true },
    });
    const baseAchievements = [
        {
            title: "Добро пожаловать в клан",
            description: "Зарегистрируйся и стань частью клана.",
            rarity: "COMMON",
            points: 10,
            frameKey: "common",
            isPublic: true,
        },
        {
            title: "Надёжный боец",
            description: "Получить 3 достижения.",
            rarity: "RARE",
            points: 30,
            frameKey: "rare",
            isPublic: true,
        },
        {
            title: "Легенда клана",
            description: "Особая награда от админа.",
            rarity: "LEGENDARY",
            points: 150,
            frameKey: "legendary-animated",
            isPublic: false,
        },
    ];
    for (const a of baseAchievements) {
        const existing = await prisma.achievement.findFirst({ where: { title: a.title } });
        if (!existing) {
            await prisma.achievement.create({ data: { ...a, createdById: admin.id } });
        }
    }
    // Create a demo user
    const demo = await prisma.user.upsert({
        where: { email: "demo@clan.local" },
        create: {
            email: "demo@clan.local",
            nickname: "DemoPlayer",
            passwordHash: await bcrypt.hash("demo12345", 10),
            role: "USER",
            frameKey: "rare",
            badgesJson: ["veteran"],
        },
        update: {},
        select: { id: true },
    });
    const welcome = await prisma.achievement.findFirst({ where: { title: "Добро пожаловать в клан" } });
    if (welcome) {
        await prisma.userAchievement.upsert({
            where: { userId_achievementId: { userId: demo.id, achievementId: welcome.id } },
            create: { userId: demo.id, achievementId: welcome.id },
            update: {},
        });
    }
    const legendary = await prisma.achievement.findFirst({ where: { title: "Легенда клана" } });
    if (legendary) {
        await prisma.achievementAccess.upsert({
            where: { achievementId_userId: { achievementId: legendary.id, userId: admin.id } },
            create: { achievementId: legendary.id, userId: admin.id },
            update: {},
        });
        await prisma.userAchievement.upsert({
            where: { userId_achievementId: { userId: admin.id, achievementId: legendary.id } },
            create: { userId: admin.id, achievementId: legendary.id },
            update: {},
        });
    }
}
main()
    .then(async () => prisma.$disconnect())
    .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
