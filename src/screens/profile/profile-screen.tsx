import { AppButton } from "@/components/common/app-button";
import { Screen } from "@/components/ui/screen";
import { useAuth } from "@/hooks/use-auth";
import { ROUTES } from "@/navigation/route-names";
import { router } from "expo-router";
import { Text, View } from "react-native";

export function ProfileScreen() {
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.replace(ROUTES.AUTH);
  };

  return (
    <Screen>
      <Text className="text-2xl font-bold text-slate-900">Profile</Text>
      <View className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <Text className="text-sm text-slate-500">Signed in as</Text>
        <Text className="mt-1 text-base font-semibold text-slate-900">
          {user?.fullName ?? "Guest User"}
        </Text>
        <Text className="mt-1 text-sm text-slate-600">{user?.email ?? "No email"}</Text>
      </View>

      <View className="mt-6">
        <AppButton title="Sign out" onPress={() => void handleLogout()} />
      </View>
    </Screen>
  );
}
