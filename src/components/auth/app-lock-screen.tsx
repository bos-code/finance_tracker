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
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IconName = string;

/**
 * Render a pill-shaped status chip containing an icon and a label.
 *
 * @param icon - MaterialCommunityIcons icon name to display on the left
 * @param label - Text label shown next to the icon
 * @param iconColor - Color used for the icon
 * @param backgroundColor - Background color of the chip
 * @param borderColor - Border color of the chip
 * @param textColor - Optional text color for the label (defaults to `#334155`)
 * @returns A React element representing the styled pill-shaped chip
 */
function SecurityChip({
  icon,
  label,
  iconColor,
  backgroundColor,
  borderColor,
  textColor = "#334155",
}: {
  icon: IconName;
  label: string;
  iconColor: string;
  backgroundColor: string;
  borderColor: string;
  textColor?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor,
        borderColor,
        borderWidth: 1.5,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <MaterialCommunityIcons name={icon} size={16} color={iconColor} />
      <Text style={{ color: textColor, fontSize: 12, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}

/**
 * Renders a single PIN slot cell showing filled, empty, or active states.
 *
 * The cell displays a centered dot whose size and color reflect whether the
 * slot is filled or merely active, and applies border/background tints based
 * on the provided primary color.
 *
 * @param filled - True when the slot represents an entered digit
 * @param active - True when the slot is the current input position
 * @param primary - Hex or color string used to tint the filled/active styles
 * @returns The JSX element for the PIN slot cell
 */
function PinSlot({
  filled,
  active,
  primary,
}: {
  filled: boolean;
  active: boolean;
  primary: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        height: 60,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: filled ? primary : active ? `${primary}55` : "#dbe3ef",
        backgroundColor: filled ? `${primary}14` : active ? "#ffffff" : "#f8fafc",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {filled ? (
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: primary,
          }}
        />
      ) : (
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: active ? `${primary}30` : "#cbd5e1",
          }}
        />
      )}
    </View>
  );
}

