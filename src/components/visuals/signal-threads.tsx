import { palette, withAlpha } from "@/theme/colors";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

type SignalThreadsProps = {
  intensity?: "quiet" | "visible";
};

/**
 * A single, low-cost animated layer: color lives in thin traces while the
 * financial UI remains monochrome. The whole layer moves on transform only.
 */
export function SignalThreads({ intensity = "quiet" }: SignalThreadsProps) {
  const reduceMotion = useReducedMotion();
  const phase = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      phase.value = 0;
      return;
    }

    phase.value = withRepeat(withTiming(1, { duration: 14000 }), -1, true);
    return () => cancelAnimation(phase);
  }, [phase, reduceMotion]);

  const motionStyle = useAnimatedStyle(() => ({
    opacity: intensity === "visible" ? 0.9 : 0.62,
    transform: [
      { translateX: interpolate(phase.value, [0, 1], [-10, 14]) },
      { translateY: interpolate(phase.value, [0, 1], [4, -8]) },
      { rotate: `${interpolate(phase.value, [0, 1], [-1.5, 1.5])}deg` },
    ],
  }));

  return (
    <View pointerEvents="none" style={styles.clip}>
      <Animated.View style={[styles.field, motionStyle]}>
        <View style={[styles.thread, styles.threadAmber]} />
        <View style={[styles.thread, styles.threadViolet]} />
        <View style={[styles.thread, styles.threadCyan]} />
        <View style={styles.verticalSignal} />
        <View style={styles.signalNode} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  field: {
    ...StyleSheet.absoluteFillObject,
  },
  thread: {
    borderCurve: "continuous",
    borderRadius: 999,
    borderWidth: 1,
    height: 150,
    position: "absolute",
    right: -170,
    width: 500,
  },
  threadAmber: {
    borderColor: withAlpha(palette.signalAmber, 0.24),
    top: 28,
    transform: [{ rotate: "-8deg" }],
  },
  threadViolet: {
    borderColor: withAlpha(palette.signalViolet, 0.2),
    top: 54,
    transform: [{ rotate: "-4deg" }],
  },
  threadCyan: {
    borderColor: withAlpha(palette.signalCyan, 0.16),
    top: 82,
    transform: [{ rotate: "1deg" }],
  },
  verticalSignal: {
    backgroundColor: withAlpha(palette.signalMoss, 0.3),
    height: 74,
    position: "absolute",
    right: 26,
    top: 0,
    width: 1,
  },
  signalNode: {
    backgroundColor: palette.signalAmber,
    borderRadius: 3,
    height: 5,
    position: "absolute",
    right: 24,
    top: 72,
    width: 5,
  },
});
