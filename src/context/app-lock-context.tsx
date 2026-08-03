import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/hooks/use-auth";
import { useAppStore } from "@/store/use-app-store";
import * as LocalAuthentication from "expo-local-authentication";
import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { UI_PREVIEW_ENABLED } from "@/config/runtime";

type AppLockContextValue = {
  enabled: boolean;
  locked: boolean;
  hasPin: boolean;
  hasHydrated: boolean;
  isReady: boolean;
  useBiometrics: boolean;
  canUseBiometrics: boolean;
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

const LEGACY_STORAGE_USE_BIOMETRICS = "@finance_tracker_app_lock_biometrics";

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
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  const storedEnabled = useAppStore((s) => s.appLockEnabled);
  const pin = useAppStore((s) => s.appLockPin);
  const ownerUserId = useAppStore((s) => s.appLockOwnerUserId);
  const biometricsPreference = useAppStore((s) => s.appLockUseBiometrics);
  const setAppLockEnabled = useAppStore((s) => s.setAppLockEnabled);
  const setAppLockPin = useAppStore((s) => s.setAppLockPin);
  const setAppLockOwnerUserId = useAppStore((s) => s.setAppLockOwnerUserId);
  const setAppLockUseBiometrics = useAppStore((s) => s.setAppLockUseBiometrics);

  const [locked, setLocked] = useState(false);
  const [isBiometricsSupported, setIsBiometricsSupported] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState("Biometrics");
  const [capabilitiesLoaded, setCapabilitiesLoaded] = useState(
    UI_PREVIEW_ENABLED,
  );

  const appStateRef = useRef(AppState.currentState);
  const skipNextAutoLockRef = useRef(false);

  const hasPin = isValidPin(pin);
  const currentUserId = user?.uid ?? null;
  const appliesToCurrentUser =
    Boolean(currentUserId) && (!ownerUserId || ownerUserId === currentUserId);
  const enabled = Boolean(currentUserId) && storedEnabled && hasPin && appliesToCurrentUser;
  const useBiometrics = enabled && biometricsPreference && isBiometricsSupported;
  const canUseBiometrics = useBiometrics;
  const isReady = hasHydrated && capabilitiesLoaded;

  const refreshBiometricCapabilities = useCallback(async () => {
    try {
      const [hasHardware, isEnrolled, authTypes] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);

      const supported = hasHardware && isEnrolled;
      setIsBiometricsSupported(supported);
      setBiometricLabel(getBiometricLabel(authTypes));
      return supported;
    } catch (error) {
      console.warn("[app-lock] Failed to load biometric capabilities:", error);
      setIsBiometricsSupported(false);
      setBiometricLabel("Biometrics");
      return false;
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated || !storedEnabled || hasPin) return;

    setAppLockEnabled(false);
    setAppLockOwnerUserId(null);
    setAppLockUseBiometrics(false);
  }, [hasHydrated, hasPin, setAppLockEnabled, setAppLockOwnerUserId, setAppLockUseBiometrics, storedEnabled]);

  useEffect(() => {
    if (!hasHydrated || !user?.uid || !storedEnabled || !hasPin || ownerUserId) return;

    setAppLockOwnerUserId(user.uid);
  }, [hasHydrated, hasPin, ownerUserId, setAppLockOwnerUserId, storedEnabled, user?.uid]);

  useEffect(() => {
    if (!hasHydrated) return;

    let mounted = true;

    const bootstrapSecurity = async () => {
      try {
        const legacyBiometricsRaw = await AsyncStorage.getItem(LEGACY_STORAGE_USE_BIOMETRICS);

        if (legacyBiometricsRaw !== null) {
          if (legacyBiometricsRaw === "true" && !biometricsPreference) {
            setAppLockUseBiometrics(true);
          }

          await AsyncStorage.removeItem(LEGACY_STORAGE_USE_BIOMETRICS);
        }
        await refreshBiometricCapabilities();
      } catch (error) {
        console.warn("[app-lock] Failed to bootstrap local security state:", error);
      }

      if (!mounted) return;
      setCapabilitiesLoaded(true);
    };

    void bootstrapSecurity();

    return () => {
      mounted = false;
    };
  }, [biometricsPreference, hasHydrated, refreshBiometricCapabilities, setAppLockUseBiometrics]);

  useEffect(() => {
    if (!isReady) return;

    if (skipNextAutoLockRef.current) {
      skipNextAutoLockRef.current = false;
      setLocked(false);
      return;
    }

    if (!enabled) {
      setLocked(false);
      return;
    }

    setLocked(true);
  }, [currentUserId, enabled, isReady]);

  useEffect(() => {
    if (!isReady) return;

    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (enabled && (nextState === "background" || nextState === "inactive")) {
        setLocked(true);
      }

      if (previousState !== "active" && nextState === "active") {
        void refreshBiometricCapabilities();
      }
    });

    return () => subscription.remove();
  }, [enabled, isReady, refreshBiometricCapabilities]);

  const enableLock = useCallback(
    async (nextPin: string, shouldUseBiometrics: boolean) => {
      if (!user?.uid) {
        throw new Error("Sign in to enable App Lock.");
      }

      if (!isValidPin(nextPin)) {
        throw new Error("Enter a valid 4-digit PIN.");
      }

      skipNextAutoLockRef.current = true;
      setAppLockPin(nextPin);
      setAppLockOwnerUserId(user.uid);
      setAppLockUseBiometrics(Boolean(shouldUseBiometrics && isBiometricsSupported));
      setAppLockEnabled(true);
      setLocked(false);
    },
    [
      isBiometricsSupported,
      setAppLockEnabled,
      setAppLockOwnerUserId,
      setAppLockPin,
      setAppLockUseBiometrics,
      user?.uid,
    ],
  );

  const disableLock = useCallback(async () => {
    setAppLockEnabled(false);
    setAppLockPin(null);
    setAppLockOwnerUserId(null);
    setAppLockUseBiometrics(false);
    setLocked(false);
    await AsyncStorage.removeItem(LEGACY_STORAGE_USE_BIOMETRICS);
  }, [setAppLockEnabled, setAppLockOwnerUserId, setAppLockPin, setAppLockUseBiometrics]);

  const updatePin = useCallback(
    async (nextPin: string) => {
      if (!user?.uid) {
        throw new Error("Sign in to update App Lock.");
      }

      if (!isValidPin(nextPin)) {
        throw new Error("Enter a valid 4-digit PIN.");
      }

      setAppLockPin(nextPin);
      setAppLockOwnerUserId(user.uid);
    },
    [setAppLockOwnerUserId, setAppLockPin, user?.uid],
  );

  const setUseBiometrics = useCallback(
    async (next: boolean) => {
      setAppLockUseBiometrics(Boolean(next && isBiometricsSupported));
    },
    [isBiometricsSupported, setAppLockUseBiometrics],
  );

  const unlock = useCallback(
    async (attempt: string) => {
      if (!enabled || !pin || attempt !== pin) {
        return false;
      }

      setLocked(false);
      return true;
    },
    [enabled, pin],
  );

  const biometricUnlock = useCallback(async () => {
    if (!canUseBiometrics) return false;

    try {
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
    } catch (error) {
      console.warn("[app-lock] Biometric unlock failed:", error);
      return false;
    }
  }, [canUseBiometrics]);

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
      hasHydrated,
      isReady,
      useBiometrics,
      canUseBiometrics,
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
      biometricUnlock,
      canUseBiometrics,
      disableLock,
      enableLock,
      enabled,
      hasHydrated,
      hasPin,
      isBiometricsSupported,
      isReady,
      lock,
      locked,
      setUseBiometrics,
      unlock,
      updatePin,
      useBiometrics,
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
