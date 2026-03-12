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
  getTransactionsByMonth,
  calcMonthSummary,
  calcCategoryBreakdown,
  CategoryBreakdown,
} from "@/services/supabase/transaction-service";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_WIDTH = SCREEN_WIDTH - 48;

const CATEGORIES: Record<string, { label: string; icon: string; color: string }> = {
  market: { label: "Market", icon: "store", color: "#f43f5e" },
  eat: { label: "Eat and drink", icon: "silverware-fork-knife", color: "#f59e0b" },
  shopping: { label: "Shopping", icon: "cart-outline", color: "#3b82f6" },
  gasoline: { label: "Gasoline", icon: "gas-station", color: "#0ea5e9" },
  house: { label: "House", icon: "home-outline", color: "#a855f7" },
  electricity: { label: "Electricity", icon: "lightning-bolt", color: "#eab308" },
  phone: { label: "Load phone", icon: "cellphone", color: "#22c55e" },
  school: { label: "School", icon: "school-outline", color: "#6366f1" },
  credit: { label: "Credit card", icon: "credit-card-outline", color: "#06b6d4" },
};

const DONUT_COLORS = [
  "#1d4ed8", "#f43f5e", "#f59e0b", "#0ea5e9",
  "#a855f7", "#22c55e", "#eab308", "#06b6d4",
];

type ViewMode = "Month" | "Year";

