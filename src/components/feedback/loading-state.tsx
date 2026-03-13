import { useTheme } from "@/context/theme-context";
import { ActivityIndicator, Text, View } from "react-native";

type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = "Loading data" }: LoadingStateProps) {
  const { theme } = useTheme();
  return (
    <View className="items-center justify-center py-10">
      <ActivityIndicator size="small" color={theme.primary} />
      <Text className="mt-3 text-sm text-slate-600">{label}</Text>
    </View>
  );
}
