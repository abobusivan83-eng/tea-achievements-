import { useCallback, useMemo } from "react";
import { FlatList, ListRenderItem, Platform, Pressable, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueries } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AppScreen, EmptyState, ErrorState, ListSkeleton, ScreenHeader, AppCard } from "../components";
import { fetchLeaderboard } from "../api/leaderboard";
import { fetchPublicProfile, type PublicProfileDto } from "../api/profile";
import { leaderboardKey, publicProfileKey } from "../lib/queryKeys";
import { useTabBarInset } from "../hooks/useTabBarInset";
import { theme } from "../theme";
import type { LeaderboardRow } from "../types/leaderboard";
import type { LeaderboardStackParamList } from "../navigation/types";

const PODIUM_COLORS = ["#e3b341", "#d8dee9", "#cd7f32"] as const;

export function LeaderboardScreen() {
  const bottom = useTabBarInset();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<LeaderboardStackParamList>>();
  const q = useQuery({
    queryKey: leaderboardKey,
    queryFn: fetchLeaderboard,
    staleTime: 55_000,
  });

  const rows = q.data ?? [];
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  const topProfilesQ = useQueries({
    queries: top3.map((row) => ({
      queryKey: publicProfileKey(row.id),
      queryFn: () => fetchPublicProfile(row.id),
      enabled: Boolean(row?.id),
      staleTime: 120_000,
    })),
  });

  const detailFor = useCallback(
    (id: string) => {
      const idx = top3.findIndex((r) => r.id === id);
      if (idx < 0) return undefined;
      return topProfilesQ[idx]?.data;
    },
    [top3, topProfilesQ],
  );

  const stats = useMemo(() => {
    const sum = rows.reduce((s, r) => s + r.totalPoints, 0);
    const ach = rows.reduce((s, r) => s + r.achievementCount, 0);
    return { players: rows.length, ach, sum };
  }, [rows]);

  const openProfile = useCallback(
    (userId: string) => {
      navigation.navigate("PublicProfile", { userId });
    },
    [navigation],
  );

  const podiumW = Math.min(width - theme.space.md * 2, 400);
  const slotW = podiumW / 3 - 6;

  const renderRest: ListRenderItem<LeaderboardRow> = useCallback(
    ({ item, index }) => {
      const rank = index + 4;
      return (
        <Animated.View entering={FadeInDown.delay(Math.min(index, 16) * 28).duration(340)}>
          <Pressable onPress={() => openProfile(item.id)}>
            <AppCard style={styles.rowCard}>
              <View style={styles.rowInner}>
                <Text style={styles.rankMuted}>{rank}</Text>
                {item.avatarUrl ? (
                  <Image source={{ uri: item.avatarUrl }} style={styles.smallAva} contentFit="cover" cachePolicy="memory-disk" />
                ) : (
                  <View style={[styles.smallAva, styles.avaPh]} />
                )}
                <View style={styles.rowBody}>
                  <Text style={styles.name} numberOfLines={2} ellipsizeMode="tail">
                    {item.nickname}
                  </Text>
                  <Text style={styles.meta} numberOfLines={2} ellipsizeMode="tail">
                    {item.totalPoints} очк. · {item.achievementCount} дост.
                    {item.level != null ? ` · ур. ${item.level}` : ""}
                  </Text>
                </View>
              </View>
            </AppCard>
          </Pressable>
        </Animated.View>
      );
    },
    [openProfile],
  );

  if (q.isLoading && q.data === undefined) {
    return (
      <AppScreen scroll bottomInset={bottom}>
        <ScreenHeader title="Рейтинг" subtitle="Очки за достижения" />
        <ListSkeleton count={7} />
      </AppScreen>
    );
  }

  if (q.isError) {
    return (
      <AppScreen scroll bottomInset={bottom}>
        <ScreenHeader title="Рейтинг" />
        <ErrorState
          title="Рейтинг недоступен"
          message={q.error instanceof Error ? q.error.message : "Не удалось получить таблицу."}
          onRetry={() => void q.refetch()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false} bottomInset={bottom} contentStyle={styles.screenFill}>
      <ScreenHeader title="Рейтинг" subtitle="Топ клана по очкам" />

      <AppCard style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{stats.players}</Text>
          <Text style={styles.statLbl}>игроков</Text>
        </View>
        <View style={styles.statSep} />
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{stats.ach}</Text>
          <Text style={styles.statLbl}>достижений</Text>
        </View>
        <View style={styles.statSep} />
        <View style={styles.statBox}>
          <Text style={styles.statNum} numberOfLines={1}>
            {stats.sum}
          </Text>
          <Text style={styles.statLbl}>сумма</Text>
        </View>
      </AppCard>

      {top3.length > 0 ? (
        <Animated.View entering={FadeInDown.duration(420)} style={[styles.podium, { width: podiumW }]}>
          <PodiumSlot
            row={top3[1]}
            rank={2}
            color={PODIUM_COLORS[1]}
            width={slotW}
            glow="silver"
            detail={top3[1] ? detailFor(top3[1].id) : undefined}
            onPress={() => {
              const u = top3[1];
              if (u) openProfile(u.id);
            }}
          />
          <PodiumSlot
            row={top3[0]}
            rank={1}
            color={PODIUM_COLORS[0]}
            width={slotW}
            glow="gold"
            detail={top3[0] ? detailFor(top3[0].id) : undefined}
            onPress={() => {
              const u = top3[0];
              if (u) openProfile(u.id);
            }}
          />
          <PodiumSlot
            row={top3[2]}
            rank={3}
            color={PODIUM_COLORS[2]}
            width={slotW}
            glow="bronze"
            detail={top3[2] ? detailFor(top3[2].id) : undefined}
            onPress={() => {
              const u = top3[2];
              if (u) openProfile(u.id);
            }}
          />
        </Animated.View>
      ) : null}

      <FlatList
        data={rest}
        keyExtractor={(item) => item.id}
        style={styles.listFlex}
        renderItem={renderRest}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => void q.refetch()}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          rows.length === 0 ? (
            <EmptyState
              title="Нет записей"
              subtitle="Когда участники появятся, таблица заполнится."
              icon="podium-outline"
              style={{ marginTop: theme.space.lg }}
            />
          ) : (
            <View style={{ height: theme.space.md }} />
          )
        }
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={12}
        windowSize={10}
      />
    </AppScreen>
  );
}

