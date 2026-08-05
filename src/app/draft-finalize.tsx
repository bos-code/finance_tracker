import { ProtectedRoute } from "@/components/auth/protected-route";
import { DraftFinalizationScreen } from "@/screens";

export default function DraftFinalizationRoute() {
  return (
    <ProtectedRoute>
      <DraftFinalizationScreen />
    </ProtectedRoute>
  );
}
