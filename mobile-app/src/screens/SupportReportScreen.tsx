import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppScreen, Button, ScreenHeader } from "../components";
import { createSupportReport, uploadSupportReportImages, type SupportEvidencePick } from "../api/supportForms";
import { fetchLeaderboard } from "../api/leaderboard";
import { leaderboardKey } from "../lib/queryKeys";
import { useAuthStore } from "../store/authStore";
import { useTabBarInset } from "../hooks/useTabBarInset";
import { useToast } from "../providers/ToastProvider";
import { theme } from "../theme";

const REASONS: { id: "spam" | "insult" | "cheat" | "other"; label: string }[] = [
  { id: "spam", label: "Спам" },
  { id: "insult", label: "Оскорбления" },
  { id: "cheat", label: "Нарушения / чит" },
  { id: "other", label: "Другое" },
];

const MAX_FILES = 8;

export function SupportReportScreen() {
  const bottom = useTabBarInset();
  const navigation = useNavigation();
  const { showToast } = useToast();
  const selfId = useAuthStore((s) => s.user?.id);

  const lbQ = useQuery({ queryKey: leaderboardKey, queryFn: fetchLeaderboard, staleTime: 60_000 });
  const candidates = useMemo(() => (lbQ.data ?? []).filter((r) => r.id !== selfId), [lbQ.data, selfId]);

  const [reportedId, setReportedId] = useState("");
  const [reason, setReason] = useState<"spam" | "insult" | "cheat" | "other">("spam");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<SupportEvidencePick[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (reportedId) return;
    const rows = lbQ.data ?? [];
    const first = rows.find((r) => r.id !== selfId);
    if (first) setReportedId(first.id);
  }, [lbQ.data, selfId, reportedId]);

  const pick = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Доступ", "Разрешите доступ к галерее.");
      return;
    }
    const left = MAX_FILES - files.length;
    if (left <= 0) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: left,
      quality: 0.85,
    });
    if (res.canceled || !res.assets?.length) return;
    const next: SupportEvidencePick[] = res.assets.map((a) => ({
      uri: a.uri,
      name: a.fileName ?? "image.jpg",
      type: a.mimeType ?? "image/jpeg",
    }));
    setFiles((p) => [...p, ...next].slice(0, MAX_FILES));
  }, [files.length]);

  const submit = async () => {
    if (!reportedId) {
      Alert.alert("Пользователь", "Выберите участника из рейтинга.");
      return;
    }
    const d = description.trim();
    if (d.length < 10 || d.length > 2000) {
      Alert.alert("Описание", "От 10 до 2000 символов.");
      return;
    }
    setBusy(true);
    try {
      const created = await createSupportReport({ reportedId, reason, description: d });
      if (files.length) await uploadSupportReportImages(created.id, files);
      showToast({ message: "Жалоба отправлена.", tone: "success" });
      navigation.goBack();
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось отправить");
    } finally {
      setBusy(false);
    }
  };

  const back = (
    <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backHit}>
      <Text style={styles.backTxt}>‹</Text>
    </Pressable>
  );

  return (
    <AppScreen scroll bottomInset={bottom}>
      <ScreenHeader title="Жалоба" left={back} subtitle="На участника клана" />
      <Text style={styles.hint}>Участник выбирается из таблицы рейтинга (как на сайте).</Text>
      <Text style={styles.label}>На кого</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.usersRow}>
        {candidates.map((u) => (
          <Pressable
            key={u.id}
            onPress={() => setReportedId(u.id)}
            style={[styles.userChip, reportedId === u.id && styles.userChipOn]}
          >
            <Text style={[styles.userChipTxt, reportedId === u.id && styles.userChipTxtOn]} numberOfLines={1}>
              {u.nickname}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {candidates.length === 0 ? <Text style={styles.warn}>Нет других участников в рейтинге.</Text> : null}

      <Text style={styles.label}>Причина</Text>
      <View style={styles.reasonRow}>
        {REASONS.map((r) => (
          <Pressable key={r.id} onPress={() => setReason(r.id)} style={[styles.reasonChip, reason === r.id && styles.reasonChipOn]}>
            <Text style={[styles.reasonTxt, reason === r.id && styles.reasonTxtOn]}>{r.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Описание</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Подробности (минимум 10 символов)"
        placeholderTextColor={theme.colors.textMuted}
        multiline
        style={[styles.input, styles.area]}
      />

      <Button variant="ghost" onPress={() => void pick()} style={styles.attachBtn}>
        <View style={styles.attachRow}>
          <Ionicons name="images-outline" size={20} color={theme.colors.accent} />
          <Text style={styles.attachTxt}>Прикрепить скриншоты ({files.length}/{MAX_FILES})</Text>
        </View>
      </Button>
      {files.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
          {files.map((f, i) => (
            <View key={`${f.uri}-${i}`} style={styles.thumbWrap}>
              <Image source={{ uri: f.uri }} style={styles.thumb} contentFit="cover" />
              <Pressable style={styles.rm} onPress={() => setFiles((p) => p.filter((_, j) => j !== i))}>
                <Ionicons name="close-circle" size={22} color={theme.colors.danger} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <Button loading={busy} onPress={() => void submit()} disabled={!reportedId}>
        Отправить жалобу
      </Button>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  backHit: { width: 36, height: 36, justifyContent: "center" },
  backTxt: { fontSize: 28, color: theme.colors.accent, fontWeight: "300", marginTop: -4 },
  hint: { ...theme.typography.sm, color: theme.colors.textMuted, marginBottom: theme.space.md },
  label: { ...theme.typography.xs, color: theme.colors.textMuted, marginBottom: 4, fontWeight: "700", marginTop: theme.space.sm },
  usersRow: { flexDirection: "row", gap: theme.space.xs, marginBottom: theme.space.sm },
  userChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    maxWidth: 160,
    backgroundColor: theme.colors.surface,
  },
  userChipOn: { borderColor: theme.colors.accent, backgroundColor: "rgba(88,166,255,0.12)" },
  userChipTxt: { ...theme.typography.sm, color: theme.colors.textMuted, fontWeight: "700" },
  userChipTxtOn: { color: theme.colors.text },
  warn: { ...theme.typography.sm, color: theme.colors.steamGold, marginBottom: theme.space.sm },
  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.xs, marginBottom: theme.space.sm },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  reasonChipOn: { borderColor: theme.colors.accent, backgroundColor: "rgba(88,166,255,0.12)" },
  reasonTxt: { ...theme.typography.xs, color: theme.colors.textMuted, fontWeight: "700" },
  reasonTxtOn: { color: theme.colors.text },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.space.sm,
    color: theme.colors.text,
    marginBottom: theme.space.sm,
    backgroundColor: theme.colors.surface,
  },
  area: { minHeight: 120, textAlignVertical: "top" },
  attachBtn: { marginBottom: theme.space.sm },
  attachRow: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },
  attachTxt: { ...theme.typography.sm, color: theme.colors.accent, fontWeight: "700" },
  thumbs: { gap: theme.space.sm, marginBottom: theme.space.md },
  thumbWrap: { position: "relative" },
  thumb: { width: 72, height: 72, borderRadius: theme.radius.md },
  rm: { position: "absolute", top: -6, right: -6 },
});
