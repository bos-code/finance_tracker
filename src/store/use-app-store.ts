import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Theme Types & Presets (Migrated from theme-context.tsx) ──────────────────

export type ThemeGradient = {
  colors: [string, string];
  id: string;
};

export type ThemeConfig = {
  primary: string;
  gradient: ThemeGradient;
};

export const SOLID_PRESETS = [
  { id: "blue",     color: "#1d4ed8", label: "Ocean" },
  { id: "indigo",   color: "#4f46e5", label: "Indigo" },
  { id: "violet",   color: "#7c3aed", label: "Violet" },
  { id: "rose",     color: "#e11d48", label: "Rose" },
  { id: "orange",   color: "#ea580c", label: "Ember" },
  { id: "amber",    color: "#d97706", label: "Amber" },
  { id: "emerald",  color: "#059669", label: "Emerald" },
  { id: "teal",     color: "#0d9488", label: "Teal" },
  { id: "sky",      color: "#0284c7", label: "Sky" },
  { id: "slate",    color: "#475569", label: "Slate" },
  { id: "pink",     color: "#db2777", label: "Candy" },
  { id: "midnight", color: "#1e293b", label: "Midnight" },
];

export const GRADIENT_PRESETS: ThemeGradient[] = [
  { id: "ocean",    colors: ["#1d4ed8", "#0ea5e9"] },
  { id: "aurora",   colors: ["#4f46e5", "#ec4899"] },
  { id: "sunset",   colors: ["#ea580c", "#f59e0b"] },
  { id: "forest",   colors: ["#059669", "#10b981"] },
  { id: "midnight", colors: ["#0f172a", "#1e3a5f"] },
  { id: "rose",     colors: ["#e11d48", "#f97316"] },
  { id: "cosmic",   colors: ["#7c3aed", "#3b82f6"] },
  { id: "mint",     colors: ["#0d9488", "#6366f1"] },
];

export const DEFAULT_THEME: ThemeConfig = {
  primary: SOLID_PRESETS[0].color,
  gradient: GRADIENT_PRESETS[0],
};

// ─── Currency Types & Presets (Migrated from currency-context.tsx) ──────────────

export type CurrencyOption = {
  id: string;
  label: string;
  symbol: string;
  code: string;
};

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { id: "usd", label: "USD ($)", symbol: "$", code: "USD" },
  { id: "eur", label: "EUR (€)", symbol: "€", code: "EUR" },
  { id: "gbp", label: "GBP (£)", symbol: "£", code: "GBP" },
  { id: "jpy", label: "JPY (¥)", symbol: "¥", code: "JPY" },
  { id: "krw", label: "KRW (₩)", symbol: "₩", code: "KRW" },
  { id: "vnd", label: "VND (₫)", symbol: "₫", code: "VND" },
];

export const DEFAULT_CURRENCY = CURRENCY_OPTIONS[0];

export function formatAmount(amount: number, currency: CurrencyOption): string {
  return `${currency.symbol}${amount.toLocaleString("en-US")}`;
}

// ─── Store Definition ─────────────────────────────────────────────────────────

interface AppStoreState {
  // Theme
  theme: ThemeConfig;
  setTheme: (theme: ThemeConfig) => void;

  // Currency
  currency: CurrencyOption;
  setCurrency: (currency: CurrencyOption) => void;

  // Dashboard / App State
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;
}

export const useAppStore = create<AppStoreState>()(
  persist(
    (set) => ({
      // Defaults
      theme: DEFAULT_THEME,
      currency: DEFAULT_CURRENCY,
      selectedAccountId: null,

      // Actions
      setTheme: (theme) => set({ theme }),
      setCurrency: (currency) => set({ currency }),
      setSelectedAccountId: (id) => set({ selectedAccountId: id }),
    }),
    {
      name: "finance-tracker-app-store",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
