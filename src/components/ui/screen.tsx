import { useTheme } from "@/theme/theme-context";
import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ScreenProps = PropsWithChildren<{
  backgroundColor?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
}>;

export function Screen({
  backgroundColor,
  children,
  className = "",
  style,
}: ScreenProps) {
  const { palette } = useTheme();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: backgroundColor ?? palette.canvas }}
      edges={["top", "left", "right"]}>
      <View className={`flex-1 px-4 ${className}`} style={style}>
        {children}
      </View>
    </SafeAreaView>
  );
}
