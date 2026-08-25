import { ProtectedRoute } from "@/components/auth/protected-route";
import { DraftReviewScreen } from "@/screens";

export default function DraftsRoute() {
  return (
    <ProtectedRoute>
      <DraftReviewScreen />
    </ProtectedRoute>
  );
}
