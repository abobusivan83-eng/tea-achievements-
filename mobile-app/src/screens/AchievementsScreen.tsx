import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  ListRenderItem,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import {
  AchievementDetailSheet,
  AppScreen,
  EmptyState,
  ErrorState,
  ListSkeleton,
  ScreenHeader,
  AppCard,
} from "../components";
import { fetchAchievementsCatalog } from "../api/achievements";
import { achievementsListKey } from "../lib/queryKeys";
import { useTabBarInset } from "../hooks/useTabBarInset";
import { theme } from "../theme";
import { rarityAccent } from "../lib/rarityTheme";
import type { AchievementCatalogItem } from "../types/achievement";

export function AchievementsScreen() {
  const bottom = useTabBarInset();
  const { width } = useWindowDimensions();
  const navigation = useNavigation();
  const [qtext, setQtext] = useState("");
  const [listTab, setListTab] = useState<"open" | "closed">("open");
  const [selected, setSelected] = useState<AchievementCatalogItem | null>(null);

  const listQ = useQuery({
    queryKey: achievementsListKey,
    queryFn: fetchAchievementsCatalog,
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const list = listQ.data ?? [];
    const byTab = listTab === "open" ? list.filter((a) => a.earned) : list.filter((a) => !a.earned);
    const s = qtext.trim().toLowerCase();
    if (!s) return byTab;
    return byTab.filter((a) => a.title.toLowerCase().includes(s) || a.description.toLowerCase().includes(s));
  }, [listQ.data, qtext, listTab]);

  const gap = theme.space.sm;
  const pad = theme.space.md * 2;
  const colW = (width - pad - gap) / 2;

  const renderItem: ListRenderItem<AchievementCatalogItem> = useCallback(
    ({ item, index }) => {
      const accent = rarityAccent(item.rarity);
      const glow =
        item.rarity === "LEGENDARY"
          ? "gold"
          : item.rarity === "EPIC"
            ? "purple"
            : item.rarity === "RARE"
              ? "accent"
              : "none";
      return (
        <Animated.View
          style={{ width: colW, marginBottom: gap }}
          entering={FadeInDown.delay(Math.min(index, 14) * 35).duration(380)}
        >
          <AppCard glow={glow} style={[styles.cell, { borderColor: accent.border }]}>
            <Pressable
              onPress={() => setSelected(item)}
              accessibilityRole="button"
              style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }] }]}
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
                {item.earned ? (
                  <View style={styles.check}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                ) : null}
              </View>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {item.rarity} · {item.points} очк.
              </Text>
              {item.scheduleLocked ? <Text style={styles.lock}>Скоро</Text> : null}
              {item.eventEnded ? <Text style={styles.lock}>Ивент завершён</Text> : null}
            </Pressable>
            <Pressable style={({ pressed }) => [styles.viewBtn, pressed && styles.viewBtnPressed]} onPress={() => setSelected(item)}>
              <Text style={styles.viewBtnTxt}>Посмотреть достижение</Text>
              <Ionicons name="chevron-forward" size={14} color={theme.colors.accent} />
            </Pressable>
          </AppCard>
        </Animated.View>
      );
    },
    [colW, gap],
  );

  const earned = useMemo(() => listQ.data?.filter((a) => a.earned).length ?? 0, [listQ.data]);
  const locked = useMemo(() => listQ.data?.filter((a) => !a.earned).length ?? 0, [listQ.data]);
  const total = listQ.data?.length ?? 0;

  const headerLeft = navigation.canGoBack() ? (
    <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backHit}>
      <Text style={styles.backTxt}>‹</Text>
    </Pressable>
  ) : null;

  if (listQ.isLoading && listQ.data === undefined) {
    return (
      <AppScreen scroll bottomInset={bottom}>
        <ScreenHeader title="Достижения" left={headerLeft} subtitle={total ? `Открыто ${earned} / ${total}` : undefined} />
        <ListSkeleton count={6} />
      </AppScreen>
    );
  }

  if (listQ.isError) {
    return (
      <AppScreen scroll bottomInset={bottom}>
        <ScreenHeader title="Достижения" left={headerLeft} />
        <ErrorState
          title="Не удалось загрузить"
          message={listQ.error instanceof Error ? listQ.error.message : "Ошибка сети."}
          onRetry={() => void listQ.refetch()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false} bottomInset={bottom}>
      <ScreenHeader title="Достижения" left={headerLeft} subtitle={total ? `Открыто ${earned} / ${total}` : undefined} />
      <View style={styles.tabs}>
        <Pressable
          onPress={() => setListTab("open")}
          style={[styles.tab, listTab === "open" && styles.tabOn]}
          accessibilityState={{ selected: listTab === "open" }}
        >
          <Text style={[styles.tabTxt, listTab === "open" && styles.tabTxtOn]}>Открытые</Text>
          <Text style={[styles.tabCnt, listTab === "open" && styles.tabCntOn]}>{earned}</Text>
        </Pressable>
        <Pressable
          onPress={() => setListTab("closed")}
          style={[styles.tab, listTab === "closed" && styles.tabOn]}
          accessibilityState={{ selected: listTab === "closed" }}
        >
          <Text style={[styles.tabTxt, listTab === "closed" && styles.tabTxtOn]}>Закрытые</Text>
          <Text style={[styles.tabCnt, listTab === "closed" && styles.tabCntOn]}>{locked}</Text>
        </Pressable>
      </View>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={theme.colors.textMuted} style={styles.searchIcon} />
        <TextInput
          value={qtext}
          onChangeText={setQtext}
          placeholder="Поиск по названию…"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.search}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap }}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={listQ.isFetching && !listQ.isLoading}
            onRefresh={() => void listQ.refetch()}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            title={qtext.trim() ? "Ничего не найдено" : listTab === "open" ? "Нет открытых" : "Нет закрытых"}
            subtitle={
              qtext.trim()
                ? "Измените запрос или сбросьте поиск."
                : listTab === "open"
                  ? "Выполняйте задания, чтобы открыть достижения."
                  : "Все достижения из каталога уже открыты."
            }
            icon="search-outline"
            style={{ marginTop: theme.space.lg }}
          />
        }
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={10}
        windowSize={9}
      />
      {selected ? (
        <AchievementDetailSheet
          visible
          onClose={() => setSelected(null)}
          title={selected.title}
          description={selected.description}
          rarity={selected.rarity}
          points={selected.points}
          iconUrl={selected.iconUrl}
          earned={selected.earned}
          awardedAt={selected.awardedAt}
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
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.space.sm,
    marginBottom: theme.space.sm,
  },
  searchIcon: { marginRight: 6 },
  search: {
    flex: 1,
    ...theme.typography.sm,
    color: theme.colors.text,
    paddingVertical: theme.space.sm,
  },
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
  title: { ...theme.typography.sm, color: theme.colors.text, fontWeight: "700", minHeight: 36 },
  meta: { ...theme.typography.xs, color: theme.colors.textMuted, marginTop: 4 },
  lock: { ...theme.typography.xs, color: theme.colors.steamGold, marginTop: 4, fontWeight: "700" },
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
  viewBtnPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  viewBtnTxt: { ...theme.typography.xs, color: theme.colors.accent, fontWeight: "800" },
});
