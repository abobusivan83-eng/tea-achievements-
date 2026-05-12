import { useCallback, useMemo } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { AppScreen, AppCard, Button, ErrorState, ScreenHeader } from "../components";
import { fetchPublicProfile } from "../api/profile";
import { publicProfileKey } from "../lib/queryKeys";
import { useTabBarInset } from "../hooks/useTabBarInset";
import { theme } from "../theme";
import type { LeaderboardStackParamList, ProfileStackParamList } from "../navigation/types";

type Params = LeaderboardStackParamList["PublicProfile"] | ProfileStackParamList["PublicProfile"];

type Nav = NativeStackNavigationProp<LeaderboardStackParamList | ProfileStackParamList>;

export function PublicProfileScreen() {
  const bottom = useTabBarInset();
  const route = useRoute<RouteProp<{ PublicProfile: Params }, "PublicProfile">>();
  const navigation = useNavigation<Nav>();
  const { userId } = route.params;

  const q = useQuery({
    queryKey: publicProfileKey(userId),
    queryFn: () => fetchPublicProfile(userId),
    enabled: Boolean(userId),
    staleTime: 40_000,
  });

  const onRefresh = useCallback(() => void q.refetch(), [q]);

  const u = q.data?.user;
  const frameRing = useMemo(() => {
    if (!u) {
      return { borderColor: theme.colors.border, borderWidth: 2, shadowColor: "transparent" as const };
    }
    if (u.role === "CREATOR") {
      return { borderColor: "rgba(255,215,0,0.65)", borderWidth: 3, shadowColor: "#ffd700" as const };
    }
    if (u.frameKey) {
      return { borderColor: "rgba(102,192,244,0.55)", borderWidth: 3, shadowColor: "#66c0f4" as const };
    }
    return { borderColor: theme.colors.border, borderWidth: 2, shadowColor: "transparent" as const };
  }, [u]);

  if (q.isLoading && !q.data) {
    return (
      <AppScreen scroll bottomInset={bottom}>
        <ScreenHeader
          title="Профиль"
          left={
            navigation.canGoBack() ? (
              <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backHit}>
                <Text style={styles.backTxt}>‹</Text>
              </Pressable>
            ) : null
          }
        />
        <ActivityIndicator color={theme.colors.accent} style={{ marginTop: theme.space.xl }} />
      </AppScreen>
    );
  }

  if (q.isError || !q.data || !u) {
    return (
      <AppScreen scroll bottomInset={bottom}>
        <ScreenHeader
          title="Профиль"
          left={
            navigation.canGoBack() ? (
              <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backHit}>
                <Text style={styles.backTxt}>‹</Text>
              </Pressable>
            ) : null
          }
        />
        <ErrorState
          title="Не удалось загрузить"
          message={q.error instanceof Error ? q.error.message : "Ошибка сети"}
          onRetry={onRefresh}
        />
      </AppScreen>
    );
  }

  const earnedAll = q.data.achievements.earned;
  const ratingSum = earnedAll.reduce((s, a) => s + a.points, 0);
  const earnedPreview = earnedAll.slice(0, 6);

  return (
    <AppScreen
      scroll
      bottomInset={bottom}
      scrollProps={{
        refreshControl: (
          <RefreshControl
            refreshing={q.isFetching && q.data !== undefined}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        ),
      }}
    >
      <ScreenHeader
        title={u.nickname}
        subtitle="Участник клана"
        left={
          navigation.canGoBack() ? (
            <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backHit}>
              <Text style={styles.backTxt}>‹</Text>
            </Pressable>
          ) : null
        }
      />

      <View style={styles.bannerCard}>
        {u.bannerUrl ? (
          <Image source={{ uri: u.bannerUrl }} style={styles.bannerImg} contentFit="cover" cachePolicy="memory-disk" transition={220} />
        ) : (
          <LinearGradient colors={["rgba(27,40,56,0.95)", "rgba(7,10,16,0.98)"]} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient
          colors={["transparent", "rgba(7,10,16,0.55)", "rgba(7,10,16,0.92)"]}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["rgba(102,192,244,0.12)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.bannerContent}>
          <View
            style={[
              styles.avatarRing,
              {
                borderColor: frameRing.borderColor,
                borderWidth: frameRing.borderWidth,
                shadowColor: frameRing.shadowColor,
                shadowOpacity: frameRing.shadowColor === "transparent" ? 0 : 0.45,
                shadowRadius: 12,
                elevation: frameRing.shadowColor === "transparent" ? 0 : 6,
              },
            ]}
          >
            {u.avatarUrl ? (
              <Image source={{ uri: u.avatarUrl }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" transition={180} />
            ) : (
              <View style={[styles.avatar, styles.avatarPh]} />
            )}
            {u.level != null ? (
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeTxt}>{u.level}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.bannerText}>
            <Text style={styles.nick} numberOfLines={1}>
              {u.nickname}
              {u.statusEmoji ? ` ${u.statusEmoji}` : ""}
            </Text>
            {u.publicId != null ? <Text style={styles.subId}>#{u.publicId}</Text> : null}
            <View style={styles.statusRow}>
              {u.role === "CREATOR" ? (
                <View style={styles.creatorPill}>
                  <Text style={styles.creatorPillTxt}>CREATOR</Text>
                </View>
              ) : null}
              {u.role === "ADMIN" ? (
                <View style={styles.adminPill}>
                  <Text style={styles.adminPillTxt}>ADMIN</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      {u.badges && u.badges.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesRow}>
          {u.badges.slice(0, 16).map((b) => (
            <View key={b} style={styles.badgeChip}>
              <Text style={styles.badgeChipTxt} numberOfLines={1}>
                {b}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <AppCard style={styles.stats}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Уровень</Text>
          <Text style={styles.statVal}>{u.level ?? "—"}</Text>
        </View>
        <View style={styles.statSep} />
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Рейтинг</Text>
          <Text style={styles.statVal} numberOfLines={1}>
            {ratingSum || "—"}
          </Text>
        </View>
        <View style={styles.statSep} />
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Достижений</Text>
          <Text style={styles.statVal}>{earnedAll.length}</Text>
        </View>
      </AppCard>

      <Button
        variant="primary"
        onPress={() => navigation.navigate("PublicAchievements", { userId: u.id, nickname: u.nickname })}
        style={styles.achCta}
      >
        Посмотреть достижения
      </Button>

      <Text style={styles.section}>Достижения</Text>
      {earnedPreview.length === 0 ? (
        <Text style={styles.empty}>Пока нет открытых достижений.</Text>
      ) : (
        earnedPreview.map((a) => (
          <AppCard key={a.id} style={styles.achRow}>
            {a.iconUrl ? (
              <Image source={{ uri: a.iconUrl }} style={styles.achIcon} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <View style={[styles.achIcon, styles.avatarPh]} />
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.achTitle} numberOfLines={2}>
                {a.title}
              </Text>
              <Text style={styles.meta}>+{a.points} очк.</Text>
            </View>
          </AppCard>
        ))
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  backHit: { width: 36, height: 36, justifyContent: "center" },
  backTxt: { fontSize: 28, color: theme.colors.accent, fontWeight: "300", marginTop: -4 },
  bannerCard: {
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    marginBottom: theme.space.md,
    minHeight: 148,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(102,192,244,0.22)",
    ...theme.shadows.card,
  },
  bannerImg: { ...StyleSheet.absoluteFillObject },
  bannerContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: theme.space.md,
    padding: theme.space.md,
    paddingTop: 56,
  },
  avatarRing: {
    borderRadius: 56,
    padding: 3,
    backgroundColor: "rgba(0,0,0,0.35)",
    position: "relative",
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarPh: { backgroundColor: "rgba(255,255,255,0.06)" },
  levelBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 2,
    borderColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  levelBadgeTxt: { ...theme.typography.xs, color: theme.colors.accent, fontWeight: "900" },
  bannerText: { flex: 1, minWidth: 0, paddingBottom: 4 },
  nick: { ...theme.typography.hero, color: theme.colors.text },
  subId: { ...theme.typography.sm, color: theme.colors.textMuted, marginTop: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: theme.space.sm, flexWrap: "wrap" },
  creatorPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    backgroundColor: "rgba(255,215,0,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,215,0,0.4)",
  },
  creatorPillTxt: { ...theme.typography.xs, color: theme.colors.steamGold, fontWeight: "800" },
  adminPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    backgroundColor: "rgba(102,192,244,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(102,192,244,0.35)",
  },
  adminPillTxt: { ...theme.typography.xs, color: theme.colors.accent, fontWeight: "800" },
  badgesRow: { gap: 8, marginBottom: theme.space.sm, paddingRight: theme.space.md },
  badgeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: "rgba(102,192,244,0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    maxWidth: 140,
  },
  badgeChipTxt: { ...theme.typography.xs, color: theme.colors.text, fontWeight: "700" },
  stats: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: theme.space.md,
    paddingVertical: theme.space.sm,
  },
  statCell: { flex: 1, alignItems: "center", justifyContent: "center" },
  statSep: { width: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
  statLabel: { ...theme.typography.xs, color: theme.colors.textMuted, marginBottom: 4 },
  statVal: { ...theme.typography.bodyStrong, color: theme.colors.text, fontSize: 16 },
  achCta: { marginBottom: theme.space.md },
  section: {
    ...theme.typography.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.space.sm,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  empty: { ...theme.typography.sm, color: theme.colors.textMuted, marginBottom: theme.space.lg },
  achRow: { flexDirection: "row", gap: theme.space.sm, alignItems: "center", marginBottom: theme.space.sm },
  achIcon: { width: 44, height: 44, borderRadius: theme.radius.md },
  achTitle: { ...theme.typography.bodyStrong, color: theme.colors.text },
  meta: { ...theme.typography.sm, color: theme.colors.textMuted, marginTop: 2 },
});
