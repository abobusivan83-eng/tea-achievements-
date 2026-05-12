import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  ListRenderItem,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppScreen, Button, EmptyState, ErrorState, ListSkeleton, ScreenHeader, AppCard } from "../components";
import { theme } from "../theme";
import { useTabBarInset } from "../hooks/useTabBarInset";
import { fetchShopItems, fetchShopMe, buyShopItem } from "../api/shop";
import { shopItemsKey, shopMeKey } from "../lib/queryKeys";
import { useAuthStore } from "../store/authStore";
import { useToast } from "../providers/ToastProvider";
import { rarityAccent } from "../lib/rarityTheme";
import { ShopFramePreview } from "../components/shop/ShopFramePreview";
import { shopItemVisual } from "../lib/shopMedia";
import type { ShopItem, ShopItemType } from "../types/shop";
import type { Rarity } from "../types/tasks";
import type { ShopStackParamList } from "../navigation/types";

const RARITIES: Rarity[] = ["COMMON", "RARE", "EPIC", "LEGENDARY", "EXCLUSIVE", "SECRET"];

function normalizeShopItems(list: ShopItem[] | undefined): ShopItem[] {
  if (!list?.length) return [];
  return list
    .filter((i) => i && typeof i.id === "string" && i.id.length > 0)
    .map((i) => {
      const t = String(i.type ?? "").toUpperCase();
      const type: ShopItemType = t === "FRAME" ? "FRAME" : "BADGE";
      const r = String(i.rarity ?? "").toUpperCase();
      const rarity = (RARITIES.includes(r as Rarity) ? r : "COMMON") as Rarity;
      return {
        ...i,
        name: i.name?.trim() ? i.name : "Товар",
        type,
        rarity,
        price: typeof i.price === "number" && !Number.isNaN(i.price) ? i.price : 0,
        key: typeof i.key === "string" ? i.key : i.id,
        description: i.description ?? null,
        icon: i.icon ?? null,
      };
    });
}


type Cat = "ALL" | ShopItemType;

const CATS: { id: Cat; label: string }[] = [
  { id: "ALL", label: "Все" },
  { id: "FRAME", label: "Рамки" },
  { id: "BADGE", label: "Значки" },
];

