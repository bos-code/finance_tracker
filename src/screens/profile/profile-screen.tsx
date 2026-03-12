import { Screen } from "@/components/ui/screen";
import { useAuth } from "@/hooks/use-auth";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ROUTES } from "@/navigation/route-names";
import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  Switch,
  Platform,
} from "react-native";

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  
  const [activeModal, setActiveModal] = useState<"money" | "notification" | "language" | null>(null);
  
  // Mock stated settings
  const [currency, setCurrency] = useState("$");
  const [notifications, setNotifications] = useState(false);
  const [language, setLanguage] = useState("Vietnamese");

  const handleLogout = async () => {
    await signOut();
    router.replace(ROUTES.AUTH as any);
  };

  return (
    <Screen className="px-0 bg-[#f4f6f9]">
      <View className="flex-1 mt-10">
        
        {/* Header Section */}
        <View className="flex-row items-center px-6 mb-8 mt-4">
          <View className="h-16 w-16 bg-[#eef2fc] rounded-full items-center justify-center mr-4">
            <Text className="text-3xl">🐱</Text>
          </View>
          <View className="flex-1 justify-center">
            <Text className="text-[18px] font-bold text-slate-900 leading-tight">
              {user?.fullName || "Guest User"}
            </Text>
            <Text className="text-[13px] text-slate-500 mt-1">
              {user?.email || "No email"}
            </Text>
          </View>
        </View>

        {/* Options List */}
        <View className="bg-white">
          {/* Money Row */}
          <TouchableOpacity 
            onPress={() => setActiveModal("money")}
            className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100"
          >
            <View className="flex-row items-center gap-3">
              <MaterialCommunityIcons name="cash" size={24} color="#64748b" />
              <Text className="text-[16px] font-bold text-slate-900">Money</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-[14px] font-semibold text-slate-400">{currency}</Text>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#cbd5e1" />
            </View>
          </TouchableOpacity>

          {/* Notification Row */}
          <TouchableOpacity 
            onPress={() => setActiveModal("notification")}
            className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100"
          >
            <View className="flex-row items-center gap-3">
              <MaterialCommunityIcons name="bell-outline" size={24} color="#64748b" />
              <Text className="text-[16px] font-bold text-slate-900">Notification</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-[14px] font-semibold text-slate-400">
                {notifications ? "Turn on" : "Turn off"}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#cbd5e1" />
            </View>
          </TouchableOpacity>

          {/* Language Row */}
          <TouchableOpacity 
            onPress={() => setActiveModal("language")}
            className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100"
          >
            <View className="flex-row items-center gap-3">
              <MaterialCommunityIcons name="translate" size={24} color="#64748b" />
              <Text className="text-[16px] font-bold text-slate-900">Language</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-[14px] font-semibold text-slate-400">{language}</Text>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#cbd5e1" />
            </View>
          </TouchableOpacity>
          
          {/* Logout Row */}
          <TouchableOpacity 
            onPress={() => void handleLogout()}
            className="flex-row items-center justify-between px-6 py-4"
          >
            <View className="flex-row items-center gap-3">
              <MaterialCommunityIcons name="logout" size={24} color="#ef4444" />
              <Text className="text-[16px] font-bold text-red-500">Log out</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#cbd5e1" />
          </TouchableOpacity>
        </View>
      </View>

      {/* --- MODALS --- */}

      {/* Money Modal */}
      <Modal visible={activeModal === "money"} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setActiveModal(null)}>
        <SafeAreaView className="flex-1 bg-[#f4f6f9]">
          <View className="flex-row items-center px-4 py-4 border-b border-gray-200 bg-white">
            <TouchableOpacity onPress={() => setActiveModal(null)} className="p-2">
              <MaterialCommunityIcons name="chevron-left" size={28} color="#1d4ed8" />
            </TouchableOpacity>
            <Text className="flex-1 text-center pr-10 text-[18px] font-bold text-slate-900">Money</Text>
          </View>
          <View className="mt-4 bg-white border-y border-gray-100 px-4">
            {["$", "€", "£", "¥", "₩"].map((symbol, index, arr) => (
              <TouchableOpacity
                key={symbol}
                onPress={() => { setCurrency(symbol); setActiveModal(null); }}
                className={`flex-row items-center justify-between py-4 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <Text className="text-[18px] font-semibold text-slate-900">{symbol}</Text>
                <View className={`w-6 h-6 rounded-full border ${currency === symbol ? 'border-transparent bg-[#10b981]' : 'border-gray-300'} items-center justify-center`}>
                  {currency === symbol && <MaterialCommunityIcons name="check" size={16} color="white" />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Notification Modal */}
      <Modal visible={activeModal === "notification"} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setActiveModal(null)}>
        <SafeAreaView className="flex-1 bg-[#f4f6f9]">
          <View className="flex-row items-center px-4 py-4 border-b border-gray-200 bg-white">
            <TouchableOpacity onPress={() => setActiveModal(null)} className="p-2">
              <MaterialCommunityIcons name="chevron-left" size={28} color="#1d4ed8" />
            </TouchableOpacity>
            <Text className="flex-1 text-center pr-10 text-[18px] font-bold text-slate-900">Notification</Text>
          </View>
          <View className="mt-4 bg-white border-y border-gray-100 px-6 py-4 flex-row items-center justify-between">
            <Text className="text-[16px] font-bold text-slate-900">Allow notifications</Text>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: "#cbd5e1", true: "#10b981" }}
              ios_backgroundColor="#cbd5e1"
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Language Modal */}
      <Modal visible={activeModal === "language"} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setActiveModal(null)}>
        <SafeAreaView className="flex-1 bg-[#f4f6f9]">
          <View className="flex-row items-center px-4 py-4 border-b border-gray-200 bg-white">
            <TouchableOpacity onPress={() => setActiveModal(null)} className="p-2">
              <MaterialCommunityIcons name="chevron-left" size={28} color="#1d4ed8" />
            </TouchableOpacity>
            <Text className="flex-1 text-center pr-10 text-[18px] font-bold text-slate-900">Language</Text>
          </View>
          <View className="mt-4 bg-white border-y border-gray-100 px-4">
            {[
              { label: "English", id: "English", flag: "🇬🇧" },
              { label: "Vietnamese", id: "Vietnamese", flag: "🇻🇳" }
            ].map((lang, index, arr) => (
              <TouchableOpacity
                key={lang.id}
                onPress={() => { setLanguage(lang.id); setActiveModal(null); }}
                className={`flex-row items-center justify-between py-4 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <View className="flex-row items-center gap-3">
                  <Text className="text-[20px]">{lang.flag}</Text>
                  <Text className="text-[16px] font-bold text-slate-900">{lang.label}</Text>
                </View>
                <View className={`w-6 h-6 rounded-full border ${language === lang.id ? 'border-transparent bg-[#10b981]' : 'border-gray-300'} items-center justify-center`}>
                  {language === lang.id && <MaterialCommunityIcons name="check" size={16} color="white" />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </Modal>

    </Screen>
  );
}
