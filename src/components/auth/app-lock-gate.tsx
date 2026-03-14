import { useAppLock } from "@/context/app-lock-context";
import { useAuth } from "@/hooks/use-auth";
import React, { PropsWithChildren } from "react";
import { AppLockScreen } from "./app-lock-screen";

export function AppLockGate({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const { enabled, locked } = useAppLock();

  if (user && enabled && locked) {
    return <AppLockScreen />;
  }

  return <>{children}</>;
}
