import type {
  Transaction,
  TransactionInsert,
} from "@/services/supabase/transaction-service";

export const PREVIEW_USER = {
  uid: "preview-user",
  email: "jordan@example.com",
  fullName: "Jordan Lee",
} as const;

function localDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const today = new Date();
const previewYear = today.getFullYear();
const previewMonth = today.getMonth() + 1;
const lastDay = new Date(previewYear, previewMonth, 0).getDate();
const currentDay = Math.max(1, Math.min(today.getDate(), lastDay));
const day = (offset: number) => Math.max(1, currentDay - offset);

let previewTransactions: Transaction[] = [
  {
    id: "preview-salary",
    user_id: PREVIEW_USER.uid,
    type: "Revenue",
    amount: 4850,
    note: "Monthly salary",
    category_id: "salary",
    transaction_date: localDate(previewYear, previewMonth, day(12)),
    created_at: new Date().toISOString(),
  },
  {
    id: "preview-studio",
    user_id: PREVIEW_USER.uid,
    type: "Expenditure",
    amount: 1240,
    note: "Studio rent",
    category_id: "house",
    transaction_date: localDate(previewYear, previewMonth, day(8)),
    created_at: new Date().toISOString(),
  },
  {
    id: "preview-groceries",
    user_id: PREVIEW_USER.uid,
    type: "Expenditure",
    amount: 186.4,
    note: "Market and groceries",
    category_id: "eat",
    transaction_date: localDate(previewYear, previewMonth, day(3)),
    created_at: new Date().toISOString(),
  },
  {
    id: "preview-consulting",
    user_id: PREVIEW_USER.uid,
    type: "Revenue",
    amount: 720,
    note: "Consulting retainer",
    category_id: "business",
    transaction_date: localDate(previewYear, previewMonth, day(1)),
    created_at: new Date().toISOString(),
  },
  {
    id: "preview-transport",
    user_id: PREVIEW_USER.uid,
    type: "Expenditure",
    amount: 42.75,
    note: "City transport",
    category_id: "gasoline",
    transaction_date: localDate(previewYear, previewMonth, currentDay),
    created_at: new Date().toISOString(),
  },
];

export function getPreviewTransactions(year: number, month?: number) {
  return previewTransactions.filter((transaction) => {
    const [transactionYear, transactionMonth] = transaction.transaction_date
      .split("-")
      .map(Number);
    return (
      transactionYear === year &&
      (month == null || transactionMonth === month)
    );
  });
}

export async function createPreviewTransaction(
  data: TransactionInsert,
): Promise<Transaction> {
  const transaction: Transaction = {
    ...data,
    id: `preview-${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  previewTransactions = [transaction, ...previewTransactions];
  return transaction;
}
