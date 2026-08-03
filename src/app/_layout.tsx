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
import "@/theme/global.css";

const queryClient = new QueryClient();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <OfflineProvider>
              <AppLockProvider>
                <AppLockGate>
                  <View style={{ flex: 1 }}>
                    <StatusBar style="light" />
                    <Stack
                      initialRouteName="onboarding"
                      screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="onboarding" />
                      <Stack.Screen name="index" />
                      <Stack.Screen
                        name="(tabs)"
                        options={{ headerShown: false }}
                      />
                    </Stack>
                    <OfflineBanner />
                  </View>
                </AppLockGate>
              </AppLockProvider>
            </OfflineProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
