import type { FrameOverlayId } from "./cosmetics";

/** Линейный градиент оболочки рамки — аппроксимация `frontend/src/styles.css` (`.frame--*`). */
export type ShellGradient = {
  colors: readonly [string, string, ...string[]];
  start: { x: number; y: number };
  end: { x: number; y: number };
};

const COMMON: ShellGradient = {
  colors: ["rgba(255,255,255,0.14)", "rgba(255,255,255,0.04)"],
  start: { x: 0.5, y: 0 },
  end: { x: 0.5, y: 1 },
};

/** Соответствует классам `frame--*` из `frontend/src/lib/cosmetics.ts` + `styles.css`. */
export const FRAME_SHELL_GRADIENTS: Record<string, ShellGradient> = {
  "frame--common": COMMON,
  "frame--carbon": {
    colors: ["rgba(255,255,255,0.14)", "rgba(0,0,0,0.22)", "rgba(255,255,255,0.06)"],
    start: { x: 0.3, y: 0.2 },
    end: { x: 1, y: 1 },
  },
  "frame--blueprint": {
    colors: ["rgba(102,192,244,0.22)", "rgba(18,28,39,0.92)", "rgba(15,24,34,0.88)"],
    start: { x: 0.2, y: 0 },
    end: { x: 0.8, y: 1 },
  },
  "frame--softglow": {
    colors: ["rgba(102,192,244,0.38)", "rgba(92,219,149,0.18)", "rgba(255,255,255,0.08)"],
    start: { x: 0.3, y: 0.2 },
    end: { x: 0.7, y: 1 },
  },
  "frame--rare": {
    colors: ["rgba(102,192,244,0.58)", "rgba(102,192,244,0.16)"],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
  },
  "frame--rare-shine": {
    colors: ["rgba(102,192,244,0.68)", "rgba(102,192,244,0.22)"],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
  },
  "frame--epic": {
    colors: ["rgba(170,90,240,0.68)", "rgba(170,90,240,0.18)"],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
  },
  "frame--epic-shine": {
    colors: ["rgba(170,90,240,0.75)", "rgba(170,90,240,0.22)"],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
  },
  "frame--legendary": {
    colors: ["rgba(255,190,70,0.72)", "rgba(255,190,70,0.16)"],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
  },
  "frame--legendary-animated": {
    colors: ["rgba(255,190,70,0.22)", "rgba(102,192,244,0.42)", "rgba(92,219,149,0.28)", "rgba(255,190,70,0.18)"],
    start: { x: 0, y: 1 },
    end: { x: 1, y: 0 },
  },
  "frame--legendary-particles": {
    colors: ["rgba(255,190,70,0.38)", "rgba(102,192,244,0.26)", "rgba(255,190,70,0.12)"],
    start: { x: 0.3, y: 0.2 },
    end: { x: 0.7, y: 1 },
  },
  "frame--neon": {
    colors: ["rgba(102,192,244,0.38)", "rgba(0,0,0,0.12)"],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
  },
  "frame--obsidian": {
    colors: ["rgba(255,255,255,0.12)", "rgba(10,10,14,0.92)", "rgba(0,0,0,0.82)"],
    start: { x: 0.3, y: 0.2 },
    end: { x: 0.5, y: 1 },
  },
  "frame--ember": {
    colors: ["rgba(255,90,40,0.42)", "rgba(255,190,70,0.38)", "rgba(0,0,0,0.14)"],
    start: { x: 0.3, y: 0.2 },
    end: { x: 0.5, y: 1 },
  },
  "frame--aurora": {
    colors: ["rgba(92,219,149,0.28)", "rgba(102,192,244,0.38)", "rgba(170,90,240,0.28)", "rgba(92,219,149,0.22)"],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  "frame--void": {
    colors: ["rgba(170,90,240,0.32)", "rgba(102,192,244,0.16)", "rgba(0,0,0,0.88)"],
    start: { x: 0.5, y: 0.4 },
    end: { x: 0.5, y: 1 },
  },
  "frame--sigil": {
    colors: ["rgba(170,90,240,0.58)", "rgba(0,0,0,0.12)"],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
  },
  "frame--holo": {
    colors: ["rgba(102,192,244,0.32)", "rgba(255,190,70,0.18)"],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
  },
  "frame--crown": {
    colors: ["rgba(255,190,70,0.22)", "rgba(255,255,255,0.12)", "rgba(255,190,70,0.18)"],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  "frame--glacier": {
    colors: ["rgba(150,220,255,0.42)", "rgba(102,192,244,0.24)", "rgba(255,255,255,0.05)"],
    start: { x: 0.3, y: 0.2 },
    end: { x: 0.5, y: 1 },
  },
  "frame--radioactive": {
    colors: ["rgba(60,255,120,0.38)", "rgba(60,255,120,0.14)", "rgba(0,0,0,0.14)"],
    start: { x: 0.3, y: 0.2 },
    end: { x: 0.5, y: 1 },
  },
  "frame--creator-nexus": {
    colors: ["rgba(102,192,244,0.48)", "rgba(170,90,240,0.38)", "rgba(255,190,70,0.32)"],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  "frame--creator-solar": {
    colors: ["rgba(255,230,150,0.55)", "rgba(255,140,40,0.32)", "rgba(40,22,8,0.9)", "rgba(0,0,0,0.88)"],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
  },
  "frame--creator-voidheart": {
    colors: ["rgba(170,90,240,0.48)", "rgba(102,192,244,0.18)", "rgba(0,0,0,0.92)"],
    start: { x: 0.5, y: 0.5 },
    end: { x: 0.5, y: 1 },
  },
  "frame--creator-pulse": {
    colors: ["rgba(102,192,244,0.38)", "rgba(255,70,200,0.24)", "rgba(92,219,149,0.22)"],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  "frame--creator-aurora": {
    colors: ["rgba(92,219,149,0.36)", "rgba(102,192,244,0.42)", "rgba(255,190,70,0.34)", "rgba(170,90,240,0.36)"],
    start: { x: 0, y: 1 },
    end: { x: 1, y: 0 },
  },
  "frame--creator-sigil": {
    colors: ["rgba(255,214,112,0.5)", "rgba(120,70,10,0.55)", "rgba(0,0,0,0.85)"],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
  },
  "frame--creator-nebula": {
    colors: ["rgba(170,90,240,0.4)", "rgba(102,192,244,0.35)", "rgba(8,4,22,0.95)", "rgba(0,0,0,0.9)"],
    start: { x: 0.3, y: 0.4 },
    end: { x: 0.7, y: 1 },
  },
  "frame--creator-founder": {
    colors: ["rgba(255,214,112,0.55)", "rgba(255,90,40,0.28)", "rgba(30,18,8,0.95)", "rgba(0,0,0,0.92)"],
    start: { x: 0.5, y: 0.35 },
    end: { x: 0.5, y: 1 },
  },
};

export function getFrameShellGradient(className: string): ShellGradient {
  return FRAME_SHELL_GRADIENTS[className] ?? COMMON;
}

/** Кольцо как `.avatar-frame--*` (border + glow) в `frontend/src/styles.css`. */
export type OverlayRingPreset = {
  borderColor: string;
  /** iOS тень (цвет свечения). */
  glowColor: string;
  shadowRadius: number;
  shadowOpacity: number;
  /** Пульс как `@keyframes` для анимированных оверлеев. */
  pulseShadow?: boolean;
};

export const OVERLAY_RING_PRESETS: Record<FrameOverlayId, OverlayRingPreset> = {
  none: {
    borderColor: "transparent",
    glowColor: "transparent",
    shadowRadius: 0,
    shadowOpacity: 0,
  },
  "metal-steel": {
    borderColor: "rgba(192,202,210,0.95)",
    glowColor: "rgba(102,192,244,0.35)",
    shadowRadius: 10,
    shadowOpacity: 0.45,
  },
  "metal-bronze": {
    borderColor: "rgba(205,127,50,0.95)",
    glowColor: "rgba(205,127,50,0.45)",
    shadowRadius: 10,
    shadowOpacity: 0.5,
  },
  "metal-gold": {
    borderColor: "rgba(255,215,0,0.95)",
    glowColor: "rgba(255,215,0,0.55)",
    shadowRadius: 12,
    shadowOpacity: 0.55,
    pulseShadow: true,
  },
  "minimal-blue": {
    borderColor: "rgba(102,192,244,0.85)",
    glowColor: "rgba(102,192,244,0.5)",
    shadowRadius: 10,
    shadowOpacity: 0.5,
  },
  "minimal-green": {
    borderColor: "rgba(92,219,149,0.75)",
    glowColor: "rgba(92,219,149,0.45)",
    shadowRadius: 10,
    shadowOpacity: 0.48,
  },
  "minimal-purple": {
    borderColor: "rgba(136,71,255,0.75)",
    glowColor: "rgba(136,71,255,0.45)",
    shadowRadius: 11,
    shadowOpacity: 0.5,
  },
  "carbon-grid": {
    borderColor: "rgba(139,148,158,0.85)",
    glowColor: "rgba(255,255,255,0.2)",
    shadowRadius: 8,
    shadowOpacity: 0.35,
  },
  "tech-circuit": {
    borderColor: "rgba(102,192,244,0.8)",
    glowColor: "rgba(56,139,253,0.45)",
    shadowRadius: 10,
    shadowOpacity: 0.45,
  },
  "arcane-runes": {
    borderColor: "rgba(194,151,255,0.88)",
    glowColor: "rgba(110,64,201,0.4)",
    shadowRadius: 11,
    shadowOpacity: 0.48,
  },
  "royal-crown": {
    borderColor: "rgba(255,213,106,0.92)",
    glowColor: "rgba(255,190,70,0.5)",
    shadowRadius: 12,
    shadowOpacity: 0.52,
  },
  "neon-edges": {
    borderColor: "rgba(255,0,255,0.75)",
    glowColor: "rgba(102,192,244,0.35)",
    shadowRadius: 12,
    shadowOpacity: 0.45,
    pulseShadow: true,
  },
  "retro-pixel": {
    borderColor: "rgba(126,231,135,0.75)",
    glowColor: "rgba(102,192,244,0.3)",
    shadowRadius: 8,
    shadowOpacity: 0.38,
  },
  "ember-flame": {
    borderColor: "rgba(255,69,0,0.8)",
    glowColor: "rgba(255,69,0,0.48)",
    shadowRadius: 12,
    shadowOpacity: 0.5,
    pulseShadow: true,
  },
  "glacier-crystal": {
    borderColor: "rgba(0,255,255,0.65)",
    glowColor: "rgba(185,242,255,0.4)",
    shadowRadius: 11,
    shadowOpacity: 0.45,
  },
  "void-aura": {
    borderColor: "rgba(148,0,211,0.6)",
    glowColor: "rgba(170,90,240,0.42)",
    shadowRadius: 12,
    shadowOpacity: 0.45,
    pulseShadow: true,
  },
  radioactive: {
    borderColor: "rgba(0,255,0,0.65)",
    glowColor: "rgba(0,255,0,0.4)",
    shadowRadius: 10,
    shadowOpacity: 0.45,
    pulseShadow: true,
  },
  sigil: {
    borderColor: "rgba(170,90,240,0.82)",
    glowColor: "rgba(88,166,255,0.35)",
    shadowRadius: 11,
    shadowOpacity: 0.45,
  },
  "holo-prism": {
    borderColor: "rgba(102,192,244,0.75)",
    glowColor: "rgba(255,190,70,0.35)",
    shadowRadius: 12,
    shadowOpacity: 0.48,
  },
};

export function getOverlayRingPreset(overlayId: FrameOverlayId): OverlayRingPreset {
  return OVERLAY_RING_PRESETS[overlayId] ?? OVERLAY_RING_PRESETS["metal-steel"];
}
