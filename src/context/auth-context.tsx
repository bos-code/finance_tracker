import type { PropsWithChildren } from "react";
import { createContext, useCallback, useEffect, useMemo, useState } from "react";

import {
  firebaseSignIn,
  firebaseSignInWithGoogle,
  firebaseSignOut,
  firebaseSignUp,
  subscribeToAuthState,
} from "@/services/firebase/auth-service";

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
  signInWithGoogle: (tokens: {
    idToken?: string;
    accessToken?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((nextUser) => {
      if (!nextUser) {
        setUser(null);
      } else {
        setUser({
          uid: nextUser.uid,
          email: nextUser.email ?? "",
          fullName: nextUser.displayName ?? undefined,
        });
      }
      setIsBootstrapping(false);
    });

    return unsubscribe;
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await firebaseSignIn(email, password);
    },
    [],
  );

  const signUp = useCallback(
    async (fullName: string, email: string, password: string) => {
      await firebaseSignUp(fullName, email, password);
    },
    [],
  );

  const signOut = useCallback(async () => {
    await firebaseSignOut();
  }, []);

  const signInWithGoogle = useCallback(
    async (tokens: { idToken?: string; accessToken?: string }) => {
      await firebaseSignInWithGoogle(tokens);
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isBootstrapping,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
    }),
    [isBootstrapping, signIn, signInWithGoogle, signOut, signUp, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
