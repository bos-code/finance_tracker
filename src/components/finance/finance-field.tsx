import { palette } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

export function FinanceField({
  error,
  label,
  multiline = false,
  ...inputProps
}: TextInputProps & {
  error?: string;
  label: string;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label.toLocaleUpperCase()}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        placeholderTextColor={palette.textQuiet}
        selectionColor={palette.textMuted}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          error ? styles.inputError : null,
          inputProps.style,
        ]}
      />
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
  input: {
    borderBottomColor: palette.lineStrong,
    borderBottomWidth: 1,
    color: palette.text,
    fontFamily: fonts.body,
    fontSize: 14,
    minHeight: 50,
    paddingHorizontal: 0,
    paddingVertical: 12,
  },
  multiline: { minHeight: 96, textAlignVertical: "top" },
  inputError: { borderBottomColor: palette.expense },
  error: {
    color: palette.expense,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
  },
});
