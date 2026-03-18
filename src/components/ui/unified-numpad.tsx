import React, { useCallback, useMemo } from "react";
import { View, Text, TouchableOpacity, Platform, StyleSheet, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  withTiming 
} from "react-native-reanimated";
import { useAppStore } from "@/store/use-app-store";

// Note: react-native-numpad 0.3.0 is a simple, flexible keypad.
// We wrap it to match our app's premium aesthetic and specific use-cases.

interface UnifiedNumpadProps {
  value: string;
  onChange: (value: string) => void;
  onDone?: () => void;
  mode: "amount" | "pin";
  maxLength?: number;
  showBiometric?: boolean;
  onBiometricPress?: () => void;
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
  ["biometric", "0", "backspace"], // Biometric in bottom-left
];

function KeyButton({ 
  val, 
  onPress, 
  primaryColor,
}: { 
  val: string; 
  onPress: (v: string) => void; 
  primaryColor: string;
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const isBackspace = val === "backspace";
  const isBiometric = val === "biometric";
  const isEmpty = val === "";

  if (isEmpty) return <View style={styles.keyContainer} />;

  const handlePressIn = () => {
    if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.92, { damping: 12 });
    opacity.value = withTiming(0.7, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
    opacity.value = withTiming(1, { duration: 100 });
  };

  return (
    <View style={styles.keyContainer}>
      <Pressable
        onPress={() => onPress(val)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{ flex: 1 }}
      >
        <Animated.View style={[
          styles.key,
          (!isBackspace && !isBiometric) ? styles.keyShadow : {},
          style as any,
        ]}>
          {isBackspace ? (
            <MaterialCommunityIcons name="backspace-outline" size={24} color="#64748b" />
          ) : isBiometric ? (
            <MaterialCommunityIcons name="fingerprint" size={28} color={primaryColor} />
          ) : (
            <Text style={[styles.keyText, val === "." && { fontSize: 32, marginBottom: 8 }]}>
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
}: UnifiedNumpadProps) {
  const theme = useAppStore((s) => s.theme);
  const primary = theme.primary;

  const handlePress = useCallback((key: string) => {
    // Standardize input by cleaning any formatting characters (commas, currency symbols etc)
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
    } else {
      if (key === ".") return;
      onChange(rawValue + key);
    }
  }, [value, onChange, mode, maxLength, onBiometricPress]);

  const keysToUse = useMemo(() => (mode === "pin" ? PIN_KEYS : KEYS), [mode]);

  return (
    <View style={styles.container}>
      {/* Header / Done Row */}
      {onDone && (
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
      )}

      <View style={styles.grid}>
        {keysToUse.map((row, i) => (
          <View key={`row-${i}`} style={styles.row}>
            {row.map((key, j) => {
              const val = key === "biometric" && !showBiometric ? "" : key;
              return (
                <KeyButton 
                  key={`${key}-${i}-${j}`} 
                  val={val} 
                  onPress={handlePress} 
                  primaryColor={primary} 
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
  container: {
    backgroundColor: "#f8fafc",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  doneButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  doneText: {
    fontSize: 16,
    fontWeight: "700",
  },
  grid: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  keyContainer: {
    flex: 1,
    height: 60,
    marginHorizontal: 6,
  },
  key: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  keyShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  keyText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#0f172a",
  },
});
