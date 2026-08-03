import type {
  CurrencyContract,
  FinancialAccountContract,
  GoalRecord,
  ProfileContract,
  TransactionAttachmentContract,
  TransactionInsert,
  TransactionRecord,
  TransactionSource,
  WorkspaceContract,
  WorkspaceMemberContract,
} from "@/contracts/backend";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TransactionDatabaseInsert = TransactionInsert & {
  id?: string;
  idempotency_key?: string | null;
  lifecycle?: TransactionRecord["lifecycle"];
  source?: TransactionSource;
  revision?: number;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type GoalDatabaseInsert = Pick<
  GoalRecord,
  "user_id" | "workspace_id" | "title" | "target_amount"
> & {
  id?: string;
  goal_type?: GoalRecord["goal_type"];
  saved_amount?: number;
  currency_code?: string;
  target_date?: string | null;
  notes?: string | null;
  icon_name?: string;
  color?: string;
  status?: GoalRecord["status"];
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type ProfileDatabaseInsert = Omit<
  ProfileContract,
  "created_at" | "updated_at"
> & {
  created_at?: string;
  updated_at?: string;
};

type WorkspaceDatabaseInsert = Omit<
  WorkspaceContract,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

type FinancialAccountDatabaseInsert = Omit<
  FinancialAccountContract,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

type TransactionMutationRow = {
  id: string;
  user_id: string;
  idempotency_key: string;
  operation: "create" | "update" | "delete";
  request_payload: Json;
  transaction_id: string | null;
  result_snapshot: Json | null;
  created_at: string;
};

type TransactionAttachmentDatabaseInsert = Omit<
  TransactionAttachmentContract,
  | "created_at"
  | "updated_at"
  | "uploaded_at"
  | "processing_status"
> & {
  created_at?: string;
  updated_at?: string;
  uploaded_at?: string | null;
  processing_status?: TransactionAttachmentContract["processing_status"];
};

export type Database = {
  public: {
    Tables: {
      transactions: {
        Row: Required<TransactionRecord>;
        Insert: TransactionDatabaseInsert;
        Update: Partial<TransactionDatabaseInsert>;
        Relationships: [];
      };
      goals: {
        Row: GoalRecord;
        Insert: GoalDatabaseInsert;
        Update: Partial<GoalDatabaseInsert>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileContract;
        Insert: ProfileDatabaseInsert;
        Update: Partial<Omit<ProfileDatabaseInsert, "id">>;
        Relationships: [];
      };
      workspaces: {
        Row: WorkspaceContract;
        Insert: WorkspaceDatabaseInsert;
        Update: Partial<Omit<WorkspaceDatabaseInsert, "owner_user_id">>;
        Relationships: [];
      };
      workspace_members: {
        Row: WorkspaceMemberContract;
        Insert: WorkspaceMemberContract;
        Update: Partial<Pick<WorkspaceMemberContract, "role">>;
        Relationships: [];
      };
      financial_accounts: {
        Row: FinancialAccountContract;
        Insert: FinancialAccountDatabaseInsert;
        Update: Partial<FinancialAccountDatabaseInsert>;
        Relationships: [];
      };
      currencies: {
        Row: CurrencyContract;
        Insert: CurrencyContract;
        Update: Partial<Omit<CurrencyContract, "code">>;
        Relationships: [];
      };
      country_currency_defaults: {
        Row: { country_code: string; currency_code: string };
        Insert: { country_code: string; currency_code: string };
        Update: { currency_code?: string };
        Relationships: [];
      };
      transaction_mutations: {
        Row: TransactionMutationRow;
        Insert: Omit<TransactionMutationRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<TransactionMutationRow>;
        Relationships: [];
      };
      transaction_attachments: {
        Row: TransactionAttachmentContract;
        Insert: TransactionAttachmentDatabaseInsert;
        Update: Partial<TransactionAttachmentDatabaseInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      handle_goal_write: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
      handle_row_updated_at: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
      handle_transaction_write: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
      mutate_transaction: {
        Args: {
          p_operation: "create" | "update" | "delete";
          p_idempotency_key: string;
          p_transaction_id?: string | null;
          p_expected_revision?: number | null;
          p_type?: TransactionRecord["type"] | null;
          p_amount?: number | null;
          p_note?: string | null;
          p_category_id?: string | null;
          p_transaction_date?: string | null;
          p_source?: TransactionSource;
          p_workspace_id?: string | null;
          p_account_id?: string | null;
          p_currency_code?: string | null;
          p_base_currency_code?: string | null;
          p_exchange_rate?: number | null;
        };
        Returns: TransactionRecord[];
      };
      is_workspace_member: {
        Args: { p_workspace_id: string };
        Returns: boolean;
      };
      is_workspace_owner: {
        Args: { p_workspace_id: string };
        Returns: boolean;
      };
      set_personal_workspace_currency: {
        Args: { p_workspace_id: string; p_currency_code: string };
        Returns: WorkspaceContract[];
      };
      delete_transaction_attachment_record: {
        Args: { p_attachment_id: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
