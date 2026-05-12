import { useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppScreen, Button, EmptyState, ErrorState, ScreenHeader, SteamCard } from "../components";
import { theme } from "../theme";
import { useTabBarInset } from "../hooks/useTabBarInset";
import { useAuthStore } from "../store/authStore";
import {
  adminInboxCountsKey,
  adminSupportReportsKey,
  adminSupportSuggestionsKey,
  adminTaskSubmissionsKey,
} from "../lib/queryKeys";
import {
  fetchAdminInboxCounts,
  fetchAdminSupportReports,
  fetchAdminSupportSuggestions,
  fetchAdminTaskSubmissions,
  patchAdminSupportReport,
  patchAdminSupportSuggestion,
  patchAdminTaskSubmission,
  fetchAdminUsers,
  fetchAdminAchievements,
  fetchAdminShopItems,
  fetchAdminTasks,
  fetchAdminAuditLogs,
  fetchAdminTelegramTemplates,
  sendAdminTelegramBroadcast,
  patchAdminUser,
  patchAdminUserCoins,
} from "../api/admin";
import type { AdminTaskSubmission, AdminSupportSuggestion, AdminSupportReport, AdminUserRow } from "../types/admin";
import type { SupportStatus } from "../types/tasks";
import { useToast } from "../providers/ToastProvider";

const STATUSES: SupportStatus[] = ["PENDING", "REVIEWED", "RESOLVED", "REJECTED"];

function statusRu(s: SupportStatus) {
  switch (s) {
    case "PENDING":
      return "Ожидает";
    case "REVIEWED":
      return "Рассмотрено";
    case "RESOLVED":
      return "Принято";
    case "REJECTED":
      return "Отклонено";
    default:
      return s;
  }
}

type Panel =
  | "dashboard"
  | "tasks"
  | "support"
  | "users"
  | "achievements"
  | "shop"
  | "tasksApi"
  | "customization"
  | "audit"
  | "telegram";

const ADMIN_TABS: { key: Panel; title: string }[] = [
  { key: "dashboard", title: "Обзор" },
  { key: "tasks", title: "Заявки" },
  { key: "support", title: "Идеи/Жалобы" },
  { key: "users", title: "Пользователи" },
  { key: "achievements", title: "Достижения" },
  { key: "customization", title: "Кастом." },
  { key: "shop", title: "Магазин" },
  { key: "tasksApi", title: "Задания" },
  { key: "audit", title: "Аудит" },
  { key: "telegram", title: "Telegram" },
];

