import { AuthShell } from "@/components/auth/auth-shell";
import { ActionButton } from "@/components/finance/action-button";
import { FinanceField } from "@/components/finance/finance-field";
import { useAuth } from "@/hooks/use-auth";
import { ROUTES } from "@/navigation/route-names";
import { palette, withAlpha } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

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

export function UpdatePasswordScreen() {
  const { signOut, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isSuccess, setIsSuccess] = useState(false);
  const confirmPasswordRef = useRef<TextInput | null>(null);

  const submit = async () => {
    Keyboard.dismiss();
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(undefined);
      await updatePassword(password);
      setIsSuccess(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "The link may have expired. Request a new recovery email.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const returnToSignIn = async () => {
    await signOut();
    router.replace(ROUTES.AUTH as never);
  };

  return (
    <AuthShell
      description="Set a new credential only inside a valid authenticated or recovery session."
      eyebrow="IDENTITY / NEW CREDENTIAL"
      onBack={() => router.back()}
      title={isSuccess ? "Password updated." : "Secure the account."}>
      {isSuccess ? (
        <>
          <View style={styles.successPanel}>
            <View style={styles.successThread} />
            <MaterialCommunityIcons
              color={palette.textMuted}
              name="shield-check-outline"
              size={24}
            />
            <Text style={styles.successTitle}>Credential replaced</Text>
            <Text style={styles.successCopy}>
              The password is updated. Sign in again to start a clean session on
              this device.
            </Text>
          </View>
          <ActionButton
            label="Return to sign in"
            onPress={() => void returnToSignIn()}
          />
        </>
      ) : (
        <>
          <FinanceField
            autoCapitalize="none"
            autoCorrect={false}
            label="New password"
            onChangeText={(value) => {
              setPassword(value);
              setError(undefined);
            }}
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            placeholder="At least 8 characters"
            returnKeyType="next"
            secureTextEntry={!passwordVisible}
            textContentType="newPassword"
            trailing={
              <VisibilityButton
                onPress={() => setPasswordVisible((current) => !current)}
                visible={passwordVisible}
              />
            }
            value={password}
          />
          <FinanceField
            autoCapitalize="none"
            autoCorrect={false}
            error={error}
            inputRef={confirmPasswordRef}
            label="Confirm new password"
            onChangeText={(value) => {
              setConfirmPassword(value);
              setError(undefined);
            }}
            onSubmitEditing={() => void submit()}
            placeholder="Repeat the password"
            returnKeyType="done"
            secureTextEntry={!confirmVisible}
            textContentType="newPassword"
            trailing={
              <VisibilityButton
                onPress={() => setConfirmVisible((current) => !current)}
                visible={confirmVisible}
              />
            }
            value={confirmPassword}
          />
          <ActionButton
            label="Update password"
            loading={isSubmitting}
            onPress={() => void submit()}
          />
          <Text style={styles.hint}>
            Use a unique credential. Finance Tracker never displays or stores
            the password in application state.
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
  hint: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 9,
    lineHeight: 15,
    textAlign: "center",
  },
});
