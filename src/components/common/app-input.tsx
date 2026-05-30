import { forwardRef, useState } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";

type AppInputProps = TextInputProps & {
  label: string;
  error?: string;
};

export const AppInput = forwardRef<TextInput, AppInputProps>(
  ({ label, error, onBlur, onFocus, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);

    const handleFocus: NonNullable<TextInputProps["onFocus"]> = (event) => {
      setIsFocused(true);
      onFocus?.(event);
    };

    const handleBlur: NonNullable<TextInputProps["onBlur"]> = (event) => {
      setIsFocused(false);
      onBlur?.(event);
    };

    const borderColor = error ? "#f87171" : isFocused ? "#2563eb" : "#cbd5e1";

    return (
      <View>
        <Text className="mb-2 text-sm font-medium text-slate-700">{label}</Text>
        <View
          style={{
            borderWidth: 1,
            borderColor,
            borderRadius: 14,
            backgroundColor: "rgba(255, 255, 255, 0.82)",
            shadowColor: "#0f172a",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: isFocused ? 0.2 : 0.12,
            shadowRadius: isFocused ? 14 : 8,
            elevation: isFocused ? 6 : 2,
          }}>
          <TextInput
            ref={ref}
            placeholderTextColor="#94a3b8"
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="px-4 py-3 text-base text-slate-900"
            editable={props.editable ?? true}
            {...props}
          />
        </View>
        {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
      </View>
    );
  },
);

AppInput.displayName = "AppInput";
