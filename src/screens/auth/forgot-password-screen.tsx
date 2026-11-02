import { type AppTheme, useStyles, useTheme } from "@/theme/theme-context";
import { AuthShell } from "@/components/auth/auth-shell";
import { ActionButton } from "@/components/finance/action-button";
import { FinanceField } from "@/components/finance/finance-field";
import { UI_PREVIEW_ENABLED } from "@/config/runtime";
import { ROUTES } from "@/navigation/route-names";
import { supabaseResetPassword } from "@/services/supabase/auth-service";
import { withAlpha } from "@/theme/colors";
import { isValidEmail } from "@/utils/validators";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useState } from "react";
import { Keyboard, StyleSheet, Text, View } from "react-native";

export function ForgotPasswordScreen() {
  const { palette } = useTheme();
  const styles = useStyles(createStyles);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isSuccess, setIsSuccess] = useState(false);

  const submit = async () => {
    Keyboard.dismiss();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("Email is required.");
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(undefined);
      if (!UI_PREVIEW_ENABLED) {
        const resetUrl = Linking.createURL("/update-password");
        await supabaseResetPassword(normalizedEmail, resetUrl);
      }
      setIsSuccess(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "The recovery service is unavailable. Try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      description="Enter your email and we will send you a link to choose a new password."
      eyebrow="RESET PASSWORD"
      onBack={() => router.back()}
      title="Forgot password?">
      {isSuccess ? (
        <>
          <View style={styles.successPanel}>
            <View style={styles.successThread} />
            <MaterialCommunityIcons
              color={palette.textMuted}
              name="email-fast-outline"
              size={23}
            />
            <Text style={styles.successTitle}>Check your inbox</Text>
            <Text style={styles.successCopy}>
              If an account exists for {email.trim()}, a reset link is on its
              way. It expires after a while, so open it on this device soon.
            </Text>
          </View>
          <ActionButton
            label="Return to sign in"
            onPress={() => router.replace(ROUTES.AUTH as never)}
          />
        </>
      ) : (
        <>
          <FinanceField
            autoCapitalize="none"
            autoCorrect={false}
            error={error}
            keyboardType="email-address"
            label="Email address"
            onChangeText={(value) => {
              setEmail(value);
              setError(undefined);
            }}
            onSubmitEditing={() => void submit()}
            placeholder="you@example.com"
            returnKeyType="done"
            textContentType="emailAddress"
            value={email}
          />
          <ActionButton
            label="Send reset link"
            loading={isSubmitting}
            onPress={() => void submit()}
          />
          <Text style={styles.boundaryCopy}>
            For your privacy, this screen looks the same whether or not the
            address has an account.
          </Text>
        </>
      )}
    </AuthShell>
  );
}

const createStyles = ({ palette, fonts, fs, lh }: AppTheme) =>
  StyleSheet.create({
  successPanel: {
    backgroundColor: withAlpha(palette.tint, 0.025),
    borderColor: palette.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 20,
    position: "relative",
  },
  successThread: {
    backgroundColor: palette.signalMoss,
    bottom: 18,
    left: 0,
    position: "absolute",
    top: 18,
    width: 1,
  },
  successTitle: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: fs(22),
  },
  successCopy: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: fs(14),
    lineHeight: lh(14, 21),
  },
  boundaryCopy: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: fs(12),
    lineHeight: lh(12, 18),
    textAlign: "center",
  },
});
