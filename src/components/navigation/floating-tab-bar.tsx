import { palette, withAlpha } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
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

const ARC_INPUT = [0, 1, 2, 3, 4];
const ARC_OUTPUT = [4, -2, -6, -2, 4];
const ORBIT_SIZE = 48;

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

  const orbitStyle = useAnimatedStyle(() => {
    const arcY = interpolate(
      position.value,
      ARC_INPUT,
      ARC_OUTPUT,
      Extrapolation.CLAMP,
    );

    return {
      opacity: layoutWidth > 0 ? 1 : 0,
      transform: [
        {
          translateX:
            position.value * slotWidth + (slotWidth - ORBIT_SIZE) / 2,
        },
        { translateY: arcY },
      ],
    };
  });

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

const styles = StyleSheet.create({
  wrapper: {
    bottom: 0,
    left: 0,
    paddingHorizontal: 12,
    position: "absolute",
    right: 0,
  },
  shell: {
    backgroundColor: withAlpha(palette.navigation, 0.98),
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
    top: 7,
    width: ORBIT_SIZE,
  },
  orbitInset: {
    borderColor: withAlpha(palette.canvas, 0.24),
    borderRadius: 17,
    borderWidth: 1,
    height: 34,
    width: 34,
  },
  tabButton: {
    flex: 1,
    minWidth: 52,
    zIndex: 1,
  },
  itemInner: {
    alignItems: "center",
    gap: 11,
    justifyContent: "center",
    minHeight: 68,
    paddingHorizontal: 2,
    paddingTop: 6,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.25,
  },
});
