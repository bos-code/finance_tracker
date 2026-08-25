/**
 * Environment separation (PLAN_BACKEND.md Stage 1).
 *
 * Finance Tracker distinguishes four environments. Each should eventually
 * point at its own Supabase project so local/dev experiments can never
 * touch production data:
 *
 *  - local:       `pnpm start` against `.env` on a developer machine.
 *  - development: EAS `development` build profile (internal dev client).
 *  - preview:     EAS `preview` build profile (internal QA builds).
 *  - production:  EAS `production` / `production-apk` build profiles.
 *
 * `EXPO_PUBLIC_APP_ENV` selects the environment explicitly. It is safe to
 * read at import time — Expo inlines `EXPO_PUBLIC_*` vars at build time.
 * See .env.example for the full variable list.
 */

export const AppEnv = {
  Local: "local",
  Development: "development",
  Preview: "preview",
  Production: "production",
} as const;

export type AppEnv = (typeof AppEnv)[keyof typeof AppEnv];

const VALID_ENVS: readonly string[] = Object.values(AppEnv);

function resolveAppEnv(): AppEnv {
  const raw = process.env.EXPO_PUBLIC_APP_ENV?.trim().toLowerCase();

  if (raw && VALID_ENVS.includes(raw)) {
    return raw as AppEnv;
  }

  if (raw) {
    console.warn(
      `[env] Unrecognized EXPO_PUBLIC_APP_ENV "${raw}" — falling back to ${
        typeof __DEV__ !== "undefined" && __DEV__ ? AppEnv.Local : AppEnv.Production
      }. Expected one of: ${VALID_ENVS.join(", ")}.`,
    );
  }

  return typeof __DEV__ !== "undefined" && __DEV__ ? AppEnv.Local : AppEnv.Production;
}

export const appEnv: AppEnv = resolveAppEnv();

export function isProductionEnv(): boolean {
  return appEnv === AppEnv.Production;
}

export function isLocalEnv(): boolean {
  return appEnv === AppEnv.Local;
}

/**
 * Required environment variables, validated once at startup.
 * Throws with a message naming every missing variable, instead of the
 * generic single-variable error `src/lib/supabase.ts` used to throw.
 */
export type RequiredEnv = {
  EXPO_PUBLIC_SUPABASE_URL: string;
  EXPO_PUBLIC_SUPABASE_KEY: string;
};

export function requireEnv(): RequiredEnv {
  const missing: string[] = [];

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

  if (!supabaseUrl) missing.push("EXPO_PUBLIC_SUPABASE_URL");
  if (!supabaseKey) missing.push("EXPO_PUBLIC_SUPABASE_KEY");

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Copy .env.example to .env and fill in your Supabase project values.`,
    );
  }

  return {
    EXPO_PUBLIC_SUPABASE_URL: supabaseUrl!,
    EXPO_PUBLIC_SUPABASE_KEY: supabaseKey!,
  };
}
