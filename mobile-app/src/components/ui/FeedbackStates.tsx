import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SteamCard } from "./SteamCard";
import { Button } from "./Button";
import { theme } from "../../theme";

type ErrorStateProps = {
  message: string;
  title?: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function ErrorState({ message, title = "Не удалось загрузить", onRetry, style }: ErrorStateProps) {
  return (
    <SteamCard style={[styles.wrap, style]}>
      <View style={styles.iconRow}>
        <Ionicons name="warning-outline" size={28} color={theme.colors.danger} accessibilityLabel="" />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{message}</Text>
      {onRetry ? (
        <Button variant="ghost" compact onPress={onRetry} style={styles.btn}>
          Повторить
        </Button>
      ) : null}
    </SteamCard>
  );
}

type EmptyStateProps = {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({ title, subtitle, icon = "file-tray-outline", style }: EmptyStateProps) {
  return (
    <SteamCard style={[styles.wrapEmpty, style]}>
      <Ionicons name={icon} size={40} color={theme.colors.textMuted} importantForAccessibility="no" />
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.body}>{subtitle}</Text> : null}
    </SteamCard>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: theme.space.sm,
    alignItems: "center",
  },
  iconRow: { marginBottom: theme.space.xs },
  title: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text,
    textAlign: "center",
  },
  body: {
    ...theme.typography.sm,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
  btn: { alignSelf: "stretch", marginTop: theme.space.sm },
  wrapEmpty: {
    gap: theme.space.sm,
    alignItems: "center",
    paddingVertical: theme.space.lg,
    borderStyle: "dashed",
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyTitle: {
    ...theme.typography.bodyStrong,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
});
