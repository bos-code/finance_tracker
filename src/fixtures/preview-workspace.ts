import type {
  FinancialAccountContract,
  ProfileContract,
  WorkspaceContract,
} from "@/contracts/backend";
import {
  PREVIEW_ACCOUNT_ID,
  PREVIEW_USER,
  PREVIEW_WORKSPACE_ID,
} from "@/fixtures/preview-data";

const timestamp = new Date().toISOString();

export const PREVIEW_PROFILE: ProfileContract = {
  country_code: "US",
  created_at: timestamp,
  full_name: PREVIEW_USER.fullName,
  id: PREVIEW_USER.uid,
  locale: "en-US",
  timezone: "America/New_York",
  updated_at: timestamp,
};

export const PREVIEW_WORKSPACE: WorkspaceContract = {
  created_at: timestamp,
  currency_detection_source: "device_region",
  default_currency: "USD",
  id: PREVIEW_WORKSPACE_ID,
  name: "Personal Finance",
  owner_user_id: PREVIEW_USER.uid,
  updated_at: timestamp,
  workspace_type: "personal",
};

export const PREVIEW_ACCOUNT: FinancialAccountContract = {
  account_type: "cash",
  created_at: timestamp,
  currency_code: "USD",
  id: PREVIEW_ACCOUNT_ID,
  is_archived: false,
  is_default: true,
  name: "Cash",
  opening_balance: 0,
  owner_user_id: PREVIEW_USER.uid,
  updated_at: timestamp,
  workspace_id: PREVIEW_WORKSPACE.id,
};
