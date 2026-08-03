import { useAppLock } from "@/context/app-lock-context";
import { useAuth } from "@/hooks/use-auth";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { AppLockScreen } from "./app-lock-screen";
import { palette } from "@/theme/colors";
import { SignalThreads } from "@/components/visuals/signal-threads";

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { enabled, isReady, locked } = useAppLock();

  if (user && !isReady) {
    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: palette.canvas,
          flex: 1,
          justifyContent: "center",
        }}>
        <SignalThreads intensity="quiet" />
        <ActivityIndicator color={palette.textMuted} size="large" />
      </View>
    );
  }

  if (user && enabled && locked) {
    return <AppLockScreen />;
  }

  return <>{children}</>;
}
