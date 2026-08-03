import type {
  GoalRecord,
  TransactionInsert,
  TransactionRecord,
  TransactionSource,
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
  "user_id" | "title" | "target_amount"
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
        };
        Returns: TransactionRecord[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
