import { PageHeading } from "@/components/finance/page-heading";
import { PeriodNavigator } from "@/components/finance/period-navigator";
import { SegmentedControl } from "@/components/finance/segmented-control";
import { StatePanel } from "@/components/finance/state-panel";
import { SummaryRail } from "@/components/finance/summary-rail";
import { Screen } from "@/components/ui/screen";
import { SignalThreads } from "@/components/visuals/signal-threads";
import { ALL_CATEGORIES } from "@/constants/categories";
import { useTransactions } from "@/hooks/use-transactions";
import {
  calcCategoryBreakdown,
  calcMonthSummary,
  transactionsForBaseCurrency,
  type Transaction,
  type TransactionType,
} from "@/services/supabase/transaction-service";
import { useAppStore } from "@/store/use-app-store";
import { palette, withAlpha } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import {
  formatCompactMoney,
  formatMoney,
  type DisplayCurrency,
} from "@/utils/money";
import * as Haptics from "expo-haptics";
import { useCallback, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type PeriodMode = "month" | "year";

type TrendPoint = {
  accessibilityLabel: string;
  label: string;
  value: number;
};

const PERIOD_OPTIONS = [
  { label: "Month", value: "month" },
  { label: "Year", value: "year" },
] satisfies { label: string; value: PeriodMode }[];

const FLOW_OPTIONS = [
  { label: "Outflow", value: "Expenditure" },
  { label: "Income", value: "Revenue" },
] satisfies { label: string; value: TransactionType }[];

const CATEGORY_SIGNALS = [
  palette.signalAmber,
  palette.signalViolet,
  palette.signalCyan,
  palette.signalMoss,
];

const EMPTY_TRANSACTIONS: Transaction[] = [];

function buildTrend(
  transactions: Transaction[],
  type: TransactionType,
  mode: PeriodMode,
  year: number,
  month: number,
): TrendPoint[] {
  const matching = transactions.filter((transaction) => transaction.type === type);

  if (mode === "year") {
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const values = Array.from({ length: 12 }, () => 0);
    for (const transaction of matching) {
      const transactionMonth = Number(transaction.transaction_date.slice(5, 7));
      if (transactionMonth >= 1 && transactionMonth <= 12) {
        values[transactionMonth - 1] += transaction.amount;
      }
    }
    return values.map((value, index) => ({
      accessibilityLabel: `${monthNames[index]} ${year}`,
      label: monthNames[index],
      value,
    }));
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const bucketCount = Math.ceil(daysInMonth / 7);
  const values = Array.from({ length: bucketCount }, () => 0);
  for (const transaction of matching) {
    const day = Number(transaction.transaction_date.slice(8, 10));
    const bucket = Math.min(Math.floor((day - 1) / 7), bucketCount - 1);
    if (bucket >= 0) values[bucket] += transaction.amount;
  }
  return values.map((value, index) => {
    const startDay = index * 7 + 1;
    const endDay = Math.min(startDay + 6, daysInMonth);
    return {
      accessibilityLabel: `Days ${startDay} to ${endDay}`,
      label: `W${index + 1}`,
      value,
    };
  });
}

function SectionHeading({
  index,
  label,
}: {
  index: string;
  label: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionIndex}>{index}</Text>
      <View style={styles.sectionRule} />
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

function TrendStripes({
  accent,
  currency,
  data,
}: {
  accent: string;
  currency: DisplayCurrency;
  data: TrendPoint[];
}) {
  const max = Math.max(...data.map((point) => point.value), 1);
  const maxIndex = data.reduce(
    (largest, point, index) =>
      point.value > data[largest].value ? index : largest,
    0,
  );

  return (
    <View style={styles.trendPanel}>
      <View style={styles.trendGrid} pointerEvents="none">
        <View style={styles.trendGridLine} />
        <View style={styles.trendGridLine} />
        <View style={styles.trendGridLine} />
      </View>
      <View style={styles.trendRow}>
        {data.map((point, index) => {
          const height = point.value > 0 ? Math.max(4, (point.value / max) * 94) : 1;
          return (
            <View
              accessibilityLabel={`${point.accessibilityLabel}, ${formatMoney(point.value, currency)}`}
              accessible
              key={point.accessibilityLabel}
              style={styles.trendItem}>
              <Text numberOfLines={1} style={styles.trendAmount}>
                {point.value > 0 ? formatCompactMoney(point.value, currency) : "—"}
              </Text>
              <View style={styles.stripeTrack}>
                <View
                  style={[
                    styles.stripe,
                    {
                      backgroundColor:
                        index === maxIndex ? accent : palette.lineStrong,
                      height,
                    },
                  ]}
                />
              </View>
              <Text style={styles.trendLabel}>{point.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function StatsScreen() {
  const currency = useAppStore((state) => state.currency);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [flowType, setFlowType] =
    useState<TransactionType>("Expenditure");
  const [currentDate, setCurrentDate] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );

  const year = currentDate.getFullYear();
  const calendarMonth = currentDate.getMonth() + 1;
  const queryMonth = periodMode === "month" ? calendarMonth : undefined;
  const previousDate = useMemo(
    () =>
      periodMode === "month"
        ? new Date(year, calendarMonth - 2, 1)
        : new Date(year - 1, 0, 1),
    [calendarMonth, periodMode, year],
  );
  const previousYear = previousDate.getFullYear();
  const previousMonth =
    periodMode === "month" ? previousDate.getMonth() + 1 : undefined;

  const currentQuery = useTransactions(year, queryMonth);
  const previousQuery = useTransactions(previousYear, previousMonth);
  const allTransactions = currentQuery.data ?? EMPTY_TRANSACTIONS;
  const allPreviousTransactions = previousQuery.data ?? EMPTY_TRANSACTIONS;
  const transactions = useMemo(
    () => transactionsForBaseCurrency(allTransactions, currency.code),
    [allTransactions, currency.code],
  );
  const previousTransactions = useMemo(
    () =>
      transactionsForBaseCurrency(allPreviousTransactions, currency.code),
    [allPreviousTransactions, currency.code],
  );

  const summary = useMemo(
    () => calcMonthSummary(transactions),
    [transactions],
  );
  const previousSummary = useMemo(
    () => calcMonthSummary(previousTransactions),
    [previousTransactions],
  );
  const breakdown = useMemo(
    () => calcCategoryBreakdown(transactions, flowType),
    [flowType, transactions],
  );
  const trend = useMemo(
    () =>
      buildTrend(transactions, flowType, periodMode, year, calendarMonth),
    [calendarMonth, flowType, periodMode, transactions, year],
  );

  const isOutflow = flowType === "Expenditure";
  const activeTotal = isOutflow
    ? summary.totalExpenditure
    : summary.totalRevenue;
  const previousTotal = isOutflow
    ? previousSummary.totalExpenditure
    : previousSummary.totalRevenue;
  const activeCount = transactions.filter(
    (transaction) => transaction.type === flowType,
  ).length;

  const comparison = useMemo(() => {
    if (previousQuery.isError) return "Prior-period comparison unavailable";
    if (previousQuery.isLoading) return "Reading prior-period baseline";
    if (previousTotal <= 0) return "No prior-period baseline";
    const change = ((activeTotal - previousTotal) / previousTotal) * 100;
    const sign = change > 0 ? "+" : change < 0 ? "−" : "";
    return `${sign}${Math.abs(change).toFixed(1)}% vs previous ${periodMode}`;
  }, [
    activeTotal,
    periodMode,
    previousQuery.isError,
    previousQuery.isLoading,
    previousTotal,
  ]);

  const periodLabel =
    periodMode === "month"
      ? currentDate.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })
      : String(year);
  const largestCategory = breakdown[0];
  const largestCategoryLabel = largestCategory
    ? (ALL_CATEGORIES[largestCategory.category_id]?.label ??
      largestCategory.category_id)
    : null;
  const flowLabel = isOutflow ? "outflow" : "income";
  const accent = isOutflow ? palette.signalAmber : palette.signalMoss;

  const changeDate = useCallback(
    (offset: number) => {
      setCurrentDate((current) =>
        periodMode === "month"
          ? new Date(current.getFullYear(), current.getMonth() + offset, 1)
          : new Date(current.getFullYear() + offset, 0, 1),
      );
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [periodMode],
  );

  const choosePeriod = useCallback((nextMode: PeriodMode) => {
    setPeriodMode(nextMode);
    void Haptics.selectionAsync();
  }, []);

  const chooseFlow = useCallback((nextFlow: TransactionType) => {
    setFlowType(nextFlow);
    void Haptics.selectionAsync();
  }, []);

  const refresh = useCallback(() => {
    void Promise.all([currentQuery.refetch(), previousQuery.refetch()]);
  }, [currentQuery, previousQuery]);

  return (
    <Screen backgroundColor={palette.canvas} className="px-0">
      <SignalThreads intensity="quiet" />
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            colors={[palette.textMuted]}
            onRefresh={refresh}
            refreshing={currentQuery.isRefetching}
            tintColor={palette.textMuted}
          />
        }
        showsVerticalScrollIndicator={false}>
        <PageHeading
          description={`Read the pattern behind the ledger. Figures use only records stored in the ${currency.code} reporting base.`}
          eyebrow="ANALYSIS / PERSONAL"
          title="Insights"
        />

        <SegmentedControl
          accessibilityLabel="Insight period"
          onChange={choosePeriod}
          options={PERIOD_OPTIONS}
          value={periodMode}
        />
        <PeriodNavigator
          label={periodLabel}
          onNext={() => changeDate(1)}
          onPrevious={() => changeDate(-1)}
        />
        <SummaryRail
          items={[
            {
              label: "NET",
              tone: summary.remaining >= 0 ? "income" : "expense",
              value: formatCompactMoney(summary.remaining, currency),
            },
            {
              label: "INCOME",
              tone: "income",
              value: formatCompactMoney(summary.totalRevenue, currency),
            },
            {
              label: "OUTFLOW",
              tone: "expense",
              value: formatCompactMoney(summary.totalExpenditure, currency),
            },
          ]}
        />

        <View style={styles.flowControl}>
          <SegmentedControl
            accessibilityLabel="Insight flow type"
            onChange={chooseFlow}
            options={FLOW_OPTIONS}
            value={flowType}
          />
        </View>

        {currentQuery.isLoading ? (
          <StatePanel
            description="Calculating totals and distribution from your ledger."
            loading
            title="Building this view"
          />
        ) : currentQuery.isError ? (
          <StatePanel
            actionLabel="Retry"
            description="The underlying entries remain unchanged."
            onAction={refresh}
            title="Insights unavailable"
          />
        ) : (
          <>
            <View style={styles.focusPanel}>
              <View style={[styles.focusSignal, { backgroundColor: accent }]} />
              <Text style={styles.focusEyebrow}>
                TOTAL {flowLabel.toLocaleUpperCase()} / {periodLabel.toLocaleUpperCase()}
              </Text>
              <Text
                accessibilityLabel={`Total ${flowLabel}, ${formatMoney(activeTotal, currency)}`}
                adjustsFontSizeToFit
                numberOfLines={1}
                style={styles.focusAmount}>
                {formatMoney(activeTotal, currency)}
              </Text>
              <View style={styles.focusMetaRow}>
                <Text style={styles.focusMeta}>
                  {activeCount} {activeCount === 1 ? "entry" : "entries"}
                </Text>
                <View style={styles.focusMetaRule} />
                <Text style={styles.focusMeta}>{comparison}</Text>
              </View>
            </View>

            <SectionHeading index="01" label="MOVEMENT" />
            {activeTotal > 0 ? (
              <TrendStripes
                accent={accent}
                currency={currency}
                data={trend}
              />
            ) : (
              <StatePanel
                description={`Record ${flowLabel} in this period to reveal its movement.`}
                title="Not enough signal yet"
              />
            )}

            <SectionHeading index="02" label="DISTRIBUTION" />
            {breakdown.length === 0 ? (
              <StatePanel
                description={`There is no ${flowLabel} to rank for ${periodLabel}.`}
                title="No categories to compare"
              />
            ) : (
              <View style={styles.distributionPanel}>
                <View
                  accessibilityLabel={`${flowLabel} distribution by category`}
                  accessible
                  style={styles.distributionRail}>
                  {breakdown.map((item, index) => (
                    <View
                      key={item.category_id}
                      style={{
                        backgroundColor:
                          CATEGORY_SIGNALS[index % CATEGORY_SIGNALS.length],
                        flex: item.percentage,
                      }}
                    />
                  ))}
                </View>

                {breakdown.map((item, index) => {
                  const category = ALL_CATEGORIES[item.category_id];
                  return (
                    <View key={item.category_id} style={styles.categoryRow}>
                      <Text style={styles.categoryRank}>
                        {(index + 1).toString().padStart(2, "0")}
                      </Text>
                      <View
                        style={[
                          styles.categorySignal,
                          {
                            backgroundColor:
                              CATEGORY_SIGNALS[index % CATEGORY_SIGNALS.length],
                          },
                        ]}
                      />
                      <View style={styles.categoryCopy}>
                        <Text style={styles.categoryName}>
                          {category?.label ?? item.category_id}
                        </Text>
                        <Text style={styles.categoryShare}>
                          {item.percentage.toFixed(1)}% OF {flowLabel.toLocaleUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.categoryAmount}>
                        {formatMoney(item.total, currency)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            <SectionHeading index="03" label="READOUT" />
            <View style={styles.readout}>
              <View style={styles.readoutThread} />
              <Text style={styles.readoutTitle}>What the ledger says</Text>
              {largestCategory && largestCategoryLabel ? (
                <Text style={styles.readoutBody}>
                  {largestCategoryLabel} is the largest {flowLabel} category at {largestCategory.percentage.toFixed(1)}%, or {formatMoney(largestCategory.total, currency)}.
                </Text>
              ) : (
                <Text style={styles.readoutBody}>
                  This period does not yet contain enough {flowLabel} to identify a leading category.
                </Text>
              )}
              <View style={styles.readoutDivider} />
              <Text style={styles.readoutBody}>
                {summary.remaining === 0
                  ? `Net movement is neutral at ${formatMoney(0, currency)} for ${periodLabel}.`
                  : `Net movement is ${summary.remaining > 0 ? "positive" : "negative"} by ${formatMoney(Math.abs(summary.remaining), currency)} for ${periodLabel}.`}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
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
  flowControl: { marginBottom: 18, marginTop: 10 },
  focusPanel: {
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    minHeight: 190,
    paddingBottom: 26,
    paddingTop: 18,
  },
  focusSignal: { height: 1, marginBottom: 20, width: 64 },
  focusEyebrow: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 0.75,
  },
  focusAmount: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 42,
    letterSpacing: -1,
    marginTop: 9,
  },
  focusMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  focusMeta: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 10,
  },
  focusMetaRule: { backgroundColor: palette.lineStrong, height: 1, width: 18 },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11,
    minHeight: 72,
  },
  sectionIndex: {
    color: palette.signalCyan,
    fontFamily: fonts.ledger,
    fontSize: 8,
  },
  sectionRule: { backgroundColor: palette.lineStrong, height: 1, width: 28 },
  sectionLabel: {
    color: palette.textMuted,
    fontFamily: fonts.ledger,
    fontSize: 9,
    letterSpacing: 0.9,
  },
  trendPanel: {
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    height: 176,
    justifyContent: "flex-end",
    position: "relative",
  },
  trendGrid: {
    bottom: 32,
    justifyContent: "space-between",
    left: 0,
    position: "absolute",
    right: 0,
    top: 28,
  },
  trendGridLine: { backgroundColor: withAlpha(palette.line, 0.7), height: 1 },
  trendRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    height: 160,
    justifyContent: "space-around",
  },
  trendItem: { alignItems: "center", flex: 1, minWidth: 0 },
  trendAmount: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 6,
    height: 14,
    maxWidth: "96%",
  },
  stripeTrack: {
    alignItems: "center",
    height: 100,
    justifyContent: "flex-end",
    width: 12,
  },
  stripe: { borderRadius: 2, width: 2 },
  trendLabel: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    marginTop: 9,
  },
  distributionPanel: {
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
  },
  distributionRail: {
    flexDirection: "row",
    height: 3,
    marginBottom: 12,
    overflow: "hidden",
  },
  categoryRow: {
    alignItems: "center",
    borderTopColor: palette.line,
    borderTopWidth: 1,
    flexDirection: "row",
    minHeight: 70,
  },
  categoryRank: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 8,
    width: 26,
  },
  categorySignal: { height: 30, marginRight: 12, width: 1 },
  categoryCopy: { flex: 1, gap: 4, marginRight: 12 },
  categoryName: {
    color: palette.text,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "600",
  },
  categoryShare: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.25,
  },
  categoryAmount: {
    color: palette.text,
    fontFamily: fonts.ledger,
    fontSize: 10,
    textAlign: "right",
  },
  readout: {
    backgroundColor: withAlpha(palette.white, 0.025),
    borderColor: palette.line,
    borderCurve: "continuous",
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
  },
  readoutThread: {
    backgroundColor: palette.signalViolet,
    height: 1,
    marginBottom: 18,
    width: 52,
  },
  readoutTitle: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 21,
    marginBottom: 10,
  },
  readoutBody: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 19,
  },
  readoutDivider: {
    backgroundColor: palette.line,
    height: 1,
    marginVertical: 14,
  },
});
