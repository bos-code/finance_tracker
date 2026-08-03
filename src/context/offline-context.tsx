import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "@/hooks/use-auth";
import { useNetwork } from "@/hooks/use-network";
import { getPendingSummary } from "@/services/offline/offline-store";
import {
  retryFailedOps,
  syncPendingOps,
} from "@/services/offline/sync-service";

type OfflineContextValue = {
  conflictCount: number;
  failedCount: number;
  isOnline: boolean;
  isSyncing: boolean;
  justSynced: boolean;
  pendingCount: number;
  queuedCount: number;
  refreshPendingCount: () => Promise<void>;
  retryFailed: () => Promise<void>;
  syncNow: () => Promise<void>;
};

const EMPTY_SUMMARY = {
  conflict: 0,
  failed: 0,
  queued: 0,
  syncing: 0,
  total: 0,
};

export const OfflineContext = createContext<OfflineContextValue | undefined>(
  undefined,
);

export function OfflineProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const [isSyncing, setIsSyncing] = useState(false);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [justSynced, setJustSynced] = useState(false);
  const syncFlight = useRef<Promise<void> | null>(null);
  const syncedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshPendingCount = useCallback(async () => {
    if (!user?.uid) {
      setSummary(EMPTY_SUMMARY);
      return;
    }
    try {
      setSummary(await getPendingSummary(user.uid));
    } catch (error) {
      console.warn("[offline] Could not read the local queue:", error);
    }
  }, [user?.uid]);

  const runSync = useCallback(
    async (mode: "due" | "failed" | "force" = "due") => {
      if (!isOnline || !user?.uid) return;
      if (syncFlight.current) return syncFlight.current;

      const flight = (async () => {
        setIsSyncing(true);
        try {
          const result =
            mode === "failed"
              ? await retryFailedOps(user.uid)
              : await syncPendingOps(user.uid, mode === "force");
          await refreshPendingCount();
          if (result.synced > 0) {
            setJustSynced(true);
            if (syncedTimer.current) clearTimeout(syncedTimer.current);
            syncedTimer.current = setTimeout(() => {
              setJustSynced(false);
            }, 2500);
          }
        } catch (error) {
          console.warn("[offline] Could not synchronize local changes:", error);
          await refreshPendingCount();
        } finally {
          setIsSyncing(false);
        }
      })();

      syncFlight.current = flight;
      try {
        await flight;
      } finally {
        if (syncFlight.current === flight) syncFlight.current = null;
      }
    },
    [isOnline, refreshPendingCount, user?.uid],
  );

  const retryFailed = useCallback(() => runSync("failed"), [runSync]);
  const syncNow = useCallback(() => runSync("force"), [runSync]);

  useEffect(() => {
    void refreshPendingCount();
  }, [refreshPendingCount]);

  // Restores work after an app restart and drains it after every reconnection.
  useEffect(() => {
    if (isOnline && user?.uid) void runSync("due");
  }, [isOnline, runSync, user?.uid]);

  // Due retries use persisted exponential backoff; this timer merely wakes the
  // queue and does not reset any retry metadata.
  useEffect(() => {
    if (!isOnline || !user?.uid) return;
    const timer = setInterval(() => void runSync("due"), 30_000);
    return () => clearInterval(timer);
  }, [isOnline, runSync, user?.uid]);

  useEffect(
    () => () => {
      if (syncedTimer.current) clearTimeout(syncedTimer.current);
    },
    [],
  );

  const value = useMemo<OfflineContextValue>(
    () => ({
      conflictCount: summary.conflict,
      failedCount: summary.failed,
      isOnline,
      isSyncing,
      justSynced,
      pendingCount: summary.total,
      queuedCount: summary.queued + summary.syncing,
      refreshPendingCount,
      retryFailed,
      syncNow,
    }),
    [
      isOnline,
      isSyncing,
      justSynced,
      refreshPendingCount,
      retryFailed,
      summary,
      syncNow,
    ],
  );

  return (
    <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) throw new Error("useOffline must be used inside OfflineProvider");
  return context;
}
