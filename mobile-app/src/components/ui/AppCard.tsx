import type { PropsWithChildren } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "../../theme";

type Props = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  /** Мягкое свечение для legendary / premium рядов */
  glow?: "none" | "gold" | "purple" | "accent";
}>;

export function AppCard({ children, style, glow = "none" }: Props) {
  return <View style={[styles.card, glow !== "none" && glowStyles[glow], style]}>{children}</View>;
}

const glowStyles = StyleSheet.create({
  gold: theme.shadows.glowGold,
  purple: theme.shadows.glowPurple,
  accent: {
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
});

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.space.md,
  },
});
