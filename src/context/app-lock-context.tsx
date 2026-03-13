import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";

type AppLockContextValue = {
  enabled: boolean;
  locked: boolean;
  hasPin: boolean;
  setEnabled: (next: boolean) => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
};

const STORAGE_ENABLED = "@finance_tracker_app_lock_enabled";
const STORAGE_PIN = "@finance_tracker_app_lock_pin";

export const AppLockContext = createContext<AppLockContextValue | undefined>(undefined);

export function AppLockProvider({ children }: PropsWithChildren) {
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pin, setPinState] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [enabledRaw, pinRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_ENABLED),
        AsyncStorage.getItem(STORAGE_PIN),
      ]);
      if (!mounted) return;
      const isEnabled = enabledRaw === "true";
      setEnabledState(isEnabled);
      setPinState(pinRaw);
      setLocked(isEnabled);
      setBootstrapped(true);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!bootstrapped || !enabled) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        setLocked(true);
      }
    });
    return () => subscription.remove();
  }, [bootstrapped, enabled]);

  const setEnabled = useCallback(async (next: boolean) => {
    setEnabledState(next);
    await AsyncStorage.setItem(STORAGE_ENABLED, next ? "true" : "false");
    if (!next) {
      setLocked(false);
      setPinState(null);
      await AsyncStorage.removeItem(STORAGE_PIN);
    } else {
      setLocked(false);
    }
  }, []);

  const setPin = useCallback(async (nextPin: string) => {
    setPinState(nextPin);
    await AsyncStorage.setItem(STORAGE_PIN, nextPin);
  }, []);

  const unlock = useCallback(async (attempt: string) => {
    if (!pin || attempt !== pin) {
      return false;
    }
    setLocked(false);
    return true;
  }, [pin]);

  const lock = useCallback(() => {
    if (enabled) setLocked(true);
  }, [enabled]);

  const value = useMemo<AppLockContextValue>(
    () => ({
      enabled,
      locked,
      hasPin: !!pin,
      setEnabled,
      setPin,
      unlock,
      lock,
    }),
    [enabled, locked, pin, setEnabled, setPin, unlock, lock],
  );

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock() {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error("useAppLock must be used inside AppLockProvider");
  return ctx;
}
