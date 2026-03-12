import { Screen } from "@/components/ui/screen";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  ScrollView,
  Keyboard,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useAuth } from "@/hooks/use-auth";
import { createTransaction } from "@/services/supabase/transaction-service";
import { CustomKeypad } from "@/components/ui/custom-keypad";

type TransactionType = "Expenditure" | "Revenue";

const CATEGORIES = [
  { id: "market", label: "Market", icon: "store", color: "#f43f5e" }, // rose-500
  { id: "eat", label: "Eat and drink", icon: "silverware-fork-knife", color: "#f59e0b" }, // amber-500
  { id: "shopping", label: "Shopping", icon: "cart-outline", color: "#3b82f6" }, // blue-500
  { id: "gasoline", label: "Gasoline", icon: "gas-station", color: "#0ea5e9" }, // sky-500
  { id: "house", label: "House", icon: "home-outline", color: "#a855f7" }, // purple-500
  { id: "electricity", label: "Electricity", icon: "lightning-bolt", color: "#eab308" }, // yellow-500
  { id: "phone", label: "Load phone", icon: "cellphone", color: "#22c55e" }, // green-500
  { id: "school", label: "School", icon: "school-outline", color: "#6366f1" }, // indigo-500
  { id: "credit", label: "Credit card", icon: "credit-card-outline", color: "#06b6d4" }, // cyan-500
];

