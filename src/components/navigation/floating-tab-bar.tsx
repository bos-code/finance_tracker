import { useAppStore } from "@/store/use-app-store";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabMeta = {
  icon: string;
  activeIcon: string;
  fallbackLabel: string;
};

const TAB_META: Record<string, TabMeta> = {
  "home/index": {
    icon: "view-dashboard-outline",
    activeIcon: "view-dashboard",
    fallbackLabel: "Home",
  },
  "calender/index": {
    icon: "calendar-month-outline",
    activeIcon: "calendar-month",
    fallbackLabel: "Calendar",
  },
  "goals/index": {
    icon: "target",
    activeIcon: "bullseye-arrow",
    fallbackLabel: "Goals",
  },
  "chartpie/index": {
    icon: "chart-donut",
    activeIcon: "chart-donut-variant",
    fallbackLabel: "Stats",
  },
  "user/index": {
    icon: "account-circle-outline",
    activeIcon: "account-circle",
    fallbackLabel: "Profile",
  },
};

const SPRING_CONFIG = {
  damping: 18,
  stiffness: 220,
  mass: 0.8,
};

/**
 * Converts a 6-digit hex color string to an `rgba(r, g, b, a)` string using the given opacity.
 *
 * If `hexColor` (after removing a leading `#`) is not exactly 6 hex digits, the original `hexColor` is returned unchanged.
 *
 * @param hexColor - Hex color string such as "#RRGGBB" or "RRGGBB"
 * @param alpha - Opacity between 0 and 1
 * @returns An `rgba(r, g, b, alpha)` string when conversion succeeds, otherwise the original `hexColor`
 */
