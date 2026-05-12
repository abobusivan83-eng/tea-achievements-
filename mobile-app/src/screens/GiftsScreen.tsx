import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppScreen, Button, ErrorState, ListSkeleton, ScreenHeader, AppCard } from "../components";
import { theme } from "../theme";
import { useTabBarInset } from "../hooks/useTabBarInset";
import { fetchGiftsInbox, fetchGiftsOutbox, markGiftsReadAll, sendGiftRequest } from "../api/gifts";
import { fetchShopMe } from "../api/shop";
import { fetchLeaderboard } from "../api/leaderboard";
import { giftsPackKey, leaderboardKey, shopMeKey } from "../lib/queryKeys";
import { useAuthStore } from "../store/authStore";
import type { GiftInboxItem, GiftOutboxItem } from "../types/gifts";
import type { LeaderboardRow } from "../types/leaderboard";
import { useToast } from "../providers/ToastProvider";

export function GiftsScreen() {
  const bottom = useTabBarInset();
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const me = useAuthStore((s) => s.user);
  const { showToast } = useToast();
  const markedRef = useRef(false);

  const packQ = useQuery({
    queryKey: giftsPackKey(userId),
    queryFn: async () => {
      const [inbox, outbox, shop] = await Promise.all([fetchGiftsInbox(), fetchGiftsOutbox(), fetchShopMe()]);
      return { inbox, outbox, coins: shop.coins };
    },
    enabled: Boolean(userId),
    staleTime: 25_000,
  });

  const lbQ = useQuery({
    queryKey: leaderboardKey,
    queryFn: fetchLeaderboard,
    enabled: Boolean(userId),
    staleTime: 55_000,
  });

  const [toId, setToId] = useState<string>("");
  const [xp, setXp] = useState("100");
  const [msg, setMsg] = useState("");
  const [sendBusy, setSendBusy] = useState(false);

  const recipients = useMemo(() => (lbQ.data ?? []).filter((u) => u.id !== me?.id), [lbQ.data, me?.id]);

  useEffect(() => {
    if (!toId && recipients.length) setToId(recipients[0]?.id ?? "");
  }, [recipients, toId]);

  useEffect(() => {
    if (!packQ.isSuccess || markedRef.current) return;
    const unread = (packQ.data?.inbox ?? []).some((g) => !g.isRead);
    if (!unread) return;
    markedRef.current = true;
    void markGiftsReadAll().finally(() => {
      void qc.invalidateQueries({ queryKey: giftsPackKey(userId) });
    });
  }, [packQ.isSuccess, packQ.data?.inbox, qc, userId]);

  const refresh = useCallback(() => {
    void packQ.refetch();
    void lbQ.refetch();
    void qc.invalidateQueries({ queryKey: shopMeKey(userId) });
  }, [packQ, lbQ, qc, userId]);

  const send = async () => {
    const amount = Number(xp);
    if (!toId || !Number.isFinite(amount) || amount < 1) {
      Alert.alert("Подарок", "Укажите получателя и сумму монет.");
      return;
    }
    setSendBusy(true);
    try {
      await sendGiftRequest({ toUserId: toId, xpAmount: amount, message: msg.trim() || null });
      setMsg("");
      await qc.invalidateQueries({ queryKey: giftsPackKey(userId) });
      await qc.invalidateQueries({ queryKey: shopMeKey(userId) });
      showToast({ message: "Подарок отправлен.", tone: "success" });
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось отправить");
    } finally {
      setSendBusy(false);
    }
  };

  if ((packQ.isLoading && packQ.data === undefined) || (lbQ.isLoading && lbQ.data === undefined)) {
    return (
      <AppScreen scroll bottomInset={bottom}>
        <ScreenHeader title="Подарки" />
        <ListSkeleton count={5} />
      </AppScreen>
    );
  }

  if (packQ.isError && packQ.data === undefined) {
    return (
      <AppScreen scroll bottomInset={bottom}>
        <ScreenHeader title="Подарки" />
        <ErrorState title="Подборка подарков" message={packQ.error instanceof Error ? packQ.error.message : "Ошибка"} onRetry={() => void packQ.refetch()} />
      </AppScreen>
    );
  }

  if (lbQ.isError && lbQ.data === undefined) {
    return (
      <AppScreen scroll bottomInset={bottom}>
        <ScreenHeader title="Подарки" />
        <ErrorState title="Список игроков" message={lbQ.error instanceof Error ? lbQ.error.message : "Ошибка"} onRetry={() => void lbQ.refetch()} />
      </AppScreen>
    );
  }

  const inbox = packQ.data?.inbox ?? [];
  const outbox = packQ.data?.outbox ?? [];
  const listRefreshing = !!(packQ.data != null && lbQ.data != null && (packQ.isFetching || lbQ.isFetching));

  return (
    <AppScreen
      scroll
      bottomInset={bottom}
      scrollProps={{
        refreshControl: (
          <RefreshControl refreshing={listRefreshing} onRefresh={refresh} tintColor={theme.colors.accent} colors={[theme.colors.accent]} />
        ),
      }}
    >
      <ScreenHeader title="Подарки" subtitle={`Баланс ${packQ.data?.coins ?? 0} мон.`} />

      <AppCard style={styles.card}>
        <Text style={styles.section}>Отправить</Text>
        <Text style={styles.hint}>Кому</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {recipients.map((u: LeaderboardRow) => (
            <Pressable key={u.id} onPress={() => setToId(u.id)} style={[styles.chip, toId === u.id && styles.chipOn]}>
              <Text style={[styles.chipTxt, toId === u.id && styles.chipTxtOn]} numberOfLines={1}>
                {u.nickname}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.hint}>Сумма (монеты)</Text>
        <TextInput
          value={xp}
          onChangeText={setXp}
          keyboardType="number-pad"
          style={styles.input}
          placeholderTextColor={theme.colors.textMuted}
        />
        <Text style={styles.hint}>Сообщение</Text>
        <TextInput
          value={msg}
          onChangeText={setMsg}
          style={styles.input}
          placeholder="Необязательно"
          placeholderTextColor={theme.colors.textMuted}
        />
        <Button loading={sendBusy} onPress={() => void send()}>
          Отправить
        </Button>
      </AppCard>

      <Text style={styles.sectionOut}>Входящие</Text>
      {inbox.length === 0 ? (
        <Text style={styles.empty}>Пока пусто.</Text>
      ) : (
        inbox.map((g: GiftInboxItem) => (
          <AppCard key={g.id} style={styles.item}>
            <Text style={styles.itemTitle}>
              +{g.xpAmount} от {g.fromUser.nickname}
            </Text>
            {g.message ? <Text style={styles.itemSub}>{g.message}</Text> : null}
            <Text style={styles.date}>{new Date(g.createdAt).toLocaleString("ru-RU")}</Text>
          </AppCard>
        ))
      )}

      <Text style={styles.sectionOut}>Исходящие</Text>
      {outbox.length === 0 ? (
        <Text style={styles.empty}>Пока пусто.</Text>
      ) : (
        outbox.map((g: GiftOutboxItem) => (
          <AppCard key={g.id} style={styles.item}>
            <Text style={styles.itemTitle}>
              −{g.xpAmount} → {g.toUser.nickname}
            </Text>
            {g.message ? <Text style={styles.itemSub}>{g.message}</Text> : null}
            <Text style={styles.date}>{new Date(g.createdAt).toLocaleString("ru-RU")}</Text>
          </AppCard>
        ))
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: theme.space.md },
  section: { ...theme.typography.bodyStrong, color: theme.colors.text, marginBottom: theme.space.sm },
  sectionOut: {
    ...theme.typography.xs,
    color: theme.colors.textMuted,
    marginTop: theme.space.lg,
    marginBottom: theme.space.sm,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  hint: { ...theme.typography.xs, color: theme.colors.textMuted, marginBottom: 4 },
  chips: { gap: 8, marginBottom: theme.space.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    maxWidth: 180,
  },
  chipOn: { borderColor: theme.colors.accent, backgroundColor: "rgba(88,166,255,0.12)" },
  chipTxt: { ...theme.typography.sm, color: theme.colors.text },
  chipTxtOn: { fontWeight: "800" },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.space.sm,
    color: theme.colors.text,
    marginBottom: theme.space.sm,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  item: { marginBottom: theme.space.sm },
  itemTitle: { ...theme.typography.bodyStrong, color: theme.colors.text },
  itemSub: { ...theme.typography.sm, color: theme.colors.textMuted, marginTop: 4 },
  date: { ...theme.typography.xs, color: theme.colors.textMuted, marginTop: 6 },
  empty: { ...theme.typography.sm, color: theme.colors.textMuted, marginBottom: theme.space.md },
});
