import { supabaseClient } from "./supabase-client";

export type TransactionType = "Expenditure" | "Revenue";

export type TransactionInsert = {
  user_id: string;
  type: TransactionType;
  amount: number;
  note: string;
  category_id: string;
  transaction_date: string; // ISO String
};

export type Transaction = TransactionInsert & {
  id: string;
  created_at: string;
};

export type MonthSummary = {
  totalRevenue: number;
  totalExpenditure: number;
  remaining: number;
};

export type DailyTotal = {
  date: string; // "YYYY-MM-DD"
  revenue: number;
  expenditure: number;
};

export type CategoryBreakdown = {
  category_id: string;
  total: number;
  percentage: number;
};

/**
 * Creates a new financial transaction in the Supabase database.
 */
export async function createTransaction(data: TransactionInsert) {
  const { data: result, error } = await supabaseClient
    .from("transactions")
    .insert([
      {
        user_id: data.user_id,
        type: data.type,
        amount: data.amount,
        note: data.note,
        category_id: data.category_id,
        transaction_date: data.transaction_date,
      },
    ])
    .select();

  if (error) {
    throw new Error(error.message);
  }

  return result?.[0] as Transaction;
}

/**
 * Fetches all transactions for a user within a given month.
 */
export async function getTransactionsByMonth(
  userId: string,
  year: number,
  month: number // 1-12
): Promise<Transaction[]> {
  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 0, 23, 59, 59).toISOString();

  const { data, error } = await supabaseClient
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .gte("transaction_date", start)
    .lte("transaction_date", end)
    .order("transaction_date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Transaction[];
}

/**
 * Calculates totals (revenue, expenditure, remaining) for a given month.
 */
export function calcMonthSummary(transactions: Transaction[]): MonthSummary {
  let totalRevenue = 0;
  let totalExpenditure = 0;

  for (const tx of transactions) {
    if (tx.type === "Revenue") {
      totalRevenue += tx.amount;
    } else {
      totalExpenditure += tx.amount;
    }
  }

  return {
    totalRevenue,
    totalExpenditure,
    remaining: totalRevenue - totalExpenditure,
  };
}

/**
 * Aggregates transactions by calendar day (for the calendar grid view).
 */
export function calcDailyTotals(transactions: Transaction[]): Record<string, DailyTotal> {
  const map: Record<string, DailyTotal> = {};

  for (const tx of transactions) {
    const dateKey = tx.transaction_date.slice(0, 10); // "YYYY-MM-DD"
    if (!map[dateKey]) {
      map[dateKey] = { date: dateKey, revenue: 0, expenditure: 0 };
    }
    if (tx.type === "Revenue") {
      map[dateKey].revenue += tx.amount;
    } else {
      map[dateKey].expenditure += tx.amount;
    }
  }

  return map;
}

/**
 * Returns category spending breakdown for expenditures in a given transaction list.
 */
export function calcCategoryBreakdown(transactions: Transaction[]): CategoryBreakdown[] {
  const map: Record<string, number> = {};
  let totalExpenditure = 0;

  for (const tx of transactions) {
    if (tx.type !== "Expenditure") continue;
    map[tx.category_id] = (map[tx.category_id] || 0) + tx.amount;
    totalExpenditure += tx.amount;
  }

  return Object.entries(map).map(([category_id, total]) => ({
    category_id,
    total,
    percentage: totalExpenditure > 0 ? (total / totalExpenditure) * 100 : 0,
  })).sort((a, b) => b.total - a.total);
}

/**
 * Deletes a transaction by ID.
 */
export async function deleteTransaction(id: string) {
  const { error } = await supabaseClient
    .from("transactions")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/**
 * Updates an existing transaction.
 */
export async function updateTransaction(id: string, data: Partial<TransactionInsert>) {
  const { data: result, error } = await supabaseClient
    .from("transactions")
    .update(data)
    .eq("id", id)
    .select();

  if (error) throw new Error(error.message);
  return result?.[0] as Transaction;
}