export function HomeScreen() {
  const { user } = useAuth();
  
  const [type, setType] = useState<TransactionType>("Expenditure");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState("shopping");
  
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);

  const onChangeDate = (event: DateTimePickerEvent, selectedDate?: Date) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === 'ios');
    setDate(currentDate);
  };

  const handleKeypadPress = (key: string) => {
    let raw = amount.replace(/[^0-9.]/g, "");
    
    // Prevent multiple decimals
    if (key === "." && raw.includes(".")) return;
    
    raw += key;
    
    if (raw === "" || raw === ".") {
      setAmount(raw);
      return;
    }
    
    const parts = raw.split(".");
    const integerPart = parseInt(parts[0] || "0", 10).toLocaleString("en-US");
    const newFormatted = parts.length > 1 ? `${integerPart}.${parts[1]}` : integerPart;
    setAmount(newFormatted);
  };

  const handleKeypadBackspace = () => {
    let raw = amount.replace(/[^0-9.]/g, "");
    if (raw.length === 0) return;
    
    raw = raw.slice(0, -1);
    
    if (raw === "") {
      setAmount("");
      return;
    }
    
    const parts = raw.split(".");
    const integerPart = parseInt(parts[0] || "0", 10).toLocaleString("en-US");
    const newFormatted = parts.length > 1 ? `${integerPart}.${parts[1]}` : integerPart;
    setAmount(newFormatted);
  };

  const handleSave = async () => {
    if (!user) {
      Alert.alert("Error", "You must be signed in to save expenses.");
      return;
    }

    const rawAmount = parseFloat(amount.replace(/[^0-9.]/g, ""));

    if (!rawAmount || rawAmount <= 0) {
      Alert.alert("Invalid Input", "Please enter a valid amount greater than 0.");
      return;
    }

    try {
      setIsSubmitting(true);
      await createTransaction({
        user_id: user.uid,
        type,
        amount: rawAmount,
        note,
        category_id: categoryId,
        transaction_date: date.toISOString(),
      });

      Alert.alert("Success", `Your ${type.toLowerCase()} has been saved securely.`);
      
      // Reset form on success
      setAmount("");
      setNote("");
      setDate(new Date());

    } catch (err: any) {
      Alert.alert("Save Failed", err?.message || "There was an issue saving this transaction.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen className="px-0 bg-[#f4f6f9]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-4 pt-2 pb-[100px]" showsVerticalScrollIndicator={false}>
          {/* Header Toggle */}
          <View className="flex-row rounded-2xl bg-[#dce7ff] p-1 mt-2 mb-8">
            <TouchableOpacity
              onPress={() => setType("Expenditure")}
              className={`flex-1 rounded-xl py-3 items-center justify-center ${
                type === "Expenditure" ? "bg-[#1d4ed8]" : ""
              }`}
            >
              <Text
                className={`font-semibold text-[15px] ${
                  type === "Expenditure" ? "text-white" : "text-[#1d4ed8]"
                }`}
              >
                Expenditure
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setType("Revenue")}
              className={`flex-1 rounded-xl py-3 items-center justify-center ${
                type === "Revenue" ? "bg-[#1d4ed8]" : ""
              }`}
            >
              <Text
                className={`font-semibold text-[15px] ${
                  type === "Revenue" ? "text-white" : "text-[#1d4ed8]"
                }`}
              >
                Revenue
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields container */}
          <View className="gap-5">
            {/* Time */}
            <View className="flex-row items-center justify-between">
              <Text className="text-[16px] font-bold text-slate-900 w-24">Time</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="flex-1 flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 h-[52px]"
              >
                <MaterialCommunityIcons name="calendar-month-outline" size={24} color="#1d4ed8" />
                <Text className="font-semibold text-[15px] text-slate-900">
                  {date.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' })}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={24} color="#1d4ed8" />
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                testID="dateTimePicker"
                value={date}
                mode="date"
                is24Hour={true}
                display="default"
                onChange={onChangeDate}
              />
            )}

            {/* Amount */}
            <View className="flex-row items-center justify-between">
              <Text className="text-[16px] font-bold text-slate-900 w-24">Amount</Text>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setShowDatePicker(false);
                  setShowKeypad(true);
                }}
                activeOpacity={0.7}
                className="flex-1 flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4 h-[52px]"
              >
                <Text 
                  className={`flex-1 font-semibold text-[15px] mr-2 text-right ${
                    amount ? "text-slate-900" : "text-[#94a3b8]"
                  }`}
                >
                  {amount || "0"}
                </Text>
                <Text className="font-bold text-[18px] text-[#94a3b8] ml-2">
                  {type === "Expenditure" ? "$" : "D"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Note */}
            <View className="flex-row items-center justify-between">
              <Text className="text-[16px] font-bold text-slate-900 w-24">Note</Text>
              <View className="flex-1 flex-row items-center rounded-xl border border-gray-200 bg-white px-4 h-[52px]">
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Enter notes"
                  placeholderTextColor="#94a3b8"
                  className="flex-1 font-semibold text-[15px] text-slate-900 text-center h-full"
                />
              </View>
            </View>
          </View>

          {/* Categories */}
          <View className="mt-8 mb-4 flex-row items-center justify-between">
            <Text className="text-[16px] font-bold text-slate-900">Category</Text>
            <TouchableOpacity>
              <Text className="text-[15px] font-bold text-[#1d4ed8]">Edit</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row flex-wrap justify-between gap-y-3 pb-32">
            {CATEGORIES.map((cat) => {
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

      {/* Save Button (Fixed at bottom) */}
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
          className={`w-full rounded-2xl h-14 items-center justify-center ${
            isSubmitting ? "bg-blue-400" : "bg-[#1d4ed8]"
          }`}
        >
          <Text className="text-white font-semibold text-[16px]">
            {isSubmitting ? "Saving..." : `Save ${type.toLowerCase()}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Custom Keypad Slider */}
      {showKeypad && (
        <View 
          className="absolute bottom-0 left-0 right-0 z-50"
          style={{ paddingBottom: 85 }} // Offset to sit exactly above bottom tabs gracefully or cover fully
        >
          <CustomKeypad 
            onKeyPress={handleKeypadPress}
            onBackspace={handleKeypadBackspace}
            onDone={() => setShowKeypad(false)}
          />
        </View>
      )}
    </Screen>
  );
}
