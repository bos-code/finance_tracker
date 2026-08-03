import { palette } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function PeriodNavigator({
  label,
  onNext,
  onPrevious,
}: {
  label: string;
  onNext: () => void;
  onPrevious: () => void;
}) {
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

const styles = StyleSheet.create({
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
    fontSize: 8,
    letterSpacing: 1.2,
  },
  label: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 18,
  },
});
