export type TransactionType = "income" | "expense" | "transfer";

export type TransactionCategory =
  | "salary"
  | "investments"
  | "groceries"
  | "transport"
  | "housing"
  | "utilities"
  | "health"
  | "entertainment"
  | "savings"
  | "other";

export type Transaction = {
  id: string;
  accountId: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  currency: string;
  description: string;
  timestamp: string;
  counterparty?: string;
  tags?: string[];
};
