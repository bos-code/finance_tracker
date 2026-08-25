/**
 * Canonical user/workspace contracts (PLAN_BACKEND.md Stage 3).
 *
 * Today there is no `profiles` or `workspaces` table — `full_name`,
 * `theme`, and `currency` live in Supabase Auth `user_metadata`
 * (see `src/services/supabase/auth-service.ts`), and every user implicitly
 * owns exactly one personal data set with no explicit workspace row.
 * Stage 3 introduces `profiles`, `workspaces`, and `workspace_members`
 * without changing the current single-workspace experience.
 */

export type Profile = {
  user_id: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceType = "personal" | "business";

export type Workspace = {
  id: string;
  name: string;
  type: WorkspaceType;
  owner_user_id: string;
  country_code: string | null;
  locale: string | null;
  timezone: string | null;
  default_currency_code: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceRole = "owner" | "collaborator";

export type WorkspaceMember = {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
};
