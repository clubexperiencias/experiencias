import { InjectionToken } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import type { Database } from './database.types';

export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient<Database>>(
  'SupabaseClient',
  {
    providedIn: 'root',
    factory: () =>
      createClient<Database>(environment.supabase.url, environment.supabase.anonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        },
        global: {
          headers: {
            'x-client-info': 'catamarca-secreta-angular'
          }
        }
      })
  }
);
