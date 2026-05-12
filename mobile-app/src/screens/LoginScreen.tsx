import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { loginRequest } from "../api/auth";
import { ApiError } from "../api/http";
import { AppBackground, Button, ScreenHeader, SteamCard } from "../components";
import { useAuthStore } from "../store/authStore";
import { theme } from "../theme";
import type { RootStackParamList } from "../navigation/types";

export function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const setSession = useAuthStore((s) => s.setSession);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      const res = await loginRequest({
        login: login.trim(),
        password,
        rememberMe: true,
      });
      const u = res.user as { publicId?: string | number };
      await setSession(res.token, { ...res.user, publicId: String(u.publicId ?? "") }, true);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Не удалось войти";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppBackground>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <LinearGradient
          colors={["rgba(102,192,244,0.35)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.2 }}
          style={styles.topAccent}
        />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inner}>
            <ScreenHeader
              title="Вход"
              subtitle="Те же учётные данные, что на сайте. Сессия до 30 дней при «Запомнить» на бэкенде."
              large
            />
            <SteamCard emphasized>
              <Text style={styles.hint}>Логин: email, @telegram или ник.</Text>
              <TextInput
                style={styles.input}
                placeholder="Логин"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                value={login}
                onChangeText={setLogin}
                returnKeyType="next"
              />
              <TextInput
                style={[styles.input, styles.inputGap]}
                placeholder="Пароль"
                placeholderTextColor={theme.colors.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                returnKeyType="go"
                onSubmitEditing={() => void onSubmit()}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button loading={busy} onPress={() => void onSubmit()} style={styles.submit}>
                Войти
              </Button>
            </SteamCard>
            <Pressable onPress={() => navigation.navigate("Register")} style={styles.registerLink}>
              <Text style={styles.registerLinkTxt}>Регистрация</Text>
            </Pressable>
            <Text style={styles.footer}>
              Регистрация с подтверждением в Telegram. Токен хранится в защищённом хранилище устройства.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topAccent: {
    height: 3,
    opacity: 0.95,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: theme.space.md,
    paddingBottom: theme.space.xxl,
    paddingTop: theme.space.lg,
  },
  inner: { gap: theme.space.md },
  hint: { ...theme.typography.sm, color: theme.colors.textMuted, marginBottom: theme.space.md },
  input: {
    backgroundColor: "rgba(0,0,0,0.22)",
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm + 2,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.typography.body,
  },
  inputGap: { marginTop: theme.space.sm },
  error: { ...theme.typography.sm, color: theme.colors.danger, marginTop: theme.space.sm },
  submit: { marginTop: theme.space.md },
  registerLink: { alignItems: "center", paddingVertical: theme.space.sm },
  registerLinkTxt: { ...theme.typography.sm, color: theme.colors.accent, fontWeight: "800" },
  footer: {
    ...theme.typography.xs,
    color: theme.colors.textMuted,
    textAlign: "center",
    fontWeight: "500",
    lineHeight: 16,
    paddingHorizontal: theme.space.sm,
  },
});
