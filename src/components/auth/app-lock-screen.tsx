import { useAppLock } from "@/context/app-lock-context";
import { useAuth } from "@/hooks/use-auth";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UnifiedNumpad } from "@/components/ui/unified-numpad";
import { useAppStore } from "@/store/use-app-store";

export function AppLockScreen() {
  const { unlock, setEnabled, useBiometrics, isBiometricsSupported, biometricUnlock } = useAppLock();
  const { signOut } = useAuth();
  const theme = useAppStore(s => s.theme);
  const primary = theme.primary;
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (useBiometrics && isBiometricsSupported) {
      biometricUnlock();
    }
  }, [useBiometrics, isBiometricsSupported, biometricUnlock]);

  const handleChange = async (value: string) => {
    const digits = value.replace(/[^0-9]/g, "").slice(0, 4);
    setPin(digits);
    setError(null);
    if (digits.length === 4) {
      const ok = await unlock(digits);
      if (!ok) {
        setError("Incorrect PIN. Try again.");
        setPin("");
      }
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign out?",
      "Signing out will disable App Lock for this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            await setEnabled(false);
            await signOut();
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff", paddingTop: insets.top }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={{ flex: 1, paddingHorizontal: 28, justifyContent: "center" }}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: "#0f172a", textAlign: "center" }}>
          App Locked
        </Text>
        <Text style={{ marginTop: 8, fontSize: 14, color: "#64748b", textAlign: "center" }}>
          Enter your 4-digit PIN to continue
        </Text>

        <View style={{ marginTop: 32, alignItems: "center" }}>
          <View style={{ flexDirection: "row" }}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: pin[i] ? primary : "#e2e8f0",
                  transform: [{ scale: pin[i] ? 1.2 : 1 }],
                  marginHorizontal: 10,
                }}
              />
            ))}
          </View>
          {error && (
            <Text style={{ marginTop: 24, textAlign: "center", color: "#ef4444", fontSize: 13, fontWeight: "600" }}>
              {error}
            </Text>
          )}
        </View>

        <View style={{ flex: 1 }} />

        <UnifiedNumpad
          value={pin}
          onChange={handleChange}
          mode="pin"
          maxLength={4}
          showBiometric={useBiometrics && isBiometricsSupported}
          onBiometricPress={biometricUnlock}
        />

        <Pressable onPress={handleSignOut} style={{ marginTop: 16 }}>
          <Text style={{ textAlign: "center", color: "#ef4444", fontWeight: "700", fontSize: 13 }}>
            Sign out
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
