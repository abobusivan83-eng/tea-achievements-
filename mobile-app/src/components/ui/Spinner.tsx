import { ActivityIndicator, StyleSheet, View } from "react-native";
import { theme } from "../../theme";

type Props = { size?: "small" | "large"; fullScreen?: boolean };

export function Spinner({ size = "large", fullScreen }: Props) {
  const inner = <ActivityIndicator size={size} color={theme.colors.accent} />;
  if (fullScreen) {
    return <View style={styles.full}>{inner}</View>;
  }
  return inner;
}

const styles = StyleSheet.create({
  full: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.space.xl,
  },
});
