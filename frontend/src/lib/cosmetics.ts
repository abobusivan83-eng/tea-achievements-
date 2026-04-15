export type FrameRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "secret";
export type FrameShape = "circle" | "square" | "squircle";

export type FrameOverlayId =
  | "none"
  | "metal-steel"
  | "metal-bronze"
  | "metal-gold"
  | "minimal-blue"
  | "minimal-green"
  | "minimal-purple"
  | "carbon-grid"
  | "tech-circuit"
  | "arcane-runes"
  | "royal-crown"
  | "neon-edges"
  | "retro-pixel"
  | "ember-flame"
  | "glacier-crystal"
  | "void-aura"
  | "radioactive"
  | "sigil"
  | "holo-prism";

export type FrameDef = {
  key: string;
  label: string;
  rarity: FrameRarity;
  shape: FrameShape;
  className: string;
  overlayId: FrameOverlayId;
  animated: boolean;
  adminOnly?: boolean;
  creatorOnly?: boolean;
};

export type CosmeticRarity = "common" | "rare" | "epic" | "legendary" | "secret";

export type BadgeDef = {
  key: string;
  label: string;
  icon: string;
  rarity: CosmeticRarity;
  description: string;
  adminOnly?: boolean;
};

export type StatusEmojiDef = {
  key: string;
  emoji: string;
  label: string;
  rarity: CosmeticRarity;
  description: string;
  adminOnly?: boolean;
};

export const frames: FrameDef[] = [
  { key: "common", label: "Steel Classic", rarity: "common", shape: "circle", className: "frame--common", overlayId: "metal-steel", animated: false },
  { key: "common-sq", label: "Steel Square", rarity: "common", shape: "square", className: "frame--common", overlayId: "metal-steel", animated: false },
  { key: "carbon", label: "Carbon", rarity: "common", shape: "circle", className: "frame--carbon", overlayId: "carbon-grid", animated: false },
  { key: "steam-blueprint", label: "Blueprint", rarity: "uncommon", shape: "squircle", className: "frame--blueprint", overlayId: "tech-circuit", animated: true },
  { key: "common-soft", label: "Soft Glow", rarity: "uncommon", shape: "circle", className: "frame--softglow", overlayId: "minimal-blue", animated: true },
  { key: "common-soft-sq", label: "Soft Glow Square", rarity: "uncommon", shape: "square", className: "frame--softglow", overlayId: "minimal-blue", animated: true },
  { key: "common-min-green", label: "Verdant", rarity: "common", shape: "circle", className: "frame--common", overlayId: "minimal-green", animated: false },
  { key: "common-min-purple", label: "Violet", rarity: "common", shape: "squircle", className: "frame--common", overlayId: "minimal-purple", animated: false },
  { key: "common-bronze", label: "Bronze", rarity: "common", shape: "square", className: "frame--common", overlayId: "metal-bronze", animated: false },
  { key: "common-gold", label: "Gilded", rarity: "uncommon", shape: "circle", className: "frame--rare", overlayId: "metal-gold", animated: false },
  { key: "common-tech", label: "Circuit", rarity: "uncommon", shape: "square", className: "frame--neon", overlayId: "tech-circuit", animated: true },
  { key: "common-retro", label: "Retro Pixel", rarity: "common", shape: "square", className: "frame--blueprint", overlayId: "retro-pixel", animated: true },
  { key: "rare", label: "Rare Crest", rarity: "rare", shape: "circle", className: "frame--rare", overlayId: "arcane-runes", animated: false },
  { key: "rare-shine", label: "Rare Shine", rarity: "rare", shape: "circle", className: "frame--rare-shine", overlayId: "arcane-runes", animated: true },
  { key: "rare-squircle", label: "Rare Squircle", rarity: "rare", shape: "squircle", className: "frame--rare", overlayId: "tech-circuit", animated: false },
  { key: "epic", label: "Epic Sigil", rarity: "epic", shape: "circle", className: "frame--epic", overlayId: "sigil", animated: false },
  { key: "epic-shine", label: "Epic Shine", rarity: "epic", shape: "squircle", className: "frame--epic-shine", overlayId: "sigil", animated: true },
  { key: "legendary", label: "Legendary Crown", rarity: "legendary", shape: "circle", className: "frame--legendary", overlayId: "royal-crown", animated: false },
  { key: "legendary-animated", label: "Legendary Prism", rarity: "legendary", shape: "circle", className: "frame--legendary-animated", overlayId: "holo-prism", animated: true },
  { key: "legendary-particles", label: "Legendary Particles", rarity: "legendary", shape: "squircle", className: "frame--legendary-particles", overlayId: "holo-prism", animated: true },
  { key: "discord-neon", label: "Neon", rarity: "epic", shape: "square", className: "frame--neon", overlayId: "neon-edges", animated: true },
  { key: "admin-obsidian", label: "Obsidian", rarity: "epic", shape: "circle", className: "frame--obsidian", overlayId: "metal-steel", animated: true, adminOnly: true },
  { key: "admin-ember", label: "Ember", rarity: "legendary", shape: "circle", className: "frame--ember", overlayId: "ember-flame", animated: true, adminOnly: true },
  { key: "admin-aurora", label: "Aurora", rarity: "legendary", shape: "square", className: "frame--aurora", overlayId: "holo-prism", animated: true, adminOnly: true },
  { key: "admin-sigil", label: "Sigil", rarity: "epic", shape: "squircle", className: "frame--sigil", overlayId: "sigil", animated: true, adminOnly: true },
  { key: "admin-holo", label: "Holo", rarity: "rare", shape: "square", className: "frame--holo", overlayId: "holo-prism", animated: true, adminOnly: true },
  { key: "admin-crown", label: "Crown", rarity: "legendary", shape: "circle", className: "frame--crown", overlayId: "royal-crown", animated: true, adminOnly: true },
  { key: "admin-glacier", label: "Glacier", rarity: "epic", shape: "squircle", className: "frame--glacier", overlayId: "glacier-crystal", animated: true, adminOnly: true },
  { key: "admin-void", label: "Void", rarity: "secret", shape: "circle", className: "frame--void", overlayId: "void-aura", animated: true, adminOnly: true },
  { key: "admin-radioactive", label: "Radioactive", rarity: "secret", shape: "square", className: "frame--radioactive", overlayId: "radioactive", animated: true, adminOnly: true },
];

