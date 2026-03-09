import { AppButton } from "@/components/common/app-button";
import { AppInput } from "@/components/common/app-input";
import { Screen } from "@/components/ui/screen";
import { useAuth } from "@/hooks/use-auth";
import { ROUTES } from "@/navigation/route-names";
import { isValidEmail } from "@/utils/validators";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
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

type FormErrors = {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export function AuthScreen() {
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>("signIn");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const emailRef = useRef<TextInput | null>(null);
  const passwordRef = useRef<TextInput | null>(null);
  const confirmPasswordRef = useRef<TextInput | null>(null);

  const headerText = useMemo(
    () => (mode === "signIn" ? "Sign In" : "Create Account"),
    [mode],
  );

  const validate = () => {
    const nextErrors: FormErrors = {};

    if (mode === "signUp" && !fullName.trim()) {
      nextErrors.fullName = "Full name is required.";
    }
    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!isValidEmail(email)) {
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

  const submit = async () => {
    Keyboard.dismiss();

    if (!validate()) {
      return;
    }

    try {
      setIsSubmitting(true);
      if (mode === "signIn") {
        await signIn(email, password);
      } else {
        await signUp(fullName, email, password);
      }
      router.replace(ROUTES.TABS_HOME);
    } finally {
      setIsSubmitting(false);
    }
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
          <Text className="text-3xl font-bold text-slate-900">{headerText}</Text>
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
              <AppInput
                label="Full Name"
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  setErrors((previous) => ({ ...previous, fullName: undefined }));
                }}
                placeholder="John Doe"
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                error={errors.fullName}
              />
            ) : null}

            <AppInput
              ref={emailRef}
              label="Email Address"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setErrors((previous) => ({ ...previous, email: undefined }));
              }}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              error={errors.email}
            />

            <AppInput
              ref={passwordRef}
              label="Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setErrors((previous) => ({ ...previous, password: undefined }));
              }}
              placeholder="Enter password"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType={mode === "signUp" ? "next" : "done"}
              onSubmitEditing={() => {
                if (mode === "signUp") {
                  confirmPasswordRef.current?.focus();
                } else {
                  void submit();
                }
              }}
              error={errors.password}
            />

            {mode === "signUp" ? (
              <AppInput
                ref={confirmPasswordRef}
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setErrors((previous) => ({
                    ...previous,
                    confirmPassword: undefined,
                  }));
                }}
                placeholder="Re-enter password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => void submit()}
                error={errors.confirmPassword}
              />
            ) : null}
          </View>

          <View className="mt-8">
            <AppButton
              title={mode === "signIn" ? "Continue to App" : "Create Account"}
              onPress={() => void submit()}
              isLoading={isSubmitting}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
