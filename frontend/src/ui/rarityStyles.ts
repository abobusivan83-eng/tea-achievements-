import type { Rarity } from "../lib/types";

export function rarityGlowClass(rarity: Rarity, earned: boolean) {
  const base = "transition-all duration-300 ease-in-out rarity-glow";
  if (!earned) return base;
  switch (rarity) {
    case "COMMON":
      return `${base} rarity-glow--common`;
    case "RARE":
      return `${base} rarity-glow--rare`;
    case "EPIC":
      return `${base} rarity-glow--epic`;
    case "LEGENDARY":
      return `${base} rarity-glow--legendary`;
    case "EXCLUSIVE":
      return `${base} rarity-glow--exclusive`;
    case "SECRET":
      return `${base} rarity-glow--secret`;
    default:
      return base;
  }
}

