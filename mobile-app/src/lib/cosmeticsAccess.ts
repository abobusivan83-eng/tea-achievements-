/**
 * Зеркало `backend/src/lib/cosmeticsAccess.ts` для выбора рамок в приложении
 * (без импорта бэкенда).
 */
export type AppRole = "USER" | "ADMIN" | "CREATOR";

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
  ...ADMIN_ONLY_FRAME_KEYS,
  ...CREATOR_ONLY_FRAME_KEYS,
]);

export function canUseFrameKey(opts: {
  role: AppRole;
  unlockedFrames: Set<string> | readonly string[];
  frameKey: string | null | undefined;
}): boolean {
  const key = opts.frameKey;
  if (!key) return true;
  if (!KNOWN_FRAME_KEYS.has(key)) return false;
  const unlocked = opts.unlockedFrames instanceof Set ? opts.unlockedFrames : new Set(opts.unlockedFrames);
  if (CREATOR_ONLY_FRAME_KEYS.has(key)) return opts.role === "CREATOR";
  if (ADMIN_ONLY_FRAME_KEYS.has(key)) return opts.role === "ADMIN" || opts.role === "CREATOR";
  if (opts.role === "ADMIN" || opts.role === "CREATOR") return true;
  return unlocked.has(key);
}
