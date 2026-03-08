import { forwardRef } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";

type AppInputProps = TextInputProps & {
  label: string;
  error?: string;
};

export const AppInput = forwardRef<TextInput, AppInputProps>(
  ({ label, error, ...props }, ref) => {
    return (
      <View>
        <Text className="mb-2 text-sm font-medium text-slate-700">{label}</Text>
        <TextInput
          ref={ref}
          placeholderTextColor="#94a3b8"
          className={`rounded-xl border bg-white px-4 py-3 text-base text-slate-900 ${
            error ? "border-red-400" : "border-slate-300"
          }`}
          {...props}
        />
        {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
      </View>
    );
  },
);

AppInput.displayName = "AppInput";
