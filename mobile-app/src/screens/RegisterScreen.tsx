import { useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
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
import { registerRequest, registerVerify } from "../api/auth";
import { ApiError } from "../api/http";
import { AppBackground, Button, ScreenHeader, SteamCard } from "../components";
import { useAuthStore } from "../store/authStore";
import { theme } from "../theme";
import type { RootStackParamList } from "../navigation/types";

export function RegisterScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const setSession = useAuthStore((s) => s.setSession);

  const [step, setStep] = useState<"form" | "code">("form");
  const [nickname, setNickname] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [linkToken, setLinkToken] = useState("");
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [activationNeeded, setActivationNeeded] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitForm() {
    setError(null);
    setBusy(true);
    try {
      const resp = await registerRequest({
        nickname: nickname.trim(),
        password,
        telegramUsername: telegramUsername.trim().replace(/^@/, ""),
      });
      setLinkToken(resp.linkToken);
      setDeepLink(resp.deepLink);
      setCodeSent(resp.codeSent);
      setActivationNeeded(resp.activationNeeded ?? !resp.codeSent);
      setCode("");
      setStep("code");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка регистрации");
    } finally {
      setBusy(false);
    }
  }

  async function submitVerify() {
    setError(null);
    if (code.trim().length !== 4) {
      setError("Введите 4 цифры кода из Telegram.");
      return;
    }
    setBusy(true);
    try {
      const res = await registerVerify({
        linkToken,
        code: code.trim(),
        rememberMe,
      });
      const u = res.user as { publicId?: string | number };
      await setSession(res.token, { ...res.user, publicId: String(u.publicId ?? "") }, rememberMe);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Неверный код или сессия истекла");
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
              title="Регистрация"
              subtitle="Как на сайте: привязка к Telegram и код из бота."
              large
            />
            <Pressable onPress={() => navigation.navigate("Login")} style={styles.backLink}>
              <Text style={styles.backLinkTxt}>Уже есть аккаунт — войти</Text>
            </Pressable>

            {step === "form" ? (
              <SteamCard emphasized>
                <Text style={styles.hint}>
                  Ник в Telegram: 5–32 символа, латиница, цифры и подчёркивание (как в t.me/username).
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Никнейм на сайте"
                  placeholderTextColor={theme.colors.textMuted}
                  value={nickname}
                  onChangeText={setNickname}
                  autoCapitalize="none"
                  maxLength={24}
                />
                <TextInput
                  style={[styles.input, styles.inputGap]}
                  placeholder="Telegram (без @)"
                  placeholderTextColor={theme.colors.textMuted}
                  value={telegramUsername}
                  onChangeText={setTelegramUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextInput
                  style={[styles.input, styles.inputGap]}
                  placeholder="Пароль (от 6 символов)"
                  placeholderTextColor={theme.colors.textMuted}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable style={styles.remRow} onPress={() => setRememberMe((v) => !v)}>
                  <View style={[styles.checkbox, rememberMe && styles.checkboxOn]} />
                  <Text style={styles.remTxt}>Запомнить сессию</Text>
                </Pressable>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Button loading={busy} onPress={() => void submitForm()} style={styles.submit}>
                  Продолжить
                </Button>
              </SteamCard>
            ) : (
              <SteamCard emphasized>
                <Text style={styles.hint}>
                  {activationNeeded && !codeSent
                    ? "Откройте бота в Telegram, нажмите Start, затем снова «Продолжить» на шаге формы или дождитесь кода."
                    : codeSent
                      ? "Код отправлен в Telegram. Введите 4 цифры ниже."
                      : "Следуйте инструкциям бота и введите код, когда придёт."}
                </Text>
                {deepLink ? (
                  <Button
                    variant="ghost"
                    onPress={() => void Linking.openURL(deepLink)}
                    style={styles.submit}
                  >
                    Открыть бота в Telegram
                  </Button>
                ) : null}
                <TextInput
                  style={styles.input}
                  placeholder="Код из 4 цифр"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={code}
                  onChangeText={setCode}
                />
                <Pressable style={styles.remRow} onPress={() => setRememberMe((v) => !v)}>
                  <View style={[styles.checkbox, rememberMe && styles.checkboxOn]} />
                  <Text style={styles.remTxt}>Запомнить сессию</Text>
                </Pressable>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Button loading={busy} onPress={() => void submitVerify()} style={styles.submit}>
                  Завершить регистрацию
                </Button>
                <Button variant="ghost" onPress={() => setStep("form")} disabled={busy}>
                  Назад к форме
                </Button>
              </SteamCard>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topAccent: { height: 3, opacity: 0.95 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: theme.space.md,
    paddingBottom: theme.space.xxl,
    paddingTop: theme.space.lg,
  },
  inner: { gap: theme.space.md },
  backLink: { alignSelf: "flex-start", marginBottom: -theme.space.xs },
  backLinkTxt: { ...theme.typography.sm, color: theme.colors.accent, fontWeight: "700" },
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
  remRow: { flexDirection: "row", alignItems: "center", gap: theme.space.sm, marginTop: theme.space.md },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  checkboxOn: { borderColor: theme.colors.accent, backgroundColor: "rgba(88,166,255,0.25)" },
  remTxt: { ...theme.typography.sm, color: theme.colors.text, fontWeight: "600" },
  error: { ...theme.typography.sm, color: theme.colors.danger, marginTop: theme.space.sm },
  submit: { marginTop: theme.space.md },
});