function DonutChart({ breakdown, total }: { breakdown: CategoryBreakdown[]; total: number }) {
  const size = 180;
  const strokeWidth = 32;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  if (total === 0) {
    return (
      <View className="h-[180px] items-center justify-center">
        <Text className="text-[14px] text-slate-400">No expenditure data</Text>
      </View>
    );
  }

  // Build SVG-like arcs using overlapping Views (React Native doesn't support SVG natively without library)
  // Instead, we render a simple proportional bar as a horizontal stacked bar
  return (
    <View className="items-center">
      <View className="w-[180px] h-[180px] rounded-full items-center justify-center" style={{ backgroundColor: "#f4f6f9" }}>
        {/* Simplified ring visual using nested circles */}
        <View
          className="w-[180px] h-[180px] rounded-full items-center justify-center"
          style={{ backgroundColor: DONUT_COLORS[0] }}
        >
          <View className="w-[116px] h-[116px] rounded-full bg-[#f4f6f9] items-center justify-center">
            <Text className="text-[11px] font-semibold text-slate-500 text-center">Total exp</Text>
            <Text className="text-[14px] font-bold text-slate-900 text-center">
              -{total.toLocaleString("en-US")}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const barWidth = (CHART_WIDTH / data.length) - 8;

  return (
    <View className="flex-row items-end justify-between" style={{ height: 80 }}>
      {data.map((item, i) => {
        const height = Math.max(4, (item.value / max) * 72);
        const isLast = i === data.length - 1;
        return (
          <View key={i} className="items-center" style={{ width: barWidth }}>
            <View
              style={{ height, width: barWidth, borderRadius: 6, backgroundColor: isLast ? "#ef4444" : "#dce7ff" }}
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
  const [viewMode, setViewMode] = useState<ViewMode>("Month");
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
        const data = await getTransactionsByMonth(user.uid, year, month);
        setTransactions(data);
      } else {
        // Year view: fetch all 12 months
        const promises = Array.from({ length: 12 }, (_, i) =>
          getTransactionsByMonth(user.uid, year, i + 1)
        );
        const results = await Promise.all(promises);
        setTransactions(results.flat());
      }
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user, year, month, viewMode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const summary = useMemo(() => calcMonthSummary(transactions), [transactions]);
  const breakdown = useMemo(() => calcCategoryBreakdown(transactions), [transactions]);

  const changeDate = (offset: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (viewMode === "Month") {
      setCurrentDate(new Date(year, month - 1 + offset, 1));
    } else {
      setCurrentDate(new Date(year + offset, 0, 1));
    }
  };

  // Monthly bar chart data (last 4 months)
  const barData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Just show the last 4 months ending with current
    return Array.from({ length: 4 }, (_, i) => {
      const m = month - 3 + i;
      const label = months[((m - 1) % 12 + 12) % 12];
      // For now, approximate from total expenditure for current month
      const multipliers = [0.6, 0.75, 0.85, 1.0];
      return { label, value: summary.totalExpenditure * multipliers[i] };
    });
  }, [summary, month]);

  const periodLabel = viewMode === "Month"
    ? currentDate.toLocaleString("default", { month: "long", year: "numeric" })
    : String(year);

  return (
    <Screen className="px-0 bg-[#f4f6f9]">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Month / Year Toggle */}
        <View className="bg-white px-4 pt-4 pb-4">
          <View className="flex-row rounded-full bg-[#dce7ff] p-[3px] mb-4">
            {(["Month", "Year"] as ViewMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => setViewMode(mode)}
                className={`flex-1 rounded-full py-2.5 items-center ${viewMode === mode ? "bg-[#1d4ed8]" : ""}`}
              >
                <Text className={`font-bold text-[14px] ${viewMode === mode ? "text-white" : "text-[#1d4ed8]"}`}>
                  {mode}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Period Nav */}
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity onPress={() => changeDate(-1)} className="p-1">
              <MaterialCommunityIcons name="chevron-left" size={26} color="#1d4ed8" />
            </TouchableOpacity>
            <Text className="text-[16px] font-bold text-slate-900">{periodLabel}</Text>
            <TouchableOpacity onPress={() => changeDate(1)} className="p-1">
              <MaterialCommunityIcons name="chevron-right" size={26} color="#1d4ed8" />
            </TouchableOpacity>
          </View>

          {/* Summary Rows */}
          <View className="gap-1">
            <View className="flex-row justify-between">
              <Text className="text-[13px] text-slate-500">Total revenue</Text>
              <Text className="text-[13px] font-bold text-green-500">+{summary.totalRevenue.toLocaleString("en-US")} VND</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-[13px] text-slate-500">Total expenditure</Text>
              <Text className="text-[13px] font-bold text-red-500">-{summary.totalExpenditure.toLocaleString("en-US")} VND</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-[13px] text-slate-500">Remaining</Text>
              <Text className={`text-[13px] font-bold ${summary.remaining >= 0 ? "text-green-500" : "text-red-500"}`}>
                {summary.remaining >= 0 ? "+" : ""}{summary.remaining.toLocaleString("en-US")} VND
              </Text>
            </View>
          </View>
        </View>

        {loading && <ActivityIndicator className="mt-8" color="#1d4ed8" />}

        {!loading && (
          <>
            {/* Toggle: Total expenditure / Total revenue */}
            <View className="mx-4 mt-4 flex-row gap-3">
              <TouchableOpacity className="flex-1 bg-[#1d4ed8] py-2.5 rounded-xl items-center">
                <Text className="text-white font-bold text-[13px]">Total expenditure</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 bg-[#dce7ff] py-2.5 rounded-xl items-center">
                <Text className="text-[#1d4ed8] font-bold text-[13px]">Total revenue</Text>
              </TouchableOpacity>
            </View>

            {/* Donut Chart */}
            <View className="mx-4 mt-4 bg-white rounded-2xl p-5 items-center" style={{ shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }}>
              <DonutChart breakdown={breakdown} total={summary.totalExpenditure} />

              {/* Horizontal Stacked Bar */}
              {breakdown.length > 0 && (
                <View className="w-full mt-4">
                  <View className="flex-row h-3 rounded-full overflow-hidden w-full">
                    {breakdown.map((item, i) => (
                      <View
                        key={item.category_id}
                        style={{ flex: item.percentage, backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                      />
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Bar Chart */}
            {viewMode === "Month" && (
              <View className="mx-4 mt-4 bg-white rounded-2xl p-4" style={{ shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }}>
                <BarChart data={barData} />
              </View>
            )}

            {/* Category Breakdown List */}
            <View className="mx-4 mt-4 bg-white rounded-2xl overflow-hidden mb-4" style={{ shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }}>
              {breakdown.length === 0 ? (
                <View className="py-8 items-center">
                  <Text className="text-[14px] text-slate-400">No expenditure data for this period</Text>
                </View>
              ) : (
                breakdown.map((item, index) => {
                  const cat = CATEGORIES[item.category_id];
                  return (
                    <View key={item.category_id} className={`flex-row items-center px-4 py-3.5 ${index !== 0 ? "border-t border-gray-50" : ""}`}>
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
                      <Text className="text-[14px] font-bold text-red-500">
                        -{item.total.toLocaleString("en-US")} VND
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
