import { Screen } from "@/components/ui/screen";
import { Text, View } from "react-native";

const upcoming = [
  "March 09: Team budget review",
  "March 12: Payroll batch",
  "March 15: Vendor settlements",
];

export function CalendarScreen() {
  return (
    <Screen>
      <Text className="text-2xl font-bold text-slate-900">Calendar</Text>
      <Text className="mt-1 text-sm text-slate-600">
        Keep track of important financial events.
      </Text>

      <View className="mt-6 gap-3">
        {upcoming.map((eventName) => (
          <View key={eventName} className="rounded-xl border border-slate-200 bg-white p-4">
            <Text className="text-sm font-medium text-slate-800">{eventName}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}
