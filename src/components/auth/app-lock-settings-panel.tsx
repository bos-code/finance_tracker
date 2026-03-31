import { UnifiedNumpad } from "@/components/ui/unified-numpad";
import { useAppLock } from "@/context/app-lock-context";
import { useAppStore } from "@/store/use-app-store";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

/**
 * Renders a rounded badge showing the provided label, using colors selected for the given tone.
 *
 * @param label - The text to display inside the badge
 * @param tone - Visual tone of the badge; "neutral", "success", or "warning"
 * @returns A rounded pill badge element with background and text color determined by `tone`
 */
function SecurityBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const palette =
    tone === "success"
      ? { bg: "#dcfce7", text: "#166534" }
      : tone === "warning"
        ? { bg: "#fef3c7", text: "#92400e" }
        : { bg: "#f8fafc", text: "#475569" };

  return (
    <View style={{ borderRadius: 999, backgroundColor: palette.bg, paddingHorizontal: 10, paddingVertical: 6 }}>
      <Text style={{ fontSize: 11, fontWeight: "800", color: palette.text }}>{label}</Text>
    </View>
  );
}

/**
 * Renders a bordered row with an icon, title and description, and an optional right-side badge.
 *
 * @param icon - Name of the MaterialCommunityIcons glyph to display in the leading square
 * @param iconBg - Background color used for the icon container
 * @param iconColor - Color used for the icon glyph
 * @param title - Primary text shown beside the icon
 * @param description - Secondary text shown below the title
 * @param badge - React node rendered at the right side of the row (e.g., status badge or action)
 * @param children - Optional content rendered below the header row
 * @returns A React element representing the styled security row
 */
function SecurityRow({
  icon,
  iconBg,
  iconColor,
  title,
  description,
  badge,
  children,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  badge: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View style={{ backgroundColor: "#fff", borderRadius: 22, borderWidth: 1.5, borderColor: "#e2e8f0", padding: 16, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 12, flex: 1 }}>
          <View style={{ width: 42, height: 42, borderRadius: 16, backgroundColor: iconBg, alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name={icon as any} size={20} color={iconColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: "#0f172a" }}>{title}</Text>
            <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 18, color: "#64748b", fontWeight: "600" }}>
              {description}
            </Text>
          </View>
        </View>
        {badge}
      </View>
      {children}
    </View>
  );
}

/**
 * Render a compact stage card with a label, a status icon, and four dot indicators derived from `value`.
 *
 * @param label - Text shown at the top-left of the card
 * @param active - When true, the card is styled as the currently active stage
 * @param complete - When true, the card displays a completed state (check icon and success color)
 * @param value - String whose first four character positions determine whether each dot indicator is filled
 * @param primary - Primary color used for active/fill styling
 * @returns A JSX element representing the stage card
 */
