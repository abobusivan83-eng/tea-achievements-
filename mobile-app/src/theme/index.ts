import { palette, radius, shadows, space, typography } from "./tokens";

export const theme = {
  colors: {
    background: palette.canvas,
    backgroundDeep: palette.canvasDeep,
    text: palette.text,
    textMuted: palette.textMuted,
    textInverse: "#0d1117",
    surface: palette.surface,
    surfaceElevated: palette.surfaceElevated,
    surfaceAlt: palette.surfaceElevated,
    border: palette.border,
    accent: palette.accent,
    accentMuted: palette.accentSoft,
    navBar: palette.surface,
    navBarBorder: palette.borderStrong,
    danger: palette.danger,
    dangerSoft: palette.dangerSoft,
    steamGold: palette.gold,
    steamPurple: palette.purple,
    steamCyan: palette.cyan,
    success: palette.success,
    glass: palette.glass,
  },
  space,
  radius,
  typography,
  shadows,
} as const;

export type AppTheme = typeof theme;

export { palette, radius, shadows, space, typography };
