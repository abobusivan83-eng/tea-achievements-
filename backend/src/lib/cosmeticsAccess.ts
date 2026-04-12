export type AppRole = "USER" | "ADMIN" | "CREATOR";

/** Admin-only profile frames (not available to USER/CREATOR without admin role). */
export const ADMIN_ONLY_FRAME_KEYS = new Set([
  "admin-obsidian",
  "admin-ember",
  "admin-aurora",
  "admin-sigil",
  "admin-holo",
  "admin-crown",
  "admin-glacier",
  "admin-void",
  "admin-radioactive",
]);

/**
 * Creator-only frames (platform owner). Not granted to ADMIN or USER.
 * Includes legacy secret-* keys for backwards-compatible display / saves.
 */
export const CREATOR_ONLY_FRAME_KEYS = new Set([
  "secret-neon-core",
  "secret-ember-gold",
  "secret-holo-royal",
  "secret-sigil-inferno",
  "secret-void-runes",
  "secret-glacier",
  "secret-carbon-ops",
  "secret-retro",
  "creator-platform-nexus",
  "creator-platform-solar",
  "creator-platform-voidheart",
  "creator-platform-pulse",
  "creator-platform-aurora",
  "creator-platform-sigil",
  "creator-platform-nebula",
  "creator-platform-founder",
]);

const KNOWN_FRAME_KEYS = new Set<string>([
  ...[
    "common",
    "common-sq",
    "carbon",
    "steam-blueprint",
    "common-soft",
    "common-soft-sq",
    "common-min-green",
    "common-min-purple",
    "common-bronze",
    "common-gold",
    "common-tech",
    "common-retro",
    "rare",
    "rare-shine",
    "rare-squircle",
    "epic",
    "epic-shine",
    "legendary",
    "legendary-animated",
    "legendary-particles",
    "discord-neon",
  ],
  ...ADMIN_ONLY_FRAME_KEYS,
  ...CREATOR_ONLY_FRAME_KEYS,
]);

export const ADMIN_BADGE_KEYS = new Set(["admin-command"]);

/** Shop status catalog keys (without `status:` prefix). */
export const ADMIN_ONLY_STATUS_KEYS = new Set(["admin-crown", "admin-void"]);

const KNOWN_STATUS_CATALOG_KEYS = new Set([
  "calm",
  "fire",
  "sparkle",
  "diamond",
  "trophy",
  "target",
  "fox",
  ...ADMIN_ONLY_STATUS_KEYS,
]);

export const STATUS_EMOJI_TO_CATALOG_KEY = new Map<string, string>([
  ["😌", "calm"],
  ["🔥", "fire"],
  ["✨", "sparkle"],
  ["💎", "diamond"],
  ["🏆", "trophy"],
  ["🎯", "target"],
  ["🦊", "fox"],
  ["👑", "admin-crown"],
  ["🜂", "admin-void"],
]);

export function shopStatusItemKey(catalogKey: string) {
  return `status:${catalogKey}`;
}

export function parseJsonStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
}

export function canUseFrameKey(opts: {
  role: AppRole;
  unlockedFrames: Set<string>;
  frameKey: string | null | undefined;
}): boolean {
  const key = opts.frameKey;
  if (!key) return true;
  if (!KNOWN_FRAME_KEYS.has(key)) return false;
  if (CREATOR_ONLY_FRAME_KEYS.has(key)) return opts.role === "CREATOR";
  if (ADMIN_ONLY_FRAME_KEYS.has(key)) return opts.role === "ADMIN" || opts.role === "CREATOR";
  if (opts.role === "ADMIN" || opts.role === "CREATOR") return true;
  return opts.unlockedFrames.has(key);
}

export function canUseStatusCatalogKey(opts: {
  role: AppRole;
  unlockedStatuses: Set<string>;
  catalogKey: string;
}): boolean {
  if (!KNOWN_STATUS_CATALOG_KEYS.has(opts.catalogKey)) return false;
  if (ADMIN_ONLY_STATUS_KEYS.has(opts.catalogKey)) return opts.role === "ADMIN" || opts.role === "CREATOR";
  if (opts.role === "ADMIN" || opts.role === "CREATOR") return true;
  return opts.unlockedStatuses.has(opts.catalogKey);
}

export function canUseStatusEmoji(opts: {
  role: AppRole;
  unlockedStatuses: Set<string>;
  emoji: string | null | undefined;
}): boolean {
  const emoji = opts.emoji;
  if (!emoji) return true;
  const catalogKey = STATUS_EMOJI_TO_CATALOG_KEY.get(emoji);
  if (!catalogKey) return false;
  return canUseStatusCatalogKey({ role: opts.role, unlockedStatuses: opts.unlockedStatuses, catalogKey });
}
