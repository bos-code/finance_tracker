import { palette } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

export function StatePanel({
  actionLabel,
  description,
  loading = false,
  onAction,
  title,
}: {
  actionLabel?: string;
  description: string;
  loading?: boolean;
  onAction?: () => void;
  title: string;
}) {
  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={palette.textMuted} size="small" />
      ) : (
        <MaterialCommunityIcons
          color={palette.textQuiet}
          name="circle-slice-2"
          size={20}
        />
      )}
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      {actionLabel != null && actionLabel.length > 0 && onAction != null ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            { opacity: pressed ? 0.58 : 1 },
          ]}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderColor: palette.line,
    borderCurve: "continuous",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 92,
    padding: 16,
  },
  copy: { flex: 1, gap: 4 },
  title: {
    color: palette.text,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "700",
  },
  description: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
  },
  action: {
    borderBottomColor: palette.textMuted,
    borderBottomWidth: 1,
    paddingBottom: 2,
  },
  actionText: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "700",
  },
});
