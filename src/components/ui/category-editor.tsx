import { ActionButton } from "@/components/finance/action-button";
import type { Category } from "@/constants/categories";
import { palette, withAlpha } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import {
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ICON_OPTIONS = [
  "store",
  "silverware-fork-knife",
  "cart-outline",
  "gas-station",
  "home-outline",
  "lightning-bolt",
  "cellphone",
  "school-outline",
  "credit-card-outline",
  "cash",
  "briefcase-outline",
  "laptop",
  "chart-line",
  "gift-outline",
  "home-city-outline",
  "star-circle-outline",
  "car-outline",
  "airplane",
  "heart-outline",
  "medkit-outline",
  "dumbbell",
  "music-note",
  "book-open-variant",
  "wifi",
  "coffee-outline",
  "bus-outline",
  "train",
  "bicycle",
  "baby-carriage",
  "paw-outline",
  "flower-outline",
  "alien-outline",
  "bank-outline",
  "safe-square-outline",
  "bitcoin",
  "dots-horizontal-circle-outline",
];

const COLOR_OPTIONS = [
  "#f43f5e",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#64748b",
  "#9a9a95",
];

interface CategoryEditorProps {
  visible: boolean;
  categories: Category[];
  onSave: (updated: Category[]) => void;
  onClose: () => void;
}

function IconChip({
  color,
  name,
  onPress,
  selected,
}: {
  color: string;
  name: string;
  onPress: () => void;
  selected: boolean;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityLabel={`Use ${name.replaceAll("-", " ")} icon`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        if (Platform.OS === "ios") void Haptics.selectionAsync();
        onPress();
      }}
      onPressIn={() => {
        scale.value = withSpring(0.9, { damping: 15, stiffness: 250 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 250 });
      }}>
      <Animated.View
        style={[
          styles.iconChip,
          selected
            ? {
                backgroundColor: withAlpha(color, 0.08),
                borderColor: withAlpha(color, 0.72),
              }
            : null,
          animatedStyle,
        ]}>
        <MaterialCommunityIcons
          color={selected ? color : palette.textQuiet}
          name={name as never}
          size={20}
        />
      </Animated.View>
    </Pressable>
  );
}

