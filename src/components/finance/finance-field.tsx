import { palette } from "@/theme/colors";
import { fonts } from "@/theme/typography";
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

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 0.75,
  },
  inputRow: {
    alignItems: "center",
    borderBottomColor: palette.lineStrong,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 50,
  },
  inputRowError: { borderBottomColor: palette.expense },
  input: {
    color: palette.text,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    minHeight: 49,
    paddingHorizontal: 0,
    paddingVertical: 12,
  },
  multiline: { alignItems: "flex-start", minHeight: 96 },
  multilineInput: { minHeight: 95, textAlignVertical: "top" },
  trailing: { alignItems: "center", justifyContent: "center", marginLeft: 10 },
  error: {
    color: palette.expense,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
  },
});
