import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase configuration in environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage:
      Platform.OS === 'web' && typeof window === 'undefined'
        ? {
            getItem: async () => null,
            removeItem: async () => undefined,
            setItem: async () => undefined,
          }
        : AsyncStorage,
    autoRefreshToken:
      Platform.OS !== 'web' || typeof window !== 'undefined',
    persistSession:
      Platform.OS !== 'web' || typeof window !== 'undefined',
    detectSessionInUrl: false,
  },
});
