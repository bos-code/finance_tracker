import { Pressable, Text } from "react-native";

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

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      className={`rounded-xl px-4 py-4 ${
        isDisabled ? "bg-slate-400" : "bg-blue-700"
      }`}>
      <Text className="text-center text-base font-semibold text-white">
        {isLoading ? "Please wait..." : title}
      </Text>
    </Pressable>
  );
}
