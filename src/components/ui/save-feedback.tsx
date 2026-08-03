import { ActionButton } from "@/components/finance/action-button";
import { palette, withAlpha } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef } from "react";
import { Modal, Platform, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

type FeedbackType = "success" | "error";

interface SaveFeedbackProps {
  visible: boolean;
  type: FeedbackType;
  title?: string;
  message?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  onDone: () => void;
}

export function SaveFeedback({
  visible,
  type,
  title,
  message,
  primaryActionLabel,
  onPrimaryAction,
  onDone,
}: SaveFeedbackProps) {
  const backdropOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.92);
  const cardOpacity = useSharedValue(0);
  const iconScale = useSharedValue(0);
  const iconRotate = useSharedValue(0);
  const rippleScale = useSharedValue(0.25);
  const rippleOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(8);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSuccess = type === "success";
  const signalColor = isSuccess ? palette.income : palette.expense;
  const hasPrimaryAction =
    isSuccess && Boolean(primaryActionLabel) && Boolean(onPrimaryAction);

  const dismiss = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 220 });
    cardScale.value = withTiming(0.94, { duration: 220 });
    cardOpacity.value = withTiming(0, { duration: 220 });
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(onDone, 240);
  }, [backdropOpacity, cardOpacity, cardScale, onDone]);

  useEffect(() => {
    if (!visible) return;

    backdropOpacity.value = 0;
    cardScale.value = 0.92;
    cardOpacity.value = 0;
    iconScale.value = 0;
    iconRotate.value = 0;
    rippleScale.value = 0.25;
    rippleOpacity.value = 0.58;
    textOpacity.value = 0;
    textTranslateY.value = 8;

    if (Platform.OS === "ios") {
      void Haptics.notificationAsync(
        isSuccess
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      );
    }

    backdropOpacity.value = withTiming(1, {
      duration: 180,
      easing: Easing.out(Easing.ease),
    });
    cardOpacity.value = withTiming(1, { duration: 220 });
    cardScale.value = withSpring(1, { damping: 17, stiffness: 210 });
    iconScale.value = withDelay(
      90,
      withSpring(1, { damping: 11, stiffness: 260 }),
    );
    rippleScale.value = withDelay(
      100,
      withTiming(2.25, {
        duration: 760,
        easing: Easing.out(Easing.cubic),
      }),
    );
    rippleOpacity.value = withDelay(100, withTiming(0, { duration: 760 }));

    if (!isSuccess) {
      iconRotate.value = withDelay(
        170,
        withSequence(
          withTiming(-10, { duration: 65 }),
          withTiming(10, { duration: 80 }),
          withTiming(-6, { duration: 70 }),
          withTiming(0, { duration: 70 }),
        ),
      );
    }

    textOpacity.value = withDelay(210, withTiming(1, { duration: 220 }));
    textTranslateY.value = withDelay(210, withSpring(0, { damping: 18 }));

    const autoExitTimer = hasPrimaryAction
      ? null
      : setTimeout(dismiss, 1550);

    return () => {
      if (autoExitTimer) clearTimeout(autoExitTimer);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [
    backdropOpacity,
    cardOpacity,
    cardScale,
    dismiss,
    hasPrimaryAction,
    iconRotate,
    iconScale,
    isSuccess,
    rippleOpacity,
    rippleScale,
    textOpacity,
    textTranslateY,
    visible,
  ]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: iconScale.value },
      { rotate: `${iconRotate.value}deg` },
    ],
  }));
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: rippleOpacity.value,
    transform: [{ scale: rippleScale.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  if (!visible) return null;

  return (
    <Modal
      animationType="none"
      onRequestClose={dismiss}
      statusBarTranslucent
      transparent
      visible={visible}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Animated.View
          accessibilityRole="alert"
          style={[styles.card, cardStyle]}>
          <View style={[styles.edgeThread, { backgroundColor: signalColor }]} />
          <Text style={styles.eyebrow}>
            {isSuccess ? "LEDGER CONFIRMED" : "ACTION INTERRUPTED"}
          </Text>

          <View style={styles.iconFrame}>
            <Animated.View
              style={[
                styles.ripple,
                { borderColor: withAlpha(signalColor, 0.52) },
                rippleStyle,
              ]}
            />
            <Animated.View
              style={[
                styles.icon,
                {
                  backgroundColor: withAlpha(signalColor, 0.08),
                  borderColor: withAlpha(signalColor, 0.46),
                },
                iconStyle,
              ]}>
              <MaterialCommunityIcons
                color={signalColor}
                name={isSuccess ? "check" : "close"}
                size={28}
              />
            </Animated.View>
          </View>

          <Animated.View style={[styles.copy, textStyle]}>
            <Text style={styles.title}>
              {title ?? (isSuccess ? "Entry recorded." : "Could not save.")}
            </Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            <View style={styles.signalRule}>
              <View
                style={[
                  styles.signalRuleColor,
                  { backgroundColor: signalColor },
                ]}
              />
            </View>

            {hasPrimaryAction ? (
              <View style={styles.actions}>
                <ActionButton
                  label={primaryActionLabel as string}
                  onPress={() => onPrimaryAction?.()}
                />
                <ActionButton label="Done" onPress={dismiss} tone="quiet" />
              </View>
            ) : (
              <Text style={styles.autoDismiss}>CLOSING AUTOMATICALLY</Text>
            )}
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: withAlpha(palette.black, 0.8),
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: 24,
    borderWidth: 1,
    maxWidth: 330,
    overflow: "hidden",
    padding: 28,
    position: "relative",
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.48,
    shadowRadius: 36,
    width: "100%",
    elevation: 28,
  },
  edgeThread: {
    bottom: 22,
    left: 0,
    position: "absolute",
    top: 22,
    width: 1,
  },
  eyebrow: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.72,
    marginBottom: 23,
  },
  iconFrame: {
    alignItems: "center",
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  ripple: {
    borderRadius: 36,
    borderWidth: 1,
    height: 72,
    position: "absolute",
    width: 72,
  },
  icon: {
    alignItems: "center",
    borderRadius: 21,
    borderWidth: 1,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  copy: { alignItems: "center", marginTop: 21, width: "100%" },
  title: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  message: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 8,
    textAlign: "center",
  },
  signalRule: {
    backgroundColor: palette.line,
    height: 1,
    marginVertical: 20,
    overflow: "hidden",
    width: 54,
  },
  signalRuleColor: { height: 1, width: 18 },
  actions: { gap: 9, width: "100%" },
  autoDismiss: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 6,
    letterSpacing: 0.55,
  },
});
