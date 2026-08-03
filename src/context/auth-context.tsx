import type { PropsWithChildren } from "react";
import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
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
import { UI_PREVIEW_ENABLED } from "@/config/runtime";
import { PREVIEW_USER } from "@/fixtures/preview-data";

type UserSession = {
  uid: string;
  email: string;
  fullName?: string;
};

type AuthContextValue = {
  user: UserSession | null;
  isBootstrapping: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    fullName: string,
    email: string,
    password: string,
  ) => Promise<{ requiresEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  updateName: (fullName: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<UserSession | null>(() =>
    UI_PREVIEW_ENABLED ? PREVIEW_USER : null,
  );
  const [isBootstrapping, setIsBootstrapping] = useState(
    !UI_PREVIEW_ENABLED,
  );

  useEffect(() => {
    if (UI_PREVIEW_ENABLED) return;

    const applyUser = (currentUser: User) => {
      setUser({
        uid: currentUser.id,
        email: currentUser.email || "",
        fullName: currentUser.user_metadata?.full_name,
      });
      useAppStore.getState().hydrateFromMetadata(currentUser.user_metadata);

      if (
        currentUser.user_metadata?.app_lock_pin != null ||
        currentUser.user_metadata?.app_lock_enabled != null
      ) {
        void supabaseClearLegacyAppLockSettings().catch(() => {
          console.warn("[auth] Could not clear legacy app lock metadata.");
        });
      }
    };

    const syncUserFromSupabase = async (fallbackUser?: User | null) => {
      let localUser = fallbackUser ?? null;
      try {
        if (!localUser) {
          const { data } = await supabaseClient.auth.getSession();
          localUser = data.session?.user ?? null;
        }

        // A locally persisted session is enough to unlock this user's isolated
        // cache and queue while offline. Remote reads still remain protected by
        // JWT validation and RLS when connectivity returns.
        if (localUser) {
          applyUser(localUser);
          setIsBootstrapping(false);
        }

        // getUser verifies the JWT and refreshes metadata when the network is
        // available. Failure does not erase a locally restored offline session.
        const { data, error } = await supabaseClient.auth.getUser();
        if (error) throw error;
        if (data.user) applyUser(data.user);
        else if (!localUser) setUser(null);
      } catch (error) {
        const status = Number(
          (error as { status?: number | string } | null)?.status ?? 0,
        );
        if (!localUser || status === 401 || status === 403) setUser(null);
        else console.warn("[auth] Using the last locally restored session.");
      } finally {
        setIsBootstrapping(false);
      }
    };

    void syncUserFromSupabase();

    const { data: authListener } = supabaseClient.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          setUser(null);
          setIsBootstrapping(false);
          return;
        }
        setTimeout(() => void syncUserFromSupabase(session?.user), 0);
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (UI_PREVIEW_ENABLED) {
      setUser({ ...PREVIEW_USER, email });
      return;
    }
    const result = await supabaseSignIn(email, password);
    if (result.user) {
      setUser({
        uid: result.user.id,
        email: result.user.email || email,
        fullName: result.user.user_metadata?.full_name,
      });
    }
  }, []);

  const signUp = useCallback(async (fullName: string, email: string, password: string) => {
    if (UI_PREVIEW_ENABLED) {
      setUser({ uid: PREVIEW_USER.uid, email, fullName });
      return { requiresEmailConfirmation: false };
    }
    // Pass full_name inside signUp options so it's atomic — avoids a separate
    // updateUser call that can fail if email-confirmation hasn't established a
    // session yet.
    const result = await supabaseSignUp(email, password, fullName);
    if (result.session && result.user) {
      setUser({
        uid: result.user.id,
        email: result.user.email || email,
        fullName,
      });
    }
    return { requiresEmailConfirmation: result.session == null };
  }, []);

  const signOut = useCallback(async () => {
    if (UI_PREVIEW_ENABLED) {
      setUser(null);
      return;
    }
    await supabaseSignOut();
  }, []);

  const updateName = useCallback(async (fullName: string) => {
    if (UI_PREVIEW_ENABLED) {
      setUser((previous) =>
        previous ? { ...previous, fullName } : previous,
      );
      return;
    }
    await supabaseUpdateName(fullName);
    setUser((prev) => prev ? { ...prev, fullName } : prev);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (UI_PREVIEW_ENABLED) return;
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
