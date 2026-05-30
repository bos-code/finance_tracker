import { AuthScreen } from "@/screens/auth/auth-screen";
import { AuthGate } from "@/components/auth/auth-gate";

export default function AuthRoute() {
  return (
    <AuthGate redirect="/(tabs)/home">
      <AuthScreen />
    </AuthGate>
  );
}
