import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { AppScreen, AppCard, AchievementDetailSheet, Button, CardSkeleton, ErrorState, ScreenHeader } from "../components";
import { useAuthStore } from "../store/authStore";
import { fetchMe } from "../api/auth";
import { fetchPublicProfile } from "../api/profile";
import { fetchAchievementsCatalog } from "../api/achievements";
import { fetchShopMe } from "../api/shop";
import { profileMeKey, achievementsListKey, shopMeKey, publicProfileKey } from "../lib/queryKeys";
import { theme } from "../theme";
import { useTabBarInset } from "../hooks/useTabBarInset";
import type { ProfileStackParamList } from "../navigation/types";
import { rarityAccent } from "../lib/rarityTheme";
import type { AchievementCatalogItem } from "../types/achievement";
import type { Rarity } from "../types/tasks";

export function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const bottom = useTabBarInset();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const [achDetail, setAchDetail] = useState<AchievementCatalogItem | null>(null);

  const meQ = useQuery({
    queryKey: profileMeKey,
    queryFn: fetchMe,
    enabled: Boolean(user?.id),
    staleTime: 45_000,
  });

  const profileQ = useQuery({
    queryKey: publicProfileKey(user?.id ?? ""),
    queryFn: () => fetchPublicProfile(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  });

  const achQ = useQuery({
    queryKey: achievementsListKey,
    queryFn: fetchAchievementsCatalog,
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const shopQ = useQuery({
    queryKey: shopMeKey(user?.id),
    queryFn: fetchShopMe,
    enabled: Boolean(user?.id),
    staleTime: 40_000,
  });

  const me = meQ.data as Record<string, unknown> | undefined;
  const pu = profileQ.data?.user;

  const recentEarned = useMemo(() => {
    const list = achQ.data?.filter((a) => a.earned) ?? [];
    return [...list]
      .sort((a, b) => {
        const ta = a.awardedAt ? new Date(a.awardedAt).getTime() : 0;
        const tb = b.awardedAt ? new Date(b.awardedAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 6);
  }, [achQ.data]);

  const earnedCount = useMemo(() => achQ.data?.filter((a) => a.earned).length ?? 0, [achQ.data]);
  const totalAch = achQ.data?.length ?? 0;

  const onRefresh = useCallback(() => {
    void meQ.refetch();
    void profileQ.refetch();
    void achQ.refetch();
    void shopQ.refetch();
  }, [meQ, profileQ, achQ, shopQ]);

  const level = me?.level != null ? Number(me.level) : pu?.level != null ? pu.level : undefined;
  const xpInto = me?.xpIntoLevel != null ? Number(me.xpIntoLevel) : undefined;
  const xpNext = me?.xpForNext != null ? Number(me.xpForNext) : undefined;
  const xpPct = xpInto != null && xpNext != null && xpNext > 0 ? Math.min(1, xpInto / xpNext) : 0;
  const role = (user?.role ?? me?.role ?? pu?.role) as string | undefined;
  const showAdmin = role === "ADMIN" || role === "CREATOR";
  const nickname = user?.nickname ?? pu?.nickname ?? String(me?.nickname ?? "");
  const avatarUri = (pu?.avatarUrl ?? me?.avatarUrl) as string | null | undefined;
  const bannerUri = pu?.bannerUrl;
  const frameKey = pu?.frameKey;
  const statusEmoji = pu?.statusEmoji;

  const frameRing = useMemo(() => {
    if (role === "CREATOR") {
      return { borderColor: "rgba(255,215,0,0.65)", borderWidth: 3, shadowColor: "#ffd700" as const };
    }
    if (frameKey) {
      return { borderColor: "rgba(102,192,244,0.55)", borderWidth: 3, shadowColor: "#66c0f4" as const };
    }
    return { borderColor: theme.colors.border, borderWidth: 2, shadowColor: "transparent" as const };
  }, [role, frameKey]);

  if (meQ.isLoading && meQ.data === undefined && user?.id) {
    return (
      <AppScreen scroll bottomInset={bottom}>
        <ScreenHeader title="Профиль" />
        <View style={styles.heroSkel}>
          <CardSkeleton />
        </View>
        <CardSkeleton />
      </AppScreen>
    );
  }

  if (meQ.isError && !meQ.data) {
    return (
      <AppScreen scroll bottomInset={bottom}>
        <ScreenHeader title="Профиль" />
        <ErrorState title="Не удалось обновить профиль" message={meQ.error instanceof Error ? meQ.error.message : "Ошибка сети"} onRetry={onRefresh} />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      scroll
      bottomInset={bottom}
      scrollProps={{
        refreshControl: (
          <RefreshControl
            refreshing={Boolean(user?.id) && (meQ.isFetching || profileQ.isFetching || achQ.isFetching) && meQ.data !== undefined}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        ),
      }}
    >
      <ScreenHeader title="Профиль" subtitle={shopQ.data != null ? `${shopQ.data.coins} монет` : undefined} />

      <Pressable
        style={({ pressed }) => [styles.editProfileBtn, pressed && styles.actionBtnPressed]}
        onPress={() => navigation.navigate("ProfileEdit")}
      >
        <Text style={styles.editProfileTxt}>Редактировать профиль</Text>
      </Pressable>

      <View style={styles.bannerCard}>
        {bannerUri ? (
          <Image source={{ uri: bannerUri }} style={styles.bannerImg} contentFit="cover" cachePolicy="memory-disk" transition={220} />
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
            {avatarUri ? (
              <Image source={{ uri: String(avatarUri) }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" transition={180} />
            ) : (
              <View style={[styles.avatar, styles.avatarPh]} />
            )}
            {level != null ? (
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeTxt}>{level}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.bannerText}>
            <Text style={styles.nick} numberOfLines={1}>
              {nickname}
              {statusEmoji ? ` ${statusEmoji}` : ""}
            </Text>
            {user?.publicId != null ? <Text style={styles.subId}>#{user.publicId}</Text> : null}
            <View style={styles.statusRow}>
              <View style={styles.dot} />
              <Text style={styles.statusTxt}>В сети</Text>
              {role === "CREATOR" ? (
                <View style={styles.creatorPill}>
                  <Text style={styles.creatorPillTxt}>CREATOR</Text>
                </View>
              ) : role === "ADMIN" ? (
                <View style={styles.adminPill}>
                  <Text style={styles.adminPillTxt}>ADMIN</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      {pu?.badges && pu.badges.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesRow}>
          {pu.badges.slice(0, 12).map((b) => (
            <View key={b} style={styles.badgeChip}>
              <Text style={styles.badgeChipTxt} numberOfLines={1}>
                {b}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <AppCard style={styles.statsCard}>
        {xpInto != null && xpNext != null ? (
          <View style={styles.xpBlock}>
            <View style={styles.xpLabels}>
              <Text style={styles.xpLabel}>XP</Text>
              <Text style={styles.xpNums}>
                {xpInto} / {xpNext}
              </Text>
            </View>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${Math.round(xpPct * 100)}%` }]} />
            </View>
          </View>
        ) : me?.xp != null ? (
          <Text style={styles.xpFallback}>XP {String(me.xp)}</Text>
        ) : null}

        <View style={styles.achProgress}>
          <Text style={styles.achProgressTxt}>
            Достижения {earnedCount}
            {totalAch ? ` / ${totalAch}` : ""}
          </Text>
          {totalAch > 0 ? (
            <View style={styles.xpTrack}>
              <View style={[styles.xpFillPurple, { width: `${Math.round((earnedCount / totalAch) * 100)}%` }]} />
            </View>
          ) : null}
        </View>
      </AppCard>

      <View style={styles.actionsRow}>
        <Pressable style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]} onPress={() => navigation.navigate("AchievementsMain")}>
          <Text style={styles.actionBtnTxt}>Все достижения</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]} onPress={() => navigation.getParent()?.navigate("Shop" as never)}>
          <Text style={styles.actionBtnTxt}>Магазин</Text>
        </Pressable>
      </View>

      <View style={styles.quickGrid}>
        <Pressable style={styles.quickCell} onPress={() => navigation.navigate("AchievementsMain")}>
          <Text style={styles.quickIcon}>🏅</Text>
          <Text style={styles.quickTitle}>Каталог</Text>
          <Text style={styles.quickSub}>Награды</Text>
        </Pressable>
        <Pressable style={styles.quickCell} onPress={() => navigation.getParent()?.navigate("Shop", { screen: "Gifts" } as never)}>
          <Text style={styles.quickIcon}>🎁</Text>
          <Text style={styles.quickTitle}>Подарки</Text>
          <Text style={styles.quickSub}>Монеты</Text>
        </Pressable>
        <Pressable style={styles.quickCell} onPress={() => navigation.getParent()?.navigate("Leaderboard" as never)}>
          <Text style={styles.quickIcon}>📊</Text>
          <Text style={styles.quickTitle}>Рейтинг</Text>
          <Text style={styles.quickSub}>Топ клана</Text>
        </Pressable>
        {showAdmin ? (
          <Pressable style={styles.quickCell} onPress={() => navigation.navigate("AdminMain")}>
            <Text style={styles.quickIcon}>⚙️</Text>
            <Text style={styles.quickTitle}>Админка</Text>
            <Text style={styles.quickSub}>Панель</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.supportRow}>
        <Pressable style={({ pressed }) => [styles.supportBtn, pressed && styles.actionBtnPressed]} onPress={() => navigation.navigate("SupportIdea")}>
          <Text style={styles.supportBtnTxt}>💡 Идея</Text>
          <Text style={styles.supportBtnSub}>Предложение</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.supportBtn, pressed && styles.actionBtnPressed]} onPress={() => navigation.navigate("SupportReport")}>
          <Text style={styles.supportBtnTxt}>⚠️ Жалоба</Text>
          <Text style={styles.supportBtnSub}>На участника</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Недавние достижения</Text>
      {achQ.isLoading && !achQ.data ? (
        <CardSkeleton />
      ) : recentEarned.length === 0 ? (
        <AppCard>
          <Text style={styles.emptyHint}>Откройте достижения в каталоге — они появятся здесь.</Text>
        </AppCard>
      ) : (
        recentEarned.map((a) => {
          const acc = rarityAccent(a.rarity as Rarity);
          return (
            <AppCard key={a.id} style={[styles.miniAch, { borderColor: acc.border }]}>
              <Pressable
                onPress={() => setAchDetail(a)}
                style={({ pressed }) => [styles.miniAchInner, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
              >
                {a.iconUrl ? (
                  <Image source={{ uri: a.iconUrl }} style={styles.miniIcon} contentFit="cover" cachePolicy="memory-disk" />
                ) : (
                  <View style={[styles.miniIcon, styles.avatarPh]} />
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.miniTitle} numberOfLines={2}>
                    {a.title}
                  </Text>
                  <Text style={styles.miniMeta}>
                    +{a.points} XP · {a.rarity}
                  </Text>
                </View>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.viewAchBtn, pressed && styles.viewAchBtnPressed]} onPress={() => setAchDetail(a)}>
                <Text style={styles.viewAchBtnTxt}>Посмотреть достижение</Text>
              </Pressable>
            </AppCard>
          );
        })
      )}

      {achDetail ? (
        <AchievementDetailSheet
          visible
          onClose={() => setAchDetail(null)}
          title={achDetail.title}
          description={achDetail.description}
          rarity={achDetail.rarity}
          points={achDetail.points}
          iconUrl={achDetail.iconUrl}
          earned={achDetail.earned}
          awardedAt={achDetail.awardedAt}
        />
      ) : null}

      <Text style={styles.section}>Аккаунт</Text>
      <AppCard>
        <Button
          variant="danger"
          onPress={() => {
            void clearSession();
          }}
        >
          Выйти
        </Button>
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heroSkel: { marginBottom: theme.space.md },
  editProfileBtn: {
    marginBottom: theme.space.sm,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.md,
    backgroundColor: "rgba(136,71,255,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(136,71,255,0.35)",
    alignItems: "center",
  },
  editProfileTxt: { ...theme.typography.sm, color: theme.colors.steamPurple, fontWeight: "800" },
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
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.success },
  statusTxt: { ...theme.typography.sm, color: theme.colors.textMuted },
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
  statsCard: { marginBottom: theme.space.md },
  xpBlock: {},
  xpLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  xpLabel: { ...theme.typography.xs, color: theme.colors.textMuted, fontWeight: "700" },
  xpNums: { ...theme.typography.xs, color: theme.colors.text, fontWeight: "700" },
  xpTrack: {
    height: 6,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  xpFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
  },
  xpFillPurple: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: theme.colors.steamPurple,
  },
  xpFallback: { ...theme.typography.sm, color: theme.colors.textMuted, marginBottom: theme.space.sm },
  achProgress: { marginTop: theme.space.md },
  achProgressTxt: { ...theme.typography.xs, color: theme.colors.textMuted, marginBottom: 6, fontWeight: "600" },
  actionsRow: { flexDirection: "row", gap: theme.space.sm, marginBottom: theme.space.md },
  actionBtn: {
    flex: 1,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.md,
    backgroundColor: "rgba(102,192,244,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(102,192,244,0.35)",
    alignItems: "center",
  },
  actionBtnPressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  actionBtnTxt: { ...theme.typography.sm, color: theme.colors.text, fontWeight: "800" },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.sm,
    marginBottom: theme.space.lg,
  },
  quickCell: {
    flexBasis: "47%",
    flexGrow: 1,
    maxWidth: "48%",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: theme.space.sm,
  },
  quickIcon: { fontSize: 18, marginBottom: 4 },
  quickTitle: { ...theme.typography.sm, color: theme.colors.text, fontWeight: "700" },
  quickSub: { ...theme.typography.xs, color: theme.colors.textMuted, marginTop: 2, fontSize: 10 },
  supportRow: { flexDirection: "row", gap: theme.space.sm, marginBottom: theme.space.lg },
  supportBtn: {
    flex: 1,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.md,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  supportBtnTxt: { ...theme.typography.sm, color: theme.colors.text, fontWeight: "800" },
  supportBtnSub: { ...theme.typography.xs, color: theme.colors.textMuted, marginTop: 2, fontSize: 10 },
  section: {
    ...theme.typography.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.space.sm,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  emptyHint: { ...theme.typography.sm, color: theme.colors.textMuted },
  miniAch: { marginBottom: theme.space.sm },
  miniAchInner: { flexDirection: "row", gap: theme.space.sm, alignItems: "center" },
  miniIcon: { width: 44, height: 44, borderRadius: theme.radius.md },
  viewAchBtn: {
    marginTop: theme.space.sm,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: "rgba(102,192,244,0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(102,192,244,0.28)",
    alignItems: "center",
  },
  viewAchBtnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  viewAchBtnTxt: { ...theme.typography.xs, color: theme.colors.accent, fontWeight: "800" },
  miniTitle: { ...theme.typography.bodyStrong, color: theme.colors.text, fontSize: 14 },
  miniMeta: { ...theme.typography.xs, color: theme.colors.textMuted, marginTop: 2 },
});
