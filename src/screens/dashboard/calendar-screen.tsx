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
  Modal,
  ActivityIndicator,
  Platform,
} from "react-native";
import {
  Transaction,
  getTransactionsByMonth,
  calcMonthSummary,
  calcDailyTotals,
  DailyTotal,
} from "@/services/supabase/transaction-service";
import { ALL_CATEGORIES } from "@/constants/categories";
import { useOffline } from "@/context/offline-context";
import { useTheme } from "@/context/theme-context";
import { useCurrency } from "@/context/currency-context";


const DAYS_OF_WEEK = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const WEEK_START = 1; // Monday

function formatVND(amount: number) {
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}m`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `${Math.round(amount / 1_000)}k`;
  }
  return `${amount}`;
}

function formatFullVND(amount: number) {
  return `${amount >= 0 ? "+" : ""}${amount.toLocaleString("en-US")} VND`;
}

export function CalendarScreen() {
  const { user } = useAuth();
  const { isOnline } = useOffline();
  const { theme } = useTheme();
  const { formatAmount } = useCurrency();
  const primary = theme.primary;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + 1;

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getTransactionsByMonth(user.uid, year, month, isOnline);
      setTransactions(data);
    } catch (e) {
      // silent fail, show empty state
    } finally {
      setLoading(false);
    }
  }, [user, year, month, isOnline]);


  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const summary = useMemo(() => calcMonthSummary(transactions), [transactions]);
  const dailyTotals = useMemo(() => calcDailyTotals(transactions), [transactions]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const prevMonthDays = new Date(year, month - 1, 0).getDate();

    // Adjust for Monday start (0=Sun,1=Mon...)
    const offset = (firstDay + 6) % 7;

    const days = [];
    for (let i = 0; i < offset; i++) {
      days.push({ day: prevMonthDays - offset + i + 1, isCurrentMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, isCurrentMonth: false });
    }
    return days;
  }, [year, month]);

  const changeMonth = (offset: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMonth(new Date(year, month - 1 + offset, 1));
    setSelectedDay(null);
  };

  const monthLabel = currentMonth.toLocaleString("default", { month: "long", year: "numeric" });

  const selectedDayTransactions = useMemo(() => {
    if (!selectedDay) return [];
    return transactions.filter(tx => tx.transaction_date.slice(0, 10) === selectedDay);
  }, [selectedDay, transactions]);

  const selectedDayLabel = useMemo(() => {
    if (!selectedDay) return "";
    const d = new Date(selectedDay + "T00:00:00");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", weekday: "long" });
  }, [selectedDay]);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <Screen className="px-0 bg-[#f4f6f9]">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Month Header */}
        <View className="bg-white px-4 pt-4 pb-2">
          {/* Month Nav */}
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity onPress={() => changeMonth(-1)} className="p-2">
              <MaterialCommunityIcons name="chevron-left" size={26} color={primary} />
            </TouchableOpacity>
            <Text className="text-[18px] font-bold text-slate-900">{monthLabel}</Text>
            <TouchableOpacity onPress={() => changeMonth(1)} className="p-2">
              <MaterialCommunityIcons name="chevron-right" size={26} color={primary} />
            </TouchableOpacity>
          </View>

          {/* Summary */}
          <View className="gap-1 mb-4 px-2">
            <View className="flex-row justify-between">
              <Text className="text-[13px] font-medium text-slate-500">Total revenue</Text>
              <Text className="text-[13px] font-bold text-green-500">
                +{summary.totalRevenue.toLocaleString("en-US")} VND
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-[13px] font-medium text-slate-500">Total expenditure</Text>
              <Text className="text-[13px] font-bold text-red-500">
                -{summary.totalExpenditure.toLocaleString("en-US")} VND
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-[13px] font-medium text-slate-500">Remaining</Text>
              <Text className={`text-[13px] font-bold ${summary.remaining >= 0 ? "text-green-500" : "text-red-500"}`}>
                {formatFullVND(summary.remaining)}
              </Text>
            </View>
          </View>

          {/* Days of week header */}
          <View className="flex-row mb-1">
            {DAYS_OF_WEEK.map((d, i) => (
              <Text key={i} className="flex-1 text-center text-[12px] font-bold text-slate-400">{d}</Text>
            ))}
          </View>
        </View>

        {/* Calendar Grid */}
        {loading ? (
          <ActivityIndicator className="mt-8" color={primary} />
        ) : (
          <View className="bg-white flex-row flex-wrap px-1 pb-2">
            {calendarDays.map((item, index) => {
              if (!item.isCurrentMonth) {
                return (
                  <View key={index} style={{ width: "14.28%" }} className="h-16 items-center pt-1">
                    <Text className="text-[13px] text-slate-300">{item.day}</Text>
                  </View>
                );
              }

              const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(item.day).padStart(2, "0")}`;
              const dayData: DailyTotal | undefined = dailyTotals[dateKey];
              const isToday = dateKey === todayStr;
              const isSelected = dateKey === selectedDay;

              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedDay(isSelected ? null : dateKey);
                  }}
                  style={{ width: "14.28%" }}
                  className="h-16 items-center pt-1"
                >
                  <View style={{ backgroundColor: isToday ? primary : "transparent" }} className="w-8 h-8 rounded-full items-center justify-center">
                    <Text className={`text-[13px] font-bold ${isToday ? "text-white" : "text-slate-700"}`}>
                      {item.day}
                    </Text>
                  </View>
                  {dayData && (
                    <View className="items-center mt-0.5">
                      {dayData.revenue > 0 && (
                        <Text className="text-[9px] font-bold text-green-500" numberOfLines={1}>
                          +{formatVND(dayData.revenue)}
                        </Text>
                      )}
                      {dayData.expenditure > 0 && (
                        <Text className="text-[9px] font-bold text-red-400" numberOfLines={1}>
                          -{formatVND(dayData.expenditure)}
                        </Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Day Detail Panel */}
        {selectedDay && (
          <View className="mt-4 mx-4 bg-white rounded-2xl overflow-hidden" style={{ shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 }}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
              <View className="flex-row items-center gap-2">
                <MaterialCommunityIcons name="plus-circle-outline" size={20} color={primary} />
                <Text className="text-[13px] font-bold text-slate-700">{selectedDayLabel}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedDay(null)}>
                <MaterialCommunityIcons name="close" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {selectedDayTransactions.length === 0 ? (
              <View className="py-8 items-center">
                <Text className="text-[14px] text-slate-400">No transactions on this day</Text>
              </View>
            ) : (
              selectedDayTransactions.map((tx) => {
                const cat = ALL_CATEGORIES[tx.category_id];
                return (
                  <View key={tx.id} className="flex-row items-center px-4 py-3 border-b border-gray-50">
                    <View
                      className="h-10 w-10 rounded-xl items-center justify-center mr-3"
                      style={{ backgroundColor: cat ? cat.color + "20" : "#f1f5f9" }}
                    >
                      <MaterialCommunityIcons
                        name={(cat?.icon as any) ?? "cash"}
                        size={20}
                        color={cat?.color ?? "#64748b"}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[14px] font-bold text-slate-900">
                        {cat?.label ?? tx.category_id}
                      </Text>
                      {tx.note ? (
                        <Text className="text-[12px] text-slate-400" numberOfLines={1}>{tx.note}</Text>
                      ) : null}
                    </View>
                    <Text
                      className={`text-[14px] font-bold ${tx.type === "Revenue" ? "text-green-500" : "text-red-500"}`}
                    >
                      {tx.type === "Revenue" ? "+" : "-"}
                      {tx.amount.toLocaleString("en-US")} VND
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        )}

        <View className="h-28" />
      </ScrollView>
    </Screen>
  );
}
