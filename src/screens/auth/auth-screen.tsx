import { useAuth } from "@/hooks/use-auth";
import { ROUTES } from "@/navigation/route-names";
import { isValidEmail } from "@/utils/validators";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type Mode = "signIn" | "signUp";

type FormErrors = {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

/**
 * Extracts a human-readable message from an unknown error value.
 *
 * @param error - An error value of any shape (string or object) from which to derive a message.
 * @returns The extracted message if present (`message`, `error_description`, `error.message`, or `error.error_description`), otherwise `undefined`.
 */
function getErrorMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const anyError = error as any;
    return (
      anyError?.message ??
      anyError?.error_description ??
      anyError?.error?.message ??
      anyError?.error?.error_description
    );
  }
  return undefined;
}

/**
 * Detects whether an unknown error indicates invalid authentication credentials.
 *
 * @param error - Any thrown value or error-like object; its `message` or `code` (if present) will be inspected.
 * @returns `true` if the error's code or message contains indicators of invalid credentials (for example `invalid_credentials`, `invalid login credentials`, or `invalid credentials`), `false` otherwise.
 */
function isInvalidCredentialsError(error: unknown) {
  const message = (getErrorMessage(error) || "").toLowerCase();
  const code =
    typeof error === "object" && error
      ? String((error as any)?.code ?? "").toLowerCase()
      : "";
  return (
    code.includes("invalid_credentials") ||
    message.includes("invalid login credentials") ||
    message.includes("invalid credentials")
  );
}

/**
 * Renders an authentication screen that supports both sign-in and sign-up flows.
 *
 * Displays a segmented control to switch modes, validates form fields, shows field-level
 * and submission errors, and submits credentials to authenticate or create an account.
 *
 * @returns The rendered authentication screen JSX element
 */