/**
 * Рамки только для роли CREATOR (владелец платформы). Не выдаются админам и обычным игрокам.
 * Включает легаси secret-* и новые визуальные creator-platform-*.
 */
export const creatorFrames: FrameDef[] = [
  { key: "secret-neon-core", label: "Neon Core (legacy)", rarity: "secret", shape: "square", className: "frame--neon", overlayId: "neon-edges", animated: true, creatorOnly: true },
  { key: "secret-ember-gold", label: "Golden Flame (legacy)", rarity: "secret", shape: "circle", className: "frame--ember", overlayId: "ember-flame", animated: true, creatorOnly: true },
  { key: "secret-holo-royal", label: "Royal Prism (legacy)", rarity: "secret", shape: "circle", className: "frame--crown", overlayId: "holo-prism", animated: true, creatorOnly: true },
  { key: "secret-sigil-inferno", label: "Inferno Sigil (legacy)", rarity: "secret", shape: "squircle", className: "frame--legendary-particles", overlayId: "sigil", animated: true, creatorOnly: true },
  { key: "secret-void-runes", label: "Void Runes (legacy)", rarity: "secret", shape: "squircle", className: "frame--void", overlayId: "arcane-runes", animated: true, creatorOnly: true },
  { key: "secret-glacier", label: "Frozen Relic (legacy)", rarity: "secret", shape: "square", className: "frame--glacier", overlayId: "glacier-crystal", animated: true, creatorOnly: true },
  { key: "secret-carbon-ops", label: "Black Ops (legacy)", rarity: "secret", shape: "square", className: "frame--obsidian", overlayId: "carbon-grid", animated: true, creatorOnly: true },
  { key: "secret-retro", label: "Retro Artifact (legacy)", rarity: "secret", shape: "square", className: "frame--blueprint", overlayId: "retro-pixel", animated: true, creatorOnly: true },
  { key: "creator-platform-nexus", label: "Создатель · Нексус", rarity: "secret", shape: "squircle", className: "frame--creator-nexus", overlayId: "tech-circuit", animated: true, creatorOnly: true },
  { key: "creator-platform-solar", label: "Создатель · Солнечная корона", rarity: "secret", shape: "circle", className: "frame--creator-solar", overlayId: "royal-crown", animated: true, creatorOnly: true },
  { key: "creator-platform-voidheart", label: "Создатель · Сердце пустоты", rarity: "secret", shape: "circle", className: "frame--creator-voidheart", overlayId: "void-aura", animated: true, creatorOnly: true },
  { key: "creator-platform-pulse", label: "Создатель · Пульс сети", rarity: "secret", shape: "square", className: "frame--creator-pulse", overlayId: "neon-edges", animated: true, creatorOnly: true },
  { key: "creator-platform-aurora", label: "Создатель · Аврора основателя", rarity: "secret", shape: "squircle", className: "frame--creator-aurora", overlayId: "holo-prism", animated: true, creatorOnly: true },
  { key: "creator-platform-sigil", label: "Создатель · Золотой сигил", rarity: "secret", shape: "circle", className: "frame--creator-sigil", overlayId: "sigil", animated: true, creatorOnly: true },
  { key: "creator-platform-nebula", label: "Создатель · Туманность", rarity: "secret", shape: "squircle", className: "frame--creator-nebula", overlayId: "radioactive", animated: true, creatorOnly: true },
  { key: "creator-platform-founder", label: "Создатель платформы", rarity: "secret", shape: "circle", className: "frame--creator-founder", overlayId: "ember-flame", animated: true, creatorOnly: true },
];

