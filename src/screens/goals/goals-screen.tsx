import { ActionButton } from "@/components/finance/action-button";
import { FinanceField } from "@/components/finance/finance-field";
import { FinanceSheet } from "@/components/finance/finance-sheet";
import { PageHeading } from "@/components/finance/page-heading";
import { SegmentedControl } from "@/components/finance/segmented-control";
import { StatePanel } from "@/components/finance/state-panel";
import { SummaryRail } from "@/components/finance/summary-rail";
import { CustomCalendar } from "@/components/ui/custom-calendar";
import { SaveFeedback } from "@/components/ui/save-feedback";
import { Screen } from "@/components/ui/screen";
import { SignalThreads } from "@/components/visuals/signal-threads";
import { useAuth } from "@/hooks/use-auth";
import {
  useCreateGoal,
  useDeleteGoal,
  useGoals,
  useUpdateGoal,
} from "@/hooks/use-goals";
import { isMissingGoalsTableError } from "@/services/supabase/goal-service";
import { CURRENCY_OPTIONS, useAppStore } from "@/store/use-app-store";
import { palette, withAlpha } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import type { Goal, GoalStatus, GoalType } from "@/types/domain/goal";
import { fromLocalDateString, toLocalDateString } from "@/utils/date";
import { formatMoney, type DisplayCurrency } from "@/utils/money";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type GoalFilter = "all" | "active" | "completed";

type GoalFormState = {
  title: string;
  goalType: GoalType;
  targetAmount: string;
  savedAmount: string;
  targetDate: Date;
  hasTargetDate: boolean;
  notes: string;
  iconName: string;
  color: string;
};

type FeedbackState = {
  visible: boolean;
  type: "success" | "error";
  title?: string;
  message: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
};

const EMPTY_GOALS: Goal[] = [];

const FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Complete", value: "completed" },
] satisfies { label: string; value: GoalFilter }[];

const TYPE_OPTIONS = [
  { label: "Savings", value: "saving" },
  { label: "Purchase", value: "item" },
] satisfies { label: string; value: GoalType }[];

const GOAL_ICON_OPTIONS = [
  "target",
  "shield-outline",
  "wallet-outline",
  "laptop",
  "airplane",
  "home-outline",
  "car-sports",
  "gift-outline",
  "briefcase-outline",
  "sofa-outline",
] as const;

const GOAL_COLOR_OPTIONS = [
  palette.signalMoss,
  palette.signalViolet,
  palette.signalCyan,
  palette.signalAmber,
  palette.income,
  palette.expense,
] as const;

const QUICK_CONTRIBUTIONS = [25, 50, 100, 250, 500] as const;

function defaultGoalForm(): GoalFormState {
  return {
    title: "",
    goalType: "saving",
    targetAmount: "",
    savedAmount: "",
    targetDate: new Date(),
    hasTargetDate: false,
    notes: "",
    iconName: GOAL_ICON_OPTIONS[0],
    color: GOAL_COLOR_OPTIONS[0],
  };
}

function goalFormFromGoal(goal: Goal): GoalFormState {
  return {
    title: goal.title,
    goalType: goal.goal_type,
    targetAmount: String(goal.target_amount),
    savedAmount: goal.saved_amount ? String(goal.saved_amount) : "",
    targetDate: goal.target_date
      ? fromLocalDateString(goal.target_date)
      : new Date(),
    hasTargetDate: goal.target_date != null,
    notes: goal.notes ?? "",
    iconName: goal.icon_name,
    color: goal.color,
  };
}

function parseCurrencyInput(value: string) {
  const normalized = value.replace(/[^0-9.]/g, "");
  if (!normalized) return 0;
  return Number.parseFloat(normalized) || 0;
}

function currencyFor(code: string): DisplayCurrency {
  return (
    CURRENCY_OPTIONS.find((option) => option.code === code) ?? {
      code,
      symbol: `${code} `,
    }
  );
}

function formatGoalAmount(amount: number, currencyCode: string) {
  return formatMoney(amount, currencyFor(currencyCode));
}

function getGoalProgress(goal: Goal) {
  if (goal.target_amount <= 0) return 0;
  return Math.max(0, Math.min(goal.saved_amount / goal.target_amount, 1));
}

