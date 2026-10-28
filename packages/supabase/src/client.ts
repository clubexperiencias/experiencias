import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type ExperienciasSupabaseClient = SupabaseClient<Database>;

export interface SupabaseBrowserConfig {
  url: string;
  anonKey: string;
  /** Identifies which app is calling, e.g. "public", "admin", "providers". */
  appName: string;
  /** Separate storage keys keep sessions isolated per subdomain during local dev. */
  storageKey?: string;
}

/**
 * Browser-only client. Accepts the anon key exclusively; the service_role key must
 * never reach an Angular bundle.
 */
export function createSupabaseBrowserClient(config: SupabaseBrowserConfig): ExperienciasSupabaseClient {
  assertBrowserSafeKey(config.anonKey);

  return createClient<Database>(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: config.storageKey ?? `experiencias-${config.appName}-auth`,
    },
    global: {
      headers: { 'x-client-info': `experiencias-${config.appName}` },
    },
  });
}

export function assertBrowserSafeKey(key: string): void {
  const payload = decodeJwtPayload(key);
  if (payload?.['role'] === 'service_role') {
    throw new Error('service_role key detected in a browser client. Use the anon key instead.');
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const [, payload] = token.split('.');
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(normalized)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
