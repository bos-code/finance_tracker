import { SignalThreads } from "@/components/visuals/signal-threads";
import { palette } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function AuthShell({
  children,
  description,
  eyebrow,
  onBack,
  title,
}: {
  children: ReactNode;
  description: string;
  eyebrow: string;
  onBack?: () => void;
  title: string;
}) {
  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <SignalThreads intensity="visible" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.fill}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <MaterialCommunityIcons
                color={palette.text}
                name="finance"
                size={19}
              />
            </View>
            <View style={styles.brandCopy}>
              <Text style={styles.brandName}>FINANCE TRACKER</Text>
              <Text style={styles.brandSystem}>OBSIDIAN THREAD / 01</Text>
            </View>
            {onBack ? (
              <Pressable
                accessibilityLabel="Go back"
                accessibilityRole="button"
                onPress={onBack}
                style={({ pressed }) => [
                  styles.backButton,
                  { opacity: pressed ? 0.56 : 1 },
                ]}>
                <MaterialCommunityIcons
                  color={palette.textMuted}
                  name="arrow-left"
                  size={18}
                />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.heading}>
            <View style={styles.eyebrowRow}>
              <View style={styles.headingThread} />
              <Text style={styles.eyebrow}>{eyebrow}</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
          </View>

          <View style={styles.form}>{children}</View>
          <Text style={styles.footer}>
            YOUR RECORD / USER-SCOPED / REVIEW BEFORE AUTOMATION
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: palette.canvas, flex: 1 },
  fill: { flex: 1 },
  scrollContent: {
    alignSelf: "center",
    flexGrow: 1,
    maxWidth: 560,
    paddingBottom: 40,
    paddingHorizontal: 24,
    width: "100%",
  },
  brandRow: {
    alignItems: "center",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 82,
  },
  brandMark: {
    alignItems: "center",
    borderColor: palette.lineStrong,
    borderRadius: 13,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    marginRight: 12,
    width: 42,
  },
  brandCopy: { flex: 1, gap: 4 },
  brandName: {
    color: palette.text,
    fontFamily: fonts.ledger,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  brandSystem: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.45,
  },
  backButton: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 12,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  heading: { gap: 10, paddingBottom: 34, paddingTop: 42 },
  eyebrowRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  headingThread: { backgroundColor: palette.signalViolet, height: 1, width: 34 },
  eyebrow: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 0.85,
  },
  title: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 43,
    letterSpacing: -1,
    lineHeight: 49,
  },
  description: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 19,
    maxWidth: 450,
  },
  form: { gap: 22 },
  footer: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.35,
    marginTop: "auto",
    paddingTop: 38,
    textAlign: "center",
  },
});
