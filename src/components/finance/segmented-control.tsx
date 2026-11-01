import { type AppTheme, useStyles } from "@/theme/theme-context";

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
  const styles = useStyles(createStyles);
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

const createStyles = ({ palette, fonts, fs }: AppTheme) =>
  StyleSheet.create({
  container: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    padding: 4,
  },
  option: {
    alignItems: "center",
    borderRadius: 10,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  // The chosen option is a solid block, so it is obvious which one is active.
  optionSelected: { backgroundColor: palette.text },
  label: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: fs(14),
    fontWeight: "700",
    textAlign: "center",
  },
  labelSelected: { color: palette.onPrimary },
});
