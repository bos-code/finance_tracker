import type {
  GoalRecord,
  TransactionRecord,
} from "@/contracts/backend";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TransactionDatabaseInsert = Omit<
  TransactionRecord,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
