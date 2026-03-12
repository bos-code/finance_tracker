import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";

// ─── Currency definitions ────────────────────────────────────────────────────

export type CurrencyOption = {
  id: string;
  label: string;   // "USD ($)"
  symbol: string;  // "$"
  code: string;    // "USD"
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

// ─── Formatter ───────────────────────────────────────────────────────────────

/**
 * Formats a numeric amount with the selected currency symbol.
 * e.g. formatAmount(12500, usdOption) => "$12,500"
 */
export function formatAmount(amount: number, currency: CurrencyOption): string {
  return `${currency.symbol}${amount.toLocaleString("en-US")}`;
}

// ─── Context ─────────────────────────────────────────────────────────────────

type CurrencyContextValue = {
  currency: CurrencyOption;
  setCurrency: (c: CurrencyOption) => void;
  formatAmount: (amount: number) => string;
};

export const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

const STORAGE_KEY = "@finance_tracker_currency";

export function CurrencyProvider({ children }: PropsWithChildren) {
  const [currency, setCurrencyState] = useState<CurrencyOption>(DEFAULT_CURRENCY);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try { setCurrencyState(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  const setCurrency = useCallback((c: CurrencyOption) => {
    setCurrencyState(c);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  }, []);

  const format = useCallback(
    (amount: number) => formatAmount(amount, currency),
    [currency]
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({ currency, setCurrency, formatAmount: format }),
    [currency, setCurrency, format]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
}
