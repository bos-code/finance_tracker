import { palette } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from "react-native";

type ButtonTone = "primary" | "quiet" | "danger";

export function ActionButton({
  disabled = false,
  icon,
  label,
  loading = false,
  onPress,
  style,
  tone = "primary",
}: {
  disabled?: boolean;
  icon?: string;
  label: string;
  loading?: boolean;
  onPress: () => void;
  style?: ViewStyle;
  tone?: ButtonTone;
}) {
  const unavailable = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        tone === "primary"
          ? styles.primary
          : tone === "danger"
            ? styles.danger
            : styles.quiet,
        unavailable ? styles.disabled : null,
        { opacity: pressed ? 0.62 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator
          color={tone === "primary" ? palette.black : palette.textMuted}
          size="small"
        />
      ) : icon ? (
        <MaterialCommunityIcons
          color={tone === "primary" ? palette.black : palette.textMuted}
          name={icon as never}
          size={17}
        />
      ) : null}
      <Text
        style={[
          styles.label,
          tone === "primary" ? styles.primaryLabel : styles.quietLabel,
          tone === "danger" ? styles.dangerLabel : null,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 17,
  },
  primary: { backgroundColor: palette.text, borderColor: palette.text },
  quiet: { backgroundColor: "transparent", borderColor: palette.lineStrong },
  danger: { backgroundColor: "transparent", borderColor: palette.line },
  disabled: { opacity: 0.42 },
  label: { fontFamily: fonts.body, fontSize: 12, fontWeight: "700" },
  primaryLabel: { color: palette.black },
  quietLabel: { color: palette.textMuted },
  dangerLabel: { color: palette.expense },
});
