import type {
  Transaction,
  TransactionInsert,
} from "@/services/supabase/transaction-service";

export const PREVIEW_USER = {
  uid: "preview-user",
  email: "jordan@example.com",
  fullName: "Jordan Lee",
} as const;

export const PREVIEW_WORKSPACE_ID = "preview-workspace-personal";
export const PREVIEW_ACCOUNT_ID = "preview-account-cash";

function localDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const today = new Date();
const previewYear = today.getFullYear();
const previewMonth = today.getMonth() + 1;
const lastDay = new Date(previewYear, previewMonth, 0).getDate();
const currentDay = Math.max(1, Math.min(today.getDate(), lastDay));
const day = (offset: number) => Math.max(1, currentDay - offset);

function previewTransaction(
  data: Omit<
    TransactionInsert,
    | "workspace_id"
    | "account_id"
    | "currency_code"
    | "base_currency_code"
    | "exchange_rate"
  > &
    Partial<
      Pick<
        TransactionInsert,
        | "workspace_id"
        | "account_id"
        | "currency_code"
        | "base_currency_code"
        | "exchange_rate"
      >
    > & { id: string },
): Transaction {
  const timestamp = new Date().toISOString();
  const exchangeRate = data.exchange_rate ?? 1;
  return {
    ...data,
    account_id: data.account_id ?? PREVIEW_ACCOUNT_ID,
    base_amount: Number((data.amount * exchangeRate).toFixed(2)),
    base_currency_code: data.base_currency_code ?? "USD",
    created_at: timestamp,
    currency_code: data.currency_code ?? "USD",
    deleted_at: null,
    idempotency_key: null,
    lifecycle: "confirmed",
    revision: 1,
    source: "mobile_app",
    sync_state: "synced",
    updated_at: timestamp,
    workspace_id: data.workspace_id ?? PREVIEW_WORKSPACE_ID,
    exchange_rate: exchangeRate,
  };
}

let previewTransactions: Transaction[] = [
  previewTransaction({
    id: "preview-salary",
    user_id: PREVIEW_USER.uid,
    type: "Revenue",
    amount: 4850,
    note: "Monthly salary",
    category_id: "salary",
    transaction_date: localDate(previewYear, previewMonth, day(12)),
  }),
  previewTransaction({
    id: "preview-studio",
    user_id: PREVIEW_USER.uid,
    type: "Expenditure",
    amount: 1240,
    note: "Studio rent",
    category_id: "house",
    transaction_date: localDate(previewYear, previewMonth, day(8)),
  }),
  previewTransaction({
    id: "preview-groceries",
    user_id: PREVIEW_USER.uid,
    type: "Expenditure",
    amount: 186.4,
    note: "Market and groceries",
    category_id: "eat",
    transaction_date: localDate(previewYear, previewMonth, day(3)),
  }),
  previewTransaction({
    id: "preview-consulting",
    user_id: PREVIEW_USER.uid,
    type: "Revenue",
    amount: 720,
    note: "Consulting retainer",
    category_id: "business",
    transaction_date: localDate(previewYear, previewMonth, day(1)),
  }),
  previewTransaction({
    id: "preview-transport",
    user_id: PREVIEW_USER.uid,
    type: "Expenditure",
    amount: 42.75,
    note: "City transport",
    category_id: "gasoline",
    transaction_date: localDate(previewYear, previewMonth, currentDay),
  }),
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
  const transaction = previewTransaction({
    ...data,
    id: `preview-${Date.now()}`,
  });
  previewTransactions = [transaction, ...previewTransactions];
  return transaction;
}
