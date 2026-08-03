import { useOffline } from "@/context/offline-context";
import { useAppStore } from "@/store/use-app-store";
import { palette } from "@/theme/colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * OfflineBanner
 *
 * Slides down from the top of the screen:
 *  - Yellow/amber  when the device is offline
 *  - Blue spinner  while syncing
 *  - Green "Synced ✓" for 2.5 s after ops are flushed
 *  - Hidden        when online + no pending work
 */
export function OfflineBanner() {
  const { isOnline, isSyncing, pendingCount, justSynced } = useOffline();
  const theme = useAppStore((s) => s.theme);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const visible = !isOnline || isSyncing || justSynced;

  const translateY = useSharedValue(-80);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, {
        duration: reduceMotion ? 0 : 180,
      });
      opacity.value = withTiming(1, { duration: reduceMotion ? 0 : 140 });
    } else {
      translateY.value = withTiming(-80, {
        duration: reduceMotion ? 0 : 220,
      });
      opacity.value = withTiming(0, { duration: reduceMotion ? 0 : 140 });
    }
  }, [opacity, reduceMotion, translateY, visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  // Determine what to show
  const { icon, message, signal } = (() => {
    if (justSynced) return { icon: "check-circle-outline", signal: palette.income, message: "Synced successfully" };
    if (isSyncing) return { icon: "sync", signal: theme.primary, message: `Syncing ${pendingCount} change${pendingCount !== 1 ? "s" : ""}…` };
    return {
      icon: "wifi-off",
      signal: palette.warning,
      message: pendingCount > 0
        ? `Offline — ${pendingCount} change${pendingCount !== 1 ? "s" : ""} queued`
        : "No connection — read-only mode",
    };
  })();

  return (
    <Animated.View
      style={[
        animStyle,
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 999,
          paddingTop: Math.max(insets.top, 8),
          paddingBottom: 10,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: palette.surfaceRaised,
          borderBottomColor: palette.lineStrong,
          borderBottomWidth: 1,
        },
      ]}
    >
      <View style={{ alignSelf: "stretch", backgroundColor: signal, width: 2 }} />
      <MaterialCommunityIcons name={icon as any} size={18} color={signal} />
      <Text style={{ color: palette.text, fontWeight: "700", fontSize: 13, flex: 1 }}>
        {message}
      </Text>
    </Animated.View>
  );
}
