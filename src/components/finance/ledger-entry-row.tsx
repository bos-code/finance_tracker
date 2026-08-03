import { ALL_CATEGORIES } from "@/constants/categories";
import type { Transaction } from "@/services/supabase/transaction-service";
import { palette } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import {
  displayCurrencyForCode,
  formatMoney,
  type DisplayCurrency,
} from "@/utils/money";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function LedgerEntryRow({
  currency,
  onPress,
  transaction,
}: {
  currency: DisplayCurrency;
  onPress?: () => void;
  transaction: Transaction;
}) {
  const category = ALL_CATEGORIES[transaction.category_id];
  const transactionCurrency = displayCurrencyForCode(
    transaction.currency_code || currency.code,
  );
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
  ).toLocaleDateString("en-US", { day: "numeric", month: "short" });

  return (
    <Pressable
      accessibilityLabel={`${transaction.note || category?.label || "Transaction"}, ${formatMoney(transaction.amount, transactionCurrency)}${syncLabel ? `, sync status ${syncLabel.toLocaleLowerCase()}` : ""}`}
      accessibilityRole={onPress != null ? "button" : undefined}
      disabled={onPress == null}
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { opacity: pressed ? 0.62 : 1 },
      ]}>
      <View
        style={[
          styles.signal,
          {
            backgroundColor: isIncome ? palette.income : palette.expense,
          },
        ]}
      />
      <View style={styles.icon}>
        <MaterialCommunityIcons
          color={palette.textMuted}
          name={(category?.icon ?? "circle-outline") as never}
          size={18}
        />
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.name}>
          {transaction.note || category?.label || "Unlabelled entry"}
        </Text>
        <Text style={styles.meta}>
          {category?.label ?? "Other"} · {dateLabel}
          {syncLabel ? ` · ${syncLabel}` : ""}
        </Text>
      </View>
      <Text
        style={[
          styles.amount,
          { color: isIncome ? palette.income : palette.text },
        ]}>
        {isIncome ? "+" : "−"}
        {formatMoney(transaction.amount, transactionCurrency)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 70,
    paddingHorizontal: 14,
  },
  signal: { height: 28, marginRight: 11, width: 1 },
  icon: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 12,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    marginRight: 11,
    width: 36,
  },
  copy: { flex: 1, gap: 4, marginRight: 8 },
  name: {
    color: palette.text,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "600",
  },
  meta: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 0.35,
  },
  amount: {
    fontFamily: fonts.ledger,
    fontSize: 11,
    textAlign: "right",
  },
});
