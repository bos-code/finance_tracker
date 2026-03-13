import { supabaseUpdateAppLockSettings } from "@/services/supabase/auth-service";
import { useAuth } from "@/hooks/use-auth";
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

const STORAGE_ENABLED = "@finance_tracker_app_lock_enabled";
const STORAGE_PIN = "@finance_tracker_app_lock_pin";
const STORAGE_USE_BIOMETRICS = "@finance_tracker_app_lock_biometrics";

export const AppLockContext = createContext<AppLockContextValue | undefined>(undefined);

export function AppLockProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pin, setPinState] = useState<string | null>(null);
  const [useBiometrics, setUseBiometricsState] = useState(false);
  const [isBiometricsSupported, setIsBiometricsSupported] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [enabledRaw, pinRaw, biometricsRaw, hasHardware, isEnrolled] = await Promise.all([
        AsyncStorage.getItem(STORAGE_ENABLED),
        AsyncStorage.getItem(STORAGE_PIN),
        AsyncStorage.getItem(STORAGE_USE_BIOMETRICS),
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);

      if (!mounted) return;

      let isEnabled = enabledRaw === "true";
      let currentPin = pinRaw;

      // Sync with Supabase if user is logged in
      if (user) {
        const { app_lock_enabled, app_lock_pin } = (user as any).metadata || {};
        // If Supabase has it but local doesn't, or Supabase is different, we sync (Supabase wins for state)
        if (app_lock_enabled !== undefined && String(app_lock_enabled) !== enabledRaw) {
          isEnabled = !!app_lock_enabled;
          await AsyncStorage.setItem(STORAGE_ENABLED, isEnabled ? "true" : "false");
        }
        if (app_lock_pin !== undefined && app_lock_pin !== pinRaw) {
          currentPin = app_lock_pin;
          if (currentPin) {
             await AsyncStorage.setItem(STORAGE_PIN, currentPin);
          } else {
             await AsyncStorage.removeItem(STORAGE_PIN);
          }
        }
      }

      setEnabledState(isEnabled);
      setPinState(currentPin);
      setUseBiometricsState(biometricsRaw === "true");
      setIsBiometricsSupported(hasHardware && isEnrolled);
      setLocked(isEnabled);
      setBootstrapped(true);
    })();
    return () => { mounted = false; };
  }, [user]);

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
    
    // Sync to Supabase
    if (user) {
      await supabaseUpdateAppLockSettings({ enabled: next });
    }

    if (!next) {
      setLocked(false);
      setPinState(null);
      setUseBiometricsState(false);
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_PIN),
        AsyncStorage.removeItem(STORAGE_USE_BIOMETRICS),
        user ? supabaseUpdateAppLockSettings({ pin: null }) : Promise.resolve(),
      ]);
    } else {
      setLocked(false);
    }
  }, [user]);

  const setPin = useCallback(async (nextPin: string) => {
    setPinState(nextPin);
    await AsyncStorage.setItem(STORAGE_PIN, nextPin);
    if (user) {
      await supabaseUpdateAppLockSettings({ pin: nextPin });
    }
  }, [user]);

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
