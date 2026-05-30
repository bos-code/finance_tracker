import { BottomTabs } from "@/navigation/bottom-tabs-navigator";
import { ProtectedRoute } from "@/components/auth/protected-route";

export default function TabsLayout() {
  return (
    <ProtectedRoute>
      <BottomTabs />
    </ProtectedRoute>
  );
}
