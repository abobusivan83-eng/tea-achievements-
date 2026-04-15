const MIN_LEVEL = 1;
const MAX_LEVEL = 100;

const START_RGB = { r: 255, g: 255, b: 255 }; // #FFFFFF
const END_RGB = { r: 255, g: 215, b: 0 }; // #FFD700

function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return MIN_LEVEL;
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level)));
}

function lerp(start: number, end: number, t: number): number {
  return Math.round(start + (end - start) * t);
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, "0").toUpperCase();
}

export function calculateLevelColor(level: number): string {
  const clamped = clampLevel(level);
  const t = (clamped - MIN_LEVEL) / (MAX_LEVEL - MIN_LEVEL);
  const r = lerp(START_RGB.r, END_RGB.r, t);
  const g = lerp(START_RGB.g, END_RGB.g, t);
  const b = lerp(START_RGB.b, END_RGB.b, t);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

