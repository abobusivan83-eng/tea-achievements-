import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import type { PropsWithChildren, ReactNode } from "react";
import { getApiBaseUrl } from "../../services/env";
import { theme } from "../../theme";
import { AppBackground } from "./AppBackground";

type Props = PropsWithChildren<{
  fallback?: ReactNode;
}>;

/**
 * В release сборке приложение недолжно молча падать без EXPO_PUBLIC_API_BASE_URL —
 * здесь же проверяем отсутствие конфигурации API до навигации.
 */
export function ApiReleaseGate({ children, fallback }: Props) {
  const [releaseError] = useState<string | null>(() => {
    if (__DEV__) return null;
    try {
      getApiBaseUrl();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  });

  if (releaseError != null) {
    if (fallback) return fallback;
    return (
      <AppBackground>
        <ScrollView contentContainerStyle={styles.box}>
          <Text style={styles.title}>Не настроен API</Text>
          <Text style={styles.body}>{releaseError}</Text>
          <Text style={styles.hint}>
            Для сборки APK задайте EXPO_PUBLIC_API_BASE_URL в переменных EAS Build (или .env перед eas build /
            секретами CI).
          </Text>
        </ScrollView>
      </AppBackground>
    );
  }

  return children as React.ReactElement | null;
}

const styles = StyleSheet.create({
  box: {
    flexGrow: 1,
    padding: theme.space.lg,
    justifyContent: "center",
    paddingTop: theme.space.xl * 2,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.danger,
    marginBottom: theme.space.md,
    textAlign: "center",
  },
  body: {
    ...theme.typography.sm,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginBottom: theme.space.lg,
  },
  hint: {
    ...theme.typography.sm,
    color: theme.colors.text,
    opacity: 0.85,
  },
});
