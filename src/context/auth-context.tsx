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
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          uid: session.user.id,
          email: session.user.email || "",
          fullName: session.user.user_metadata?.full_name,
        });
      } else {
        setUser(null);
      }
      setIsBootstrapping(false);
    });

    const { data: authListener } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          uid: session.user.id,
          email: session.user.email || "",
          fullName: session.user.user_metadata?.full_name,
        });
      } else {
        setUser(null);
      }
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