export function getFrame(key: string | null | undefined): FrameDef | null {
  if (!key) return null;
  return frames.find((f) => f.key === key) ?? creatorFrames.find((f) => f.key === key) ?? null;
}

export const badgeCatalog: BadgeDef[] = [
  { key: "founder", label: "Основатель", icon: "👑", rarity: "legendary", description: "Знак лидера и первопроходца клана." },
  { key: "moderator", label: "Модератор", icon: "🛡️", rarity: "epic", description: "Символ порядка, доверия и управления." },
  { key: "veteran", label: "Ветеран", icon: "⭐", rarity: "rare", description: "Классический значок опытного участника." },
  { key: "event-winner", label: "Победитель события", icon: "🏆", rarity: "epic", description: "Выдаётся тем, кто забирает победу на клановых ивентах." },
  { key: "strategist", label: "Стратег", icon: "♟️", rarity: "rare", description: "Для тех, кто играет с холодной головой." },
  { key: "night-ops", label: "Ночной рейд", icon: "🌙", rarity: "common", description: "Знак участника поздних клановых вылазок." },
  { key: "tea-lord", label: "Чайный лорд", icon: "🫖", rarity: "legendary", description: "Фирменный клановый знак для самых заметных участников." },
  { key: "beta-scout", label: "Скаут клана", icon: "🧪", rarity: "common", description: "Памятный знак активного исследователя клановой системы." },
  { key: "admin-command", label: "Командование", icon: "🧿", rarity: "secret", description: "Закрытый знак админской панели.", adminOnly: true },
];

export const statusEmojiCatalog: StatusEmojiDef[] = [
  { key: "calm", emoji: "😌", label: "Спокойствие", rarity: "common", description: "Спокойный статус для уверенных игроков." },
  { key: "fire", emoji: "🔥", label: "Огонь", rarity: "rare", description: "Горячий статус для активных участников." },
  { key: "sparkle", emoji: "✨", label: "Сияние", rarity: "rare", description: "Лёгкий премиальный блеск в профиле." },
  { key: "diamond", emoji: "💎", label: "Алмаз", rarity: "epic", description: "Статус для редких и заметных игроков." },
  { key: "trophy", emoji: "🏆", label: "Трофей", rarity: "epic", description: "Сразу показывает стремление к лидерству." },
  { key: "target", emoji: "🎯", label: "Точность", rarity: "legendary", description: "Для тех, кто закрывает задачи без промаха." },
  { key: "fox", emoji: "🦊", label: "Хищник", rarity: "legendary", description: "Хитрый и яркий статус с характером." },
  { key: "admin-crown", emoji: "👑", label: "Корона", rarity: "secret", description: "Эксклюзивный статус администрации.", adminOnly: true },
  { key: "admin-void", emoji: "🜂", label: "Пустота", rarity: "secret", description: "Секретный статус высшего доступа.", adminOnly: true },
];
