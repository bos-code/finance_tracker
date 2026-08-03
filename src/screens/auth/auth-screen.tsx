import { AuthShell } from "@/components/auth/auth-shell";
import { ActionButton } from "@/components/finance/action-button";
import { FinanceField } from "@/components/finance/finance-field";
import { SegmentedControl } from "@/components/finance/segmented-control";
import { detectRegionalDefaults } from "@/features/profile/region-defaults";
import { useAuth } from "@/hooks/use-auth";
import { ROUTES } from "@/navigation/route-names";
import { CURRENCY_OPTIONS } from "@/store/use-app-store";
import { palette, withAlpha } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { isValidEmail } from "@/utils/validators";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Mode = "signIn" | "signUp";

type FormErrors = {
  confirmPassword?: string;
  email?: string;
  fullName?: string;
  password?: string;
};

const MODE_OPTIONS = [
  { label: "Sign in", value: "signIn" },
  { label: "Create account", value: "signUp" },
] satisfies { label: string; value: Mode }[];

function getErrorMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const candidate = error as {
      code?: string;
      error?: { error_description?: string; message?: string };
      error_description?: string;
      message?: string;
    };
    return (
      candidate.message ??
      candidate.error_description ??
      candidate.error?.message ??
      candidate.error?.error_description
    );
  }
  return undefined;
}

function isInvalidCredentialsError(error: unknown) {
  const message = (getErrorMessage(error) || "").toLocaleLowerCase();
  const code =
    typeof error === "object" && error
      ? String((error as { code?: string }).code ?? "").toLocaleLowerCase()
      : "";
  return (
    code.includes("invalid_credentials") ||
    message.includes("invalid login credentials") ||
    message.includes("invalid credentials")
  );
}

