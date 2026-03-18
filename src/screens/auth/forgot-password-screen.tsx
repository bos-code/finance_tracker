import { ROUTES } from "@/navigation/route-names";
import { supabaseResetPassword } from "@/services/supabase/auth-service";
import { isValidEmail } from "@/utils/validators";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useState } from "react";
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

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isSuccess, setIsSuccess] = useState(false);

  const submit = async () => {
    Keyboard.dismiss();

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const resetUrl = Linking.createURL("/update-password");
      
      await supabaseResetPassword(email, resetUrl);
      setIsSuccess(true);
    } catch (err: any) {
      Alert.alert(
        "Reset Failed",
        err?.message || "An unexpected error occurred. Please try again."
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
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 60, paddingBottom: 48 }}
        >
          {/* Header Section */}
          <View className="mb-10 items-start">
            <Pressable
              onPress={() => router.back()}
              className="h-10 w-10 rounded-full bg-[#f8fafc] border border-[#f1f5f9] items-center justify-center mb-8"
            >
              <Text className="text-[#64748b] text-lg font-bold">←</Text>
            </Pressable>
            <Text className="text-[28px] font-extrabold text-[#0b1220] tracking-tight">Reset Password</Text>
            <Text className="mt-2 text-[15px] text-[#64748b] max-w-[90%] leading-relaxed">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </Text>
          </View>

          {isSuccess ? (
            <View className="bg-green-50 rounded-2xl p-6 border border-green-200 mt-4">
              <Text className="text-green-800 font-bold text-lg mb-2">Check your inbox</Text>
              <Text className="text-green-700 text-[15px] leading-relaxed">
                If an account exists for {email}, we&apos;ve sent instructions on how to reset your password.
              </Text>
              <Pressable
                onPress={() => router.replace(ROUTES.AUTH as any)}
                className="mt-6 h-[48px] bg-green-600 rounded-xl items-center justify-center"
              >
                <Text className="text-white font-bold text-[15px]">Return to Sign In</Text>
              </Pressable>
            </View>
          ) : (
            <View className="gap-5">
              <View>
                <Text className="text-[13px] font-bold text-[#475569] mb-2 ml-1">Email Address</Text>
                <TextInput
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setError(undefined);
                  }}
                  placeholder="you@example.com"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
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
              <View className="mt-6 mb-6">
                <Pressable
                  onPress={() => void submit()}
                  disabled={isSubmitting}
                  className={`h-[56px] rounded-2xl items-center justify-center flex-row ${
                    isSubmitting ? "bg-blue-400" : "bg-blue-600"
                  }`}
                  style={{
                    shadowColor: "#2563eb",
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.25,
                    shadowRadius: 16,
                    elevation: 8,
                  }}
                >
                  <Text className="text-white font-bold text-[16px] tracking-wide">
                    {isSubmitting ? "Sending Link..." : "Send Reset Link"}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
