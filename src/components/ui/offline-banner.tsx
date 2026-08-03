import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOffline } from "@/context/offline-context";
import { palette } from "@/theme/colors";

export function OfflineBanner() {
  const {
    conflictCount,
    failedCount,
    isOnline,
    isSyncing,
    justSynced,
    pendingCount,
    retryFailed,
    syncNow,
  } = useOffline();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const visible =
    !isOnline ||
    isSyncing ||
    justSynced ||
    pendingCount > 0 ||
    failedCount > 0 ||
    conflictCount > 0;
  const translateY = useSharedValue(-96);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : -96, {
      duration: reduceMotion ? 0 : visible ? 180 : 220,
    });
    opacity.value = withTiming(visible ? 1 : 0, {
      duration: reduceMotion ? 0 : 140,
    });
  }, [opacity, reduceMotion, translateY, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const state = (() => {
    if (conflictCount > 0) {
      return {
        action: undefined,
        actionLabel: undefined,
        icon: "alert-octagon-outline",
        message: `${conflictCount} ${conflictCount === 1 ? "change needs" : "changes need"} review`,
        signal: palette.expense,
      };
    }
    if (failedCount > 0) {
      return {
        action: isOnline ? retryFailed : undefined,
        actionLabel: isOnline ? "Retry" : undefined,
        icon: "cloud-alert-outline",
        message: `${failedCount} ${failedCount === 1 ? "change" : "changes"} could not sync`,
        signal: palette.warning,
      };
    }
    if (justSynced) {
      return {
        action: undefined,
        actionLabel: undefined,
        icon: "check-circle-outline",
        message: "Ledger synchronized",
        signal: palette.income,
      };
    }
    if (isSyncing) {
      return {
        action: undefined,
        actionLabel: undefined,
        icon: "sync",
        message: `Synchronizing ${pendingCount} ${pendingCount === 1 ? "change" : "changes"}`,
        signal: palette.signalCyan,
      };
    }
    if (isOnline && pendingCount > 0) {
      return {
        action: syncNow,
        actionLabel: "Sync",
        icon: "cloud-clock-outline",
        message: `${pendingCount} ${pendingCount === 1 ? "change is" : "changes are"} waiting to sync`,
        signal: palette.warning,
      };
    }
    return {
      action: undefined,
      actionLabel: undefined,
      icon: "wifi-off",
      message:
        pendingCount > 0
          ? `Offline · ${pendingCount} ${pendingCount === 1 ? "change" : "changes"} secured locally`
          : "No connection · ledger is read-only",
      signal: palette.warning,
    };
  })();

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[
        animatedStyle,
        {
          alignItems: "center",
          backgroundColor: palette.surfaceRaised,
          borderBottomColor: palette.lineStrong,
          borderBottomWidth: 1,
          flexDirection: "row",
          gap: 10,
          left: 0,
          paddingBottom: 10,
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top, 8),
          position: "absolute",
          right: 0,
          top: 0,
          zIndex: 999,
        },
      ]}>
      <View
        style={{ alignSelf: "stretch", backgroundColor: state.signal, width: 2 }}
      />
      <MaterialCommunityIcons
        color={state.signal}
        name={state.icon as never}
        size={18}
      />
      <Text
        style={{ color: palette.text, flex: 1, fontSize: 13, fontWeight: "700" }}>
        {state.message}
      </Text>
      {state.action && state.actionLabel ? (
        <Pressable
          accessibilityLabel={`${state.actionLabel} synchronization`}
          accessibilityRole="button"
          onPress={() => void state.action?.()}
          style={({ pressed }) => ({
            borderColor: palette.lineStrong,
            borderWidth: 1,
            opacity: pressed ? 0.6 : 1,
            paddingHorizontal: 10,
            paddingVertical: 6,
          })}>
          <Text
            style={{ color: palette.text, fontSize: 10, fontWeight: "800" }}>
            {state.actionLabel.toUpperCase()}
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
