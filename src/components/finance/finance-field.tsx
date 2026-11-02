import { type AppTheme, useStyles, useTheme } from "@/theme/theme-context";

import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import type { ReactNode, Ref } from "react";

export function FinanceField({
  error,
  inputRef,
  label,
  multiline = false,
  trailing,
  ...inputProps
}: TextInputProps & {
  error?: string;
  inputRef?: Ref<TextInput>;
  label: string;
  trailing?: ReactNode;
}) {
  const { palette } = useTheme();
  const styles = useStyles(createStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label.toLocaleUpperCase()}</Text>
      <View
        style={[
          styles.inputRow,
          multiline ? styles.multiline : null,
          error ? styles.inputRowError : null,
        ]}>
        <TextInput
          {...inputProps}
          multiline={multiline}
          placeholderTextColor={palette.textQuiet}
          ref={inputRef}
          selectionColor={palette.textMuted}
          style={[styles.input, multiline ? styles.multilineInput : null, inputProps.style]}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const createStyles = ({ palette, fonts, fs, lh }: AppTheme) =>
  StyleSheet.create({
  container: { gap: 8 },
  label: {
    color: palette.textMuted,
    fontFamily: fonts.ledger,
    fontSize: fs(11),
    letterSpacing: 0.8,
  },
  // A bordered box, so it is clear where to tap and type.
  inputRow: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 52,
    paddingHorizontal: 14,
  },
  inputRowError: { borderColor: palette.expense },
  input: {
    color: palette.text,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fs(16),
    // Lets the field shrink on narrow screens so the trailing icon keeps its gap.
    minWidth: 0,
    minHeight: 50,
    paddingHorizontal: 0,
    paddingVertical: 12,
  },
  multiline: { alignItems: "flex-start", minHeight: 96 },
  multilineInput: { minHeight: 95, textAlignVertical: "top" },
  trailing: { alignItems: "center", justifyContent: "center", marginLeft: 10 },
  error: {
    color: palette.expense,
    fontFamily: fonts.body,
    fontSize: fs(13),
    lineHeight: lh(13, 18),
  },
});
