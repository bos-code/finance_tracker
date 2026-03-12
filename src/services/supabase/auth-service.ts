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

export async function supabaseSignUp(email: string, password: string) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
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
