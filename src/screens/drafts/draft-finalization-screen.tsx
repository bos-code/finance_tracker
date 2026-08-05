import { ActionButton } from "@/components/finance/action-button";
import { FinanceField } from "@/components/finance/finance-field";
import { FinanceSheet } from "@/components/finance/finance-sheet";
import { PageHeading } from "@/components/finance/page-heading";
import { Screen } from "@/components/ui/screen";
import { SignalThreads } from "@/components/visuals/signal-threads";
import type { TransactionDraftContract } from "@/contracts/backend";
import { useOffline } from "@/context/offline-context";
import { useAuth } from "@/hooks/use-auth";
import { useFinalizeTransactionDraft } from "@/hooks/use-finalize-transaction-draft";
import { useTransactionDrafts } from "@/hooks/use-transaction-drafts";
import { useWorkspace } from "@/hooks/use-workspace";
import { backendErrorMessage } from "@/services/backend/errors";
import { palette, withAlpha } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

function fieldText(draft: TransactionDraftContract, fieldName: string) {
  const value = draft.extracted_fields[fieldName]?.value;
  return value === null || value === undefined ? "—" : String(value);
}

function draftCurrency(draft: TransactionDraftContract) {
  return fieldText(draft, "currency_code").toUpperCase();
}

function DraftReadyCard({
  baseCurrency,
  draft,
  disabled,
  onPress,
}: {
  baseCurrency: string;
  draft: TransactionDraftContract;
  disabled: boolean;
  onPress: () => void;
}) {
  const currency = draftCurrency(draft);
  const crossCurrency = currency !== baseCurrency;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        disabled ? styles.cardDisabled : null,
        { opacity: pressed ? 0.62 : 1 },
      ]}>
      <View style={styles.cardTopline}>
        <View style={styles.readyGroup}>
          <View style={styles.readyDot} />
          <Text style={styles.readyLabel}>READY</Text>
        </View>
        <Text style={styles.sourceLabel}>
          {draft.source.replaceAll("_", " ").toLocaleUpperCase()}
        </Text>
      </View>

      <View style={styles.amountRow}>
        <Text style={styles.amount}>
          {currency} {fieldText(draft, "amount")}
        </Text>
        <Text style={styles.type}>{fieldText(draft, "type")}</Text>
      </View>

      <Text numberOfLines={2} style={styles.originalText}>
        {draft.original_text}
      </Text>

      <View style={styles.detailGrid}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>DATE</Text>
          <Text style={styles.detailValue}>
            {fieldText(draft, "transaction_date")}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>CATEGORY</Text>
          <Text style={styles.detailValue}>
            {fieldText(draft, "category_key")}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text
          style={[
            styles.currencyStatus,
            crossCurrency ? styles.currencyStatusManual : null,
          ]}>
          {crossCurrency
            ? `MANUAL ${currency} → ${baseCurrency} RATE REQUIRED`
            : `${baseCurrency} BASE / RATE 1`}
        </Text>
        <MaterialCommunityIcons
          color={palette.textQuiet}
          name="arrow-right"
          size={18}
        />
      </View>
    </Pressable>
  );
}

