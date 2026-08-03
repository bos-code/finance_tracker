import { UnifiedNumpad } from "@/components/ui/unified-numpad";
import { SignalThreads } from "@/components/visuals/signal-threads";
import { useAppLock } from "@/context/app-lock-context";
import { useAuth } from "@/hooks/use-auth";
import { palette, withAlpha } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export function AppLockScreen() {
  const {
    biometricLabel,
    biometricUnlock,
    disableLock,
    isBiometricsSupported,
    unlock,
    useBiometrics,
  } = useAppLock();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [biometricPending, setBiometricPending] = useState(false);
  const [autoPrompted, setAutoPrompted] = useState(false);

  const canUseBiometrics = useBiometrics && isBiometricsSupported;
  const compact = height < 760;
  const biometricIcon = useMemo(
    () =>
      biometricLabel.toLocaleLowerCase().includes("face")
        ? "face-recognition"
        : "fingerprint",
    [biometricLabel],
  );

  const triggerBiometricUnlock = useCallback(async () => {
    if (!canUseBiometrics || biometricPending) return;
    setBiometricPending(true);
    try {
      await biometricUnlock();
    } finally {
      setBiometricPending(false);
    }
  }, [biometricPending, biometricUnlock, canUseBiometrics]);

  useEffect(() => {
    if (!canUseBiometrics || autoPrompted) return;
    setAutoPrompted(true);
    void triggerBiometricUnlock();
  }, [autoPrompted, canUseBiometrics, triggerBiometricUnlock]);

  const handleChange = async (value: string) => {
    const digits = value.replace(/[^0-9]/g, "").slice(0, 4);
    setPin(digits);
    setError(null);
    if (digits.length !== 4) return;
    const unlocked = await unlock(digits);
    if (!unlocked) {
      setError("Incorrect PIN. Try again.");
      setPin("");
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign out?", "This also removes App Lock from this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await disableLock();
          await signOut();
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <SignalThreads intensity="visible" />
      <View style={styles.container}>
        <View style={[styles.intro, compact ? styles.introCompact : null]}>
          <View style={styles.topline}>
            <View style={styles.brandMark}>
              <MaterialCommunityIcons
                color={palette.text}
                name="finance"
                size={18}
              />
            </View>
            <View style={styles.brandCopy}>
              <Text style={styles.brandName}>FINANCE TRACKER</Text>
              <Text style={styles.brandStatus}>APP LOCK / ACTIVE</Text>
            </View>
            <View style={styles.securityMark}>
              <MaterialCommunityIcons
                color={palette.signalMoss}
                name="shield-lock-outline"
                size={19}
              />
            </View>
          </View>

          <View style={styles.heading}>
            <View style={styles.headingThread} />
            <Text style={[styles.title, compact ? styles.titleCompact : null]}>
              Unlock the ledger.
            </Text>
            {!compact ? (
              <Text style={styles.description}>
                Enter the four-digit device PIN
                {canUseBiometrics
                  ? ` or use ${biometricLabel.toLocaleLowerCase()}`
                  : ""}
                . The credential is held in the platform secure store.
              </Text>
            ) : null}
          </View>

          <View
            accessibilityLabel={`${pin.length} of 4 PIN digits entered`}
            style={styles.pinRow}>
            {[0, 1, 2, 3].map((index) => {
              const filled = Boolean(pin[index]);
              const active = index === pin.length && pin.length < 4;
              return (
                <View
                  key={index}
                  style={[
                    styles.pinSlot,
                    active ? styles.pinSlotActive : null,
                    filled ? styles.pinSlotFilled : null,
                  ]}>
                  <View
                    style={[
                      styles.pinDot,
                      filled ? styles.pinDotFilled : null,
                    ]}
                  />
                </View>
              );
            })}
          </View>

          <View
            accessibilityLiveRegion="polite"
            style={[
              styles.statusLine,
              error ? styles.statusLineError : null,
            ]}>
            <View
              style={[
                styles.statusSignal,
                {
                  backgroundColor: error
                    ? palette.expense
                    : palette.signalMoss,
                },
              ]}
            />
            <Text style={styles.statusText}>
              {error ?? "The app locks again after leaving the foreground."}
            </Text>
          </View>

          {canUseBiometrics ? (
            <Pressable
              accessibilityRole="button"
              disabled={biometricPending}
              onPress={() => void triggerBiometricUnlock()}
              style={({ pressed }) => [
                styles.biometricButton,
                { opacity: pressed ? 0.58 : 1 },
              ]}>
              {biometricPending ? (
                <ActivityIndicator color={palette.textMuted} size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    color={palette.signalCyan}
                    name={biometricIcon}
                    size={18}
                  />
                  <Text style={styles.biometricText}>Use {biometricLabel}</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </View>

        <UnifiedNumpad
          biometricIconName={biometricIcon}
          biometricLabel={biometricLabel}
          bottomInset={Math.max(insets.bottom, 14)}
          footer={
            <View style={styles.footer}>
              <Pressable
                accessibilityRole="button"
                onPress={handleSignOut}
                style={({ pressed }) => [
                  styles.signOutButton,
                  { opacity: pressed ? 0.56 : 1 },
                ]}>
                <MaterialCommunityIcons
                  color={palette.expense}
                  name="logout"
                  size={16}
                />
                <Text style={styles.signOutText}>Sign out instead</Text>
              </Pressable>
              <Text style={styles.footerCopy}>
                Signing out clears the local lock and returns to identity.
              </Text>
            </View>
          }
          maxLength={4}
          mode="pin"
          onBiometricPress={() => void triggerBiometricUnlock()}
          onChange={(value) => void handleChange(value)}
          pinPresentation="drawer"
          showBiometric={canUseBiometrics}
          subtitle="Enter the four device-local digits."
          title="Security keypad"
          value={pin}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: palette.canvas, flex: 1 },
  container: { flex: 1 },
  intro: {
    alignSelf: "center",
    flex: 1,
    justifyContent: "center",
    maxWidth: 520,
    paddingHorizontal: 22,
    paddingVertical: 18,
    width: "100%",
  },
  introCompact: { justifyContent: "flex-start", paddingTop: 10 },
  topline: {
    alignItems: "center",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 58,
  },
  brandMark: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 11,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    marginRight: 11,
    width: 36,
  },
  brandCopy: { flex: 1, gap: 4 },
  brandName: {
    color: palette.text,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 0.65,
  },
  brandStatus: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
  },
  securityMark: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 11,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  heading: { marginTop: 20 },
  headingThread: {
    backgroundColor: palette.signalViolet,
    height: 1,
    marginBottom: 12,
    width: 54,
  },
  title: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 36,
    letterSpacing: -0.8,
  },
  titleCompact: { fontSize: 30 },
  description: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 8,
    maxWidth: 410,
  },
  pinRow: { flexDirection: "row", gap: 9, marginTop: 20 },
  pinSlot: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    height: 48,
    justifyContent: "center",
  },
  pinSlotActive: { borderColor: palette.lineStrong },
  pinSlotFilled: { backgroundColor: withAlpha(palette.white, 0.035) },
  pinDot: {
    backgroundColor: palette.lineStrong,
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  pinDotFilled: { backgroundColor: palette.text },
  statusLine: {
    alignItems: "stretch",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 44,
    paddingVertical: 12,
  },
  statusLineError: { borderBottomColor: withAlpha(palette.expense, 0.34) },
  statusSignal: { marginRight: 10, width: 1 },
  statusText: {
    color: palette.textQuiet,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 9,
    lineHeight: 14,
  },
  biometricButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: palette.line,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 13,
    minHeight: 40,
    paddingHorizontal: 14,
  },
  biometricText: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "700",
  },
  footer: { gap: 8 },
  signOutButton: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 44,
  },
  signOutText: {
    color: palette.expense,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "700",
  },
  footerCopy: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 8,
    lineHeight: 13,
    textAlign: "center",
  },
});
