import { LoadingState } from "@/components/feedback/loading-state";
import { CustomCalendar } from "@/components/ui/custom-calendar";
import { SaveFeedback } from "@/components/ui/save-feedback";
import { Screen } from "@/components/ui/screen";
import { useAuth } from "@/hooks/use-auth";
import {
  useCreateGoal,
  useDeleteGoal,
  useGoals,
  useUpdateGoal,
} from "@/hooks/use-goals";
import { isMissingGoalsTableError } from "@/services/supabase/goal-service";
import { CURRENCY_OPTIONS, useAppStore } from "@/store/use-app-store";
import type { Goal, GoalStatus, GoalType } from "@/types/domain/goal";
import { fromLocalDateString, toLocalDateString } from "@/utils/date";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { type ReactNode, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

const GOAL_ICON_OPTIONS = [
  "target",
  "wallet-outline",
  "laptop",
  "airplane",
  "home-outline",
  "car-sports",
  "gift-outline",
  "briefcase-outline",
  "beach",
  "sofa-outline",
] as const;

const GOAL_COLOR_OPTIONS = [
  "#2563eb",
  "#7c3aed",
  "#059669",
  "#ea580c",
  "#e11d48",
  "#0284c7",
  "#475569",
  "#db2777",
] as const;

const QUICK_CONTRIBUTIONS = [25, 50, 100, 250, 500] as const;

/**
 * Create a fresh GoalFormState populated with sensible defaults for a new goal form.
 *
 * @returns A GoalFormState initialized with an empty `title`, `goalType` set to `"saving"`, empty `targetAmount` and `savedAmount`, `targetDate` set to the current date, `hasTargetDate` set to `false`, empty `notes`, and the first entries from `GOAL_ICON_OPTIONS` and `GOAL_COLOR_OPTIONS` as `iconName` and `color`.
 */
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

/**
 * Build a GoalFormState pre-filled from an existing Goal for use in the goal form UI.
 *
 * @param goal - The source Goal to derive form values from
 * @returns A GoalFormState populated from `goal`. Notable mappings:
 * - `targetDate` is parsed from `goal.target_date` or set to `new Date()` when absent.
 * - `hasTargetDate` is `true` when `goal.target_date` is present.
 * - `targetAmount` and `savedAmount` are string representations of the corresponding numeric fields; `savedAmount` is an empty string when `goal.saved_amount` is falsy.
 * - `notes` defaults to an empty string when missing.
 */
function goalFormFromGoal(goal: Goal): GoalFormState {
  return {
    title: goal.title,
    goalType: goal.goal_type,
    targetAmount: String(goal.target_amount),
    savedAmount: goal.saved_amount ? String(goal.saved_amount) : "",
    targetDate: goal.target_date
      ? fromLocalDateString(goal.target_date)
      : new Date(),
    hasTargetDate: !!goal.target_date,
    notes: goal.notes ?? "",
    iconName: goal.icon_name,
    color: goal.color,
  };
}

/**
 * Converts a user-entered currency string into a numeric value by removing all characters except digits and the decimal point.
 *
 * @param value - The raw input string (may contain currency symbols, commas, spaces, etc.)
 * @returns The parsed floating-point number, or `0` if the input is empty or cannot be parsed
 */
function parseCurrencyInput(value: string) {
  const normalized = value.replace(/[^0-9.]/g, "");
  if (!normalized) return 0;
  return Number.parseFloat(normalized) || 0;
}

/**
 * Format a numeric goal amount with a currency symbol (or currency code) using en-US number formatting.
 *
 * @param amount - The numeric amount to format.
 * @param currencyCode - ISO-like currency code used to look up a symbol in `CURRENCY_OPTIONS`; if no symbol is found, the code followed by a space is used as the prefix.
 * @returns A string consisting of the currency symbol or "`<CODE> `" prefix followed by the amount formatted with en-US separators — integers show no decimal places, non-integers show two decimal places.
 */
function formatGoalAmount(amount: number, currencyCode: string) {
  const option = CURRENCY_OPTIONS.find((item) => item.code === currencyCode);
  const prefix = option?.symbol ?? `${currencyCode} `;
  return `${prefix}${amount.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Calculates progress toward a goal as a fraction between 0 and 1.
 *
 * @param goal - Goal whose `saved_amount` and `target_amount` are used to compute progress
 * @returns `0` if `target_amount` is less than or equal to zero; otherwise a number between `0` and `1` representing `saved_amount / target_amount`, clamped to that range
 */
function getGoalProgress(goal: Goal) {
  if (goal.target_amount <= 0) return 0;
  return Math.max(0, Math.min(goal.saved_amount / goal.target_amount, 1));
}

/**
 * Returns a human-readable label for a goal type.
 *
 * @param goalType - The goal's type (e.g., `"saving"` or `"item"`)
 * @returns `"Savings target"` for `"saving"`, `"Item purchase"` otherwise
 */
function getGoalTypeLabel(goalType: GoalType) {
  return goalType === "saving" ? "Savings target" : "Item purchase";
}

/**
 * Return a user-facing subtitle describing the goal's purpose.
 *
 * @param goal - The goal whose type determines the subtitle
 * @returns A short subtitle: "Track a purchase and build toward owning it." for `goal_type === "item"`, otherwise "Build up savings with steady contributions."
 */
function getGoalSubtitle(goal: Goal) {
  if (goal.goal_type === "item") {
    return "Track a purchase and build toward owning it.";
  }

  return "Build up savings with steady contributions.";
}

/**
 * Format a target date string for display as `MMM d, yyyy`, or indicate that no date is set.
 *
 * @param date - A local date string or `null` when no target date exists
 * @returns `"No target date"` when `date` is falsy, otherwise the formatted date (e.g., `Mar 3, 2026`)
 */
function formatGoalDate(date: string | null) {
  if (!date) return "No target date";

  return fromLocalDateString(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Bottom-sheet modal that presents scrollable content anchored to the bottom of the screen with safe-area and keyboard handling.
 *
 * @param visible - Whether the sheet is visible.
 * @param title - Header title displayed at the top of the sheet.
 * @param onClose - Callback invoked when the sheet is dismissed (back press, overlay tap, or close button).
 * @param children - Content rendered inside the sheet's scrollable area.
 * @returns The modal view rendering a bottom sheet UI.
 */
function SheetModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(15,23,42,0.35)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={{
              maxHeight: "88%",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              backgroundColor: "#ffffff",
              paddingBottom: Math.max(insets.bottom, 20),
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -6 },
              shadowOpacity: 0.08,
              shadowRadius: 16,
              elevation: 16,
            }}
          >
            <View style={{ alignItems: "center", paddingTop: 12 }}>
              <View
                style={{
                  width: 42,
                  height: 4,
                  borderRadius: 999,
                  backgroundColor: "#cbd5e1",
                }}
              />
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                paddingTop: 16,
                paddingBottom: 14,
                borderBottomWidth: 1,
                borderBottomColor: "#e2e8f0",
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#0f172a" }}>
                {title}
              </Text>
              <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 20, paddingBottom: 8 }}
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/**
 * Renders a compact summary card showing an icon, a label, and a prominent value.
 *
 * The card displays a colored icon container, a small label line, and a bold value line with a subtle border highlight.
 *
 * @param icon - Name of the MaterialCommunityIcons glyph to show inside the icon container
 * @param iconColor - Foreground color for the icon
 * @param iconBackground - Background color for the icon container
 * @param label - Small descriptive label displayed above the value
 * @param value - Prominent value text shown on the card
 * @param accent - Accent color used to tint the card border
 * @returns A React element representing the styled summary card
 */
function SummaryCard({
  icon,
  iconColor,
  iconBackground,
  label,
  value,
  accent,
}: {
  icon: string;
  iconColor: string;
  iconBackground: string;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        borderRadius: 24,
        backgroundColor: "#ffffff",
        padding: 18,
        borderWidth: 1,
        borderColor: accent + "18",
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: iconBackground,
          marginBottom: 14,
        }}
      >
        <MaterialCommunityIcons name={icon as any} size={22} color={iconColor} />
      </View>
      <Text style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 18, fontWeight: "800", color: "#0f172a" }}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Renders a pressable filter chip used to select a goals list filter.
 *
 * @param label - Text shown inside the chip
 * @param active - Whether the chip is currently selected; controls colors and border
 * @param onPress - Callback invoked when the chip is pressed
 * @param activeColor - Background and border color when `active` is `true`
 * @returns The touchable chip element
 */
function FilterChip({
  label,
  active,
  onPress,
  activeColor,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  activeColor: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        marginRight: 10,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: active ? activeColor : "#ffffff",
        borderWidth: 1,
        borderColor: active ? activeColor : "#dbe3ee",
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: "700",
          color: active ? "#ffffff" : "#475569",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Render a card that displays a single goal's details, progress, and action buttons.
 *
 * @param props.goal - The goal data to display.
 * @param props.onAddFunds - Callback invoked when the "Add funds" button is pressed.
 * @param props.onEdit - Callback invoked when the "Edit" button is pressed.
 * @param props.onToggleStatus - Callback invoked when the "Complete"/"Reopen" button is pressed.
 * @param props.onDelete - Callback invoked when the "Delete" button is pressed.
 * @returns A React element representing the goal card.
 */
function GoalCard(props: {
  goal: Goal;
  onAddFunds: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const { goal, onAddFunds, onDelete, onEdit, onToggleStatus } = props;
  const progress = getGoalProgress(goal);
  const saved = formatGoalAmount(goal.saved_amount, goal.currency_code);
  const target = formatGoalAmount(goal.target_amount, goal.currency_code);
  const remaining = Math.max(goal.target_amount - goal.saved_amount, 0);
  const statusTone =
    goal.status === "completed"
      ? { bg: "#dcfce7", text: "#166534", label: "Completed" }
      : { bg: "#dbeafe", text: "#1d4ed8", label: "Active" };

  return (
    <View
      style={{
        borderRadius: 28,
        backgroundColor: "#ffffff",
        padding: 18,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        marginBottom: 14,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <View style={{ flexDirection: "row", flex: 1, paddingRight: 12 }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 18,
              backgroundColor: goal.color + "20",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 14,
            }}
          >
            <MaterialCommunityIcons
              name={goal.icon_name as any}
              size={24}
              color={goal.color}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "800",
                color: "#0f172a",
                marginBottom: 4,
              }}
            >
              {goal.title}
            </Text>
            <Text style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
              {getGoalTypeLabel(goal.goal_type)}
            </Text>
            <View
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: statusTone.bg,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: statusTone.text,
                }}
              >
                {statusTone.label}
              </Text>
            </View>
          </View>
        </View>
        <Text style={{ fontSize: 12, color: "#94a3b8", fontWeight: "600" }}>
          {formatGoalDate(goal.target_date)}
        </Text>
      </View>

      <Text
        style={{
          fontSize: 14,
          lineHeight: 20,
          color: "#475569",
          marginBottom: 16,
        }}
      >
        {goal.notes?.trim() || getGoalSubtitle(goal)}
      </Text>

      <View style={{ marginBottom: 10 }}>
        <View
          style={{
            height: 10,
            borderRadius: 999,
            backgroundColor: "#e2e8f0",
            overflow: "hidden",
            marginBottom: 10,
          }}
        >
          <View
            style={{
              width: `${Math.max(progress * 100, goal.saved_amount > 0 ? 6 : 0)}%`,
              height: "100%",
              borderRadius: 999,
              backgroundColor: goal.color,
            }}
          />
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "800", color: "#0f172a" }}>
            {saved} saved
          </Text>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#64748b" }}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
        <Text style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
          Target {target}
          {remaining > 0
            ? ` • ${formatGoalAmount(remaining, goal.currency_code)} left`
            : " • Goal reached"}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          marginTop: 6,
          marginHorizontal: -4,
        }}
      >
        <TouchableOpacity
          onPress={onAddFunds}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor: goal.color,
            marginHorizontal: 4,
            marginTop: 8,
          }}
        >
          <MaterialCommunityIcons name="plus" size={16} color="#ffffff" />
          <Text
            style={{
              marginLeft: 6,
              fontSize: 13,
              fontWeight: "700",
              color: "#ffffff",
            }}
          >
            Add funds
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onEdit}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor: "#eff6ff",
            marginHorizontal: 4,
            marginTop: 8,
          }}
        >
          <MaterialCommunityIcons name="pencil-outline" size={15} color="#2563eb" />
          <Text
            style={{
              marginLeft: 6,
              fontSize: 13,
              fontWeight: "700",
              color: "#2563eb",
            }}
          >
            Edit
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onToggleStatus}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor: "#f8fafc",
            marginHorizontal: 4,
            marginTop: 8,
            borderWidth: 1,
            borderColor: "#e2e8f0",
          }}
        >
          <MaterialCommunityIcons
            name={goal.status === "completed" ? "backup-restore" : "check-circle-outline"}
            size={15}
            color="#334155"
          />
          <Text
            style={{
              marginLeft: 6,
              fontSize: 13,
              fontWeight: "700",
              color: "#334155",
            }}
          >
            {goal.status === "completed" ? "Reopen" : "Complete"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onDelete}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor: "#fff1f2",
            marginHorizontal: 4,
            marginTop: 8,
          }}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={15} color="#e11d48" />
          <Text
            style={{
              marginLeft: 6,
              fontSize: 13,
              fontWeight: "700",
              color: "#e11d48",
            }}
          >
            Delete
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Screen that lists and manages user goals with creation, editing, contributions, completion/reopen, deletion, and filter controls.
 *
 * Renders summaries (open goals, total saved, nearest target), a filterable goal list, and modals for creating/editing goals, adding contributions, and selecting target dates.
 * Integrates with authentication and data hooks to load goals and perform create/update/delete mutations, validates form and contribution input, and surfaces success/error feedback.
 *
 * @returns The React element for the Goals screen.
 */
export function GoalsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const theme = useAppStore((state) => state.theme);
  const currency = useAppStore((state) => state.currency);
  const primary = theme.primary;

  const { data: goals = [], error, isLoading, refetch } = useGoals();
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

  const filteredGoals = useMemo(() => {
    if (filter === "all") return goals;
    return goals.filter((goal) => goal.status === filter);
  }, [filter, goals]);

  const activeGoals = useMemo(
    () => goals.filter((goal) => goal.status === "active"),
    [goals],
  );

  const totalSaved = useMemo(
    () => goals.reduce((sum, goal) => sum + goal.saved_amount, 0),
    [goals],
  );

  const nearestGoal = useMemo(() => {
    return [...activeGoals]
      .filter((goal) => !!goal.target_date)
      .sort((left, right) => {
        if (!left.target_date || !right.target_date) return 0;
        return left.target_date.localeCompare(right.target_date);
      })[0];
  }, [activeGoals]);

  const goalCountLabel = `${activeGoals.length} active`;
  const savedTotalLabel = formatGoalAmount(totalSaved, currency.code);
  const closestLabel = nearestGoal?.target_date
    ? nearestGoal.title
    : "Set your first date";

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
    setFeedback({
      visible: true,
      type: "error",
      title,
      message,
    });
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
      currency_code: currency.code,
      target_date: form.hasTargetDate ? toLocalDateString(form.targetDate) : null,
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
        title: editingGoal ? "Goal updated" : "Goal created",
        message: editingGoal
          ? "Your goal details were updated."
          : "Your new goal is ready for contributions.",
        primaryActionLabel:
          !editingGoal && savedGoal.status === "active"
            ? "Add first funds"
            : undefined,
        onPrimaryAction:
          !editingGoal && savedGoal.status === "active"
            ? () => {
                dismissFeedback();
                openContribution(savedGoal);
              }
            : undefined,
      });
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "We could not save this goal right now.";
      setFormError(message);
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
      updatedSavedAmount >= selectedGoal.target_amount ? "completed" : "active";

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
        title: nextStatus === "completed" ? "Goal completed" : "Funds added",
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
          completed_at: nextStatus === "completed" ? new Date().toISOString() : null,
        },
      });

      setFeedback({
        visible: true,
        type: "success",
        title: nextStatus === "completed" ? "Goal marked complete" : "Goal reopened",
        message:
          nextStatus === "completed"
            ? `${goal.title} is now marked as complete.`
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

  const renderErrorState = () => {
    const missingTable = isMissingGoalsTableError(error);

    return (
      <View
        style={{
          borderRadius: 28,
          backgroundColor: "#ffffff",
          padding: 24,
          borderWidth: 1,
          borderColor: missingTable ? "#fecaca" : "#e2e8f0",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 22,
            backgroundColor: missingTable ? "#fff1f2" : "#eff6ff",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <MaterialCommunityIcons
            name={missingTable ? "database-alert-outline" : "alert-circle-outline"}
            size={28}
            color={missingTable ? "#e11d48" : primary}
          />
        </View>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "800",
            color: "#0f172a",
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          {missingTable ? "Goals table not found" : "Could not load goals"}
        </Text>
        <Text
          style={{
            fontSize: 14,
            lineHeight: 21,
            color: "#64748b",
            textAlign: "center",
            marginBottom: 18,
          }}
        >
          {missingTable
            ? "Run the Goals SQL migration, then refresh this tab to start saving toward new targets."
            : "Try refreshing again. If the problem persists, check your database connection and policies."}
        </Text>
        <TouchableOpacity
          onPress={() => refetch()}
          style={{
            paddingHorizontal: 18,
            paddingVertical: 12,
            borderRadius: 999,
            backgroundColor: primary,
          }}
        >
          <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 14 }}>
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: 132 + insets.bottom,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 22,
          }}
        >
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: "#0f172a",
                marginBottom: 8,
              }}
            >
              Goals
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: "#475569" }}>
              Save for a target, a big item, or the next milestone you want to
              reach.
            </Text>
          </View>
          <TouchableOpacity
            onPress={openCreateGoal}
            style={{
              width: 54,
              height: 54,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: primary,
            }}
          >
            <MaterialCommunityIcons name="plus" size={26} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <View
          style={{
            borderRadius: 30,
            backgroundColor: primary,
            padding: 24,
            marginBottom: 18,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: "rgba(255,255,255,0.76)",
              marginBottom: 8,
            }}
          >
            Goal planner
          </Text>
          <Text
            style={{
              fontSize: 24,
              fontWeight: "800",
              color: "#ffffff",
              marginBottom: 10,
            }}
          >
            Keep every savings plan in one place
          </Text>
          <Text
            style={{
              fontSize: 14,
              lineHeight: 21,
              color: "rgba(255,255,255,0.88)",
            }}
          >
            Create a focused target, add progress quickly, and mark it complete
            when you are there.
          </Text>
        </View>

        <View style={{ flexDirection: "row", marginBottom: 12 }}>
          <View style={{ flex: 1, marginRight: 6 }}>
            <SummaryCard
              icon="target"
              iconColor={primary}
              iconBackground={primary + "14"}
              label="Open goals"
              value={goalCountLabel}
              accent={primary}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <SummaryCard
              icon="wallet-outline"
              iconColor="#059669"
              iconBackground="#dcfce7"
              label="Saved so far"
              value={savedTotalLabel}
              accent="#059669"
            />
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          <SummaryCard
            icon="calendar-clock-outline"
            iconColor="#7c3aed"
            iconBackground="#ede9fe"
            label="Closest target"
            value={closestLabel}
            accent="#7c3aed"
          />
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: "#0f172a",
              marginBottom: 12,
            }}
          >
            Filter goals
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <FilterChip
              label="All"
              active={filter === "all"}
              onPress={() => setFilter("all")}
              activeColor={primary}
            />
            <FilterChip
              label="Active"
              active={filter === "active"}
              onPress={() => setFilter("active")}
              activeColor={primary}
            />
            <FilterChip
              label="Completed"
              active={filter === "completed"}
              onPress={() => setFilter("completed")}
              activeColor={primary}
            />
          </ScrollView>
        </View>

        {error ? (
          renderErrorState()
        ) : isLoading ? (
          <LoadingState label="Loading your goals" />
        ) : goals.length === 0 ? (
          <View
            style={{
              borderRadius: 30,
              backgroundColor: "#ffffff",
              padding: 24,
              borderWidth: 1,
              borderColor: "#e2e8f0",
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 24,
                backgroundColor: primary + "18",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <MaterialCommunityIcons
                name="target"
                size={32}
                color={primary}
              />
            </View>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "800",
                color: "#0f172a",
                marginBottom: 8,
              }}
            >
              Start your first goal
            </Text>
            <Text
              style={{
                fontSize: 14,
                lineHeight: 21,
                color: "#64748b",
                textAlign: "center",
                marginBottom: 18,
              }}
            >
              Track a savings target, a travel plan, or an item you want to buy
              without losing sight of your progress.
            </Text>
            <TouchableOpacity
              onPress={openCreateGoal}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 999,
                backgroundColor: primary,
              }}
            >
              <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 14 }}>
                Create a goal
              </Text>
            </TouchableOpacity>
          </View>
        ) : filteredGoals.length === 0 ? (
          <View
            style={{
              borderRadius: 28,
              backgroundColor: "#ffffff",
              padding: 22,
              borderWidth: 1,
              borderColor: "#e2e8f0",
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "800",
                color: "#0f172a",
                marginBottom: 8,
              }}
            >
              No goals in this filter
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: "#64748b" }}>
              Switch filters or add a new goal to keep your plans moving.
            </Text>
          </View>
        ) : (
          filteredGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onAddFunds={() => openContribution(goal)}
              onEdit={() => openEditGoal(goal)}
              onToggleStatus={() => handleToggleStatus(goal)}
              onDelete={() => handleDeleteGoal(goal)}
            />
          ))
        )}
      </ScrollView>

      <SheetModal
        visible={goalSheetOpen}
        title={editingGoal ? "Edit goal" : "Create goal"}
        onClose={closeGoalSheet}
      >
        <View
          style={{
            borderRadius: 24,
            backgroundColor: form.color + "12",
            padding: 18,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: form.color + "20",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                backgroundColor: "#ffffff",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 14,
              }}
            >
              <MaterialCommunityIcons
                name={form.iconName as any}
                size={24}
                color={form.color}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: "#0f172a",
                  marginBottom: 4,
                }}
              >
                {form.title.trim() || "New goal"}
              </Text>
              <Text style={{ fontSize: 13, color: "#475569" }}>
                {form.goalType === "saving"
                  ? "Steady saving target"
                  : "Item purchase plan"}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 14, color: "#334155" }}>
            {form.targetAmount
              ? `Target ${formatGoalAmount(parseCurrencyInput(form.targetAmount), currency.code)}`
              : "Set a target amount to begin"}
          </Text>
        </View>

        <Text style={{ fontSize: 15, fontWeight: "800", color: "#0f172a", marginBottom: 12 }}>
          Goal type
        </Text>
        <View style={{ flexDirection: "row", marginBottom: 20 }}>
          {(["saving", "item"] as GoalType[]).map((goalType, index) => {
            const active = form.goalType === goalType;
            return (
              <TouchableOpacity
                key={goalType}
                onPress={() =>
                    setForm((current) => ({
                      ...current,
                      goalType,
                      iconName:
                        goalType === "saving"
                          ? GOAL_ICON_OPTIONS[0]
                          : GOAL_ICON_OPTIONS[2],
                    }))
                }
                style={{
                  flex: 1,
                  borderRadius: 22,
                  padding: 16,
                  backgroundColor: active ? primary : "#f8fafc",
                  borderWidth: 1,
                  borderColor: active ? primary : "#dbe3ee",
                  marginLeft: index === 1 ? 8 : 0,
                  marginRight: index === 0 ? 8 : 0,
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "800",
                    color: active ? "#ffffff" : "#0f172a",
                    marginBottom: 4,
                  }}
                >
                  {goalType === "saving" ? "Savings target" : "Item purchase"}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    lineHeight: 18,
                    color: active ? "rgba(255,255,255,0.82)" : "#64748b",
                  }}
                >
                  {goalType === "saving"
                    ? "Track how much you want to put aside."
                    : "Save toward a specific thing you want."}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={{ fontSize: 15, fontWeight: "800", color: "#0f172a", marginBottom: 10 }}>
          Details
        </Text>
        <TextInput
          value={form.title}
          onChangeText={(title) => setForm((current) => ({ ...current, title }))}
          placeholder="Goal title"
          placeholderTextColor="#94a3b8"
          style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: "#dbe3ee",
            backgroundColor: "#ffffff",
            paddingHorizontal: 16,
            paddingVertical: 15,
            fontSize: 15,
            color: "#0f172a",
            marginBottom: 12,
          }}
        />
        <View style={{ flexDirection: "row", marginBottom: 12 }}>
          <View style={{ flex: 1, marginRight: 6 }}>
            <Text style={{ fontSize: 13, color: "#475569", marginBottom: 8 }}>
              Target amount
            </Text>
            <TextInput
              value={form.targetAmount}
              onChangeText={(targetAmount) =>
                setForm((current) => ({ ...current, targetAmount }))
              }
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              keyboardType="decimal-pad"
              style={{
                borderRadius: 18,
                borderWidth: 1,
                borderColor: "#dbe3ee",
                backgroundColor: "#ffffff",
                paddingHorizontal: 16,
                paddingVertical: 15,
                fontSize: 15,
                color: "#0f172a",
              }}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Text style={{ fontSize: 13, color: "#475569", marginBottom: 8 }}>
              Already saved
            </Text>
            <TextInput
              value={form.savedAmount}
              onChangeText={(savedAmount) =>
                setForm((current) => ({ ...current, savedAmount }))
              }
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              keyboardType="decimal-pad"
              style={{
                borderRadius: 18,
                borderWidth: 1,
                borderColor: "#dbe3ee",
                backgroundColor: "#ffffff",
                paddingHorizontal: 16,
                paddingVertical: 15,
                fontSize: 15,
                color: "#0f172a",
              }}
            />
          </View>
        </View>

        <View
          style={{
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "#dbe3ee",
            backgroundColor: "#ffffff",
            padding: 16,
            marginBottom: 14,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#0f172a", marginBottom: 4 }}>
                Target date
              </Text>
              <Text style={{ fontSize: 13, color: "#64748b" }}>
                {form.hasTargetDate
                  ? formatGoalDate(toLocalDateString(form.targetDate))
                  : "Optional"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setCalendarOpen(true)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: "#eff6ff",
              }}
            >
              <Text style={{ color: "#2563eb", fontWeight: "700", fontSize: 13 }}>
                Pick date
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() =>
              setForm((current) => ({
                ...current,
                hasTargetDate: !current.hasTargetDate,
              }))
            }
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ fontSize: 13, color: "#475569" }}>
              {form.hasTargetDate ? "Remove target date" : "Use a target date"}
            </Text>
            <MaterialCommunityIcons
              name={form.hasTargetDate ? "toggle-switch" : "toggle-switch-off-outline"}
              size={34}
              color={form.hasTargetDate ? primary : "#94a3b8"}
            />
          </TouchableOpacity>
        </View>

        <Text style={{ fontSize: 15, fontWeight: "800", color: "#0f172a", marginBottom: 10 }}>
          Icon
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 18 }}>
          {GOAL_ICON_OPTIONS.map((iconName) => {
            const active = form.iconName === iconName;
            return (
              <TouchableOpacity
                key={iconName}
                onPress={() =>
                  setForm((current) => ({ ...current, iconName }))
                }
                style={{
                  width: "18%",
                  aspectRatio: 1,
                  borderRadius: 18,
                  backgroundColor: active ? form.color : "#f8fafc",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "2%",
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: active ? form.color : "#e2e8f0",
                }}
              >
                <MaterialCommunityIcons
                  name={iconName as any}
                  size={22}
                  color={active ? "#ffffff" : "#475569"}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={{ fontSize: 15, fontWeight: "800", color: "#0f172a", marginBottom: 10 }}>
          Accent color
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 18 }}>
          {GOAL_COLOR_OPTIONS.map((color) => {
            const active = form.color === color;
            return (
              <TouchableOpacity
                key={color}
                onPress={() =>
                  setForm((current) => ({ ...current, color }))
                }
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: color,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 10,
                  marginBottom: 10,
                  borderWidth: active ? 3 : 0,
                  borderColor: "#0f172a",
                }}
              >
                {active ? (
                  <MaterialCommunityIcons name="check" size={18} color="#ffffff" />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={{ fontSize: 15, fontWeight: "800", color: "#0f172a", marginBottom: 10 }}>
          Notes
        </Text>
        <TextInput
          value={form.notes}
          onChangeText={(notes) => setForm((current) => ({ ...current, notes }))}
          placeholder="What is this goal for?"
          placeholderTextColor="#94a3b8"
          multiline
          textAlignVertical="top"
          style={{
            minHeight: 104,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: "#dbe3ee",
            backgroundColor: "#ffffff",
            paddingHorizontal: 16,
            paddingVertical: 15,
            fontSize: 15,
            color: "#0f172a",
            marginBottom: 10,
          }}
        />

        {formError ? (
          <Text style={{ color: "#e11d48", fontSize: 13, marginBottom: 12 }}>
            {formError}
          </Text>
        ) : null}

        <TouchableOpacity
          onPress={handleSaveGoal}
          disabled={goalSheetBusy}
          style={{
            borderRadius: 18,
            backgroundColor: goalSheetBusy ? "#94a3b8" : primary,
            paddingVertical: 16,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 6,
          }}
        >
          <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "800" }}>
            {goalSheetBusy
              ? "Saving..."
              : editingGoal
                ? "Update goal"
                : "Create goal"}
          </Text>
        </TouchableOpacity>
      </SheetModal>

      <SheetModal
        visible={contributeSheetOpen}
        title="Add to goal"
        onClose={closeContributionSheet}
      >
        {selectedGoal ? (
          <>
            <View
              style={{
                borderRadius: 24,
                backgroundColor: selectedGoal.color + "12",
                padding: 18,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: selectedGoal.color + "20",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    backgroundColor: "#ffffff",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 14,
                  }}
                >
                  <MaterialCommunityIcons
                    name={selectedGoal.icon_name as any}
                    size={22}
                    color={selectedGoal.color}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "800",
                      color: "#0f172a",
                      marginBottom: 4,
                    }}
                  >
                    {selectedGoal.title}
                  </Text>
                  <Text style={{ fontSize: 13, color: "#475569" }}>
                    {formatGoalAmount(selectedGoal.saved_amount, selectedGoal.currency_code)}
                    {" / "}
                    {formatGoalAmount(selectedGoal.target_amount, selectedGoal.currency_code)}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 14, color: "#334155" }}>
                Add a contribution to move this goal forward.
              </Text>
            </View>

            <Text style={{ fontSize: 15, fontWeight: "800", color: "#0f172a", marginBottom: 10 }}>
              Quick amounts
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 18 }}>
              {QUICK_CONTRIBUTIONS.map((amount) => (
                <TouchableOpacity
                  key={amount}
                  onPress={() => setContributionAmount(String(amount))}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: "#f8fafc",
                    borderWidth: 1,
                    borderColor: "#dbe3ee",
                    marginRight: 10,
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#334155" }}>
                    {formatGoalAmount(amount, selectedGoal.currency_code)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ fontSize: 15, fontWeight: "800", color: "#0f172a", marginBottom: 10 }}>
              Amount
            </Text>
            <TextInput
              value={contributionAmount}
              onChangeText={setContributionAmount}
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              keyboardType="decimal-pad"
              style={{
                borderRadius: 18,
                borderWidth: 1,
                borderColor: "#dbe3ee",
                backgroundColor: "#ffffff",
                paddingHorizontal: 16,
                paddingVertical: 15,
                fontSize: 15,
                color: "#0f172a",
                marginBottom: 12,
              }}
            />

            {contributionError ? (
              <Text style={{ color: "#e11d48", fontSize: 13, marginBottom: 12 }}>
                {contributionError}
              </Text>
            ) : null}

            <TouchableOpacity
              onPress={handleContribution}
              disabled={contributionBusy}
              style={{
                borderRadius: 18,
                backgroundColor: contributionBusy ? "#94a3b8" : selectedGoal.color,
                paddingVertical: 16,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "800" }}>
                {contributionBusy ? "Adding..." : "Add contribution"}
              </Text>
            </TouchableOpacity>
          </>
        ) : null}
      </SheetModal>

      <Modal
        transparent
        animationType="fade"
        visible={calendarOpen}
        statusBarTranslucent
        onRequestClose={() => setCalendarOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(15,23,42,0.35)",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 18,
          }}
          onPress={() => setCalendarOpen(false)}
        >
          <Pressable onPress={() => null}>
            <CustomCalendar
              selectedDate={form.targetDate}
              onSelectDate={(targetDate) =>
                setForm((current) => ({
                  ...current,
                  targetDate,
                  hasTargetDate: true,
                }))
              }
              onClose={() => setCalendarOpen(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <SaveFeedback
        visible={feedback.visible}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        primaryActionLabel={feedback.primaryActionLabel}
        onPrimaryAction={feedback.onPrimaryAction}
        onDone={dismissFeedback}
      />
    </Screen>
  );
}
