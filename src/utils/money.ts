export type DisplayCurrency = {
  code: string;
  symbol: string;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  KRW: "₩",
  NGN: "₦",
  USD: "$",
  VND: "₫",
};

export function displayCurrencyForCode(code: string): DisplayCurrency {
  return { code, symbol: CURRENCY_SYMBOLS[code] ?? `${code} ` };
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: DisplayCurrency, hasFraction: boolean) {
  const cacheKey = `${currency.code}:${hasFraction ? "fraction" : "whole"}`;
  const cached = formatterCache.get(cacheKey);
  if (cached) return cached;

  const formatter = new Intl.NumberFormat("en-US", {
    currency: currency.code,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
    minimumFractionDigits: hasFraction ? 2 : 0,
    style: "currency",
  });
  formatterCache.set(cacheKey, formatter);
  return formatter;
}

export function formatMoney(value: number, currency: DisplayCurrency) {
  try {
    return formatterFor(currency, value % 1 !== 0).format(value);
  } catch {
    const sign = value < 0 ? "−" : "";
    return `${sign}${currency.symbol}${Math.abs(value).toLocaleString("en-US", {
      maximumFractionDigits: 2,
    })}`;
  }
}

export function formatCompactMoney(value: number, currency: DisplayCurrency) {
  const absolute = Math.abs(value);
  if (absolute < 1_000) return formatMoney(value, currency);

  const divisor = absolute >= 1_000_000 ? 1_000_000 : 1_000;
  const suffix = divisor === 1_000_000 ? "m" : "k";
  const compact = absolute / divisor;
  const sign = value < 0 ? "−" : "";
  return `${sign}${currency.symbol}${compact.toFixed(compact >= 10 ? 0 : 1)}${suffix}`;
}
