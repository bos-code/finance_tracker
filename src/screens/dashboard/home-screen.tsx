import { Screen } from "@/components/ui/screen";
import { formatCurrency } from "@/utils/formatters";
import { Text, View } from "react-native";

const cards = [
  { id: "1", title: "Income", value: 19420, color: "bg-green-600" },
  { id: "2", title: "Expenses", value: 12880, color: "bg-red-600" },
  { id: "3", title: "Net", value: 6540, color: "bg-blue-700" },
];

export function HomeScreen() {
  return (
    <Screen>
      <Text className="text-2xl font-bold text-slate-900">Dashboard</Text>
      <Text className="mt-1 text-sm text-slate-600">
        Overview of your revenue and expenses.
      </Text>

      <View className="mt-6 gap-4">
        {cards.map((card) => (
          <View key={card.id} className={`rounded-2xl p-5 ${card.color}`}>
            <Text className="text-sm font-medium text-white/80">{card.title}</Text>
            <Text className="mt-2 text-3xl font-bold text-white">
              {formatCurrency(card.value)}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}