function VisibilityButton({
  onPress,
  visible,
}: {
  onPress: () => void;
  visible: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={visible ? "Hide password" : "Show password"}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 6 })}>
      <MaterialCommunityIcons
        color={palette.textQuiet}
        name={visible ? "eye-off-outline" : "eye-outline"}
        size={18}
      />
    </Pressable>
  );
}

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const regionalDefaults = useMemo(() => detectRegionalDefaults(), []);
  const [mode, setMode] = useState<Mode>("signIn");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [signupCurrencyCode, setSignupCurrencyCode] = useState(
    regionalDefaults.currencyCode,
  );
  const [errors, setErrors] = useState<FormErrors>({});

  const emailRef = useRef<TextInput | null>(null);
  const passwordRef = useRef<TextInput | null>(null);
  const confirmPasswordRef = useRef<TextInput | null>(null);

  const chooseMode = (nextMode: Mode) => {
    setMode(nextMode);
    setErrors({});
    setSubmitError(null);
    setVerificationEmail(null);
    void Haptics.selectionAsync();
  };

  const validate = () => {
    const nextErrors: FormErrors = {};
    if (mode === "signUp" && !fullName.trim()) {
      nextErrors.fullName = "Enter the name for this personal workspace.";
    }
    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!isValidEmail(email)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!password) {
      nextErrors.password = "Password is required.";
    } else if (mode === "signUp" && password.length < 8) {
      nextErrors.password = "Use at least 8 characters.";
    }
    if (mode === "signUp") {
      if (!confirmPassword) {
        nextErrors.confirmPassword = "Confirm the password.";
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
    if (!validate()) return;

    try {
      setIsSubmitting(true);
      if (mode === "signIn") {
        await signIn(email.trim(), password);
        router.replace(ROUTES.TABS_HOME);
        return;
      }

      const result = await signUp(
        fullName.trim(),
        email.trim(),
        password,
        signupCurrencyCode,
      );
      if (result.requiresEmailConfirmation) {
        setVerificationEmail(email.trim());
        return;
      }
      router.replace(ROUTES.TABS_HOME);
    } catch (error: unknown) {
      if (mode === "signIn" && isInvalidCredentialsError(error)) {
        setSubmitError("Email or password is incorrect.");
        return;
      }
      setSubmitError(
        getErrorMessage(error) ??
          "The account service could not complete this request. Try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (verificationEmail) {
    return (
      <AuthShell
        description="Account creation is paused at the verification boundary."
        eyebrow="IDENTITY / VERIFY"
        title="Check your inbox">
        <View style={styles.verificationPanel}>
          <View style={styles.verificationThread} />
          <MaterialCommunityIcons
            color={palette.textMuted}
            name="email-check-outline"
            size={24}
          />
          <Text style={styles.verificationTitle}>Verification sent</Text>
          <Text style={styles.verificationCopy}>
            If delivery is enabled for this project, follow the secure link sent
            to {verificationEmail}. Then return here to sign in.
          </Text>
        </View>
        <ActionButton
          label="Return to sign in"
          onPress={() => {
            setVerificationEmail(null);
            chooseMode("signIn");
          }}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      description={
        mode === "signIn"
          ? "Enter the personal ledger. Your session restores the same record across supported devices."
          : "Create a user-scoped personal workspace with explicit ownership from the first entry."
      }
      eyebrow={mode === "signIn" ? "IDENTITY / RETURN" : "IDENTITY / CREATE"}
      title={mode === "signIn" ? "Welcome back." : "Start the ledger."}>
      <SegmentedControl
        accessibilityLabel="Account action"
        onChange={chooseMode}
        options={MODE_OPTIONS}
        value={mode}
      />

      {submitError ? (
        <View accessibilityRole="alert" style={styles.errorPanel}>
          <View style={styles.errorSignal} />
          <MaterialCommunityIcons
            color={palette.expense}
            name="alert-circle-outline"
            size={17}
          />
          <Text style={styles.errorText}>{submitError}</Text>
        </View>
      ) : null}

      {mode === "signUp" ? (
        <>
          <FinanceField
            autoCapitalize="words"
            error={errors.fullName}
            label="Full name"
            onChangeText={(value) => {
              setFullName(value);
              setErrors((current) => ({ ...current, fullName: undefined }));
              setSubmitError(null);
            }}
            onSubmitEditing={() => emailRef.current?.focus()}
            placeholder="Jordan Lee"
            returnKeyType="next"
            value={fullName}
          />
          <View style={styles.currencyPanel}>
            <View style={styles.currencyHeading}>
              <Text style={styles.currencyLabel}>BASE CURRENCY / CONFIRM</Text>
              <Text style={styles.currencySource}>
                {regionalDefaults.countryCode
                  ? `REGION ${regionalDefaults.countryCode}`
                  : "SYSTEM DEFAULT"}
              </Text>
            </View>
            <ScrollView
              horizontal
              contentContainerStyle={styles.currencyOptions}
              showsHorizontalScrollIndicator={false}>
              {CURRENCY_OPTIONS.map((option) => {
                const selected = option.code === signupCurrencyCode;
                return (
                  <Pressable
                    accessibilityLabel={`${option.code} base currency`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={option.code}
                    onPress={() => {
                      setSignupCurrencyCode(option.code);
                      void Haptics.selectionAsync();
                    }}
                    style={({ pressed }) => [
                      styles.currencyOption,
                      selected ? styles.currencyOptionSelected : null,
                      { opacity: pressed ? 0.58 : 1 },
                    ]}>
                    <Text
                      style={[
                        styles.currencyOptionText,
                        selected ? styles.currencyOptionTextSelected : null,
                      ]}>
                      {option.code}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={styles.currencyHint}>
              This choice stays fixed while travelling. You can change it later
              without rewriting historical entries.
            </Text>
          </View>
        </>
      ) : null}

      <FinanceField
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.email}
        inputRef={emailRef}
        keyboardType="email-address"
        label="Email address"
        onChangeText={(value) => {
          setEmail(value);
          setErrors((current) => ({ ...current, email: undefined }));
          setSubmitError(null);
        }}
        onSubmitEditing={() => passwordRef.current?.focus()}
        placeholder="you@example.com"
        returnKeyType="next"
        textContentType="emailAddress"
        value={email}
      />

      <FinanceField
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.password}
        inputRef={passwordRef}
        label="Password"
        onChangeText={(value) => {
          setPassword(value);
          setErrors((current) => ({ ...current, password: undefined }));
          setSubmitError(null);
        }}
        onSubmitEditing={() => {
          if (mode === "signUp") confirmPasswordRef.current?.focus();
          else void submit();
        }}
        placeholder="At least 8 characters"
        returnKeyType={mode === "signUp" ? "next" : "done"}
        secureTextEntry={!passwordVisible}
        textContentType={mode === "signUp" ? "newPassword" : "password"}
        trailing={
          <VisibilityButton
            onPress={() => setPasswordVisible((current) => !current)}
            visible={passwordVisible}
          />
        }
        value={password}
      />

      {mode === "signIn" ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(ROUTES.FORGOT_PASSWORD as never)}
          style={({ pressed }) => [
            styles.forgotButton,
            { opacity: pressed ? 0.56 : 1 },
          ]}>
          <Text style={styles.forgotText}>Recover access</Text>
        </Pressable>
      ) : (
        <FinanceField
          autoCapitalize="none"
          autoCorrect={false}
          error={errors.confirmPassword}
          inputRef={confirmPasswordRef}
          label="Confirm password"
          onChangeText={(value) => {
            setConfirmPassword(value);
            setErrors((current) => ({
              ...current,
              confirmPassword: undefined,
            }));
            setSubmitError(null);
          }}
          onSubmitEditing={() => void submit()}
          placeholder="Repeat the password"
          returnKeyType="done"
          secureTextEntry={!confirmPasswordVisible}
          textContentType="newPassword"
          trailing={
            <VisibilityButton
              onPress={() =>
                setConfirmPasswordVisible((current) => !current)
              }
              visible={confirmPasswordVisible}
            />
          }
          value={confirmPassword}
        />
      )}

      <ActionButton
        label={mode === "signIn" ? "Enter ledger" : "Create workspace"}
        loading={isSubmitting}
        onPress={() => void submit()}
      />

      <View style={styles.securityNote}>
        <View style={styles.securityThread} />
        <Text style={styles.securityNoteText}>
          Authentication is handled by Supabase. App lock remains a separate
          device boundary after sign-in.
        </Text>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  currencyPanel: {
    borderColor: palette.line,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  currencyHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  currencyLabel: {
    color: palette.textMuted,
    fontFamily: fonts.ledger,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  currencySource: {
    color: palette.signalMoss,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 0.6,
  },
  currencyOptions: { gap: 7 },
  currencyOption: {
    alignItems: "center",
    borderColor: palette.lineStrong,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 54,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  currencyOptionSelected: {
    backgroundColor: palette.text,
    borderColor: palette.text,
  },
  currencyOptionText: {
    color: palette.textMuted,
    fontFamily: fonts.ledger,
    fontSize: 10,
    textAlign: "center",
  },
  currencyOptionTextSelected: { color: palette.black },
  currencyHint: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
  },
  errorPanel: {
    alignItems: "center",
    backgroundColor: withAlpha(palette.expense, 0.05),
    borderColor: withAlpha(palette.expense, 0.28),
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 52,
    padding: 13,
    position: "relative",
  },
  errorSignal: {
    backgroundColor: palette.expense,
    bottom: 12,
    left: 0,
    position: "absolute",
    top: 12,
    width: 1,
  },
  errorText: {
    color: palette.textMuted,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
  },
  forgotButton: { alignSelf: "flex-end", marginTop: -10, padding: 8 },
  forgotText: {
    borderBottomColor: palette.textMuted,
    borderBottomWidth: 1,
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "700",
    paddingBottom: 2,
  },
  securityNote: {
    alignItems: "stretch",
    borderTopColor: palette.line,
    borderTopWidth: 1,
    flexDirection: "row",
    paddingTop: 18,
  },
  securityThread: {
    backgroundColor: palette.signalMoss,
    marginRight: 12,
    width: 1,
  },
  securityNoteText: {
    color: palette.textQuiet,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 9,
    lineHeight: 15,
  },
  verificationPanel: {
    alignItems: "flex-start",
    backgroundColor: withAlpha(palette.white, 0.025),
    borderColor: palette.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 20,
    position: "relative",
  },
  verificationThread: {
    backgroundColor: palette.signalMoss,
    bottom: 18,
    left: 0,
    position: "absolute",
    top: 18,
    width: 1,
  },
  verificationTitle: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 21,
  },
  verificationCopy: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 18,
  },
});
