import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./storageKeys";

const SECURE_TOKEN_KEY = "auth_jwt_v1";

/**
 * JWT только в защищённом хранилище (Keychain / EncryptedSharedPreferences).
 * Старые установки: одноразовая миграция из AsyncStorage.
 */
export async function loadPersistedToken(): Promise<string | null> {
  try {
    const fromSecure = await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
    if (fromSecure) return fromSecure;

    const legacy = await AsyncStorage.getItem(STORAGE_KEYS.authToken);
    if (legacy) {
      await SecureStore.setItemAsync(SECURE_TOKEN_KEY, legacy, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      await AsyncStorage.removeItem(STORAGE_KEYS.authToken);
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

export async function persistTokenSecure(token: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await AsyncStorage.removeItem(STORAGE_KEYS.authToken);
}

export async function wipeSecureToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY);
  } catch {
    /* уже удалён */
  }
  await AsyncStorage.removeItem(STORAGE_KEYS.authToken);
}
