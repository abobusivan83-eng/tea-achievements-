import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  TabGlyphBell,
  TabGlyphChart,
  TabGlyphProfile,
  TabGlyphShop,
  TabGlyphTasks,
} from "../components/navigation/TabBarGlyphs";
import { theme } from "../theme";
import { TAB_BAR_CONTENT_HEIGHT } from "../hooks/useTabBarInset";

const MUTED = "#9aa4ae";

function TabIcon({ routeName, focused }: { routeName: string; focused: boolean }) {
  const color = focused ? theme.colors.accent : MUTED;
  const size = 22;
  switch (routeName) {
    case "Profile":
      return <TabGlyphProfile color={color} size={size} />;
    case "Tasks":
      return <TabGlyphTasks color={color} size={size} />;
    case "Shop":
      return <TabGlyphShop color={color} size={size} />;
    case "Leaderboard":
      return <TabGlyphChart color={color} size={size} />;
    case "Notifications":
      return <TabGlyphBell color={color} size={size} />;
    default:
      return <View style={{ width: size, height: size, borderRadius: 4, borderWidth: 2, borderColor: color }} />;
  }
}

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
                <TabIcon routeName={route.name} focused={isFocused} />
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
