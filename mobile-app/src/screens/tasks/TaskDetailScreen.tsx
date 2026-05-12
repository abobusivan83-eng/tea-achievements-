import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppBackground } from "../../components/layout/AppBackground";
import { Button } from "../../components/ui/Button";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { SteamCard } from "../../components/ui/SteamCard";
import { ErrorState, ListSkeleton } from "../../components";
import { MediaViewerModal } from "../../components/media/MediaViewerModal";
import { useToast } from "../../providers/ToastProvider";
import { fetchTasks, submitTaskWithProgress, type TaskEvidencePick } from "../../api/tasks";
import { tasksListKey } from "../../lib/queryKeys";
import type { TasksStackParamList } from "../../navigation/types";
import { theme } from "../../theme";
import { rarityAccent } from "../../lib/rarityTheme";
import { isTaskCompleted, taskScheduleStatus } from "../../lib/taskUtils";
import { isEvidenceVideoUrl } from "../../lib/mediaUrls";
import { useTabBarInset } from "../../hooks/useTabBarInset";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const MAX_BYTES = 100 * 1024 * 1024;
const STATUS_RU: Record<string, string> = {
  PENDING: "На проверке",
  REVIEWED: "Рассмотрено",
  RESOLVED: "Принято",
  REJECTED: "Отклонено",
};

type LocalAtt = { id: string; uri: string; name: string; type: string; size?: number };

