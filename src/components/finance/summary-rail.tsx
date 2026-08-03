import { palette } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { StyleSheet, Text, View } from "react-native";

export type SummaryItem = {
  label: string;
  tone?: "default" | "income" | "expense";
  value: string;
};

export function SummaryRail({ items }: { items: SummaryItem[] }) {
  return (
    <View style={styles.container}>
      {items.map((item, index) => {
        const signalColor =
          item.tone === "income"
            ? palette.income
            : item.tone === "expense"
              ? palette.expense
              : palette.textQuiet;
        return (
          <View key={item.label} style={styles.itemWrap}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <View style={styles.item}>
              <View style={[styles.signal, { backgroundColor: signalColor }]} />
              <Text style={styles.label}>{item.label}</Text>
              <Text numberOfLines={1} style={styles.value}>
                {item.value}
              </Text>
            </View>
          </View>
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
    paddingVertical: 18,
  },
  itemWrap: { flex: 1, flexDirection: "row" },
  divider: { backgroundColor: palette.line, marginHorizontal: 12, width: 1 },
  item: { flex: 1, gap: 5, minWidth: 0 },
  signal: { height: 1, marginBottom: 2, width: 22 },
  label: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 0.8,
  },
  value: {
    color: palette.text,
    fontFamily: fonts.ledger,
    fontSize: 10,
  },
});
