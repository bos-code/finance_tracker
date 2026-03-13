import { supabaseUpdateUserSettings } from "@/services/supabase/auth-service";
import { useAuth } from "@/hooks/use-auth";
import { useAppStore } from "@/store/use-app-store";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";

type AppLockContextValue = {
  enabled: boolean;
  locked: boolean;
  hasPin: boolean;
  useBiometrics: boolean;
  isBiometricsSupported: boolean;
  setEnabled: (next: boolean) => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  setUseBiometrics: (next: boolean) => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  biometricUnlock: () => Promise<boolean>;
  lock: () => void;
};

const STORAGE_USE_BIOMETRICS = "@finance_tracker_app_lock_biometrics";

export const AppLockContext = createContext<AppLockContextValue | undefined>(undefined);

export function AppLockProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const enabled = useAppStore((s) => s.appLockEnabled);
  const pin = useAppStore((s) => s.appLockPin);
  const setAppLockEnabled = useAppStore((s) => s.setAppLockEnabled);
  const setAppLockPin = useAppStore((s) => s.setAppLockPin);

  const [locked, setLocked] = useState(false);
  const [useBiometrics, setUseBiometricsState] = useState(false);
  const [isBiometricsSupported, setIsBiometricsSupported] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [biometricsRaw, hasHardware, isEnrolled] = await Promise.all([
        AsyncStorage.getItem(STORAGE_USE_BIOMETRICS),
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);

      if (!mounted) return;

      setUseBiometricsState(biometricsRaw === "true");
      setIsBiometricsSupported(hasHardware && isEnrolled);
      setLocked(enabled);
      setBootstrapped(true);
    })();
    return () => { mounted = false; };
  }, [enabled]);

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
    setAppLockEnabled(next);
    
    // Sync to Supabase
    if (user) {
      await supabaseUpdateUserSettings({ app_lock_enabled: next });
    }

    if (!next) {
      setLocked(false);
      setAppLockPin(null);
      setUseBiometricsState(false);
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_USE_BIOMETRICS),
        user ? supabaseUpdateUserSettings({ app_lock_pin: null }) : Promise.resolve(),
      ]);
    } else {
      setLocked(false);
    }
  }, [user, setAppLockEnabled, setAppLockPin]);

  const setPin = useCallback(async (nextPin: string) => {
    setAppLockPin(nextPin);
    if (user) {
      await supabaseUpdateUserSettings({ app_lock_pin: nextPin });
    }
  }, [user, setAppLockPin]);

  const setUseBiometrics = useCallback(async (next: boolean) => {
    setUseBiometricsState(next);
    await AsyncStorage.setItem(STORAGE_USE_BIOMETRICS, next ? "true" : "false");
  }, []);

  const unlock = useCallback(async (attempt: string) => {
    if (!pin || attempt !== pin) {
      return false;
    }
    setLocked(false);
    return true;
  }, [pin]);

  const biometricUnlock = useCallback(async () => {
    if (!useBiometrics || !isBiometricsSupported) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock Finance Tracker",
      fallbackLabel: "Use PIN",
    });

    if (result.success) {
      setLocked(false);
      return true;
    }
    return false;
  }, [useBiometrics, isBiometricsSupported]);

  const lock = useCallback(() => {
    if (enabled) setLocked(true);
  }, [enabled]);

  const value = useMemo<AppLockContextValue>(
    () => ({
      enabled,
      locked,
      hasPin: !!pin,
      useBiometrics,
      isBiometricsSupported,
      setEnabled,
      setPin,
      setUseBiometrics,
      unlock,
      biometricUnlock,
      lock,
    }),
    [
      enabled,
      locked,
      pin,
      useBiometrics,
      isBiometricsSupported,
      setEnabled,
      setPin,
      setUseBiometrics,
      unlock,
      biometricUnlock,
      lock,
    ],
  );

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock() {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error("useAppLock must be used inside AppLockProvider");
  return ctx;
}
