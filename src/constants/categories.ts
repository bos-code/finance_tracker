export type Category = {
  id: string;
  label: string;
  icon: string;
  color: string;
};

export const EXPENDITURE_CATEGORIES: Category[] = [
  { id: "market",      label: "Market",       icon: "store",                  color: "#f43f5e" },
  { id: "eat",         label: "Eat & drink",  icon: "silverware-fork-knife",  color: "#f59e0b" },
  { id: "shopping",    label: "Shopping",     icon: "cart-outline",           color: "#3b82f6" },
  { id: "gasoline",    label: "Gasoline",     icon: "gas-station",            color: "#0ea5e9" },
  { id: "house",       label: "House",        icon: "home-outline",           color: "#a855f7" },
  { id: "electricity", label: "Electricity",  icon: "lightning-bolt",         color: "#eab308" },
  { id: "phone",       label: "Load phone",   icon: "cellphone",              color: "#22c55e" },
  { id: "school",      label: "School",       icon: "school-outline",         color: "#6366f1" },
  { id: "credit",      label: "Credit card",  icon: "credit-card-outline",    color: "#06b6d4" },
];

export const REVENUE_CATEGORIES: Category[] = [
  { id: "salary",      label: "Salary",       icon: "cash",                   color: "#22c55e" },
  { id: "business",    label: "Business",     icon: "briefcase-outline",      color: "#3b82f6" },
  { id: "freelance",   label: "Freelance",    icon: "laptop",                 color: "#8b5cf6" },
  { id: "investment",  label: "Investment",   icon: "chart-line",             color: "#f59e0b" },
  { id: "gift",        label: "Gift",         icon: "gift-outline",           color: "#f43f5e" },
  { id: "rental",      label: "Rental",       icon: "home-city-outline",      color: "#0ea5e9" },
  { id: "bonus",       label: "Bonus",        icon: "star-circle-outline",    color: "#eab308" },
  { id: "other_rev",   label: "Other",        icon: "dots-horizontal-circle-outline", color: "#64748b" },
];

/** Lookup map combining both lists — used by calendar & stats */
export const ALL_CATEGORIES: Record<string, Category> = Object.fromEntries(
  [...EXPENDITURE_CATEGORIES, ...REVENUE_CATEGORIES].map((c) => [c.id, c])
);
