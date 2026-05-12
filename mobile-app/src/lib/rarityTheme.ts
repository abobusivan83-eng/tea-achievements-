import { theme } from "../theme";
import type { Rarity } from "../types/tasks";

/** Акценты редкости — как `--rare` / `--epic` / `--legendary` на сайте. */
export function rarityAccent(r: Rarity | undefined): { border: string; label: string; glow: string } {
  switch (r) {
    case "RARE":
      return { border: "rgba(75,105,255,0.5)", label: "#7ec8f8", glow: "rgba(102,192,244,0.2)" };
    case "EPIC":
      return { border: "rgba(136,71,255,0.5)", label: "#c4a3ff", glow: "rgba(136,71,255,0.22)" };
    case "LEGENDARY":
      return { border: "rgba(255,215,0,0.55)", label: "#ffe08a", glow: "rgba(255,215,0,0.2)" };
    case "EXCLUSIVE":
      return { border: "rgba(255,120,200,0.45)", label: "#ffb8e8", glow: "rgba(255,120,200,0.15)" };
    case "SECRET":
      return { border: "rgba(80,255,220,0.35)", label: "#7dffd9", glow: "rgba(80,255,220,0.12)" };
    default:
      return { border: theme.colors.border, label: theme.colors.textMuted, glow: "transparent" };
  }
}
