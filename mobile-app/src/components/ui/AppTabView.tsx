import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme";

type TabItem = {
  key: string;
  label: string;
};

type Props = {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
};

export function AppTabView({ items, value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={() => onChange(item.key)}
          style={[styles.tab, value === item.key && styles.tabActive]}
        >
          <Text style={[styles.tabText, value === item.key && styles.tabTextActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.xs, marginBottom: theme.space.md },
  tab: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.space.sm,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  tabActive: {
    borderColor: theme.colors.accent,
    backgroundColor: "rgba(102,192,244,0.14)",
  },
  tabText: { ...theme.typography.xs, color: theme.colors.textMuted, fontWeight: "700" },
  tabTextActive: { color: theme.colors.text },
});
