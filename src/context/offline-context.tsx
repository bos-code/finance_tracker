import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNetwork } from "@/hooks/use-network";
import { getPendingOps } from "@/services/offline/offline-store";
import { syncPendingOps } from "@/services/offline/sync-service";

// ─── Types ────────────────────────────────────────────────────────────────────

type OfflineContextValue = {
  /** Device is currently online */
  isOnline: boolean;
  /** Sync is running right now */
  isSyncing: boolean;
  /** Number of operations queued (shown in the badge) */
  pendingCount: number;
  /** Manually refresh the pending count (call after adding an op) */
  refreshPendingCount: () => Promise<void>;
  /** True briefly after a successful sync to flash the "Synced" banner */
  justSynced: boolean;
};

export const OfflineContext = createContext<OfflineContextValue | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function OfflineProvider({ children }: PropsWithChildren) {
  const { isOnline } = useNetwork();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [justSynced, setJustSynced] = useState(false);

  // Track previous online state to detect reconnection
  const prevOnlineRef = useRef(isOnline);

  const refreshPendingCount = useCallback(async () => {
    try {
      const ops = await getPendingOps();
      setPendingCount(ops.length);
    } catch (error) {
      console.warn("[offline] Failed to refresh pending count:", error);
      setPendingCount(0);
    }
  }, []);

  // Refresh count on every change (after adds/removes)
  useEffect(() => {
    void refreshPendingCount();
  }, [refreshPendingCount]);

  // Trigger sync whenever the device comes back online
  useEffect(() => {
    const wasOffline = !prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    if (!isOnline || !wasOffline) return;

    // Just came online — drain the queue
    const doSync = async () => {
      setIsSyncing(true);
      try {
        const { synced } = await syncPendingOps();
        await refreshPendingCount();
        if (synced > 0) {
          setJustSynced(true);
          setTimeout(() => setJustSynced(false), 2500);
        }
      } catch (error) {
        console.warn("[offline] Failed to sync pending operations:", error);
      } finally {
        setIsSyncing(false);
      }
    };

    void doSync();
  }, [isOnline, refreshPendingCount]);

  const value = useMemo<OfflineContextValue>(
    () => ({ isOnline, isSyncing, pendingCount, refreshPendingCount, justSynced }),
    [isOnline, isSyncing, pendingCount, refreshPendingCount, justSynced]
  );

  return (
    <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used inside OfflineProvider");
  return ctx;
}
