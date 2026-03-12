import { AuthGate } from "@/components/auth/auth-gate";
import React, { PropsWithChildren } from "react";

/**
 * ProtectedRoute now delegates to AuthGate with `protected` mode.
 * Kept as a thin wrapper so existing usage in (tabs)/_layout.tsx compiles
 * without changes, but all logic lives in AuthGate.
 */
export function ProtectedRoute({ children }: PropsWithChildren) {
  return <AuthGate protected>{children}</AuthGate>;
}
