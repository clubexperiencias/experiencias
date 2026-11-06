export interface ClubProfile {
  id?: string;
  name: string;
  agency: string;
  email: string;
  slug: string;
  phone: string;
  cbuAlias: string;
  cuitDni: string;
  bankName: string;
  accountHolder: string;
  bio: string;
  website: string;
  socialMedia: string;
  address: string;
  updatedAt: string;
}

export const DEFAULT_CLUB_PROFILE: ClubProfile = {
  name: 'Club de Experiencias',
  agency: 'Club de Experiencias',
  email: 'admin@experiencias.club',
  slug: 'club-de-experiencias',
  phone: '+54 9 383 456-7890',
  cbuAlias: 'EXPERIENCIAS.CLUB.MP',
  cuitDni: '30-71829401-4',
  bankName: 'Mercado Pago / Banco Nación',
  accountHolder: 'Club de Experiencias Catamarca',
  bio: 'Cuenta institucional oficial del Club de Experiencias. Administrada conjuntamente por el equipo de administradores.',
  website: 'https://experiencias.club',
  socialMedia: 'instagram.com/experiencias.club',
  address: 'San Fernando del Valle de Catamarca',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

/**
 * Determina si una experiencia corresponde a una expedición oficial del Club de Experiencias
 * evaluando su flag explícito, slug o las credenciales fijas de prestador del Club (slug/email).
 * Se excluye la comparación por nombre comercial para evitar falsos positivos con prestadores externos.
 *
 * @param exp Objeto de experiencia o información parcial del prestador.
 * @returns `true` si la experiencia pertenece oficialmente al Club, `false` en caso contrario.
 */
export function isClubExperience(exp?: {
  slug?: string | null;
  providerSlug?: string | null;
  providerEmail?: string | null;
  providerName?: string | null;
  isClubExperience?: boolean | null;
} | null): boolean {
  if (!exp) return false;
  if (exp.isClubExperience) return true;
  const slug = (exp.slug || '').toLowerCase().trim();
  const providerSlug = (exp.providerSlug || '').toLowerCase().trim();
  const providerEmail = (exp.providerEmail || '').toLowerCase().trim();
  return (
    slug === 'kayak' ||
    slug === 'exp-kayak' ||
    providerSlug === 'club-de-experiencias' ||
    providerSlug === 'club' ||
    providerEmail === 'admin@experiencias.club'
  );
}

/**
 * Identifica si una entidad prestadora corresponde a la cuenta institucional oficial del Club de Experiencias.
 *
 * @param provider Datos del prestador con identificador, email o slug.
 * @returns `true` si el prestador es la cuenta oficial del Club, `false` en caso contrario.
 */
export function isClubProvider(provider?: {
  id?: string | null;
  email?: string | null;
  slug?: string | null;
} | null): boolean {
  if (!provider) return false;
  const id = (provider.id || '').toLowerCase().trim();
  const email = (provider.email || '').toLowerCase().trim();
  const slug = (provider.slug || '').toLowerCase().trim();
  return (
    id === 'prov-club' ||
    email === 'admin@experiencias.club' ||
    slug === 'club-de-experiencias' ||
    slug === 'club'
  );
}