function withAlpha(hexColor: string, alpha: number) {
  const hex = hexColor.replace("#", "");

  if (hex.length !== 6) {
    return hexColor;
  }

  const value = Number.parseInt(hex, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Resolve the display label for a route.
 *
 * @param routeName - The route identifier (e.g., "home/index")
 * @param title - An optional title provided by route options; ignored if empty or only whitespace
 * @returns The label to display: `title` if it contains non-whitespace characters, otherwise the route's configured fallback label if available, or the `routeName` with a trailing `"/index"` removed
 */
function resolveLabel(routeName: string, title?: string) {
  if (title?.trim()) return title;
  return TAB_META[routeName]?.fallbackLabel ?? routeName.replace("/index", "");
}

/**
 * Renders a single tab bar item with an animated lift, an icon that switches when focused, and a label.
 *
 * @param focused - Whether this tab is currently focused; controls animation and styling.
 * @param label - Text label displayed under the icon.
 * @param icon - Name of the icon to show when not focused.
 * @param activeIcon - Name of the icon to show when focused.
 * @param onLongPress - Handler invoked on long press.
 * @param onPress - Handler invoked on press.
 * @param primary - Primary theme color used for the focused background, border, and shadow.
 * @returns The rendered tab bar item element.
 */
function TabBarItem({
  focused,
  label,
  icon,
  activeIcon,
  onLongPress,
  onPress,
  primary,
}: {
  focused: boolean;
  label: string;
  icon: string;
  activeIcon: string;
  onLongPress: () => void;
  onPress: () => void;
  primary: string;
}) {
  const lift = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    lift.value = withSpring(focused ? 1 : 0, SPRING_CONFIG);
  }, [focused, lift]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -4 * lift.value },
      { scale: 0.985 + 0.03 * lift.value },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: 0.72 + 0.28 * lift.value,
    transform: [{ translateY: 2 - 2 * lift.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      onLongPress={onLongPress}
      onPress={onPress}
      style={styles.tabButton}
    >
      <Animated.View style={[styles.itemInner, containerStyle]}>
        <View
          style={[
            styles.iconWrap,
            focused
              ? {
                  backgroundColor: primary,
                  borderColor: withAlpha(primary, 0.2),
                  shadowColor: primary,
                  shadowOpacity: 0.3,
                  elevation: 6,
                }
              : {
                  backgroundColor: "rgba(255,255,255,0.78)",
                  borderColor: "rgba(148,163,184,0.16)",
                  shadowOpacity: 0.08,
                  elevation: 2,
                },
          ]}
        >
          <MaterialCommunityIcons
            color={focused ? "#ffffff" : primary}
            name={(focused ? activeIcon : icon) as any}
            size={20}
          />
        </View>

        <Animated.Text
          numberOfLines={1}
          style={[
            styles.label,
            { color: focused ? "#0f172a" : "#64748b" },
            labelStyle,
          ]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Render a blurred, floating bottom tab bar with a moving active "pill" indicator and animated per-route tab items.
 *
 * @param descriptors - Route descriptors used to obtain options and metadata for each tab
 * @param navigation - Navigation object used to emit tab events and navigate between routes
 * @param state - Navigation state containing the list of routes and the currently focused index
 * @returns A React element that displays the floating tab bar UI
 */
export function FloatingTabBar({
  descriptors,
  navigation,
  state,
}: BottomTabBarProps) {
  const theme = useAppStore((store) => store.theme);
  const insets = useSafeAreaInsets();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const position = useSharedValue(state.index);
  const primary = theme.primary;
  const secondary = theme.gradient.colors[1];
  const slotWidth = layoutWidth > 0 ? layoutWidth / state.routes.length : 0;
  const indicatorWidth = slotWidth > 0 ? Math.max(slotWidth - 10, 56) : 0;

  useEffect(() => {
    position.value = withSpring(state.index, SPRING_CONFIG);
  }, [position, state.index]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorWidth ? 1 : 0,
    width: indicatorWidth,
    transform: [{ translateX: 5 + position.value * slotWidth }],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        { paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      <View
        style={[
          styles.shell,
          {
            borderColor: withAlpha(primary, 0.16),
            shadowColor: primary,
          },
        ]}
      >
        <BlurView
          experimentalBlurMethod="dimezisBlurView"
          intensity={Platform.OS === "ios" ? 70 : 90}
          style={styles.blur}
          tint="light"
        >
          <View
            style={[
              styles.chromeGlow,
              { backgroundColor: withAlpha(secondary, 0.11) },
            ]}
          />

          <View
            onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width)}
            style={styles.row}
          >
            <Animated.View
              style={[
                styles.activePill,
                {
                  backgroundColor: "rgba(255,255,255,0.92)",
                  borderColor: withAlpha(primary, 0.16),
                  shadowColor: primary,
                },
                indicatorStyle,
              ]}
            >
              <View
                style={[
                  styles.activePillGlow,
                  { backgroundColor: withAlpha(secondary, 0.12) },
                ]}
              />
              <View
                style={[
                  styles.activePillAccent,
                  { backgroundColor: primary },
                ]}
              />
            </Animated.View>

            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key];
              const meta = TAB_META[route.name];
              const focused = state.index === index;
              const label = resolveLabel(
                route.name,
                typeof options.title === "string" ? options.title : undefined,
              );

              const onPress = () => {
                const event = navigation.emit({
                  canPreventDefault: true,
                  target: route.key,
                  type: "tabPress",
                });

                if (focused || event.defaultPrevented) {
                  return;
                }

                void Haptics.selectionAsync();
                navigation.navigate(route.name);
              };

              const onLongPress = () => {
                navigation.emit({
                  target: route.key,
                  type: "tabLongPress",
                });
              };

              return (
                <TabBarItem
                  activeIcon={meta?.activeIcon ?? "checkbox-marked-circle"}
                  focused={focused}
                  icon={meta?.icon ?? "checkbox-blank-circle-outline"}
                  key={route.key}
                  label={label}
                  onLongPress={onLongPress}
                  onPress={onPress}
                  primary={primary}
                />
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    bottom: 0,
    left: 0,
    paddingHorizontal: 16,
    position: "absolute",
    right: 0,
  },
  shell: {
    borderRadius: 30,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
  },
  blur: {
    backgroundColor: "rgba(248,250,252,0.82)",
    minHeight: 82,
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 8,
    position: "relative",
  },
  chromeGlow: {
    borderRadius: 999,
    height: 110,
    position: "absolute",
    right: -16,
    top: -46,
    width: 110,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    position: "relative",
  },
  activePill: {
    borderRadius: 24,
    borderWidth: 1,
    bottom: 4,
    left: 0,
    position: "absolute",
    top: 4,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  activePillGlow: {
    borderRadius: 999,
    height: 58,
    position: "absolute",
    right: -12,
    top: -22,
    width: 58,
  },
  activePillAccent: {
    borderRadius: 999,
    height: 4,
    left: 18,
    position: "absolute",
    top: 10,
    width: 28,
  },
  tabButton: {
    flex: 1,
    zIndex: 1,
  },
  itemInner: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 66,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  iconWrap: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    width: 38,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
    marginTop: 7,
  },
});
