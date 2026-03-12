import type { PropsWithChildren } from "react";
import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { supabaseSignIn, supabaseSignUp, supabaseSignOut } from "@/services/supabase/auth-service";
import { supabaseClient } from "@/services/supabase/supabase-client";
import { Session, User } from "@supabase/supabase-js";

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
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    // getSession might return a stale JWT that doesn't include freshly updated metadata.
    // getUser() guarantees we hit the Supabase server to get the latest `full_name`.
    supabaseClient.auth.getUser().then(({ data: { user: currentUser } }) => {
      if (currentUser) {
        setUser({
          uid: currentUser.id,
          email: currentUser.email || "",
          fullName: currentUser.user_metadata?.full_name,
        });
      } else {
        setUser(null);
      }
      setIsBootstrapping(false);
    });

    const { data: authListener } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      // Whenever auth state changes, fetch the fresh user object to get the latest metadata
      supabaseClient.auth.getUser().then(({ data: { user: updatedUser } }) => {
        if (updatedUser) {
          setUser({
            uid: updatedUser.id,
            email: updatedUser.email || "",
            fullName: updatedUser.user_metadata?.full_name,
          });
        } else {
          setUser(null);
        }
      });
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await supabaseSignIn(email, password);
  }, []);

  const signUp = useCallback(async (fullName: string, email: string, password: string) => {
    const data = await supabaseSignUp(email, password);
    // Optionally update user metadata with full name
    if (data?.user) {
      await supabaseClient.auth.updateUser({
        data: { full_name: fullName }
      });
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabaseSignOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isBootstrapping,
      signIn,
      signUp,
      signOut,
    }),
    [isBootstrapping, signIn, signOut, signUp, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
