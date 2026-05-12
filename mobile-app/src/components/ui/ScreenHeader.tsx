import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme";

type Props = {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  /** Крупный заголовок (редко: только лендинги). По умолчанию — компактный app-header. */
  large?: boolean;
  /** Один ряд: меньше вертикального шума. */
  compact?: boolean;
};

export function ScreenHeader({ title, subtitle, left, right, large, compact = true }: Props) {
  const useCompact = compact && !large;
  return (
    <View style={[styles.row, useCompact && styles.rowCompact]}>
      {left ? <View style={styles.left}>{left}</View> : null}
      <View style={[styles.textBlock, left ? styles.textWithLeft : undefined]}>
        <Text style={[large ? styles.titleLarge : useCompact ? styles.titleCompact : styles.title]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.sub, useCompact && styles.subCompact]} numberOfLines={useCompact ? 1 : 3}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.space.sm,
    marginBottom: theme.space.md,
    paddingTop: theme.space.xxs,
  },
  rowCompact: {
    marginBottom: theme.space.sm,
    alignItems: "flex-start",
  },
  left: { marginRight: -4 },
  textBlock: { flex: 1, minWidth: 0 },
  textWithLeft: { paddingLeft: theme.space.xs },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
    letterSpacing: 0.2,
  },
  titleCompact: {
    ...theme.typography.title,
    fontSize: 20,
    lineHeight: 26,
    color: theme.colors.text,
    letterSpacing: 0.15,
  },
  titleLarge: {
    ...theme.typography.hero,
    color: theme.colors.text,
    letterSpacing: 0.1,
  },
  sub: {
    ...theme.typography.sm,
    color: theme.colors.textMuted,
    marginTop: theme.space.xs,
  },
  subCompact: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
  },
  right: { marginTop: 0, alignSelf: "center" },
});
