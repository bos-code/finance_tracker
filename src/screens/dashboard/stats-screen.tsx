import { Screen } from "@/components/ui/screen";
import { Text, View } from "react-native";

const insights = [
  { label: "Spend vs last month", value: "-12%", color: "text-green-600" },
  { label: "Savings rate", value: "31%", color: "text-blue-700" },
  { label: "Top category", value: "Subscriptions", color: "text-slate-900" },
];

export function StatsScreen() {
  return (
    <Screen>
      <Text className="text-2xl font-bold text-slate-900">Statistics</Text>
      <Text className="mt-1 text-sm text-slate-600">
        Trends and category-level performance.
      </Text>

      <View className="mt-6 gap-4">
        {insights.map((item) => (
          <View key={item.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <Text className="text-sm text-slate-500">{item.label}</Text>
            <Text className={`mt-2 text-xl font-bold ${item.color}`}>{item.value}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}
