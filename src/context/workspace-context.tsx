import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  BackendErrorCode,
  FinancialAccountContract,
  ProfileContract,
  WorkspaceContract,
} from "@/contracts/backend";
import { UI_PREVIEW_ENABLED } from "@/config/runtime";
import {
  PREVIEW_ACCOUNT,
  PREVIEW_PROFILE,
  PREVIEW_WORKSPACE,
} from "@/fixtures/preview-workspace";
import { useAuth } from "@/hooks/use-auth";
import { toBackendError } from "@/services/backend/errors";
import {
  getCachedWorkspace,
  setCachedWorkspace,
} from "@/services/offline/workspace-cache";
import { supabaseUpdateUserSettings } from "@/services/supabase/auth-service";
import {
  getFinanceWorkspace,
  setPersonalWorkspaceCurrency,
  type FinanceWorkspaceBootstrap,
} from "@/services/supabase/workspace-service";
import {
  CURRENCY_OPTIONS,
  useAppStore,
} from "@/store/use-app-store";

type WorkspaceContextValue = {
  accounts: FinancialAccountContract[];
  activeAccount: FinancialAccountContract | null;
  errorCode: BackendErrorCode | null;
  isLoading: boolean;
  profile: ProfileContract | null;
  refresh: () => Promise<void>;
  setBaseCurrency: (currencyCode: string) => Promise<void>;
  workspace: WorkspaceContract | null;
};

const previewBootstrap: FinanceWorkspaceBootstrap = {
  accounts: [PREVIEW_ACCOUNT],
  profile: PREVIEW_PROFILE,
  workspace: PREVIEW_WORKSPACE,
};
const EMPTY_ACCOUNTS: FinancialAccountContract[] = [];

export const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(
  undefined,
);

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [bootstrap, setBootstrap] = useState<FinanceWorkspaceBootstrap | null>(
    UI_PREVIEW_ENABLED ? previewBootstrap : null,
  );
  const [isLoading, setIsLoading] = useState(!UI_PREVIEW_ENABLED);
  const [errorCode, setErrorCode] = useState<BackendErrorCode | null>(null);

  const applyBootstrap = useCallback(async (next: FinanceWorkspaceBootstrap) => {
    setBootstrap(next);
    const currency = CURRENCY_OPTIONS.find(
      (option) => option.code === next.workspace.default_currency,
    );
    if (currency) await useAppStore.getState().setCurrency(currency);
  }, []);

  const refresh = useCallback(async () => {
    if (!user?.uid) {
      setBootstrap(null);
      setErrorCode(null);
      setIsLoading(false);
      return;
    }
    if (UI_PREVIEW_ENABLED) {
      await applyBootstrap(previewBootstrap);
      setErrorCode(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const next = await getFinanceWorkspace(user.uid);
      await applyBootstrap(next);
      void setCachedWorkspace(user.uid, next).catch(() => {
        console.warn("[workspace] Could not refresh the local workspace cache.");
      });
      setErrorCode(null);
    } catch (error) {
      const backendError = toBackendError(error);
      const cached = await getCachedWorkspace(user.uid);
      if (cached) await applyBootstrap(cached);
      else setBootstrap(null);
      setErrorCode(backendError.code);
    } finally {
      setIsLoading(false);
    }
  }, [applyBootstrap, user?.uid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setBaseCurrency = useCallback(
    async (currencyCode: string) => {
      if (!user?.uid || !bootstrap) {
        throw new Error("Your personal workspace is not ready yet.");
      }
      const currency = CURRENCY_OPTIONS.find(
        (option) => option.code === currencyCode,
      );
      if (!currency) throw new Error("That currency is not supported.");

      const workspace = UI_PREVIEW_ENABLED
        ? {
            ...bootstrap.workspace,
            currency_detection_source: "manual" as const,
            default_currency: currencyCode,
            updated_at: new Date().toISOString(),
          }
        : await setPersonalWorkspaceCurrency(
            bootstrap.workspace.id,
            currencyCode,
          );
      const next = {
        ...bootstrap,
        accounts: bootstrap.accounts.map((account) =>
          account.is_default
            ? { ...account, currency_code: currencyCode }
            : account,
        ),
        workspace,
      };
      await applyBootstrap(next);
      if (!UI_PREVIEW_ENABLED) {
        void setCachedWorkspace(user.uid, next).catch(() => {
          console.warn("[workspace] Could not refresh the local workspace cache.");
        });
        void supabaseUpdateUserSettings({ currency: currency.id }).catch(() => {
          console.warn("[workspace] Could not mirror the legacy currency setting.");
        });
      }
    },
    [applyBootstrap, bootstrap, user?.uid],
  );

  const accounts = bootstrap?.accounts ?? EMPTY_ACCOUNTS;
  const activeAccount =
    accounts.find((account) => account.is_default) ?? accounts[0] ?? null;
  const value = useMemo<WorkspaceContextValue>(
    () => ({
      accounts,
      activeAccount,
      errorCode,
      isLoading,
      profile: bootstrap?.profile ?? null,
      refresh,
      setBaseCurrency,
      workspace: bootstrap?.workspace ?? null,
    }),
    [
      accounts,
      activeAccount,
      bootstrap?.profile,
      bootstrap?.workspace,
      errorCode,
      isLoading,
      refresh,
      setBaseCurrency,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider");
  }
  return context;
}
