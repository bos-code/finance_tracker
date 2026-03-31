import type { PropsWithChildren } from "react";
import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import {
  supabaseClearLegacyAppLockSettings,
  supabaseSignIn,
  supabaseSignOut,
  supabaseSignUp,
  supabaseUpdateName,
  supabaseUpdatePassword,
} from "@/services/supabase/auth-service";
import { supabaseClient } from "@/services/supabase/supabase-client";
import { useAppStore } from "@/store/use-app-store";

type UserSession = {
  uid: string;
  email: string;
  fullName?: string;
};

type AuthContextValue = {
  user: UserSession | null;
  isBootstrapping: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateName: (fullName: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Provides AuthContext to descendants and manages the application's authentication state using Supabase.
 *
 * This component keeps the current authenticated user and a bootstrapping flag in sync with Supabase, hydrates the app store from user metadata, performs legacy app-lock cleanup when needed, listens for auth state changes, and exposes auth actions (`signIn`, `signUp`, `signOut`, `updateName`, `updatePassword`) to consumers.
 *
 * @returns A React context provider element that supplies auth state and authentication/account actions to its children.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    const syncUserFromSupabase = async (fallbackUser?: any) => {
      // getSession might return a stale JWT that doesn't include freshly updated metadata.
      // getUser() guarantees we hit the Supabase server to get the latest `full_name`.
      const { data: { user: refreshedUser } } = await supabaseClient.auth.getUser();
      const currentUser = refreshedUser || fallbackUser || null;

      if (currentUser) {
        setUser({
          uid: currentUser.id,
          email: currentUser.email || "",
          fullName: currentUser.user_metadata?.full_name,
        });

        useAppStore.getState().hydrateFromMetadata(currentUser.user_metadata);

        // Legacy cleanup: app lock is now device-local, so scrub old remote fields.
        if (
          currentUser.user_metadata?.app_lock_pin != null ||
          currentUser.user_metadata?.app_lock_enabled != null
        ) {
          void supabaseClearLegacyAppLockSettings().catch((error) => {
            console.warn("[auth] Failed to clear legacy app lock metadata:", error);
          });
        }
      } else {
        setUser(null);
      }

      setIsBootstrapping(false);
    };

    void syncUserFromSupabase();

    const { data: authListener } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      void syncUserFromSupabase(session?.user);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await supabaseSignIn(email, password);
  }, []);

  const signUp = useCallback(async (fullName: string, email: string, password: string) => {
    // Pass full_name inside signUp options so it's atomic — avoids a separate
    // updateUser call that can fail if email-confirmation hasn't established a
    // session yet.
    await supabaseSignUp(email, password, fullName);
  }, []);

  const signOut = useCallback(async () => {
    await supabaseSignOut();
  }, []);

  const updateName = useCallback(async (fullName: string) => {
    await supabaseUpdateName(fullName);
    setUser((prev) => prev ? { ...prev, fullName } : prev);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    await supabaseUpdatePassword(password);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isBootstrapping,
      signIn,
      signUp,
      signOut,
      updateName,
      updatePassword,
    }),
    [isBootstrapping, signIn, signOut, signUp, updateName, updatePassword, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
