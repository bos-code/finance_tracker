import type { PropsWithChildren } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ScreenProps = PropsWithChildren<{
  className?: string;
}>;

export function Screen({ children, className = "" }: ScreenProps) {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: '#bfdbfe' }}
      edges={["top", "left", "right"]}>
      <View className={`flex-1 px-4 ${className}`}>{children}</View>
    </SafeAreaView>
  );
}
