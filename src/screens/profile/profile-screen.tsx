import { AppLockSettingsPanel } from "@/components/auth/app-lock-settings-panel";
import { ActionButton } from "@/components/finance/action-button";
import { FinanceField } from "@/components/finance/finance-field";
import { FinanceSheet } from "@/components/finance/finance-sheet";
import { PageHeading } from "@/components/finance/page-heading";
import { Screen } from "@/components/ui/screen";
import { SignalThreads } from "@/components/visuals/signal-threads";
import { useAppLock } from "@/context/app-lock-context";
import { useAuth } from "@/hooks/use-auth";
import { ROUTES } from "@/navigation/route-names";
import { CURRENCY_OPTIONS, useAppStore } from "@/store/use-app-store";
import { palette } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

type ProfileSheet =
  | "name"
  | "currency"
  | "notifications"
  | "security"
  | "connections"
  | "privacy"
  | "none";

type NotificationPreferences = {
  confirmations: boolean;
  failures: boolean;
  goals: boolean;
  weeklySummary: boolean;
};

function getInitials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0][0].toLocaleUpperCase()
    : `${parts[0][0]}${parts[parts.length - 1][0]}`.toLocaleUpperCase();
}

function SettingsSection({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <View style={styles.settingsSection}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionLabel}>{label.toLocaleUpperCase()}</Text>
        <View style={styles.sectionRule} />
      </View>
      <View style={styles.sectionRows}>{children}</View>
    </View>
  );
}

function SettingRow({
  description,
  icon,
  label,
  onPress,
  signal = palette.textQuiet,
  tone = "default",
  value,
}: {
  description: string;
  icon: string;
  label: string;
  onPress?: () => void;
  signal?: string;
  tone?: "default" | "danger";
  value?: string;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingRow,
        { opacity: pressed ? 0.58 : 1 },
      ]}>
      <View style={[styles.settingSignal, { backgroundColor: signal }]} />
      <View style={styles.settingIcon}>
        <MaterialCommunityIcons
          color={tone === "danger" ? palette.expense : palette.textMuted}
          name={icon as never}
          size={19}
        />
      </View>
      <View style={styles.settingCopy}>
        <Text
          style={[
            styles.settingLabel,
            tone === "danger" ? styles.settingLabelDanger : null,
          ]}>
          {label}
        </Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      {value ? <Text style={styles.settingValue}>{value}</Text> : null}
      {onPress ? (
        <MaterialCommunityIcons
          color={palette.textQuiet}
          name="chevron-right"
          size={18}
        />
      ) : null}
    </Pressable>
  );
}

function NotificationRow({
  description,
  label,
  onChange,
  value,
}: {
  description: string;
  label: string;
  onChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <View
        style={[
          styles.toggleSignal,
          {
            backgroundColor: value ? palette.signalMoss : palette.lineStrong,
          },
        ]}
      />
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        ios_backgroundColor={palette.line}
        onValueChange={(nextValue) => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onChange(nextValue);
        }}
        thumbColor={value ? palette.text : palette.textQuiet}
        trackColor={{ false: palette.line, true: palette.lineStrong }}
        value={value}
      />
    </View>
  );
}

function ReadinessRow({
  description,
  label,
  status,
  statusColor,
}: {
  description: string;
  label: string;
  status: string;
  statusColor: string;
}) {
  return (
    <View style={styles.readinessRow}>
      <View style={[styles.readinessSignal, { backgroundColor: statusColor }]} />
      <View style={styles.readinessCopy}>
        <Text style={styles.readinessLabel}>{label}</Text>
        <Text style={styles.readinessDescription}>{description}</Text>
      </View>
      <Text style={[styles.readinessStatus, { color: statusColor }]}>
        {status.toLocaleUpperCase()}
      </Text>
    </View>
  );
}

