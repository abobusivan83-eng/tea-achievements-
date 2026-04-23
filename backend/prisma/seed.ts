import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");
  const adminEmail = process.env.ADMIN_EMAIL?.trim() || "admin@clan.local";
  const adminPassword = process.env.ADMIN_PASSWORD?.trim() || "admin12345";
  const adminHash = await bcrypt.hash(adminPassword, 10);
  const rotateAdminPassword = Boolean(process.env.ADMIN_PASSWORD?.trim());

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      nickname: process.env.ADMIN_NICKNAME?.trim() || "Clan Admin",
      passwordHash: adminHash,
      role: "CREATOR",
      frameKey: "legendary-animated",
      badgesJson: ["founder", "moderator"],
    },
    update: {
      role: "CREATOR",
      badgesJson: ["founder", "moderator"],
      statusEmoji: "🔥",
      ...(rotateAdminPassword ? { passwordHash: adminHash } : {}),
    },
    select: { id: true, email: true },
  });
  console.log(`Admin user created/updated: ${admin.email}`);

  const baseAchievements = [
    {
      title: "Добро пожаловать в клан",
      description: "Зарегистрируйся и стань частью клана.",
      rarity: "COMMON" as const,
      points: 10,
      frameKey: "common",
      isPublic: true,
    },
    {
      title: "Надёжный боец",
      description: "Получить 3 достижения.",
      rarity: "RARE" as const,
      points: 30,
      frameKey: "rare",
      isPublic: true,
    },
    {
      title: "Легенда клана",
      description: "Особая награда от админа.",
      rarity: "LEGENDARY" as const,
      points: 150,
      frameKey: "legendary-animated",
      isPublic: false,
    },
  ];

  for (const a of baseAchievements) {
    const existing = await prisma.achievement.findFirst({ where: { title: a.title } });
    if (!existing) {
      await prisma.achievement.create({ data: { ...a, createdById: admin.id } });
      console.log(`Achievement created: ${a.title}`);
    }
  }

  // Seed a couple of tasks for ZBT (each task is tied to exactly one achievement).
  const achWelcome = await prisma.achievement.findFirst({ where: { title: "Добро пожаловать в клан" }, select: { id: true } });
  const achFighter = await prisma.achievement.findFirst({ where: { title: "Надёжный боец" }, select: { id: true } });

  if (achWelcome) {
    await prisma.task.upsert({
      where: { achievementId: achWelcome.id },
      create: {
        title: "Первый шаг",
        description: "Знакомство с системой: сделай первый вклад в жизнь клана и отметься в активности.",
        conditions: "Опиши, что ты сделал для клана (участие в событии, помощь, активность). Приложи скриншот, если есть.",
        rewardCoins: 250,
        isActive: true,
        isEvent: false,
        startsAt: null,
        endsAt: null,
        styleTag: "starter",
        achievementId: achWelcome.id,
        createdById: admin.id,
      },
      update: { rewardCoins: 250, isActive: true },
    });
    console.log("Task 'Первый шаг' created/updated");
  }

  if (achFighter) {
    await prisma.task.upsert({
      where: { achievementId: achFighter.id },
      create: {
        title: "Серия активностей",
        description: "Сделай несколько шагов к прогрессу: выполни 3 мини-активности внутри клана.",
        conditions: "3 активности (события/помощь/участие). В сообщении перечисли, что именно сделал, и приложи доказательства.",
        rewardCoins: 600,
        isActive: true,
        isEvent: false,
        startsAt: null,
        endsAt: null,
        styleTag: "series",
        achievementId: achFighter.id,
        createdById: admin.id,
      },
      update: { rewardCoins: 600, isActive: true },
    });
    console.log("Task 'Серия активностей' created/updated");
  }

  // Create a demo user for ZBT
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

  // Seed shop with: non-admin frames + all non-admin badges + all non-admin status emojis.
  // Status emojis are stored as BADGE items with key prefix "status:" and icon = emoji.
  const baseShopItems = [
    // Frames (keys match frontend/src/lib/cosmetics.ts)
    { name: "Рамка: Steel Classic", type: "FRAME" as const, key: "common", price: 300, rarity: "COMMON" as const, description: "Классическая стальная рамка для профиля.", icon: "🛡️" },
    { name: "Рамка: Bronze", type: "FRAME" as const, key: "common-bronze", price: 450, rarity: "COMMON" as const, description: "Бронзовый оттенок и уверенный стиль.", icon: "🥉" },
    { name: "Рамка: Carbon", type: "FRAME" as const, key: "carbon", price: 650, rarity: "COMMON" as const, description: "Строгая карбоновая фактура для профиля.", icon: "🧩" },
    { name: "Рамка: Blueprint", type: "FRAME" as const, key: "steam-blueprint", price: 900, rarity: "RARE" as const, description: "Технический контур и лёгкая анимация.", icon: "📐" },
    { name: "Рамка: Soft Glow", type: "FRAME" as const, key: "common-soft", price: 1100, rarity: "RARE" as const, description: "Мягкое сияние, хорошо читается на тёмном фоне.", icon: "✨" },
    { name: "Рамка: Gilded", type: "FRAME" as const, key: "common-gold", price: 1500, rarity: "RARE" as const, description: "Сдержанная позолота с тёплым блеском.", icon: "🥇" },
    { name: "Рамка: Rare Crest", type: "FRAME" as const, key: "rare", price: 2200, rarity: "RARE" as const, description: "Редкая рамка с акцентом на орнамент.", icon: "💠" },
    { name: "Рамка: Rare Shine", type: "FRAME" as const, key: "rare-shine", price: 2800, rarity: "RARE" as const, description: "Сияющий вариант для красивого профиля.", icon: "🌟" },
    { name: "Рамка: Epic Sigil", type: "FRAME" as const, key: "epic", price: 4500, rarity: "EPIC" as const, description: "Эпическая рамка с символом и тёмным светом.", icon: "🔱" },
    { name: "Рамка: Epic Shine", type: "FRAME" as const, key: "epic-shine", price: 5600, rarity: "EPIC" as const, description: "Эпическая рамка с анимированным блеском.", icon: "💜" },
    { name: "Рамка: Neon", type: "FRAME" as const, key: "discord-neon", price: 6200, rarity: "EPIC" as const, description: "Неоновые края и пульс для яркого вайба.", icon: "⚡" },
    { name: "Рамка: Legendary Crown", type: "FRAME" as const, key: "legendary", price: 9000, rarity: "LEGENDARY" as const, description: "Легендарная рамка с короной и мощным акцентом.", icon: "👑" },
    { name: "Рамка: Legendary Prism", type: "FRAME" as const, key: "legendary-animated", price: 12000, rarity: "LEGENDARY" as const, description: "Анимированный призматический блеск с глубиной.", icon: "🌈" },
    { name: "Рамка: Legendary Particles", type: "FRAME" as const, key: "legendary-particles", price: 15000, rarity: "LEGENDARY" as const, description: "Сияющие частицы и премиальный вид.", icon: "✨" },

    // Badges (all non-admin)
    { name: "Значок: Ночной рейд", type: "BADGE" as const, key: "night-ops", price: 400, rarity: "COMMON" as const, description: "Знак участника поздних клановых вылазок.", icon: "🌙" },
    { name: "Значок: Бета-скаут", type: "BADGE" as const, key: "beta-scout", price: 600, rarity: "COMMON" as const, description: "Памятный знак участника закрытого тестирования.", icon: "🧪" },
    { name: "Значок: Ветеран", type: "BADGE" as const, key: "veteran", price: 1600, rarity: "RARE" as const, description: "Классический значок опытного участника.", icon: "⭐" },
    { name: "Значок: Стратег", type: "BADGE" as const, key: "strategist", price: 1900, rarity: "RARE" as const, description: "Для тех, кто играет с холодной головой.", icon: "♟️" },
    { name: "Значок: Победитель события", type: "BADGE" as const, key: "event-winner", price: 4200, rarity: "EPIC" as const, description: "Выдаётся тем, кто забирает победу на клановых ивентах.", icon: "🏆" },
    { name: "Значок: Модератор", type: "BADGE" as const, key: "moderator", price: 5200, rarity: "EPIC" as const, description: "Символ порядка, доверия и управления.", icon: "🛡️" },
    { name: "Значок: Основатель", type: "BADGE" as const, key: "founder", price: 12000, rarity: "LEGENDARY" as const, description: "Знак лидера и первопроходца клана.", icon: "👑" },
    { name: "Значок: Чайный лорд", type: "BADGE" as const, key: "tea-lord", price: 18000, rarity: "LEGENDARY" as const, description: "Фирменный клановый знак для самых заметных участников.", icon: "🫖" },

    // Status emojis (all non-admin) stored as BADGE items
    { name: "Статус: Спокойствие", type: "BADGE" as const, key: "status:calm", price: 350, rarity: "COMMON" as const, description: "Спокойный статус для уверенных игроков.", icon: "😌" },
    { name: "Статус: Огонь", type: "BADGE" as const, key: "status:fire", price: 1200, rarity: "RARE" as const, description: "Горячий статус для активных участников.", icon: "🔥" },
    { name: "Статус: Сияние", type: "BADGE" as const, key: "status:sparkle", price: 1500, rarity: "RARE" as const, description: "Лёгкий премиальный блеск в профиле.", icon: "✨" },
    { name: "Статус: Алмаз", type: "BADGE" as const, key: "status:diamond", price: 3600, rarity: "EPIC" as const, description: "Статус для редких и заметных игроков.", icon: "💎" },
    { name: "Статус: Трофей", type: "BADGE" as const, key: "status:trophy", price: 4400, rarity: "EPIC" as const, description: "Сразу показывает стремление к лидерству.", icon: "🏆" },
    { name: "Статус: Точность", type: "BADGE" as const, key: "status:target", price: 11000, rarity: "LEGENDARY" as const, description: "Для тех, кто закрывает задачи без промаха.", icon: "🎯" },
    { name: "Статус: Хищник", type: "BADGE" as const, key: "status:fox", price: 14000, rarity: "LEGENDARY" as const, description: "Хитрый и яркий статус с характером.", icon: "🦊" },
  ];

  for (const item of baseShopItems) {
    await prisma.shopItem.upsert({
      where: { type_key: { type: item.type, key: item.key } },
      create: item,
      update: {
        name: item.name,
        price: item.price,
        rarity: item.rarity,
        description: item.description,
        icon: item.icon,
      },
    });
  }

  await prisma.notification.create({
    data: {
      type: "SYSTEM",
      text: "🎉 Чайные достижения: магазин и кастомизация готовы к ЗБТ",
      userId: null,
      adminName: "System",
    },
  });
  console.log("Seeding finished.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

