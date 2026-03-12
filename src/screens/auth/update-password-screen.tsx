import { useAuth } from "@/hooks/use-auth";
import { ROUTES } from "@/navigation/route-names";
import { supabaseClient } from "@/services/supabase/supabase-client";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function UpdatePasswordScreen() {
  const { signOut } = useAuth();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  
  const confirmPasswordRef = useRef<TextInput | null>(null);

  const submit = async () => {
    Keyboard.dismiss();

    if (!password.trim()) {
      setError("Password is required.");
      return;
    }
    
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const { error: updateError } = await supabaseClient.auth.updateUser({ password });
      
      if (updateError) {
        throw updateError;
      }
      
      Alert.alert("Success", "Your password has been securely updated.", [
        {
          text: "Log In",
          onPress: async () => {
             // Force sign out to clear session states and reroute correctly
             await signOut();
             router.replace(ROUTES.AUTH as any);
          }
        }
      ]);

    } catch (err: any) {
      Alert.alert(
        "Update Failed",
        err?.message || "An unexpected error occurred. Your recovery link may have expired."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "white" }}
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 80, paddingBottom: 48 }}
        >
          {/* Header Section */}
          <View className="mb-10 items-start">
            <View className="h-14 w-14 bg-green-50 rounded-2xl items-center justify-center mb-6 border border-green-100">
               {/* Padlock Icon visual abstraction */}
               <Text className="text-green-600 text-[26px]">🔒</Text>
            </View>
            <Text className="text-[28px] font-extrabold text-[#0b1220] tracking-tight">Set New Password</Text>
            <Text className="mt-2 text-[15px] text-[#64748b] leading-relaxed pr-4">
              Your identity has been verified. Please enter a strong new password to secure your account.
            </Text>
          </View>

          <View className="gap-5">
            <View>
              <Text className="text-[13px] font-bold text-[#475569] mb-2 ml-1">New Password</Text>
              <TextInput
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError(undefined);
                }}
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                selectionColor="#2563eb"
                className={`h-[56px] px-5 bg-[#f8fafc] rounded-2xl text-[15px] text-[#0b1220] font-medium border ${
                  error ? "border-red-400 bg-red-50" : "border-[#f1f5f9]"
                }`}
              />
            </View>

            <View>
              <Text className="text-[13px] font-bold text-[#475569] mb-2 ml-1">Confirm New Password</Text>
              <TextInput
                ref={confirmPasswordRef}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setError(undefined);
                }}
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => void submit()}
                selectionColor="#2563eb"
                className={`h-[56px] px-5 bg-[#f8fafc] rounded-2xl text-[15px] text-[#0b1220] font-medium border ${
                  error ? "border-red-400 bg-red-50" : "border-[#f1f5f9]"
                }`}
              />
              {error && <Text className="text-red-500 text-xs mt-1.5 ml-1 font-medium">{error}</Text>}
            </View>

            {/* Primary Action Button */}
            <View className="mt-8 mb-6">
              <Pressable
                onPress={() => void submit()}
                disabled={isSubmitting}
                className={`h-[56px] rounded-2xl items-center justify-center flex-row ${
                  isSubmitting ? "bg-green-400" : "bg-green-600"
                }`}
                style={{
                  shadowColor: "#16a34a",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.25,
                  shadowRadius: 16,
                  elevation: 8,
                }}
              >
                <Text className="text-white font-bold text-[16px] tracking-wide">
                  {isSubmitting ? "Securing Account..." : "Update Password"}
                </Text>
              </Pressable>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
