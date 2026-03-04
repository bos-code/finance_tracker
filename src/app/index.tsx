import { Screen } from "@/components/ui/screen";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

type Mode = "signIn" | "signUp";

export default function Index() {
  const [mode, setMode] = useState<Mode>("signIn");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const emailRef = useRef<TextInput | null>(null);
  const passwordRef = useRef<TextInput | null>(null);
  const confirmPasswordRef = useRef<TextInput | null>(null);

  const validate = () => {
    const nextErrors: typeof errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (mode === "signUp" && !fullName.trim()) {
      nextErrors.fullName = "Full name is required.";
    }
    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!emailRegex.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!password.trim()) {
      nextErrors.password = "Password is required.";
    }
    if (mode === "signUp") {
      if (!confirmPassword.trim()) {
        nextErrors.confirmPassword = "Confirm your password.";
      } else if (confirmPassword !== password) {
        nextErrors.confirmPassword = "Passwords do not match.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = () => {
    Keyboard.dismiss();
    if (!validate()) {
      return;
    }
    router.replace("/(tabs)/home");
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 24, paddingBottom: 48 }}>
          <Text className="text-3xl font-bold text-slate-900">
            {mode === "signIn" ? "Sign In" : "Sign Up"}
          </Text>
          <Text className="mt-2 text-sm text-slate-600">
            Continue to your finance dashboard.
          </Text>

          <View className="mt-6 flex-row rounded-xl bg-slate-200 p-1">
            <Pressable
              onPress={() => {
                setMode("signIn");
                setErrors({});
              }}
              className={`flex-1 rounded-lg px-4 py-3 ${
                mode === "signIn" ? "bg-blue-700" : ""
              }`}>
              <Text
                className={`text-center font-semibold ${
                  mode === "signIn" ? "text-white" : "text-slate-700"
                }`}>
                Sign In
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMode("signUp");
                setErrors({});
              }}
              className={`flex-1 rounded-lg px-4 py-3 ${
                mode === "signUp" ? "bg-blue-700" : ""
              }`}>
              <Text
                className={`text-center font-semibold ${
                  mode === "signUp" ? "text-white" : "text-slate-700"
                }`}>
                Sign Up
              </Text>
            </Pressable>
          </View>

          <View className="mt-8 gap-5">
            {mode === "signUp" ? (
              <View>
                <Text className="mb-2 text-sm font-medium text-slate-700">
                  Full Name
                </Text>
                <TextInput
                  value={fullName}
                  onChangeText={(text) => {
                    setFullName(text);
                    setErrors((prev) => ({ ...prev, fullName: undefined }));
                  }}
                  placeholder="John Doe"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                  className={`rounded-xl border bg-white px-4 py-3 text-base text-slate-900 ${
                    errors.fullName ? "border-red-400" : "border-slate-300"
                  }`}
                />
                {errors.fullName ? (
                  <Text className="mt-1 text-xs text-red-500">
                    {errors.fullName}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View>
              <Text className="mb-2 text-sm font-medium text-slate-700">
                Email Address
              </Text>
              <TextInput
                ref={emailRef}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                placeholder="you@example.com"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                className={`rounded-xl border bg-white px-4 py-3 text-base text-slate-900 ${
                  errors.email ? "border-red-400" : "border-slate-300"
                }`}
              />
              {errors.email ? (
                <Text className="mt-1 text-xs text-red-500">
                  {errors.email}
                </Text>
              ) : null}
            </View>

            <View>
              <Text className="mb-2 text-sm font-medium text-slate-700">
                Password
              </Text>
              <TextInput
                ref={passwordRef}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                placeholder="Enter password"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType={mode === "signUp" ? "next" : "done"}
                onSubmitEditing={() => {
                  if (mode === "signUp") {
                    confirmPasswordRef.current?.focus();
                  } else {
                    submit();
                  }
                }}
                className={`rounded-xl border bg-white px-4 py-3 text-base text-slate-900 ${
                  errors.password ? "border-red-400" : "border-slate-300"
                }`}
              />
              {errors.password ? (
                <Text className="mt-1 text-xs text-red-500">
                  {errors.password}
                </Text>
              ) : null}
            </View>

            {mode === "signUp" ? (
              <View>
                <Text className="mb-2 text-sm font-medium text-slate-700">
                  Confirm Password
                </Text>
                <TextInput
                  ref={confirmPasswordRef}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setErrors((prev) => ({
                      ...prev,
                      confirmPassword: undefined,
                    }));
                  }}
                  placeholder="Re-enter password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={submit}
                  className={`rounded-xl border bg-white px-4 py-3 text-base text-slate-900 ${
                    errors.confirmPassword
                      ? "border-red-400"
                      : "border-slate-300"
                  }`}
                />
                {errors.confirmPassword ? (
                  <Text className="mt-1 text-xs text-red-500">
                    {errors.confirmPassword}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>

          <Pressable
            onPress={submit}
            className="mt-8 rounded-xl bg-blue-700 px-4 py-4">
            <Text className="text-center text-base font-semibold text-white">
              {mode === "signIn" ? "Continue to App" : "Create Account"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
