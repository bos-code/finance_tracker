import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/context/theme-context";
import { Redirect } from "expo-router";
import React, { PropsWithChildren } from "react";
import { ActivityIndicator, View } from "react-native";

/**
 * AuthGate — single authoritative component for auth-state-dependent routing.
 *
 * Previously this logic was duplicated between `app/index.tsx` (which redirected
 * signed-in users to tabs) and `ProtectedRoute` (which redirected unauthenticated
 * users to the auth screen). Both rendered their own bootstrap spinner.
 *
 * Now:
 *  - `app/index.tsx` just renders <AuthGate redirect="/(tabs)/home"><AuthScreen/></AuthGate>
 *  - `(tabs)/_layout.tsx` renders <AuthGate protected><BottomTabs/></AuthGate>
 *
 * This keeps one spinner, one redirect decision point, and makes the intent explicit.
 */
interface AuthGateProps extends PropsWithChildren {
  /**
   * When true, this gate protects authenticated-only content.
   * Unauthenticated users are sent to "/".
   */
  protected?: boolean;
  /**
   * When set, authenticated users are redirected to this href
   * and children (the sign-in screen) are skipped.
   */
  redirect?: string;
}

export function AuthGate({ children, protected: isProtected, redirect }: AuthGateProps) {
  const { user, isBootstrapping } = useAuth();
  const { theme } = useTheme();

  if (isBootstrapping) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // Guard: authenticated-only zone — bounce unauthenticated users out
  if (isProtected && !user) {
    return <Redirect href="/" />;
  }

  // Guest-only zone — skip login screen for already-signed-in users
  if (redirect && user) {
    return <Redirect href={redirect as any} />;
  }

  return <>{children}</>;
}
