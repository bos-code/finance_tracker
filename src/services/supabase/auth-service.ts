import { supabaseClient } from "./supabase-client";

export async function supabaseSignIn(email: string, password: string) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    throw error;
  }
  
  return data;
}

export async function supabaseSignUp(
  email: string,
  password: string,
  metadata?: {
    country_code?: string;
    currency_code?: string;
    currency_detection_source?: "device_region" | "manual" | "system_default";
    full_name?: string;
    locale?: string;
    timezone?: string;
  },
) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: metadata ? { data: metadata } : undefined,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function supabaseSignOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function supabaseResetPassword(email: string, redirectToUrl: string) {
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: redirectToUrl
  });
  if (error) {
    throw error;
  }
}

export async function supabaseUpdateName(fullName: string) {
  const { error } = await supabaseClient.auth.updateUser({
    data: { full_name: fullName },
  });
  if (error) throw error;
}

export async function supabaseUpdateUserSettings(settings: { 
  theme?: string; 
  currency?: string; 
}) {
  const { error } = await supabaseClient.auth.updateUser({
    data: settings,
  });
  if (error) throw error;
}

export async function supabaseClearLegacyAppLockSettings() {
  const { error } = await supabaseClient.auth.updateUser({
    data: {
      app_lock_enabled: null,
      app_lock_pin: null,
    },
  });

  if (error) throw error;
}

export async function supabaseUpdatePassword(newPassword: string) {
  const { error } = await supabaseClient.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
}
