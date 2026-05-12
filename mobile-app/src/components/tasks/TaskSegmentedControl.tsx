import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme";

type Tab = "available" | "completed";

type Props = {
  value: Tab;
  onChange: (t: Tab) => void;
  availableCount?: number;
  completedCount?: number;
};

export function TaskSegmentedControl({ value, onChange, availableCount, completedCount }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange("available")}
        style={[styles.seg, value === "available" && styles.segOn]}
        accessibilityState={{ selected: value === "available" }}
      >
        <Text style={[styles.txt, value === "available" && styles.txtOn]}>Доступные</Text>
        {availableCount != null ? <Text style={[styles.cnt, value === "available" && styles.cntOn]}>{availableCount}</Text> : null}
      </Pressable>
      <Pressable
        onPress={() => onChange("completed")}
        style={[styles.seg, value === "completed" && styles.segOn]}
        accessibilityState={{ selected: value === "completed" }}
      >
        <Text style={[styles.txt, value === "completed" && styles.txtOn]}>Готово</Text>
        {completedCount != null ? <Text style={[styles.cnt, value === "completed" && styles.cntOn]}>{completedCount}</Text> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: theme.radius.lg,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    marginBottom: theme.space.sm,
  },
  seg: {
    flex: 1,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.md,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  segOn: {
    backgroundColor: "rgba(88,166,255,0.14)",
  },
  txt: {
    ...theme.typography.sm,
    color: theme.colors.textMuted,
    fontWeight: "700",
  },
  txtOn: { color: theme.colors.text },
  cnt: {
    ...theme.typography.xs,
    color: theme.colors.textMuted,
    fontWeight: "800",
    minWidth: 22,
    textAlign: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  cntOn: { color: theme.colors.accent, backgroundColor: "rgba(88,166,255,0.12)" },
});
