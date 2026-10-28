export const APP_ROLES = ['member', 'provider', 'admin'] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const PERMISSIONS = [
  'book_experience',
  'upload_memories',
  'manage_own_provider_profile',
  'manage_assigned_experiences',
  'manage_assigned_bookings',
  'view_own_payouts',
  'manage_users',
  'approve_providers',
  'manage_experiences',
  'manage_bookings',
  'manage_payments',
  'view_audit_log',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Readonly<Record<AppRole, readonly Permission[]>> = {
  member: ['book_experience', 'upload_memories'],
  provider: [
    'manage_own_provider_profile',
    'manage_assigned_experiences',
    'manage_assigned_bookings',
    'view_own_payouts',
  ],
  admin: [
    'manage_users',
    'approve_providers',
    'manage_experiences',
    'manage_bookings',
    'manage_payments',
    'view_audit_log',
  ],
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && (APP_ROLES as readonly string[]).includes(value);
}

/**
 * UX-only check for guards and menus. The real authorization boundary is RLS in Supabase.
 */
export function hasPermission(role: AppRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}
