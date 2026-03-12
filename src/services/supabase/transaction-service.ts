import { supabaseClient } from "./supabase-client";

export type TransactionInsert = {
  user_id: string;
  type: "Expenditure" | "Revenue";
  amount: number;
  note: string;
  category_id: string;
  transaction_date: string; // ISO String
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

  return result?.[0];
}
