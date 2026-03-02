export type AccountType = "checking" | "savings" | "credit" | "investment";

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  balance: number;
  institution: string;
  lastUpdated: string;
};