function PodiumSlot({
  row,
  rank,
  color,
  width,
  glow,
  detail,
  onPress,
}: {
  row: LeaderboardRow | undefined;
  rank: number;
  color: string;
  width: number;
  glow: "gold" | "silver" | "bronze";
  detail?: PublicProfileDto;
  onPress: () => void;
}) {
  if (!row) {
    return <View style={{ width, minWidth: width, height: 40 }} />;
  }
  const u = detail?.user;
  const bannerUrl = u?.bannerUrl?.trim() ? u.bannerUrl : undefined;
  const frameKey = u?.frameKey;
  const userRole = u?.role;
  const frameRing = (() => {
    if (userRole === "CREATOR") {
      return { borderColor: "rgba(255,215,0,0.65)", borderWidth: 3 };
    }
    if (frameKey) {
      return { borderColor: "rgba(102,192,244,0.55)", borderWidth: 3 };
    }
    return { borderColor: theme.colors.border, borderWidth: 2 };
  })();
  const outerGlow =
    glow === "gold" ? styles.podiumOuterGold : glow === "silver" ? styles.podiumOuterSilver : styles.podiumOuterBronze;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.slot, { width, maxWidth: width }]}
      accessibilityRole="button"
      accessibilityLabel={`${row.nickname}, ${row.totalPoints} очков`}
    >
      <View style={[styles.podiumOuter, outerGlow, { borderColor: color }]}>
        <View style={styles.podiumCard}>
          <View style={styles.podiumBannerWrap}>
            {bannerUrl ? (
              <Image source={{ uri: bannerUrl }} style={styles.podiumBannerImg} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <LinearGradient colors={["rgba(35,45,62,0.95)", "rgba(13,17,23,0.98)"]} style={styles.podiumBannerImg} />
            )}
            <LinearGradient
              colors={["transparent", "rgba(13,17,23,0.92)"]}
              style={styles.podiumBannerFade}
              pointerEvents="none"
            />
          </View>

          <View style={styles.podiumBody}>
            <View style={[styles.rankCircle, { borderColor: color }]}>
              <Text style={[styles.rankCircleTxt, { color }]} allowFontScaling={false}>
                {rank}
              </Text>
            </View>

            <View style={[styles.podiumAvaRing, { borderColor: frameRing.borderColor, borderWidth: frameRing.borderWidth }]}>
              {row.avatarUrl ? (
                <Image source={{ uri: row.avatarUrl }} style={styles.podiumAva} contentFit="cover" cachePolicy="memory-disk" />
              ) : (
                <View style={[styles.podiumAva, styles.avaPh]} />
              )}
            </View>

            <Text style={styles.podiumName} numberOfLines={2} ellipsizeMode="tail" allowFontScaling={false}>
              {row.nickname}
            </Text>
            <Text style={styles.podiumPts} allowFontScaling={false}>
              {row.totalPoints} очк.
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screenFill: { flex: 1 },
  listFlex: { flex: 1 },
  statsRow: {
    flexDirection: "row",
    marginBottom: theme.space.md,
    paddingVertical: theme.space.sm,
  },
  statBox: { flex: 1, alignItems: "center" },
  statSep: { width: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
  statNum: { ...theme.typography.title, color: theme.colors.text, fontSize: 17 },
  statLbl: { ...theme.typography.xs, color: theme.colors.textMuted, marginTop: 2, textTransform: "uppercase" },
  podium: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    alignSelf: "center",
    marginBottom: theme.space.md,
    gap: 6,
  },
  slot: { alignItems: "stretch", alignSelf: "flex-end" },
  /** Только внешнее свечение + рамка; без заливки «золотых теней» внутри карточки. */
  podiumOuter: {
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 2,
    backgroundColor: "transparent",
  },
  podiumOuterGold: {
    ...theme.shadows.glowGold,
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 8,
  },
  podiumOuterSilver: {
    ...theme.shadows.glowSilver,
    shadowOpacity: 0.45,
    elevation: 6,
  },
  podiumOuterBronze: {
    ...theme.shadows.glowBronze,
    shadowOpacity: 0.48,
    elevation: 6,
  },
  podiumCard: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    overflow: "hidden",
    width: "100%",
  },
  podiumBannerWrap: {
    width: "100%",
    height: 56,
    position: "relative",
    backgroundColor: "#121822",
  },
  podiumBannerImg: { width: "100%", height: "100%" },
  podiumBannerFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "62%",
  },
  podiumBody: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 6,
  },
  podiumAvaRing: {
    borderRadius: 40,
    padding: 2,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  rankCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    backgroundColor: "rgba(13,17,23,0.55)",
  },
  rankCircleTxt: { fontWeight: "900", fontSize: 12 },
  podiumAva: { width: 48, height: 48, borderRadius: 24 },
  avaPh: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border },
  podiumName: {
    fontSize: 11,
    lineHeight: 14,
    color: theme.colors.text,
    fontWeight: "700",
    textAlign: "center",
    width: "100%",
    minHeight: 28,
    paddingHorizontal: 2,
  },
  podiumPts: {
    fontSize: 13,
    lineHeight: 16,
    color: theme.colors.accent,
    fontWeight: "800",
    marginTop: 2,
  },
  list: { paddingBottom: theme.space.md },
  rowCard: { marginBottom: theme.space.sm },
  rowInner: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },
  rankMuted: {
    width: 22,
    ...theme.typography.sm,
    color: theme.colors.textMuted,
    fontWeight: "800",
    textAlign: "center",
  },
  smallAva: { width: 40, height: 40, borderRadius: 20 },
  rowBody: { flex: 1, minWidth: 0, overflow: "hidden" },
  name: { ...theme.typography.bodyStrong, color: theme.colors.text, fontSize: 15, flexShrink: 1 },
  meta: { ...theme.typography.xs, color: theme.colors.textMuted, marginTop: 2, flexShrink: 1 },
});
