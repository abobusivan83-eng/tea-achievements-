import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../theme";
import { AppBackground } from "./AppBackground";

type Props = PropsWithChildren<{
  /** Обойти SafeArea (например уже внутри другого контейнера) */
  unsafe?: boolean;
  /** Скролл по вертикали */
  scroll?: boolean;
  scrollProps?: Omit<ScrollViewProps, "children" | "style" | "contentContainerStyle">;
  contentStyle?: ViewStyle;
  /** Доп. отступ снизу под прокручиваемый tab bar */
  bottomInset?: number;
}>;

export function AppScreen({
  children,
  unsafe,
  scroll,
  scrollProps,
  contentStyle,
  bottomInset = 0,
}: Props) {
  const pad = {
    paddingHorizontal: theme.space.md,
    paddingTop: theme.space.xs,
    /** Таб-бар уже вне области экрана; `bottomInset` — только мягкий внутренний отступ. */
    paddingBottom: bottomInset,
  };

  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, pad, contentStyle]}
      {...scrollProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, pad, contentStyle]}>{children}</View>
  );

  if (unsafe) {
    return <AppBackground>{body}</AppBackground>;
  }

  return (
    <AppBackground>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        {body}
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
  scrollContent: { flexGrow: 1 },
});
