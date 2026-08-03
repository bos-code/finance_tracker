import { palette, withAlpha } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface CustomCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
}

type CalendarDay = {
  day: number;
  isCurrentMonth: boolean;
};

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
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityLabel={`${day}${isSelected ? ", selected" : ""}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: !isCurrentMonth, selected: isSelected }}
      disabled={!isCurrentMonth}
      onPress={() => {
        if (Platform.OS === "ios") void Haptics.selectionAsync();
        onPress();
      }}
      onPressIn={() => {
        scale.value = withSpring(0.9, { damping: 16, stiffness: 260 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 16, stiffness: 260 });
      }}
      style={styles.dayPressable}>
      <Animated.View
        style={[
          styles.day,
          !isCurrentMonth ? styles.dayOutside : null,
          isSelected ? styles.daySelected : null,
          animatedStyle,
        ]}>
        {isSelected ? <View style={styles.selectedThread} /> : null}
        <Text
          style={[
            styles.dayText,
            !isCurrentMonth ? styles.dayTextOutside : null,
            isSelected ? styles.dayTextSelected : null,
          ]}>
          {day}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function CustomCalendar({
  selectedDate,
  onSelectDate,
  onClose,
}: CustomCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  );

  const changeMonth = (offset: number) => {
    if (Platform.OS === "ios") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setCurrentMonth(
      (value) =>
        new Date(value.getFullYear(), value.getMonth() + offset, 1),
    );
  };

  const calendarDays = useMemo<CalendarDay[]>(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPreviousMonth = new Date(year, month, 0).getDate();
    const days: CalendarDay[] = [];

    for (let index = 0; index < firstDayOfMonth; index += 1) {
      days.push({
        day: daysInPreviousMonth - firstDayOfMonth + index + 1,
        isCurrentMonth: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      days.push({ day, isCurrentMonth: true });
    }

    const trailingDays = 42 - days.length;
    for (let day = 1; day <= trailingDays; day += 1) {
      days.push({ day, isCurrentMonth: false });
    }

    return days;
  }, [currentMonth]);

  const monthName = currentMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <View style={styles.container}>
      <View style={styles.topline}>
        <View>
          <Text style={styles.eyebrow}>TRANSACTION DATE</Text>
          <Text style={styles.title}>{monthName}</Text>
        </View>
        <View style={styles.navigation}>
          <Pressable
            accessibilityLabel="Previous month"
            accessibilityRole="button"
            onPress={() => changeMonth(-1)}
            style={({ pressed }) => [
              styles.navigationButton,
              { opacity: pressed ? 0.55 : 1 },
            ]}>
            <MaterialCommunityIcons
              color={palette.textMuted}
              name="chevron-left"
              size={20}
            />
          </Pressable>
          <Pressable
            accessibilityLabel="Next month"
            accessibilityRole="button"
            onPress={() => changeMonth(1)}
            style={({ pressed }) => [
              styles.navigationButton,
              { opacity: pressed ? 0.55 : 1 },
            ]}>
            <MaterialCommunityIcons
              color={palette.textMuted}
              name="chevron-right"
              size={20}
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.weekdays}>
        {DAYS_OF_WEEK.map((day, index) => (
          <Text key={`${day}-${index}`} style={styles.weekday}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {calendarDays.map((item, index) => {
          const isSelected =
            item.isCurrentMonth &&
            item.day === selectedDate.getDate() &&
            currentMonth.getMonth() === selectedDate.getMonth() &&
            currentMonth.getFullYear() === selectedDate.getFullYear();

          return (
            <View key={`${item.day}-${index}`} style={styles.cell}>
              <DayButton
                day={item.day}
                isCurrentMonth={item.isCurrentMonth}
                isSelected={isSelected}
                onPress={() => {
                  onSelectDate(
                    new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth(),
                      item.day,
                    ),
                  );
                  setTimeout(onClose, 180);
                }}
              />
            </View>
          );
        })}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendThread} />
        <Text style={styles.legendText}>
          Dates are recorded in your device time zone.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 18,
  },
  topline: {
    alignItems: "center",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 16,
  },
  eyebrow: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  title: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 21,
  },
  navigation: { flexDirection: "row", gap: 8 },
  navigationButton: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 11,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  weekdays: {
    flexDirection: "row",
    marginBottom: 5,
    marginTop: 14,
  },
  weekday: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    textAlign: "center",
    width: "14.2857%",
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { alignItems: "center", width: "14.2857%" },
  dayPressable: { alignItems: "center", paddingVertical: 2, width: "100%" },
  day: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: 12,
    borderWidth: 1,
    height: 39,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    width: 39,
  },
  dayOutside: { opacity: 0.26 },
  daySelected: {
    backgroundColor: palette.text,
    borderColor: palette.text,
  },
  selectedThread: {
    backgroundColor: palette.signalViolet,
    bottom: 0,
    height: 2,
    left: 7,
    position: "absolute",
    right: 7,
  },
  dayText: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "600",
  },
  dayTextOutside: { color: palette.textQuiet },
  dayTextSelected: { color: palette.black, fontWeight: "800" },
  legend: {
    alignItems: "center",
    borderTopColor: palette.line,
    borderTopWidth: 1,
    flexDirection: "row",
    marginTop: 12,
    paddingTop: 12,
  },
  legendThread: {
    backgroundColor: palette.signalCyan,
    height: 1,
    marginRight: 9,
    width: 18,
  },
  legendText: {
    color: withAlpha(palette.text, 0.38),
    fontFamily: fonts.body,
    fontSize: 8,
  },
});
