import { ActionButton } from "@/components/finance/action-button";
import { FinanceField } from "@/components/finance/finance-field";
import { FinanceSheet } from "@/components/finance/finance-sheet";
import { PageHeading } from "@/components/finance/page-heading";
import { Screen } from "@/components/ui/screen";
import { SignalThreads } from "@/components/visuals/signal-threads";
import type {
  DraftFieldValue,
  TransactionDraftContract,
  TransactionDraftLifecycle,
} from "@/contracts/backend";
import type { TransactionDraftCorrections } from "@/features/drafts/draft-review";
import { useAuth } from "@/hooks/use-auth";
import {
  useCorrectTransactionDraft,
  useCreateTransactionDraft,
  useDeleteTransactionDraft,
  useMarkTransactionDraftPendingConfirmation,
  useTransactionDrafts,
} from "@/hooks/use-transaction-drafts";
import { useWorkspace } from "@/hooks/use-workspace";
import { backendErrorMessage } from "@/services/backend/errors";
import { palette, withAlpha } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type DraftForm = {
  amount: string;
  category: string;
  currency: string;
  date: string;
  description: string;
  merchant: string;
  type: "" | "Expenditure" | "Revenue";
};

const EMPTY_FORM: DraftForm = {
  amount: "",
  category: "",
  currency: "",
  date: "",
  description: "",
  merchant: "",
  type: "",
};

function fieldText(draft: TransactionDraftContract, fieldName: string) {
  const value = draft.extracted_fields[fieldName]?.value;
  return value === null || value === undefined ? "" : String(value);
}

function formFromDraft(draft: TransactionDraftContract): DraftForm {
  const type = fieldText(draft, "type");
  return {
    amount: fieldText(draft, "amount"),
    category: fieldText(draft, "category_key"),
    currency: fieldText(draft, "currency_code"),
    date: fieldText(draft, "transaction_date"),
    description: fieldText(draft, "description"),
    merchant: fieldText(draft, "merchant_name"),
    type:
      type === "Expenditure" || type === "Revenue"
        ? type
        : "",
  };
}

function normalizedText(value: string): DraftFieldValue {
  const trimmed = value.trim();
  return trimmed || null;
}

function correctionsFromForm(form: DraftForm): TransactionDraftCorrections {
  const parsedAmount = Number(form.amount.replace(/,/g, "").trim());
  return {
    amount:
      Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : null,
    category_key: normalizedText(form.category.toLowerCase()),
    currency_code: normalizedText(form.currency.toUpperCase()),
    description: normalizedText(form.description),
    merchant_name: normalizedText(form.merchant),
    transaction_date: normalizedText(form.date),
    type: form.type || null,
  };
}

function lifecycleLabel(lifecycle: TransactionDraftLifecycle) {
  if (lifecycle === "pending_confirmation") return "Ready";
  if (lifecycle === "confirmed") return "Confirmed";
  if (lifecycle === "draft") return "Draft";
  return "Review";
}

function lifecycleColor(lifecycle: TransactionDraftLifecycle) {
  if (lifecycle === "pending_confirmation") return palette.income;
  if (lifecycle === "confirmed") return palette.signalCyan;
  if (lifecycle === "draft") return palette.signalAmber;
  return palette.expense;
}

function DraftCard({
  draft,
  onPress,
}: {
  draft: TransactionDraftContract;
  onPress: () => void;
}) {
  const statusColor = lifecycleColor(draft.lifecycle);
  const confidence = Math.round(draft.overall_confidence * 100);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.draftCard,
        { opacity: pressed ? 0.62 : 1 },
      ]}>
      <View style={styles.draftTopline}>
        <View style={styles.statusGroup}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {lifecycleLabel(draft.lifecycle).toLocaleUpperCase()}
          </Text>
        </View>
        <Text style={styles.confidence}>{confidence}% CONFIDENCE</Text>
      </View>
      <Text numberOfLines={2} style={styles.draftText}>
        {draft.original_text}
      </Text>
      <View style={styles.draftFooter}>
        <Text style={styles.draftMeta}>
          {draft.missing_fields.length > 0
            ? `${draft.missing_fields.length} FIELD${draft.missing_fields.length === 1 ? "" : "S"} TO REVIEW`
            : "ALL REQUIRED FIELDS PRESENT"}
        </Text>
        <MaterialCommunityIcons
          color={palette.textQuiet}
          name="chevron-right"
          size={18}
        />
      </View>
    </Pressable>
  );
}