export function DraftFinalizationScreen() {
  const { user } = useAuth();
  const { activeAccount, workspace } = useWorkspace();
  const { isOnline } = useOffline();
  const finalizeDraft = useFinalizeTransactionDraft();
  const [selectedDraft, setSelectedDraft] =
    useState<TransactionDraftContract | null>(null);
  const [exchangeRate, setExchangeRate] = useState("");

  const workspaceId = workspace?.id ?? "";
  const draftsQuery = useTransactionDrafts(
    workspaceId,
    { lifecycle: ["pending_confirmation"] },
    !!workspaceId,
  );
  const drafts = draftsQuery.data ?? [];
  const baseCurrency = workspace?.default_currency ?? "";

  const closeRateSheet = () => {
    setSelectedDraft(null);
    setExchangeRate("");
  };

  const runFinalization = async (
    draft: TransactionDraftContract,
    suppliedRate?: number,
  ) => {
    if (!user?.uid || !workspace || !activeAccount) {
      Alert.alert(
        "Workspace not ready",
        "Restore the signed-in workspace and default account before saving.",
      );
      return;
    }
    try {
      const result = await finalizeDraft.mutateAsync({
        accountId: activeAccount.id,
        baseCurrencyCode: workspace.default_currency,
        draft,
        exchangeRate: suppliedRate,
        ownerUserId: user.uid,
        workspaceId: workspace.id,
      });
      closeRateSheet();
      Alert.alert(
        "Saved to ledger",
        `${result.transaction.currency_code} ${result.transaction.amount.toLocaleString()} is now a confirmed transaction.`,
      );
    } catch (error) {
      Alert.alert("Draft not finalized", backendErrorMessage(error));
    }
  };

  const requestFinalization = (draft: TransactionDraftContract) => {
    if (!isOnline) {
      Alert.alert(
        "Connection required",
        "Ready drafts stay safe, but final confirmation needs a permanent server transaction ID.",
      );
      return;
    }
    const currency = draftCurrency(draft);
    if (currency !== baseCurrency) {
      setSelectedDraft(draft);
      setExchangeRate("");
      return;
    }

    Alert.alert(
      "Save this draft to the ledger?",
      "This creates a confirmed transaction. The draft remains linked as review history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save transaction",
          onPress: () => void runFinalization(draft),
        },
      ],
    );
  };

  const saveWithRate = () => {
    if (!selectedDraft) return;
    const parsedRate = Number(exchangeRate.replace(/,/g, "").trim());
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      Alert.alert(
        "Invalid exchange rate",
        `Enter how many ${baseCurrency} equal one ${draftCurrency(selectedDraft)}.`,
      );
      return;
    }
    void runFinalization(selectedDraft, parsedRate);
  };

  return (
    <Screen backgroundColor={palette.canvas} className="px-0">
      <SignalThreads intensity="quiet" />
      <ScrollView
        contentContainerStyle={styles.content}
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
          description="Only reviewed drafts appear here. Finalization creates the permanent ledger record and links the draft to it using an idempotent write."
          eyebrow="CONFIRM / STAGE 5"
          title="Save ready drafts"
        />

        <View
          style={[
            styles.connectionPanel,
            isOnline ? styles.connectionOnline : styles.connectionOffline,
          ]}>
          <MaterialCommunityIcons
            color={isOnline ? palette.income : palette.signalAmber}
            name={isOnline ? "cloud-check-outline" : "cloud-off-outline"}
            size={20}
          />
          <View style={styles.connectionCopy}>
            <Text style={styles.connectionTitle}>
              {isOnline ? "Permanent writes available" : "Finalization paused"}
            </Text>
            <Text style={styles.connectionDescription}>
              {isOnline
                ? `${activeAccount?.name ?? "Default account"} / ${baseCurrency || "base currency"}`
                : "Reconnect to obtain a permanent transaction ID. Draft review remains available offline."}
            </Text>
          </View>
        </View>

        <View style={styles.listHeading}>
          <Text style={styles.listTitle}>READY QUEUE</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{drafts.length}</Text>
          </View>
        </View>

        {draftsQuery.isLoading ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateTitle}>Loading ready drafts</Text>
            <Text style={styles.stateCopy}>
              Checking the current workspace confirmation queue.
            </Text>
          </View>
        ) : draftsQuery.error ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateTitle}>Ready drafts unavailable</Text>
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
            <Text style={styles.stateTitle}>Nothing ready to save</Text>
            <Text style={styles.stateCopy}>
              Review extracted fields first. Complete drafts move here only after
              every required field has been confirmed.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {drafts.map((draft) => (
              <DraftReadyCard
                baseCurrency={baseCurrency}
                disabled={finalizeDraft.isPending}
                draft={draft}
                key={draft.id}
                onPress={() => requestFinalization(draft)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <FinanceSheet
        description={
          selectedDraft
            ? `Enter the rate manually. No market rate is guessed: 1 ${draftCurrency(selectedDraft)} equals how many ${baseCurrency}?`
            : undefined
        }
        onClose={closeRateSheet}
        title="Confirm exchange rate"
        visible={selectedDraft !== null}>
        {selectedDraft ? (
          <>
            <View style={styles.rateSummary}>
              <Text style={styles.rateAmount}>
                {draftCurrency(selectedDraft)} {fieldText(selectedDraft, "amount")}
              </Text>
              <Text style={styles.rateDirection}>
                ORIGINAL → {baseCurrency} BASE
              </Text>
            </View>
            <FinanceField
              autoFocus
              keyboardType="decimal-pad"
              label={`1 ${draftCurrency(selectedDraft)} in ${baseCurrency}`}
              onChangeText={setExchangeRate}
              placeholder="0.00000000"
              value={exchangeRate}
            />
            <Text style={styles.rateNotice}>
              The app stores the supplied rate with the transaction. Review it
              carefully before saving.
            </Text>
            <ActionButton
              disabled={!exchangeRate.trim() || !isOnline}
              icon="check-decagram-outline"
              label="Save transaction with this rate"
              loading={finalizeDraft.isPending}
              onPress={saveWithRate}
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
  connectionPanel: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 13,
    padding: 16,
  },
  connectionOnline: {
    backgroundColor: withAlpha(palette.income, 0.08),
    borderColor: withAlpha(palette.income, 0.28),
  },
  connectionOffline: {
    backgroundColor: withAlpha(palette.signalAmber, 0.08),
    borderColor: withAlpha(palette.signalAmber, 0.28),
  },
  connectionCopy: { flex: 1, gap: 4 },
  connectionTitle: {
    color: palette.text,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "700",
  },
  connectionDescription: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
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
  countBadge: {
    alignItems: "center",
    backgroundColor: palette.surfaceRaised,
    borderColor: palette.line,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 26,
    minWidth: 26,
    paddingHorizontal: 7,
  },
  countText: {
    color: palette.textMuted,
    fontFamily: fonts.ledger,
    fontSize: 8,
  },
  list: { gap: 12 },
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    padding: 17,
  },
  cardDisabled: { opacity: 0.52 },
  cardTopline: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  readyGroup: { alignItems: "center", flexDirection: "row", gap: 7 },
  readyDot: {
    backgroundColor: palette.income,
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  readyLabel: {
    color: palette.income,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.75,
  },
  sourceLabel: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.6,
  },
  amountRow: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  amount: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 25,
  },
  type: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  originalText: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
  detailGrid: { flexDirection: "row", gap: 10 },
  detailItem: {
    backgroundColor: palette.surfaceRaised,
    borderColor: palette.line,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    padding: 11,
  },
  detailLabel: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.7,
  },
  detailValue: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  cardFooter: {
    alignItems: "center",
    borderTopColor: palette.line,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 13,
  },
  currencyStatus: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.6,
  },
  currencyStatusManual: { color: palette.signalAmber },
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
  rateSummary: {
    backgroundColor: palette.surfaceRaised,
    borderColor: palette.line,
    borderRadius: 16,
    borderWidth: 1,
    gap: 5,
    padding: 15,
  },
  rateAmount: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 22,
  },
  rateDirection: {
    color: palette.signalAmber,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.7,
  },
  rateNotice: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 17,
  },
});
