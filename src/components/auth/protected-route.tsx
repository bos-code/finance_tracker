import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "expo-router";
import React, { PropsWithChildren } from "react";
import { ActivityIndicator, View } from "react-native";

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { user, isBootstrapping } = useAuth();

  // Wait for the auth context to initialize from SecureStore/Supabase
  if (isBootstrapping) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // If no user exists, forcefully boot the user back to the Auth Screen
  if (!user) {
    return <Redirect href="/" />;
  }

  // Otherwise, render the protected children (Tabs Navigator)
  return <>{children}</>;
}
