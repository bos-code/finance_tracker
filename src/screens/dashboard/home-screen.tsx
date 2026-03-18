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
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useCreateTransaction } from "@/hooks/use-transactions";
import { UnifiedNumpad } from "@/components/ui/unified-numpad";
import { CustomCalendar } from "@/components/ui/custom-calendar";
import { SaveFeedback } from "@/components/ui/save-feedback";
import { CategoryEditor } from "@/components/ui/category-editor";
import { EXPENDITURE_CATEGORIES, REVENUE_CATEGORIES, type Category } from "@/constants/categories";
import { useAppStore, formatAmount } from "@/store/use-app-store";
import { useOffline } from "@/context/offline-context";
import { toLocalDateString } from "@/utils/date";

type TransactionType = "Expenditure" | "Revenue";

export function HomeScreen() {
  const { user } = useAuth();
  const theme = useAppStore((s) => s.theme);
  const currency = useAppStore((s) => s.currency);
  const { isOnline, pendingCount, refreshPendingCount } = useOffline();
  const primary = theme.primary;
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

  // ── UI drawers ──────────────────────────────────────────────────
  type DrawerType = "none" | "amount" | "date" | "note" | "category";
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>("none");

  const closeDrawer = useCallback(() => setActiveDrawer("none"), []);
  const openDrawer = useCallback((d: DrawerType) => {
    Keyboard.dismiss();
    setActiveDrawer(d);
    if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // ── Save feedback ────────────────────────────────────────────────
  const [feedback, setFeedback] = useState<{ visible: boolean; type: "success" | "error"; message: string }>({
    visible: false,
    type: "success",
    message: "",
  });

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
  const { mutateAsync: createTx, isPending: isSubmitting } = useCreateTransaction();

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
      closeDrawer();
      await createTx({
        user_id: user.uid,
        type,
        amount: rawAmount,
        note,
        category_id: categoryId,
        transaction_date: toLocalDateString(date),
      });
      // Refresh pending badge after offline save
      await refreshPendingCount();
      const msg = isOnline
        ? `${type} saved successfully.`
        : `${type} saved locally — will sync when online.`;
      setFeedback({ visible: true, type: "success", message: msg });
      setAmount("");
      setNote("");
      setDate(new Date());
    } catch (err: any) {
      setFeedback({ visible: true, type: "error", message: err?.message || "Could not save transaction." });
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
        <ScrollView 
          className="flex-1 px-4 pt-2" 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ 
            paddingBottom: activeDrawer === "amount" || activeDrawer === "note" ? 420 : 160 
          }}
        >

          {/* ── Type toggle ──────────────────────────────────────── */}
          <View style={{ flexDirection: "row", borderRadius: 16, backgroundColor: primary + "20", padding: 4, marginTop: 8, marginBottom: 32 }}>
            {(["Expenditure", "Revenue"] as TransactionType[]).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => switchType(t)}
                style={{ flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center", justifyContent: "center", backgroundColor: type === t ? primary : "transparent" }}
              >
                <Text style={{ fontWeight: "600", fontSize: 15, color: type === t ? "#fff" : primary }}>
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
                onPress={() => openDrawer("date")}
                className="flex-1 flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 h-[52px]"
              >
                <MaterialCommunityIcons name="calendar-month-outline" size={24} color={primary} />
                <Text className="font-semibold text-[15px] text-slate-900">
                  {date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={24} color={primary} />
              </TouchableOpacity>
            </View>

            {/* Amount */}
            <View className="flex-row items-center justify-between">
              <Text className="text-[16px] font-bold text-slate-900 w-24">Amount</Text>
              <TouchableOpacity
                onPress={() => openDrawer("amount")}
                activeOpacity={0.7}
                className="flex-1 flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4 h-[52px]"
              >
                <Text className={`flex-1 font-semibold text-[15px] mr-2 text-right ${amount ? "text-slate-900" : "text-[#94a3b8]"}`}>
                  {amount || "0"}
                </Text>
                <Text className="font-bold text-[18px] text-[#94a3b8] ml-2">{currency.symbol}</Text>
              </TouchableOpacity>
            </View>

            {/* Note */}
            <TouchableOpacity
              onPress={() => openDrawer("note")}
              activeOpacity={0.7}
              className="flex-row items-center justify-between"
            >
              <Text className="text-[16px] font-bold text-slate-900 w-24">Note</Text>
              <View className="flex-1 flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4 h-[52px]">
                <Text className={`flex-1 font-semibold text-[15px] text-center ${note ? "text-slate-900" : "text-[#94a3b8]"}`}>
                  {note || "Enter notes"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ── Categories ───────────────────────────────────────── */}
          <View className="mt-8 mb-4 flex-row items-center justify-between">
            <Text className="text-[16px] font-bold text-slate-900">Category</Text>
            <TouchableOpacity onPress={() => openDrawer("category")}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: primary }}>Edit</Text>
            </TouchableOpacity>
          </View>

          {/* ── Save button ────────────────────────────────────────── */}
          <View className="mt-4 mb-10">
            <TouchableOpacity
              onPress={handleSave}
              disabled={isSubmitting}
              style={{ 
                width: "100%", 
                borderRadius: 20, 
                height: 60, 
                alignItems: "center", 
                justifyContent: "center", 
                backgroundColor: isSubmitting ? primary + "80" : primary,
                shadowColor: primary,
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.3,
                shadowRadius: 15,
                elevation: 12,
              }}
            >
              <Text className="text-white font-bold text-[17px] tracking-wide">
                {isSubmitting ? "Processing…" : `Save ${type} Transaction`}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>


      {/* ── Calendar modal ────────────────────────────────────────── */}
      <Modal visible={activeDrawer === "date"} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={closeDrawer}
          className="flex-1 bg-black/40 justify-center px-4"
        >
          <TouchableOpacity activeOpacity={1}>
            <CustomCalendar
              selectedDate={date}
              onSelectDate={(newDate) => setDate(newDate)}
              onClose={closeDrawer}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Custom keypad ─────────────────────────────────────────── */}
      {activeDrawer === "amount" && (
        <View
          className="absolute bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-[#f0f3fa]"
          style={{
            paddingBottom: Math.max(insets.bottom, 20),
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 10,
            elevation: 20,
            zIndex: 1000,
          }}
        >
          <UnifiedNumpad
            value={amount}
            onChange={(val) => {
              // Re-apply localization formatting
              let raw = val.replace(/[^0-9.]/g, "");
              if (raw === "" || raw === ".") { setAmount(raw); return; }
              const parts = raw.split(".");
              const int = parseInt(parts[0] || "0", 10).toLocaleString("en-US");
              setAmount(parts.length > 1 ? `${int}.${parts[1]}` : int);
            }}
            mode="amount"
            onDone={closeDrawer}
          />
        </View>
      )}

      {/* ── Note Input Modal (Pop up) ───────────────────────────── */}
      <Modal visible={activeDrawer === "note"} transparent animationType="slide" statusBarTranslucent>
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: "rgba(10,18,40,0.4)" }} 
          activeOpacity={1} 
          onPress={closeDrawer} 
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
        >
          <View 
            className="rounded-t-[32px] bg-white"
            style={{ 
              paddingBottom: Math.max(insets.bottom, 24),
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -10 },
              shadowOpacity: 0.15,
              shadowRadius: 20,
              elevation: 40 
            }}
          >
            <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 8 }}>
              <View style={{ width: 40, height: 4, borderRadius: 99, backgroundColor: "#e2e8f0" }} />
            </View>
            
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#0f172a" }}>Add Note</Text>
              <TouchableOpacity onPress={closeDrawer} style={{ padding: 4 }}>
                <MaterialCommunityIcons name="close" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20 }}>
              <View 
                style={{ 
                  backgroundColor: "#f8fafc", 
                  borderRadius: 20, 
                  borderWidth: 1.5, 
                  borderColor: "#f1f5f9",
                  padding: 16,
                  minHeight: 140
                }}
              >
                <TextInput
                  autoFocus
                  value={note}
                  onChangeText={setNote}
                  placeholder="What was this for? (e.g. Groceries at Whole Foods)"
                  placeholderTextColor="#94a3b8"
                  multiline
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#0f172a",
                    textAlignVertical: "top",
                    flex: 1
                  }}
                />
              </View>

              <TouchableOpacity
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  closeDrawer();
                }}
                style={{
                  backgroundColor: primary,
                  borderRadius: 18,
                  height: 56,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 20,
                  shadowColor: primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 5
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Confirm Note</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Save feedback ─────────────────────────────────────────── */}
      <SaveFeedback
        visible={feedback.visible}
        type={feedback.type}
        message={feedback.message}
        onDone={() => setFeedback((f) => ({ ...f, visible: false }))}
      />

      {/* ── Category editor ───────────────────────────────────────── */}
      <CategoryEditor
        visible={activeDrawer === "category"}
        categories={activeCategories}
        onSave={(updated) => setActiveCategories(updated)}
        onClose={closeDrawer}
      />
    </Screen>
  );
}
