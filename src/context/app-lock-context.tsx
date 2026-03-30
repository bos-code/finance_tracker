import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/hooks/use-auth";
import { supabaseUpdateUserSettings } from "@/services/supabase/auth-service";
import { useAppStore } from "@/store/use-app-store";
import * as LocalAuthentication from "expo-local-authentication";
import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState, Platform } from "react-native";

type AppLockContextValue = {
  enabled: boolean;
  locked: boolean;
  hasPin: boolean;
  useBiometrics: boolean;
  isBiometricsSupported: boolean;
  biometricLabel: string;
  enableLock: (pin: string, shouldUseBiometrics: boolean) => Promise<void>;
  disableLock: () => Promise<void>;
  updatePin: (pin: string) => Promise<void>;
  setUseBiometrics: (next: boolean) => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  biometricUnlock: () => Promise<boolean>;
  lock: () => void;
};

const STORAGE_USE_BIOMETRICS = "@finance_tracker_app_lock_biometrics";

function isValidPin(pin: string | null | undefined) {
  return /^\d{4}$/.test(pin ?? "");
}

function getBiometricLabel(types: LocalAuthentication.AuthenticationType[]) {
  if (types.length > 1) {
    return "Biometrics";
  }

  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return Platform.OS === "ios" ? "Face ID" : "Face unlock";
  }

  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return "Fingerprint";
  }

  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return "Iris";
  }

  return "Biometrics";
}

export const AppLockContext = createContext<AppLockContextValue | undefined>(undefined);

export function AppLockProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const storedEnabled = useAppStore((s) => s.appLockEnabled);
  const pin = useAppStore((s) => s.appLockPin);
  const setAppLockEnabled = useAppStore((s) => s.setAppLockEnabled);
  const setAppLockPin = useAppStore((s) => s.setAppLockPin);

  const hasPin = isValidPin(pin);
  const enabled = storedEnabled && hasPin;

  const [locked, setLocked] = useState(false);
  const [useBiometrics, setUseBiometricsState] = useState(false);
  const [isBiometricsSupported, setIsBiometricsSupported] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState("Biometrics");
  const [bootstrapped, setBootstrapped] = useState(false);

  const persistBiometricsPreference = useCallback(
    async (next: boolean) => {
      const resolvedNext = enabled && isBiometricsSupported && next;
      setUseBiometricsState(resolvedNext);

      if (resolvedNext) {
        await AsyncStorage.setItem(STORAGE_USE_BIOMETRICS, "true");
        return;
      }

      await AsyncStorage.removeItem(STORAGE_USE_BIOMETRICS);
    },
    [enabled, isBiometricsSupported],
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      const [biometricsRaw, hasHardware, isEnrolled, authTypes] = await Promise.all([
        AsyncStorage.getItem(STORAGE_USE_BIOMETRICS),
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);

      if (!mounted) return;

      const supported = hasHardware && isEnrolled;
      setIsBiometricsSupported(supported);
      setBiometricLabel(getBiometricLabel(authTypes));
      setUseBiometricsState(supported && enabled && biometricsRaw === "true");
      setLocked(enabled);
      setBootstrapped(true);
    })();

    return () => {
      mounted = false;
    };
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

  const disableLock = useCallback(async () => {
    setAppLockEnabled(false);
    setAppLockPin(null);
    setLocked(false);
    setUseBiometricsState(false);

    await Promise.all([
      AsyncStorage.removeItem(STORAGE_USE_BIOMETRICS),
      user
        ? supabaseUpdateUserSettings({
            app_lock_enabled: false,
            app_lock_pin: null,
          })
        : Promise.resolve(),
    ]);
  }, [setAppLockEnabled, setAppLockPin, user]);

  const updatePin = useCallback(
    async (nextPin: string) => {
      setAppLockPin(nextPin);

      if (user) {
        await supabaseUpdateUserSettings({ app_lock_pin: nextPin });
      }
    },
    [setAppLockPin, user],
  );

  const enableLock = useCallback(
    async (nextPin: string, shouldUseBiometrics: boolean) => {
      setAppLockPin(nextPin);
      setAppLockEnabled(true);
      setLocked(false);

      await Promise.all([
        user
          ? supabaseUpdateUserSettings({
              app_lock_enabled: true,
              app_lock_pin: nextPin,
            })
          : Promise.resolve(),
        AsyncStorage.setItem(
          STORAGE_USE_BIOMETRICS,
          shouldUseBiometrics && isBiometricsSupported ? "true" : "false",
        ),
      ]);

      setUseBiometricsState(shouldUseBiometrics && isBiometricsSupported);
    },
    [isBiometricsSupported, setAppLockEnabled, setAppLockPin, user],
  );

  const setUseBiometrics = useCallback(
    async (next: boolean) => {
      await persistBiometricsPreference(next);
    },
    [persistBiometricsPreference],
  );

  const unlock = useCallback(
    async (attempt: string) => {
      if (!pin || attempt !== pin) {
        return false;
      }

      setLocked(false);
      return true;
    },
    [pin],
  );

  const biometricUnlock = useCallback(async () => {
    if (!enabled || !useBiometrics || !isBiometricsSupported) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock Finance Tracker",
      fallbackLabel: "Use PIN",
      cancelLabel: "Cancel",
    });

    if (!result.success) {
      return false;
    }

    setLocked(false);
    return true;
  }, [enabled, isBiometricsSupported, useBiometrics]);

  const lock = useCallback(() => {
    if (enabled) {
      setLocked(true);
    }
  }, [enabled]);

  const value = useMemo<AppLockContextValue>(
    () => ({
      enabled,
      locked,
      hasPin,
      useBiometrics,
      isBiometricsSupported,
      biometricLabel,
      enableLock,
      disableLock,
      updatePin,
      setUseBiometrics,
      unlock,
      biometricUnlock,
      lock,
    }),
    [
      biometricLabel,
      disableLock,
      enableLock,
      enabled,
      hasPin,
      isBiometricsSupported,
      lock,
      locked,
      setUseBiometrics,
      unlock,
      updatePin,
      useBiometrics,
      biometricUnlock,
    ],
  );

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock() {
  const ctx = useContext(AppLockContext);

  if (!ctx) {
    throw new Error("useAppLock must be used inside AppLockProvider");
  }

  return ctx;
}
