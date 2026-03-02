export type CashflowMetric = {
  inflow: number;
  outflow: number;
  net: number;
};

export type CategoryBreakdownItem = {
  category: string;
  amount: number;
  share: number;
};

export type AnalyticsSummary = {
  monthly: CashflowMetric;
  categoryBreakdown: CategoryBreakdownItem[];
  savingsRate: number;
};
