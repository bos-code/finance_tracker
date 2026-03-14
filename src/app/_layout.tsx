import { AuthProvider } from "@/context/auth-context";
import { AppLockProvider } from "@/context/app-lock-context";
import { AppLockGate } from "@/components/auth/app-lock-gate";
import { OfflineProvider } from "@/context/offline-context";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View } from "react-native";
import "@/theme/global.css";

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <OfflineProvider>
          <AuthProvider>
            <AppLockProvider>
              <AppLockGate>
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
                </AppLockGate>
              </AppLockProvider>
            </AuthProvider>
          </OfflineProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
