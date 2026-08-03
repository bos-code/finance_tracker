import { LedgerEntryRow } from "@/components/finance/ledger-entry-row";
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
  calcDailyTotals,
  calcMonthSummary,
  transactionsForBaseCurrency,
  type Transaction,
} from "@/services/supabase/transaction-service";
import { useAppStore } from "@/store/use-app-store";
import { palette, withAlpha } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { formatCompactMoney, formatMoney } from "@/utils/money";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const DAYS_OF_WEEK = ["M", "T", "W", "T", "F", "S", "S"];

type LedgerMode = "list" | "calendar";
type LedgerFilter = "all" | "income" | "outflow" | "pending";

type CalendarDay = {
  dateKey: string;
  day: number;
  isCurrentMonth: boolean;
};

type LedgerSection = {
  data: Transaction[];
  key: string;
  title: string;
};

const MODE_OPTIONS = [
  { label: "List", value: "list" },
  { label: "Calendar", value: "calendar" },
] satisfies { label: string; value: LedgerMode }[];

const FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Income", value: "income" },
  { label: "Outflow", value: "outflow" },
  { label: "Pending", value: "pending" },
] satisfies { label: string; value: LedgerFilter }[];

function dateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateKeyFor(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function sectionTitle(dateKey: string) {
  return dateFromKey(dateKey).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
}

function buildCalendarDays(year: number, month: number): CalendarDay[] {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const mondayOffset = (firstWeekday + 6) % 7;
  const firstGridDate = new Date(year, month - 1, 1 - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      firstGridDate.getFullYear(),
      firstGridDate.getMonth(),
      firstGridDate.getDate() + index,
    );
    return {
      dateKey: dateKeyFor(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
      ),
      day: date.getDate(),
      isCurrentMonth:
        date.getFullYear() === year && date.getMonth() + 1 === month,
    };
  });
}

function isPendingTransaction(transaction: Transaction) {
  return transaction.sync_state !== "synced";
}

