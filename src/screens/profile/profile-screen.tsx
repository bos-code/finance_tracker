import { Screen } from "@/components/ui/screen";
import { useAppLock } from "@/context/app-lock-context";
import { useAuth } from "@/hooks/use-auth";
import { ROUTES } from "@/navigation/route-names";
import { CURRENCY_OPTIONS, GRADIENT_PRESETS, SOLID_PRESETS, useAppStore, type ThemeConfig } from "@/store/use-app-store";
import { UnifiedNumpad } from "@/components/ui/unified-numpad";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";

import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Animated row ─────────────────────────────────────────────────────────────

function SettingRow({
  icon, iconBg, iconColor, label, value, onPress, danger = false, rightElement,
}: {
  icon: string; iconBg: string; iconColor: string; label: string;
  value?: string; onPress?: () => void; danger?: boolean; rightElement?: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <TouchableOpacity
      onPressIn={() => { scale.value = withSpring(0.975, { damping: 14 }); }}
      onPressOut={() => { scale.value = withSpring(1); }}
      onPress={onPress}
      activeOpacity={1}
    >
      <Animated.View style={[style, { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff" }]}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: iconBg, alignItems: "center", justifyContent: "center", marginRight: 14 }}>
          <MaterialCommunityIcons name={icon as any} size={20} color={iconColor} />
        </View>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: danger ? "#ef4444" : "#0f172a" }}>{label}</Text>
        {rightElement ?? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {value ? <Text style={{ fontSize: 13, fontWeight: "600", color: "#94a3b8" }}>{value}</Text> : null}
            <MaterialCommunityIcons name="chevron-right" size={20} color={danger ? "#fca5a5" : "#cbd5e1"} />
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: "#fff", borderRadius: 20, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }}>
      {children}
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: "#f1f5f9", marginLeft: 68 }} />;
}

// ─── Bottom sheet wrapper ─────────────────────────────────────────────────────

function BottomSheet({
  visible,
  title,
  onClose,
  children,
  scroll = true,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const content = scroll ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 8 }}
    >
      {children}
    </ScrollView>
  ) : children;
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(10,18,40,0.4)" }} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.bottom : 0}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
      >
        <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Math.max(insets.bottom, 24), shadowColor: "#000", shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 30 }}>
          <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ width: 36, height: 4, borderRadius: 99, backgroundColor: "#e2e8f0" }} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#0f172a" }}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <MaterialCommunityIcons name="close" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          {content}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Gradient swatch ──────────────────────────────────────────────────────────

