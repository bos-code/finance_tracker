import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAppStore } from "@/store/use-app-store";
import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Category } from "@/constants/categories";

// ─── Picker data ────────────────────────────────────────────────────────────

const ICON_OPTIONS = [
  "store", "silverware-fork-knife", "cart-outline", "gas-station",
  "home-outline", "lightning-bolt", "cellphone", "school-outline",
  "credit-card-outline", "cash", "briefcase-outline", "laptop",
  "chart-line", "gift-outline", "home-city-outline", "star-circle-outline",
  "car-outline", "airplane", "heart-outline", "medkit-outline",
  "dumbbell", "music-note", "book-open-variant", "wifi",
  "coffee-outline", "bus-outline", "train", "bicycle",
  "baby-carriage", "paw-outline", "flower-outline", "alien-outline",
  "bank-outline", "safe-square-outline", "bitcoin",
  "dots-horizontal-circle-outline",
];

const COLOR_OPTIONS = [
  "#f43f5e", "#ef4444", "#f97316", "#f59e0b",
  "#eab308", "#84cc16", "#22c55e", "#10b981",
  "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6",
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
  "#64748b", "#0f172a",
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface CategoryEditorProps {
  visible: boolean;
  categories: Category[];
  onSave: (updated: Category[]) => void;
  onClose: () => void;
}

// ─── Icon chip ───────────────────────────────────────────────────────────────

function IconChip({
  name,
  selected,
  color,
  onPress,
}: {
  name: string;
  selected: boolean;
  color: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <TouchableOpacity
      onPressIn={() => { scale.value = withSpring(0.88, { damping: 12 }); }}
      onPressOut={() => { scale.value = withSpring(1); onPress(); }}
      activeOpacity={1}
    >
      <Animated.View
        style={[
          style,
          {
            width: 48,
            height: 48,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: selected ? color + "22" : "#f1f5f9",
            borderWidth: selected ? 2 : 1,
            borderColor: selected ? color : "#e2e8f0",
            margin: 4,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={name as any}
          size={22}
          color={selected ? color : "#94a3b8"}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Color chip ──────────────────────────────────────────────────────────────

function ColorChip({
  color,
  selected,
  onPress,
}: {
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <TouchableOpacity
      onPressIn={() => { scale.value = withSpring(0.85, { damping: 12 }); }}
      onPressOut={() => { scale.value = withSpring(1); onPress(); }}
      activeOpacity={1}
    >
      <Animated.View
        style={[
          style,
          {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: color,
            margin: 4,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: selected ? 3 : 0,
            borderColor: "#fff",
            shadowColor: selected ? color : "transparent",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: selected ? 0.6 : 0,
            shadowRadius: 6,
            elevation: selected ? 6 : 0,
          },
        ]}
      >
        {selected && (
          <MaterialCommunityIcons name="check" size={18} color="#fff" />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CategoryEditor({
  visible,
  categories,
  onSave,
  onClose,
}: CategoryEditorProps) {
  const insets = useSafeAreaInsets();
  const theme = useAppStore((s) => s.theme);
  const primary = theme.primary;
  const [local, setLocal] = useState<Category[]>(categories);
  const [selectedId, setSelectedId] = useState<string>(categories[0]?.id ?? "");

  const selectedCat = local.find((c) => c.id === selectedId) ?? local[0];
  const translateY = useSharedValue(visible ? 0 : 600);

  React.useEffect(() => {
    if (visible) {
      setLocal(categories);
      setSelectedId(categories[0]?.id ?? "");
      translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
    } else {
      translateY.value = withTiming(600, { duration: 260, easing: Easing.in(Easing.cubic) });
    }
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  function patchSelected(patch: Partial<Category>) {
    setLocal((prev) =>
      prev.map((c) => (c.id === selectedId ? { ...c, ...patch } : c))
    );
  }

  function handleSave() {
    if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSave(local);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: "rgba(10,18,40,0.45)" }}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Sheet */}
      <Animated.View
        style={[
          sheetStyle,
          {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#fff",
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            paddingBottom: Math.max(insets.bottom, 24),
            maxHeight: "88%",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.12,
            shadowRadius: 24,
            elevation: 30,
          },
        ]}
      >
        {/* Handle bar */}
        <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}>
          <View style={{ width: 40, height: 4, borderRadius: 99, backgroundColor: "#e2e8f0" }} />
        </View>

        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: "#f1f5f9",
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#0f172a" }}>
            Edit categories
          </Text>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <MaterialCommunityIcons name="close" size={22} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Category rows */}
          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#94a3b8", letterSpacing: 0.8, marginBottom: 8 }}>
              SELECT CATEGORY
            </Text>
            {local.map((cat) => {
              const isActive = cat.id === selectedId;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => {
                    if (Platform.OS === "ios") Haptics.selectionAsync();
                    setSelectedId(cat.id);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 11,
                    paddingHorizontal: 14,
                    borderRadius: 16,
                    marginBottom: 6,
                    backgroundColor: isActive ? cat.color + "12" : "#f8fafc",
                    borderWidth: isActive ? 1.5 : 1,
                    borderColor: isActive ? cat.color + "55" : "#f1f5f9",
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      backgroundColor: cat.color + "20",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <MaterialCommunityIcons name={cat.icon as any} size={20} color={cat.color} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: "#1e293b" }}>
                    {cat.label}
                  </Text>
                  {isActive && (
                    <MaterialCommunityIcons name="pencil-outline" size={16} color={cat.color} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 20, marginVertical: 16 }} />

          {/* Icon picker */}
          {selectedCat && (
            <View style={{ paddingHorizontal: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#94a3b8", letterSpacing: 0.8, marginBottom: 8 }}>
                ICON
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {ICON_OPTIONS.map((icon) => (
                  <IconChip
                    key={icon}
                    name={icon}
                    color={selectedCat.color}
                    selected={selectedCat.icon === icon}
                    onPress={() => {
                      if (Platform.OS === "ios") Haptics.selectionAsync();
                      patchSelected({ icon });
                    }}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 20, marginVertical: 16 }} />

          {/* Color picker */}
          {selectedCat && (
            <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#94a3b8", letterSpacing: 0.8, marginBottom: 8 }}>
                COLOUR
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {COLOR_OPTIONS.map((color) => (
                  <ColorChip
                    key={color}
                    color={color}
                    selected={selectedCat.color === color}
                    onPress={() => {
                      if (Platform.OS === "ios") Haptics.selectionAsync();
                      patchSelected({ color });
                    }}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Save button */}
          <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}>
            <TouchableOpacity
              onPress={handleSave}
              style={{
                backgroundColor: theme.primary,
                borderRadius: 18,
                height: 54,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                Save changes
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}
