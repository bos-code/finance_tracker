import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { View, Text, Modal, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
} from "react-native-reanimated";

type FeedbackType = "success" | "error";

interface SaveFeedbackProps {
  visible: boolean;
  type: FeedbackType;
  message?: string;
  onDone: () => void;
}

export function SaveFeedback({ visible, type, message, onDone }: SaveFeedbackProps) {
  const backdropOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.5);
  const cardOpacity = useSharedValue(0);
  const iconScale = useSharedValue(0);
  const iconRotate = useSharedValue(0);
  const checkStroke = useSharedValue(0);
  const rippleScale = useSharedValue(0.3);
  const rippleOpacity = useSharedValue(0.8);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(10);

  const isSuccess = type === "success";
  const primaryColor = isSuccess ? "#22c55e" : "#ef4444";
  const bgColor = isSuccess ? "#f0fdf4" : "#fef2f2";
  const ringColor = isSuccess ? "#bbf7d0" : "#fecaca";

  function dismiss() {
    onDone();
  }

  useEffect(() => {
    if (!visible) return;

    // Haptic on entry
    if (Platform.OS === "ios") {
      if (isSuccess) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }

    // --- ENTRANCE ---
    backdropOpacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) });

    cardOpacity.value = withTiming(1, { duration: 220 });
    cardScale.value = withSpring(1, { damping: 14, stiffness: 200 });

    // Icon pops in with overshoot
    iconScale.value = withDelay(
      120,
      withSpring(1, { damping: 10, stiffness: 260 })
    );

    // Ripple expands outward
    rippleScale.value = withDelay(
      120,
      withTiming(2.4, { duration: 700, easing: Easing.out(Easing.cubic) })
    );
    rippleOpacity.value = withDelay(
      120,
      withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) })
    );

    // Icon wiggle for error
    if (!isSuccess) {
      iconRotate.value = withDelay(
        200,
        withSequence(
          withTiming(-12, { duration: 60 }),
          withTiming(12, { duration: 80 }),
          withTiming(-8, { duration: 70 }),
          withTiming(8, { duration: 70 }),
          withTiming(0, { duration: 60 })
        )
      );
    }

    // Text slides up
    textOpacity.value = withDelay(250, withTiming(1, { duration: 250 }));
    textTranslateY.value = withDelay(250, withSpring(0, { damping: 16 }));

    // --- AUTO EXIT after 1.5s ---
    const timer = setTimeout(() => {
      backdropOpacity.value = withTiming(0, { duration: 250 });
      cardScale.value = withTiming(0.85, { duration: 250 });
      cardOpacity.value = withTiming(0, { duration: 250 });
      setTimeout(() => runOnJS(dismiss)(), 270);
    }, 1500);

    return () => clearTimeout(timer);
  }, [visible]);

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
    <Modal transparent statusBarTranslucent animationType="none" visible={visible}>
      {/* Blurred backdrop */}
      <Animated.View
        style={[backdropStyle, { flex: 1, backgroundColor: "rgba(10,18,40,0.45)", alignItems: "center", justifyContent: "center" }]}
      >
        {/* Card */}
        <Animated.View
          style={[
            cardStyle,
            {
              backgroundColor: "#fff",
              borderRadius: 32,
              padding: 40,
              alignItems: "center",
              width: 260,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 20 },
              shadowOpacity: 0.18,
              shadowRadius: 40,
              elevation: 30,
            },
          ]}
        >
          {/* Icon container */}
          <View style={{ alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
            {/* Ripple ring */}
            <Animated.View
              style={[
                rippleStyle,
                {
                  position: "absolute",
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: ringColor,
                },
              ]}
            />

            {/* Solid bg circle */}
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: bgColor,
                borderWidth: 2.5,
                borderColor: ringColor,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Animated.View style={iconStyle}>
                <MaterialCommunityIcons
                  name={isSuccess ? "check-circle" : "close-circle"}
                  size={52}
                  color={primaryColor}
                />
              </Animated.View>
            </View>
          </View>

          {/* Text */}
          <Animated.View style={[textStyle, { alignItems: "center" }]}>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                color: "#0f172a",
                marginBottom: 6,
                textAlign: "center",
              }}
            >
              {isSuccess ? "Saved!" : "Failed"}
            </Text>
            {message ? (
              <Text
                style={{
                  fontSize: 14,
                  color: "#64748b",
                  textAlign: "center",
                  lineHeight: 20,
                }}
              >
                {message}
              </Text>
            ) : null}

            {/* Thin coloured divider bar */}
            <View
              style={{
                marginTop: 20,
                height: 4,
                width: 48,
                borderRadius: 99,
                backgroundColor: primaryColor,
                opacity: 0.35,
              }}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