export function ProfileScreen() {
  const { signOut, updateName, user } = useAuth();
  const currency = useAppStore((state) => state.currency);
  const setCurrency = useAppStore((state) => state.setCurrency);
  const {
    biometricLabel,
    disableLock,
    enabled: appLockEnabled,
    useBiometrics,
  } = useAppLock();

  const [activeSheet, setActiveSheet] = useState<ProfileSheet>("none");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState(user?.fullName ?? "");
  const [nameSaving, setNameSaving] = useState(false);
  const [notifications, setNotifications] =
    useState<NotificationPreferences>({
      confirmations: true,
      failures: true,
      goals: false,
      weeklySummary: false,
    });

  const displayName =
    user?.fullName?.trim() ||
    (user?.email ? user.email.split("@")[0] : "") ||
    "Guest user";
  const initials = getInitials(displayName);
  const securitySummary = !appLockEnabled
    ? "Off"
    : useBiometrics
      ? `PIN + ${biometricLabel}`
      : "PIN only";
  const enabledNotifications = Object.values(notifications).filter(Boolean).length;
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  const openSheet = useCallback(
    (sheet: ProfileSheet) => {
      if (sheet === "name") setNameInput(user?.fullName ?? "");
      setActiveSheet(sheet);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [user?.fullName],
  );

  const closeSheet = useCallback(() => setActiveSheet("none"), []);

  const pickAvatar = async () => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Photo permission needed",
        "Allow photo-library access to preview a profile image on this device.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const saveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    try {
      setNameSaving(true);
      await updateName(trimmed);
      closeSheet();
    } catch (error) {
      Alert.alert(
        "Name not updated",
        error instanceof Error ? error.message : "Try again in a moment.",
      );
    } finally {
      setNameSaving(false);
    }
  };

  const chooseCurrency = async (currencyId: string) => {
    const nextCurrency = CURRENCY_OPTIONS.find(
      (option) => option.id === currencyId,
    );
    if (!nextCurrency) return;
    try {
      await setCurrency(nextCurrency, user?.uid);
      closeSheet();
    } catch {
      closeSheet();
      Alert.alert(
        "Saved on this device",
        "The currency changed locally, but its cloud preference could not be updated yet.",
      );
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Log out?",
      appLockEnabled
        ? "This device will return to sign in and its local App Lock credential will be removed."
        : "This device will return to the sign-in screen.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out",
          style: "destructive",
          onPress: async () => {
            if (appLockEnabled) await disableLock();
            await signOut();
            router.replace(ROUTES.AUTH as never);
          },
        },
      ],
    );
  };

  return (
    <Screen backgroundColor={palette.canvas} className="px-0">
      <SignalThreads intensity="quiet" />
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <PageHeading
          description="Control the personal workspace, regional defaults, connections, and protection around your financial record."
          eyebrow="CONTROL / PERSONAL"
          title="Profile"
        />

        <View style={styles.identityPanel}>
          <View style={styles.identityThread} />
          <Pressable
            accessibilityLabel="Preview profile photo"
            accessibilityRole="button"
            onPress={() => void pickAvatar()}
            style={({ pressed }) => [
              styles.avatar,
              { opacity: pressed ? 0.62 : 1 },
            ]}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
            <View style={styles.avatarBadge}>
              <MaterialCommunityIcons
                color={palette.textMuted}
                name="camera-outline"
                size={12}
              />
            </View>
          </Pressable>
          <View style={styles.identityCopy}>
            <Pressable
              accessibilityLabel="Edit name"
              accessibilityRole="button"
              onPress={() => openSheet("name")}
              style={({ pressed }) => ({ opacity: pressed ? 0.58 : 1 })}>
              <View style={styles.nameRow}>
                <Text style={styles.displayName}>{displayName}</Text>
                <MaterialCommunityIcons
                  color={palette.textQuiet}
                  name="pencil-outline"
                  size={15}
                />
              </View>
            </Pressable>
            <Text style={styles.email}>{user?.email || "No email"}</Text>
            <Text style={styles.avatarNote}>PHOTO PREVIEW / THIS SESSION</Text>
          </View>
        </View>

        <View style={styles.workspacePanel}>
          <View style={styles.workspaceTopline}>
            <Text style={styles.workspaceEyebrow}>WORKSPACE 01</Text>
            <Text style={styles.workspaceStatus}>CURRENT</Text>
          </View>
          <Text style={styles.workspaceTitle}>Personal ledger</Text>
          <Text style={styles.workspaceDescription}>
            A single-owner workspace. Multi-account structure arrives with the
            backend workspace and account contracts.
          </Text>
          <View style={styles.workspaceMeta}>
            <Text style={styles.workspaceMetaText}>{currency.code} BASE</Text>
            <View style={styles.workspaceMetaRule} />
            <Text style={styles.workspaceMetaText}>PRIVATE BY DEFAULT</Text>
          </View>
        </View>

        <SettingsSection label="Money and attention">
          <SettingRow
            description="Manual choice remains stable while travelling."
            icon="cash-multiple"
            label="Currency"
            onPress={() => openSheet("currency")}
            signal={palette.signalMoss}
            value={currency.code}
          />
          <SettingRow
            description="Confirmations, failures, goals, and summaries."
            icon="bell-outline"
            label="Notifications"
            onPress={() => openSheet("notifications")}
            signal={palette.signalAmber}
            value={`${enabledNotifications}/4`}
          />
          <SettingRow
            description="The black, white, and graphite system is binding."
            icon="palette-outline"
            label="Appearance"
            signal={palette.signalViolet}
            value="Obsidian"
          />
        </SettingsSection>

        <SettingsSection label="Automation">
          <SettingRow
            description="Secure linking and transaction capture ship with Backend Stage 7."
            icon="send-outline"
            label="Telegram"
            onPress={() => openSheet("connections")}
            signal={palette.signalCyan}
            value="Not linked"
          />
          <SettingRow
            description="Cloud API implementation is explicitly deferred."
            icon="whatsapp"
            label="WhatsApp"
            onPress={() => openSheet("connections")}
            signal={palette.textQuiet}
            value="Later"
          />
        </SettingsSection>

        <SettingsSection label="Privacy and security">
          <SettingRow
            description="Device-local PIN with optional biometric shortcut."
            icon="shield-lock-outline"
            label="App lock"
            onPress={() => openSheet("security")}
            signal={appLockEnabled ? palette.income : palette.textQuiet}
            value={securitySummary}
          />
          <SettingRow
            description="Receipt privacy, AI review boundaries, export, and retention."
            icon="file-lock-outline"
            label="Data controls"
            onPress={() => openSheet("privacy")}
            signal={palette.signalViolet}
            value="Review"
          />
          <SettingRow
            description="Use the secure password recovery boundary."
            icon="key-outline"
            label="Change password"
            onPress={() => router.push(ROUTES.UPDATE_PASSWORD as never)}
            signal={palette.textQuiet}
          />
        </SettingsSection>

        <SettingsSection label="Session">
          <SettingRow
            description="Remove this session from the device."
            icon="logout"
            label="Log out"
            onPress={handleLogout}
            signal={palette.expense}
            tone="danger"
          />
        </SettingsSection>

        <View style={styles.footer}>
          <View style={styles.footerRule} />
          <Text style={styles.footerText}>
            FINANCE TRACKER / {appVersion} / OBSIDIAN THREAD
          </Text>
        </View>
      </ScrollView>

      <FinanceSheet
        description="This name is shown across your personal workspace."
        onClose={closeSheet}
        title="Edit name"
        visible={activeSheet === "name"}>
        <FinanceField
          autoCapitalize="words"
          autoFocus
          label="Full name"
          onChangeText={setNameInput}
          placeholder="Your name"
          value={nameInput}
        />
        <ActionButton
          disabled={!nameInput.trim()}
          label="Save name"
          loading={nameSaving}
          onPress={() => void saveName()}
        />
      </FinanceSheet>

      <FinanceSheet
        description="Changing this updates display formatting; it does not convert historical values."
        onClose={closeSheet}
        title="Currency"
        visible={activeSheet === "currency"}>
        <View style={styles.currencyList}>
          {CURRENCY_OPTIONS.map((option) => {
            const selected = option.id === currency.id;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={option.id}
                onPress={() => void chooseCurrency(option.id)}
                style={({ pressed }) => [
                  styles.currencyRow,
                  { opacity: pressed ? 0.58 : 1 },
                ]}>
                <View style={styles.currencySymbol}>
                  <Text style={styles.currencySymbolText}>{option.symbol}</Text>
                </View>
                <View style={styles.currencyCopy}>
                  <Text style={styles.currencyCode}>{option.code}</Text>
                  <Text style={styles.currencyName}>{option.label}</Text>
                </View>
                {selected ? (
                  <View style={styles.currencySelected}>
                    <MaterialCommunityIcons
                      color={palette.black}
                      name="check"
                      size={14}
                    />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </FinanceSheet>

      <FinanceSheet
        description="These controls are a frontend preview until notification preferences are persisted by Backend Stage 9."
        onClose={closeSheet}
        title="Notifications"
        visible={activeSheet === "notifications"}>
        <NotificationRow
          description="A receipt after a transaction is recorded."
          label="Transaction confirmations"
          onChange={(confirmations) =>
            setNotifications((current) => ({ ...current, confirmations }))
          }
          value={notifications.confirmations}
        />
        <NotificationRow
          description="Only failed writes, parsing, or receipt processing."
          label="Failure alerts"
          onChange={(failures) =>
            setNotifications((current) => ({ ...current, failures }))
          }
          value={notifications.failures}
        />
        <NotificationRow
          description="Upcoming targets and evidence-based risk."
          label="Goal reminders"
          onChange={(goals) =>
            setNotifications((current) => ({ ...current, goals }))
          }
          value={notifications.goals}
        />
        <NotificationRow
          description="A quiet summary rather than daily noise."
          label="Weekly summary"
          onChange={(weeklySummary) =>
            setNotifications((current) => ({ ...current, weeklySummary }))
          }
          value={notifications.weeklySummary}
        />
      </FinanceSheet>

      <FinanceSheet
        description="Channel status is honest until the server-side linking contracts are deployed."
        onClose={closeSheet}
        title="Connections"
        visible={activeSheet === "connections"}>
        <ReadinessRow
          description="Shared bot, expiring link code, transaction capture, receipts, and queries."
          label="Telegram"
          status="Backend Stage 7"
          statusColor={palette.signalCyan}
        />
        <ReadinessRow
          description="The WhatsApp Cloud API is outside this release's implementation scope."
          label="WhatsApp"
          status="Deferred"
          statusColor={palette.textQuiet}
        />
        <ActionButton
          disabled
          label="Connect after backend deployment"
          onPress={() => undefined}
          tone="quiet"
        />
      </FinanceSheet>

      <FinanceSheet
        description="Current guarantees and the controls still waiting on backend contracts."
        onClose={closeSheet}
        title="Data controls"
        visible={activeSheet === "privacy"}>
        <ReadinessRow
          description="Database rows are queried under the signed-in user boundary."
          label="Transaction ownership"
          status="Active"
          statusColor={palette.income}
        />
        <ReadinessRow
          description="Images and PDFs will use private buckets and signed URLs."
          label="Private receipts"
          status="Stage 4"
          statusColor={palette.signalViolet}
        />
        <ReadinessRow
          description="Parser, OCR, and AI fields will require explicit confirmation."
          label="Review before apply"
          status="Stages 5–9"
          statusColor={palette.signalAmber}
        />
        <ReadinessRow
          description="Portable export, retention, and account deletion require final security contracts."
          label="Export and deletion"
          status="Stage 10"
          statusColor={palette.textQuiet}
        />
      </FinanceSheet>

      <FinanceSheet
        description="App lock is device-local and sits inside the signed-in session boundary."
        onClose={closeSheet}
        title="App security"
        visible={activeSheet === "security"}>
        <AppLockSettingsPanel
          isOpen={activeSheet === "security"}
          onClose={closeSheet}
        />
      </FinanceSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    alignSelf: "center",
    maxWidth: 720,
    paddingBottom: 150,
    paddingHorizontal: 20,
    width: "100%",
  },
  identityPanel: {
    alignItems: "center",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingBottom: 24,
    position: "relative",
  },
  identityThread: {
    backgroundColor: palette.signalCyan,
    bottom: 24,
    left: 0,
    position: "absolute",
    top: 0,
    width: 1,
  },
  avatar: {
    alignItems: "center",
    borderColor: palette.lineStrong,
    borderRadius: 28,
    borderWidth: 1,
    height: 72,
    justifyContent: "center",
    marginLeft: 16,
    marginRight: 18,
    width: 72,
  },
  avatarImage: { borderRadius: 27, height: 70, width: 70 },
  avatarText: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 24,
  },
  avatarBadge: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: 10,
    borderWidth: 1,
    bottom: -2,
    height: 24,
    justifyContent: "center",
    position: "absolute",
    right: -2,
    width: 24,
  },
  identityCopy: { flex: 1, gap: 6 },
  nameRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  displayName: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 24,
  },
  email: { color: palette.textMuted, fontFamily: fonts.body, fontSize: 11 },
  avatarNote: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.45,
  },
  workspacePanel: {
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    paddingVertical: 24,
  },
  workspaceTopline: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  workspaceEyebrow: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 0.7,
  },
  workspaceStatus: {
    color: palette.income,
    fontFamily: fonts.ledger,
    fontSize: 7,
  },
  workspaceTitle: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 26,
    marginTop: 12,
  },
  workspaceDescription: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 8,
    maxWidth: 460,
  },
  workspaceMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  workspaceMetaText: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.4,
  },
  workspaceMetaRule: { backgroundColor: palette.lineStrong, height: 1, width: 18 },
  settingsSection: { marginTop: 28 },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  sectionLabel: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 0.8,
  },
  sectionRule: { backgroundColor: palette.line, flex: 1, height: 1 },
  sectionRows: { borderTopColor: palette.line, borderTopWidth: 1 },
  settingRow: {
    alignItems: "center",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 78,
    position: "relative",
  },
  settingSignal: { height: 30, marginRight: 12, width: 1 },
  settingIcon: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 12,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    marginRight: 12,
    width: 38,
  },
  settingCopy: { flex: 1, gap: 4, marginRight: 10 },
  settingLabel: {
    color: palette.text,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "600",
  },
  settingLabelDanger: { color: palette.expense },
  settingDescription: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 9,
    lineHeight: 14,
  },
  settingValue: {
    color: palette.textMuted,
    fontFamily: fonts.ledger,
    fontSize: 8,
    marginRight: 6,
    maxWidth: 92,
    textAlign: "right",
  },
  footer: { alignItems: "center", gap: 12, marginTop: 32 },
  footerRule: { backgroundColor: palette.line, height: 1, width: 54 },
  footerText: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.45,
  },
  currencyList: { borderTopColor: palette.line, borderTopWidth: 1 },
  currencyRow: {
    alignItems: "center",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 64,
  },
  currencySymbol: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 11,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    marginRight: 12,
    width: 36,
  },
  currencySymbolText: {
    color: palette.textMuted,
    fontFamily: fonts.display,
    fontSize: 16,
  },
  currencyCopy: { flex: 1, gap: 4 },
  currencyCode: {
    color: palette.text,
    fontFamily: fonts.ledger,
    fontSize: 9,
  },
  currencyName: { color: palette.textQuiet, fontFamily: fonts.body, fontSize: 9 },
  currencySelected: {
    alignItems: "center",
    backgroundColor: palette.text,
    borderRadius: 10,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  toggleRow: {
    alignItems: "center",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 72,
  },
  toggleSignal: { height: 28, marginRight: 13, width: 1 },
  toggleCopy: { flex: 1, gap: 4, marginRight: 12 },
  toggleLabel: {
    color: palette.text,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "600",
  },
  toggleDescription: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 9,
    lineHeight: 14,
  },
  readinessRow: {
    alignItems: "stretch",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 82,
    paddingVertical: 14,
  },
  readinessSignal: { marginRight: 13, width: 1 },
  readinessCopy: { flex: 1, gap: 5, marginRight: 12 },
  readinessLabel: {
    color: palette.text,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "600",
  },
  readinessDescription: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 9,
    lineHeight: 14,
  },
  readinessStatus: {
    alignSelf: "center",
    fontFamily: fonts.ledger,
    fontSize: 7,
    maxWidth: 94,
    textAlign: "right",
  },
});
