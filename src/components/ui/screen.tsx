import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { palette } from "@/theme/colors";

type ScreenProps = PropsWithChildren<{
  backgroundColor?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
}>;

export function Screen({
  backgroundColor = palette.canvas,
  children,
  className = "",
  style,
}: ScreenProps) {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor }}
      edges={["top", "left", "right"]}>
      <View className={`flex-1 px-4 ${className}`} style={style}>
        {children}
      </View>
    </SafeAreaView>
  );
}
