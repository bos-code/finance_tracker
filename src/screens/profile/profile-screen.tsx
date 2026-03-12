import { Screen } from "@/components/ui/screen";
import { GRADIENT_PRESETS, SOLID_PRESETS, ThemeConfig, useTheme } from "@/context/theme-context";
import { useCurrency, CURRENCY_OPTIONS } from "@/context/currency-context";
import { useAuth } from "@/hooks/use-auth";

import { ROUTES } from "@/navigation/route-names";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";

import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
      onPressOut={() => { scale.value = withSpring(1); onPress?.(); }}
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

function BottomSheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(10,18,40,0.4)" }} activeOpacity={1} onPress={onClose} />
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Math.max(insets.bottom, 24), shadowColor: "#000", shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 30 }}>
        <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 8 }}>
          <View style={{ width: 36, height: 4, borderRadius: 99, backgroundColor: "#e2e8f0" }} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: "#0f172a" }}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <MaterialCommunityIcons name="close" size={20} color="#94a3b8" />
          </TouchableOpacity>
        </View>
        {children}
      </View>
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
        <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="check" size={22} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function ProfileScreen() {
  const { user, signOut, updateName } = useAuth();
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const insets = useSafeAreaInsets();

  // Settings state
  const [activeModal, setActiveModal] = useState<"money" | "notification" | "language" | "theme" | "name" | null>(null);
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

  const primary = theme.primary;
  const initials = getInitials(user?.fullName);

  const open = useCallback((m: typeof activeModal) => {
    if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (m === "theme") setDraftTheme(theme);
    if (m === "name") setNameInput(user?.fullName ?? "");
    setActiveModal(m);
  }, [theme, user]);

  const close = () => setActiveModal(null);

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
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>

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
                {user?.fullName || "Guest User"}
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
            <SettingRow icon="cash-multiple" iconBg="#dcfce7" iconColor="#22c55e" label="Currency" value={currency} onPress={() => open("money")} />
            <Divider />
            <SettingRow icon="bell-ring-outline" iconBg="#fef3c7" iconColor="#f59e0b" label="Notifications" value={notifications ? "On" : "Off"} onPress={() => open("notification")} />
            <Divider />
            <SettingRow icon="translate" iconBg="#e0e7ff" iconColor="#6366f1" label="Language" value={language} onPress={() => open("language")} />
          </SectionCard>

          <Text style={{ fontSize: 12, fontWeight: "700", color: "#94a3b8", letterSpacing: 0.8, marginTop: 8, marginBottom: 4, marginLeft: 4 }}>ACCOUNT</Text>
          <SectionCard>
            <SettingRow icon="palette-outline" iconBg={primary + "18"} iconColor={primary} label="Theme & Colours" onPress={() => open("theme")} />
            <Divider />
            <SettingRow icon="shield-lock-outline" iconBg="#ede9fe" iconColor="#8b5cf6" label="Change password" onPress={() => router.push(ROUTES.AUTH as any)} />
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

      {/* ── Theme picker ──────────────────────────────────────── */}
      <BottomSheet visible={activeModal === "theme"} title="Theme & Colours" onClose={close}>
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
