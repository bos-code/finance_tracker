import { useAppLock } from "@/context/app-lock-context";
import { useAuth } from "@/hooks/use-auth";
import { useAppStore } from "@/store/use-app-store";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { AppLockScreen } from "./app-lock-screen";

/**
 * Renders a gate that enforces the app lock and shows a themed loading state while lock readiness is determined.
 *
 * @param children - Content to render when no authenticated user is present or when the app is not locked
 * @returns A React node that shows a centered, themed loading indicator while the lock state initializes, the app lock screen when the authenticated user's app is locked, or the provided `children` otherwise.
 */
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
