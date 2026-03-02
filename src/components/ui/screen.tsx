import type { PropsWithChildren } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ScreenProps = PropsWithChildren<{
  className?: string;
}>;

export function Screen({ children, className = "" }: ScreenProps) {
  return (
    <SafeAreaView
      className="flex-1 bg-blue-200"
      edges={["top", "left", "right"]}>
      <View className={`flex-1 px-4 ${className}`}>{children}</View>
    </SafeAreaView>
  );
}
