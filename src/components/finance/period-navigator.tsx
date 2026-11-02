import { type AppTheme, useStyles, useTheme } from "@/theme/theme-context";

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";

export function PeriodNavigator({
  label,
  onNext,
  onPrevious,
}: {
  label: string;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const { palette } = useTheme();
  const styles = useStyles(createStyles);
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel="Previous period"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onPrevious}
        style={({ pressed }) => [
          styles.button,
          { opacity: pressed ? 0.56 : 1 },
        ]}>
        <MaterialCommunityIcons
          color={palette.textMuted}
          name="chevron-left"
          size={20}
        />
      </Pressable>
      <View style={styles.labelGroup}>
        <Text style={styles.overline}>PERIOD</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
      <Pressable
        accessibilityLabel="Next period"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onNext}
        style={({ pressed }) => [
          styles.button,
          { opacity: pressed ? 0.56 : 1 },
        ]}>
        <MaterialCommunityIcons
          color={palette.textMuted}
          name="chevron-right"
          size={20}
        />
      </Pressable>
    </View>
  );
}

const createStyles = ({ palette, fonts, fs }: AppTheme) =>
  StyleSheet.create({
  container: {
    alignItems: "center",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 74,
  },
  button: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 13,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  labelGroup: { alignItems: "center", gap: 4 },
  overline: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: fs(8),
    letterSpacing: 1.2,
  },
  label: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: fs(18),
  },
});
