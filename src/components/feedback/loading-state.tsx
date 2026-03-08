import { ActivityIndicator, Text, View } from "react-native";

type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = "Loading data" }: LoadingStateProps) {
  return (
    <View className="items-center justify-center py-10">
      <ActivityIndicator size="small" color="#1d4ed8" />
      <Text className="mt-3 text-sm text-slate-600">{label}</Text>
    </View>
  );
}
