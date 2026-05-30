import { useAuth } from "@/hooks/use-auth";
import { ROUTES } from "@/navigation/route-names";
import { isValidEmail } from "@/utils/validators";
import * as Google from "expo-auth-session/providers/google";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { useEffect, useMemo, useRef, useState } from "react";
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

function getAuthErrorMessage(error: unknown) {
  const text = error instanceof Error ? error.message.toLowerCase() : "";
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  if (code.includes("auth/network-request-failed")) {
    return "Network error. Check your internet connection and try again.";
  }
  if (code.includes("auth/invalid-credential")) {
    return "Invalid credentials. Please check your email and password.";
  }
  if (code.includes("auth/user-not-found")) {
    return "No account found for this email address.";
  }
  if (code.includes("auth/wrong-password")) {
    return "Incorrect password.";
  }
  if (code.includes("auth/email-already-in-use")) {
    return "This email is already in use.";
  }
  if (code.includes("invalid_request") || text.includes("invalid request")) {
    return "Google sign-in is misconfigured. Check your OAuth client IDs.";
  }

  return "Authentication failed. Please try again.";
}

WebBrowser.maybeCompleteAuthSession();

export function AuthScreen() {
  const { signIn, signInWithGoogle, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>("signIn");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const insets = useSafeAreaInsets();

  const emailRef = useRef<TextInput | null>(null);
  const passwordRef = useRef<TextInput | null>(null);
  const confirmPasswordRef = useRef<TextInput | null>(null);

  const headerText = useMemo(
    () => (mode === "signIn" ? "Sign In" : "Create Account"),
    [mode],
  );
  const googleConfig = Constants.expoConfig?.extra as
    | {
        googleExpoClientId?: string;
        googleIosClientId?: string;
        googleAndroidClientId?: string;
        googleWebClientId?: string;
      }
    | undefined;
  const hasGoogleClientId = Boolean(
    googleConfig?.googleExpoClientId ||
      googleConfig?.googleIosClientId ||
      googleConfig?.googleAndroidClientId ||
      googleConfig?.googleWebClientId,
  );

  const [googleRequest, googleResponse, promptGoogleSignIn] =
    Google.useIdTokenAuthRequest({
      expoClientId: googleConfig?.googleExpoClientId,
      iosClientId: googleConfig?.googleIosClientId,
      androidClientId: googleConfig?.googleAndroidClientId,
      webClientId: googleConfig?.googleWebClientId,
    });

  useEffect(() => {
    const syncGoogleSession = async () => {
      if (!googleResponse) {
        return;
      }
      if (googleResponse.type === "error") {
        setAuthError(
          "Google sign-in request failed. Verify OAuth client IDs and redirect settings.",
        );
        return;
      }
      if (googleResponse.type !== "success") {
        return;
      }

      const idToken = googleResponse.params.id_token;
      if (!idToken) {
        return;
      }

      try {
        setIsGoogleSubmitting(true);
        setAuthError(null);
        await signInWithGoogle({ idToken });
        router.replace(ROUTES.TABS_HOME);
      } catch (error) {
        setAuthError(getAuthErrorMessage(error));
      } finally {
        setIsGoogleSubmitting(false);
      }
    };

    void syncGoogleSession();
  }, [googleResponse, signInWithGoogle]);

  const handleGoogleSignInPress = async () => {
    if (!hasGoogleClientId) {
      setAuthError(
        "Google OAuth client IDs are missing in app.json (expo.extra).",
      );
      return;
    }
    if (!googleRequest) {
      setAuthError(
        "Google sign-in is not ready yet. Wait a moment and try again.",
      );
      return;
    }
    try {
      setAuthError(null);
      await promptGoogleSignIn();
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
    }
  };

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
      setAuthError(null);
      if (mode === "signIn") {
        await signIn(email, password);
      } else {
        await signUp(fullName, email, password);
      }
      router.replace(ROUTES.TABS_HOME);
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
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

          <View
            className="mt-6 rounded-3xl border border-white/70 p-4"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.68)",
              shadowColor: "#0f172a",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.18,
              shadowRadius: 18,
              elevation: 4,
            }}>
            <View className="flex-row rounded-xl bg-slate-200/80 p-1">
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

            {authError ? (
              <Text className="mt-3 text-center text-sm text-red-600">{authError}</Text>
            ) : null}

            <Pressable
              disabled={isGoogleSubmitting}
              onPress={() => void handleGoogleSignInPress()}
              className={`mt-3 rounded-xl border border-slate-300 px-4 py-4 ${
                isGoogleSubmitting ? "bg-slate-200/80" : "bg-white/80"
              }`}>
              <Text className="text-center text-base font-semibold text-slate-800">
                {isGoogleSubmitting ? "Connecting Google..." : "Continue with Google"}
              </Text>
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
