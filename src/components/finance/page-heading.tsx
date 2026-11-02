import { type AppTheme, useStyles } from "@/theme/theme-context";

import { StyleSheet, Text, View } from "react-native";

export function PageHeading({
  description,
  eyebrow,
  title,
}: {
  description: string;
  eyebrow: string;
  title: string;
}) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.container}>
      <View style={styles.eyebrowRow}>
        <View style={styles.signal} />
        <Text style={styles.eyebrow}>{eyebrow}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const createStyles = ({ palette, fonts, fs, lh }: AppTheme) =>
  StyleSheet.create({
  container: { gap: 8, paddingBottom: 24, paddingTop: 12 },
  eyebrowRow: { alignItems: "center", flexDirection: "row", gap: 9 },
  signal: {
    backgroundColor: palette.signalCyan,
    height: 1,
    width: 28,
  },
  eyebrow: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: fs(9),
    letterSpacing: 1.2,
  },
  title: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: fs(38),
    letterSpacing: -0.8,
  },
  description: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: fs(13),
    lineHeight: lh(13, 19),
    maxWidth: 330,
  },
});