function CalendarGrid({
  currency,
  dailyTotals,
  days,
  onSelectDay,
  selectedDay,
}: {
  currency: ReturnType<typeof useAppStore.getState>["currency"];
  dailyTotals: ReturnType<typeof calcDailyTotals>;
  days: CalendarDay[];
  onSelectDay: (dateKey: string) => void;
  selectedDay: string | null;
}) {
  const today = new Date();
  const todayKey = dateKeyFor(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate(),
  );

  return (
    <View style={styles.calendarPanel}>
      <View style={styles.weekdays}>
        {DAYS_OF_WEEK.map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.weekday}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.calendarGrid}>
        {days.map((item) => {
          const totals = dailyTotals[item.dateKey];
          const net = totals ? totals.revenue - totals.expenditure : 0;
          const isSelected = selectedDay === item.dateKey;
          const isToday = todayKey === item.dateKey;

          return (
            <Pressable
              accessibilityLabel={`${dateFromKey(item.dateKey).toLocaleDateString("en-US", {
                day: "numeric",
                month: "long",
              })}${totals ? `, net ${formatMoney(net, currency)}` : ", no entries"}`}
              accessibilityRole="button"
              accessibilityState={{
                disabled: !item.isCurrentMonth,
                selected: isSelected,
              }}
              disabled={!item.isCurrentMonth}
              key={item.dateKey}
              onPress={() => onSelectDay(item.dateKey)}
              style={({ pressed }) => [
                styles.calendarCell,
                isSelected ? styles.calendarCellSelected : null,
                { opacity: pressed ? 0.58 : item.isCurrentMonth ? 1 : 0.28 },
              ]}>
              <View
                style={[
                  styles.dayNumberWrap,
                  isToday ? styles.todayNumberWrap : null,
                ]}>
                <Text
                  style={[
                    styles.dayNumber,
                    isToday ? styles.todayNumber : null,
                  ]}>
                  {item.day}
                </Text>
              </View>
              {totals ? (
                <View style={styles.dayTotalWrap}>
                  <View
                    style={[
                      styles.daySignal,
                      {
                        backgroundColor:
                          net >= 0 ? palette.income : palette.expense,
                      },
                    ]}
                  />
                  <Text numberOfLines={1} style={styles.dayTotal}>
                    {formatCompactMoney(Math.abs(net), currency)}
                  </Text>
                </View>
              ) : (
                <View style={styles.emptyDaySignal} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function CalendarScreen() {
  const currency = useAppStore((state) => state.currency);
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [mode, setMode] = useState<LedgerMode>("list");
  const [filter, setFilter] = useState<LedgerFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + 1;
  const {
    data: transactions = [],
    isError,
    isLoading,
    isRefetching,
    refetch,
  } = useTransactions(year, month);

  const baseTransactions = useMemo(
    () => transactionsForBaseCurrency(transactions, currency.code),
    [currency.code, transactions],
  );
  const summary = useMemo(
    () => calcMonthSummary(baseTransactions),
    [baseTransactions],
  );
  const dailyTotals = useMemo(
    () => calcDailyTotals(baseTransactions),
    [baseTransactions],
  );
  const calendarDays = useMemo(
    () => buildCalendarDays(year, month),
    [month, year],
  );

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return [...transactions]
      .filter((transaction) => {
        if (filter === "income" && transaction.type !== "Revenue") return false;
        if (filter === "outflow" && transaction.type !== "Expenditure") {
          return false;
        }
        if (filter === "pending" && !isPendingTransaction(transaction)) {
          return false;
        }
        if (!query) return true;

        const category = ALL_CATEGORIES[transaction.category_id]?.label ?? "";
        return [
          transaction.note,
          category,
          transaction.type,
          String(transaction.amount),
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query);
      })
      .sort((first, second) =>
        `${second.transaction_date}-${second.created_at}`.localeCompare(
          `${first.transaction_date}-${first.created_at}`,
        ),
      );
  }, [filter, search, transactions]);

  const sections = useMemo<LedgerSection[]>(() => {
    const grouped = new Map<string, Transaction[]>();
    for (const transaction of filteredTransactions) {
      const key = transaction.transaction_date.slice(0, 10);
      const existing = grouped.get(key) ?? [];
      existing.push(transaction);
      grouped.set(key, existing);
    }

    return [...grouped.entries()].map(([key, data]) => ({
      data,
      key,
      title: sectionTitle(key),
    }));
  }, [filteredTransactions]);

  const selectedDayTransactions = useMemo(
    () =>
      filteredTransactions.filter(
        (transaction) =>
          transaction.transaction_date.slice(0, 10) === selectedDay,
      ),
    [filteredTransactions, selectedDay],
  );

  const monthLabel = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const changeMonth = useCallback(
    (offset: number) => {
      setCurrentMonth(new Date(year, month - 1 + offset, 1));
      setSelectedDay(null);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [month, year],
  );

  const chooseMode = useCallback((nextMode: LedgerMode) => {
    setMode(nextMode);
    void Haptics.selectionAsync();
  }, []);

  const chooseFilter = useCallback((nextFilter: LedgerFilter) => {
    setFilter(nextFilter);
    void Haptics.selectionAsync();
  }, []);

  const chooseDay = useCallback((dateKey: string) => {
    setSelectedDay((current) => (current === dateKey ? null : dateKey));
    void Haptics.selectionAsync();
  }, []);

  const header = (
    <View style={styles.headerContent}>
      <PageHeading
        description={`Search every original-currency entry. Summary and calendar signals use the ${currency.code} reporting base.`}
        eyebrow="RECORD / PERSONAL"
        title="Ledger"
      />
      <SegmentedControl
        accessibilityLabel="Ledger view"
        onChange={chooseMode}
        options={MODE_OPTIONS}
        value={mode}
      />
      <PeriodNavigator
        label={monthLabel}
        onNext={() => changeMonth(1)}
        onPrevious={() => changeMonth(-1)}
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

      <View style={styles.searchBox}>
        <MaterialCommunityIcons
          color={palette.textQuiet}
          name="magnify"
          size={18}
        />
        <TextInput
          accessibilityLabel="Search ledger"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setSearch}
          placeholder="Search note, category, or amount"
          placeholderTextColor={palette.textQuiet}
          returnKeyType="search"
          style={styles.searchInput}
          value={search}
        />
        {search.length > 0 ? (
          <Pressable
            accessibilityLabel="Clear search"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setSearch("")}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <MaterialCommunityIcons
              color={palette.textMuted}
              name="close"
              size={18}
            />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.filters}
        horizontal
        showsHorizontalScrollIndicator={false}>
        {FILTER_OPTIONS.map((option) => {
          const selected = filter === option.value;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.value}
              onPress={() => chooseFilter(option.value)}
              style={({ pressed }) => [
                styles.filter,
                selected ? styles.filterSelected : null,
                { opacity: pressed ? 0.58 : 1 },
              ]}>
              <Text
                style={[
                  styles.filterText,
                  selected ? styles.filterTextSelected : null,
                ]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.resultLine}>
        <Text style={styles.resultCount}>
          {filteredTransactions.length} {filteredTransactions.length === 1 ? "ENTRY" : "ENTRIES"}
        </Text>
        <View style={styles.resultRule} />
        <Text style={styles.resultCode}>{currency.code}</Text>
      </View>
    </View>
  );

  const stateContent = isLoading ? (
    <StatePanel
      description="Reading the local cache and current month."
      loading
      title="Opening your ledger"
    />
  ) : isError ? (
    <StatePanel
      actionLabel="Retry"
      description="Your saved data is untouched. Try reading this period again."
      onAction={() => void refetch()}
      title="Ledger unavailable"
    />
  ) : (
    <StatePanel
      description={
        search.length > 0 || filter !== "all"
          ? "Clear the search or choose another filter."
          : "Record a movement on Home and it will appear here."
      }
      title="No matching entries"
    />
  );

  return (
    <Screen backgroundColor={palette.canvas} className="px-0">
      <SignalThreads intensity="quiet" />
      {mode === "list" ? (
        <SectionList
          contentContainerStyle={styles.listContent}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<View style={styles.stateWrap}>{stateContent}</View>}
          ListHeaderComponent={header}
          refreshControl={
            <RefreshControl
              colors={[palette.textMuted]}
              onRefresh={() => void refetch()}
              refreshing={isRefetching}
              tintColor={palette.textMuted}
            />
          }
          renderItem={({ item }) => (
            <LedgerEntryRow currency={currency} transaction={item} />
          )}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionDate}>{section.title}</Text>
              <Text style={styles.sectionCount}>
                {section.data.length.toString().padStart(2, "0")}
              </Text>
            </View>
          )}
          sections={sections}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              colors={[palette.textMuted]}
              onRefresh={() => void refetch()}
              refreshing={isRefetching}
              tintColor={palette.textMuted}
            />
          }
          showsVerticalScrollIndicator={false}>
          {header}
          {isLoading || isError ? (
            <View style={styles.stateWrap}>{stateContent}</View>
          ) : (
            <>
              <CalendarGrid
                currency={currency}
                dailyTotals={dailyTotals}
                days={calendarDays}
                onSelectDay={chooseDay}
                selectedDay={selectedDay}
              />

              <View style={styles.selectedHeader}>
                <Text style={styles.selectedLabel}>
                  {selectedDay
                    ? sectionTitle(selectedDay).toLocaleUpperCase()
                    : "DAY DETAIL"}
                </Text>
                <Text style={styles.selectedCount}>
                  {selectedDayTransactions.length.toString().padStart(2, "0")}
                </Text>
              </View>

              <View style={styles.selectedLedger}>
                {selectedDay == null ? (
                  <StatePanel
                    description="Select a date to isolate its income and outflow."
                    title="Choose a day"
                  />
                ) : selectedDayTransactions.length === 0 ? (
                  <StatePanel
                    description="There are no matching entries for this date."
                    title="Quiet day"
                  />
                ) : (
                  selectedDayTransactions.map((transaction) => (
                    <LedgerEntryRow
                      currency={currency}
                      key={transaction.id}
                      transaction={transaction}
                    />
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    alignSelf: "center",
    maxWidth: 720,
    paddingBottom: 150,
    width: "100%",
  },
  headerContent: { paddingHorizontal: 20 },
  searchBox: {
    alignItems: "center",
    borderBottomColor: palette.lineStrong,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 58,
  },
  searchInput: {
    color: palette.text,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    minHeight: 48,
    paddingVertical: 0,
  },
  filters: { gap: 8, paddingVertical: 14 },
  filter: {
    alignItems: "center",
    borderColor: palette.line,
    borderCurve: "continuous",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 16,
  },
  filterSelected: {
    backgroundColor: palette.text,
    borderColor: palette.text,
  },
  filterText: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "700",
  },
  filterTextSelected: { color: palette.black },
  resultLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingBottom: 16,
  },
  resultCount: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 0.8,
  },
  resultRule: { backgroundColor: palette.line, flex: 1, height: 1 },
  resultCode: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 8,
  },
  sectionHeader: {
    alignItems: "center",
    backgroundColor: palette.canvas,
    borderBottomColor: palette.line,
    borderTopColor: palette.line,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 20,
    minHeight: 46,
  },
  sectionDate: {
    color: palette.textMuted,
    fontFamily: fonts.ledger,
    fontSize: 9,
    letterSpacing: 0.55,
    textTransform: "uppercase",
  },
  sectionCount: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 9,
  },
  stateWrap: { paddingHorizontal: 20, paddingTop: 10 },
  calendarPanel: {
    borderBottomColor: palette.line,
    borderTopColor: palette.line,
    borderTopWidth: 1,
    marginHorizontal: 20,
    paddingBottom: 8,
  },
  weekdays: { flexDirection: "row", paddingVertical: 13 },
  weekday: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 8,
    textAlign: "center",
    width: "14.2857%",
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  calendarCell: {
    alignItems: "center",
    borderColor: "transparent",
    borderCurve: "continuous",
    borderRadius: 12,
    borderWidth: 1,
    height: 72,
    justifyContent: "flex-start",
    paddingTop: 6,
    width: "14.2857%",
  },
  calendarCellSelected: {
    backgroundColor: withAlpha(palette.white, 0.04),
    borderColor: palette.lineStrong,
  },
  dayNumberWrap: {
    alignItems: "center",
    borderRadius: 999,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  todayNumberWrap: { backgroundColor: palette.text },
  dayNumber: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "700",
  },
  todayNumber: { color: palette.black },
  dayTotalWrap: { alignItems: "center", gap: 4, marginTop: 5 },
  daySignal: { height: 1, width: 15 },
  dayTotal: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 6,
    maxWidth: 42,
  },
  emptyDaySignal: {
    backgroundColor: palette.line,
    height: 1,
    marginTop: 12,
    width: 8,
  },
  selectedHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 20,
    minHeight: 58,
  },
  selectedLabel: {
    color: palette.textMuted,
    fontFamily: fonts.ledger,
    fontSize: 9,
    letterSpacing: 0.65,
  },
  selectedCount: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 9,
  },
  selectedLedger: { marginHorizontal: 20 },
});