export function ShopScreen() {
  const bottom = useTabBarInset();
  const navigation = useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const { showToast } = useToast();
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [cat, setCat] = useState<Cat>("ALL");
  const [sheetItem, setSheetItem] = useState<ShopItem | null>(null);

  const itemsQ = useQuery({ queryKey: shopItemsKey, queryFn: fetchShopItems, staleTime: 60_000 });
  const meQ = useQuery({
    queryKey: shopMeKey(userId),
    queryFn: fetchShopMe,
    enabled: Boolean(userId),
    staleTime: 40_000,
  });

  const owned = useMemo(() => new Set(meQ.data?.purchasedItemIds ?? []), [meQ.data?.purchasedItemIds]);

  const itemsNormalized = useMemo(() => normalizeShopItems(itemsQ.data), [itemsQ.data]);

  const filtered = useMemo(() => {
    const all = itemsNormalized;
    if (cat === "ALL") return all;
    return all.filter((i) => i.type === cat);
  }, [itemsNormalized, cat]);

  const buy = useCallback(
    async (item: ShopItem) => {
      if (owned.has(item.id)) return;
      setBuyingId(item.id);
      try {
        await buyShopItem(item.id);
        await qc.invalidateQueries({ queryKey: shopMeKey(userId) });
        showToast({ message: "Покупка оформлена.", tone: "success" });
        setSheetItem(null);
      } catch (e) {
        Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось купить");
      } finally {
        setBuyingId(null);
      }
    },
    [qc, owned, showToast, userId],
  );

  const openItem = useCallback((item: ShopItem) => {
    setSheetItem(item);
  }, []);

  const renderItem: ListRenderItem<ShopItem> = useCallback(
    ({ item }) => {
      const accent = rarityAccent(item.rarity);
      const isOwned = owned.has(item.id);
      const iconSrc = shopItemVisual(item);
      return (
        <Pressable onPress={() => openItem(item)} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
          <AppCard style={[styles.card, { borderColor: accent.border }]}>
            <View style={styles.row}>
              {item.type === "FRAME" ? (
                <ShopFramePreview frameKey={item.key} size={56} />
              ) : "uri" in iconSrc ? (
                <Image
                  source={{ uri: iconSrc.uri }}
                  style={styles.icon}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={160}
                />
              ) : (
                <View style={[styles.icon, styles.iconPh]}>
                  <Text style={styles.emoji} allowFontScaling={false}>
                    {iconSrc.emoji}
                  </Text>
                </View>
              )}
              <View style={styles.body}>
                <Text style={styles.title} numberOfLines={2} allowFontScaling={false}>
                  {item.name}
                </Text>
                <View style={styles.tags}>
                  <Text style={styles.tag} allowFontScaling={false}>
                    {item.type === "FRAME" ? "Рамка" : item.type === "BADGE" ? "Значок" : item.type}
                  </Text>
                  <Text style={[styles.tag, { color: accent.label }]} allowFontScaling={false}>
                    {item.rarity}
                  </Text>
                </View>
                <Text style={styles.price} allowFontScaling={false}>
                  {item.price} мон.
                </Text>
              </View>
              <View style={styles.ctaCol}>
                <Text style={[styles.ctaTxt, isOwned && styles.ctaOwned]} allowFontScaling={false}>
                  {isOwned ? "Есть" : "Купить"}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </View>
            </View>
          </AppCard>
        </Pressable>
      );
    },
    [openItem, owned],
  );

  const listLoading =
    itemsQ.data === undefined && itemsQ.isLoading ? true : Boolean(userId) && meQ.data === undefined && meQ.isLoading;

  const headerRight = (
    <View style={styles.headerActions}>
      <Pressable hitSlop={10} style={styles.iconBtn} onPress={() => navigation.navigate("Gifts")}>
        <Ionicons name="gift-outline" size={22} color={theme.colors.text} />
      </Pressable>
    </View>
  );

  if (listLoading) {
    return (
      <AppScreen scroll bottomInset={bottom}>
        <ScreenHeader title="Магазин" right={headerRight} />
        <ListSkeleton count={6} />
      </AppScreen>
    );
  }

  if (itemsQ.isError) {
    const msg = itemsQ.error instanceof Error ? itemsQ.error.message : "Ошибка сети.";
    return (
      <AppScreen scroll bottomInset={bottom}>
        <ScreenHeader title="Магазин" right={headerRight} />
        <ErrorState title="Магазин недоступен" message={msg} onRetry={() => void itemsQ.refetch()} />
      </AppScreen>
    );
  }

  const sheetOwned = sheetItem ? owned.has(sheetItem.id) : false;

  return (
    <AppScreen scroll={false} bottomInset={bottom} contentStyle={styles.screenFill}>
      <ScreenHeader title="Магазин" subtitle={`Баланс ${meQ.data?.coins ?? 0} мон.`} right={headerRight} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={styles.chipsScroll}
        nestedScrollEnabled
      >
        {CATS.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setCat(c.id)}
            style={[styles.chip, cat === c.id && styles.chipOn]}
          >
            <Text style={[styles.chipTxt, cat === c.id && styles.chipTxtOn]} allowFontScaling={false}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.listWrap}>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          style={styles.listFlex}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={(itemsQ.isFetching || meQ.isFetching) && !listLoading}
              onRefresh={() => {
                void itemsQ.refetch();
                void meQ.refetch();
              }}
              tintColor={theme.colors.accent}
              colors={[theme.colors.accent]}
            />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              title={itemsNormalized.length === 0 ? "Каталог пуст" : "Нет товаров"}
              subtitle={
                itemsNormalized.length === 0
                  ? "Товары появятся позже или проверьте подключение."
                  : "В этой категории пока пусто."
              }
              icon="cart-outline"
              style={{ marginTop: theme.space.lg }}
            />
          }
        />
      </View>

      <Modal visible={sheetItem != null} transparent animationType="slide" onRequestClose={() => setSheetItem(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSheetItem(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {sheetItem ? (
              <>
                <View style={styles.sheetGrab} />
                <Text style={styles.sheetTitle}>{sheetItem.name}</Text>
                <Text style={styles.sheetPrice}>{sheetItem.price} монет</Text>
                {sheetItem.description ? (
                  <Text style={styles.sheetDesc} numberOfLines={4}>
                    {sheetItem.description}
                  </Text>
                ) : null}
                <Button
                  variant={sheetOwned ? "ghost" : "primary"}
                  loading={buyingId === sheetItem.id}
                  disabled={sheetOwned || buyingId != null}
                  onPress={() => void buy(sheetItem)}
                >
                  {sheetOwned ? "Уже куплено" : "Оформить покупку"}
                </Button>
                <Button variant="ghost" onPress={() => setSheetItem(null)}>
                  Закрыть
                </Button>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenFill: { flex: 1 },
  listWrap: { flex: 1, minHeight: 0 },
  listFlex: { flex: 1 },
  headerActions: { flexDirection: "row", gap: theme.space.xs },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  chipsScroll: { flexGrow: 0, zIndex: 2 },
  chipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.xs,
    paddingVertical: theme.space.xs,
    marginBottom: theme.space.sm,
    paddingRight: theme.space.md,
    flexWrap: "nowrap",
    minHeight: 44,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceElevated,
    minHeight: 40,
    justifyContent: "center",
  },
  chipOn: {
    borderColor: theme.colors.accent,
    backgroundColor: "rgba(88,166,255,0.14)",
  },
  chipTxt: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: "#c9d1d9",
  },
  chipTxtOn: { color: "#f0f6fc" },
  list: { paddingBottom: theme.space.xl },
  card: { marginBottom: theme.space.sm },
  row: { flexDirection: "row", gap: theme.space.sm, alignItems: "center" },
  icon: { width: 56, height: 56, borderRadius: theme.radius.md },
  iconPh: { backgroundColor: "rgba(0,0,0,0.2)", alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 26 },
  body: { flex: 1, minWidth: 0 },
  title: { ...theme.typography.bodyStrong, color: theme.colors.text, fontSize: 15 },
  tags: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  tag: { ...theme.typography.xs, color: theme.colors.textMuted, fontWeight: "700" },
  price: { ...theme.typography.sm, color: theme.colors.steamGold, fontWeight: "800", marginTop: 6 },
  ctaCol: { alignItems: "flex-end", gap: 4 },
  ctaTxt: { ...theme.typography.xs, color: theme.colors.accent, fontWeight: "800" },
  ctaOwned: { color: theme.colors.textMuted },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(1,4,9,0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: theme.colors.surfaceElevated,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.space.lg,
    paddingBottom: theme.space.xxl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    gap: theme.space.sm,
  },
  sheetGrab: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom: theme.space.xs,
  },
  sheetTitle: { ...theme.typography.title, color: theme.colors.text },
  sheetPrice: { ...theme.typography.bodyStrong, color: theme.colors.steamGold },
  sheetDesc: { ...theme.typography.sm, color: theme.colors.textMuted },
});