function PinStageCard({
  label,
  active,
  complete,
  value,
  primary,
}: {
  label: string;
  active: boolean;
  complete: boolean;
  value: string;
  primary: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 20,
        backgroundColor: "#fff",
        borderWidth: 1.5,
        borderColor: active ? primary : complete ? "#22c55e" : "#e2e8f0",
        padding: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 12, fontWeight: "800", color: "#475569", letterSpacing: 0.8 }}>{label}</Text>
        <MaterialCommunityIcons
          name={complete ? "check-circle" : active ? "circle-slice-8" : "circle-outline"}
          size={16}
          color={complete ? "#22c55e" : active ? primary : "#cbd5e1"}
        />
      </View>

      <View style={{ marginTop: 16, flexDirection: "row", justifyContent: "space-between" }}>
        {[0, 1, 2, 3].map((index) => {
          const filled = Boolean(value[index]);
          return (
            <View
              key={index}
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: filled ? (complete ? "#22c55e" : primary) : "#e2e8f0",
                transform: [{ scale: filled ? 1.05 : 1 }],
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

/**
 * Panel UI for configuring the app's local PIN and biometric app-lock settings.
 *
 * Manages local draft state for PIN and biometric preference, validates and saves changes
 * (enable/disable lock, update PIN, toggle biometrics), and displays status, errors, and
 * progress UI for creating or updating the PIN.
 *
 * @param isOpen - Whether the panel is currently visible; opening the panel resets drafts and errors.
 * @param onClose - Callback invoked to request closing the panel after successful actions or cancellation.
 * @returns The App Lock settings panel element that renders PIN/biometric controls, save/disable actions, and error feedback.
 */
export function AppLockSettingsPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const theme = useAppStore((s) => s.theme);
  const primary = theme.primary;
  const {
    enabled,
    biometricLabel,
    enableLock,
    disableLock,
    updatePin,
    useBiometrics,
    setUseBiometrics,
    isBiometricsSupported,
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

  const biometricIcon = biometricLabel.toLowerCase().includes("face") ? "face-recognition" : "fingerprint";
  const securitySummary = !enabled ? "PIN only" : useBiometrics ? `PIN + ${biometricLabel}` : "PIN only";
  const showPinComposer = !enabled || editingPin;
  const appLockInputValue = pinDraft.length < 4 ? pinDraft : confirmDraft;
  const pinReady = pinDraft.length === 4;
  const confirmReady = confirmDraft.length === 4;
  const canSave = showPinComposer ? confirmReady : biometricsDraft !== useBiometrics;
  const saveLabel = !enabled ? "Enable App Lock" : showPinComposer ? "Save new PIN" : "Save preferences";

  const resetPinEditor = () => {
    setPinDraft("");
    setConfirmDraft("");
    setEditingPin(false);
    setError(null);
  };

  const handleDisable = () => {
    Alert.alert("Turn off App Lock?", "PIN and biometric unlock will be removed from this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Turn off",
        style: "destructive",
        onPress: async () => {
          try {
            setSaving(true);
            await disableLock();
            onClose();
          } catch (nextError: any) {
            setError(nextError?.message ?? "Couldn't turn off App Lock.");
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (showPinComposer) {
      const pin = pinDraft.replace(/[^0-9]/g, "");
      const confirm = confirmDraft.replace(/[^0-9]/g, "");

      if (pin.length !== 4) {
        setError("Enter a 4-digit PIN.");
        return;
      }

      if (pin !== confirm) {
        setError("PINs do not match.");
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
      } catch (nextError: any) {
        setError(nextError?.message ?? "Couldn't save your security settings.");
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      setSaving(true);
      await setUseBiometrics(biometricsDraft);
      onClose();
    } catch (nextError: any) {
      setError(nextError?.message ?? "Couldn't update biometric preferences.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ padding: 20, gap: 16 }}>
      <View style={{ backgroundColor: "#0f172a", borderRadius: 24, padding: 20, gap: 14 }}>
        <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="shield-lock-outline" size={24} color="#fff" />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#fff" }}>
            {enabled ? securitySummary : "Protect this device"}
          </Text>
          <Text style={{ fontSize: 13, lineHeight: 20, color: "#cbd5e1", fontWeight: "600" }}>
            App Lock is stored only on this device. Your PIN stays local and never needs a server round-trip.
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <SecurityBadge label="Device only" tone="success" />
          <SecurityBadge label={enabled ? "Active" : "Optional"} />
        </View>
      </View>

      <SecurityRow
        icon="lock-outline"
        iconBg={`${primary}12`}
        iconColor={primary}
        title="PIN fallback"
        description={enabled ? "Your 4-digit PIN is always available as the unlock fallback." : "Create a 4-digit PIN that unlocks the app on this device."}
        badge={<SecurityBadge label={enabled ? "Required" : "Setup"} />}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <MaterialCommunityIcons name="numeric-4-circle-outline" size={18} color="#475569" />
          <Text style={{ flex: 1, fontSize: 12, fontWeight: "700", color: "#475569" }}>
            {enabled ? "PIN fallback is active for this account on this device." : "PIN has not been created yet."}
          </Text>
        </View>
      </SecurityRow>

      <SecurityRow
        icon={biometricIcon}
        iconBg={`${primary}12`}
        iconColor={primary}
        title={biometricLabel}
        description={
          isBiometricsSupported
            ? "Use device biometrics as a faster unlock shortcut while keeping the PIN fallback."
            : "Biometric unlock becomes available after the device has enrolled biometrics."
        }
        badge={<SecurityBadge label={isBiometricsSupported ? (biometricsDraft ? "Enabled" : "Optional") : "Unavailable"} tone={isBiometricsSupported ? "neutral" : "warning"} />}
      >
        {isBiometricsSupported ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ flex: 1, fontSize: 12, fontWeight: "700", color: "#475569" }}>
              Allow {biometricLabel.toLowerCase()} for quick unlock on this device
            </Text>
            <Switch
              value={biometricsDraft}
              onValueChange={(value) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setError(null);
                setBiometricsDraft(value);
              }}
              trackColor={{ false: "#e2e8f0", true: "#22c55e" }}
              thumbColor="#fff"
              ios_backgroundColor="#e2e8f0"
            />
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#94a3b8" />
            <Text style={{ flex: 1, fontSize: 12, fontWeight: "700", color: "#94a3b8" }}>
              Set up biometrics in device settings to enable this shortcut.
            </Text>
          </View>
        )}
      </SecurityRow>

      {showPinComposer ? (
        <>
          <View style={{ backgroundColor: "#f8fafc", borderRadius: 24, padding: 18, borderWidth: 1.5, borderColor: "#e2e8f0", gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: `${primary}12`, alignItems: "center", justifyContent: "center" }}>
                  <MaterialCommunityIcons name="dialpad" size={20} color={primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: "#0f172a" }}>
                    {!enabled ? "Create your PIN" : "Choose a new PIN"}
                  </Text>
                  <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 18, color: "#64748b", fontWeight: "600" }}>
                    {pinReady ? "Step 2 of 2: confirm the same 4 digits." : "Step 1 of 2: enter the 4 digits you want to use."}
                  </Text>
                </View>
              </View>
              <SecurityBadge label={pinReady ? "Confirm" : "Create"} />
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <PinStageCard label="CREATE" active={!pinReady} complete={pinReady} value={pinDraft} primary={primary} />
              <PinStageCard label="CONFIRM" active={pinReady} complete={pinReady && confirmReady} value={confirmDraft} primary={primary} />
            </View>
          </View>

          {error ? (
            <View style={{ borderRadius: 16, backgroundColor: "#fff1f2", borderWidth: 1.5, borderColor: "#fecdd3", paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#e11d48" />
              <Text style={{ flex: 1, color: "#be123c", fontSize: 12, fontWeight: "700" }}>{error}</Text>
            </View>
          ) : null}

          <UnifiedNumpad
            value={appLockInputValue}
            onChange={(value) => {
              setError(null);
              if (pinDraft.length < 4) {
                setPinDraft(value);
                return;
              }

              if (value === "" && confirmDraft === "") {
                setPinDraft((current) => current.slice(0, -1));
                return;
              }

              setConfirmDraft(value);
            }}
            mode="pin"
            maxLength={4}
            title={pinReady ? "Confirm your PIN" : "Create your PIN"}
            subtitle={pinReady ? "Enter the same four digits again to lock it in." : "Use the keypad below to choose a 4-digit PIN."}
          />

          <View style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || !canSave}
              style={{ backgroundColor: saving || !canSave ? "#93c5fd" : primary, borderRadius: 18, height: 54, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="shield-check-outline" size={18} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>{saveLabel}</Text>
                </>
              )}
            </TouchableOpacity>

            {enabled ? (
              <TouchableOpacity
                onPress={resetPinEditor}
                style={{ alignItems: "center", justifyContent: "center", height: 54, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e2e8f0", flexDirection: "row", gap: 8 }}
              >
                <MaterialCommunityIcons name="history" size={18} color="#475569" />
                <Text style={{ color: "#475569", fontWeight: "800", fontSize: 14 }}>Keep current PIN</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </>
      ) : (
        <>
          {error ? (
            <View style={{ borderRadius: 16, backgroundColor: "#fff1f2", borderWidth: 1.5, borderColor: "#fecdd3", paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#e11d48" />
              <Text style={{ flex: 1, color: "#be123c", fontSize: 12, fontWeight: "700" }}>{error}</Text>
            </View>
          ) : null}

          <View style={{ backgroundColor: "#f8fafc", borderRadius: 24, padding: 18, borderWidth: 1.5, borderColor: "#e2e8f0", gap: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 16, backgroundColor: `${primary}12`, alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="shield-check-outline" size={20} color={primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: "#0f172a" }}>Security is active</Text>
                <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 18, color: "#64748b", fontWeight: "600" }}>
                  Review your quick unlock preference, update your PIN, or turn App Lock off for this device.
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              <SecurityBadge label="PIN required" />
              {biometricsDraft ? <SecurityBadge label={`${biometricLabel} enabled`} tone="success" /> : null}
            </View>
          </View>

          {canSave ? (
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || !canSave}
              style={{ backgroundColor: saving || !canSave ? "#93c5fd" : primary, borderRadius: 18, height: 54, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="content-save-outline" size={18} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>{saveLabel}</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          <View style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={() => {
                setError(null);
                setPinDraft("");
                setConfirmDraft("");
                setEditingPin(true);
              }}
              style={{ alignItems: "center", justifyContent: "center", height: 56, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e2e8f0", gap: 8 }}
            >
              <MaterialCommunityIcons name="lock-reset" size={18} color="#475569" />
              <Text style={{ color: "#475569", fontWeight: "800", fontSize: 14 }}>Change PIN</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDisable}
              style={{ alignItems: "center", justifyContent: "center", height: 56, borderRadius: 18, backgroundColor: "#fff1f2", borderWidth: 1.5, borderColor: "#fecdd3", gap: 8 }}
            >
              <MaterialCommunityIcons name="shield-off-outline" size={18} color="#e11d48" />
              <Text style={{ color: "#e11d48", fontWeight: "800", fontSize: 14 }}>Turn off</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}
