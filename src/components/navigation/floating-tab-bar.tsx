import { type AppTheme, useStyles, useTheme } from "@/theme/theme-context";
import { withAlpha } from "@/theme/colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabMeta = {
  icon: string;
  activeIcon: string;
  fallbackLabel: string;
};

const TAB_META: Record<string, TabMeta> = {
  "home/index": {
    icon: "home-variant-outline",
    activeIcon: "home-variant",
    fallbackLabel: "Home",
  },
  "calender/index": {
    icon: "book-open-page-variant-outline",
    activeIcon: "book-open-page-variant",
    fallbackLabel: "Ledger",
  },
  "goals/index": {
    icon: "target",
    activeIcon: "bullseye-arrow",
    fallbackLabel: "Goals",
  },
  "chartpie/index": {
    icon: "chart-timeline-variant-shimmer",
    activeIcon: "chart-timeline-variant",
    fallbackLabel: "Insights",
  },
  "user/index": {
    icon: "account-outline",
    activeIcon: "account",
    fallbackLabel: "Profile",
  },
};

// The circle sits exactly behind the icon and ends above the label, so the
// active tab's name is never covered.
const ORBIT_SIZE = 38;

function resolveLabel(routeName: string, title?: string) {
  if (title?.trim()) return title;
  return TAB_META[routeName]?.fallbackLabel ?? routeName.replace("/index", "");
}

function TabBarItem({
  focused,
  label,
  icon,
  activeIcon,
  onLongPress,
  onPress,
}: {
  focused: boolean;
  label: string;
  icon: string;
  activeIcon: string;
  onLongPress: () => void;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  const styles = useStyles(createStyles);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      hitSlop={6}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabButton,
        { opacity: pressed ? 0.68 : 1 },
      ]}>
      <View style={styles.itemInner}>
        <MaterialCommunityIcons
          color={focused ? palette.canvas : palette.textQuiet}
          name={(focused ? activeIcon : icon) as never}
          size={21}
        />
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            { color: focused ? palette.text : palette.textQuiet },
          ]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export function FloatingTabBar({
  descriptors,
  navigation,
  state,
}: BottomTabBarProps) {
  const styles = useStyles(createStyles);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const position = useSharedValue(state.index);
  const slotWidth = layoutWidth > 0 ? layoutWidth / state.routes.length : 0;

  useEffect(() => {
    position.value = reduceMotion
      ? withTiming(state.index, { duration: 0 })
      : withSpring(state.index, {
          damping: 40,
          stiffness: 500,
          mass: 1,
        });
  }, [position, reduceMotion, state.index]);

  const orbitStyle = useAnimatedStyle(() => ({
    opacity: layoutWidth > 0 ? 1 : 0,
    transform: [
      {
        translateX: position.value * slotWidth + (slotWidth - ORBIT_SIZE) / 2,
      },
    ],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        { paddingBottom: Math.max(insets.bottom, 10) },
      ]}>
      <View style={styles.shell}>
        <View style={styles.architecturalRule} />
        <View
          onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width)}
          style={styles.row}>
          <Animated.View style={[styles.activeOrbit, orbitStyle]}>
            <View style={styles.orbitInset} />
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

              if (focused || event.defaultPrevented) return;

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
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const createStyles = ({ palette, fonts, fs }: AppTheme) =>
  StyleSheet.create({
  wrapper: {
    // A solid strip behind the bar, so nothing scrolls into view in the gap
    // beneath it.
    backgroundColor: palette.canvas,
    bottom: 0,
    left: 0,
    paddingHorizontal: 12,
    position: "absolute",
    right: 0,
  },
  shell: {
    backgroundColor: palette.navigation,
    borderColor: palette.line,
    borderCurve: "continuous",
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },
  architecturalRule: {
    backgroundColor: palette.lineStrong,
    height: 1,
    left: 28,
    opacity: 0.55,
    position: "absolute",
    right: 28,
    top: 13,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 78,
    paddingHorizontal: 4,
    paddingTop: 5,
    position: "relative",
  },
  activeOrbit: {
    alignItems: "center",
    backgroundColor: palette.text,
    borderColor: palette.signalViolet,
    borderCurve: "continuous",
    borderRadius: ORBIT_SIZE / 2,
    borderWidth: 1,
    height: ORBIT_SIZE,
    justifyContent: "center",
    left: 4,
    position: "absolute",
    // Centred on the icon (measured): its bottom edge stops just above the label.
    top: 13,
    width: ORBIT_SIZE,
  },
  orbitInset: {
    borderColor: withAlpha(palette.canvas, 0.24),
    borderRadius: 12,
    borderWidth: 1,
    height: 24,
    width: 24,
  },
  tabButton: {
    flex: 1,
    minWidth: 52,
    zIndex: 1,
  },
  itemInner: {
    alignItems: "center",
    gap: 9,
    justifyContent: "center",
    minHeight: 68,
    paddingHorizontal: 2,
    paddingTop: 6,
  },
  label: {
    fontFamily: fonts.body,
    // Capped so all five labels fit one line even at the largest text size.
    fontSize: Math.min(fs(11), 14),
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
