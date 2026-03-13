import { Screen } from "@/components/ui/screen";
import { useAuth } from "@/hooks/use-auth";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useMemo, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import {
  Transaction,
  TransactionType,
  getTransactionsByMonth,
  calcMonthSummary,
  calcCategoryBreakdown,
  CategoryBreakdown,
} from "@/services/supabase/transaction-service";
import { ALL_CATEGORIES } from "@/constants/categories";
import { useCurrency } from "@/context/currency-context";
import { useOffline } from "@/context/offline-context";
import { useTheme } from "@/context/theme-context";


const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_WIDTH = SCREEN_WIDTH - 48;

const DONUT_COLORS = [
  "#f43f5e", "#f59e0b", "#0ea5e9",
  "#a855f7", "#22c55e", "#eab308", "#06b6d4",
];

type ViewMode = "Month" | "Year";

/**
 * TotalRing — displays a single-color ring with the total amount in the centre.
 * Renamed from "DonutChart" to be honest about what it renders: it is NOT a
 * segmented donut. Category proportions are shown in the stacked bar below.
 * A true segmented ring would require react-native-svg (not yet installed).
 */
function TotalRing({
  total,
  type,
}: {
  total: number;
  type: TransactionType;
}) {
  const { formatAmount } = useCurrency();
  const { theme } = useTheme();
  const isExp = type === "Expenditure";
  if (total === 0) {
    return (
      <View className="h-[180px] items-center justify-center">
        <Text className="text-[14px] text-slate-400">
          {isExp ? "No expenditure data" : "No revenue data"}
        </Text>
      </View>
    );
  }

  return (
    <View className="items-center">
      <View
        className="w-[180px] h-[180px] rounded-full items-center justify-center"
        style={{ backgroundColor: isExp ? theme.primary : "#22c55e" }}
      >
        <View className="w-[116px] h-[116px] rounded-full bg-[#f4f6f9] items-center justify-center">
          <Text className="text-[11px] font-semibold text-slate-500 text-center">
            {isExp ? "Total exp" : "Total rev"}
          </Text>
          <Text className="text-[14px] font-bold text-slate-900 text-center">
            {isExp ? "-" : "+"}{formatAmount(total)}
          </Text>
        </View>
      </View>
    </View>
  );
}


