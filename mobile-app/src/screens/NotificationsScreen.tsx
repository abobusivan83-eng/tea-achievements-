import { useCallback, useMemo } from "react";
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppScreen, EmptyState, ErrorState, ListSkeleton, ScreenHeader, AppCard } from "../components";
import { theme } from "../theme";
import { useTabBarInset } from "../hooks/useTabBarInset";
import { fetchNotifications, markNotificationRead } from "../api/support";
import { notificationUnreadKey, notificationsListKey } from "../lib/queryKeys";
import type { Notification } from "../types/support";

function formatNotificationText(text: string) {
  const cleaned = text
    .split("\n")
    .filter((line) => !line.trim().startsWith("[COIN_BONUS]:"))
    .join("\n")
    .trim();
  return cleaned || text;
}

function sectionsFrom(items: Notification[]) {
  const sorted = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const sections: { title: string; data: Notification[] }[] = [];
  for (const it of sorted) {
    const title = new Date(it.createdAt).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const last = sections[sections.length - 1];
    if (last && last.title === title) last.data.push(it);
    else sections.push({ title, data: [it] });
  }
  return sections;
}

export function NotificationsScreen() {
  const bottom = useTabBarInset();
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: notificationsListKey,
    queryFn: () => fetchNotifications(50),
    staleTime: 25_000,
  });

  const sections = useMemo(() => sectionsFrom(q.data ?? []), [q.data]);

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsListKey });
      void queryClient.invalidateQueries({ queryKey: notificationUnreadKey });
    },
  });

  const onRefresh = useCallback(() => void q.refetch(), [q]);

  const renderRight = useCallback(
    (id: string, isRead: boolean) => {
      if (isRead) {
        return <View style={styles.swipeSpacer} />;
      }
      return (
        <Pressable
          style={styles.swipeRead}
          onPress={() => markRead.mutate(id)}
        >
          <Text style={styles.swipeReadTxt}>Прочитано</Text>
        </Pressable>
      );
    },
    [markRead],
  );

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => (
      <Swipeable renderRightActions={() => renderRight(item.id, item.isRead)}>
        <Pressable
          onPress={() => {
            if (!item.isRead) markRead.mutate(item.id);
          }}
        >
          <AppCard style={!item.isRead ? [styles.row, styles.unread] : styles.row}>
            <View style={styles.rowTop}>
              <Text style={styles.type}>{item.type}</Text>
              <Text style={styles.date}>{new Date(item.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</Text>
            </View>
            <Text style={styles.body}>{formatNotificationText(item.text)}</Text>
            {item.adminName ? <Text style={styles.admin}>От: {item.adminName}</Text> : null}
          </AppCard>
        </Pressable>
      </Swipeable>
    ),
    [markRead, renderRight],
  );

  if (q.isLoading && q.data === undefined) {
    return (
      <AppScreen scroll bottomInset={bottom}>
        <ScreenHeader title="Уведомления" subtitle="Лента как в мессенджере" />
        <ListSkeleton count={5} />
      </AppScreen>
    );
  }

  if (q.isError) {
    return (
      <AppScreen scroll bottomInset={bottom}>
        <ScreenHeader title="Уведомления" />
        <ErrorState
          title="Не удалось загрузить"
          message={q.error instanceof Error ? q.error.message : "Ошибка сети."}
          onRetry={onRefresh}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false} bottomInset={bottom}>
      <ScreenHeader title="Уведомления" subtitle="Свайп вправо — отметить прочтение" />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.secHead}>
            <Text style={styles.secTitle}>{title}</Text>
          </View>
        )}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Пока тихо"
            subtitle="Система и поддержка пришлют сообщения сюда."
            icon="notifications-off-outline"
            style={{ marginTop: theme.space.lg }}
          />
        }
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
    paddingBottom: theme.space.xl,
  },
  secHead: {
    paddingTop: theme.space.sm,
    paddingBottom: theme.space.xs,
    backgroundColor: "transparent",
  },
  secTitle: {
    ...theme.typography.xs,
    color: theme.colors.textMuted,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  row: { marginBottom: theme.space.sm },
  unread: { borderColor: "rgba(88,166,255,0.35)" },
  rowTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  type: { ...theme.typography.xs, color: theme.colors.accent, fontWeight: "800" },
  date: { ...theme.typography.xs, color: theme.colors.textMuted },
  body: { ...theme.typography.body, color: theme.colors.text },
  admin: { ...theme.typography.sm, color: theme.colors.textMuted, marginTop: 8 },
  swipeRead: {
    width: 96,
    backgroundColor: theme.colors.success,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: theme.space.sm,
    borderTopRightRadius: theme.radius.lg,
    borderBottomRightRadius: theme.radius.lg,
  },
  swipeReadTxt: { ...theme.typography.xs, color: "#fff", fontWeight: "900" },
  swipeSpacer: { width: 8, marginBottom: theme.space.sm },
});