function ColorChip({
  color,
  onPress,
  selected,
}: {
  color: string;
  onPress: () => void;
  selected: boolean;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityLabel={`Use ${color} category signal`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        if (Platform.OS === "ios") void Haptics.selectionAsync();
        onPress();
      }}
      onPressIn={() => {
        scale.value = withSpring(0.88, { damping: 15, stiffness: 250 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 250 });
      }}>
      <Animated.View
        style={[
          styles.colorChip,
          selected ? styles.colorChipSelected : null,
          animatedStyle,
        ]}>
        <View style={[styles.colorSignal, { backgroundColor: color }]} />
        {selected ? (
          <MaterialCommunityIcons
            color={palette.text}
            name="check"
            size={13}
          />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

export function CategoryEditor({
  visible,
  categories,
  onSave,
  onClose,
}: CategoryEditorProps) {
  const insets = useSafeAreaInsets();
  const [local, setLocal] = useState<Category[]>(categories);
  const [selectedId, setSelectedId] = useState(categories[0]?.id ?? "");
  const translateY = useSharedValue(visible ? 0 : 720);
  const selectedCategory =
    local.find((category) => category.id === selectedId) ?? local[0];

  useEffect(() => {
    if (visible) {
      setLocal(categories);
      setSelectedId(categories[0]?.id ?? "");
      translateY.value = withSpring(0, { damping: 24, stiffness: 220 });
      return;
    }

    translateY.value = withTiming(720, {
      duration: 240,
      easing: Easing.in(Easing.cubic),
    });
  }, [categories, translateY, visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const patchSelected = (patch: Partial<Category>) => {
    setLocal((current) =>
      current.map((category) =>
        category.id === selectedId ? { ...category, ...patch } : category,
      ),
    );
  };

  const handleSave = () => {
    if (Platform.OS === "ios") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onSave(local);
    onClose();
  };

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}>
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Close category editor"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 18) },
            sheetStyle,
          ]}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>CATEGORY SIGNALS</Text>
              <Text style={styles.title}>Edit the ledger key.</Text>
              <Text style={styles.description}>
                Colour stays confined to the icon and hairline signal.
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                { opacity: pressed ? 0.55 : 1 },
              ]}>
              <MaterialCommunityIcons
                color={palette.textMuted}
                name="close"
                size={20}
              />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SELECT CATEGORY</Text>
              <View style={styles.categoryList}>
                {local.map((category) => {
                  const selected = category.id === selectedId;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={category.id}
                      onPress={() => {
                        if (Platform.OS === "ios") {
                          void Haptics.selectionAsync();
                        }
                        setSelectedId(category.id);
                      }}
                      style={({ pressed }) => [
                        styles.categoryRow,
                        selected ? styles.categoryRowSelected : null,
                        { opacity: pressed ? 0.58 : 1 },
                      ]}>
                      <View
                        style={[
                          styles.categoryThread,
                          { backgroundColor: category.color },
                        ]}
                      />
                      <View style={styles.categoryIcon}>
                        <MaterialCommunityIcons
                          color={selected ? category.color : palette.textQuiet}
                          name={category.icon as never}
                          size={18}
                        />
                      </View>
                      <Text
                        style={[
                          styles.categoryLabel,
                          selected ? styles.categoryLabelSelected : null,
                        ]}>
                        {category.label}
                      </Text>
                      <Text style={styles.categoryStatus}>
                        {selected ? "EDITING" : "SELECT"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {selectedCategory ? (
              <>
                <View style={styles.section}>
                  <View style={styles.sectionTopline}>
                    <Text style={styles.sectionLabel}>ICON</Text>
                    <Text style={styles.sectionValue}>
                      {selectedCategory.icon.replaceAll("-", " ")}
                    </Text>
                  </View>
                  <View style={styles.chipGrid}>
                    {ICON_OPTIONS.map((icon) => (
                      <IconChip
                        color={selectedCategory.color}
                        key={icon}
                        name={icon}
                        onPress={() => patchSelected({ icon })}
                        selected={selectedCategory.icon === icon}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionTopline}>
                    <Text style={styles.sectionLabel}>SIGNAL COLOUR</Text>
                    <Text style={styles.sectionValue}>
                      {selectedCategory.color.toLocaleUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.colorGrid}>
                    {COLOR_OPTIONS.map((color) => (
                      <ColorChip
                        color={color}
                        key={color}
                        onPress={() => patchSelected({ color })}
                        selected={selectedCategory.color === color}
                      />
                    ))}
                  </View>
                </View>
              </>
            ) : null}

            <ActionButton label="Save category system" onPress={handleSave} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    backgroundColor: withAlpha(palette.black, 0.74),
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: palette.canvasRaised,
    borderColor: palette.lineStrong,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    maxHeight: "90%",
    overflow: "hidden",
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: -18 },
    shadowOpacity: 0.42,
    shadowRadius: 34,
    elevation: 28,
  },
  handleWrap: { alignItems: "center", paddingBottom: 5, paddingTop: 11 },
  handle: {
    backgroundColor: palette.lineStrong,
    borderRadius: 999,
    height: 4,
    width: 42,
  },
  header: {
    alignItems: "flex-start",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerCopy: { flex: 1, paddingRight: 18 },
  eyebrow: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.72,
    marginBottom: 7,
  },
  title: {
    color: palette.text,
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: -0.25,
  },
  description: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 9,
    lineHeight: 14,
    marginTop: 6,
  },
  closeButton: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 11,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  scrollContent: { gap: 22, padding: 20 },
  section: {
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    paddingBottom: 20,
  },
  sectionTopline: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionLabel: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.68,
    marginBottom: 10,
  },
  sectionValue: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    marginBottom: 10,
  },
  categoryList: { gap: 7 },
  categoryRow: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 54,
    overflow: "hidden",
    paddingHorizontal: 12,
  },
  categoryRowSelected: { backgroundColor: withAlpha(palette.white, 0.025) },
  categoryThread: { alignSelf: "stretch", marginLeft: -12, marginRight: 11, width: 1 },
  categoryIcon: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 10,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    marginRight: 11,
    width: 34,
  },
  categoryLabel: {
    color: palette.textMuted,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "600",
  },
  categoryLabelSelected: { color: palette.text },
  categoryStatus: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 6,
  },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  iconChip: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: 12,
    borderWidth: 1,
    height: 43,
    justifyContent: "center",
    width: 43,
  },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  colorChip: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    height: 38,
    justifyContent: "center",
    width: 55,
  },
  colorChipSelected: {
    backgroundColor: withAlpha(palette.white, 0.035),
    borderColor: palette.lineStrong,
  },
  colorSignal: { borderRadius: 999, height: 8, width: 8 },
});