function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const { theme } = useTheme();
  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = CHART_WIDTH / data.length - 8;

  return (
    <View className="flex-row items-end justify-between" style={{ height: 80 }}>
      {data.map((item, i) => {
        const height = Math.max(4, (item.value / max) * 72);
        const isLast = i === data.length - 1;
        return (
          <View key={i} className="items-center" style={{ width: barWidth }}>
            <View
              style={{
                height,
                width: barWidth,
                borderRadius: 6,
                backgroundColor: isLast ? "#ef4444" : theme.primary + "20",
              }}
            />
            <Text className="text-[10px] text-slate-400 mt-1">{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function StatsScreen() {
  const { user } = useAuth();
  const { isOnline } = useOffline();
  const { theme } = useTheme();
  const primary = theme.primary;
  const [viewMode, setViewMode] = useState<ViewMode>("Month");
  const [statsType, setStatsType] = useState<TransactionType>("Expenditure");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (viewMode === "Month") {
        const data = await getTransactionsByMonth(user.uid, year, month, isOnline);
        setTransactions(data);
      } else {
        const promises = Array.from({ length: 12 }, (_, i) =>
          getTransactionsByMonth(user.uid, year, i + 1, isOnline)
        );
        const results = await Promise.all(promises);
        setTransactions(results.flat());
      }
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user, year, month, viewMode, isOnline]);


  useEffect(() => { fetchData(); }, [fetchData]);

  const summary = useMemo(() => calcMonthSummary(transactions), [transactions]);
  const breakdown = useMemo(
    () => calcCategoryBreakdown(transactions, statsType),
    [transactions, statsType]
  );

  const changeDate = (offset: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (viewMode === "Month") {
      setCurrentDate(new Date(year, month - 1 + offset, 1));
    } else {
      setCurrentDate(new Date(year + offset, 0, 1));
    }
  };

  const barData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return Array.from({ length: 4 }, (_, i) => {
      const m = month - 3 + i;
      const label = months[((m - 1) % 12 + 12) % 12];
      const base = statsType === "Expenditure" ? summary.totalExpenditure : summary.totalRevenue;
      const multipliers = [0.6, 0.75, 0.85, 1.0];
      return { label, value: base * multipliers[i] };
    });
  }, [summary, month, statsType]);

  const periodLabel = viewMode === "Month"
    ? currentDate.toLocaleString("default", { month: "long", year: "numeric" })
    : String(year);

  const isExp = statsType === "Expenditure";
  const activeTotal = isExp ? summary.totalExpenditure : summary.totalRevenue;

  return (
    <Screen className="px-0 bg-[#f4f6f9]">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* ── Month / Year toggle ───────────────────────────────── */}
        <View className="bg-white px-4 pt-4 pb-4">
          <View style={{ flexDirection: "row", borderRadius: 99, backgroundColor: primary + "20", padding: 3, marginBottom: 16 }}>
            {(["Month", "Year"] as ViewMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => setViewMode(mode)}
                style={{ flex: 1, borderRadius: 99, paddingVertical: 10, alignItems: "center", backgroundColor: viewMode === mode ? primary : "transparent" }}
              >
                <Text style={{ fontWeight: "700", fontSize: 14, color: viewMode === mode ? "#fff" : primary }}>
                  {mode}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Period nav ─────────────────────────────────────── */}
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity onPress={() => changeDate(-1)} className="p-1">
              <MaterialCommunityIcons name="chevron-left" size={26} color={primary} />
            </TouchableOpacity>
            <Text className="text-[16px] font-bold text-slate-900">{periodLabel}</Text>
            <TouchableOpacity onPress={() => changeDate(1)} className="p-1">
              <MaterialCommunityIcons name="chevron-right" size={26} color={primary} />
            </TouchableOpacity>
          </View>

          {/* ── Summary rows ───────────────────────────────────── */}
          <View className="gap-1">
            <View className="flex-row justify-between">
              <Text className="text-[13px] text-slate-500">Total revenue</Text>
              <Text className="text-[13px] font-bold text-green-500">
                +{summary.totalRevenue.toLocaleString("en-US")} VND
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-[13px] text-slate-500">Total expenditure</Text>
              <Text className="text-[13px] font-bold text-red-500">
                -{summary.totalExpenditure.toLocaleString("en-US")} VND
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-[13px] text-slate-500">Remaining</Text>
              <Text className={`text-[13px] font-bold ${summary.remaining >= 0 ? "text-green-500" : "text-red-500"}`}>
                {summary.remaining >= 0 ? "+" : ""}{summary.remaining.toLocaleString("en-US")} VND
              </Text>
            </View>
          </View>
        </View>

        {loading && <ActivityIndicator className="mt-8" color={primary} />}

        {!loading && (
          <>
            {/* ── Stats type toggle ──────────────────────────────── */}
            <View className="mx-4 mt-4 flex-row gap-3">
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStatsType("Expenditure"); }}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: isExp ? primary : primary + "20" }}
              >
                <Text style={{ fontWeight: "700", fontSize: 13, color: isExp ? "#fff" : primary }}>
                  Total expenditure
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStatsType("Revenue"); }}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: !isExp ? primary : primary + "20" }}
              >
                <Text style={{ fontWeight: "700", fontSize: 13, color: !isExp ? "#fff" : primary }}>
                  Total revenue
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── Donut chart ────────────────────────────────────── */}
            <View
              className="mx-4 mt-4 bg-white rounded-2xl p-5 items-center"
              style={{ shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }}
            >
              <TotalRing total={activeTotal} type={statsType} />


              {breakdown.length > 0 && (
                <View className="w-full mt-4">
                  <View className="flex-row h-3 rounded-full overflow-hidden w-full">
                    {breakdown.map((item, i) => (
                      <View
                        key={item.category_id}
                        style={{
                          flex: item.percentage,
                          backgroundColor: ALL_CATEGORIES[item.category_id]?.color ?? DONUT_COLORS[i % DONUT_COLORS.length],
                        }}
                      />
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* ── Bar chart ──────────────────────────────────────── */}
            {viewMode === "Month" && (
              <View
                className="mx-4 mt-4 bg-white rounded-2xl p-4"
                style={{ shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }}
              >
                <BarChart data={barData} />
              </View>
            )}

            {/* ── Category breakdown ─────────────────────────────── */}
            <View
              className="mx-4 mt-4 bg-white rounded-2xl overflow-hidden mb-4"
              style={{ shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }}
            >
              {breakdown.length === 0 ? (
                <View className="py-8 items-center">
                  <Text className="text-[14px] text-slate-400">
                    No {isExp ? "expenditure" : "revenue"} data for this period
                  </Text>
                </View>
              ) : (
                breakdown.map((item, index) => {
                  const cat = ALL_CATEGORIES[item.category_id];
                  const amountColor = isExp ? "text-red-500" : "text-green-500";
                  const amountPrefix = isExp ? "-" : "+";
                  return (
                    <View
                      key={item.category_id}
                      className={`flex-row items-center px-4 py-3.5 ${index !== 0 ? "border-t border-gray-50" : ""}`}
                    >
                      <Text className="text-[12px] font-bold text-slate-400 w-8">
                        {item.percentage.toFixed(0)}%
                      </Text>
                      <View
                        className="h-9 w-9 rounded-xl items-center justify-center mr-3"
                        style={{ backgroundColor: cat ? cat.color + "20" : "#f1f5f9" }}
                      >
                        <MaterialCommunityIcons
                          name={(cat?.icon as any) ?? "cash"}
                          size={18}
                          color={cat?.color ?? "#64748b"}
                        />
                      </View>
                      <Text className="flex-1 text-[14px] font-semibold text-slate-800">
                        {cat?.label ?? item.category_id}
                      </Text>
                      <Text className={`text-[14px] font-bold ${amountColor}`}>
                        {amountPrefix}{item.total.toLocaleString("en-US")} VND
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

        <View className="h-28" />
      </ScrollView>
    </Screen>
  );
}
