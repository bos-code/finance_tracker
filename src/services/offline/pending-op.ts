import type {
  TransactionInsert,
  TransactionUpdate,
} from "@/contracts/backend";

// ─── Pending operation union type ────────────────────────────────────────────

export type PendingCreate = {
  id: string;           // local temp UUID before Supabase assigns the real one
  opType: "create";
  payload: TransactionInsert & { tempId: string };
  createdAt: number;   // epoch ms for ordering
};

export type PendingDelete = {
  id: string;          // same as the transaction ID being deleted
  opType: "delete";
  payload: { transactionId: string };
  createdAt: number;
};

export type PendingUpdate = {
  id: string;           // same as the transaction ID being updated
  opType: "update";
  payload: { transactionId: string; data: TransactionUpdate };
  createdAt: number;
};

export type PendingOp = PendingCreate | PendingDelete | PendingUpdate;
