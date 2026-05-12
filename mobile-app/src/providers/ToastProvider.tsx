import { createContext, useCallback, useContext, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";

export type ToastTone = "info" | "success" | "error";

type ShowToastInput =
  | string
  | {
      message: string;
      tone?: ToastTone;
      durationMs?: number;
    };

type ToastContextValue = {
  showToast: (input: ShowToastInput, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  return ctx ?? { showToast: () => {} };
}

export function ToastProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -8, duration: 160, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [opacity, translateY]);

  const showToast = useCallback(
    (input: ShowToastInput, toneFallback: ToastTone = "info") => {
      const message = typeof input === "string" ? input : input.message;
      const tone = typeof input === "string" ? toneFallback : (input.tone ?? toneFallback);
      const durationMs = typeof input === "string" ? 2800 : (input.durationMs ?? 2800);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setToast({ message, tone });
      opacity.setValue(0);
      translateY.setValue(-12);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 7, tension: 80 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      hideTimer.current = setTimeout(hide, durationMs);
    },
    [hide, opacity, translateY],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  const bg =
    toast?.tone === "error"
      ? "rgba(201,42,42,0.92)"
      : toast?.tone === "success"
        ? "rgba(34,139,94,0.92)"
        : "rgba(40,54,71,0.95)";

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.overlay, { paddingTop: insets.top + 8 }, { opacity, transform: [{ translateY }] }]}
        >
          <Pressable onPress={hide}>
            <View style={[styles.bubble, { borderColor: theme.colors.border, backgroundColor: bg }]}>
              <Text style={styles.text}>{toast.message}</Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    zIndex: 9999,
  },
  bubble: {
    maxWidth: "92%",
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    ...theme.typography.sm,
    color: theme.colors.text,
    fontWeight: "600",
    textAlign: "center",
  },
});