function formatGoalDate(date: string | null) {
  if (!date) return "No target date";
  return fromLocalDateString(date).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function compactGoalDate(date: string | null) {
  if (!date) return "NONE";
  return fromLocalDateString(date)
    .toLocaleDateString("en-US", { day: "2-digit", month: "short" })
    .toLocaleUpperCase();
}

function GoalLedgerRow({
  goal,
  onAddFunds,
  onDelete,
  onEdit,
  onToggleStatus,
}: {
  goal: Goal;
  onAddFunds: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
}) {
  const progress = getGoalProgress(goal);
  const remaining = Math.max(goal.target_amount - goal.saved_amount, 0);
  const isComplete = goal.status === "completed";
  const isOverdue =
    !isComplete &&
    goal.target_date != null &&
    goal.target_date < toLocalDateString(new Date());
  const statusLabel = isComplete ? "COMPLETE" : isOverdue ? "OVERDUE" : "ACTIVE";
  const statusColor = isComplete
    ? palette.income
    : isOverdue
      ? palette.expense
      : palette.textQuiet;

  return (
    <View style={styles.goalRow}>
      <View style={[styles.goalSignal, { backgroundColor: goal.color }]} />
      <View style={styles.goalTopline}>
        <View style={styles.goalIcon}>
          <MaterialCommunityIcons
            color={palette.textMuted}
            name={goal.icon_name as never}
            size={19}
          />
        </View>
        <View style={styles.goalTitleGroup}>
          <Text numberOfLines={1} style={styles.goalTitle}>
            {goal.title}
          </Text>
          <Text style={[styles.goalStatus, { color: statusColor }]}>
            {statusLabel} / {goal.goal_type === "saving" ? "SAVINGS" : "PURCHASE"}
          </Text>
        </View>
        <View style={styles.goalDateGroup}>
          <Text style={styles.goalDateLabel}>TARGET</Text>
          <Text style={styles.goalDate}>{compactGoalDate(goal.target_date)}</Text>
        </View>
      </View>

      {goal.notes ? (
        <Text numberOfLines={2} style={styles.goalNotes}>
          {goal.notes}
        </Text>
      ) : null}

      <View style={styles.goalAmounts}>
        <View>
          <Text style={styles.amountLabel}>RESERVED</Text>
          <Text style={styles.amountValue}>
            {formatGoalAmount(goal.saved_amount, goal.currency_code)}
          </Text>
        </View>
        <View style={styles.goalAmountRight}>
          <Text style={styles.amountLabel}>TARGET</Text>
          <Text style={styles.amountValue}>
            {formatGoalAmount(goal.target_amount, goal.currency_code)}
          </Text>
        </View>
      </View>

      <View
        accessibilityLabel={`${Math.round(progress * 100)} percent funded`}
        accessibilityRole="progressbar"
        accessibilityValue={{ max: 100, min: 0, now: Math.round(progress * 100) }}
        style={styles.progressTrack}>
        <View
          style={[
            styles.progressValue,
            {
              backgroundColor: goal.color,
              width: `${Math.max(progress * 100, goal.saved_amount > 0 ? 1 : 0)}%`,
            },
          ]}
        />
      </View>
      <View style={styles.progressMeta}>
        <Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text>
        <Text style={styles.progressRemaining}>
          {remaining > 0
            ? `${formatGoalAmount(remaining, goal.currency_code)} remaining`
            : "Target funded"}
        </Text>
      </View>

      <View style={styles.goalActions}>
        {!isComplete ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAddFunds}
            style={({ pressed }) => [
              styles.goalPrimaryAction,
              { opacity: pressed ? 0.62 : 1 },
            ]}>
            <MaterialCommunityIcons color={palette.black} name="plus" size={15} />
            <Text style={styles.goalPrimaryActionText}>Add funds</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={onEdit}
          style={({ pressed }) => [
            styles.goalTextAction,
            { opacity: pressed ? 0.56 : 1 },
          ]}>
          <Text style={styles.goalTextActionLabel}>Edit</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onToggleStatus}
          style={({ pressed }) => [
            styles.goalTextAction,
            { opacity: pressed ? 0.56 : 1 },
          ]}>
          <Text style={styles.goalTextActionLabel}>
            {isComplete ? "Reopen" : "Complete"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`Delete ${goal.title}`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onDelete}
          style={({ pressed }) => [
            styles.goalDeleteAction,
            { opacity: pressed ? 0.5 : 1 },
          ]}>
          <MaterialCommunityIcons
            color={palette.textQuiet}
            name="trash-can-outline"
            size={16}
          />
        </Pressable>
      </View>
    </View>
  );
}