export function DraftReviewScreen() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? "";
  const [sourceText, setSourceText] = useState("");
  const [selectedDraft, setSelectedDraft] =
    useState<TransactionDraftContract | null>(null);
  const [form, setForm] = useState<DraftForm>(EMPTY_FORM);

  const draftsQuery = useTransactionDrafts(workspaceId, {
    includeConfirmed: false,
    includeExpired: false,
  });
  const createDraft = useCreateTransactionDraft();
  const correctDraft = useCorrectTransactionDraft();
  const markReady = useMarkTransactionDraftPendingConfirmation();
  const deleteDraft = useDeleteTransactionDraft();

  const drafts = draftsQuery.data ?? [];
  const reviewCount = useMemo(
    () => drafts.filter((draft) => draft.lifecycle === "needs_review").length,
    [drafts],
  );
  const readyCount = drafts.length - reviewCount;

  const openDraft = (draft: TransactionDraftContract) => {
    setSelectedDraft(draft);
    setForm(formFromDraft(draft));
  };

  const closeDraft = () => {
    setSelectedDraft(null);
    setForm(EMPTY_FORM);
  };

  const handleCreate = async () => {
    if (!user?.uid || !workspace) {
      Alert.alert(
        "Workspace not ready",
        "Restore your signed-in workspace before saving a review draft.",
      );
      return;
    }
    try {
      const result = await createDraft.mutateAsync({
        defaultCurrency: workspace.default_currency,
        ownerUserId: user.uid,
        source: "mobile_app",
        sourceMessageId: null,
        text: sourceText,
        workspaceId: workspace.id,
      });
      setSourceText("");
      openDraft(result.draft);
    } catch (error) {
      Alert.alert("Draft not saved", backendErrorMessage(error));
    }
  };

  const handleSaveCorrections = async () => {
    if (!selectedDraft) return;
    try {
      const updated = await correctDraft.mutateAsync({
        corrections: correctionsFromForm(form),
        draft: selectedDraft,
      });
      setSelectedDraft(updated);
      setForm(formFromDraft(updated));
    } catch (error) {
      Alert.alert("Corrections not saved", backendErrorMessage(error));
    }
  };

  const handleMarkReady = async () => {
    if (!selectedDraft) return;
    try {
      const updated = await markReady.mutateAsync(selectedDraft);
      setSelectedDraft(updated);
      Alert.alert(
        "Draft ready",
        "The reviewed fields are ready for the final transaction save step.",
      );
    } catch (error) {
      Alert.alert("Draft still needs review", backendErrorMessage(error));
    }
  };

  const handleDelete = () => {
    if (!selectedDraft) return;
    Alert.alert(
      "Delete this draft?",
      "The source text and extracted fields will be removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDraft.mutateAsync(selectedDraft);
              closeDraft();
            } catch (error) {
              Alert.alert("Draft not deleted", backendErrorMessage(error));
            }
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
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityLabel="Return to profile"
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.58 : 1 },
          ]}>
          <MaterialCommunityIcons
            color={palette.textMuted}
            name="arrow-left"
            size={18}
          />
          <Text style={styles.backLabel}>PROFILE</Text>
        </Pressable>

        <PageHeading
          description="Capture transaction wording, inspect every extracted field, correct uncertainty, and only then move the draft toward confirmation."
          eyebrow="REVIEW / STAGE 5"
          title="Transaction drafts"
        />

        <View style={styles.summaryRail}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{drafts.length}</Text>
            <Text style={styles.summaryLabel}>OPEN</Text>
          </View>
          <View style={styles.summaryRule} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: palette.expense }]}>
              {reviewCount}
            </Text>
            <Text style={styles.summaryLabel}>REVIEW</Text>
          </View>
          <View style={styles.summaryRule} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: palette.income }]}>
              {readyCount}
            </Text>
            <Text style={styles.summaryLabel}>READY</Text>
          </View>
        </View>

        <View style={styles.capturePanel}>
          <View style={styles.captureHeader}>
            <Text style={styles.panelEyebrow}>NEW SOURCE TEXT</Text>
            <Text style={styles.panelBadge}>REVIEW FIRST</Text>
          </View>
          <Text style={styles.captureDescription}>
            Example: “Spent 5k on food yesterday at Mama Put.” Nothing is
            written to the ledger from this field.
          </Text>
          <FinanceField
            label="Transaction wording"
            multiline
            onChangeText={setSourceText}
            placeholder="Describe the transaction naturally"
            value={sourceText}
          />
          <ActionButton
            disabled={!sourceText.trim() || !workspaceId || !user?.uid}
            icon="text-box-search-outline"
            label="Parse into review draft"
            loading={createDraft.isPending}
            onPress={() => void handleCreate()}
          />
        </View>

        <View style={styles.listHeading}>
          <Text style={styles.listTitle}>OPEN REVIEW QUEUE</Text>
          <Pressable
            accessibilityLabel="Refresh transaction drafts"
            accessibilityRole="button"
            disabled={draftsQuery.isRefetching}
            onPress={() => void draftsQuery.refetch()}
            style={({ pressed }) => ({ opacity: pressed ? 0.56 : 1 })}>
            <MaterialCommunityIcons
              color={palette.textMuted}
              name={draftsQuery.isRefetching ? "sync" : "refresh"}
              size={18}
            />
          </Pressable>
        </View>

        {draftsQuery.isLoading ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateTitle}>Loading review queue</Text>
            <Text style={styles.stateCopy}>
              Reading the current workspace drafts.
            </Text>
          </View>
        ) : draftsQuery.error ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateTitle}>Drafts unavailable</Text>
            <Text style={styles.stateCopy}>
              {backendErrorMessage(draftsQuery.error)}
            </Text>
            <ActionButton
              label="Try again"
              onPress={() => void draftsQuery.refetch()}
              tone="quiet"
            />
          </View>
        ) : drafts.length === 0 ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateTitle}>No drafts waiting</Text>
            <Text style={styles.stateCopy}>
              Natural-language captures will appear here before they become
              ledger transactions.
            </Text>
          </View>
        ) : (
          <View style={styles.draftList}>
            {drafts.map((draft) => (
              <DraftCard
                draft={draft}
                key={draft.id}
                onPress={() => openDraft(draft)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <FinanceSheet
        description={selectedDraft?.original_text}
        onClose={closeDraft}
        title="Review extracted fields"
        visible={selectedDraft !== null}>
        {selectedDraft ? (
          <>
            <View style={styles.reviewStatus}>
              <View
                style={[
                  styles.reviewStatusDot,
                  {
                    backgroundColor: lifecycleColor(selectedDraft.lifecycle),
                  },
                ]}
              />
              <View style={styles.reviewStatusCopy}>
                <Text style={styles.reviewStatusTitle}>
                  {lifecycleLabel(selectedDraft.lifecycle)}
                </Text>
                <Text style={styles.reviewStatusDescription}>
                  {selectedDraft.missing_fields.length > 0
                    ? `Review: ${selectedDraft.missing_fields.join(", ")}`
                    : "All required fields are present."}
                </Text>
              </View>
              <Text style={styles.reviewConfidence}>
                {Math.round(selectedDraft.overall_confidence * 100)}%
              </Text>
            </View>

            <View style={styles.typeGroup}>
              <Text style={styles.fieldLabel}>TRANSACTION TYPE</Text>
              <View style={styles.typeRow}>
                {(["Expenditure", "Revenue"] as const).map((type) => {
                  const selected = form.type === type;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={type}
                      onPress={() =>
                        setForm((current) => ({ ...current, type }))
                      }
                      style={({ pressed }) => [
                        styles.typeButton,
                        selected ? styles.typeButtonSelected : null,
                        { opacity: pressed ? 0.62 : 1 },
                      ]}>
                      <Text
                        style={[
                          styles.typeButtonText,
                          selected ? styles.typeButtonTextSelected : null,
                        ]}>
                        {type === "Expenditure" ? "Expense" : "Income"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldGrid}>
              <FinanceField
                keyboardType="decimal-pad"
                label="Amount"
                onChangeText={(amount) =>
                  setForm((current) => ({ ...current, amount }))
                }
                placeholder="0.00"
                value={form.amount}
              />
              <FinanceField
                autoCapitalize="characters"
                label="Currency"
                maxLength={3}
                onChangeText={(currency) =>
                  setForm((current) => ({ ...current, currency }))
                }
                placeholder="NGN"
                value={form.currency}
              />
              <FinanceField
                label="Date"
                onChangeText={(date) =>
                  setForm((current) => ({ ...current, date }))
                }
                placeholder="YYYY-MM-DD"
                value={form.date}
              />
              <FinanceField
                autoCapitalize="none"
                label="Category key"
                onChangeText={(category) =>
                  setForm((current) => ({ ...current, category }))
                }
                placeholder="food"
                value={form.category}
              />
              <FinanceField
                label="Merchant"
                onChangeText={(merchant) =>
                  setForm((current) => ({ ...current, merchant }))
                }
                placeholder="Optional merchant"
                value={form.merchant}
              />
              <FinanceField
                label="Description"
                multiline
                onChangeText={(description) =>
                  setForm((current) => ({ ...current, description }))
                }
                placeholder="Optional note"
                value={form.description}
              />
            </View>

            <ActionButton
              icon="content-save-outline"
              label="Save reviewed fields"
              loading={correctDraft.isPending}
              onPress={() => void handleSaveCorrections()}
            />
            <ActionButton
              disabled={selectedDraft.missing_fields.length > 0}
              icon="check-decagram-outline"
              label="Mark ready for confirmation"
              loading={markReady.isPending}
              onPress={() => void handleMarkReady()}
              tone="quiet"
            />
            <ActionButton
              icon="trash-can-outline"
              label="Delete draft"
              loading={deleteDraft.isPending}
              onPress={handleDelete}
              tone="danger"
            />
          </>
        ) : null}
      </FinanceSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 24,
    paddingBottom: 48,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: palette.line,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    minHeight: 38,
    paddingHorizontal: 12,
  },
  backLabel: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 0.8,
  },
  summaryRail: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    padding: 16,
  },
  summaryItem: { alignItems: "center", flex: 1, gap: 4 },
  summaryValue: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 24,
  },
  summaryLabel: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.8,
  },
  summaryRule: { backgroundColor: palette.line, height: 32, width: 1 },
  capturePanel: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: 20,
    borderWidth: 1,
    gap: 18,
    padding: 18,
  },
  captureHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  panelEyebrow: {
    color: palette.textMuted,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 0.8,
  },
  panelBadge: {
    backgroundColor: withAlpha(palette.signalAmber, 0.12),
    borderColor: withAlpha(palette.signalAmber, 0.35),
    borderRadius: 999,
    borderWidth: 1,
    color: palette.signalAmber,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.7,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  captureDescription: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
  listHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  listTitle: {
    color: palette.textMuted,
    fontFamily: fonts.ledger,
    fontSize: 9,
    letterSpacing: 0.9,
  },
  draftList: { gap: 12 },
  draftCard: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  draftTopline: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statusGroup: { alignItems: "center", flexDirection: "row", gap: 7 },
  statusDot: { borderRadius: 999, height: 7, width: 7 },
  statusText: {
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.75,
  },
  confidence: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.6,
  },
  draftText: {
    color: palette.text,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  draftFooter: {
    alignItems: "center",
    borderTopColor: palette.line,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  draftMeta: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.65,
  },
  statePanel: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 20,
  },
  stateTitle: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 20,
  },
  stateCopy: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
  reviewStatus: {
    alignItems: "center",
    backgroundColor: palette.surfaceRaised,
    borderColor: palette.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  reviewStatusDot: { borderRadius: 999, height: 9, width: 9 },
  reviewStatusCopy: { flex: 1, gap: 3 },
  reviewStatusTitle: {
    color: palette.text,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "700",
  },
  reviewStatusDescription: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
  },
  reviewConfidence: {
    color: palette.textMuted,
    fontFamily: fonts.ledger,
    fontSize: 9,
  },
  typeGroup: { gap: 8 },
  fieldLabel: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 0.75,
  },
  typeRow: { flexDirection: "row", gap: 10 },
  typeButton: {
    alignItems: "center",
    borderColor: palette.lineStrong,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
  },
  typeButtonSelected: {
    backgroundColor: palette.text,
    borderColor: palette.text,
  },
  typeButtonText: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "700",
  },
  typeButtonTextSelected: { color: palette.black },
  fieldGrid: { gap: 18 },
});
