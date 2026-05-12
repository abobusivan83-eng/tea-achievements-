import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../../theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PropsWithChildren<{
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Визуально сильнее (как hover на сайте) */
  emphasized?: boolean;
}>;

export function SteamCard({ children, onPress, style, emphasized }: Props) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const inner = (
    <View style={[styles.outer, emphasized && styles.outerEmphasized, style]}>
      <LinearGradient
        colors={[theme.colors.surface, theme.colors.surfaceAlt]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(255,255,255,0.07)", "transparent", "rgba(102,192,244,0.06)"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.highlight}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );

  if (!onPress) {
    return inner;
  }

  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPressIn={() => {
        scale.value = withSpring(0.978, { damping: 15, stiffness: 400 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 320 });
      }}
      onPress={onPress}
      style={animStyle}
    >
      {inner}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
    ...theme.shadows.card,
  },
  outerEmphasized: {
    borderColor: "rgba(102, 192, 244, 0.22)",
    ...theme.shadows.cardHover,
  },
  highlight: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.95,
  },
  content: { padding: theme.space.md, position: "relative" },
});
