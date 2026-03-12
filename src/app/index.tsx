import { AuthScreen } from "@/screens/auth/auth-screen";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function AuthRoute() {
  const { user, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/(tabs)/home" />;
  }

  return <AuthScreen />;
}
