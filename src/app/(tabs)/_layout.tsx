import { BottomTabsNavigator } from "@/navigation/bottom-tabs-navigator";
import { ProtectedRoute } from "@/components/auth/protected-route";

export default function TabsLayout() {
  return (
    <ProtectedRoute>
      <BottomTabsNavigator />
    </ProtectedRoute>
  );
}
