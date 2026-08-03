import AsyncStorage from "@react-native-async-storage/async-storage";
import { UI_PREVIEW_ENABLED } from "@/config/runtime";
import { useAuth } from "@/hooks/use-auth";
import { useAppStore } from "@/store/use-app-store";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  secureStorageAvailable: boolean;
  biometricLabel: string;
  enableLock: (pin: string, shouldUseBiometrics: boolean) => Promise<void>;
  disableLock: () => Promise<void>;
  updatePin: (pin: string) => Promise<void>;
  setUseBiometrics: (next: boolean) => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  biometricUnlock: () => Promise<boolean>;
  lock: () => void;
};

const LEGACY_STORAGE_USE_BIOMETRICS =
  "@finance_tracker_app_lock_biometrics";
const SECURE_PIN_KEY_PREFIX = "finance_tracker_app_lock_pin";

function securePinKey(userId: string) {
  return `${SECURE_PIN_KEY_PREFIX}_${userId}`;
}

function isValidPin(pin: string | null | undefined) {
  return /^\d{4}$/.test(pin ?? "");
}

function getBiometricLabel(types: LocalAuthentication.AuthenticationType[]) {
  if (types.length > 1) return "Biometrics";
  if (
    types.includes(
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    )
  ) {
    return Platform.OS === "ios" ? "Face ID" : "Face unlock";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return "Fingerprint";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return "Iris";
  return "Biometrics";
}

export const AppLockContext = createContext<AppLockContextValue | undefined>(
  undefined,
);

export function AppLockProvider({ children }: PropsWithChildren) {
  const { isBootstrapping, user } = useAuth();
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const storedEnabled = useAppStore((state) => state.appLockEnabled);
  const legacyPin = useAppStore((state) => state.appLockPin);
  const ownerUserId = useAppStore((state) => state.appLockOwnerUserId);
  const biometricsPreference = useAppStore(
    (state) => state.appLockUseBiometrics,
  );
  const setAppLockEnabled = useAppStore((state) => state.setAppLockEnabled);
  const setLegacyPin = useAppStore((state) => state.setAppLockPin);
  const setAppLockOwnerUserId = useAppStore(
    (state) => state.setAppLockOwnerUserId,
  );
  const setAppLockUseBiometrics = useAppStore(
    (state) => state.setAppLockUseBiometrics,
  );

  const [locked, setLocked] = useState(false);
  const [securePin, setSecurePin] = useState<string | null>(null);
  const [secureStorageAvailable, setSecureStorageAvailable] = useState(false);
  const [secureStorageLoaded, setSecureStorageLoaded] = useState(
    UI_PREVIEW_ENABLED && Platform.OS === "web",
  );
  const [isBiometricsSupported, setIsBiometricsSupported] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState("Biometrics");
  const [capabilitiesLoaded, setCapabilitiesLoaded] = useState(
    UI_PREVIEW_ENABLED,
  );

  const currentUserId = user?.uid ?? null;
  const hasPin = isValidPin(securePin);
  const appliesToCurrentUser =
    Boolean(currentUserId) &&
    (!ownerUserId || ownerUserId === currentUserId);
  const enabled =
    Boolean(currentUserId) &&
    storedEnabled &&
    hasPin &&
    appliesToCurrentUser &&
    secureStorageAvailable;
  const useBiometrics =
    enabled && biometricsPreference && isBiometricsSupported;
  const canUseBiometrics = useBiometrics;
  const isReady =
    !isBootstrapping &&
    hasHydrated &&
    capabilitiesLoaded &&
    secureStorageLoaded;

  const appStateRef = useRef(AppState.currentState);
  const skipNextAutoLockRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated || isBootstrapping) return;

    let mounted = true;
    const loadSecurePin = async () => {
      if (Platform.OS === "web") {
        if (legacyPin != null) setLegacyPin(null);
        if (mounted) {
          setSecurePin(null);
          setSecureStorageAvailable(false);
          setSecureStorageLoaded(true);
        }
        return;
      }

      if (!currentUserId) {
        if (mounted) {
          setSecurePin(null);
          setSecureStorageAvailable(false);
          setSecureStorageLoaded(true);
        }
        return;
      }

      try {
        const available = await SecureStore.isAvailableAsync();
        if (!available) {
          if (mounted) {
            setSecurePin(null);
            setSecureStorageAvailable(false);
          }
          return;
        }

        const key = securePinKey(currentUserId);
        let storedPin = await SecureStore.getItemAsync(key);
        const legacyBelongsToCurrentUser =
          !ownerUserId || ownerUserId === currentUserId;

        if (
          !isValidPin(storedPin) &&
          isValidPin(legacyPin) &&
          legacyBelongsToCurrentUser
        ) {
          await SecureStore.setItemAsync(key, legacyPin as string);
          storedPin = legacyPin;
        }

        if (legacyPin != null) setLegacyPin(null);
        if (mounted) {
          setSecurePin(isValidPin(storedPin) ? storedPin : null);
          setSecureStorageAvailable(true);
        }
      } catch (error) {
        console.warn("[app-lock] Failed to load secure PIN:", error);
        if (mounted) {
          setSecurePin(null);
          setSecureStorageAvailable(false);
        }
      } finally {
        if (mounted) setSecureStorageLoaded(true);
      }
    };

    setSecureStorageLoaded(false);
    void loadSecurePin();
    return () => {
      mounted = false;
    };
  }, [
    currentUserId,
    hasHydrated,
    isBootstrapping,
    legacyPin,
    ownerUserId,
    setLegacyPin,
  ]);

  const refreshBiometricCapabilities = useCallback(async () => {
    if (Platform.OS === "web") {
      setIsBiometricsSupported(false);
      setBiometricLabel("Biometrics");
      return false;
    }
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
    if (
      !hasHydrated ||
      !secureStorageLoaded ||
      !storedEnabled ||
      hasPin
    ) {
      return;
    }
    setAppLockEnabled(false);
    setAppLockOwnerUserId(null);
    setAppLockUseBiometrics(false);
  }, [
    hasHydrated,
    hasPin,
    secureStorageLoaded,
    setAppLockEnabled,
    setAppLockOwnerUserId,
    setAppLockUseBiometrics,
    storedEnabled,
  ]);

  useEffect(() => {
    if (
      !hasHydrated ||
      !currentUserId ||
      !storedEnabled ||
      !hasPin ||
      ownerUserId
    ) {
      return;
    }
    setAppLockOwnerUserId(currentUserId);
  }, [
    currentUserId,
    hasHydrated,
    hasPin,
    ownerUserId,
    setAppLockOwnerUserId,
    storedEnabled,
  ]);

  useEffect(() => {
    if (!hasHydrated) return;
    let mounted = true;
    const bootstrapSecurity = async () => {
      try {
        const legacyBiometricsRaw = await AsyncStorage.getItem(
          LEGACY_STORAGE_USE_BIOMETRICS,
        );
        if (legacyBiometricsRaw !== null) {
          if (legacyBiometricsRaw === "true" && !biometricsPreference) {
            setAppLockUseBiometrics(true);
          }
          await AsyncStorage.removeItem(LEGACY_STORAGE_USE_BIOMETRICS);
        }
        await refreshBiometricCapabilities();
      } catch (error) {
        console.warn("[app-lock] Failed to bootstrap security state:", error);
      }
      if (mounted) setCapabilitiesLoaded(true);
    };
    void bootstrapSecurity();
    return () => {
      mounted = false;
    };
  }, [
    biometricsPreference,
    hasHydrated,
    refreshBiometricCapabilities,
    setAppLockUseBiometrics,
  ]);

  useEffect(() => {
    if (!isReady) return;
    if (skipNextAutoLockRef.current) {
      skipNextAutoLockRef.current = false;
      setLocked(false);
      return;
    }
    setLocked(enabled);
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
      if (!user?.uid) throw new Error("Sign in to enable App Lock.");
      if (!isValidPin(nextPin)) throw new Error("Enter a valid 4-digit PIN.");
      if (!secureStorageAvailable) {
        throw new Error("Secure storage is unavailable on this device.");
      }

      await SecureStore.setItemAsync(securePinKey(user.uid), nextPin);
      setSecurePin(nextPin);
      skipNextAutoLockRef.current = true;
      setAppLockOwnerUserId(user.uid);
      setAppLockUseBiometrics(
        Boolean(shouldUseBiometrics && isBiometricsSupported),
      );
      setAppLockEnabled(true);
      setLocked(false);
    },
    [
      isBiometricsSupported,
      secureStorageAvailable,
      setAppLockEnabled,
      setAppLockOwnerUserId,
      setAppLockUseBiometrics,
      user?.uid,
    ],
  );

  const disableLock = useCallback(async () => {
    try {
      if (user?.uid && secureStorageAvailable) {
        await SecureStore.deleteItemAsync(securePinKey(user.uid));
      }
    } finally {
      setAppLockEnabled(false);
      setLegacyPin(null);
      setSecurePin(null);
      setAppLockOwnerUserId(null);
      setAppLockUseBiometrics(false);
      setLocked(false);
      await AsyncStorage.removeItem(LEGACY_STORAGE_USE_BIOMETRICS);
    }
  }, [
    secureStorageAvailable,
    setAppLockEnabled,
    setAppLockOwnerUserId,
    setAppLockUseBiometrics,
    setLegacyPin,
    user?.uid,
  ]);

  const updatePin = useCallback(
    async (nextPin: string) => {
      if (!user?.uid) throw new Error("Sign in to update App Lock.");
      if (!isValidPin(nextPin)) throw new Error("Enter a valid 4-digit PIN.");
      if (!secureStorageAvailable) {
        throw new Error("Secure storage is unavailable on this device.");
      }
      await SecureStore.setItemAsync(securePinKey(user.uid), nextPin);
      setSecurePin(nextPin);
      setAppLockOwnerUserId(user.uid);
    },
    [secureStorageAvailable, setAppLockOwnerUserId, user?.uid],
  );

  const setUseBiometrics = useCallback(
    async (next: boolean) => {
      setAppLockUseBiometrics(Boolean(next && isBiometricsSupported));
    },
    [isBiometricsSupported, setAppLockUseBiometrics],
  );

  const unlock = useCallback(
    async (attempt: string) => {
      if (!enabled || !securePin || attempt !== securePin) return false;
      setLocked(false);
      return true;
    },
    [enabled, securePin],
  );

  const biometricUnlock = useCallback(async () => {
    if (!canUseBiometrics) return false;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        cancelLabel: "Cancel",
        fallbackLabel: "Use PIN",
        promptMessage: "Unlock Finance Tracker",
      });
      if (!result.success) return false;
      setLocked(false);
      return true;
    } catch (error) {
      console.warn("[app-lock] Biometric unlock failed:", error);
      return false;
    }
  }, [canUseBiometrics]);

  const lock = useCallback(() => {
    if (enabled) setLocked(true);
  }, [enabled]);

  const value = useMemo<AppLockContextValue>(
    () => ({
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
      secureStorageAvailable,
      setUseBiometrics,
      unlock,
      updatePin,
      useBiometrics,
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
      secureStorageAvailable,
      setUseBiometrics,
      unlock,
      updatePin,
      useBiometrics,
    ],
  );

  return (
    <AppLockContext.Provider value={value}>
      {children}
    </AppLockContext.Provider>
  );
}

export function useAppLock() {
  const context = useContext(AppLockContext);
  if (!context) {
    throw new Error("useAppLock must be used inside AppLockProvider");
  }
  return context;
}
