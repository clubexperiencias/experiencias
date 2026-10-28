import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { isAppRole, normalizeEmail, type AppRole, type Profile } from '@experiencias/domain';
import type { ExperienciasSupabaseClient } from './client';
import type { Tables } from './database.types';

export async function signInWithPassword(
  client: ExperienciasSupabaseClient,
  email: string,
  password: string,
) {
  return client.auth.signInWithPassword({ email: normalizeEmail(email), password });
}

export async function signInWithMagicLink(
  client: ExperienciasSupabaseClient,
  email: string,
  redirectTo: string,
) {
  return client.auth.signInWithOtp({
    email: normalizeEmail(email),
    options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
  });
}

export async function signOut(client: ExperienciasSupabaseClient) {
  return client.auth.signOut();
}

export async function getSession(client: ExperienciasSupabaseClient): Promise<Session | null> {
  const { data } = await client.auth.getSession();
  return data.session;
}

export function onAuthStateChange(
  client: ExperienciasSupabaseClient,
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  const { data } = client.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

export async function getCurrentProfile(client: ExperienciasSupabaseClient): Promise<Profile | null> {
  const { data: userData } = await client.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data, error } = await client.from('profiles').select('*').eq('id', user.id).single();
  if (error || !data) return null;

  return mapProfile(data);
}

/**
 * Server-verified role lookup via RLS-protected RPC. Prefer this over reading JWT claims
 * for guard decisions, since roles can change after a token is issued.
 */
export async function getCurrentRole(client: ExperienciasSupabaseClient): Promise<AppRole | null> {
  const { data, error } = await client.rpc('current_app_role');
  if (error || !isAppRole(data)) return null;
  return data;
}

export function mapProfile(row: Tables<'profiles'>): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    phone: row.phone,
    role: row.role,
    membershipTier: row.membership_tier,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
