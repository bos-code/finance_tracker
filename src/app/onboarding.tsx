import { SignalThreads } from "@/components/visuals/signal-threads";
import { UI_PREVIEW_ENABLED } from "@/config/runtime";
import { useAuth } from "@/hooks/use-auth";
import { ROUTES } from "@/navigation/route-names";
import { palette, withAlpha } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ONBOARDING_COMPLETE_KEY = "@finance_tracker_onboarding_complete";

const STEPS = [
  {
    body: "See the current position, what moved recently, and the exact entries behind every total.",
    eyebrow: "POSITION / 01",
    icon: "chart-timeline-variant-shimmer",
    points: ["Living monthly position", "Exact ledger movement"],
    signal: palette.signalCyan,
    title: "Know what changed.",
  },
  {
    body: "Record income and outflow in a few deliberate steps. Offline writes remain visible until they sync.",
    eyebrow: "CAPTURE / 02",
    icon: "pencil-plus-outline",
    points: ["Offline-safe capture", "Clear pending status"],
    signal: palette.signalAmber,
    title: "Capture without friction.",
  },
  {
    body: "Your record is user-scoped. Receipts stay private, and extracted or automated fields require review before they apply.",
    eyebrow: "CONTROL / 03",
    icon: "shield-lock-outline",
    points: ["Private by default", "Review before automation"],
    signal: palette.signalMoss,
    title: "Keep control of the record.",
  },
] as const;

export default function OnboardingScreen() {
  const { isBootstrapping, user } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [isReady, setIsReady] = useState(UI_PREVIEW_ENABLED);
  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  useEffect(() => {
    if (UI_PREVIEW_ENABLED || isBootstrapping) return;
    let mounted = true;
    const restore = async () => {
      try {
        const complete = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
        if (!mounted) return;
        if (complete === "1") {
          router.replace(user ? ROUTES.TABS_HOME : ROUTES.AUTH);
          return;
        }
      } catch {
        // Storage failure should not trap someone on a blank launch screen.
      } finally {
        if (mounted) setIsReady(true);
      }
    };
    void restore();
    return () => {
      mounted = false;
    };
  }, [isBootstrapping, user]);

  const finish = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "1");
    } finally {
      router.replace(user ? ROUTES.TABS_HOME : ROUTES.AUTH);
    }
  };

  const continueFlow = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLast) {
      void finish();
      return;
    }
    setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
  };

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={palette.textMuted} size="small" />
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <SignalThreads intensity="visible" />
      <View style={styles.container}>
        <View style={styles.topbar}>
          <View style={styles.brandMark}>
            <MaterialCommunityIcons
              color={palette.text}
              name="finance"
              size={19}
            />
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>FINANCE TRACKER</Text>
            <Text style={styles.brandMeta}>PERSONAL LEDGER / MOBILE</Text>
          </View>
          {!isLast ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void finish()}
              style={({ pressed }) => [
                styles.skip,
                { opacity: pressed ? 0.5 : 1 },
              ]}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.main}>
          <View style={styles.visualField}>
            <View
              style={[styles.visualThread, { backgroundColor: step.signal }]}
            />
            <View style={styles.visualOrbitLarge} />
            <View style={styles.visualOrbitSmall} />
            <View style={styles.visualMark}>
              <MaterialCommunityIcons
                color={palette.text}
                name={step.icon}
                size={32}
              />
            </View>
            <Text style={styles.visualIndex}>
              {(stepIndex + 1).toString().padStart(2, "0")}
            </Text>
          </View>

          <View style={styles.copy}>
            <View style={styles.eyebrowRow}>
              <View style={[styles.copyThread, { backgroundColor: step.signal }]} />
              <Text style={styles.eyebrow}>{step.eyebrow}</Text>
            </View>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>

            <View style={styles.points}>
              {step.points.map((point, index) => (
                <View key={point} style={styles.point}>
                  <Text style={styles.pointIndex}>
                    {(index + 1).toString().padStart(2, "0")}
                  </Text>
                  <View style={styles.pointRule} />
                  <Text style={styles.pointText}>{point}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.bottom}>
          <View style={styles.progress}>
            {STEPS.map((item, index) => (
              <View
                key={item.eyebrow}
                style={[
                  styles.progressTrack,
                  index <= stepIndex
                    ? { backgroundColor: index === stepIndex ? step.signal : palette.textMuted }
                    : null,
                ]}
              />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={continueFlow}
            style={({ pressed }) => [
              styles.continueButton,
              { opacity: pressed ? 0.65 : 1 },
            ]}>
            <Text style={styles.continueText}>
              {isLast ? "Enter Finance Tracker" : "Continue"}
            </Text>
            <MaterialCommunityIcons
              color={palette.black}
              name="arrow-right"
              size={18}
            />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    backgroundColor: palette.canvas,
    flex: 1,
    justifyContent: "center",
  },
  safeArea: { backgroundColor: palette.canvas, flex: 1 },
  container: {
    alignSelf: "center",
    flex: 1,
    maxWidth: 720,
    paddingHorizontal: 24,
    width: "100%",
  },
  topbar: {
    alignItems: "center",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 78,
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
    letterSpacing: 0.75,
  },
  brandMeta: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.4,
  },
  skip: { padding: 10 },
  skipText: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "700",
  },
  main: { flex: 1, justifyContent: "center", paddingVertical: 22 },
  visualField: {
    alignSelf: "center",
    height: 176,
    justifyContent: "center",
    marginBottom: 26,
    position: "relative",
    width: 220,
  },
  visualThread: {
    height: 1,
    left: 0,
    position: "absolute",
    right: 0,
    top: "50%",
  },
  visualOrbitLarge: {
    borderColor: palette.lineStrong,
    borderRadius: 82,
    borderWidth: 1,
    height: 164,
    left: 28,
    position: "absolute",
    top: 6,
    transform: [{ rotate: "-8deg" }],
    width: 164,
  },
  visualOrbitSmall: {
    borderColor: withAlpha(palette.signalViolet, 0.34),
    borderRadius: 59,
    borderWidth: 1,
    height: 118,
    left: 51,
    position: "absolute",
    top: 29,
    transform: [{ rotate: "12deg" }],
    width: 118,
  },
  visualMark: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: 28,
    borderWidth: 1,
    height: 76,
    justifyContent: "center",
    left: 72,
    position: "absolute",
    top: 50,
    width: 76,
  },
  visualIndex: {
    bottom: 12,
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 8,
    position: "absolute",
    right: 8,
  },
  copy: { gap: 12 },
  eyebrowRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  copyThread: { height: 1, width: 36 },
  eyebrow: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 0.8,
  },
  title: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 41,
    letterSpacing: -0.9,
    lineHeight: 47,
  },
  body: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 19,
    maxWidth: 540,
  },
  points: { marginTop: 8 },
  point: {
    alignItems: "center",
    borderTopColor: palette.line,
    borderTopWidth: 1,
    flexDirection: "row",
    minHeight: 44,
  },
  pointIndex: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    width: 25,
  },
  pointRule: { backgroundColor: palette.lineStrong, height: 1, marginRight: 10, width: 20 },
  pointText: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 10,
  },
  bottom: { paddingBottom: 18 },
  progress: { flexDirection: "row", gap: 7, marginBottom: 16 },
  progressTrack: { backgroundColor: palette.line, flex: 1, height: 2 },
  continueButton: {
    alignItems: "center",
    backgroundColor: palette.text,
    borderRadius: 15,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 54,
  },
  continueText: {
    color: palette.black,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "700",
    marginRight: 10,
  },
});
