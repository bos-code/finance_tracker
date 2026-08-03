import { CategoryEditor } from "@/components/ui/category-editor";
import { CustomCalendar } from "@/components/ui/custom-calendar";
import { SaveFeedback } from "@/components/ui/save-feedback";
import { Screen } from "@/components/ui/screen";
import { UnifiedNumpad } from "@/components/ui/unified-numpad";
import { SignalThreads } from "@/components/visuals/signal-threads";
import {
  ALL_CATEGORIES,
  EXPENDITURE_CATEGORIES,
  REVENUE_CATEGORIES,
  type Category,
} from "@/constants/categories";
import { useOffline } from "@/context/offline-context";
import { useAuth } from "@/hooks/use-auth";
import {
  useCreateTransaction,
  useTransactions,
} from "@/hooks/use-transactions";
import { ROUTES } from "@/navigation/route-names";
import { calcMonthSummary } from "@/services/supabase/transaction-service";
import { useAppStore } from "@/store/use-app-store";
import { palette, withAlpha } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { toLocalDateString } from "@/utils/date";
import { formatMoney } from "@/utils/money";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TransactionType = "Expenditure" | "Revenue";
type DrawerType = "none" | "amount" | "date" | "note" | "category";

const TYPE_OPTIONS: {
  label: string;
  value: TransactionType;
}[] = [
  { label: "Outflow", value: "Expenditure" },
  { label: "Income", value: "Revenue" },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function SectionHeading({
  action,
  label,
  onAction,
}: {
  action?: string;
  label: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionIndex} />
        <Text style={styles.sectionTitle}>{label}</Text>
      </View>
      {action != null && action.length > 0 && onAction != null ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={onAction}
          style={({ pressed }) => ({ opacity: pressed ? 0.58 : 1 })}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Metric({
  amount,
  label,
  tone,
}: {
  amount: string;
  label: string;
  tone: "income" | "expense";
}) {
  return (
    <View style={styles.metric}>
      <View
        style={[
          styles.metricSignal,
          {
            backgroundColor:
              tone === "income" ? palette.income : palette.expense,
          },
        ]}
      />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{amount}</Text>
    </View>
  );
}

export function HomeScreen() {
  const { user } = useAuth();
  const currency = useAppStore((state) => state.currency);
  const {
    conflictCount,
    failedCount,
    isOnline,
    pendingCount,
    refreshPendingCount,
  } = useOffline();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const {
    data: transactions = [],
    isError: transactionsFailed,
    isLoading: transactionsLoading,
    refetch: refetchTransactions,
  } = useTransactions(year, month);
  const { mutateAsync: createTx, isPending: isSubmitting } =
    useCreateTransaction();

  const [type, setType] = useState<TransactionType>("Expenditure");
  const [expCategories, setExpCategories] = useState<Category[]>(
    EXPENDITURE_CATEGORIES,
  );
  const [revCategories, setRevCategories] = useState<Category[]>(
    REVENUE_CATEGORIES,
  );
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState(expCategories[0]?.id ?? "");
  const [date, setDate] = useState(new Date());
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>("none");
  const [feedback, setFeedback] = useState<{
    visible: boolean;
    type: "success" | "error";
    title?: string;
    message: string;
  }>({ visible: false, type: "success", message: "" });

  const activeCategories =
    type === "Expenditure" ? expCategories : revCategories;
  const setActiveCategories =
    type === "Expenditure" ? setExpCategories : setRevCategories;
  const selectedCategory = activeCategories.find(
    (category) => category.id === categoryId,
  );
  const summary = useMemo(
    () => calcMonthSummary(transactions),
    [transactions],
  );
  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((first, second) =>
          `${second.transaction_date}-${second.created_at}`.localeCompare(
            `${first.transaction_date}-${first.created_at}`,
          ),
        )
        .slice(0, 4),
    [transactions],
  );
  const firstName = user?.fullName?.trim().split(/\s+/)[0] || "there";
  const monthLabel = now.toLocaleDateString("en-US", { month: "long" });

  const closeDrawer = useCallback(() => setActiveDrawer("none"), []);
  const openDrawer = useCallback((drawer: DrawerType) => {
    Keyboard.dismiss();
    setActiveDrawer(drawer);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const switchType = useCallback(
    (nextType: TransactionType) => {
      setType(nextType);
      const categories =
        nextType === "Expenditure" ? expCategories : revCategories;
      setCategoryId(categories[0]?.id ?? "");
      void Haptics.selectionAsync();
    },
    [expCategories, revCategories],
  );

  const formatSaveError = useCallback((error: unknown) => {
    if (!error) return "The transaction could not be saved.";
    if (typeof error === "string") return error;
    if (typeof error === "object") {
      const candidate = error as {
        message?: string;
        error_description?: string;
      };
      return (
        candidate.message ??
        candidate.error_description ??
        "The transaction could not be saved."
      );
    }
    return "The transaction could not be saved.";
  }, []);

  const handleSave = async () => {
    if (!user) {
      setFeedback({
        visible: true,
        type: "error",
        title: "Sign in required",
        message: "Sign in before recording a transaction.",
      });
      return;
    }

    const rawAmount = Number.parseFloat(amount.replace(/[^0-9.]/g, ""));
    if (!rawAmount || rawAmount <= 0) {
      setFeedback({
        visible: true,
        type: "error",
        title: "Check the amount",
        message: "Enter an amount greater than zero.",
      });
      return;
    }

    if (!categoryId || !selectedCategory) {
      setFeedback({
        visible: true,
        type: "error",
        title: "Choose a category",
        message: "Every ledger entry needs a category.",
      });
      return;
    }

    try {
      closeDrawer();
      const savedTransaction = await createTx({
        user_id: user.uid,
        type,
        amount: rawAmount,
        note: note.trim(),
        category_id: categoryId,
        transaction_date: toLocalDateString(date),
      });
      await refreshPendingCount();

      const savedLocally = savedTransaction.sync_state !== "synced";
      setFeedback({
        visible: true,
        type: "success",
        title: type === "Revenue" ? "Income recorded" : "Outflow recorded",
        message:
          isOnline && !savedLocally
            ? "The entry is now in your ledger."
            : "Saved on this device. It will sync when you reconnect.",
      });
      setAmount("");
      setNote("");
      setDate(new Date());
    } catch (error) {
      setFeedback({
        visible: true,
        type: "error",
        title: "Save failed",
        message: formatSaveError(error),
      });
    }
  };

  const viewTransactions = useCallback(() => {
    setFeedback((current) => ({ ...current, visible: false }));
    router.push(ROUTES.TABS_CALENDAR as never);
  }, []);

  return (
    <Screen backgroundColor={palette.canvas} className="px-0">
      <SignalThreads intensity="visible" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.fill}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.brandMark}>
              <MaterialCommunityIcons
                color={palette.text}
                name="finance"
                size={20}
              />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>FINANCE TRACKER / PERSONAL</Text>
              <Text style={styles.greeting}>
                {getGreeting()}, {firstName}.
              </Text>
            </View>
            <View
              accessibilityLabel={isOnline ? "All systems online" : "Offline"}
              accessibilityRole="text"
              style={styles.networkStatus}>
              <View
                style={[
                  styles.networkDot,
                  {
                    backgroundColor: isOnline
                      ? palette.income
                      : palette.warning,
                  },
                ]}
              />
              <Text style={styles.networkText}>
                {isOnline ? "LIVE" : "LOCAL"}
              </Text>
            </View>
          </View>

          <View style={styles.hero}>
            <View style={styles.heroRail} />
            <View style={styles.heroTopline}>
              <Text style={styles.heroLabel}>NET POSITION / {monthLabel}</Text>
              <Text style={styles.heroCode}>{currency.code}</Text>
            </View>
            <Text
              accessibilityLabel={`Net position ${formatMoney(summary.remaining, currency)}`}
              adjustsFontSizeToFit
              numberOfLines={1}
              style={styles.balance}>
              {formatMoney(summary.remaining, currency)}
            </Text>
            <Text style={styles.balanceCaption}>
              Income minus outflow for the current month
            </Text>

            <View style={styles.metricsRow}>
              <Metric
                amount={formatMoney(summary.totalRevenue, currency)}
                label="INCOME"
                tone="income"
              />
              <View style={styles.metricDivider} />
              <Metric
                amount={formatMoney(summary.totalExpenditure, currency)}
                label="OUTFLOW"
                tone="expense"
              />
            </View>
          </View>

          <View style={styles.syncLine}>
            <MaterialCommunityIcons
              color={
                conflictCount > 0
                  ? palette.expense
                  : pendingCount > 0
                    ? palette.warning
                    : palette.textQuiet
              }
              name={
                conflictCount > 0
                  ? "alert-octagon-outline"
                  : failedCount > 0
                    ? "cloud-alert-outline"
                    : pendingCount > 0
                      ? "cloud-sync-outline"
                      : "check-circle-outline"
              }
              size={16}
            />
            <Text style={styles.syncText}>
              {conflictCount > 0
                ? `${conflictCount} ${conflictCount === 1 ? "entry needs" : "entries need"} review`
                : failedCount > 0
                  ? `${failedCount} ${failedCount === 1 ? "entry" : "entries"} could not sync`
                  : pendingCount > 0
                    ? `${pendingCount} ${pendingCount === 1 ? "entry" : "entries"} waiting to sync`
                    : "Ledger is current"}
            </Text>
            <View style={styles.syncRule} />
          </View>

          <SectionHeading
            action="Open ledger"
            label="Recent movement"
            onAction={viewTransactions}
          />

          <View style={styles.ledger}>
            {transactionsLoading ? (
              <View style={styles.stateRow}>
                <ActivityIndicator color={palette.textMuted} size="small" />
                <Text style={styles.stateText}>Reading your ledger…</Text>
              </View>
            ) : transactionsFailed ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void refetchTransactions()}
                style={({ pressed }) => [
                  styles.stateRow,
                  { opacity: pressed ? 0.62 : 1 },
                ]}>
                <MaterialCommunityIcons
                  color={palette.warning}
                  name="refresh"
                  size={18}
                />
                <Text style={styles.stateText}>Could not read entries. Tap to retry.</Text>
              </Pressable>
            ) : recentTransactions.length === 0 ? (
              <View style={styles.emptyLedger}>
                <Text style={styles.emptyTitle}>Your ledger opens here.</Text>
                <Text style={styles.emptyBody}>
                  Record the first income or outflow below. Offline entries are
                  safe on this device until they can sync.
                </Text>
              </View>
            ) : (
              recentTransactions.map((transaction, index) => {
                const category = ALL_CATEGORIES[transaction.category_id];
                const isIncome = transaction.type === "Revenue";
                const syncLabel = {
                  conflict: "CONFLICT",
                  failed: "FAILED",
                  local_only: "LOCAL",
                  queued: "QUEUED",
                  synced: "",
                  syncing: "SYNCING",
                }[transaction.sync_state];
                const dateLabel = new Date(
                  `${transaction.transaction_date}T00:00:00`,
                ).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                });

                return (
                  <Pressable
                    accessibilityHint="Opens the ledger"
                    accessibilityLabel={`${transaction.note || category?.label || "Transaction"}, ${formatMoney(transaction.amount, currency)}`}
                    accessibilityRole="button"
                    key={transaction.id}
                    onPress={viewTransactions}
                    style={({ pressed }) => [
                      styles.ledgerRow,
                      index === recentTransactions.length - 1
                        ? styles.ledgerRowLast
                        : null,
                      { opacity: pressed ? 0.62 : 1 },
                    ]}>
                    <View
                      style={[
                        styles.transactionSignal,
                        {
                          backgroundColor: isIncome
                            ? palette.income
                            : palette.expense,
                        },
                      ]}
                    />
                    <View style={styles.transactionIcon}>
                      <MaterialCommunityIcons
                        color={palette.textMuted}
                        name={(category?.icon ?? "circle-outline") as never}
                        size={18}
                      />
                    </View>
                    <View style={styles.transactionCopy}>
                      <Text numberOfLines={1} style={styles.transactionName}>
                        {transaction.note || category?.label || "Unlabelled entry"}
                      </Text>
                      <Text style={styles.transactionMeta}>
                        {category?.label ?? "Other"} · {dateLabel}
                        {syncLabel ? ` · ${syncLabel}` : ""}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.transactionAmount,
                        {
                          color: isIncome ? palette.income : palette.text,
                        },
                      ]}>
                      {isIncome ? "+" : "−"}
                      {formatMoney(transaction.amount, currency)}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>

          <View style={styles.captureSection}>
            <SectionHeading label="Record movement" />
            <View style={styles.composer}>
              <View style={styles.composerThreads}>
                <View style={[styles.composerThread, styles.threadAmber]} />
                <View style={[styles.composerThread, styles.threadViolet]} />
                <View style={[styles.composerThread, styles.threadCyan]} />
              </View>

              <View style={styles.typeSwitch}>
                {TYPE_OPTIONS.map((option) => {
                  const selected = type === option.value;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={option.value}
                      onPress={() => switchType(option.value)}
                      style={({ pressed }) => [
                        styles.typeOption,
                        selected ? styles.typeOptionActive : null,
                        { opacity: pressed ? 0.62 : 1 },
                      ]}>
                      <Text
                        style={[
                          styles.typeLabel,
                          selected ? styles.typeLabelActive : null,
                        ]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                accessibilityHint="Opens the number pad"
                accessibilityLabel={`Amount, ${amount || "not entered"}`}
                accessibilityRole="button"
                onPress={() => openDrawer("amount")}
                style={({ pressed }) => [
                  styles.amountField,
                  { opacity: pressed ? 0.64 : 1 },
                ]}>
                <Text style={styles.amountCurrency}>{currency.symbol}</Text>
                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={[
                    styles.amountInput,
                    !amount ? styles.amountPlaceholder : null,
                  ]}>
                  {amount || "0"}
                </Text>
                <MaterialCommunityIcons
                  color={palette.textQuiet}
                  name="dialpad"
                  size={19}
                />
              </Pressable>

              <View style={styles.detailsLedger}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openDrawer("date")}
                  style={({ pressed }) => [
                    styles.detailRow,
                    { opacity: pressed ? 0.64 : 1 },
                  ]}>
                  <Text style={styles.detailLabel}>DATE</Text>
                  <Text style={styles.detailValue}>
                    {date.toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </Text>
                  <MaterialCommunityIcons
                    color={palette.textQuiet}
                    name="chevron-right"
                    size={18}
                  />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => openDrawer("note")}
                  style={({ pressed }) => [
                    styles.detailRow,
                    { opacity: pressed ? 0.64 : 1 },
                  ]}>
                  <Text style={styles.detailLabel}>NOTE</Text>
                  <Text numberOfLines={1} style={styles.detailValue}>
                    {note || "Add context"}
                  </Text>
                  <MaterialCommunityIcons
                    color={palette.textQuiet}
                    name="chevron-right"
                    size={18}
                  />
                </Pressable>
              </View>

              <View style={styles.categoryHeader}>
                <Text style={styles.detailLabel}>CATEGORY</Text>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => openDrawer("category")}>
                  <Text style={styles.editLabel}>Edit</Text>
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={styles.categoryList}
                horizontal
                showsHorizontalScrollIndicator={false}>
                {activeCategories.map((category) => {
                  const selected = category.id === categoryId;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={category.id}
                      onPress={() => {
                        setCategoryId(category.id);
                        void Haptics.selectionAsync();
                      }}
                      style={({ pressed }) => [
                        styles.categoryChip,
                        selected ? styles.categoryChipActive : null,
                        { opacity: pressed ? 0.64 : 1 },
                      ]}>
                      <View
                        style={[
                          styles.categorySignal,
                          { backgroundColor: category.color },
                        ]}
                      />
                      <MaterialCommunityIcons
                        color={selected ? palette.text : palette.textQuiet}
                        name={category.icon as never}
                        size={17}
                      />
                      <Text
                        style={[
                          styles.categoryLabel,
                          selected ? styles.categoryLabelActive : null,
                        ]}>
                        {category.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={() => void handleSave()}
                style={({ pressed }) => [
                  styles.saveButton,
                  isSubmitting ? styles.saveButtonDisabled : null,
                  { opacity: pressed ? 0.76 : 1 },
                ]}>
                {isSubmitting ? (
                  <ActivityIndicator color={palette.canvas} size="small" />
                ) : (
                  <>
                    <Text style={styles.saveButtonText}>
                      Record {type === "Revenue" ? "income" : "outflow"}
                    </Text>
                    <MaterialCommunityIcons
                      color={palette.canvas}
                      name="arrow-top-right"
                      size={19}
                    />
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        animationType="fade"
        onRequestClose={closeDrawer}
        transparent
        visible={activeDrawer === "date"}>
        <View style={styles.centeredModal}>
          <Pressable
            accessibilityLabel="Close calendar"
            accessibilityRole="button"
            onPress={closeDrawer}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.calendarShell}>
            <CustomCalendar
              onClose={closeDrawer}
              onSelectDate={setDate}
              selectedDate={date}
            />
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeDrawer}
        statusBarTranslucent
        transparent
        visible={activeDrawer === "amount"}>
        <View style={styles.bottomModal}>
          <Pressable
            accessibilityLabel="Close number pad"
            accessibilityRole="button"
            onPress={closeDrawer}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.numberPadShell,
              { paddingBottom: Math.max(insets.bottom, 20) },
            ]}>
            <UnifiedNumpad
              mode="amount"
              onChange={(value) => {
                const raw = value.replace(/[^0-9.]/g, "");
                if (raw === "" || raw === ".") {
                  setAmount(raw);
                  return;
                }
                const parts = raw.split(".");
                const integer = Number.parseInt(
                  parts[0] || "0",
                  10,
                ).toLocaleString("en-US");
                setAmount(
                  parts.length > 1 ? `${integer}.${parts[1]}` : integer,
                );
              }}
              onDone={closeDrawer}
              value={amount}
            />
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={closeDrawer}
        statusBarTranslucent
        transparent
        visible={activeDrawer === "note"}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.bottomModal}>
          <Pressable
            accessibilityLabel="Close note editor"
            accessibilityRole="button"
            onPress={closeDrawer}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.noteSheet,
              { paddingBottom: Math.max(insets.bottom, 24) },
            ]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetEyebrow}>LEDGER CONTEXT</Text>
                <Text style={styles.sheetTitle}>Add a note</Text>
              </View>
              <Pressable
                accessibilityLabel="Close"
                accessibilityRole="button"
                hitSlop={8}
                onPress={closeDrawer}>
                <MaterialCommunityIcons
                  color={palette.textMuted}
                  name="close"
                  size={22}
                />
              </Pressable>
            </View>
            <TextInput
              autoFocus
              multiline
              onChangeText={setNote}
              placeholder="What should future you remember about this entry?"
              placeholderTextColor={palette.textQuiet}
              selectionColor={palette.text}
              style={styles.noteInput}
              textAlignVertical="top"
              value={note}
            />
            <Pressable
              accessibilityRole="button"
              onPress={closeDrawer}
              style={({ pressed }) => [
                styles.sheetConfirm,
                { opacity: pressed ? 0.74 : 1 },
              ]}>
              <Text style={styles.sheetConfirmText}>Keep note</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <SaveFeedback
        message={feedback.message}
        onDone={() =>
          setFeedback((current) => ({ ...current, visible: false }))
        }
        onPrimaryAction={
          feedback.type === "success" ? viewTransactions : undefined
        }
        primaryActionLabel={
          feedback.type === "success" ? "Open ledger" : undefined
        }
        title={feedback.title}
        type={feedback.type}
        visible={feedback.visible}
      />

      <CategoryEditor
        categories={activeCategories}
        onClose={closeDrawer}
        onSave={(updated) => {
          setActiveCategories(updated);
          setCategoryId((current) =>
            updated.some((category) => category.id === current)
              ? current
              : (updated[0]?.id ?? ""),
          );
        }}
        visible={activeDrawer === "category"}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrollContent: {
    paddingBottom: 150,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingBottom: 22,
    paddingTop: 10,
  },
  brandMark: {
    alignItems: "center",
    borderColor: palette.lineStrong,
    borderCurve: "continuous",
    borderRadius: 14,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  headerCopy: { flex: 1, gap: 3 },
  eyebrow: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  greeting: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 18,
  },
  networkStatus: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  networkDot: { borderRadius: 3, height: 5, width: 5 },
  networkText: {
    color: palette.textMuted,
    fontFamily: fonts.ledger,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  hero: {
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    minHeight: 274,
    overflow: "hidden",
    paddingBottom: 28,
    paddingLeft: 22,
    paddingTop: 22,
    position: "relative",
  },
  heroRail: {
    backgroundColor: palette.text,
    bottom: 28,
    left: 0,
    opacity: 0.82,
    position: "absolute",
    top: 22,
    width: 2,
  },
  heroTopline: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heroLabel: {
    color: palette.textMuted,
    fontFamily: fonts.ledger,
    fontSize: 10,
    letterSpacing: 1.15,
  },
  heroCode: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 10,
    letterSpacing: 1.15,
  },
  balance: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 44,
    letterSpacing: -1.6,
    marginTop: 30,
  },
  balanceCaption: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 7,
  },
  metricsRow: {
    alignItems: "stretch",
    flexDirection: "row",
    marginTop: 35,
  },
  metric: { flex: 1, gap: 5, paddingRight: 16, position: "relative" },
  metricSignal: {
    height: 1,
    left: 0,
    position: "absolute",
    top: -10,
    width: 42,
  },
  metricLabel: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 9,
    letterSpacing: 1,
  },
  metricValue: {
    color: palette.text,
    fontFamily: fonts.ledger,
    fontSize: 13,
  },
  metricDivider: {
    backgroundColor: palette.line,
    marginRight: 18,
    width: 1,
  },
  syncLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingVertical: 17,
  },
  syncText: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  syncRule: { backgroundColor: palette.line, flex: 1, height: 1 },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 13,
    marginTop: 18,
  },
  sectionTitleRow: { alignItems: "center", flexDirection: "row", gap: 9 },
  sectionIndex: {
    backgroundColor: palette.signalViolet,
    height: 4,
    transform: [{ rotate: "45deg" }],
    width: 4,
  },
  sectionTitle: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 20,
  },
  sectionAction: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "600",
  },
  ledger: {
    borderColor: palette.line,
    borderCurve: "continuous",
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  ledgerRow: {
    alignItems: "center",
    backgroundColor: withAlpha(palette.surface, 0.88),
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 72,
    paddingHorizontal: 14,
    position: "relative",
  },
  ledgerRowLast: { borderBottomWidth: 0 },
  transactionSignal: { height: 28, marginRight: 11, width: 1 },
  transactionIcon: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 12,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    marginRight: 11,
    width: 36,
  },
  transactionCopy: { flex: 1, gap: 4, marginRight: 8 },
  transactionName: {
    color: palette.text,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "600",
  },
  transactionMeta: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 0.35,
  },
  transactionAmount: {
    fontFamily: fonts.ledger,
    fontSize: 11,
    textAlign: "right",
  },
  stateRow: {
    alignItems: "center",
    backgroundColor: palette.surface,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 92,
    padding: 18,
  },
  stateText: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  emptyLedger: { backgroundColor: palette.surface, gap: 7, padding: 20 },
  emptyTitle: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 17,
  },
  emptyBody: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
  captureSection: { marginTop: 18 },
  composer: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderCurve: "continuous",
    borderRadius: 26,
    borderWidth: 1,
    overflow: "hidden",
    padding: 16,
    position: "relative",
  },
  composerThreads: {
    height: 5,
    left: 18,
    overflow: "hidden",
    position: "absolute",
    right: 18,
    top: 0,
  },
  composerThread: { height: 1, position: "absolute", width: "58%" },
  threadAmber: { backgroundColor: palette.signalAmber, left: 0, top: 0 },
  threadViolet: {
    backgroundColor: palette.signalViolet,
    left: "34%",
    top: 2,
  },
  threadCyan: { backgroundColor: palette.signalCyan, right: 0, top: 4 },
  typeSwitch: {
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
  },
  typeOption: {
    alignItems: "center",
    borderBottomColor: "transparent",
    borderBottomWidth: 1,
    flex: 1,
    paddingVertical: 14,
  },
  typeOptionActive: { borderBottomColor: palette.text },
  typeLabel: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "700",
  },
  typeLabelActive: { color: palette.text },
  amountField: {
    alignItems: "center",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 94,
    paddingHorizontal: 4,
  },
  amountCurrency: {
    color: palette.textMuted,
    fontFamily: fonts.display,
    fontSize: 24,
  },
  amountInput: {
    color: palette.text,
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 39,
    letterSpacing: -1,
  },
  amountPlaceholder: { color: palette.textQuiet },
  detailsLedger: { borderBottomColor: palette.line, borderBottomWidth: 1 },
  detailRow: {
    alignItems: "center",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 4,
  },
  detailLabel: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 9,
    letterSpacing: 1,
    width: 76,
  },
  detailValue: {
    color: palette.textMuted,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: "right",
  },
  categoryHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingTop: 16,
  },
  editLabel: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "600",
  },
  categoryList: { gap: 8, paddingBottom: 18, paddingTop: 12 },
  categoryChip: {
    alignItems: "center",
    borderColor: palette.line,
    borderCurve: "continuous",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    minHeight: 40,
    overflow: "hidden",
    paddingHorizontal: 11,
    position: "relative",
  },
  categoryChipActive: {
    backgroundColor: palette.surfaceRaised,
    borderColor: palette.textMuted,
  },
  categorySignal: { bottom: 0, left: 0, position: "absolute", top: 0, width: 2 },
  categoryLabel: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "600",
  },
  categoryLabelActive: { color: palette.text },
  saveButton: {
    alignItems: "center",
    backgroundColor: palette.text,
    borderCurve: "continuous",
    borderRadius: 16,
    flexDirection: "row",
    gap: 9,
    height: 54,
    justifyContent: "center",
  },
  saveButtonDisabled: { opacity: 0.52 },
  saveButtonText: {
    color: palette.canvas,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "800",
  },
  centeredModal: {
    backgroundColor: withAlpha(palette.black, 0.78),
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  calendarShell: { zIndex: 1 },
  bottomModal: {
    backgroundColor: withAlpha(palette.black, 0.68),
    flex: 1,
    justifyContent: "flex-end",
  },
  numberPadShell: {
    backgroundColor: palette.surfaceRaised,
    borderTopColor: palette.lineStrong,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    overflow: "hidden",
  },
  noteSheet: {
    backgroundColor: palette.surface,
    borderTopColor: palette.lineStrong,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    gap: 18,
    paddingHorizontal: 20,
    paddingTop: 11,
    zIndex: 1,
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: palette.lineStrong,
    borderRadius: 3,
    height: 4,
    width: 38,
  },
  sheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sheetEyebrow: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 1,
  },
  sheetTitle: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 23,
    marginTop: 3,
  },
  noteInput: {
    backgroundColor: palette.canvasRaised,
    borderColor: palette.line,
    borderCurve: "continuous",
    borderRadius: 16,
    borderWidth: 1,
    color: palette.text,
    fontFamily: fonts.body,
    fontSize: 14,
    minHeight: 132,
    padding: 15,
  },
  sheetConfirm: {
    alignItems: "center",
    backgroundColor: palette.text,
    borderRadius: 15,
    height: 52,
    justifyContent: "center",
  },
  sheetConfirmText: {
    color: palette.canvas,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "800",
  },
});
