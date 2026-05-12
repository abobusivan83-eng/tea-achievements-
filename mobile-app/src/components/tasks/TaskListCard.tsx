import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SteamCard } from "../ui/SteamCard";
import { theme } from "../../theme";
import type { TaskItem } from "../../types/tasks";
import { rarityAccent } from "../../lib/rarityTheme";
import { scheduleLabel, taskScheduleStatus } from "../../lib/taskUtils";

type Props = {
  task: TaskItem;
  nowMs: number;
  onOpenTask: () => void;
  onOpenAchievement?: () => void;
};

export const TaskListCard = memo(function TaskListCard({ task, nowMs, onOpenTask, onOpenAchievement }: Props) {
  const r = task.achievement?.rarity;
  const accent = rarityAccent(r);
  const sched = taskScheduleStatus(task, nowMs);
  const badge = scheduleLabel(task, nowMs);
  const xp = task.achievement?.points;
  const coins = task.rewardCoins;
  const hasAch = Boolean(task.achievement);

  return (
    <SteamCard style={[styles.card, { borderColor: accent.border }]}>
      <View style={styles.row}>
        {task.achievement?.iconUrl ? (
          <Image
            source={{ uri: task.achievement.iconUrl }}
            style={styles.icon}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={task.achievement.id}
            transition={180}
          />
        ) : (
          <View style={[styles.icon, styles.iconPh]} />
        )}
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {task.title}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <View style={[styles.badge, sched === "ACTIVE" && styles.badgeOk, sched === "EXPIRED" && styles.badgeOff]}>
              <Text style={styles.badgeTxt}>{badge}</Text>
            </View>
            {xp != null ? (
              <Text style={styles.reward} numberOfLines={1}>
                +{xp} XP{coins ? ` · ${coins} мон.` : ""}
              </Text>
            ) : coins ? (
              <Text style={styles.reward} numberOfLines={1}>
                +{coins} мон.
              </Text>
            ) : null}
          </View>
          <View style={styles.actions}>
            <Pressable onPress={onOpenTask} style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}>
              <Ionicons name="document-text-outline" size={14} color={theme.colors.accent} />
              <Text style={styles.btnTxt} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                Посмотреть задание
              </Text>
            </Pressable>
            {hasAch && onOpenAchievement ? (
              <Pressable onPress={onOpenAchievement} style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}>
                <Ionicons name="ribbon-outline" size={14} color={theme.colors.steamGold} />
                <Text style={[styles.btnTxt, styles.btnTxtGold]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                  Посмотреть достижение
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </SteamCard>
  );
});

const styles = StyleSheet.create({
  card: { marginBottom: theme.space.sm },
  row: { flexDirection: "row", gap: theme.space.sm, alignItems: "flex-start" },
  icon: { width: 48, height: 48, borderRadius: theme.radius.md, backgroundColor: "rgba(0,0,0,0.2)" },
  iconPh: { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  title: { ...theme.typography.bodyStrong, color: theme.colors.text, flex: 1, fontSize: 15 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  badgeOk: { backgroundColor: "rgba(102,192,244,0.16)" },
  badgeOff: { backgroundColor: "rgba(248,81,73,0.12)" },
  badgeTxt: { ...theme.typography.xs, fontSize: 10, fontWeight: "800", color: theme.colors.text },
  reward: { ...theme.typography.xs, color: theme.colors.success, fontWeight: "700", flexShrink: 1 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  btn: {
    flex: 1,
    minWidth: "46%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: theme.radius.full,
    backgroundColor: "rgba(102,192,244,0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(102,192,244,0.28)",
  },
  btnPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  btnTxt: { ...theme.typography.xs, color: theme.colors.accent, fontWeight: "800" },
  btnTxtGold: { color: theme.colors.steamGold },
});
