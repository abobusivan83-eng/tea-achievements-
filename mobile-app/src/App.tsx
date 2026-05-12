import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import Ionicons from "@expo/vector-icons/Ionicons";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { enableScreens } from "react-native-screens";
import { ApiReleaseGate } from "./components/layout/ApiReleaseGate";
import { RootNavigator } from "./navigation/RootNavigator";
import { useSessionBootstrap } from "./hooks/useSessionBootstrap";
import { pingBackendHealth } from "./services/backendWake";
import { AuthProvider } from "./providers/AuthProvider";
import { ToastProvider } from "./providers/ToastProvider";
import { subscribeAuthCleared } from "./services/authEvents";

enableScreens(true);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 45_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      structuralSharing: true,
    },
    mutations: { retry: 0 },
  },
});

function QueryCacheOnLogout() {
  const qc = useQueryClient();
  useEffect(() => subscribeAuthCleared(() => qc.clear()), [qc]);
  return null;
}

function AppInner() {
  useSessionBootstrap();

  useEffect(() => {
    void Ionicons.loadFont();
  }, []);

  useEffect(() => {
    void pingBackendHealth();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ApiReleaseGate>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <AuthProvider>
                <QueryCacheOnLogout />
                <AppInner />
              </AuthProvider>
            </ToastProvider>
          </QueryClientProvider>
        </ApiReleaseGate>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