export function AuthScreen() {
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>("signIn");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const insets = useSafeAreaInsets();

  const emailRef = useRef<TextInput | null>(null);
  const passwordRef = useRef<TextInput | null>(null);
  const confirmPasswordRef = useRef<TextInput | null>(null);

  const headerText = useMemo(
    () => (mode === "signIn" ? "Welcome Back" : "Create Account"),
    [mode],
  );
  
  const subHeaderText = useMemo(
    () => (mode === "signIn" ? "Sign in to your account to continue" : "Start your financial journey with us"),
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
    setSubmitError(null);

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
    } catch (error: unknown) {
      if (mode === "signIn" && isInvalidCredentialsError(error)) {
        setSubmitError("Invalid email and/or password.");
        return;
      }

      const message = getErrorMessage(error);
      if (message) {
        setSubmitError(message);
        return;
      }

      Alert.alert(
        mode === "signIn" ? "Sign In Failed" : "Sign Up Failed",
        "An unexpected error occurred. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: 'white' }}
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <ScrollView
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 60, paddingBottom: 48, flexGrow: 1 }}
        >
          {/* Header Section */}
          <View className="mb-10 items-center">
            <View className="h-16 w-16 bg-blue-50 rounded-2xl items-center justify-center mb-6">
               <Text className="text-blue-600 text-3xl font-bold">F</Text>
            </View>
            <Text className="text-[28px] font-extrabold text-[#0b1220] tracking-tight">{headerText}</Text>
            <Text className="mt-2 text-[15px] text-[#64748b] text-center max-w-[80%]">
              {subHeaderText}
            </Text>
          </View>

          {/* Premium Segmented Control */}
          <View className="flex-row rounded-full bg-[#f8fafc] p-[4px] mb-8 border border-[#f1f5f9]">
            <Pressable
              onPress={() => {
                setMode("signIn");
                setErrors({});
                setSubmitError(null);
              }}
              className={`flex-1 rounded-full py-3.5 items-center justify-center ${
                mode === "signIn" ? "bg-white" : ""
              }`}
              style={mode === "signIn" ? {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 2,
              } : undefined}
            >
              <Text
                className={`text-center font-bold text-[15px] ${
                  mode === "signIn" ? "text-[#0b1220]" : "text-[#94a3b8]"
                }`}
              >
                Sign In
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMode("signUp");
                setErrors({});
                setSubmitError(null);
              }}
              className={`flex-1 rounded-full py-3.5 items-center justify-center ${
                mode === "signUp" ? "bg-white" : ""
              }`}
              style={mode === "signUp" ? {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 2,
              } : undefined}
            >
              <Text
                className={`text-center font-bold text-[15px] ${
                  mode === "signUp" ? "text-[#0b1220]" : "text-[#94a3b8]"
                }`}
              >
                Sign Up
              </Text>
            </Pressable>
          </View>

          {!!submitError && (
            <View className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <Text className="text-[13px] font-semibold text-red-700">{submitError}</Text>
            </View>
          )}

          {/* Form Fields */}
          <View className="gap-5">
            {mode === "signUp" && (
              <View>
                <Text className="text-[13px] font-bold text-[#475569] mb-2 ml-1">Full Name</Text>
                <TextInput
                  value={fullName}
                  onChangeText={(text) => {
                    setFullName(text);
                    setErrors((previous) => ({ ...previous, fullName: undefined }));
                    setSubmitError(null);
                  }}
                  placeholder="John Doe"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                  selectionColor="#2563eb"
                  className={`h-[56px] px-5 bg-[#f8fafc] rounded-2xl text-[15px] text-[#0b1220] font-medium border ${
                    errors.fullName ? "border-red-400 bg-red-50" : "border-[#f1f5f9]"
                  }`}
                />
                {errors.fullName && <Text className="text-red-500 text-xs mt-1.5 ml-1 font-medium">{errors.fullName}</Text>}
              </View>
            )}

            <View>
              <Text className="text-[13px] font-bold text-[#475569] mb-2 ml-1">Email Address</Text>
              <TextInput
                ref={emailRef}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setErrors((previous) => ({ ...previous, email: undefined }));
                  setSubmitError(null);
                }}
                placeholder="you@example.com"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                selectionColor="#2563eb"
                className={`h-[56px] px-5 bg-[#f8fafc] rounded-2xl text-[15px] text-[#0b1220] font-medium border ${
                  errors.email ? "border-red-400 bg-red-50" : "border-[#f1f5f9]"
                }`}
              />
              {errors.email && <Text className="text-red-500 text-xs mt-1.5 ml-1 font-medium">{errors.email}</Text>}
            </View>

            <View>
              <Text className="text-[13px] font-bold text-[#475569] mb-2 ml-1">Password</Text>
              <TextInput
                ref={passwordRef}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setErrors((previous) => ({ ...previous, password: undefined }));
                  setSubmitError(null);
                }}
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
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
                selectionColor="#2563eb"
                className={`h-[56px] px-5 bg-[#f8fafc] rounded-2xl text-[15px] text-[#0b1220] font-medium border ${
                  errors.password ? "border-red-400 bg-red-50" : "border-[#f1f5f9]"
                }`}
              />
              {errors.password && <Text className="text-red-500 text-xs mt-1.5 ml-1 font-medium">{errors.password}</Text>}
              
              {mode === "signIn" && (
                <Pressable 
                  className="mt-4 self-end pr-1"
                  onPress={() => router.push(ROUTES.FORGOT_PASSWORD as any)}
                >
                  <Text className="text-[#2563eb] font-bold text-[13px]">Forgot Password?</Text>
                </Pressable>
              )}
            </View>

            {mode === "signUp" && (
              <View>
                <Text className="text-[13px] font-bold text-[#475569] mb-2 ml-1">Confirm Password</Text>
                <TextInput
                  ref={confirmPasswordRef}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setErrors((previous) => ({
                    ...previous,
                    confirmPassword: undefined,
                  }));
                  setSubmitError(null);
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
                    errors.confirmPassword ? "border-red-400 bg-red-50" : "border-[#f1f5f9]"
                  }`}
                />
                {errors.confirmPassword && <Text className="text-red-500 text-xs mt-1.5 ml-1 font-medium">{errors.confirmPassword}</Text>}
              </View>
            )}
          </View>

          {/* Primary Action Button */}
          <View className="mt-10 mb-6">
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
                {isSubmitting ? "Please wait..." : (mode === "signIn" ? "Sign In" : "Create Account")}
              </Text>
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