export function AdminScreen() {
  const bottom = useTabBarInset();
  const navigation = useNavigation();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const role = useAuthStore((s) => s.user?.role);
  const staff = role === "ADMIN" || role === "CREATOR";
  const [panel, setPanel] = useState<Panel>("dashboard");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [userEditForm, setUserEditForm] = useState<{
    id: string;
    nickname: string;
    adminNotes: string;
    adminTags: string;
    level: string;
    xp: string;
    frameKey: string;
    statusEmoji: string;
    badges: string;
    rolePick: "USER" | "ADMIN";
    coinsDelta: string;
  } | null>(null);

  const countsQ = useQuery({ queryKey: adminInboxCountsKey, queryFn: fetchAdminInboxCounts, enabled: staff, staleTime: 20_000 });
  const tasksQ = useQuery({
    queryKey: adminTaskSubmissionsKey,
    queryFn: async () => (await fetchAdminTaskSubmissions(30, 0)).items,
    enabled: staff,
    staleTime: 15_000,
  });
  const suggestionsQ = useQuery({
    queryKey: adminSupportSuggestionsKey,
    queryFn: fetchAdminSupportSuggestions,
    enabled: staff,
    staleTime: 20_000,
  });
  const reportsQ = useQuery({
    queryKey: adminSupportReportsKey,
    queryFn: fetchAdminSupportReports,
    enabled: staff,
    staleTime: 20_000,
  });
  const usersQ = useQuery({
    queryKey: ["admin", "users", "list"],
    queryFn: fetchAdminUsers,
    enabled: staff && panel === "users",
    staleTime: 25_000,
  });
  const achievementsAdminQ = useQuery({
    queryKey: ["admin", "achievements", "list"],
    queryFn: fetchAdminAchievements,
    enabled: staff && panel === "achievements",
    staleTime: 30_000,
  });
  const shopAdminQ = useQuery({
    queryKey: ["admin", "shop", "list"],
    queryFn: fetchAdminShopItems,
    enabled: staff && panel === "shop",
    staleTime: 30_000,
  });
  const tasksApiQ = useQuery({
    queryKey: ["admin", "tasks", "list"],
    queryFn: fetchAdminTasks,
    enabled: staff && panel === "tasksApi",
    staleTime: 25_000,
  });
  const auditQ = useQuery({
    queryKey: ["admin", "audit", "list"],
    queryFn: fetchAdminAuditLogs,
    enabled: staff && panel === "audit",
    staleTime: 20_000,
  });
  const telegramQ = useQuery({
    queryKey: ["admin", "telegram", "templates"],
    queryFn: fetchAdminTelegramTemplates,
    enabled: staff && panel === "telegram",
    staleTime: 60_000,
  });

  const [tgMessage, setTgMessage] = useState("");
  const [tgTemplateId, setTgTemplateId] = useState<string | undefined>(undefined);

  const sendTgM = useMutation({
    mutationFn: () => sendAdminTelegramBroadcast(tgMessage.trim(), tgTemplateId),
    onSuccess: async (r) => {
      showToast({ message: `Рассылка: отправлено ${r.sent}, ошибок ${r.failed}`, tone: "success" });
      setTgMessage("");
    },
    onError: (e) => showToast({ message: e instanceof Error ? e.message : "Ошибка", tone: "error" }),
  });

  const patchUserM = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        role?: "USER" | "ADMIN" | "CREATOR";
        nickname?: string;
        xp?: number;
        level?: number;
        adminNotes?: string | null;
        adminTags?: string[];
        frameKey?: string | null;
        badges?: string[];
        statusEmoji?: string | null;
      };
    }) => patchAdminUser(id, payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "users", "list"] });
      showToast({ message: "Пользователь обновлён", tone: "success" });
      setUserEditForm(null);
    },
    onError: (e) => showToast({ message: e instanceof Error ? e.message : "Ошибка", tone: "error" }),
  });

  const coinsM = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) => patchAdminUserCoins(id, delta),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "users", "list"] });
      showToast({ message: "Монеты изменены", tone: "success" });
    },
    onError: (e) => showToast({ message: e instanceof Error ? e.message : "Ошибка", tone: "error" }),
  });

  const patchTaskM = useMutation({
    mutationFn: ({ id, status, adminResponse }: { id: string; status: SupportStatus; adminResponse: string }) =>
      patchAdminTaskSubmission(id, { status, isRead: true, adminResponse }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: adminTaskSubmissionsKey });
      await qc.invalidateQueries({ queryKey: adminInboxCountsKey });
      showToast({ message: "Заявка обновлена", tone: "success" });
    },
    onError: (e) => showToast({ message: e instanceof Error ? e.message : "Ошибка модерации", tone: "error" }),
  });

  const patchSupportM = useMutation({
    mutationFn: async ({
      kind,
      id,
      status,
      adminResponse,
    }: {
      kind: "report" | "suggestion";
      id: string;
      status: SupportStatus;
      adminResponse: string;
    }) => {
      if (kind === "report") return patchAdminSupportReport(id, { status, isRead: true, adminResponse });
      return patchAdminSupportSuggestion(id, { status, isRead: true, adminResponse });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: adminSupportReportsKey });
      await qc.invalidateQueries({ queryKey: adminSupportSuggestionsKey });
      await qc.invalidateQueries({ queryKey: adminInboxCountsKey });
      showToast({ message: "Обращение обновлено", tone: "success" });
    },
    onError: (e) => showToast({ message: e instanceof Error ? e.message : "Ошибка модерации", tone: "error" }),
  });

  const refreshing =
    countsQ.isFetching ||
    tasksQ.isFetching ||
    suggestionsQ.isFetching ||
    reportsQ.isFetching ||
    usersQ.isFetching ||
    achievementsAdminQ.isFetching ||
    shopAdminQ.isFetching ||
    tasksApiQ.isFetching ||
    auditQ.isFetching ||
    telegramQ.isFetching;

  const supportRows = useMemo(
    () =>
      [
        ...(suggestionsQ.data ?? []).map((item) => ({ kind: "suggestion" as const, item })),
        ...(reportsQ.data ?? []).map((item) => ({ kind: "report" as const, item })),
      ].sort((a, b) => +new Date(b.item.createdAt) - +new Date(a.item.createdAt)),
    [suggestionsQ.data, reportsQ.data],
  );

  const backLeft = navigation.canGoBack() ? (
    <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ width: 36, height: 36, justifyContent: "center" }}>
      <Text style={{ fontSize: 28, color: theme.colors.accent, fontWeight: "300" }}>‹</Text>
    </Pressable>
  ) : null;

  if (!staff) {
    return (
      <AppScreen scroll bottomInset={bottom}>
        <ScreenHeader title="Админка" left={backLeft} subtitle="Доступ только для ADMIN/CREATOR." />
        <ErrorState title="Нет доступа" message="Ваша роль не имеет доступа к разделу администрирования." />
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
            refreshing={refreshing}
            onRefresh={() => {
              void countsQ.refetch();
              void tasksQ.refetch();
              void suggestionsQ.refetch();
              void reportsQ.refetch();
              void usersQ.refetch();
              void achievementsAdminQ.refetch();
              void shopAdminQ.refetch();
              void tasksApiQ.refetch();
              void auditQ.refetch();
              void telegramQ.refetch();
            }}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        ),
      }}
    >
      <ScreenHeader title="Админка" left={backLeft} subtitle="Мобильная адаптация панели управления сайта." />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {ADMIN_TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setPanel(t.key)}
            style={[styles.tab, panel === t.key && styles.tabOn]}
          >
            <Text style={[styles.tabTxt, panel === t.key && styles.tabTxtOn]} numberOfLines={1}>
              {t.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {panel === "dashboard" ? (
        <View style={styles.grid}>
          <SteamCard style={styles.metric}>
            <Text style={styles.metricLabel}>Новые заявки</Text>
            <Text style={styles.metricVal}>{countsQ.data?.tasks ?? 0}</Text>
          </SteamCard>
          <SteamCard style={styles.metric}>
            <Text style={styles.metricLabel}>Идеи/предложения</Text>
            <Text style={styles.metricVal}>{countsQ.data?.suggestions ?? 0}</Text>
          </SteamCard>
          <SteamCard style={styles.metric}>
            <Text style={styles.metricLabel}>Жалобы</Text>
            <Text style={styles.metricVal}>{countsQ.data?.reports ?? 0}</Text>
          </SteamCard>
        </View>
      ) : null}

      {panel === "tasks" ? (
        (tasksQ.data?.length ?? 0) === 0 ? (
          <EmptyState title="Нет заявок" subtitle="Новые task-submissions появятся здесь." icon="clipboard-outline" />
        ) : (
          tasksQ.data?.map((s: AdminTaskSubmission) => (
            <SteamCard key={s.id} style={styles.card}>
              <Text style={styles.title}>{s.task.title}</Text>
              <Text style={styles.meta}>
                {s.user.nickname} · {statusRu(s.status)} · {new Date(s.createdAt).toLocaleString()}
              </Text>
              {s.message ? <Text style={styles.body}>{s.message}</Text> : null}
              <Text style={styles.meta}>Вложений: {s.evidence.length}</Text>
              <TextInput
                value={responses[s.id] ?? s.adminResponse ?? ""}
                onChangeText={(v) => setResponses((p) => ({ ...p, [s.id]: v }))}
                style={styles.input}
                placeholder="Ответ модератора"
                placeholderTextColor={theme.colors.textMuted}
              />
              <View style={styles.actions}>
                <Button
                  compact
                  onPress={() =>
                    patchTaskM.mutate({
                      id: s.id,
                      status: "RESOLVED",
                      adminResponse: (responses[s.id] ?? "").trim(),
                    })
                  }
                >
                  Принять
                </Button>
                <Button
                  compact
                  variant="danger"
                  onPress={() => {
                    const response = (responses[s.id] ?? "").trim();
                    if (!response) {
                      Alert.alert("Отклонение", "Добавьте причину отклонения.");
                      return;
                    }
                    patchTaskM.mutate({ id: s.id, status: "REJECTED", adminResponse: response });
                  }}
                >
                  Отклонить
                </Button>
              </View>
            </SteamCard>
          ))
        )
      ) : null}

      {panel === "support" ? (
        supportRows.length === 0 ? (
          <EmptyState title="Поддержка пуста" subtitle="Жалобы и идеи будут видны здесь." icon="chatbubbles-outline" />
        ) : (
          supportRows.map(({ kind, item }: { kind: "suggestion" | "report"; item: AdminSupportSuggestion | AdminSupportReport }) => {
            const title = kind === "suggestion" ? (item as AdminSupportSuggestion).title : (item as AdminSupportReport).reason;
            const author =
              kind === "suggestion"
                ? (item as AdminSupportSuggestion).author.nickname
                : `${(item as AdminSupportReport).reporter.nickname} → ${(item as AdminSupportReport).reported.nickname}`;
            return (
              <SteamCard key={`${kind}-${item.id}`} style={styles.card}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.meta}>
                  {author} · {statusRu(item.status)} · {new Date(item.createdAt).toLocaleString()}
                </Text>
                <Text style={styles.body}>{item.description}</Text>
                <TextInput
                  value={responses[item.id] ?? item.adminResponse ?? ""}
                  onChangeText={(v) => setResponses((p) => ({ ...p, [item.id]: v }))}
                  style={styles.input}
                  placeholder="Ответ модератора"
                  placeholderTextColor={theme.colors.textMuted}
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statuses}>
                  {STATUSES.map((st) => (
                    <Pressable
                      key={st}
                      style={[styles.statusChip, item.status === st && styles.statusChipOn]}
                      onPress={() =>
                        patchSupportM.mutate({
                          kind,
                          id: item.id,
                          status: st,
                          adminResponse: (responses[item.id] ?? "").trim(),
                        })
                      }
                    >
                      <Text style={[styles.statusTxt, item.status === st && styles.statusTxtOn]}>{statusRu(st)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </SteamCard>
            );
          })
        )
      ) : null}

      {panel === "users" ? (
        (usersQ.data?.length ?? 0) === 0 ? (
          <EmptyState title="Нет данных" subtitle="Пользователи загрузятся здесь." icon="people-outline" />
        ) : (
          usersQ.data?.map((u: AdminUserRow) => {
            const expanded = userEditForm?.id === u.id;
            const toggleEdit = () => {
              if (expanded) setUserEditForm(null);
              else {
                setUserEditForm({
                  id: u.id,
                  nickname: u.nickname,
                  adminNotes: u.adminNotes ?? "",
                  adminTags: (u.adminTags ?? []).join(", "),
                  level: String(u.level ?? 1),
                  xp: String(u.xp ?? 0),
                  frameKey: u.frameKey ?? "",
                  statusEmoji: u.statusEmoji ?? "",
                  badges: (u.badges ?? []).join(", "),
                  rolePick: u.role === "ADMIN" ? "ADMIN" : "USER",
                  coinsDelta: "",
                });
              }
            };
            return (
              <SteamCard key={u.id} style={styles.card}>
                <View style={styles.userHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>
                      {u.nickname} · {u.role}
                    </Text>
                    <Text style={styles.meta}>
                      #{u.publicId ?? "—"} · ур. {u.level} · XP {u.xp}
                      {u.blocked ? " · ЗАБЛОКИРОВАН" : ""}
                    </Text>
                  </View>
                  <Button compact variant="ghost" onPress={toggleEdit}>
                    {expanded ? "Свернуть" : "Редактировать"}
                  </Button>
                </View>
                {u.adminNotes && !expanded ? <Text style={styles.body}>Заметки: {u.adminNotes}</Text> : null}
                {expanded && userEditForm ? (
                  <View style={{ marginTop: theme.space.sm, gap: theme.space.sm }}>
                    <Text style={styles.meta}>Никнейм</Text>
                    <TextInput
                      value={userEditForm.nickname}
                      onChangeText={(v) => setUserEditForm((f) => (f ? { ...f, nickname: v } : f))}
                      style={styles.input}
                      placeholderTextColor={theme.colors.textMuted}
                    />
                    <Text style={styles.meta}>Заметки администратора</Text>
                    <TextInput
                      value={userEditForm.adminNotes}
                      onChangeText={(v) => setUserEditForm((f) => (f ? { ...f, adminNotes: v } : f))}
                      style={styles.input}
                      multiline
                      placeholderTextColor={theme.colors.textMuted}
                    />
                    <Text style={styles.meta}>Теги (через запятую)</Text>
                    <TextInput
                      value={userEditForm.adminTags}
                      onChangeText={(v) => setUserEditForm((f) => (f ? { ...f, adminTags: v } : f))}
                      style={styles.input}
                      placeholderTextColor={theme.colors.textMuted}
                    />
                    <Text style={styles.meta}>Уровень / XP</Text>
                    <View style={{ flexDirection: "row", gap: theme.space.sm }}>
                      <TextInput
                        value={userEditForm.level}
                        onChangeText={(v) => setUserEditForm((f) => (f ? { ...f, level: v } : f))}
                        style={[styles.input, { flex: 1 }]}
                        keyboardType="number-pad"
                        placeholder="Уровень"
                        placeholderTextColor={theme.colors.textMuted}
                      />
                      <TextInput
                        value={userEditForm.xp}
                        onChangeText={(v) => setUserEditForm((f) => (f ? { ...f, xp: v } : f))}
                        style={[styles.input, { flex: 2 }]}
                        keyboardType="number-pad"
                        placeholder="XP"
                        placeholderTextColor={theme.colors.textMuted}
                      />
                    </View>
                    <Text style={styles.meta}>Рамка (key), статус (эмодзи), значки (key через запятую)</Text>
                    <TextInput
                      value={userEditForm.frameKey}
                      onChangeText={(v) => setUserEditForm((f) => (f ? { ...f, frameKey: v } : f))}
                      style={styles.input}
                      placeholder="frameKey"
                      placeholderTextColor={theme.colors.textMuted}
                    />
                    <TextInput
                      value={userEditForm.statusEmoji}
                      onChangeText={(v) => setUserEditForm((f) => (f ? { ...f, statusEmoji: v } : f))}
                      style={styles.input}
                      placeholder="Статус (эмодзи)"
                      placeholderTextColor={theme.colors.textMuted}
                    />
                    <TextInput
                      value={userEditForm.badges}
                      onChangeText={(v) => setUserEditForm((f) => (f ? { ...f, badges: v } : f))}
                      style={styles.input}
                      placeholder="badge keys"
                      placeholderTextColor={theme.colors.textMuted}
                    />
                    {role === "CREATOR" && u.role !== "CREATOR" ? (
                      <View style={{ flexDirection: "row", gap: theme.space.sm, flexWrap: "wrap" }}>
                        <Text style={styles.meta}>Роль:</Text>
                        {(["USER", "ADMIN"] as const).map((r) => (
                          <Pressable
                            key={r}
                            onPress={() => setUserEditForm((f) => (f ? { ...f, rolePick: r } : f))}
                            style={[styles.statusChip, userEditForm.rolePick === r && styles.statusChipOn]}
                          >
                            <Text style={[styles.statusTxt, userEditForm.rolePick === r && styles.statusTxtOn]}>{r}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                    <View style={{ flexDirection: "row", gap: theme.space.sm, flexWrap: "wrap", alignItems: "center" }}>
                      <Text style={styles.meta}>Монеты Δ</Text>
                      <TextInput
                        value={userEditForm.coinsDelta}
                        onChangeText={(v) => setUserEditForm((f) => (f ? { ...f, coinsDelta: v } : f))}
                        style={[styles.input, { width: 100 }]}
                        keyboardType="number-pad"
                        placeholder="±"
                        placeholderTextColor={theme.colors.textMuted}
                      />
                      <Button
                        compact
                        loading={coinsM.isPending}
                        onPress={() => {
                          const d = parseInt(userEditForm.coinsDelta.trim(), 10);
                          if (Number.isNaN(d) || d === 0) {
                            Alert.alert("Монеты", "Введите ненулевое число (например 50 или -20).");
                            return;
                          }
                          coinsM.mutate({ id: u.id, delta: d });
                          setUserEditForm((f) => (f ? { ...f, coinsDelta: "" } : f));
                        }}
                      >
                        Применить Δ
                      </Button>
                      <Button compact variant="ghost" onPress={() => coinsM.mutate({ id: u.id, delta: 50 })}>
                        +50
                      </Button>
                      <Button compact variant="ghost" onPress={() => coinsM.mutate({ id: u.id, delta: -50 })}>
                        −50
                      </Button>
                    </View>
                    <Button
                      loading={patchUserM.isPending}
                      onPress={() => {
                        const nick = userEditForm.nickname.trim();
                        if (nick.length < 2 || nick.length > 24) {
                          Alert.alert("Никнейм", "От 2 до 24 символов.");
                          return;
                        }
                        const lvl = parseInt(userEditForm.level, 10);
                        const xpV = parseInt(userEditForm.xp, 10);
                        if (Number.isNaN(lvl) || Number.isNaN(xpV)) {
                          Alert.alert("Уровень/XP", "Введите числа.");
                          return;
                        }
                        const tags = userEditForm.adminTags
                          .split(",")
                          .map((x) => x.trim())
                          .filter(Boolean);
                        const badges = userEditForm.badges
                          .split(",")
                          .map((x) => x.trim())
                          .filter(Boolean);
                        const fk = userEditForm.frameKey.trim();
                        const st = userEditForm.statusEmoji.trim();
                        patchUserM.mutate({
                          id: u.id,
                          payload: {
                            nickname: nick,
                            adminNotes: userEditForm.adminNotes.trim() || null,
                            adminTags: tags,
                            level: lvl,
                            xp: xpV,
                            frameKey: fk.length ? fk : null,
                            statusEmoji: st.length ? st : null,
                            badges,
                            ...(role === "CREATOR" && u.role !== "CREATOR" ? { role: userEditForm.rolePick } : {}),
                          },
                        });
                      }}
                    >
                      Сохранить пользователя
                    </Button>
                  </View>
                ) : null}
              </SteamCard>
            );
          })
        )
      ) : null}

      {panel === "achievements" ? (
        (achievementsAdminQ.data?.length ?? 0) === 0 ? (
          <EmptyState title="Пусто" subtitle="Достижения из админки." icon="ribbon-outline" />
        ) : (
          achievementsAdminQ.data?.map((a) => (
            <SteamCard key={a.id} style={styles.card}>
              <Text style={styles.title}>{a.title}</Text>
              <Text style={styles.meta}>
                {a.rarity} · {a.points} XP · {a.isPublic ? "публичное" : "скрыто"}
              </Text>
            </SteamCard>
          ))
        )
      ) : null}

      {panel === "shop" ? (
        (shopAdminQ.data?.length ?? 0) === 0 ? (
          <EmptyState title="Пусто" subtitle="Товары магазина." icon="cart-outline" />
        ) : (
          shopAdminQ.data?.map((it) => (
            <SteamCard key={it.id} style={styles.card}>
              <Text style={styles.title}>{it.name}</Text>
              <Text style={styles.meta}>
                {it.type} · {it.key} · {it.price} мон.
              </Text>
            </SteamCard>
          ))
        )
      ) : null}

      {panel === "tasksApi" ? (
        (tasksApiQ.data?.length ?? 0) === 0 ? (
          <EmptyState title="Пусто" subtitle="Задания (редактор — на сайте)." icon="list-outline" />
        ) : (
          tasksApiQ.data?.map((t) => (
            <SteamCard key={t.id} style={styles.card}>
              <Text style={styles.title}>{t.title}</Text>
              <Text style={styles.meta}>
                {t.isActive ? "активно" : "выкл."} · {t.isEvent ? "ивент" : "обычное"}
                {t.achievement ? ` · ${t.achievement.title}` : ""}
              </Text>
            </SteamCard>
          ))
        )
      ) : null}

      {panel === "customization" ? (
        <SteamCard>
          <Text style={styles.title}>Кастомизация профиля</Text>
          <Text style={styles.body}>
            Рамка, эмодзи статуса, значки, уровень и монеты: вкладка «Пользователи» — карточка → «Редактировать». Полный
            визуальный редактор как на сайте можно дополнять по мере необходимости.
          </Text>
        </SteamCard>
      ) : null}

      {panel === "audit" ? (
        (auditQ.data?.length ?? 0) === 0 ? (
          <EmptyState title="Пусто" subtitle="Журнал действий администрации." icon="document-text-outline" />
        ) : (
          auditQ.data?.slice(0, 80).map((log) => (
            <SteamCard key={log.id} style={styles.card}>
              <Text style={styles.meta}>{new Date(log.createdAt).toLocaleString("ru-RU")}</Text>
              <Text style={styles.title}>{log.action}</Text>
              <Text style={styles.body}>{log.summary}</Text>
              <Text style={styles.meta}>
                {log.adminNickname ?? "—"} → {log.targetNickname ?? "—"}
              </Text>
            </SteamCard>
          ))
        )
      ) : null}

      {panel === "telegram" ? (
        <SteamCard>
          <Text style={styles.title}>Рассылка в Telegram</Text>
          <Text style={styles.body}>Шаблоны с сайта; текст и опционально шаблон.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statuses}>
            {(telegramQ.data ?? []).map((tpl) => (
              <Pressable
                key={tpl.id}
                style={[styles.statusChip, tgTemplateId === tpl.id && styles.statusChipOn]}
                onPress={() => setTgTemplateId(tpl.id)}
              >
                <Text style={[styles.statusTxt, tgTemplateId === tpl.id && styles.statusTxtOn]} numberOfLines={1}>
                  {tpl.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput
            value={tgMessage}
            onChangeText={setTgMessage}
            placeholder="Текст рассылки"
            placeholderTextColor={theme.colors.textMuted}
            multiline
            style={[styles.input, { minHeight: 100, textAlignVertical: "top" }]}
          />
          <Button loading={sendTgM.isPending} onPress={() => sendTgM.mutate()} disabled={!tgMessage.trim()}>
            Отправить в бот
          </Button>
        </SteamCard>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  tabRow: { flexDirection: "row", gap: 6, marginBottom: theme.space.md, paddingRight: theme.space.md },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  tabOn: { borderColor: theme.colors.accent, backgroundColor: "rgba(102,192,244,0.12)" },
  tabTxt: { ...theme.typography.xs, color: theme.colors.textMuted, fontWeight: "700", fontSize: 11 },
  tabTxtOn: { color: theme.colors.text },
  grid: { gap: theme.space.sm },
  metric: { paddingVertical: theme.space.sm },
  metricLabel: { ...theme.typography.xs, color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 1 },
  metricVal: { ...theme.typography.hero, color: theme.colors.accent, marginTop: theme.space.xs },
  card: { marginBottom: theme.space.sm },
  title: { ...theme.typography.bodyStrong, color: theme.colors.text },
  meta: { ...theme.typography.xs, color: theme.colors.textMuted, marginTop: 4 },
  body: { ...theme.typography.sm, color: theme.colors.text, marginTop: theme.space.sm },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.space.sm,
    color: theme.colors.text,
    marginTop: theme.space.sm,
  },
  actions: { flexDirection: "row", gap: theme.space.sm, marginTop: theme.space.sm },
  statuses: { gap: theme.space.xs, marginTop: theme.space.sm },
  statusChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.space.sm,
    paddingVertical: 6,
  },
  statusChipOn: { borderColor: theme.colors.accent, backgroundColor: "rgba(102,192,244,0.12)" },
  statusTxt: { ...theme.typography.xs, color: theme.colors.textMuted, fontWeight: "700" },
  statusTxtOn: { color: theme.colors.text },
  userHead: { flexDirection: "row", alignItems: "flex-start", gap: theme.space.sm },
});
