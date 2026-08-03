import { palette } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

interface UnifiedNumpadProps {
  value: string;
  onChange: (value: string) => void;
  onDone?: () => void;
  mode: "amount" | "pin";
  maxLength?: number;
  showBiometric?: boolean;
  onBiometricPress?: () => void;
  biometricLabel?: string;
  biometricIconName?: IconName;
  title?: string;
  subtitle?: string;
  pinPresentation?: "inline" | "drawer";
  footer?: ReactNode;
  bottomInset?: number;
}

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "backspace"],
];

const PIN_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["biometric", "0", "backspace"],
];

function getBiometricShortLabel(label?: string) {
  const normalized = label?.toLowerCase() ?? "";

  if (normalized.includes("face")) return "Face";
  if (normalized.includes("finger")) return "Touch";
  if (normalized.includes("iris")) return "Iris";

  return "Bio";
}

function KeyButton({
  val,
  onPress,
  mode,
  primaryColor,
  biometricLabel,
  biometricIconName,
  pinKeySize,
}: {
  val: string;
  onPress: (v: string) => void;
  mode: "amount" | "pin";
  primaryColor: string;
  biometricLabel?: string;
  biometricIconName?: IconName;
  pinKeySize: number;
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const isPinMode = mode === "pin";
  const isBackspace = val === "backspace";
  const isBiometric = val === "biometric";
  const isEmpty = val === "";
  const isActionKey = isBackspace || isBiometric;

  if (isEmpty) {
    return <View style={[styles.keyContainer, isPinMode && styles.pinKeyContainer]} />;
  }

  const handlePressIn = () => {
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    scale.value = withSpring(isPinMode ? 0.95 : 0.92, { damping: 12 });
    opacity.value = withTiming(0.82, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
    opacity.value = withTiming(1, { duration: 100 });
  };

  return (
    <View
      style={[
        styles.keyContainer,
        isPinMode && styles.pinKeyContainer,
        isPinMode
          ? {
              height: pinKeySize,
              width: pinKeySize,
            }
          : undefined,
      ]}
    >
      <Pressable onPress={() => onPress(val)} onPressIn={handlePressIn} onPressOut={handlePressOut} style={{ flex: 1 }}>
        <Animated.View
          style={[
            styles.key,
            isPinMode ? styles.pinKey : styles.amountKey,
            isPinMode
              ? {
                  borderRadius: Math.round(pinKeySize * 0.32),
                  height: pinKeySize,
                  width: pinKeySize,
                }
              : undefined,
            !isActionKey ? styles.keyShadow : undefined,
            isPinMode && isActionKey ? styles.pinActionKey : undefined,
            isPinMode && isBiometric
              ? {
                  backgroundColor: `${primaryColor}14`,
                  borderColor: `${primaryColor}35`,
                }
              : undefined,
            style as any,
          ]}
        >
          {isBackspace ? (
            <View style={styles.pinActionContent}>
              <MaterialCommunityIcons name="backspace-outline" size={24} color={palette.textMuted} />
              {isPinMode ? <Text style={styles.pinActionLabel}>Erase</Text> : null}
            </View>
          ) : isBiometric ? (
            <View style={styles.pinActionContent}>
              <MaterialCommunityIcons name={biometricIconName ?? "fingerprint"} size={24} color={primaryColor} />
              {isPinMode ? (
                <Text style={[styles.pinActionLabel, { color: primaryColor }]}>{getBiometricShortLabel(biometricLabel)}</Text>
              ) : null}
            </View>
          ) : (
            <Text
              style={[
                styles.keyText,
                isPinMode ? styles.pinKeyText : undefined,
                isPinMode
                  ? {
                      fontSize: pinKeySize >= 82 ? 30 : 27,
                    }
                  : undefined,
                val === "." && { fontSize: 32, marginBottom: 8 },
              ]}
            >
              {val}
            </Text>
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
}

export function UnifiedNumpad({
  value,
  onChange,
  onDone,
  mode,
  maxLength,
  showBiometric,
  onBiometricPress,
  biometricLabel,
  biometricIconName,
  title,
  subtitle,
  pinPresentation = "inline",
  footer,
  bottomInset = 0,
}: UnifiedNumpadProps) {
  const primary = palette.signalCyan;
  const isPinMode = mode === "pin";
  const isPinDrawer = isPinMode && pinPresentation === "drawer";
  const { width } = useWindowDimensions();

  const pinKeySize = useMemo(() => Math.max(72, Math.min(86, Math.floor((width - 76) / 3))), [width]);

  const handlePress = useCallback(
    (key: string) => {
      const rawValue = (value || "").replace(/[^0-9.]/g, "");

      if (key === "backspace") {
        onChange(rawValue.slice(0, -1));
        return;
      }

      if (key === "biometric") {
        onBiometricPress?.();
        return;
      }

      if (maxLength && rawValue.length >= maxLength) return;

      if (mode === "amount") {
        if (key === "." && rawValue.includes(".")) return;
        onChange(rawValue + key);
        return;
      }

      if (key === ".") return;
      onChange(rawValue + key);
    },
    [maxLength, mode, onBiometricPress, onChange, value],
  );

  const keysToUse = useMemo(() => (isPinMode ? PIN_KEYS : KEYS), [isPinMode]);

  return (
    <View style={[styles.container, isPinMode && styles.pinContainer, isPinDrawer && styles.pinDrawerContainer]}>
      {isPinDrawer ? (
        <View style={styles.pinDrawerHandleWrap}>
          <View style={styles.pinDrawerHandle} />
        </View>
      ) : null}

      {onDone ? (
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onDone();
            }}
            style={({ pressed }) => [
              styles.doneButton,
              { opacity: pressed ? 0.56 : 1 },
            ]}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      ) : null}

      {isPinMode && (title || subtitle) ? (
        <View style={[styles.pinHeader, isPinDrawer && styles.pinDrawerHeader]}>
          {title ? <Text style={styles.pinHeaderTitle}>{title}</Text> : null}
          {subtitle ? <Text style={styles.pinHeaderSubtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}

      <View style={[styles.grid, isPinMode && styles.pinGrid, isPinDrawer && styles.pinDrawerGrid]}>
        {keysToUse.map((row, index) => (
          <View key={`row-${index}`} style={[styles.row, isPinMode && styles.pinRow]}>
            {row.map((key, keyIndex) => {
              const val = key === "biometric" && !showBiometric ? "" : key;
              return (
                <KeyButton
                  key={`${key}-${index}-${keyIndex}`}
                  val={val}
                  onPress={handlePress}
                  mode={mode}
                  primaryColor={primary}
                  biometricLabel={biometricLabel}
                  biometricIconName={biometricIconName}
                  pinKeySize={pinKeySize}
                />
              );
            })}
          </View>
        ))}
      </View>

      {footer ? (
        <View
          style={[
            styles.pinFooter,
            isPinDrawer && styles.pinDrawerFooter,
            bottomInset
              ? {
                  paddingBottom: Math.max(bottomInset, isPinDrawer ? 14 : 0),
                }
              : undefined,
          ]}
        >
          {footer}
        </View>
      ) : isPinDrawer && bottomInset ? (
        <View style={{ height: Math.max(bottomInset, 14) }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  amountKey: {
    borderRadius: 15,
  },
  container: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopColor: palette.lineStrong,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  doneButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  doneText: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: "700",
  },
  grid: {
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  key: {
    alignItems: "center",
    backgroundColor: palette.surfaceRaised,
    flex: 1,
    justifyContent: "center",
  },
  keyContainer: {
    flex: 1,
    height: 60,
    marginHorizontal: 6,
  },
  keyShadow: {
    borderColor: palette.line,
    borderWidth: 1,
  },
  keyText: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "600",
  },
  pinActionContent: {
    alignItems: "center",
    gap: 4,
    justifyContent: "center",
  },
  pinActionKey: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: 1,
  },
  pinActionLabel: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  pinContainer: {
    backgroundColor: "transparent",
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingTop: 0,
  },
  pinDrawerContainer: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopColor: palette.lineStrong,
    borderTopWidth: 1,
    paddingTop: 12,
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 18,
  },
  pinDrawerFooter: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  pinDrawerGrid: {
    paddingBottom: 6,
    paddingHorizontal: 16,
  },
  pinDrawerHandle: {
    backgroundColor: palette.lineStrong,
    borderRadius: 999,
    height: 5,
    width: 46,
  },
  pinDrawerHandleWrap: {
    alignItems: "center",
    paddingBottom: 10,
  },
  pinDrawerHeader: {
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  pinFooter: {
    gap: 10,
  },
  pinGrid: {
    alignItems: "center",
    gap: 12,
    paddingBottom: 8,
    paddingHorizontal: 0,
  },
  pinHeader: {
    alignItems: "center",
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  pinHeaderSubtitle: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    textAlign: "center",
  },
  pinHeaderTitle: {
    color: palette.text,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  pinKey: {
    borderColor: palette.lineStrong,
    borderWidth: 1,
  },
  pinKeyContainer: {
    flex: 0,
    marginHorizontal: 0,
  },
  pinKeyText: {
    fontWeight: "800",
  },
  pinRow: {
    gap: 12,
    justifyContent: "center",
    marginBottom: 0,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
});
