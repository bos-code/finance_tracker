export const APP_ENVIRONMENTS = [
  "local",
  "development",
  "preview",
  "production",
] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export const UI_PREVIEW_ENABLED =
  process.env.EXPO_PUBLIC_UI_PREVIEW === "1";

function resolveEnvironment(): AppEnvironment {
  const configured = process.env.EXPO_PUBLIC_APP_ENV;
  if (configured) {
    if (APP_ENVIRONMENTS.includes(configured as AppEnvironment)) {
      return configured as AppEnvironment;
    }
    throw new Error(
      `Invalid EXPO_PUBLIC_APP_ENV: ${configured}. Expected ${APP_ENVIRONMENTS.join(
        ", ",
      )}.`,
    );
  }

  if (UI_PREVIEW_ENABLED) return "preview";
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export const APP_ENVIRONMENT = resolveEnvironment();

export function getSupabaseRuntimeConfig() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY.",
    );
  }

  return { anonKey, environment: APP_ENVIRONMENT, url } as const;
}
