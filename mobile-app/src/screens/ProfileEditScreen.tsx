import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppScreen, Button, ScreenHeader } from "../components";
import { ShopFramePreview } from "../components/shop/ShopFramePreview";
import { fetchShopItems, fetchShopMe } from "../api/shop";
import { fetchPublicProfile, patchMyProfile, uploadMyAvatar, uploadMyBanner } from "../api/profile";
import { profileMeKey, publicProfileKey, shopItemsKey, shopMeKey } from "../lib/queryKeys";
import { useAuthStore } from "../store/authStore";
import { useToast } from "../providers/ToastProvider";
import { useTabBarInset } from "../hooks/useTabBarInset";
import { theme } from "../theme";
import { shopItemVisual } from "../lib/shopMedia";
import { frames as frameCatalog, creatorFrames, statusEmojiCatalog, badgeCatalog } from "../lib/cosmetics";
import { canUseFrameKey } from "../lib/cosmeticsAccess";
import type { ShopItem } from "../types/shop";

const MAX_BADGES = 24;

type PendingImage = { uri: string; name: string; type: string };

async function pickFromLibrary(aspect: [number, number]): Promise<PendingImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Доступ к фото", "Разрешите доступ к галерее в настройках.");
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect,
    quality: 0.88,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const name = a.fileName ?? (aspect[0] === 1 ? "avatar.jpg" : "banner.jpg");
  const type = a.mimeType ?? "image/jpeg";
  return { uri: a.uri, name, type };
}

