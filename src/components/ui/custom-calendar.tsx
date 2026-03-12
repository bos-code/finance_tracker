import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

interface CustomCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
}

const DAYS_OF_WEEK = ["S", "M", "T", "W", "T", "F", "S"];

function DayButton({
  day,
  isCurrentMonth,
  isSelected,
  onPress,
}: {
  day: number;
  isCurrentMonth: boolean;
  isSelected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const style = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  if (!isCurrentMonth) {
    return (
      <View className="h-10 w-10 items-center justify-center">
        <Text className="text-[15px] font-medium text-slate-300">{day}</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPressIn={() => {
        if (Platform.OS === 'ios') Haptics.selectionAsync();
        scale.value = withSpring(0.85);
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
        onPress();
      }}
      className="m-0.5"
    >
      <Animated.View
        className={`h-10 w-10 items-center justify-center rounded-full ${
          isSelected ? "bg-[#1d4ed8]" : "bg-transparent"
        }`}
        style={style}
      >
        <Text
          className={`text-[15px] font-bold ${
            isSelected ? "text-white" : "text-slate-700"
          }`}
        >
          {day}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function CustomCalendar({ selectedDate, onSelectDate, onClose }: CustomCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  const changeMonth = (offset: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));
  };

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];
    
    // Previous month padding
    for (let i = 0; i < firstDayOfMonth; i++) {
        days.push({ day: daysInPrevMonth - firstDayOfMonth + i + 1, isCurrentMonth: false });
    }
    
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({ day: i, isCurrentMonth: true });
    }
    
    // Next month padding to complete 42 cells (6 rows)
    const paddingRight = 42 - days.length;
    for (let i = 1; i <= paddingRight; i++) {
        days.push({ day: i, isCurrentMonth: false });
    }

    return days;
  }, [currentMonth]);

  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <View className="bg-white rounded-[32px] p-6 shadow-xl" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 15 }}>
      {/* Header */}
      <View className="flex-row items-center justify-between mb-6">
        <Pressable onPress={() => changeMonth(-1)} className="p-2 bg-slate-50 rounded-full active:bg-slate-100">
          <MaterialCommunityIcons name="chevron-left" size={24} color="#1d4ed8" />
        </Pressable>
        <Text className="text-[18px] font-bold text-slate-900">{monthName}</Text>
        <Pressable onPress={() => changeMonth(1)} className="p-2 bg-slate-50 rounded-full active:bg-slate-100">
          <MaterialCommunityIcons name="chevron-right" size={24} color="#1d4ed8" />
        </Pressable>
      </View>

      {/* Days of Week */}
      <View className="flex-row justify-around mb-4">
        {DAYS_OF_WEEK.map((day, i) => (
          <Text key={i} className="text-[13px] font-bold text-slate-400 w-10 text-center">
            {day}
          </Text>
        ))}
      </View>

      {/* Grid */}
      <View className="flex-row flex-wrap justify-between">
        {calendarDays.map((item, index) => {
          const isSelected = item.isCurrentMonth && 
            item.day === selectedDate.getDate() && 
            currentMonth.getMonth() === selectedDate.getMonth() &&
            currentMonth.getFullYear() === selectedDate.getFullYear();

          return (
            <View key={index} className="w-[14.28%] items-center mb-2">
               <DayButton 
                 day={item.day}
                 isCurrentMonth={item.isCurrentMonth}
                 isSelected={isSelected}
                 onPress={() => {
                   onSelectDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), item.day));
                   setTimeout(onClose, 250); // Small delay to let user see selection
                 }}
               />
            </View>
          );
        })}
      </View>
    </View>
  );
}
