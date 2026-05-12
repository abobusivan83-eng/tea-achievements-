import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { theme } from "../../theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = "primary" | "ghost" | "danger";

type Props = Omit<PressableProps, "children"> & {
  children: ReactNode;
  variant?: Variant;
  loading?: boolean;
  compact?: boolean;
};

export function Button({ children, variant = "primary", loading, compact, disabled, style, ...rest }: Props) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const isDisabled = disabled || loading;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPressIn={() => {
        if (!isDisabled) scale.value = withSpring(0.97, { damping: 16, stiffness: 420 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 360 });
      }}
      style={[
        anim,
        styles.base,
        compact ? styles.compact : styles.normal,
        variant === "primary" && styles.primary,
        variant === "ghost" && styles.ghost,
        variant === "danger" && styles.danger,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? theme.colors.textInverse : theme.colors.accent} />
      ) : typeof children === "string" ? (
        <Text
          style={[
            styles.label,
            variant === "primary" && styles.labelPrimary,
            variant === "ghost" && styles.labelGhost,
            variant === "danger" && styles.labelDanger,
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
  normal: {
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    minHeight: 48,
  },
  compact: {
    paddingVertical: theme.space.xs,
    paddingHorizontal: theme.space.md,
    minHeight: 40,
  },
  primary: {
    backgroundColor: theme.colors.accent,
    borderColor: "transparent",
    ...theme.shadows.navGlow,
  },
  ghost: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.10)",
  },
  danger: {
    backgroundColor: "rgba(201, 42, 42, 0.12)",
    borderColor: "rgba(201, 42, 42, 0.35)",
  },
  disabled: { opacity: 0.55 },
  label: {
    ...theme.typography.bodyStrong,
    fontSize: 14,
  },
  labelPrimary: { color: theme.colors.textInverse },
  labelGhost: { color: theme.colors.text },
  labelDanger: { color: "#ffb4b4" },
});