export function ProfileEditScreen() {
  const bottom = useTabBarInset();
  const navigation = useNavigation();
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const userRole = useAuthStore((s) => s.user?.role ?? "USER");
  const { showToast } = useToast();

  const [nickname, setNickname] = useState("");
  const [frameKey, setFrameKey] = useState<string | null>(null);
  const [badges, setBadges] = useState<string[]>([]);
  const [statusEmoji, setStatusEmoji] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<PendingImage | null>(null);
  const [pendingBanner, setPendingBanner] = useState<PendingImage | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);

  const profileQ = useQuery({
    queryKey: publicProfileKey(userId ?? ""),
    queryFn: () => fetchPublicProfile(userId!),
    enabled: Boolean(userId),
    staleTime: 20_000,
  });

  const shopMeQ = useQuery({
    queryKey: shopMeKey(userId),
    queryFn: fetchShopMe,
    enabled: Boolean(userId),
    staleTime: 20_000,
  });

  const itemsQ = useQuery({
    queryKey: shopItemsKey,
    queryFn: fetchShopItems,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!profileQ.data || initialized) return;
    const u = profileQ.data.user;
    setNickname(u.nickname);
    setFrameKey(u.frameKey ?? null);
    setBadges([...(u.badges ?? [])].slice(0, MAX_BADGES));
    setStatusEmoji(u.statusEmoji ?? null);
    setInitialized(true);
  }, [profileQ.data, initialized]);

  const keyToName = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of itemsQ.data ?? []) {
      m.set(it.key, it.name);
    }
    return m;
  }, [itemsQ.data]);

  const itemByKey = useMemo(() => {
    const m = new Map<string, ShopItem>();
    for (const it of itemsQ.data ?? []) {
      m.set(it.key, it);
    }
    return m;
  }, [itemsQ.data]);

  const ownedBadgeKeys = useMemo(() => {
    const rows = shopMeQ.data?.purchasedItems?.filter((p) => p.type === "BADGE") ?? [];
    return [...new Set(rows.map((r) => r.key))];
  }, [shopMeQ.data?.purchasedItems]);

  const frames = shopMeQ.data?.unlockedFrames ?? [];
  const statuses = shopMeQ.data?.unlockedStatuses ?? [];

  const selectableFrameKeys = useMemo(() => {
    const unf = new Set(frames);
    const allKeys = [...frameCatalog, ...creatorFrames].map((f) => f.key);
    return allKeys.filter((k) => canUseFrameKey({ role: userRole, unlockedFrames: unf, frameKey: k }));
  }, [frames, userRole]);

  const statusEmojiForCatalogKey = useCallback((catalogKey: string) => {
    const row = statusEmojiCatalog.find((s) => s.key === catalogKey);
    return row?.emoji ?? "✨";
  }, []);

  const badgeEmojiOrVisual = useCallback(
    (key: string) => {
      const it = itemByKey.get(key);
      if (it) return shopItemVisual(it);
      const b = badgeCatalog.find((x) => x.key === key);
      return { emoji: b?.icon ?? "🏅" } as const;
    },
    [itemByKey],
  );

  const avatarPreview = pendingAvatar?.uri ?? profileQ.data?.user.avatarUrl ?? undefined;
  const bannerPreview = pendingBanner?.uri ?? profileQ.data?.user.bannerUrl ?? undefined;

  const toggleBadge = useCallback((key: string) => {
    setBadges((prev) => {
      const has = prev.includes(key);
      if (has) return prev.filter((k) => k !== key);
      if (prev.length >= MAX_BADGES) return prev;
      return [...prev, key];
    });
  }, []);

  const save = useCallback(async () => {
    const n = nickname.trim();
    if (n.length < 2 || n.length > 24) {
      Alert.alert("Никнейм", "От 2 до 24 символов.");
      return;
    }
    if (!userId) return;
    setSaving(true);
    try {
      if (pendingAvatar) {
        await uploadMyAvatar(pendingAvatar);
        setPendingAvatar(null);
      }
      if (pendingBanner) {
        await uploadMyBanner(pendingBanner);
        setPendingBanner(null);
      }
      await patchMyProfile({
        nickname: n,
        frameKey: frameKey ?? null,
        badges,
        statusEmoji: statusEmoji ?? null,
      });
      await qc.invalidateQueries({ queryKey: profileMeKey });
      await qc.invalidateQueries({ queryKey: publicProfileKey(userId) });
      await qc.invalidateQueries({ queryKey: shopMeKey(userId) });
      showToast({ message: "Профиль обновлён.", tone: "success" });
      navigation.goBack();
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }, [
    nickname,
    frameKey,
    badges,
    statusEmoji,
    pendingAvatar,
    pendingBanner,
    userId,
    qc,
    showToast,
    navigation,
  ]);

  const headerLeft = (
    <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backHit}>
      <Text style={styles.backTxt}>‹</Text>
    </Pressable>
  );

  if (!userId || (profileQ.isLoading && !profileQ.data)) {
    return (
      <AppScreen scroll bottomInset={bottom}>
        <ScreenHeader title="Профиль" left={headerLeft} subtitle="Загрузка…" />
      </AppScreen>
    );
  }

  if (profileQ.isError || !profileQ.data) {
    return (
      <AppScreen scroll bottomInset={bottom}>
        <ScreenHeader title="Редактирование" left={headerLeft} />
        <Text style={styles.err}>
          {profileQ.error instanceof Error ? profileQ.error.message : "Не удалось загрузить профиль"}
        </Text>
        <Button variant="ghost" onPress={() => void profileQ.refetch()}>
          Повторить
        </Button>
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll bottomInset={bottom}>
      <ScreenHeader title="Редактировать профиль" left={headerLeft} />

      <Text style={styles.h}>Аватар</Text>
      <View style={styles.mediaRow}>
        {avatarPreview ? (
          <Image source={{ uri: avatarPreview }} style={styles.avatarPreview} contentFit="cover" transition={160} />
        ) : (
          <View style={[styles.avatarPreview, styles.ph]} />
        )}
        <View style={{ flex: 1, gap: theme.space.xs }}>
          <Button
            variant="ghost"
            onPress={async () => {
              const p = await pickFromLibrary([1, 1]);
              if (p) setPendingAvatar(p);
            }}
          >
            Выбрать фото
          </Button>
          {pendingAvatar ? (
            <Text style={styles.hint}>Новое фото будет загружено при сохранении</Text>
          ) : null}
        </View>
      </View>

      <Text style={styles.h}>Баннер</Text>
      <View style={styles.bannerBleed}>
        <Pressable
          onPress={async () => {
            const p = await pickFromLibrary([16, 9]);
            if (p) setPendingBanner(p);
          }}
          style={styles.bannerTouch}
        >
          {bannerPreview ? (
            <Image source={{ uri: bannerPreview }} style={styles.bannerPreview} contentFit="cover" transition={180} />
          ) : (
            <View style={[styles.bannerPreview, styles.ph, styles.bannerEmpty]}>
              <Text style={styles.bannerHintTxt}>Нажмите, чтобы выбрать баннер</Text>
            </View>
          )}
        </Pressable>
      </View>
      {pendingBanner ? <Text style={styles.hint}>Новый баннер загрузится при сохранении</Text> : null}

      <Text style={styles.h}>Никнейм</Text>
      <TextInput
        value={nickname}
        onChangeText={setNickname}
        placeholder="Никнейм"
        placeholderTextColor={theme.colors.textMuted}
        style={styles.input}
        autoCapitalize="none"
        maxLength={24}
      />

      <Text style={styles.h}>Рамка профиля</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable
          onPress={() => setFrameKey(null)}
          style={[styles.frameOpt, frameKey == null && styles.chipOn]}
        >
          <View style={styles.frameThumb}>
            <Text style={styles.frameThumbTxt}>—</Text>
          </View>
          <Text style={[styles.chipTxtMultiline, frameKey == null && styles.chipTxtOn]} allowFontScaling={false}>
            Без рамки
          </Text>
        </Pressable>
        {selectableFrameKeys.map((fk) => (
            <Pressable key={fk} onPress={() => setFrameKey(fk)} style={[styles.frameOpt, frameKey === fk && styles.chipOn]}>
              <View style={styles.frameThumb}>
                <ShopFramePreview frameKey={fk} size={44} />
              </View>
              <Text style={[styles.chipTxtMultiline, frameKey === fk && styles.chipTxtOn]} numberOfLines={2} allowFontScaling={false}>
                {keyToName.get(fk) ?? fk}
              </Text>
            </Pressable>
          ))}
      </ScrollView>

      <Text style={styles.h}>Эмодзи статуса</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable
          onPress={() => setStatusEmoji(null)}
          style={[styles.emojiChip, statusEmoji == null && styles.chipOn]}
        >
          <Text style={[styles.chipTxt, statusEmoji == null && styles.chipTxtOn]} allowFontScaling={false}>
            Нет
          </Text>
        </Pressable>
        {statuses.map((catalogKey) => {
          const emoji = statusEmojiForCatalogKey(catalogKey);
          return (
            <Pressable
              key={catalogKey}
              onPress={() => setStatusEmoji(emoji)}
              style={[styles.emojiChip, statusEmoji === emoji && styles.chipOn]}
            >
              <Text style={[styles.emojiLarge, statusEmoji === emoji && styles.emojiLargeOn]} allowFontScaling={false}>
                {emoji}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.h}>Значки ({badges.length}/{MAX_BADGES})</Text>
      {ownedBadgeKeys.length === 0 ? (
        <Text style={styles.hint}>Купите значки в магазине.</Text>
      ) : (
        <View style={styles.badgeGrid}>
          {ownedBadgeKeys.map((key) => {
            const on = badges.includes(key);
            const vis = badgeEmojiOrVisual(key);
            return (
              <Pressable
                key={key}
                onPress={() => toggleBadge(key)}
                style={[styles.badgeRow, on && styles.badgeChipOn]}
              >
                <View style={styles.badgeIconBox}>
                  {"uri" in vis ? (
                    <Image source={{ uri: vis.uri }} style={styles.badgeIconImg} contentFit="cover" />
                  ) : (
                    <Text style={styles.badgeEmoji} allowFontScaling={false}>
                      {vis.emoji}
                    </Text>
                  )}
                </View>
                <Text style={[styles.badgeTxt, on && styles.badgeTxtOn]} numberOfLines={2} allowFontScaling={false}>
                  {keyToName.get(key) ?? key}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Button variant="primary" loading={saving} onPress={() => void save()}>
        Сохранить
      </Button>
      <Button variant="ghost" disabled={saving} onPress={() => navigation.goBack()}>
        Отмена
      </Button>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  backHit: { width: 36, height: 36, justifyContent: "center" },
  backTxt: { fontSize: 28, color: theme.colors.accent, fontWeight: "300", marginTop: -4 },
  err: { ...theme.typography.sm, color: theme.colors.danger, marginBottom: theme.space.sm },
  h: {
    ...theme.typography.xs,
    color: theme.colors.textMuted,
    marginTop: theme.space.md,
    marginBottom: theme.space.xs,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "700",
  },
  mediaRow: { flexDirection: "row", gap: theme.space.md, alignItems: "center" },
  avatarPreview: { width: 88, height: 88, borderRadius: 44, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border },
  bannerBleed: {
    marginHorizontal: -theme.space.md,
    marginBottom: theme.space.xs,
  },
  bannerTouch: {
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  bannerPreview: { width: "100%", height: 132 },
  ph: { backgroundColor: "rgba(255,255,255,0.06)" },
  bannerEmpty: { alignItems: "center", justifyContent: "center" },
  bannerHintTxt: { ...theme.typography.sm, color: theme.colors.textMuted, fontWeight: "700" },
  hint: { ...theme.typography.xs, color: theme.colors.textMuted, marginBottom: theme.space.sm },
  input: {
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    ...theme.typography.body,
    color: theme.colors.text,
  },
  chips: { flexDirection: "row", flexWrap: "nowrap", gap: theme.space.xs, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceElevated,
    maxWidth: 200,
  },
  chipOn: {
    borderColor: theme.colors.accent,
    backgroundColor: "rgba(88,166,255,0.14)",
  },
  chipTxt: { fontSize: 13, lineHeight: 18, color: "#c9d1d9", fontWeight: "700" },
  chipTxtOn: { color: "#f0f6fc" },
  chipTxtMultiline: {
    fontSize: 10,
    lineHeight: 13,
    color: "#c9d1d9",
    fontWeight: "700",
    textAlign: "center",
    maxWidth: 76,
  },
  frameOpt: {
    width: 92,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: "center",
    gap: 6,
  },
  frameThumb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  frameThumbImg: { width: "100%", height: "100%" },
  frameThumbTxt: { color: theme.colors.textMuted, fontWeight: "800" },
  frameEmoji: { fontSize: 22 },
  emojiChip: {
    minWidth: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiLarge: { fontSize: 26, lineHeight: 30 },
  emojiLargeOn: { transform: [{ scale: 1.05 }] },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: "47%",
    maxWidth: "48%",
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceElevated,
  },
  badgeChipOn: {
    borderColor: theme.colors.accent,
    backgroundColor: "rgba(88,166,255,0.1)",
  },
  badgeIconBox: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeIconImg: { width: "100%", height: "100%" },
  badgeEmoji: { fontSize: 22 },
  badgeTxt: { flex: 1, fontSize: 12, lineHeight: 16, color: "#c9d1d9", fontWeight: "700" },
  badgeTxtOn: { color: "#f0f6fc" },
});
