import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Button } from "../ui/Button";
import { theme } from "../../theme";
import { rarityAccent } from "../../lib/rarityTheme";
import type { Rarity } from "../../types/tasks";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  description: string;
  rarity: Rarity | string;
  points: number;
  iconUrl: string | null;
  earned?: boolean;
  awardedAt?: string | null;
};

export function AchievementDetailSheet({
  visible,
  onClose,
  title,
  description,
  rarity,
  points,
  iconUrl,
  earned,
  awardedAt,
}: Props) {
  const acc = rarityAccent(rarity as Rarity);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={["rgba(27,40,56,0.98)", "rgba(13,17,23,0.99)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.grab} />
          <View
            style={[
              styles.iconRing,
              {
                borderColor: acc.border,
                shadowColor: acc.label,
                shadowOpacity: 0.4,
              },
            ]}
          >
            {iconUrl ? (
              <Image source={{ uri: iconUrl }} style={styles.icon} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <View style={[styles.icon, styles.iconPh]} />
            )}
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={[styles.rarity, { color: acc.label }]}>
            {String(rarity)} · +{points} XP
          </Text>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.desc}>{description || "—"}</Text>
            {earned && awardedAt ? (
              <Text style={styles.date}>Получено: {new Date(awardedAt).toLocaleString("ru-RU")}</Text>
            ) : !earned ? (
              <Text style={styles.locked}>Ещё не открыто</Text>
            ) : null}
          </ScrollView>
          <Button variant="primary" onPress={onClose}>
            Закрыть
          </Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(1,4,9,0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "78%",
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(102,192,244,0.25)",
    padding: theme.space.lg,
    paddingBottom: theme.space.xl,
    overflow: "hidden",
  },
  grab: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginBottom: theme.space.md,
  },
  iconRing: {
    alignSelf: "center",
    padding: 3,
    borderRadius: theme.radius.lg,
    borderWidth: 2,
    marginBottom: theme.space.sm,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
    elevation: 8,
  },
  icon: { width: 88, height: 88, borderRadius: theme.radius.md },
  iconPh: { backgroundColor: "rgba(0,0,0,0.3)" },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
    textAlign: "center",
  },
  rarity: {
    ...theme.typography.sm,
    textAlign: "center",
    marginTop: 6,
    fontWeight: "700",
  },
  scroll: { maxHeight: 220, marginVertical: theme.space.md },
  desc: { ...theme.typography.body, color: theme.colors.textMuted },
  date: { ...theme.typography.sm, color: theme.colors.success, marginTop: theme.space.sm },
  locked: { ...theme.typography.sm, color: theme.colors.textMuted, marginTop: theme.space.sm, fontStyle: "italic" },
});
