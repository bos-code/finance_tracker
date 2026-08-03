import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { Database } from '@/contracts/database';
import { getSupabaseRuntimeConfig } from '@/config/runtime';

const { anonKey, url } = getSupabaseRuntimeConfig();

export const supabase = createClient<Database>(url, anonKey, {
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