export function TaskDetailScreen() {
  const route = useRoute<RouteProp<TasksStackParamList, "TaskDetail">>();
  const navigation = useNavigation();
  const { taskId } = route.params;
  const bottom = useTabBarInset();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: tasksListKey, queryFn: fetchTasks, staleTime: 30_000 });
  const task = useMemo(() => q.data?.find((t) => t.id === taskId), [q.data, taskId]);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const sched = task ? taskScheduleStatus(task, nowMs) : "ACTIVE";
  const isDone = task ? isTaskCompleted(task) : false;
  const sub = task?.mySubmission ?? task?.submission;

  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<LocalAtt[]>([]);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadHint, setUploadHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ urls: string[]; index: number } | null>(null);

  const blockSubmit =
    !task || isDone || sched !== "ACTIVE" || !!(sub && (sub.status === "PENDING" || sub.status === "REVIEWED"));

  const blockReason = useMemo(() => {
    if (!task) return "Загрузка…";
    if (isDone) return "Задание уже выполнено.";
    if (sched === "UPCOMING") return "Задание ещё не открылось.";
    if (sched === "EXPIRED") return "Срок задания истёк.";
    if (sub?.status === "PENDING" || sub?.status === "REVIEWED") return "Уже есть заявка на проверке.";
    return null;
  }, [task, isDone, sched, sub?.status]);

  const pickMedia = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Нет доступа", "Разрешите доступ к галерее в настройках.");
      return;
    }
    const left = 8 - attachments.length;
    if (left <= 0) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: left,
    });
    if (res.canceled || !res.assets?.length) return;
    const next: LocalAtt[] = [];
    for (const a of res.assets) {
      if (a.fileSize && a.fileSize > MAX_BYTES && a.type === "video") {
        Alert.alert("Файл слишком большой", "Видео до 100 МБ.");
        continue;
      }
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        uri: a.uri,
        name: a.fileName ?? "upload",
        type: a.mimeType ?? (a.type === "video" ? "video/mp4" : "image/jpeg"),
        size: a.fileSize ?? undefined,
      });
    }
    setAttachments((prev) => [...prev, ...next].slice(0, 8));
    setLastError(null);
  }, [attachments.length]);

  const removeAtt = (id: string) => setAttachments((prev) => prev.filter((x) => x.id !== id));

  const move = (id: string, dir: -1 | 1) => {
    setAttachments((prev) => {
      const i = prev.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const c = [...prev];
      const t = c[i];
      const u = c[j];
      if (t && u) {
        c[i] = u;
        c[j] = t;
      }
      return c;
    });
  };

  const submit = async () => {
    if (!task || blockSubmit) return;
    const msg = message.trim();
    if (msg.length < 3) {
      Alert.alert("Комментарий", "Минимум 3 символа (как на сайте).");
      return;
    }
    setBusy(true);
    setLastError(null);
    setUploadPct(0);
    try {
      const files: TaskEvidencePick[] = attachments.map((a) => ({
        uri: a.uri,
        name: a.name,
        type: a.type,
      }));
      await submitTaskWithProgress(task.id, msg, files, (pct, hint) => {
        setUploadPct(pct);
        setUploadHint(hint);
      });
      setMessage("");
      setAttachments([]);
      await qc.invalidateQueries({ queryKey: tasksListKey });
      showToast({ message: "Отправка принята модерацией.", tone: "success" });
    } catch (e) {
      const m = e instanceof Error ? e.message : "Ошибка";
      setLastError(m);
      showToast({ message: m, tone: "error" });
    } finally {
      setBusy(false);
      setUploadHint(null);
      setUploadPct(0);
    }
  };

  if (q.isError && q.data === undefined) {
    const msg = q.error instanceof Error ? q.error.message : "Ошибка сети.";
    return (
      <AppBackground>
        <SafeAreaView style={[styles.safe, styles.detailPad]} edges={["top", "left", "right"]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backRow} accessibilityRole="button">
            <Ionicons name="chevron-back" size={22} color={theme.colors.accent} />
            <Text style={styles.backTxt}>Назад</Text>
          </Pressable>
          <ErrorState title="Задание не загрузилось" message={msg} onRetry={() => void q.refetch()} />
        </SafeAreaView>
      </AppBackground>
    );
  }

  if (q.isLoading && q.data === undefined) {
    return (
      <AppBackground>
        <SafeAreaView style={[styles.safe, styles.detailPad]} edges={["top", "left", "right"]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backRow}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.accent} />
            <Text style={styles.backTxt}>Задания</Text>
          </Pressable>
          <ScreenHeader title="Загрузка…" />
          <ListSkeleton count={5} />
        </SafeAreaView>
      </AppBackground>
    );
  }

  if (!task) {
    return (
      <AppBackground>
        <SafeAreaView style={[styles.safe, styles.detailPad]} edges={["top", "left", "right"]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backRow}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.accent} />
            <Text style={styles.backTxt}>Задания</Text>
          </Pressable>
          <ScreenHeader title="Задание" />
          <SteamCard emphasized>
            <Text style={styles.body}>Это задание не найдено в списке. Вернитесь к списку и обновите данные.</Text>
            <Button variant="ghost" onPress={() => void q.refetch()}>
              Обновить
            </Button>
          </SteamCard>
        </SafeAreaView>
      </AppBackground>
    );
  }

  const accent = rarityAccent(task.achievement?.rarity);
  const evidence = sub?.evidence ?? [];

  return (
    <AppBackground>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 72 : Math.max(insets.top, 8)}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.scroll, { paddingBottom: bottom + theme.space.xl }]}
            showsVerticalScrollIndicator={false}
          >
            <Pressable onPress={() => navigation.goBack()} style={styles.backRow} accessibilityRole="button">
              <Ionicons name="chevron-back" size={22} color={theme.colors.accent} />
              <Text style={styles.backTxt}>Задания</Text>
            </Pressable>

            <ScreenHeader title={task.title} subtitle={task.achievement?.title} />

            <SteamCard emphasized style={[styles.hero, { borderColor: accent.border }]}>
              <Text style={styles.section}>Награда</Text>
              <Text style={styles.body}>
                {task.achievement?.points != null ? `${task.achievement.points} очков` : ""}
                {task.rewardCoins ? ` · ${task.rewardCoins} монет` : ""}
              </Text>
              <Text style={styles.section}>Статус окна</Text>
              <Text style={styles.body}>
                {sched === "ACTIVE" ? "Можно отправить решение" : sched === "UPCOMING" ? "Скоро откроется" : "Окно закрыто"}
              </Text>
              {sub ? (
                <>
                  <Text style={styles.section}>Ваша заявка</Text>
                  <Text style={styles.body}>{STATUS_RU[sub.status] ?? sub.status}</Text>
                  {sub.message ? <Text style={styles.quote}>{sub.message}</Text> : null}
                  {sub.adminResponse ? <Text style={styles.admin}>Ответ: {sub.adminResponse}</Text> : null}
                </>
              ) : null}
            </SteamCard>

            <SteamCard>
              <Text style={styles.section}>Описание</Text>
              <Text style={styles.body}>{task.description}</Text>
              <Text style={styles.section}>Условия</Text>
              <Text style={styles.body}>{task.conditions}</Text>
            </SteamCard>

            {evidence.length > 0 ? (
              <SteamCard>
                <Text style={styles.section}>Прикреплённые файлы</Text>
                <View style={styles.thumbGrid}>
                  {evidence.map((url, i) => (
                    <Pressable key={url + i} onPress={() => setViewer({ urls: evidence, index: i })} style={styles.thumbBox}>
                      {isEvidenceVideoUrl(url) ? (
                        <View style={[styles.thumbImg, styles.thumbPh]}>
                          <Ionicons name="play-circle" size={32} color={theme.colors.accent} />
                        </View>
                      ) : (
                        <Image
                          source={{ uri: url }}
                          style={styles.thumbImg}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          transition={160}
                          recyclingKey={url}
                        />
                      )}
                    </Pressable>
                  ))}
                </View>
              </SteamCard>
            ) : null}

            {!blockSubmit ? (
              <SteamCard>
                <Text style={styles.section}>Доказательства выполнения</Text>
                <Text style={styles.bodySmall}>Опишите выполнение и прикрепите скриншоты или видео (до 8 файлов).</Text>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Комментарий к выполнению (от 3 символов)"
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                  style={styles.input}
                />
                <Text style={styles.attachLabel} allowFontScaling={false}>
                  Прикрепить файлы
                </Text>
                <Text style={styles.attachHint} allowFontScaling={false}>
                  Нажмите кнопку ниже, чтобы выбрать фото или видео из галереи (до 8 вложений).
                </Text>
                <Button variant="ghost" onPress={pickMedia} compact style={styles.pickBtn}>
                  Выбрать файлы из галереи ({attachments.length}/8)
                </Button>
                {attachments.length > 0 ? (
                  <View style={styles.queue}>
                    {attachments.map((a, idx) => (
                      <View key={a.id} style={styles.queueRow}>
                        {isEvidenceVideoUrl(a.uri) ? (
                          <View style={[styles.mini, styles.thumbPh]}>
                            <Ionicons name="videocam" size={20} color={theme.colors.accent} />
                          </View>
                        ) : (
                          <Image
                            source={{ uri: a.uri }}
                            style={styles.mini}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            transition={140}
                          />
                        )}
                        <View style={styles.queueMid}>
                          <Text style={styles.queueName} numberOfLines={1}>
                            {a.name}
                          </Text>
                          <View style={styles.queueActions}>
                            <Pressable onPress={() => move(a.id, -1)} disabled={idx === 0} hitSlop={8}>
                              <Ionicons
                                name="arrow-up"
                                size={20}
                                color={idx === 0 ? theme.colors.textMuted : theme.colors.accent}
                              />
                            </Pressable>
                            <Pressable
                              onPress={() => move(a.id, 1)}
                              disabled={idx === attachments.length - 1}
                              hitSlop={8}
                            >
                              <Ionicons
                                name="arrow-down"
                                size={20}
                                color={idx === attachments.length - 1 ? theme.colors.textMuted : theme.colors.accent}
                              />
                            </Pressable>
                            <Pressable onPress={() => removeAtt(a.id)} hitSlop={8}>
                              <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
                {busy ? (
                  <View style={styles.progressBox}>
                    <Text style={styles.progressTxt}>{uploadHint ?? "Загрузка…"}</Text>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${uploadPct}%` }]} />
                    </View>
                  </View>
                ) : null}
                {lastError ? <Text style={styles.err}>{lastError}</Text> : null}
                <Button loading={busy} onPress={() => void submit()}>
                  Отправить доказательства на проверку
                </Button>
                {lastError ? (
                  <Button variant="ghost" onPress={() => void submit()} disabled={busy}>
                    Повторить отправку доказательств
                  </Button>
                ) : null}
              </SteamCard>
            ) : (
              <SteamCard>
                <Text style={styles.block}>{blockReason}</Text>
              </SteamCard>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <MediaViewerModal
        visible={viewer != null}
        urls={viewer?.urls ?? []}
        initialIndex={viewer?.index ?? 0}
        onClose={() => setViewer(null)}
      />
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: theme.space.md, paddingTop: theme.space.sm },
  backRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: theme.space.sm },
  backTxt: { ...theme.typography.sm, color: theme.colors.accent, fontWeight: "700" },
  hero: { marginBottom: theme.space.md },
  section: {
    ...theme.typography.xs,
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: theme.space.sm,
    marginBottom: 4,
  },
  body: { ...theme.typography.body, color: theme.colors.text },
  bodySmall: { ...theme.typography.sm, color: theme.colors.textMuted, marginBottom: theme.space.sm },
  quote: {
    ...theme.typography.sm,
    color: theme.colors.text,
    marginTop: theme.space.sm,
    fontStyle: "italic",
  },
  admin: { ...theme.typography.sm, color: theme.colors.accent, marginTop: theme.space.sm },
  thumbGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm },
  thumbBox: { width: 88, height: 88, borderRadius: theme.radius.md, overflow: "hidden" },
  thumbImg: { width: "100%", height: "100%" },
  thumbPh: {
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    minHeight: 100,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.space.sm,
    color: theme.colors.text,
    ...theme.typography.body,
    marginBottom: theme.space.sm,
  },
  attachLabel: {
    ...theme.typography.xs,
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "800",
    marginBottom: 4,
  },
  attachHint: {
    ...theme.typography.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.space.sm,
  },
  pickBtn: { marginBottom: theme.space.sm },
  queue: { gap: theme.space.sm, marginBottom: theme.space.md },
  queueRow: { flexDirection: "row", gap: theme.space.sm, alignItems: "center" },
  mini: { width: 48, height: 48, borderRadius: theme.radius.sm },
  queueMid: { flex: 1 },
  queueName: { ...theme.typography.sm, color: theme.colors.text },
  queueActions: { flexDirection: "row", gap: theme.space.md, marginTop: 4 },
  progressBox: { marginBottom: theme.space.md },
  progressTxt: { ...theme.typography.xs, color: theme.colors.textMuted, marginBottom: 4 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.1)" },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: theme.colors.accent },
  err: { color: theme.colors.danger, marginBottom: theme.space.sm },
  block: { ...theme.typography.body, color: theme.colors.textMuted },
  detailPad: { paddingHorizontal: theme.space.md },
});
