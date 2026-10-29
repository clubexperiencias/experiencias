import { InjectionToken } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import type { Database } from './database.types';

export function getSupabaseConfig(): { url: string; anonKey: string } {
  let url = environment.supabase?.url || '';
  let anonKey = environment.supabase?.anonKey || '';

  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem('CATAMARCA_SUPABASE_URL');
    const customKey = localStorage.getItem('CATAMARCA_SUPABASE_ANON_KEY');
    if (customUrl && customKey) {
      url = customUrl;
      anonKey = customKey;
    }
  }

  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseConfig();
  return (
    Boolean(url) &&
    Boolean(anonKey) &&
    !url.includes('TU_PROYECTO') &&
    !url.includes('mock.supabase.co') &&
    !anonKey.includes('TU_ANON_PUBLIC_KEY')
  );
}

export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient<Database>>(
  'SupabaseClient',
  {
    providedIn: 'root',
    factory: () => {
      const config = getSupabaseConfig();
      const safeUrl = isSupabaseConfigured()
        ? config.url
        : 'https://placeholder-project.supabase.co';
      const safeKey = isSupabaseConfigured()
        ? config.anonKey
        : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

      return createClient<Database>(safeUrl, safeKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
        global: {
          headers: {
            'x-client-info': 'experiencias-club-angular',
          },
        },
      });
    },
  },
);
