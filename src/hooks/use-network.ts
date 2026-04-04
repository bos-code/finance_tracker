import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

/**
 * Returns true when the device has an active internet connection.
 * Uses @react-native-community/netinfo, which listens for connectivity changes.
 * Defaults to `true` on boot to avoid false-offline flashes before the first event.
 */
export function useNetwork(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Fetch current state immediately on mount
    void NetInfo.fetch()
      .then((state) => {
        setIsOnline(state.isConnected ?? true);
      })
      .catch((error) => {
        console.warn("[network] Failed to read current connectivity:", error);
        setIsOnline(true);
      });

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? true);
    });

    return unsubscribe;
  }, []);

  return { isOnline };
}