export function GoalsScreen() {
  const { user } = useAuth();
  const currency = useAppStore((state) => state.currency);
  const goalsQuery = useGoals();
  const goals = goalsQuery.data ?? EMPTY_GOALS;
  const createGoalMutation = useCreateGoal();
  const updateGoalMutation = useUpdateGoal();
  const deleteGoalMutation = useDeleteGoal();

  const [filter, setFilter] = useState<GoalFilter>("all");
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);
  const [contributeSheetOpen, setContributeSheetOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [form, setForm] = useState<GoalFormState>(() => defaultGoalForm());
  const [formError, setFormError] = useState("");
  const [contributionAmount, setContributionAmount] = useState("");
  const [contributionError, setContributionError] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>({
    visible: false,
    type: "success",
    message: "",
  });

  const filteredGoals = useMemo(
    () =>
      filter === "all"
        ? goals
        : goals.filter((goal) => goal.status === filter),
    [filter, goals],
  );
  const activeGoals = useMemo(
    () => goals.filter((goal) => goal.status === "active"),
    [goals],
  );
  const completedGoals = goals.length - activeGoals.length;
  const selectedCurrencySaved = useMemo(
    () =>
      goals
        .filter((goal) => goal.currency_code === currency.code)
        .reduce((sum, goal) => sum + goal.saved_amount, 0),
    [currency.code, goals],
  );
  const nearestGoal = useMemo(
    () =>
      [...activeGoals]
        .filter((goal) => goal.target_date != null)
        .sort((first, second) =>
          (first.target_date ?? "").localeCompare(second.target_date ?? ""),
        )[0],
    [activeGoals],
  );

  const goalSheetBusy =
    createGoalMutation.isPending || updateGoalMutation.isPending;
  const contributionBusy = updateGoalMutation.isPending;

  const dismissFeedback = () => {
    setFeedback((current) => ({
      ...current,
      visible: false,
      primaryActionLabel: undefined,
      onPrimaryAction: undefined,
    }));
  };

  const openCreateGoal = () => {
    setEditingGoal(null);
    setForm(defaultGoalForm());
    setFormError("");
    setGoalSheetOpen(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const openEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setForm(goalFormFromGoal(goal));
    setFormError("");
    setGoalSheetOpen(true);
  };

  const closeGoalSheet = () => {
    setGoalSheetOpen(false);
    setCalendarOpen(false);
    setEditingGoal(null);
    setForm(defaultGoalForm());
    setFormError("");
  };

  const openContribution = (goal: Goal) => {
    setSelectedGoal(goal);
    setContributionAmount("");
    setContributionError("");
    setContributeSheetOpen(true);
  };

  const closeContributionSheet = () => {
    setContributeSheetOpen(false);
    setSelectedGoal(null);
    setContributionAmount("");
    setContributionError("");
  };

  const showErrorFeedback = (title: string, message: string) => {
    setFeedback({ visible: true, type: "error", title, message });
  };

  const handleSaveGoal = async () => {
    if (!user?.uid) {
      showErrorFeedback("Sign in required", "Sign in to create and manage goals.");
      return;
    }

    const title = form.title.trim();
    const targetAmount = parseCurrencyInput(form.targetAmount);
    const savedAmount = parseCurrencyInput(form.savedAmount);

    if (!title) {
      setFormError("Give this goal a name so it is easy to recognize.");
      return;
    }
    if (!targetAmount || targetAmount <= 0) {
      setFormError("Set a valid target amount greater than zero.");
      return;
    }
    if (savedAmount < 0) {
      setFormError("Saved amount cannot be negative.");
      return;
    }

    const nextStatus: GoalStatus =
      savedAmount >= targetAmount ? "completed" : "active";
    const payload = {
      title,
      goal_type: form.goalType,
      target_amount: targetAmount,
      saved_amount: savedAmount,
      currency_code: editingGoal?.currency_code ?? currency.code,
      target_date: form.hasTargetDate
        ? toLocalDateString(form.targetDate)
        : null,
      notes: form.notes.trim() || null,
      icon_name: form.iconName,
      color: form.color,
      status: nextStatus,
      completed_at:
        nextStatus === "completed"
          ? editingGoal?.completed_at ?? new Date().toISOString()
          : null,
    };

    try {
      setFormError("");
      const wasEditing = editingGoal != null;
      const savedGoal = editingGoal
        ? await updateGoalMutation.mutateAsync({
            id: editingGoal.id,
            payload,
          })
        : await createGoalMutation.mutateAsync({
            user_id: user.uid,
            ...payload,
          });

      closeGoalSheet();
      setFeedback({
        visible: true,
        type: "success",
        title: wasEditing ? "Goal updated" : "Goal created",
        message: wasEditing
          ? "Your plan now reflects the new details."
          : "Your new plan is ready for contributions.",
        primaryActionLabel:
          !wasEditing && savedGoal.status === "active"
            ? "Add first funds"
            : undefined,
        onPrimaryAction:
          !wasEditing && savedGoal.status === "active"
            ? () => {
                dismissFeedback();
                openContribution(savedGoal);
              }
            : undefined,
      });
    } catch (saveError) {
      setFormError(
        saveError instanceof Error
          ? saveError.message
          : "We could not save this goal right now.",
      );
    }
  };

  const handleContribution = async () => {
    if (!selectedGoal) return;
    const amount = parseCurrencyInput(contributionAmount);
    if (!amount || amount <= 0) {
      setContributionError("Enter an amount greater than zero.");
      return;
    }

    const updatedSavedAmount = selectedGoal.saved_amount + amount;
    const nextStatus: GoalStatus =
      updatedSavedAmount >= selectedGoal.target_amount
        ? "completed"
        : "active";

    try {
      setContributionError("");
      await updateGoalMutation.mutateAsync({
        id: selectedGoal.id,
        payload: {
          saved_amount: updatedSavedAmount,
          status: nextStatus,
          completed_at:
            nextStatus === "completed"
              ? selectedGoal.completed_at ?? new Date().toISOString()
              : null,
        },
      });
      closeContributionSheet();
      setFeedback({
        visible: true,
        type: "success",
        title: nextStatus === "completed" ? "Goal funded" : "Funds added",
        message:
          nextStatus === "completed"
            ? `${selectedGoal.title} has reached its target.`
            : `${formatGoalAmount(amount, selectedGoal.currency_code)} added to ${selectedGoal.title}.`,
      });
    } catch (saveError) {
      setContributionError(
        saveError instanceof Error
          ? saveError.message
          : "We could not update this goal right now.",
      );
    }
  };

  const handleToggleStatus = async (goal: Goal) => {
    const nextStatus: GoalStatus =
      goal.status === "completed" ? "active" : "completed";
    try {
      await updateGoalMutation.mutateAsync({
        id: goal.id,
        payload: {
          status: nextStatus,
          completed_at:
            nextStatus === "completed" ? new Date().toISOString() : null,
        },
      });
      setFeedback({
        visible: true,
        type: "success",
        title: nextStatus === "completed" ? "Goal completed" : "Goal reopened",
        message:
          nextStatus === "completed"
            ? `${goal.title} is now marked complete.`
            : `${goal.title} is active again.`,
      });
    } catch (saveError) {
      showErrorFeedback(
        "Update failed",
        saveError instanceof Error
          ? saveError.message
          : "We could not update this goal right now.",
      );
    }
  };

  const handleDeleteGoal = (goal: Goal) => {
    Alert.alert(
      "Delete goal?",
      `This will remove ${goal.title} and its current progress.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteGoalMutation.mutateAsync(goal.id);
              setFeedback({
                visible: true,
                type: "success",
                title: "Goal deleted",
                message: `${goal.title} was removed.`,
              });
            } catch (deleteError) {
              showErrorFeedback(
                "Delete failed",
                deleteError instanceof Error
                  ? deleteError.message
                  : "We could not delete this goal right now.",
              );
            }
          },
        },
      ],
    );
  };

  const missingGoalsTable = isMissingGoalsTableError(goalsQuery.error);

  return (
    <Screen backgroundColor={palette.canvas} className="px-0">
      <SignalThreads intensity="quiet" />
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            colors={[palette.textMuted]}
            onRefresh={() => void goalsQuery.refetch()}
            refreshing={goalsQuery.isRefetching}
            tintColor={palette.textMuted}
          />
        }
        showsVerticalScrollIndicator={false}>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <PageHeading
              description="Give future money a deliberate destination, then move each plan forward without noise."
              eyebrow="PLAN / PERSONAL"
              title="Goals"
            />
          </View>
          <Pressable
            accessibilityLabel="Create goal"
            accessibilityRole="button"
            onPress={openCreateGoal}
            style={({ pressed }) => [
              styles.addButton,
              { opacity: pressed ? 0.62 : 1 },
            ]}>
            <MaterialCommunityIcons color={palette.black} name="plus" size={20} />
          </Pressable>
        </View>

        <View style={styles.reservePanel}>
          <View style={styles.reserveThread} />
          <Text style={styles.reserveLabel}>RESERVED CAPITAL / {currency.code}</Text>
          <Text
            accessibilityLabel={`Reserved in ${currency.code}, ${formatMoney(selectedCurrencySaved, currency)}`}
            adjustsFontSizeToFit
            numberOfLines={1}
            style={styles.reserveAmount}>
            {formatMoney(selectedCurrencySaved, currency)}
          </Text>
          <View style={styles.reserveMeta}>
            <Text style={styles.reserveMetaText}>
              Across {goals.filter((goal) => goal.currency_code === currency.code).length} {currency.code} {goals.filter((goal) => goal.currency_code === currency.code).length === 1 ? "plan" : "plans"}
            </Text>
            <View style={styles.reserveMetaRule} />
            <Text style={styles.reserveMetaText}>
              {nearestGoal ? `Next · ${nearestGoal.title}` : "No dated target"}
            </Text>
          </View>
        </View>

        <SummaryRail
          items={[
            { label: "ACTIVE", value: String(activeGoals.length) },
            { label: "COMPLETE", value: String(completedGoals) },
            {
              label: "NEXT DATE",
              value: compactGoalDate(nearestGoal?.target_date ?? null),
            },
          ]}
        />

        <View style={styles.filterWrap}>
          <SegmentedControl
            accessibilityLabel="Goal filter"
            onChange={(value) => {
              setFilter(value);
              void Haptics.selectionAsync();
            }}
            options={FILTER_OPTIONS}
            value={filter}
          />
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>PLAN LEDGER</Text>
          <View style={styles.listHeaderRule} />
          <Text style={styles.listHeaderCount}>
            {filteredGoals.length.toString().padStart(2, "0")}
          </Text>
        </View>

        {goalsQuery.isLoading ? (
          <StatePanel
            description="Reading your active and completed plans."
            loading
            title="Opening plan ledger"
          />
        ) : goalsQuery.isError ? (
          <StatePanel
            actionLabel="Retry"
            description={
              missingGoalsTable
                ? "The Goals database migration is not installed in this environment."
                : "Your saved plans are untouched. Try loading them again."
            }
            onAction={() => void goalsQuery.refetch()}
            title={missingGoalsTable ? "Goals need setup" : "Goals unavailable"}
          />
        ) : goals.length === 0 ? (
          <StatePanel
            actionLabel="Create goal"
            description="Define a target amount and build toward it one contribution at a time."
            onAction={openCreateGoal}
            title="Start the first plan"
          />
        ) : filteredGoals.length === 0 ? (
          <StatePanel
            description="Choose another filter or create a new plan."
            title="No goals in this view"
          />
        ) : (
          <View style={styles.goalLedger}>
            {filteredGoals.map((goal) => (
              <GoalLedgerRow
                goal={goal}
                key={goal.id}
                onAddFunds={() => openContribution(goal)}
                onDelete={() => handleDeleteGoal(goal)}
                onEdit={() => openEditGoal(goal)}
                onToggleStatus={() => void handleToggleStatus(goal)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <FinanceSheet
        description="Amounts keep the goal's original currency when editing."
        onClose={closeGoalSheet}
        title={editingGoal ? "Edit goal" : "Create goal"}
        visible={goalSheetOpen}>
        <View style={styles.formPreview}>
          <View style={[styles.formPreviewThread, { backgroundColor: form.color }]} />
          <View style={styles.formPreviewIcon}>
            <MaterialCommunityIcons
              color={palette.textMuted}
              name={form.iconName as never}
              size={19}
            />
          </View>
          <View style={styles.formPreviewCopy}>
            <Text style={styles.formPreviewTitle}>
              {form.title.trim() || "Untitled plan"}
            </Text>
            <Text style={styles.formPreviewMeta}>
              {form.targetAmount
                ? `TARGET ${formatGoalAmount(
                    parseCurrencyInput(form.targetAmount),
                    editingGoal?.currency_code ?? currency.code,
                  )}`
                : `TARGET / ${editingGoal?.currency_code ?? currency.code}`}
            </Text>
          </View>
        </View>

        <SegmentedControl
          accessibilityLabel="Goal type"
          onChange={(goalType) =>
            setForm((current) => ({
              ...current,
              goalType,
              iconName: goalType === "saving" ? "target" : "laptop",
            }))
          }
          options={TYPE_OPTIONS}
          value={form.goalType}
        />

        <FinanceField
          autoCapitalize="sentences"
          label="Goal title"
          onChangeText={(title) => setForm((current) => ({ ...current, title }))}
          placeholder="Emergency reserve"
          value={form.title}
        />

        <View style={styles.amountFields}>
          <View style={styles.amountField}>
            <FinanceField
              keyboardType="decimal-pad"
              label="Target amount"
              onChangeText={(targetAmount) =>
                setForm((current) => ({ ...current, targetAmount }))
              }
              placeholder="0.00"
              value={form.targetAmount}
            />
          </View>
          <View style={styles.amountField}>
            <FinanceField
              keyboardType="decimal-pad"
              label="Already reserved"
              onChangeText={(savedAmount) =>
                setForm((current) => ({ ...current, savedAmount }))
              }
              placeholder="0.00"
              value={form.savedAmount}
            />
          </View>
        </View>

        <View style={styles.dateControl}>
          <View style={styles.dateCopy}>
            <Text style={styles.controlLabel}>TARGET DATE</Text>
            <Text style={styles.controlValue}>
              {form.hasTargetDate
                ? formatGoalDate(toLocalDateString(form.targetDate))
                : "No deadline"}
            </Text>
          </View>
          {form.hasTargetDate ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setForm((current) => ({ ...current, hasTargetDate: false }))
              }
              style={styles.controlTextButton}>
              <Text style={styles.controlTextButtonLabel}>Remove</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => setCalendarOpen(true)}
            style={styles.controlIconButton}>
            <MaterialCommunityIcons
              color={palette.textMuted}
              name="calendar-blank-outline"
              size={18}
            />
          </Pressable>
        </View>

        <View style={styles.pickerGroup}>
          <Text style={styles.controlLabel}>MARK</Text>
          <View style={styles.iconGrid}>
            {GOAL_ICON_OPTIONS.map((iconName) => {
              const selected = form.iconName === iconName;
              return (
                <Pressable
                  accessibilityLabel={`Goal icon ${iconName}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={iconName}
                  onPress={() =>
                    setForm((current) => ({ ...current, iconName }))
                  }
                  style={[
                    styles.iconOption,
                    selected ? styles.iconOptionSelected : null,
                  ]}>
                  <MaterialCommunityIcons
                    color={selected ? palette.black : palette.textMuted}
                    name={iconName as never}
                    size={19}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.pickerGroup}>
          <Text style={styles.controlLabel}>SIGNAL THREAD</Text>
          <View style={styles.signalOptions}>
            {GOAL_COLOR_OPTIONS.map((color) => {
              const selected = form.color === color;
              return (
                <Pressable
                  accessibilityLabel="Goal signal color"
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={color}
                  onPress={() => setForm((current) => ({ ...current, color }))}
                  style={[
                    styles.signalOption,
                    selected ? styles.signalOptionSelected : null,
                  ]}>
                  <View style={[styles.signalOptionLine, { backgroundColor: color }]} />
                </Pressable>
              );
            })}
          </View>
        </View>

        <FinanceField
          label="Notes"
          multiline
          onChangeText={(notes) => setForm((current) => ({ ...current, notes }))}
          placeholder="What is this plan protecting or enabling?"
          value={form.notes}
        />

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <ActionButton
          label={editingGoal ? "Update goal" : "Create goal"}
          loading={goalSheetBusy}
          onPress={() => void handleSaveGoal()}
        />
      </FinanceSheet>

      <FinanceSheet
        description="The amount is added to the goal's current reserved total."
        onClose={closeContributionSheet}
        title="Add to goal"
        visible={contributeSheetOpen}>
        {selectedGoal ? (
          <>
            <View style={styles.contributionSummary}>
              <View
                style={[
                  styles.contributionThread,
                  { backgroundColor: selectedGoal.color },
                ]}
              />
              <View style={styles.contributionCopy}>
                <Text style={styles.contributionTitle}>{selectedGoal.title}</Text>
                <Text style={styles.contributionMeta}>
                  {formatGoalAmount(
                    selectedGoal.saved_amount,
                    selectedGoal.currency_code,
                  )} {" / "}
                  {formatGoalAmount(
                    selectedGoal.target_amount,
                    selectedGoal.currency_code,
                  )}
                </Text>
              </View>
            </View>

            <View style={styles.pickerGroup}>
              <Text style={styles.controlLabel}>QUICK AMOUNTS</Text>
              <ScrollView
                contentContainerStyle={styles.quickAmounts}
                horizontal
                showsHorizontalScrollIndicator={false}>
                {QUICK_CONTRIBUTIONS.map((amount) => (
                  <Pressable
                    accessibilityRole="button"
                    key={amount}
                    onPress={() => setContributionAmount(String(amount))}
                    style={styles.quickAmount}>
                    <Text style={styles.quickAmountText}>
                      {formatGoalAmount(amount, selectedGoal.currency_code)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <FinanceField
              error={contributionError || undefined}
              keyboardType="decimal-pad"
              label="Contribution"
              onChangeText={setContributionAmount}
              placeholder="0.00"
              value={contributionAmount}
            />
            <ActionButton
              label="Add contribution"
              loading={contributionBusy}
              onPress={() => void handleContribution()}
            />
          </>
        ) : null}
      </FinanceSheet>

      <Modal
        animationType="fade"
        onRequestClose={() => setCalendarOpen(false)}
        statusBarTranslucent
        transparent
        visible={calendarOpen}>
        <Pressable
          onPress={() => setCalendarOpen(false)}
          style={styles.calendarScrim}>
          <Pressable onPress={() => undefined}>
            <CustomCalendar
              onClose={() => setCalendarOpen(false)}
              onSelectDate={(targetDate) =>
                setForm((current) => ({
                  ...current,
                  targetDate,
                  hasTargetDate: true,
                }))
              }
              selectedDate={form.targetDate}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <SaveFeedback
        message={feedback.message}
        onDone={dismissFeedback}
        onPrimaryAction={feedback.onPrimaryAction}
        primaryActionLabel={feedback.primaryActionLabel}
        title={feedback.title}
        type={feedback.type}
        visible={feedback.visible}
      />
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
  headingRow: { alignItems: "center", flexDirection: "row" },
  headingCopy: { flex: 1 },
  addButton: {
    alignItems: "center",
    backgroundColor: palette.text,
    borderRadius: 14,
    height: 46,
    justifyContent: "center",
    marginLeft: 16,
    width: 46,
  },
  reservePanel: {
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    minHeight: 176,
    paddingBottom: 24,
  },
  reserveThread: {
    backgroundColor: palette.signalViolet,
    height: 1,
    marginBottom: 18,
    width: 72,
  },
  reserveLabel: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 0.8,
  },
  reserveAmount: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 42,
    letterSpacing: -1,
    marginTop: 9,
  },
  reserveMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 17,
  },
  reserveMetaText: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 10,
  },
  reserveMetaRule: { backgroundColor: palette.lineStrong, height: 1, width: 18 },
  filterWrap: { marginTop: 12 },
  listHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 72,
  },
  listHeaderText: {
    color: palette.textMuted,
    fontFamily: fonts.ledger,
    fontSize: 9,
    letterSpacing: 0.9,
  },
  listHeaderRule: { backgroundColor: palette.line, flex: 1, height: 1 },
  listHeaderCount: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 9,
  },
  goalLedger: { borderTopColor: palette.line, borderTopWidth: 1 },
  goalRow: {
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    paddingBottom: 22,
    paddingLeft: 14,
    paddingTop: 22,
    position: "relative",
  },
  goalSignal: { bottom: 22, left: 0, position: "absolute", top: 22, width: 1 },
  goalTopline: { alignItems: "center", flexDirection: "row" },
  goalIcon: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 13,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    marginRight: 12,
    width: 40,
  },
  goalTitleGroup: { flex: 1, gap: 5, marginRight: 10 },
  goalTitle: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 20,
  },
  goalStatus: {
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.55,
  },
  goalDateGroup: { alignItems: "flex-end", gap: 5 },
  goalDateLabel: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
  },
  goalDate: {
    color: palette.textMuted,
    fontFamily: fonts.ledger,
    fontSize: 8,
  },
  goalNotes: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 14,
    maxWidth: 420,
  },
  goalAmounts: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  goalAmountRight: { alignItems: "flex-end" },
  amountLabel: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.55,
    marginBottom: 5,
  },
  amountValue: {
    color: palette.text,
    fontFamily: fonts.ledger,
    fontSize: 11,
  },
  progressTrack: {
    backgroundColor: palette.line,
    height: 2,
    marginTop: 15,
    overflow: "hidden",
  },
  progressValue: { height: 2 },
  progressMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  progressPercent: {
    color: palette.textMuted,
    fontFamily: fonts.ledger,
    fontSize: 8,
  },
  progressRemaining: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 9,
  },
  goalActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 15,
    marginTop: 18,
  },
  goalPrimaryAction: {
    alignItems: "center",
    backgroundColor: palette.text,
    borderRadius: 12,
    flexDirection: "row",
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 13,
  },
  goalPrimaryActionText: {
    color: palette.black,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "700",
  },
  goalTextAction: { minHeight: 38, justifyContent: "center" },
  goalTextActionLabel: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "700",
  },
  goalDeleteAction: { marginLeft: "auto", padding: 8 },
  formPreview: {
    alignItems: "center",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingBottom: 18,
    position: "relative",
  },
  formPreviewThread: { bottom: 18, left: 0, position: "absolute", top: 0, width: 1 },
  formPreviewIcon: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 13,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    marginLeft: 14,
    marginRight: 12,
    width: 42,
  },
  formPreviewCopy: { flex: 1, gap: 5 },
  formPreviewTitle: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 19,
  },
  formPreviewMeta: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.4,
  },
  amountFields: { flexDirection: "row", gap: 16 },
  amountField: { flex: 1 },
  dateControl: {
    alignItems: "center",
    borderBottomColor: palette.lineStrong,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 64,
  },
  dateCopy: { flex: 1, gap: 6 },
  controlLabel: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 0.75,
  },
  controlValue: {
    color: palette.text,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  controlTextButton: { padding: 10 },
  controlTextButtonLabel: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "700",
  },
  controlIconButton: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 11,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  pickerGroup: { gap: 11 },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconOption: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  iconOptionSelected: {
    backgroundColor: palette.text,
    borderColor: palette.text,
  },
  signalOptions: { flexDirection: "row", gap: 8 },
  signalOption: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 11,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  signalOptionSelected: { borderColor: palette.textMuted },
  signalOptionLine: { height: 1, width: 22 },
  formError: {
    color: palette.expense,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
  },
  contributionSummary: {
    alignItems: "stretch",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingBottom: 18,
  },
  contributionThread: { marginRight: 14, width: 1 },
  contributionCopy: { flex: 1, gap: 6 },
  contributionTitle: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 21,
  },
  contributionMeta: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 8,
  },
  quickAmounts: { gap: 8 },
  quickAmount: {
    borderColor: palette.line,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  quickAmountText: {
    color: palette.textMuted,
    fontFamily: fonts.ledger,
    fontSize: 9,
  },
  calendarScrim: {
    alignItems: "center",
    backgroundColor: withAlpha(palette.black, 0.82),
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
});
