import { useAppStore } from "@/store/use-app-store";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";

type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = "Loading data" }: LoadingStateProps) {
  const theme = useAppStore((s) => s.theme);
  return (
    <View className="items-center justify-center py-10">
      <ActivityIndicator size="small" color={theme.primary} />
      <Text className="mt-3 text-sm text-slate-600">{label}</Text>
    </View>
  );
}
