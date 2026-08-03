import AsyncStorage from "@react-native-async-storage/async-storage";

import type { FinanceWorkspaceBootstrap } from "@/services/supabase/workspace-service";

const CACHE_VERSION = "v1";

function cacheKey(userId: string) {
  return `@finance-tracker/workspace/${CACHE_VERSION}/${userId}`;
}

export async function getCachedWorkspace(userId: string) {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as FinanceWorkspaceBootstrap;
    if (
      value.profile.id !== userId ||
      value.workspace.owner_user_id !== userId ||
      value.accounts.some(
        (account) =>
          account.owner_user_id !== userId ||
          account.workspace_id !== value.workspace.id,
      )
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export async function setCachedWorkspace(
  userId: string,
  value: FinanceWorkspaceBootstrap,
) {
  if (
    value.profile.id !== userId ||
    value.workspace.owner_user_id !== userId
  ) {
    throw new Error("Workspace cache owner mismatch.");
  }
  await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(value));
}
