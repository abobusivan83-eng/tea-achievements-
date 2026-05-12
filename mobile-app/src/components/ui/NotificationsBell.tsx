import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { fetchNotificationUnreadCount } from "../../api/support";
import { notificationUnreadKey } from "../../lib/queryKeys";
import { theme } from "../../theme";

function navigateToNotificationsTab(navigation: NavigationProp<ParamListBase>) {
  let nav: NavigationProp<ParamListBase> | undefined = navigation;
  for (let i = 0; i < 6; i++) {
    const parent = nav?.getParent?.() as NavigationProp<ParamListBase> | undefined;
    if (!parent) break;
    const st = parent.getState?.() as { type?: string } | undefined;
    if (st?.type === "tab") {
      (parent as { navigate: (name: string) => void }).navigate("Notifications");
      return;
    }
    nav = parent;
  }
}

export function NotificationsBell() {
  const nav = useNavigation<NavigationProp<ParamListBase>>();
  const { data: unread = 0 } = useQuery({
    queryKey: notificationUnreadKey,
    queryFn: fetchNotificationUnreadCount,
    staleTime: 45_000,
    refetchInterval: 120_000,
  });

  return (
    <Pressable style={styles.btn} onPress={() => navigateToNotificationsTab(nav)} hitSlop={10}>
      <Ionicons name="notifications-outline" size={22} color={theme.colors.text} />
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{unread > 99 ? "99+" : String(unread)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 10,
    backgroundColor: theme.colors.danger,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: theme.colors.background,
  },
  badgeTxt: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
