import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppScreen, Button, ScreenHeader } from "../components";
import { createSupportSuggestion, uploadSupportSuggestionImages, type SupportEvidencePick } from "../api/supportForms";
import { useTabBarInset } from "../hooks/useTabBarInset";
import { useToast } from "../providers/ToastProvider";
import { theme } from "../theme";

const MAX_FILES = 8;

export function SupportIdeaScreen() {
  const bottom = useTabBarInset();
  const navigation = useNavigation();
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<SupportEvidencePick[]>([]);
  const [busy, setBusy] = useState(false);

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
    const t = title.trim();
    const d = description.trim();
    if (t.length < 3 || t.length > 80) {
      Alert.alert("Тема", "От 3 до 80 символов.");
      return;
    }
    if (d.length < 10 || d.length > 2000) {
      Alert.alert("Описание", "От 10 до 2000 символов.");
      return;
    }
    setBusy(true);
    try {
      const created = await createSupportSuggestion({ title: t, description: d });
      if (files.length) await uploadSupportSuggestionImages(created.id, files);
      showToast({ message: "Идея отправлена.", tone: "success" });
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
      <ScreenHeader title="Идея" left={back} subtitle="Предложение для клана" />
      <Text style={styles.hint}>Как на сайте: тема и описание; можно прикрепить скриншоты.</Text>
      <Text style={styles.label}>Тема</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Краткая тема предложения"
        placeholderTextColor={theme.colors.textMuted}
        style={styles.input}
        maxLength={80}
      />
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
          <Text style={styles.attachTxt}>Прикрепить изображения ({files.length}/{MAX_FILES})</Text>
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
      <Button loading={busy} onPress={() => void submit()}>
        Отправить идею
      </Button>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  backHit: { width: 36, height: 36, justifyContent: "center" },
  backTxt: { fontSize: 28, color: theme.colors.accent, fontWeight: "300", marginTop: -4 },
  hint: { ...theme.typography.sm, color: theme.colors.textMuted, marginBottom: theme.space.md },
  label: { ...theme.typography.xs, color: theme.colors.textMuted, marginBottom: 4, fontWeight: "700" },
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
