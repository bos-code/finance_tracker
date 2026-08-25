/**
 * Canonical currency contract (PLAN_BACKEND.md Stage 3).
 *
 * Today currency is a UI-only preset (`CURRENCY_OPTIONS` in
 * `src/store/use-app-store.ts`) stored in Supabase Auth user metadata and
 * on `goals.currency_code`; transactions have no currency field at all.
 * This contract standardizes on ISO 4217 codes instead of symbols, per the
 * plan's explicit requirement.
 */

/** ISO 4217 three-letter currency code, e.g. "NGN", "USD". */
export type CurrencyCode = string;

export type CurrencyDetectionSource = "device_region" | "manual" | "country_mapping" | "default";

export type WorkspaceCurrencySettings = {
  workspace_id: string;
  country_code: string | null;
  locale: string | null;
  timezone: string | null;
  default_currency_code: CurrencyCode;
  currency_detection_source: CurrencyDetectionSource;
  updated_at: string;
};

/** Country -> default currency mapping service contract (Stage 3). */
export type CountryCurrencyMapping = {
  country_code: string;
  currency_code: CurrencyCode;
};
