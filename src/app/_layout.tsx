import "@/theme/global.css";
import { AuthProvider } from "@/context/auth-context";
import { AppLockProvider } from "@/context/app-lock-context";
import { ThemeProvider } from "@/context/theme-context";
import { CurrencyProvider } from "@/context/currency-context";
import { OfflineProvider } from "@/context/offline-context";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { AppStateProvider } from "@/state/app-state-context";
import { Stack } from "expo-router";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View } from "react-native";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <CurrencyProvider>
          <OfflineProvider>
            <AppLockProvider>
              <AuthProvider>
                <AppStateProvider>
                  <View style={{ flex: 1 }}>
                    <Stack
                      initialRouteName="onboarding"
                      screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="onboarding" />
                      <Stack.Screen name="index" />
                      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    </Stack>
                    {/* Global offline status banner, rendered above all screens */}
                    <OfflineBanner />
                  </View>
                </AppStateProvider>
              </AuthProvider>
            </AppLockProvider>
          </OfflineProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
