import "@/theme/global.css";
import { AuthProvider } from "@/context/auth-context";
import { AppLockProvider } from "@/context/app-lock-context";
import { ThemeProvider } from "@/context/theme-context";
import { CurrencyProvider } from "@/context/currency-context";
import { AppStateProvider } from "@/state/app-state-context";
import { Stack } from "expo-router";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <CurrencyProvider>
          <AppLockProvider>
            <AuthProvider>
              <AppStateProvider>
                <Stack
                  initialRouteName="onboarding"
                  screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="onboarding" />
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                </Stack>
              </AppStateProvider>
            </AuthProvider>
          </AppLockProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
