import { useAppLock } from "@/context/app-lock-context";
import { useAuth } from "@/hooks/use-auth";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function AppLockScreen() {
  const { unlock, setEnabled } = useAppLock();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

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

        <View style={{ marginTop: 24 }}>
          <TextInput
            value={pin}
            onChangeText={handleChange}
            placeholder="••••"
            placeholderTextColor="#cbd5e1"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            textAlign="center"
            className="h-[56px] px-5 bg-[#f8fafc] rounded-2xl text-[20px] text-[#0b1220] font-semibold border border-[#f1f5f9]"
          />
          {error && (
            <Text style={{ marginTop: 8, textAlign: "center", color: "#ef4444", fontSize: 12, fontWeight: "600" }}>
              {error}
            </Text>
          )}
        </View>

        <Pressable onPress={handleSignOut} style={{ marginTop: 16 }}>
          <Text style={{ textAlign: "center", color: "#ef4444", fontWeight: "700", fontSize: 13 }}>
            Sign out
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
