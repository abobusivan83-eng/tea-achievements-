import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { theme } from "../theme";
import { TAB_BAR_CONTENT_HEIGHT } from "../hooks/useTabBarInset";

/** В духе сайта: тонкие line-иконки (аналог react-icons/fi). */
const TAB_ICONS: Record<string, ComponentProps<typeof Ionicons>["name"]> = {
  Profile: "person-outline",
  Tasks: "checkbox-outline",
  Shop: "bag-handle-outline",
  Leaderboard: "trending-up-outline",
  Notifications: "notifications-outline",
};

export function PremiumTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom }]}>
      <LinearGradient
        colors={["rgba(22,27,34,0.92)", "rgba(13,17,23,0.98)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.row, { minHeight: TAB_BAR_CONTENT_HEIGHT }]}>
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          if (!descriptor) return null;
          const { options } = descriptor;
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : (options.title as string) ?? route.name;
          const isFocused = state.index === index;
          const ion = TAB_ICONS[route.name] ?? "ellipse-outline";

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              onPress={onPress}
              style={styles.item}
            >
              <View style={[styles.iconWrap, isFocused && styles.iconWrapOn]}>
                <Ionicons
                  name={ion}
                  size={22}
                  color={isFocused ? theme.colors.accent : "#9aa4ae"}
                  style={{ opacity: isFocused ? 1 : 0.9 }}
                />
              </View>
              <Text style={[styles.label, isFocused && styles.labelFocused]} numberOfLines={1} allowFontScaling={false}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 2,
    borderTopColor: "rgba(102, 192, 244, 0.45)",
    overflow: "hidden",
    ...theme.shadows.navGlow,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.space.xs,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.space.xs,
    gap: 2,
  },
  iconWrap: {
    width: 40,
    height: 30,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapOn: {
    backgroundColor: "rgba(88,166,255,0.12)",
  },
  label: {
    ...theme.typography.xs,
    fontSize: 10,
    color: "#9aa4ae",
    textAlign: "center",
    fontWeight: "600",
  },
  labelFocused: {
    color: theme.colors.text,
  },
});
