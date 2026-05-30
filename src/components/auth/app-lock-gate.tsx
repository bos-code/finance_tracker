import { useAppLock } from "@/context/app-lock-context";
import { useAuth } from "@/hooks/use-auth";
import { useAppStore } from "@/store/use-app-store";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { AppLockScreen } from "./app-lock-screen";

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const theme = useAppStore((s) => s.theme);
  const { enabled, isReady, locked } = useAppLock();

  if (user && !isReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (user && enabled && locked) {
    return <AppLockScreen />;
  }

  return <>{children}</>;
}