/**
 * Renders the app lock screen UI that accepts a 4-digit PIN and optionally uses biometrics to unlock.
 *
 * The screen displays PIN slots, a numeric keypad, status chips, and a sign-out action. When biometrics
 * are available it will auto-prompt once on mount and exposes a biometric unlock action; attempting sign-out
 * shows a confirmation dialog that disables the local app lock before signing out.
 *
 * @returns A React element containing the app lock interface with PIN entry, biometric unlock controls, and sign-out UI.
 */
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
  const { height } = useWindowDimensions();

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [biometricPending, setBiometricPending] = useState(false);
  const [autoPrompted, setAutoPrompted] = useState(false);

  const canUseBiometrics = useBiometrics && isBiometricsSupported;
  const compactLayout = height < 760;
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
      style={{ flex: 1, backgroundColor: "#edf4ff", paddingTop: insets.top }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={{
          position: "absolute",
          top: -36,
          right: -28,
          width: 180,
          height: 180,
          borderRadius: 90,
          backgroundColor: `${primary}14`,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 160,
          left: -52,
          width: 160,
          height: 160,
          borderRadius: 80,
          backgroundColor: "#dbeafe",
        }}
      />

      <View
        style={{
          flex: 1,
          paddingBottom: 0,
        }}
      >
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 520,
            alignSelf: "center",
          }}
        >
          <View
            style={{
              flex: 1,
              justifyContent: compactLayout ? "flex-start" : "center",
              paddingHorizontal: 18,
              paddingTop: compactLayout ? 12 : 18,
              paddingBottom: 18,
            }}
          >
            <View
              style={{
                alignSelf: "flex-start",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.82)",
                borderWidth: 1,
                borderColor: "#dbeafe",
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <MaterialCommunityIcons name="shield-check-outline" size={16} color={primary} />
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#334155" }}>App lock active</Text>
            </View>

            <View
              style={{
                marginTop: 14,
                backgroundColor: "#ffffff",
                borderRadius: 32,
                paddingHorizontal: compactLayout ? 20 : 24,
                paddingTop: compactLayout ? 20 : 24,
                paddingBottom: compactLayout ? 18 : 22,
                borderWidth: 1,
                borderColor: "#dbeafe",
                shadowColor: "#0f172a",
                shadowOffset: { width: 0, height: 18 },
                shadowOpacity: 0.08,
                shadowRadius: 28,
                elevation: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <View
                  style={{
                    width: compactLayout ? 60 : 68,
                    height: compactLayout ? 60 : 68,
                    borderRadius: compactLayout ? 22 : 24,
                    backgroundColor: `${primary}14`,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1.5,
                    borderColor: `${primary}22`,
                  }}
                >
                  <MaterialCommunityIcons name="shield-lock-outline" size={compactLayout ? 28 : 30} color={primary} />
                </View>

                <View
                  style={{
                    borderRadius: 999,
                    backgroundColor: "#f8fafc",
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "800", color: "#475569" }}>Secure access</Text>
                </View>
              </View>

              <Text
                style={{
                  marginTop: 18,
                  fontSize: compactLayout ? 26 : 30,
                  fontWeight: "800",
                  color: "#0f172a",
                }}
              >
                Unlock to continue
              </Text>
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  lineHeight: 21,
                  color: "#64748b",
                  fontWeight: "600",
                }}
              >
                {canUseBiometrics
                  ? `Enter your 4-digit PIN or use ${biometricLabel.toLowerCase()} for quicker access.`
                  : "Enter your 4-digit PIN to return to your finances."}
              </Text>

              <View style={{ marginTop: compactLayout ? 16 : 18, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                <SecurityChip
                  icon="numeric-4-circle-outline"
                  label="4-digit PIN required"
                  iconColor={primary}
                  backgroundColor={`${primary}12`}
                  borderColor={`${primary}26`}
                />
                <SecurityChip
                  icon={canUseBiometrics ? biometricIcon : "information-outline"}
                  label={canUseBiometrics ? `${biometricLabel} ready` : "Biometrics unavailable"}
                  iconColor={canUseBiometrics ? primary : "#64748b"}
                  backgroundColor={canUseBiometrics ? "#f0fdf4" : "#f8fafc"}
                  borderColor={canUseBiometrics ? "#bbf7d0" : "#e2e8f0"}
                />
              </View>

              <View
                style={{
                  marginTop: compactLayout ? 18 : 22,
                  borderRadius: 26,
                  backgroundColor: "#f8fafc",
                  borderWidth: 1.5,
                  borderColor: "#e2e8f0",
                  padding: compactLayout ? 16 : 18,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: "#0f172a" }}>Enter PIN</Text>
                    <Text style={{ marginTop: 4, fontSize: 12, color: "#64748b", fontWeight: "600" }}>
                      {error ? "Check your PIN and try again." : "Your local fallback always works here."}
                    </Text>
                  </View>
                  <View
                    style={{
                      borderRadius: 999,
                      backgroundColor: "#ffffff",
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderWidth: 1,
                      borderColor: "#e2e8f0",
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "800", color: "#475569" }}>{pin.length}/4</Text>
                  </View>
                </View>

                <View style={{ marginTop: 16, flexDirection: "row", gap: 10 }}>
                  {[0, 1, 2, 3].map((index) => (
                    <PinSlot
                      key={index}
                      filled={Boolean(pin[index])}
                      active={index === pin.length && pin.length < 4}
                      primary={primary}
                    />
                  ))}
                </View>

                <View
                  style={{
                    marginTop: 16,
                    minHeight: 48,
                    borderRadius: 18,
                    borderWidth: 1.5,
                    borderColor: error ? "#fecdd3" : "#e2e8f0",
                    backgroundColor: error ? "#fff1f2" : "#ffffff",
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <MaterialCommunityIcons
                    name={error ? "alert-circle-outline" : "shield-check-outline"}
                    size={18}
                    color={error ? "#e11d48" : primary}
                  />
                  <Text
                    style={{
                      flex: 1,
                      color: error ? "#be123c" : "#475569",
                      fontSize: 12,
                      fontWeight: "700",
                      lineHeight: 18,
                    }}
                  >
                    {error ?? "The app locks again whenever it leaves the foreground."}
                  </Text>
                </View>

                {canUseBiometrics ? (
                  <TouchableOpacity
                    onPress={triggerBiometricUnlock}
                    disabled={biometricPending}
                    style={{
                      marginTop: 14,
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
                        <MaterialCommunityIcons name={biometricIcon} size={20} color={primary} />
                        <Text style={{ color: primary, fontWeight: "800", fontSize: 14 }}>Use {biometricLabel} instead</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
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
            biometricIconName={biometricIcon}
            pinPresentation="drawer"
            bottomInset={Math.max(insets.bottom, 14)}
            title="Security keypad"
            subtitle={
              canUseBiometrics
                ? `Tap a digit or use ${biometricLabel.toLowerCase()} from the quick action.`
                : "Tap the digits below to enter your PIN."
            }
            footer={
              <>
                <Pressable
                  onPress={handleSignOut}
                  style={{
                    borderRadius: 18,
                    backgroundColor: "#fff1f2",
                    borderWidth: 1.5,
                    borderColor: "#fecdd3",
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <MaterialCommunityIcons name="logout" size={18} color="#e11d48" />
                  <Text style={{ color: "#e11d48", fontWeight: "800", fontSize: 13 }}>Sign out instead</Text>
                </Pressable>

                <Text
                  style={{
                    textAlign: "center",
                    fontSize: 11,
                    lineHeight: 16,
                    color: "#94a3b8",
                    fontWeight: "700",
                  }}
                >
                  Signing out removes the local app lock and returns to the auth flow.
                </Text>
              </>
            }
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
