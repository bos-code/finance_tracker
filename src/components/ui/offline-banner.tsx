import { useOffline } from "@/context/offline-context";
import { useAppStore } from "@/store/use-app-store";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
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

  const visible = !isOnline || isSyncing || justSynced;

  const translateY = useSharedValue(-80);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 18, stiffness: 180 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withTiming(-80, { duration: 300 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  // Determine what to show
  const { bg, icon, iconColor, message } = (() => {
    if (justSynced) return { bg: "#16a34a", icon: "check-circle-outline", iconColor: "#fff", message: "Synced successfully" };
    if (isSyncing) return { bg: theme.primary, icon: "sync", iconColor: "#fff", message: `Syncing ${pendingCount} change${pendingCount !== 1 ? "s" : ""}…` };
    return {
      bg: "#b45309",
      icon: "wifi-off",
      iconColor: "#fff",
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
          backgroundColor: bg,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 10,
        },
      ]}
    >
      <MaterialCommunityIcons name={icon as any} size={18} color={iconColor} />
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13, flex: 1 }}>
        {message}
      </Text>
    </Animated.View>
  );
}
