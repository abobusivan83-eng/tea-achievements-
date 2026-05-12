/**
 * Mobile-first premium dark: GitHub-style base + clan accents (gold / purple / blue).
 */
export const palette = {
  canvas: "#0f1218",
  canvasDeep: "#070a10",
  surface: "#161b22",
  surfaceElevated: "#1c2128",
  border: "rgba(240,246,252,0.12)",
  borderStrong: "rgba(240,246,252,0.18)",
  text: "#e6edf3",
  textMuted: "#8b949e",
  textDim: "#6e7681",
  /** Как на сайте: --steam-blue */
  accent: "#66c0f4",
  accentSoft: "rgba(102,192,244,0.45)",
  accentGlow: "rgba(102,192,244,0.14)",
  /** --steam-gold */
  gold: "#ffd700",
  goldSoft: "rgba(255,215,0,0.22)",
  /** --steam-purple / epic */
  purple: "#8847ff",
  purpleSoft: "rgba(136,71,255,0.2)",
  cyan: "#06b6d4",
  danger: "#f85149",
  dangerSoft: "rgba(248,81,73,0.2)",
  success: "#3fb950",
  successSoft: "rgba(63,185,80,0.18)",
  glass: "rgba(22,27,34,0.72)",
  /** Legacy aliases used by rarityTheme / older code */
  steamDark: "#161b22",
  steamSecondary: "#0d1117",
  steamLight: "#21262d",
  steamHover: "#30363d",
  steamBlue: "#66c0f4",
  steamBlueHover: "#42a8d9",
  steamBlueDark: "#1b5a7f",
  steamGreen: "#3fb950",
  steamGold: "#e3b341",
  steamPurple: "#a371f7",
  steamCyan: "#39d0d8",
  steamRed: "#f85149",
  steamText: "#e6edf3",
  steamTextDim: "#8b949e",
  steamTextPrimary: "#ffffff",
  steamBorder: "rgba(240,246,252,0.12)",
  bg1: "#0d1117",
  bg2: "#010409",
  panel1: "rgba(22,27,34,0.94)",
  panel2: "rgba(13,17,23,0.92)",
} as const;

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const typography = {
  xs: { fontSize: 11, lineHeight: 14, fontWeight: "600" as const },
  sm: { fontSize: 13, lineHeight: 18, fontWeight: "500" as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" as const },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: "600" as const },
  title: { fontSize: 18, lineHeight: 24, fontWeight: "700" as const },
  hero: { fontSize: 22, lineHeight: 28, fontWeight: "800" as const },
} as const;

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
  cardHover: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 32,
    elevation: 12,
  },
  navGlow: {
    shadowColor: "#66c0f4",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 12,
  },
  glowGold: {
    shadowColor: "#ffd700",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  glowPurple: {
    shadowColor: "#a371f7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  glowSilver: {
    shadowColor: "#d4dae3",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 8,
  },
  glowBronze: {
    shadowColor: "#cd7f32",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 7,
  },
} as const;
