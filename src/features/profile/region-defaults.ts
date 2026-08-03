import type { CurrencyDetectionSource } from "@/contracts/backend";

const COUNTRY_CURRENCY: Record<string, string> = {
  AD: "EUR",
  AT: "EUR",
  BE: "EUR",
  BG: "EUR",
  CY: "EUR",
  DE: "EUR",
  EE: "EUR",
  ES: "EUR",
  FI: "EUR",
  FR: "EUR",
  GB: "GBP",
  GR: "EUR",
  HR: "EUR",
  IE: "EUR",
  IT: "EUR",
  JP: "JPY",
  KR: "KRW",
  LT: "EUR",
  LU: "EUR",
  LV: "EUR",
  MC: "EUR",
  MT: "EUR",
  NG: "NGN",
  NL: "EUR",
  PT: "EUR",
  SI: "EUR",
  SK: "EUR",
  SM: "EUR",
  US: "USD",
  VA: "EUR",
  VN: "VND",
};

export type RegionalDefaults = {
  countryCode: string | null;
  currencyCode: string;
  currencyDetectionSource: CurrencyDetectionSource;
  locale: string | null;
  timezone: string | null;
};

export function countryFromLocale(locale: string | null | undefined) {
  if (!locale) return null;
  try {
    const region = new Intl.Locale(locale).region?.toLocaleUpperCase();
    return region && /^[A-Z]{2}$/.test(region) ? region : null;
  } catch {
    const parts = locale.replace("_", "-").split("-");
    for (let index = parts.length - 1; index >= 1; index -= 1) {
      if (/^[A-Za-z]{2}$/.test(parts[index])) {
        return parts[index].toLocaleUpperCase();
      }
    }
    return null;
  }
}

export function currencyForCountry(countryCode: string | null | undefined) {
  if (!countryCode) return null;
  return COUNTRY_CURRENCY[countryCode.toLocaleUpperCase()] ?? null;
}

/** Called once during account creation; it never follows later travel. */
export function detectRegionalDefaults(): RegionalDefaults {
  let locale: string | null = null;
  let timezone: string | null = null;
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions();
    locale = resolved.locale || null;
    timezone = resolved.timeZone || null;
  } catch {
    // Older runtimes may not expose resolved locale/timezone information.
  }

  const countryCode = countryFromLocale(locale);
  const regionalCurrency = currencyForCountry(countryCode);
  return {
    countryCode,
    currencyCode: regionalCurrency ?? "USD",
    currencyDetectionSource: regionalCurrency
      ? "device_region"
      : "system_default",
    locale,
    timezone,
  };
}
