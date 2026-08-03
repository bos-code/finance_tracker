import type {
  FinancialAccountContract,
  ProfileContract,
  WorkspaceContract,
} from "@/contracts/backend";
import { BackendError, toBackendError } from "@/services/backend/errors";

import { supabaseClient } from "./supabase-client";

export type FinanceWorkspaceBootstrap = {
  accounts: FinancialAccountContract[];
  profile: ProfileContract;
  workspace: WorkspaceContract;
};

export async function getFinanceWorkspace(
  userId: string,
): Promise<FinanceWorkspaceBootstrap> {
  const [profileResult, workspaceResult] = await Promise.all([
    supabaseClient.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabaseClient
      .from("workspaces")
      .select("*")
      .eq("owner_user_id", userId)
      .eq("workspace_type", "personal")
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    throw toBackendError(profileResult.error, "INTERNAL_ERROR");
  }
  if (workspaceResult.error) {
    throw toBackendError(workspaceResult.error, "INTERNAL_ERROR");
  }
  if (!profileResult.data || !workspaceResult.data) {
    throw new BackendError({ code: "BACKEND_NOT_READY" });
  }

  const { data: accounts, error: accountsError } = await supabaseClient
    .from("financial_accounts")
    .select("*")
    .eq("workspace_id", workspaceResult.data.id)
    .eq("is_archived", false)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (accountsError) throw toBackendError(accountsError, "INTERNAL_ERROR");
  if (!accounts?.length) {
    throw new BackendError({
      code: "BACKEND_NOT_READY",
      message: "Your personal account is still being prepared.",
    });
  }

  return {
    accounts,
    profile: profileResult.data,
    workspace: workspaceResult.data,
  };
}

export async function setPersonalWorkspaceCurrency(
  workspaceId: string,
  currencyCode: string,
) {
  const { data, error } = await supabaseClient
    .rpc("set_personal_workspace_currency", {
      p_currency_code: currencyCode,
      p_workspace_id: workspaceId,
    })
    .single();
  if (error) throw toBackendError(error, "INTERNAL_ERROR");
  return data;
}
