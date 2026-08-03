import { palette } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type SegmentOption<T extends string> = {
  label: string;
  value: T;
};

export function SegmentedControl<T extends string>({
  accessibilityLabel,
  onChange,
  options,
  value,
}: {
  accessibilityLabel: string;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  value: T;
}) {
  return (
    <View accessibilityLabel={accessibilityLabel} style={styles.container}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              selected ? styles.optionSelected : null,
              { opacity: pressed ? 0.62 : 1 },
            ]}>
            <Text
              style={[
                styles.label,
                selected ? styles.labelSelected : null,
              ]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
  },
  option: {
    alignItems: "center",
    borderBottomColor: "transparent",
    borderBottomWidth: 1,
    flex: 1,
    minHeight: 46,
    justifyContent: "center",
    marginBottom: -1,
  },
  optionSelected: { borderBottomColor: palette.text },
  label: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "700",
  },
  labelSelected: { color: palette.text },
});
