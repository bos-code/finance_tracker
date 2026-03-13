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

export async function supabaseUpdateAppLockSettings(settings: { enabled?: boolean; pin?: string | null }) {
  const { error } = await supabaseClient.auth.updateUser({
    data: { 
      app_lock_enabled: settings.enabled,
      app_lock_pin: settings.pin
    },
  });
  if (error) throw error;
}