function GradientSwatch({ colors, selected, onPress }: { colors: [string, string]; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: 52, height: 52, borderRadius: 14, margin: 5,
        borderWidth: selected ? 3 : 2,
        borderColor: selected ? "#0f172a" : "transparent",
        overflow: "hidden",
        shadowColor: colors[0], shadowOffset: { width: 0, height: 3 }, shadowOpacity: selected ? 0.4 : 0.1, shadowRadius: 6, elevation: selected ? 6 : 2,
      }}
    >
      {/* Fake gradient using two halves */}
      <View style={{ flex: 1, flexDirection: "row" }}>
        <View style={{ flex: 1, backgroundColor: colors[0] }} />
        <View style={{ flex: 1, backgroundColor: colors[1] }} />
      </View>
      {selected && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="check" size={22} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

function SecurityMethodCard({
  icon,
  iconBg,
  iconColor,
  title,
  description,
  status,
  footer,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  status: string;
  footer?: React.ReactNode;
}) {
  return (
    <View
      style={{
        flex: 1,
        minHeight: 174,
        borderRadius: 22,
        backgroundColor: "#fff",
        borderWidth: 1.5,
        borderColor: "#e2e8f0",
        padding: 16,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <View style={{ width: 42, height: 42, borderRadius: 16, backgroundColor: iconBg, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name={icon as any} size={20} color={iconColor} />
        </View>
        <View style={{ borderRadius: 999, backgroundColor: "#f8fafc", paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: "#475569" }}>{status}</Text>
        </View>
      </View>

      <Text style={{ marginTop: 14, fontSize: 16, fontWeight: "800", color: "#0f172a" }}>{title}</Text>
      <Text style={{ marginTop: 6, fontSize: 12, lineHeight: 18, color: "#64748b", fontWeight: "600" }}>{description}</Text>

      <View style={{ marginTop: "auto", paddingTop: 14 }}>{footer}</View>
    </View>
  );
}

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

export function ProfileScreen() {
  const { user, signOut, updateName } = useAuth();
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const currency = useAppStore((s) => s.currency);
  const setCurrency = useAppStore((s) => s.setCurrency);
  const {
    enabled: appLockEnabled,
    biometricLabel,
    enableLock,
    disableLock,
    updatePin,
    useBiometrics,
    setUseBiometrics,
    isBiometricsSupported,
  } = useAppLock();
  const insets = useSafeAreaInsets();

  // Settings state
  type ModalType = "money" | "notification" | "language" | "theme" | "name" | "appLock" | "none";
  const [activeModal, setActiveModal] = useState<ModalType>("none");
  const [notifications, setNotifications] = useState(false);
  const [language, setLanguage] = useState("English");

  // Local theme draft (work in progress until Apply)
  const [draftTheme, setDraftTheme] = useState<ThemeConfig>(theme);
  const [themeTab, setThemeTab] = useState<"solid" | "gradient">("solid");

  // Avatar
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Name edit
  const [nameInput, setNameInput] = useState(user?.fullName ?? "");
  const [nameSaving, setNameSaving] = useState(false);
  const [appLockPinDraft, setAppLockPinDraft] = useState("");
  const [appLockConfirmDraft, setAppLockConfirmDraft] = useState("");
  const [appLockBiometricsDraft, setAppLockBiometricsDraft] = useState(false);
  const [editingAppLockPin, setEditingAppLockPin] = useState(false);
  const [appLockError, setAppLockError] = useState<string | null>(null);
  const [appLockSaving, setAppLockSaving] = useState(false);

  const primary = theme.primary;
  const displayName = user?.fullName?.trim() || (user?.email ? user.email.split("@")[0] : "") || "Guest User";
  const initials = getInitials(displayName);
  const biometricIcon = biometricLabel.toLowerCase().includes("face") ? "face-recognition" : "fingerprint";
  const securitySummary = !appLockEnabled ? "Off" : useBiometrics ? `PIN + ${biometricLabel}` : "PIN only";
  const showPinSetup = !appLockEnabled || editingAppLockPin;
  const appLockInputValue = appLockPinDraft.length < 4 ? appLockPinDraft : appLockConfirmDraft;
  const pinReady = appLockPinDraft.length === 4;
  const confirmReady = appLockConfirmDraft.length === 4;
  const canSaveAppLock = showPinSetup
    ? confirmReady
    : appLockBiometricsDraft !== useBiometrics;
  const appLockButtonLabel = !appLockEnabled
    ? "Enable protection"
    : showPinSetup
      ? "Save security"
      : "Save preferences";

  const open = useCallback((m: typeof activeModal) => {
    if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (m === "theme") setDraftTheme(theme);
    if (m === "name") setNameInput(user?.fullName ?? "");
    setActiveModal(m as ModalType);
  }, [theme, user]);

  const close = () => setActiveModal("none");

  const openAppLock = () => {
    setAppLockPinDraft("");
    setAppLockConfirmDraft("");
    setAppLockBiometricsDraft(useBiometrics && isBiometricsSupported);
    setEditingAppLockPin(!appLockEnabled);
    setAppLockError(null);
    setActiveModal("appLock");
  };

  const startEditingAppLockPin = () => {
    setAppLockError(null);
    setAppLockPinDraft("");
    setAppLockConfirmDraft("");
    setEditingAppLockPin(true);
  };

  const handleDisableAppLock = () => {
    Alert.alert("Turn off App Lock?", "PIN and biometric unlock will be removed from this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Turn off",
        style: "destructive",
        onPress: async () => {
          try {
            setAppLockSaving(true);
            await disableLock();
            close();
          } finally {
            setAppLockSaving(false);
          }
        },
      },
    ]);
  };

  const saveAppLockSettings = async () => {
    if (showPinSetup) {
      const pin = appLockPinDraft.replace(/[^0-9]/g, "");
      const confirm = appLockConfirmDraft.replace(/[^0-9]/g, "");

      if (pin.length !== 4) {
        setAppLockError("Enter a 4-digit PIN.");
        return;
      }

      if (pin !== confirm) {
        setAppLockError("PINs do not match.");
        return;
      }

      try {
        setAppLockSaving(true);
        if (appLockEnabled) {
          await updatePin(pin);
          await setUseBiometrics(appLockBiometricsDraft);
        } else {
          await enableLock(pin, appLockBiometricsDraft);
        }
        close();
      } catch (error: any) {
        setAppLockError(error?.message ?? "Couldn't save your security settings.");
      } finally {
        setAppLockSaving(false);
      }
      return;
    }

    try {
      setAppLockSaving(true);
      await setUseBiometrics(appLockBiometricsDraft);
      close();
    } catch (error: any) {
      setAppLockError(error?.message ?? "Couldn't update biometric preferences.");
    } finally {
      setAppLockSaving(false);
    }
  };

  // ── Avatar upload ────────────────────────────────────────────────

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photo library to upload a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  // ── Save name ────────────────────────────────────────────────────

  const saveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    try {
      setNameSaving(true);
      await updateName(trimmed);
      close();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not update name.");
    } finally {
      setNameSaving(false);
    }
  };

  // ── Apply theme ──────────────────────────────────────────────────

  const applyTheme = () => {
    if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTheme(draftTheme);
    close();
  };

  // ── Logout ───────────────────────────────────────────────────────

  const handleLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: async () => { await signOut(); router.replace(ROUTES.AUTH as any); } },
    ]);
  };

  // CURRENCY_OPTIONS imported from currency-context


  const LANGUAGES = [
    { id: "English", label: "English", flag: "🇬🇧" }, { id: "Vietnamese", label: "Vietnamese", flag: "🇻🇳" },
    { id: "French", label: "French", flag: "🇫🇷" }, { id: "Spanish", label: "Spanish", flag: "🇪🇸" },
  ];

  return (
    <Screen className="px-0 bg-[#f4f6f9]">
      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: activeModal === "appLock" ? 520 : 120 }}
      >

        {/* ── Hero header ───────────────────────────────────────── */}
        <View style={{ backgroundColor: "#fff", paddingTop: Math.max(insets.top + 8, 24), paddingBottom: 28, paddingHorizontal: 24, alignItems: "center", borderBottomLeftRadius: 32, borderBottomRightRadius: 32, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 5 }}>

          {/* Avatar tap → pick image */}
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85}>
            <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: primary, alignItems: "center", justifyContent: "center", marginBottom: 14, shadowColor: primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.38, shadowRadius: 14, elevation: 10 }}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={{ width: 84, height: 84, borderRadius: 42 }} />
              ) : (
                <Text style={{ fontSize: 30, fontWeight: "800", color: "#fff" }}>{initials}</Text>
              )}
              {/* Camera badge */}
              <View style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: "#fff", borderWidth: 2, borderColor: "#e2e8f0", alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="camera" size={13} color={primary} />
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => open("name")} style={{ alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: "#0f172a" }}>
                {displayName}
              </Text>
              <MaterialCommunityIcons name="pencil-outline" size={16} color="#94a3b8" />
            </View>
          </TouchableOpacity>
          <Text style={{ fontSize: 13, color: "#94a3b8", fontWeight: "500", marginTop: 4 }}>
            {user?.email || "No email"}
          </Text>

          {/* Theme colour preview dot */}
          <TouchableOpacity onPress={() => open("theme")} style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: primary + "18", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 }}>
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: primary }} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: primary }}>Customize theme</Text>
          </TouchableOpacity>
        </View>

        {/* ── Settings ─────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 24, gap: 12 }}>

          <Text style={{ fontSize: 12, fontWeight: "700", color: "#94a3b8", letterSpacing: 0.8, marginBottom: 4, marginLeft: 4 }}>PREFERENCES</Text>
          <SectionCard>
            <SettingRow icon="cash-multiple" iconBg="#dcfce7" iconColor="#22c55e" label="Currency" value={currency.label} onPress={() => open("money")} />
            <Divider />
            <SettingRow icon="bell-ring-outline" iconBg="#fef3c7" iconColor="#f59e0b" label="Notifications" value={notifications ? "On" : "Off"} onPress={() => open("notification")} />
            <Divider />
            <SettingRow
              icon="shield-lock-outline"
              iconBg={appLockEnabled ? `${primary}16` : "#e2e8f0"}
              iconColor={appLockEnabled ? primary : "#475569"}
              label="App Security"
              value={securitySummary}
              onPress={openAppLock}
            />
            <Divider />
            <SettingRow icon="translate" iconBg="#e0e7ff" iconColor="#6366f1" label="Language" value={language} onPress={() => open("language")} />
          </SectionCard>

          <Text style={{ fontSize: 12, fontWeight: "700", color: "#94a3b8", letterSpacing: 0.8, marginTop: 8, marginBottom: 4, marginLeft: 4 }}>ACCOUNT</Text>
          <SectionCard>
            <SettingRow icon="palette-outline" iconBg={primary + "18"} iconColor={primary} label="Theme & Colours" onPress={() => open("theme")} />
            <Divider />
            <SettingRow icon="shield-lock-outline" iconBg="#ede9fe" iconColor="#8b5cf6" label="Change password" onPress={() => router.push(ROUTES.UPDATE_PASSWORD as any)} />
            <Divider />
            <SettingRow icon="export-variant" iconBg="#f0fdf4" iconColor="#16a34a" label="Export data" onPress={() => {}} />
            <Divider />
            <SettingRow icon="logout" iconBg="#fef2f2" iconColor="#ef4444" label="Log out" danger onPress={handleLogout} />
          </SectionCard>

          <Text style={{ textAlign: "center", fontSize: 12, color: "#cbd5e1", marginTop: 12, marginBottom: 4 }}>Finance Tracker · v1.0.0</Text>
        </View>
        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ════════════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════════════ */}

      {/* ── Change name ───────────────────────────────────────── */}
      <BottomSheet visible={activeModal === "name"} title="Edit name" onClose={close}>
        <View style={{ padding: 20, gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", borderRadius: 16, borderWidth: 1.5, borderColor: "#e2e8f0", paddingHorizontal: 16, height: 52 }}>
            <MaterialCommunityIcons name="account-outline" size={20} color="#94a3b8" style={{ marginRight: 10 }} />
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Your full name"
              placeholderTextColor="#94a3b8"
              autoFocus
              style={{ flex: 1, fontSize: 15, fontWeight: "600", color: "#0f172a" }}
            />
          </View>
          <TouchableOpacity
            onPress={saveName}
            disabled={nameSaving || !nameInput.trim()}
            style={{ backgroundColor: nameSaving || !nameInput.trim() ? "#93c5fd" : primary, borderRadius: 16, height: 52, alignItems: "center", justifyContent: "center" }}
          >
            {nameSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Save name</Text>
            )}
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* ── App Lock ──────────────────────────────────────────── */}
      <BottomSheet visible={activeModal === "appLock"} title="App Security" onClose={close} scroll={false}>
        <View style={{ padding: 20, gap: 16 }}>
          <View style={{ backgroundColor: "#0f172a", borderRadius: 24, padding: 20, gap: 14 }}>
            <View style={{ width: 50, height: 50, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
              <MaterialCommunityIcons name="shield-lock-outline" size={24} color="#fff" />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: "#fff" }}>
                {appLockEnabled ? securitySummary : "Secure the app your way"}
              </Text>
              <Text style={{ fontSize: 13, lineHeight: 20, color: "#cbd5e1", fontWeight: "600" }}>
                PIN is the base lock. Add {biometricLabel.toLowerCase()} so users can unlock faster without losing the PIN fallback.
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <SecurityMethodCard
              icon="lock-outline"
              iconBg={`${primary}12`}
              iconColor={primary}
              title="PIN"
              description={appLockEnabled ? "Your required fallback whenever the app is protected." : "Create a 4-digit code that always unlocks the app."}
              status={appLockEnabled ? "Required" : "Setup"}
              footer={(
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MaterialCommunityIcons name="numeric-4-circle-outline" size={18} color="#475569" />
                  <Text style={{ flex: 1, fontSize: 12, fontWeight: "700", color: "#475569" }}>
                    {appLockEnabled ? "PIN fallback is active" : "PIN not created yet"}
                  </Text>
                </View>
              )}
            />
            <SecurityMethodCard
              icon={biometricIcon}
              iconBg={`${primary}12`}
              iconColor={primary}
              title={biometricLabel}
              description={isBiometricsSupported ? "Quick unlock powered by the device security already on the phone." : "Biometric unlock becomes available once the device is enrolled."}
              status={isBiometricsSupported ? (appLockBiometricsDraft ? "On" : "Optional") : "Unavailable"}
              footer={(
                isBiometricsSupported ? (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <Text style={{ flex: 1, fontSize: 12, fontWeight: "700", color: "#475569" }}>Use as a faster shortcut</Text>
                    <Switch
                      value={appLockBiometricsDraft}
                      onValueChange={(value) => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setAppLockError(null);
                        setAppLockBiometricsDraft(value);
                      }}
                      trackColor={{ false: "#e2e8f0", true: "#22c55e" }}
                      thumbColor="#fff"
                      ios_backgroundColor="#e2e8f0"
                    />
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#94a3b8" />
                    <Text style={{ flex: 1, fontSize: 12, fontWeight: "700", color: "#94a3b8" }}>Set up biometrics in device settings</Text>
                  </View>
                )
              )}
            />
          </View>

          {showPinSetup ? (
            <>
              <View style={{ backgroundColor: "#f8fafc", borderRadius: 24, padding: 18, borderWidth: 1.5, borderColor: "#e2e8f0", gap: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: `${primary}12`, alignItems: "center", justifyContent: "center" }}>
                      <MaterialCommunityIcons name="dialpad" size={20} color={primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "800", color: "#0f172a" }}>
                        {appLockEnabled ? "Refresh your PIN" : "Create your PIN"}
                      </Text>
                      <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 18, color: "#64748b", fontWeight: "600" }}>
                        {pinReady ? "Step 2 of 2: confirm the same code." : "Step 1 of 2: choose a new 4-digit code."}
                      </Text>
                    </View>
                  </View>
                  <View style={{ borderRadius: 999, backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: "800", color: primary }}>{pinReady ? "Confirm" : "Create"}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <PinStageCard
                    label="CREATE"
                    active={!pinReady}
                    complete={pinReady}
                    value={appLockPinDraft}
                    primary={primary}
                  />
                  <PinStageCard
                    label="CONFIRM"
                    active={pinReady}
                    complete={pinReady && confirmReady}
                    value={appLockConfirmDraft}
                    primary={primary}
                  />
                </View>
              </View>

              {appLockError ? (
                <View style={{ borderRadius: 16, backgroundColor: "#fff1f2", borderWidth: 1.5, borderColor: "#fecdd3", paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#e11d48" />
                  <Text style={{ flex: 1, color: "#be123c", fontSize: 12, fontWeight: "700" }}>{appLockError}</Text>
                </View>
              ) : null}

              <UnifiedNumpad
                value={appLockInputValue}
                onChange={(value) => {
                  setAppLockError(null);
                  if (appLockPinDraft.length < 4) {
                    setAppLockPinDraft(value);
                    return;
                  }

                  if (value === "" && appLockConfirmDraft === "") {
                    setAppLockPinDraft((current) => current.slice(0, -1));
                    return;
                  }

                  setAppLockConfirmDraft(value);
                }}
                mode="pin"
                maxLength={4}
                title={pinReady ? "Confirm your PIN" : "Create your PIN"}
                subtitle={pinReady ? "Enter the same 4 digits again to lock it in." : "Use the security keypad below to choose four digits."}
              />

              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity
                  onPress={saveAppLockSettings}
                  disabled={appLockSaving || !canSaveAppLock}
                  style={{ flex: 1, backgroundColor: appLockSaving || !canSaveAppLock ? "#93c5fd" : primary, borderRadius: 18, height: 54, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
                >
                  {appLockSaving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="shield-check-outline" size={18} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>{appLockButtonLabel}</Text>
                    </>
                  )}
                </TouchableOpacity>

                {appLockEnabled ? (
                  <TouchableOpacity
                    onPress={() => {
                      setEditingAppLockPin(false);
                      setAppLockPinDraft("");
                      setAppLockConfirmDraft("");
                      setAppLockError(null);
                    }}
                    style={{ flex: 1, alignItems: "center", justifyContent: "center", height: 54, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e2e8f0", flexDirection: "row", gap: 8 }}
                  >
                    <MaterialCommunityIcons name="history" size={18} color="#475569" />
                    <Text style={{ color: "#475569", fontWeight: "800", fontSize: 14 }}>Keep current</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
          ) : (
            <>
              {appLockError ? (
                <View style={{ borderRadius: 16, backgroundColor: "#fff1f2", borderWidth: 1.5, borderColor: "#fecdd3", paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#e11d48" />
                  <Text style={{ flex: 1, color: "#be123c", fontSize: 12, fontWeight: "700" }}>{appLockError}</Text>
                </View>
              ) : null}

              <View style={{ backgroundColor: "#f8fafc", borderRadius: 24, padding: 18, borderWidth: 1.5, borderColor: "#e2e8f0", gap: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 16, backgroundColor: `${primary}12`, alignItems: "center", justifyContent: "center" }}>
                    <MaterialCommunityIcons name="shield-check-outline" size={20} color={primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "800", color: "#0f172a" }}>Security is live</Text>
                    <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 18, color: "#64748b", fontWeight: "600" }}>
                      Update your quick unlock preference or rotate the PIN any time.
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                  <View style={{ borderRadius: 999, backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <MaterialCommunityIcons name="lock-outline" size={16} color="#475569" />
                    <Text style={{ fontSize: 12, fontWeight: "800", color: "#475569" }}>PIN required</Text>
                  </View>
                  {appLockBiometricsDraft ? (
                    <View style={{ borderRadius: 999, backgroundColor: `${primary}12`, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <MaterialCommunityIcons name={biometricIcon as any} size={16} color={primary} />
                      <Text style={{ fontSize: 12, fontWeight: "800", color: primary }}>{biometricLabel} shortcut</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {canSaveAppLock ? (
                <TouchableOpacity
                  onPress={saveAppLockSettings}
                  disabled={appLockSaving || !canSaveAppLock}
                  style={{ backgroundColor: appLockSaving || !canSaveAppLock ? "#93c5fd" : primary, borderRadius: 18, height: 54, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
                >
                  {appLockSaving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="content-save-outline" size={18} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>{appLockButtonLabel}</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}

              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity
                  onPress={startEditingAppLockPin}
                  style={{ flex: 1, alignItems: "center", justifyContent: "center", height: 56, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e2e8f0", gap: 8 }}
                >
                  <MaterialCommunityIcons name="lock-reset" size={18} color="#475569" />
                  <Text style={{ color: "#475569", fontWeight: "800", fontSize: 14 }}>Change PIN</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleDisableAppLock}
                  style={{ flex: 1, alignItems: "center", justifyContent: "center", height: 56, borderRadius: 18, backgroundColor: "#fff1f2", borderWidth: 1.5, borderColor: "#fecdd3", gap: 8 }}
                >
                  <MaterialCommunityIcons name="shield-off-outline" size={18} color="#e11d48" />
                  <Text style={{ color: "#e11d48", fontWeight: "800", fontSize: 14 }}>Turn off</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </BottomSheet>

      {/* ── Theme picker ──────────────────────────────────────── */}
      <BottomSheet visible={activeModal === "theme"} title="Theme & Colours" onClose={close} scroll={false}>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>

          {/* Tab toggle */}
          <View style={{ flexDirection: "row", marginHorizontal: 20, marginTop: 16, backgroundColor: "#f1f5f9", borderRadius: 14, padding: 3 }}>
            {(["solid", "gradient"] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setThemeTab(tab)}
                style={{ flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: "center", backgroundColor: themeTab === tab ? "#fff" : "transparent", shadowColor: themeTab === tab ? "#000" : "transparent", shadowOpacity: 0.07, shadowRadius: 4, elevation: themeTab === tab ? 2 : 0 }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: themeTab === tab ? "#0f172a" : "#94a3b8" }}>
                  {tab === "solid" ? "Solid" : "Gradient"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {themeTab === "solid" ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#94a3b8", letterSpacing: 0.8, marginBottom: 12, marginLeft: 4 }}>ACCENT COLOUR</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {SOLID_PRESETS.map((preset) => {
                  const sel = draftTheme.primary === preset.color;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      onPress={() => { Haptics.selectionAsync(); setDraftTheme((d) => ({ ...d, primary: preset.color })); }}
                      style={{ alignItems: "center", margin: 6, width: 56 }}
                    >
                      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: preset.color, alignItems: "center", justifyContent: "center", borderWidth: sel ? 3 : 0, borderColor: "#fff", shadowColor: preset.color, shadowOffset: { width: 0, height: 3 }, shadowOpacity: sel ? 0.55 : 0.15, shadowRadius: 6, elevation: sel ? 8 : 2 }}>
                        {sel && <MaterialCommunityIcons name="check" size={20} color="#fff" />}
                      </View>
                      <Text style={{ fontSize: 10, fontWeight: "600", color: "#64748b", marginTop: 4 }}>{preset.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#94a3b8", letterSpacing: 0.8, marginBottom: 12, marginLeft: 4 }}>GRADIENT PRESET</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {GRADIENT_PRESETS.map((g) => (
                  <GradientSwatch
                    key={g.id}
                    colors={g.colors}
                    selected={draftTheme.gradient.id === g.id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setDraftTheme((d) => ({ ...d, gradient: g, primary: g.colors[0] }));
                    }}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Preview strip */}
          <View style={{ marginHorizontal: 20, marginTop: 20, borderRadius: 16, overflow: "hidden", height: 56, backgroundColor: draftTheme.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center" }}>
              <MaterialCommunityIcons name="check" size={15} color="#fff" />
            </View>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Preview colour</Text>
          </View>

          {/* Apply button */}
          <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>
            <TouchableOpacity onPress={applyTheme} style={{ backgroundColor: draftTheme.primary, borderRadius: 16, height: 52, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Apply theme</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </BottomSheet>

      {/* ── Currency ──────────────────────────────────────────── */}
      <BottomSheet visible={activeModal === "money"} title="Currency" onClose={close}>
        <View style={{ paddingTop: 8 }}>
          {CURRENCY_OPTIONS.map((c, i, arr) => (
            <TouchableOpacity key={c.id} onPress={() => { setCurrency(c); close(); }} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: i !== arr.length - 1 ? 1 : 0, borderBottomColor: "#f1f5f9" }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "#f0f9ff", alignItems: "center", justifyContent: "center", marginRight: 14 }}>
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#0ea5e9" }}>{c.symbol}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: "#0f172a" }}>{c.label}</Text>
              {currency.id === c.id && (
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#22c55e", alignItems: "center", justifyContent: "center" }}>
                  <MaterialCommunityIcons name="check" size={15} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheet>


      {/* ── Notifications ─────────────────────────────────────── */}
      <BottomSheet visible={activeModal === "notification"} title="Notifications" onClose={close}>
        <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "#fef3c7", alignItems: "center", justifyContent: "center", marginRight: 14 }}>
              <MaterialCommunityIcons name="bell-ring-outline" size={20} color="#f59e0b" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#0f172a" }}>Allow notifications</Text>
              <Text style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Transaction reminders</Text>
            </View>
            <Switch value={notifications} onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setNotifications(v); }} trackColor={{ false: "#e2e8f0", true: "#22c55e" }} thumbColor="#fff" ios_backgroundColor="#e2e8f0" />
          </View>
        </View>
      </BottomSheet>

      {/* ── Language ──────────────────────────────────────────── */}
      <BottomSheet visible={activeModal === "language"} title="Language" onClose={close}>
        <View style={{ paddingTop: 8 }}>
          {LANGUAGES.map((lang, i, arr) => (
            <TouchableOpacity key={lang.id} onPress={() => { setLanguage(lang.id); close(); }} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: i !== arr.length - 1 ? 1 : 0, borderBottomColor: "#f1f5f9" }}>
              <Text style={{ fontSize: 24, marginRight: 14 }}>{lang.flag}</Text>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: "#0f172a" }}>{lang.label}</Text>
              {language === lang.id && (
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#22c55e", alignItems: "center", justifyContent: "center" }}>
                  <MaterialCommunityIcons name="check" size={15} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheet>
    </Screen>
  );
}
