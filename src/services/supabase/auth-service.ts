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

export async function supabaseSignUp(email: string, password: string, fullName?: string) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: fullName ? { data: { full_name: fullName } } : undefined,
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

/**
 * Update the authenticated user's profile settings stored in Supabase user metadata.
 *
 * @param settings - Partial user settings to save; supported keys:
 *   - `theme`: UI theme identifier (e.g., "light" or "dark")
 *   - `currency`: ISO currency code or currency identifier used for display
 * @throws The Supabase error returned when the user update fails
 */
export async function supabaseUpdateUserSettings(settings: { 
  theme?: string; 
  currency?: string; 
}) {
  const { error } = await supabaseClient.auth.updateUser({
    data: settings,
  });
  if (error) throw error;
}

/**
 * Clears legacy app-lock settings on the current user's Supabase profile by setting `app_lock_enabled` and `app_lock_pin` to `null`.
 *
 * @throws The error returned by Supabase if the profile update fails.
 */
export async function supabaseClearLegacyAppLockSettings() {
  const { error } = await supabaseClient.auth.updateUser({
    data: {
      app_lock_enabled: null,
      app_lock_pin: null,
    },
  });

  if (error) throw error;
}

/**
 * Update the authenticated user's password.
 *
 * @param newPassword - The new password to set for the current user
 * @throws The error returned by Supabase if the password update fails
 */
export async function supabaseUpdatePassword(newPassword: string) {
  const { error } = await supabaseClient.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
}
