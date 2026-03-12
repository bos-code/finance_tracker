import { Screen } from "@/components/ui/screen";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { createTransaction } from "@/services/supabase/transaction-service";
import { CustomKeypad } from "@/components/ui/custom-keypad";
import { CustomCalendar } from "@/components/ui/custom-calendar";
import { SaveFeedback } from "@/components/ui/save-feedback";
import { CategoryEditor } from "@/components/ui/category-editor";
import {
  EXPENDITURE_CATEGORIES,
  REVENUE_CATEGORIES,
  type Category,
} from "@/constants/categories";

type TransactionType = "Expenditure" | "Revenue";

export function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // ── Transaction type ─────────────────────────────────────────────
  const [type, setType] = useState<TransactionType>("Expenditure");

  // ── Per-type custom category lists (in-memory edits) ─────────────
  const [expCategories, setExpCategories] = useState<Category[]>(EXPENDITURE_CATEGORIES);
  const [revCategories, setRevCategories] = useState<Category[]>(REVENUE_CATEGORIES);

  const activeCategories = type === "Expenditure" ? expCategories : revCategories;
  const setActiveCategories = type === "Expenditure" ? setExpCategories : setRevCategories;

  // ── Form state ───────────────────────────────────────────────────
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState(expCategories[0].id);
  const [date, setDate] = useState(new Date());

  // ── UI toggles ───────────────────────────────────────────────────
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  // ── Save feedback ────────────────────────────────────────────────
  const [feedback, setFeedback] = useState<{ visible: boolean; type: "success" | "error"; message: string }>({
    visible: false,
    type: "success",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Switch type ──────────────────────────────────────────────────
  const switchType = useCallback((newType: TransactionType) => {
    setType(newType);
    const cats = newType === "Expenditure" ? expCategories : revCategories;
    setCategoryId(cats[0].id);
    setAmount("");
  }, [expCategories, revCategories]);

  // ── Keypad handlers ──────────────────────────────────────────────
  const handleKeypadPress = (key: string) => {
    let raw = amount.replace(/[^0-9.]/g, "");
    if (key === "." && raw.includes(".")) return;
    raw += key;
    if (raw === "" || raw === ".") { setAmount(raw); return; }
    const parts = raw.split(".");
    const int = parseInt(parts[0] || "0", 10).toLocaleString("en-US");
    setAmount(parts.length > 1 ? `${int}.${parts[1]}` : int);
  };

  const handleKeypadBackspace = () => {
    let raw = amount.replace(/[^0-9.]/g, "");
    if (!raw.length) return;
    raw = raw.slice(0, -1);
    if (!raw) { setAmount(""); return; }
    const parts = raw.split(".");
    const int = parseInt(parts[0] || "0", 10).toLocaleString("en-US");
    setAmount(parts.length > 1 ? `${int}.${parts[1]}` : int);
  };

  // ── Save ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user) {
      setFeedback({ visible: true, type: "error", message: "Sign in to save transactions." });
      return;
    }
    const rawAmount = parseFloat(amount.replace(/[^0-9.]/g, ""));
    if (!rawAmount || rawAmount <= 0) {
      setFeedback({ visible: true, type: "error", message: "Enter a valid amount greater than 0." });
      return;
    }
    try {
      setIsSubmitting(true);
      setShowKeypad(false);
      await createTransaction({
        user_id: user.uid,
        type,
        amount: rawAmount,
        note,
        category_id: categoryId,
        transaction_date: date.toISOString(),
      });
      setFeedback({ visible: true, type: "success", message: `${type} saved successfully.` });
      setAmount("");
      setNote("");
      setDate(new Date());
    } catch (err: any) {
      setFeedback({ visible: true, type: "error", message: err?.message || "Could not save transaction." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Currency symbol ──────────────────────────────────────────────
  const symbol = type === "Expenditure" ? "$" : "D";

  return (
    <Screen className="px-0 bg-[#f4f6f9]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-4 pt-2 pb-[100px]" showsVerticalScrollIndicator={false}>

          {/* ── Type toggle ──────────────────────────────────────── */}
          <View className="flex-row rounded-2xl bg-[#dce7ff] p-1 mt-2 mb-8">
            {(["Expenditure", "Revenue"] as TransactionType[]).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => switchType(t)}
                className={`flex-1 rounded-xl py-3 items-center justify-center ${type === t ? "bg-[#1d4ed8]" : ""}`}
              >
                <Text className={`font-semibold text-[15px] ${type === t ? "text-white" : "text-[#1d4ed8]"}`}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Form fields ──────────────────────────────────────── */}
          <View className="gap-5">

            {/* Time */}
            <View className="flex-row items-center justify-between">
              <Text className="text-[16px] font-bold text-slate-900 w-24">Time</Text>
              <TouchableOpacity
                onPress={() => { Keyboard.dismiss(); setShowKeypad(false); setShowDatePicker(true); }}
                className="flex-1 flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 h-[52px]"
              >
                <MaterialCommunityIcons name="calendar-month-outline" size={24} color="#1d4ed8" />
                <Text className="font-semibold text-[15px] text-slate-900">
                  {date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={24} color="#1d4ed8" />
              </TouchableOpacity>
            </View>

            {/* Amount */}
            <View className="flex-row items-center justify-between">
              <Text className="text-[16px] font-bold text-slate-900 w-24">Amount</Text>
              <TouchableOpacity
                onPress={() => { Keyboard.dismiss(); setShowDatePicker(false); setShowKeypad(true); }}
                activeOpacity={0.7}
                className="flex-1 flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4 h-[52px]"
              >
                <Text className={`flex-1 font-semibold text-[15px] mr-2 text-right ${amount ? "text-slate-900" : "text-[#94a3b8]"}`}>
                  {amount || "0"}
                </Text>
                <Text className="font-bold text-[18px] text-[#94a3b8] ml-2">{symbol}</Text>
              </TouchableOpacity>
            </View>

            {/* Note */}
            <View className="flex-row items-center justify-between">
              <Text className="text-[16px] font-bold text-slate-900 w-24">Note</Text>
              <View className="flex-1 flex-row items-center rounded-xl border border-gray-200 bg-white px-4 h-[52px]">
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  onFocus={() => setShowKeypad(false)}
                  placeholder="Enter notes"
                  placeholderTextColor="#94a3b8"
                  className="flex-1 font-semibold text-[15px] text-slate-900 text-center h-full"
                />
              </View>
            </View>
          </View>

          {/* ── Categories ───────────────────────────────────────── */}
          <View className="mt-8 mb-4 flex-row items-center justify-between">
            <Text className="text-[16px] font-bold text-slate-900">Category</Text>
            <TouchableOpacity onPress={() => setShowEditor(true)}>
              <Text className="text-[15px] font-bold text-[#1d4ed8]">Edit</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row flex-wrap justify-between gap-y-3 pb-32">
            {activeCategories.map((cat) => {
              const isSelected = categoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setCategoryId(cat.id)}
                  className={`w-[31%] h-24 items-center justify-center rounded-2xl bg-white border ${
                    isSelected ? "border-[#1d4ed8] bg-[#f0f5ff]" : "border-gray-100"
                  }`}
                  style={!isSelected ? {
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.03,
                    shadowRadius: 8,
                    elevation: 1,
                  } : undefined}
                >
                  <MaterialCommunityIcons name={cat.icon as any} size={28} color={cat.color} />
                  <Text className="mt-2 text-[12px] font-semibold text-slate-900 text-center">
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Save button (fixed) ───────────────────────────────────── */}
      <View
        className="absolute bottom-[90px] left-0 right-0 px-4 py-4 bg-white rounded-t-3xl"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 10,
        }}
      >
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSubmitting}
          className={`w-full rounded-2xl h-14 items-center justify-center ${isSubmitting ? "bg-blue-400" : "bg-[#1d4ed8]"}`}
        >
          <Text className="text-white font-semibold text-[16px]">
            {isSubmitting ? "Saving…" : `Save ${type.toLowerCase()}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Calendar modal ────────────────────────────────────────── */}
      <Modal visible={showDatePicker} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowDatePicker(false)}
          className="flex-1 bg-black/40 justify-center px-4"
        >
          <TouchableOpacity activeOpacity={1}>
            <CustomCalendar
              selectedDate={date}
              onSelectDate={(newDate) => setDate(newDate)}
              onClose={() => setShowDatePicker(false)}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Custom keypad ─────────────────────────────────────────── */}
      {showKeypad && (
        <View
          className="absolute bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-[#f0f3fa]"
          style={{
            paddingBottom: Math.max(insets.bottom, 85),
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 10,
            elevation: 20,
          }}
        >
          <CustomKeypad
            onKeyPress={handleKeypadPress}
            onBackspace={handleKeypadBackspace}
            onDone={() => setShowKeypad(false)}
          />
        </View>
      )}

      {/* ── Save feedback ─────────────────────────────────────────── */}
      <SaveFeedback
        visible={feedback.visible}
        type={feedback.type}
        message={feedback.message}
        onDone={() => setFeedback((f) => ({ ...f, visible: false }))}
      />

      {/* ── Category editor ───────────────────────────────────────── */}
      <CategoryEditor
        visible={showEditor}
        categories={activeCategories}
        onSave={(updated) => setActiveCategories(updated)}
        onClose={() => setShowEditor(false)}
      />
    </Screen>
  );
}
