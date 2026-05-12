import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme";

type Props = {
  text: string;
};

export function AppBadge({ text }: Props) {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  text: { ...theme.typography.xs, color: theme.colors.text, fontWeight: "700" },
});
