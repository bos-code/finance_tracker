import { AuthShell } from "@/components/auth/auth-shell";
import { ActionButton } from "@/components/finance/action-button";
import { FinanceField } from "@/components/finance/finance-field";
import { UI_PREVIEW_ENABLED } from "@/config/runtime";
import { ROUTES } from "@/navigation/route-names";
import { supabaseResetPassword } from "@/services/supabase/auth-service";
import { palette, withAlpha } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { isValidEmail } from "@/utils/validators";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useState } from "react";
import { Keyboard, StyleSheet, Text, View } from "react-native";

export function ForgotPasswordScreen() {
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
      description="Request a time-limited recovery link. The response stays the same whether or not an account exists."
      eyebrow="IDENTITY / RECOVERY"
      onBack={() => router.back()}
      title="Recover access.">
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
              If an account exists for {email.trim()}, recovery instructions are
              on the way. The link may expire, so open it on this device.
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
            label="Send recovery link"
            loading={isSubmitting}
            onPress={() => void submit()}
          />
          <Text style={styles.boundaryCopy}>
            Finance Tracker never reveals whether an address is registered from
            this screen.
          </Text>
        </>
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  successPanel: {
    backgroundColor: withAlpha(palette.white, 0.025),
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
    fontSize: 22,
  },
  successCopy: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 18,
  },
  boundaryCopy: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 9,
    lineHeight: 15,
    textAlign: "center",
  },
});
