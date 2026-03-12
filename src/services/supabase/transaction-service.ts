import { supabaseClient } from "./supabase-client";

export type TransactionType = "Expenditure" | "Revenue";

export type TransactionInsert = {
  user_id: string;
  type: TransactionType;
  amount: number;
  note: string;
  category_id: string;
  /**
   * Local calendar date in "YYYY-MM-DD" format.
   * Do NOT pass `Date.toISOString()` here — that converts to UTC and will
   * shift the date by a day for users in negative UTC offsets.
   * Use `toLocalDateString(date)` from `@/utils/date` instead.
   */
  transaction_date: string;
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
 * Uses local "YYYY-MM-DD" date strings for range filtering — avoids UTC
 * shift errors that occur when comparing against toISOString() timestamps.
 */
export async function getTransactionsByMonth(
  userId: string,
  year: number,
  month: number // 1-12
): Promise<Transaction[]> {
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${pad(month)}-${pad(lastDay)}`;

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
 * Returns category spending breakdown for a given type in a transaction list.
 * Defaults to "Expenditure" for backwards compatibility.
 */
export function calcCategoryBreakdown(
  transactions: Transaction[],
  type: TransactionType = "Expenditure"
): CategoryBreakdown[] {
  const map: Record<string, number> = {};
  let total = 0;

  for (const tx of transactions) {
    if (tx.type !== type) continue;
    map[tx.category_id] = (map[tx.category_id] || 0) + tx.amount;
    total += tx.amount;
  }

  return Object.entries(map).map(([category_id, amount]) => ({
    category_id,
    total: amount,
    percentage: total > 0 ? (amount / total) * 100 : 0,
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
