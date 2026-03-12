import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { View, Text, TouchableOpacity, Pressable, Platform } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

interface CustomKeypadProps {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onDone: () => void;
}

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "delete"],
];

function KeyButton({ keyId, isDelete, onPress }: { keyId: string, isDelete: boolean, onPress: (k: string) => void }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => {
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.9, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
    onPress(keyId);
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      className="flex-1"
    >
      <Animated.View
         className={`h-[56px] rounded-2xl items-center justify-center ${
           isDelete ? "bg-transparent" : "bg-white"
         }`}
         style={[
           style,
           !isDelete ? { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1, elevation: 1 } : undefined
         ]}
      >
        {isDelete ? (
          <MaterialCommunityIcons name="backspace-outline" size={26} color="#64748b" />
        ) : (
          <Text className="text-[26px] font-semibold text-[#0b1220]">{keyId}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function CustomKeypad({ onKeyPress, onBackspace, onDone }: CustomKeypadProps) {
  const handlePress = (key: string) => {
    if (key === "delete") {
      onBackspace();
    } else {
      onKeyPress(key);
    }
  };

  return (
    <View className="bg-[#f0f3fa] pt-2 pb-8 px-2 rounded-t-3xl border-t border-gray-200">
      {/* Optional Done Header Row */}
      <View className="flex-row justify-end px-4 py-2 border-b border-gray-200/50 mb-2">
        <TouchableOpacity onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onDone();
        }}>
          <Text className="text-[#1d4ed8] font-bold text-[16px]">Done</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-col gap-2">
        {KEYS.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} className="flex-row justify-between w-full px-2 gap-2">
            {row.map((key) => {
              const isDelete = key === "delete";
              return (
                <KeyButton 
                  key={key} 
                  keyId={key} 
                  isDelete={isDelete} 
                  onPress={handlePress} 
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
