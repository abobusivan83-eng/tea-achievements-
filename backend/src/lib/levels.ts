export const MAX_LEVEL = 100;

export function xpForLevel(level: number): number {
  // Steam-like curve: grows faster over time, but early levels are quick.
  const l = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
  return Math.floor(80 * l + 25 * l * l);
}

export function levelFromXp(xp: number): { level: number; xpIntoLevel: number; xpForNext: number } {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = 1;
  while (safeXp >= xpForLevel(level + 1) && level < MAX_LEVEL) level++;
  if (level >= MAX_LEVEL) {
    return { level: MAX_LEVEL, xpIntoLevel: 0, xpForNext: 1 };
  }
  const xpIntoLevel = safeXp - xpForLevel(level);
  const xpForNext = xpForLevel(level + 1) - xpForLevel(level);
  return { level, xpIntoLevel: Math.max(0, xpIntoLevel), xpForNext: Math.max(1, xpForNext) };
}

