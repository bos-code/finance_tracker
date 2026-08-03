import type {
  TransactionRecord,
  TransactionType,
} from "@/contracts/backend";

export type MonthSummary = {
  totalRevenue: number;
  totalExpenditure: number;
  remaining: number;
};

export type DailyTotal = {
  date: string;
  revenue: number;
  expenditure: number;
};

export type CategoryBreakdown = {
  category_id: string;
  total: number;
  percentage: number;
};

export function calcMonthSummary(
  transactions: TransactionRecord[],
): MonthSummary {
  let totalRevenue = 0;
  let totalExpenditure = 0;

  for (const transaction of transactions) {
    if (transaction.type === "Revenue") {
      totalRevenue += transaction.amount;
    } else {
      totalExpenditure += transaction.amount;
    }
  }

  return {
    remaining: totalRevenue - totalExpenditure,
    totalExpenditure,
    totalRevenue,
  };
}

export function calcDailyTotals(
  transactions: TransactionRecord[],
): Record<string, DailyTotal> {
  const totals: Record<string, DailyTotal> = {};

  for (const transaction of transactions) {
    const dateKey = transaction.transaction_date.slice(0, 10);
    totals[dateKey] ??= {
      date: dateKey,
      expenditure: 0,
      revenue: 0,
    };
    if (transaction.type === "Revenue") {
      totals[dateKey].revenue += transaction.amount;
    } else {
      totals[dateKey].expenditure += transaction.amount;
    }
  }

  return totals;
}

export function calcCategoryBreakdown(
  transactions: TransactionRecord[],
  type: TransactionType = "Expenditure",
): CategoryBreakdown[] {
  const categoryTotals: Record<string, number> = {};
  let grandTotal = 0;

  for (const transaction of transactions) {
    if (transaction.type !== type) continue;
    categoryTotals[transaction.category_id] =
      (categoryTotals[transaction.category_id] ?? 0) + transaction.amount;
    grandTotal += transaction.amount;
  }

  return Object.entries(categoryTotals)
    .map(([category_id, total]) => ({
      category_id,
      percentage: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
      total,
    }))
    .sort((left, right) => right.total - left.total);
}
