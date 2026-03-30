import { UnifiedNumpad } from "@/components/ui/unified-numpad";
import { useAppLock } from "@/context/app-lock-context";
import { useAuth } from "@/hooks/use-auth";
import { useAppStore } from "@/store/use-app-store";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function AppLockScreen() {
  const {
    unlock,
    disableLock,
    useBiometrics,
    isBiometricsSupported,
    biometricLabel,
    biometricUnlock,
  } = useAppLock();
  const { signOut } = useAuth();
  const theme = useAppStore((s) => s.theme);
  const primary = theme.primary;
  const insets = useSafeAreaInsets();

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [biometricPending, setBiometricPending] = useState(false);
  const [autoPrompted, setAutoPrompted] = useState(false);

  const canUseBiometrics = useBiometrics && isBiometricsSupported;
  const biometricIcon = useMemo(
    () => (biometricLabel.toLowerCase().includes("face") ? "face-recognition" : "fingerprint"),
    [biometricLabel],
  );

  const triggerBiometricUnlock = useCallback(async () => {
    if (!canUseBiometrics || biometricPending) return;

    setBiometricPending(true);
    try {
      await biometricUnlock();
    } finally {
      setBiometricPending(false);
    }
  }, [biometricPending, biometricUnlock, canUseBiometrics]);

  useEffect(() => {
    if (!canUseBiometrics || autoPrompted) return;
    setAutoPrompted(true);
    void triggerBiometricUnlock();
  }, [autoPrompted, canUseBiometrics, triggerBiometricUnlock]);

  const handleChange = async (value: string) => {
    const digits = value.replace(/[^0-9]/g, "").slice(0, 4);
    setPin(digits);
    setError(null);

    if (digits.length !== 4) return;

    const ok = await unlock(digits);
    if (!ok) {
      setError("Incorrect PIN. Try again.");
      setPin("");
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign out?", "Signing out will disable App Lock for this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await disableLock();
          await signOut();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#eef4ff", paddingTop: insets.top }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={{ flex: 1, paddingHorizontal: 22, paddingBottom: Math.max(insets.bottom, 18) }}>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <View
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 34,
              paddingHorizontal: 24,
              paddingTop: 28,
              paddingBottom: 24,
              shadowColor: "#0f172a",
              shadowOffset: { width: 0, height: 18 },
              shadowOpacity: 0.1,
              shadowRadius: 28,
              elevation: 10,
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 26,
                backgroundColor: `${primary}14`,
                alignItems: "center",
                justifyContent: "center",
                alignSelf: "center",
                borderWidth: 1.5,
                borderColor: `${primary}22`,
              }}
            >
              <MaterialCommunityIcons name="shield-lock-outline" size={32} color={primary} />
            </View>

            <Text style={{ marginTop: 16, fontSize: 12, fontWeight: "800", color: primary, textAlign: "center", letterSpacing: 1 }}>
              PROTECTED SPACE
            </Text>
            <Text style={{ marginTop: 8, fontSize: 27, fontWeight: "800", color: "#0f172a", textAlign: "center" }}>
              Unlock Finance Tracker
            </Text>
            <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 21, color: "#64748b", textAlign: "center" }}>
              {canUseBiometrics
                ? `Use your 4-digit PIN or ${biometricLabel.toLowerCase()} to continue.`
                : "Enter your 4-digit PIN to continue."}
            </Text>

            <View style={{ marginTop: 24, flexDirection: "row", gap: 12 }}>
              <View
                style={{
                  flex: 1,
                  borderRadius: 22,
                  backgroundColor: "#f8fafc",
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  borderWidth: 1.5,
                  borderColor: "#e2e8f0",
                }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
                  <MaterialCommunityIcons name="lock-outline" size={18} color="#475569" />
                </View>
                <Text style={{ marginTop: 12, fontSize: 15, fontWeight: "800", color: "#0f172a" }}>PIN</Text>
                <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 18, color: "#64748b", fontWeight: "600" }}>
                  Always available as your fallback unlock method.
                </Text>
              </View>
              {canUseBiometrics ? (
                <View
                  style={{
                    flex: 1,
                    borderRadius: 22,
                    backgroundColor: `${primary}0f`,
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    borderWidth: 1.5,
                    borderColor: `${primary}24`,
                  }}
                >
                  <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
                    <MaterialCommunityIcons name={biometricIcon as any} size={18} color={primary} />
                  </View>
                  <Text style={{ marginTop: 12, fontSize: 15, fontWeight: "800", color: "#0f172a" }}>{biometricLabel}</Text>
                  <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 18, color: "#64748b", fontWeight: "600" }}>
                    Faster access when you want a quick secure shortcut.
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={{ marginTop: 28, alignItems: "center" }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                {[0, 1, 2, 3].map((index) => {
                  const filled = Boolean(pin[index]);
                  return (
                    <View
                      key={index}
                      style={{
                        width: 54,
                        height: 58,
                        borderRadius: 18,
                        backgroundColor: filled ? `${primary}14` : "#f8fafc",
                        borderWidth: 1.5,
                        borderColor: filled ? primary : "#e2e8f0",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {filled ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: primary }} /> : null}
                    </View>
                  );
                })}
              </View>

              {error ? (
                <View
                  style={{
                    marginTop: 18,
                    minHeight: 46,
                    borderRadius: 16,
                    backgroundColor: "#fff1f2",
                    borderWidth: 1.5,
                    borderColor: "#fecdd3",
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#e11d48" />
                  <Text style={{ flex: 1, color: "#be123c", fontSize: 13, fontWeight: "700" }}>{error}</Text>
                </View>
              ) : (
                <View
                  style={{
                    marginTop: 18,
                    minHeight: 46,
                    borderRadius: 16,
                    backgroundColor: "#f8fafc",
                    borderWidth: 1.5,
                    borderColor: "#e2e8f0",
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <MaterialCommunityIcons name="shield-check-outline" size={18} color={primary} />
                  <Text style={{ flex: 1, color: "#475569", fontSize: 13, fontWeight: "700" }}>
                    Your finances stay protected whenever the app leaves the foreground.
                  </Text>
                </View>
              )}
            </View>

            {canUseBiometrics ? (
              <TouchableOpacity
                onPress={triggerBiometricUnlock}
                disabled={biometricPending}
                style={{
                  marginTop: 22,
                  height: 52,
                  borderRadius: 18,
                  borderWidth: 1.5,
                  borderColor: `${primary}30`,
                  backgroundColor: `${primary}12`,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 10,
                }}
              >
                {biometricPending ? (
                  <ActivityIndicator color={primary} />
                ) : (
                  <>
                    <MaterialCommunityIcons name={biometricIcon as any} size={20} color={primary} />
                    <Text style={{ color: primary, fontWeight: "800", fontSize: 14 }}>Use {biometricLabel}</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <UnifiedNumpad
          value={pin}
          onChange={handleChange}
          mode="pin"
          maxLength={4}
          showBiometric={canUseBiometrics}
          onBiometricPress={triggerBiometricUnlock}
          biometricLabel={biometricLabel}
          biometricIconName={biometricIcon as any}
          title="Security keypad"
          subtitle={canUseBiometrics ? `Tap digits or use ${biometricLabel.toLowerCase()} from the action key.` : "Tap the digits below to enter your PIN."}
        />

        <Pressable
          onPress={handleSignOut}
          style={{
            marginTop: 16,
            paddingVertical: 12,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: "#fecdd3",
            backgroundColor: "#fff1f2",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <MaterialCommunityIcons name="logout" size={18} color="#e11d48" />
          <Text style={{ color: "#e11d48", fontWeight: "800", fontSize: 13 }}>Sign out</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
