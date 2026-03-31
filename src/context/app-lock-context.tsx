import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/hooks/use-auth";
import { useAppStore } from "@/store/use-app-store";
import * as LocalAuthentication from "expo-local-authentication";
import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

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

/**
 * Checks whether a PIN consists of exactly four numeric digits.
 *
 * @param pin - The PIN to validate; `null` or `undefined` are treated as invalid.
 * @returns `true` if `pin` contains exactly four digits (0–9), `false` otherwise.
 */
function isValidPin(pin: string | null | undefined) {
  return /^\d{4}$/.test(pin ?? "");
}

/**
 * Get a user-facing label describing the available biometric authentication type(s).
 *
 * @param types - Array of `LocalAuthentication.AuthenticationType` values reported by the device
 * @returns The label to show to users: `Face ID` on iOS or `Face unlock` on other platforms for facial recognition; `Fingerprint` for fingerprint; `Iris` for iris; `Biometrics` when multiple types are present or no specific type matches
 */
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

/**
 * Provides App Lock context and manages PIN and biometric lock state for descendant components.
 *
 * Manages persistence, per-user ownership, biometric capability discovery and migration, auto-locking
 * based on app foreground/background state, and exposes actions to enable/disable the lock,
 * update the PIN, toggle biometric use, and perform PIN- or biometric-based unlocks.
 *
 * @returns The AppLockContext provider element that supplies lock state and actions to children
 */
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
  const [capabilitiesLoaded, setCapabilitiesLoaded] = useState(false);

  const appStateRef = useRef(AppState.currentState);
  const skipNextAutoLockRef = useRef(false);

  const hasPin = isValidPin(pin);
  const appliesToCurrentUser = Boolean(user?.uid) && (!ownerUserId || ownerUserId === user.uid);
  const enabled = Boolean(user?.uid) && storedEnabled && hasPin && appliesToCurrentUser;
  const useBiometrics = enabled && biometricsPreference && isBiometricsSupported;
  const canUseBiometrics = useBiometrics;
  const isReady = hasHydrated && capabilitiesLoaded;

  const refreshBiometricCapabilities = useCallback(async () => {
    const [hasHardware, isEnrolled, authTypes] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);

    const supported = hasHardware && isEnrolled;
    setIsBiometricsSupported(supported);
    setBiometricLabel(getBiometricLabel(authTypes));
    return supported;
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
      const legacyBiometricsRaw = await AsyncStorage.getItem(LEGACY_STORAGE_USE_BIOMETRICS);

      if (legacyBiometricsRaw !== null) {
        if (legacyBiometricsRaw === "true" && !biometricsPreference) {
          setAppLockUseBiometrics(true);
        }

        await AsyncStorage.removeItem(LEGACY_STORAGE_USE_BIOMETRICS);
      }

      await refreshBiometricCapabilities();

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
  }, [enabled, isReady, user?.uid]);

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

/**
 * Accesses the App Lock context value.
 *
 * @returns The current AppLockContextValue provided by an enclosing AppLockProvider.
 * @throws Error if called outside an AppLockProvider (`"useAppLock must be used inside AppLockProvider"`).
 */
export function useAppLock() {
  const ctx = useContext(AppLockContext);

  if (!ctx) {
    throw new Error("useAppLock must be used inside AppLockProvider");
  }

  return ctx;
}
