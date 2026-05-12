import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  ListRenderItem,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  AchievementDetailSheet,
  AppScreen,
  EmptyState,
  ErrorState,
  ListSkeleton,
  ScreenHeader,
  AppCard,
} from "../components";
import { fetchPublicProfile } from "../api/profile";
import { publicProfileKey } from "../lib/queryKeys";
import { useTabBarInset } from "../hooks/useTabBarInset";
import { theme } from "../theme";
import { rarityAccent } from "../lib/rarityTheme";
import type { Rarity } from "../types/tasks";

type PublicAchievementsParams = { userId: string; nickname?: string };
type PublicAchievementsRoute = RouteProp<{ PublicAchievements: PublicAchievementsParams }, "PublicAchievements">;

type TabKey = "open" | "closed";

type OpenRow = {
  kind: "open";
  id: string;
  title: string;
  description: string;
  rarity: string;
  iconUrl: string | null;
  points: number;
  awardedAt?: string;
};

type ClosedRow = {
  kind: "closed";
  id: string;
  title: string;
  description: string;
  rarity: string;
  iconUrl: string | null;
  points: number;
};

type Row = OpenRow | ClosedRow;

export function PublicUserAchievementsScreen() {
  const bottom = useTabBarInset();
  const { width } = useWindowDimensions();
  const navigation = useNavigation();
  const route = useRoute<PublicAchievementsRoute>();
  const { userId, nickname } = route.params;
  const [tab, setTab] = useState<TabKey>("open");
  const [selected, setSelected] = useState<Row | null>(null);

  const q = useQuery({
    queryKey: publicProfileKey(userId),
    queryFn: () => fetchPublicProfile(userId),
    enabled: Boolean(userId),
    staleTime: 40_000,
  });

  const openRows: OpenRow[] = useMemo(() => {
    const earned = q.data?.achievements.earned ?? [];
    return earned.map((a) => ({
      kind: "open" as const,
      id: a.id,
      title: a.title,
      description: a.description ?? "",
      rarity: a.rarity,
      iconUrl: a.iconUrl,
      points: a.points,
      awardedAt: a.awardedAt,
    }));
  }, [q.data?.achievements.earned]);

  const closedRows: ClosedRow[] = useMemo(() => {
    const locked = q.data?.achievements.locked ?? [];
    return locked.map((a) => ({
      kind: "closed" as const,
      id: a.id,
      title: a.title,
      description: a.description ?? "",
      rarity: a.rarity,
      iconUrl: a.iconUrl,
      points: a.points,
    }));
  }, [q.data?.achievements.locked]);

  const data = tab === "open" ? openRows : closedRows;
  const gap = theme.space.sm;
  const pad = theme.space.md * 2;
  const colW = (width - pad - gap) / 2;

  const renderItem: ListRenderItem<Row> = useCallback(
    ({ item, index }) => {
      const accent = rarityAccent(item.rarity as Rarity);
      const glow = item.rarity === "LEGENDARY" ? "gold" : item.rarity === "EPIC" ? "purple" : "none";
      return (
        <Animated.View style={{ width: colW, marginBottom: gap }} entering={FadeInDown.delay(Math.min(index, 12) * 32).duration(360)}>
          <AppCard glow={glow} style={[styles.cell, { borderColor: accent.border }]}>
            <Pressable
              onPress={() => setSelected(item)}
              style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }] }]}
              accessibilityRole="button"
            >
              <View style={styles.cellTop}>
                {item.iconUrl ? (
                  <Image
                    source={{ uri: item.iconUrl }}
                    style={styles.icon}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    recyclingKey={item.id}
                    transition={160}
                  />
                ) : (
                  <View style={[styles.icon, styles.iconPh]} />
                )}
                {item.kind === "open" ? (
                  <View style={styles.check}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                ) : (
                  <View style={styles.lockBadge}>
                    <Ionicons name="lock-closed" size={12} color={theme.colors.textMuted} />
                  </View>
                )}
              </View>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {item.rarity} · {item.points} очк.
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.viewBtn, pressed && styles.viewBtnPressed]}
              onPress={() => setSelected(item)}
            >
              <Text style={styles.viewBtnTxt}>Посмотреть достижение</Text>
              <Ionicons name="chevron-forward" size={14} color={theme.colors.accent} />
            </Pressable>
          </AppCard>
        </Animated.View>
      );
    },
    [colW, gap],
  );

  const headerLeft = navigation.canGoBack() ? (
    <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backHit}>
      <Text style={styles.backTxt}>‹</Text>
    </Pressable>
  ) : null;

  const title = nickname ? `Достижения · ${nickname}` : "Достижения";

  if (q.isLoading && !q.data) {
    return (
      <AppScreen scroll bottomInset={bottom}>
        <ScreenHeader title={title} left={headerLeft} />
        <ListSkeleton count={6} />
      </AppScreen>
    );
  }

  if (q.isError || !q.data) {
    return (
      <AppScreen scroll bottomInset={bottom}>
        <ScreenHeader title={title} left={headerLeft} />
        <ErrorState
          title="Не удалось загрузить"
          message={q.error instanceof Error ? q.error.message : "Ошибка сети"}
          onRetry={() => void q.refetch()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false} bottomInset={bottom}>
      <ScreenHeader title={title} left={headerLeft} subtitle={q.data.user.nickname} />

      <View style={styles.tabs}>
        <Pressable
          onPress={() => setTab("open")}
          style={[styles.tab, tab === "open" && styles.tabOn]}
          accessibilityState={{ selected: tab === "open" }}
        >
          <Text style={[styles.tabTxt, tab === "open" && styles.tabTxtOn]}>Открытые</Text>
          <Text style={[styles.tabCnt, tab === "open" && styles.tabCntOn]}>{openRows.length}</Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("closed")}
          style={[styles.tab, tab === "closed" && styles.tabOn]}
          accessibilityState={{ selected: tab === "closed" }}
        >
          <Text style={[styles.tabTxt, tab === "closed" && styles.tabTxtOn]}>Закрытые</Text>
          <Text style={[styles.tabCnt, tab === "closed" && styles.tabCntOn]}>{closedRows.length}</Text>
        </Pressable>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap }}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && q.data !== undefined}
            onRefresh={() => void q.refetch()}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            title={tab === "open" ? "Нет открытых" : "Нет закрытых"}
            subtitle={tab === "open" ? "У пользователя пока нет полученных достижений." : "Все видимые достижения уже открыты."}
            icon="ribbon-outline"
            style={{ marginTop: theme.space.lg }}
          />
        }
        removeClippedSubviews={Platform.OS === "android"}
      />

      {selected ? (
        <AchievementDetailSheet
          visible
          onClose={() => setSelected(null)}
          title={selected.title}
          description={selected.description}
          rarity={selected.rarity as Rarity}
          points={selected.points}
          iconUrl={selected.iconUrl}
          earned={selected.kind === "open"}
          awardedAt={selected.kind === "open" ? selected.awardedAt ?? null : null}
        />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  backHit: { width: 36, height: 36, justifyContent: "center" },
  backTxt: { fontSize: 28, color: theme.colors.accent, fontWeight: "300", marginTop: -4 },
  tabs: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: theme.radius.lg,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    marginBottom: theme.space.sm,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.md,
  },
  tabOn: { backgroundColor: "rgba(88,166,255,0.14)" },
  tabTxt: { ...theme.typography.sm, color: theme.colors.textMuted, fontWeight: "700" },
  tabTxtOn: { color: theme.colors.text },
  tabCnt: {
    ...theme.typography.xs,
    color: theme.colors.textMuted,
    fontWeight: "800",
    minWidth: 22,
    textAlign: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  tabCntOn: { color: theme.colors.accent, backgroundColor: "rgba(88,166,255,0.12)" },
  list: { paddingBottom: theme.space.md },
  cell: { padding: theme.space.sm },
  cellTop: { position: "relative", marginBottom: theme.space.xs },
  icon: { width: "100%", aspectRatio: 1, borderRadius: theme.radius.md, maxHeight: 88 },
  iconPh: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border },
  check: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  lockBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  title: { ...theme.typography.sm, color: theme.colors.text, fontWeight: "700", minHeight: 36 },
  meta: { ...theme.typography.xs, color: theme.colors.textMuted, marginTop: 4 },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: theme.space.sm,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: "rgba(102,192,244,0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(102,192,244,0.28)",
  },
  viewBtnPressed: { opacity: 0.92 },
  viewBtnTxt: { ...theme.typography.xs, color: theme.colors.accent, fontWeight: "800" },
});
