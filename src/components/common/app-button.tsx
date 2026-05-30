import { useRef } from "react";
import { Animated, Pressable, Text } from "react-native";

type AppButtonProps = {
  title: string;
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
};

export function AppButton({
  title,
  onPress,
  isLoading = false,
  disabled = false,
}: AppButtonProps) {
  const isDisabled = disabled || isLoading;
  const pressAnim = useRef(new Animated.Value(1)).current;

  const animatePress = (toValue: number) => {
    Animated.spring(pressAnim, {
      toValue,
      speed: 30,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={{
        transform: [{ scale: pressAnim }],
        shadowColor: "#1e3a8a",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: isDisabled ? 0.08 : 0.28,
        shadowRadius: 16,
        elevation: isDisabled ? 1 : 5,
      }}>
      <Pressable
        accessibilityRole="button"
        disabled={isDisabled}
        onPress={onPress}
        onPressIn={() => animatePress(0.97)}
        onPressOut={() => animatePress(1)}
        className={`rounded-xl px-4 py-4 ${
          isDisabled ? "bg-slate-400/90" : "bg-blue-700/95"
        }`}>
        <Text className="text-center text-base font-semibold text-white">
          {isLoading ? "Please wait..." : title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
