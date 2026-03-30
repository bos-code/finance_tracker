import { useAppStore } from "@/store/use-app-store";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, type ComponentProps } from "react";
import { Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

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
}: {
  val: string;
  onPress: (v: string) => void;
  mode: "amount" | "pin";
  primaryColor: string;
  biometricLabel?: string;
  biometricIconName?: IconName;
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
    <View style={[styles.keyContainer, isPinMode && styles.pinKeyContainer]}>
      <Pressable onPress={() => onPress(val)} onPressIn={handlePressIn} onPressOut={handlePressOut} style={{ flex: 1 }}>
        <Animated.View
          style={[
            styles.key,
            isPinMode ? styles.pinKey : styles.amountKey,
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
              <MaterialCommunityIcons name="backspace-outline" size={24} color="#475569" />
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
            <Text style={[styles.keyText, isPinMode ? styles.pinKeyText : undefined, val === "." && { fontSize: 32, marginBottom: 8 }]}>
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
}: UnifiedNumpadProps) {
  const theme = useAppStore((s) => s.theme);
  const primary = theme.primary;
  const isPinMode = mode === "pin";

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
    <View style={[styles.container, isPinMode && styles.pinContainer]}>
      {onDone ? (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onDone();
            }}
            style={styles.doneButton}
          >
            <Text style={[styles.doneText, { color: primary }]}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isPinMode && (title || subtitle) ? (
        <View style={styles.pinHeader}>
          {title ? <Text style={styles.pinHeaderTitle}>{title}</Text> : null}
          {subtitle ? <Text style={styles.pinHeaderSubtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}

      <View style={[styles.grid, isPinMode && styles.pinGrid]}>
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
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  amountKey: {
    borderRadius: 18,
  },
  container: {
    backgroundColor: "#f8fafc",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopColor: "#e2e8f0",
    borderTopWidth: 1,
    paddingTop: 8,
  },
  doneButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  doneText: {
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
    backgroundColor: "#fff",
    flex: 1,
    justifyContent: "center",
  },
  keyContainer: {
    flex: 1,
    height: 60,
    marginHorizontal: 6,
  },
  keyShadow: {
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  keyText: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "600",
  },
  pinActionContent: {
    alignItems: "center",
    gap: 4,
    justifyContent: "center",
  },
  pinActionKey: {
    backgroundColor: "#f8fafc",
    borderColor: "#dbe3ef",
    borderWidth: 1.5,
  },
  pinActionLabel: {
    color: "#64748b",
    fontSize: 11,
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
  pinGrid: {
    alignItems: "center",
    gap: 14,
    paddingBottom: 4,
    paddingHorizontal: 0,
  },
  pinHeader: {
    alignItems: "center",
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  pinHeaderSubtitle: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    textAlign: "center",
  },
  pinHeaderTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  pinKey: {
    borderColor: "#dbe3ef",
    borderRadius: 28,
    borderWidth: 1.5,
    height: 86,
    width: 86,
  },
  pinKeyContainer: {
    flex: 0,
    height: 86,
    marginHorizontal: 0,
    width: 86,
  },
  pinKeyText: {
    fontSize: 30,
    fontWeight: "800",
  },
  pinRow: {
    gap: 14,
    justifyContent: "center",
    marginBottom: 0,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
});
