import { AuthProvider } from "@/context/auth-context";
import { AppLockProvider } from "@/context/app-lock-context";
import { AppLockGate } from "@/components/auth/app-lock-gate";
import { OfflineProvider } from "@/context/offline-context";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { WorkspaceProvider } from "@/context/workspace-context";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useAppearanceHydrated } from "@/store/use-appearance-store";
import { ThemeProvider, useTheme } from "@/theme/theme-context";
import "@/theme/global.css";

const queryClient = new QueryClient();

function ThemedShell() {
  const { isDark, palette } = useTheme();

  return (
    <View style={{ backgroundColor: palette.canvas, flex: 1 }}>
      {/* Light icons on dark themes, dark icons on the light theme. */}
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        initialRouteName="onboarding"
        screenOptions={{
          animation: "fade",
          contentStyle: { backgroundColor: palette.canvas },
          headerShown: false,
        }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <OfflineBanner />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    AtkinsonHyperlegible: require("../assets/fonts/AtkinsonHyperlegible-Regular.ttf"),
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  // Wait for the saved theme so the first frame is never the wrong colour.
  const appearanceReady = useAppearanceHydrated();

  if (!fontsLoaded || !appearanceReady) return null;

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <AuthProvider>
            <WorkspaceProvider>
              <OfflineProvider>
                <AppLockProvider>
                  <AppLockGate>
                    <ThemedShell />
                  </AppLockGate>
                </AppLockProvider>
              </OfflineProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
