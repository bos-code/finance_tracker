import { ActionButton } from "@/components/finance/action-button";
import { UnifiedNumpad } from "@/components/ui/unified-numpad";
import { useAppLock } from "@/context/app-lock-context";
import { palette, withAlpha } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Switch, Text, View } from "react-native";

function SecurityRow({
  description,
  icon,
  signal,
  status,
  title,
}: {
  description: string;
  icon: string;
  signal: string;
  status: string;
  title: string;
}) {
  return (
    <View style={styles.securityRow}>
      <View style={[styles.securitySignal, { backgroundColor: signal }]} />
      <View style={styles.securityIcon}>
        <MaterialCommunityIcons
          color={palette.textMuted}
          name={icon as never}
          size={18}
        />
      </View>
      <View style={styles.securityCopy}>
        <Text style={styles.securityTitle}>{title}</Text>
        <Text style={styles.securityDescription}>{description}</Text>
      </View>
      <Text style={[styles.securityStatus, { color: signal }]}>
        {status.toLocaleUpperCase()}
      </Text>
    </View>
  );
}

function PinStage({
  active,
  complete,
  label,
  value,
}: {
  active: boolean;
  complete: boolean;
  label: string;
  value: string;
}) {
  return (
    <View
      style={[
        styles.pinStage,
        active ? styles.pinStageActive : null,
        complete ? styles.pinStageComplete : null,
      ]}>
      <View style={styles.pinStageTopline}>
        <Text style={styles.pinStageLabel}>{label}</Text>
        <Text style={styles.pinStageCount}>{value.length}/4</Text>
      </View>
      <View style={styles.pinDots}>
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={[
              styles.pinDot,
              value[index] ? styles.pinDotFilled : null,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export function AppLockSettingsPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const {
    biometricLabel,
    disableLock,
    enableLock,
    enabled,
    isBiometricsSupported,
    secureStorageAvailable,
    setUseBiometrics,
    updatePin,
    useBiometrics,
  } = useAppLock();
  const [pinDraft, setPinDraft] = useState("");
  const [confirmDraft, setConfirmDraft] = useState("");
  const [biometricsDraft, setBiometricsDraft] = useState(false);
  const [editingPin, setEditingPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPinDraft("");
    setConfirmDraft("");
    setBiometricsDraft(useBiometrics && isBiometricsSupported);
    setEditingPin(!enabled);
    setError(null);
    setSaving(false);
  }, [enabled, isBiometricsSupported, isOpen, useBiometrics]);

  const biometricIcon = biometricLabel.toLocaleLowerCase().includes("face")
    ? "face-recognition"
    : "fingerprint";
  const showPinComposer = !enabled || editingPin;
  const pinReady = pinDraft.length === 4;
  const confirmReady = confirmDraft.length === 4;
  const inputValue = pinReady ? confirmDraft : pinDraft;
  const canSave = showPinComposer
    ? confirmReady
    : biometricsDraft !== useBiometrics;

  const resetPinEditor = () => {
    setPinDraft("");
    setConfirmDraft("");
    setEditingPin(false);
    setError(null);
  };

  const handleDisable = () => {
    Alert.alert(
      "Turn off App Lock?",
      "The secure PIN and biometric preference will be removed from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Turn off",
          style: "destructive",
          onPress: async () => {
            try {
              setSaving(true);
              await disableLock();
              onClose();
            } catch (disableError) {
              setError(
                disableError instanceof Error
                  ? disableError.message
                  : "App Lock could not be disabled.",
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const handleSave = async () => {
    if (showPinComposer) {
      const pin = pinDraft.replace(/[^0-9]/g, "");
      const confirmation = confirmDraft.replace(/[^0-9]/g, "");
      if (pin.length !== 4) {
        setError("Enter a 4-digit PIN.");
        return;
      }
      if (pin !== confirmation) {
        setError("PINs do not match.");
        setConfirmDraft("");
        return;
      }
      try {
        setSaving(true);
        if (enabled) {
          await updatePin(pin);
          await setUseBiometrics(biometricsDraft);
        } else {
          await enableLock(pin, biometricsDraft);
        }
        onClose();
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Security settings could not be saved.",
        );
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      setSaving(true);
      await setUseBiometrics(biometricsDraft);
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Biometric preferences could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!secureStorageAvailable) {
    return (
      <View style={styles.unavailable}>
        <View style={styles.unavailableThread} />
        <MaterialCommunityIcons
          color={palette.textQuiet}
          name="shield-alert-outline"
          size={23}
        />
        <Text style={styles.unavailableTitle}>Secure storage unavailable</Text>
        <Text style={styles.unavailableCopy}>
          App Lock is available in the native iOS and Android app when the
          platform secure store is present. It is intentionally disabled on web.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroThread} />
        <MaterialCommunityIcons
          color={palette.text}
          name="shield-lock-outline"
          size={25}
        />
        <Text style={styles.heroTitle}>
          {enabled ? "Device boundary active" : "Protect this device"}
        </Text>
        <Text style={styles.heroCopy}>
          The four-digit PIN is stored by the operating system secure store. It
          is not included in general application preferences or sent to the
          backend.
        </Text>
      </View>

      <SecurityRow
        description="Always available as the fallback unlock path on this device."
        icon="numeric-4-circle-outline"
        signal={enabled ? palette.income : palette.textQuiet}
        status={enabled ? "Required" : "Setup"}
        title="Four-digit PIN"
      />
      <SecurityRow
        description={
          isBiometricsSupported
            ? "A convenience shortcut; the PIN remains the recovery path."
            : "Enroll device biometrics to make this shortcut available."
        }
        icon={biometricIcon}
        signal={
          isBiometricsSupported ? palette.signalCyan : palette.textQuiet
        }
        status={isBiometricsSupported ? "Available" : "Unavailable"}
        title={biometricLabel}
      />

      {isBiometricsSupported ? (
        <View style={styles.biometricToggle}>
          <View style={styles.biometricToggleCopy}>
            <Text style={styles.biometricToggleLabel}>Quick unlock</Text>
            <Text style={styles.biometricToggleDescription}>
              Allow {biometricLabel.toLocaleLowerCase()} on this device.
            </Text>
          </View>
          <Switch
            ios_backgroundColor={palette.line}
            onValueChange={(value) => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setError(null);
              setBiometricsDraft(value);
            }}
            thumbColor={biometricsDraft ? palette.text : palette.textQuiet}
            trackColor={{ false: palette.line, true: palette.lineStrong }}
            value={biometricsDraft}
          />
        </View>
      ) : null}

      {showPinComposer ? (
        <>
          <View style={styles.pinComposerHeading}>
            <Text style={styles.composerEyebrow}>PIN SETUP</Text>
            <Text style={styles.composerTitle}>
              {pinReady ? "Confirm the same digits." : "Choose four digits."}
            </Text>
          </View>
          <View style={styles.pinStages}>
            <PinStage
              active={!pinReady}
              complete={pinReady}
              label="CREATE"
              value={pinDraft}
            />
            <PinStage
              active={pinReady}
              complete={pinReady && confirmReady}
              label="CONFIRM"
              value={confirmDraft}
            />
          </View>
          <UnifiedNumpad
            maxLength={4}
            mode="pin"
            onChange={(value) => {
              setError(null);
              if (!pinReady) {
                setPinDraft(value);
                return;
              }
              if (value === "" && confirmDraft === "") {
                setPinDraft((current) => current.slice(0, -1));
                return;
              }
              setConfirmDraft(value);
            }}
            subtitle={
              pinReady
                ? "The confirmation must match exactly."
                : "Use a number you can remember without reusing a banking PIN."
            }
            title={pinReady ? "Confirm PIN" : "Create PIN"}
            value={inputValue}
          />
        </>
      ) : (
        <View style={styles.activePanel}>
          <View style={styles.activeThread} />
          <Text style={styles.activeTitle}>Lock is ready</Text>
          <Text style={styles.activeCopy}>
            The app will return to this boundary when it leaves the foreground.
          </Text>
        </View>
      )}

      {error ? (
        <View accessibilityRole="alert" style={styles.errorPanel}>
          <View style={styles.errorThread} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {showPinComposer || canSave ? (
          <ActionButton
            disabled={!canSave}
            label={
              !enabled
                ? "Enable App Lock"
                : showPinComposer
                  ? "Save new PIN"
                  : "Save preference"
            }
            loading={saving}
            onPress={() => void handleSave()}
          />
        ) : null}
        {enabled && showPinComposer ? (
          <ActionButton
            label="Keep current PIN"
            onPress={resetPinEditor}
            tone="quiet"
          />
        ) : null}
        {enabled && !showPinComposer ? (
          <>
            <ActionButton
              icon="lock-reset"
              label="Change PIN"
              onPress={() => {
                setPinDraft("");
                setConfirmDraft("");
                setEditingPin(true);
                setError(null);
              }}
              tone="quiet"
            />
            <ActionButton
              icon="shield-off-outline"
              label="Turn off App Lock"
              onPress={handleDisable}
              tone="danger"
            />
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  hero: {
    backgroundColor: withAlpha(palette.white, 0.025),
    borderColor: palette.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 18,
    position: "relative",
  },
  heroThread: {
    backgroundColor: palette.signalViolet,
    bottom: 16,
    left: 0,
    position: "absolute",
    top: 16,
    width: 1,
  },
  heroTitle: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 21,
  },
  heroCopy: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
  },
  securityRow: {
    alignItems: "stretch",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 72,
    paddingVertical: 12,
  },
  securitySignal: { marginRight: 12, width: 1 },
  securityIcon: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 11,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    marginRight: 12,
    width: 36,
  },
  securityCopy: { flex: 1, gap: 4, marginRight: 10 },
  securityTitle: {
    color: palette.text,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "600",
  },
  securityDescription: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 9,
    lineHeight: 14,
  },
  securityStatus: {
    alignSelf: "center",
    fontFamily: fonts.ledger,
    fontSize: 7,
  },
  biometricToggle: {
    alignItems: "center",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 62,
  },
  biometricToggleCopy: { flex: 1, gap: 4, marginRight: 12 },
  biometricToggleLabel: {
    color: palette.text,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "600",
  },
  biometricToggleDescription: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 9,
  },
  pinComposerHeading: { gap: 6, marginTop: 4 },
  composerEyebrow: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.65,
  },
  composerTitle: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 21,
  },
  pinStages: { flexDirection: "row", gap: 10 },
  pinStage: {
    borderColor: palette.line,
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    gap: 13,
    padding: 13,
  },
  pinStageActive: { borderColor: palette.lineStrong },
  pinStageComplete: { backgroundColor: withAlpha(palette.white, 0.025) },
  pinStageTopline: { flexDirection: "row", justifyContent: "space-between" },
  pinStageLabel: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
  },
  pinStageCount: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
  },
  pinDots: { flexDirection: "row", justifyContent: "space-between" },
  pinDot: {
    backgroundColor: palette.lineStrong,
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  pinDotFilled: { backgroundColor: palette.text },
  activePanel: {
    borderColor: palette.line,
    borderRadius: 15,
    borderWidth: 1,
    gap: 7,
    padding: 16,
    position: "relative",
  },
  activeThread: {
    backgroundColor: palette.income,
    bottom: 14,
    left: 0,
    position: "absolute",
    top: 14,
    width: 1,
  },
  activeTitle: {
    color: palette.text,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "600",
  },
  activeCopy: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 9,
    lineHeight: 14,
  },
  errorPanel: {
    borderColor: withAlpha(palette.expense, 0.3),
    borderRadius: 13,
    borderWidth: 1,
    padding: 13,
    position: "relative",
  },
  errorThread: {
    backgroundColor: palette.expense,
    bottom: 10,
    left: 0,
    position: "absolute",
    top: 10,
    width: 1,
  },
  errorText: {
    color: palette.expense,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
  },
  actions: { gap: 10 },
  unavailable: {
    borderColor: palette.line,
    borderRadius: 17,
    borderWidth: 1,
    gap: 10,
    padding: 18,
    position: "relative",
  },
  unavailableThread: {
    backgroundColor: palette.textQuiet,
    bottom: 16,
    left: 0,
    position: "absolute",
    top: 16,
    width: 1,
  },
  unavailableTitle: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 20,
  },
  unavailableCopy: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
  },
});
