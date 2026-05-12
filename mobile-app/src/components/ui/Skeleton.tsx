import { useEffect } from "react";
import { StyleSheet, View, type DimensionValue } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { theme } from "../../theme";

type Props = {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
};

export function Skeleton({ width = "100%", height = 16, radius = theme.radius.sm }: Props) {
  const o = useSharedValue(0.35);

  useEffect(() => {
    o.value = withRepeat(
      withSequence(withTiming(0.85, { duration: 700 }), withTiming(0.35, { duration: 700 })),
      -1,
    );
  }, [o]);

  const style = useAnimatedStyle(() => ({
    opacity: o.value,
  }));

  return (
    <Animated.View
      style={[
        styles.box,
        { width, height, borderRadius: radius },
        style,
      ]}
    />
  );
}

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton height={20} width="70%" radius={theme.radius.sm} />
      <Skeleton height={14} width="100%" />
      <Skeleton height={14} width="90%" />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: "rgba(199, 213, 224, 0.12)",
  },
  card: {
    gap: theme.space.sm,
    padding: theme.space.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(27, 40, 56, 0.5)",
  },
});
