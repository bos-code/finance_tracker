import "@/theme/global.css";
import { AuthProvider } from "@/context/auth-context";
import { ThemeProvider } from "@/context/theme-context";
import { AppStateProvider } from "@/state/app-state-context";
import { Stack } from "expo-router";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
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
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
