import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PropsWithChildren } from "react";
import { createContext, useCallback, useEffect, useMemo, useState } from "react";

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

const AUTH_STORAGE_KEY = "auth_session";

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const rawSession = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (rawSession) {
          setUser(JSON.parse(rawSession) as UserSession);
        }
      } finally {
        setIsBootstrapping(false);
      }
    };

    void bootstrap();
  }, []);

  const persistSession = useCallback(async (session: UserSession | null) => {
    if (!session) {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }

    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  }, []);

  const signIn = useCallback(
    async (email: string, _password: string) => {
      const session: UserSession = {
        uid: "local-user",
        email,
      };
      setUser(session);
      await persistSession(session);
    },
    [persistSession],
  );

  const signUp = useCallback(
    async (fullName: string, email: string, _password: string) => {
      const session: UserSession = {
        uid: "local-user",
        email,
        fullName,
      };
      setUser(session);
      await persistSession(session);
    },
    [persistSession],
  );

  const signOut = useCallback(async () => {
    setUser(null);
    await persistSession(null);
  }, [persistSession]);

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
