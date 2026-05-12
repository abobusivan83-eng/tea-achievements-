import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme";

type Props = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
};

export function AppHeader({ title, subtitle, right }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: theme.space.sm,
    marginBottom: theme.space.md,
  },
  textWrap: { flex: 1 },
  title: { ...theme.typography.title, color: theme.colors.text },
  subtitle: { ...theme.typography.sm, color: theme.colors.textMuted, marginTop: 4 },
});
