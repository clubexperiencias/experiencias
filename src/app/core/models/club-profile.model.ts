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
  usdExchangeRate?: number;
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
  usdExchangeRate: 1400,
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
  providerAgency?: string | null;
  isClubExperience?: boolean | null;
} | null): boolean {
  if (!exp) return false;
  if (exp.isClubExperience === false) return false;

  const providerName = (exp.providerName || (exp as any).providerAgency || '').toLowerCase().trim();
  const providerSlug = (exp.providerSlug || '').toLowerCase().trim();
  const providerEmail = (exp.providerEmail || '').toLowerCase().trim();

  const isClubSlug =
    providerSlug === 'club-de-experiencias' ||
    providerSlug === 'club' ||
    providerSlug === DEFAULT_CLUB_PROFILE.slug.toLowerCase();

  const isClubEmail =
    providerEmail === 'admin@experiencias.club' ||
    providerEmail === 'hola@experiencias.club' ||
    providerEmail === DEFAULT_CLUB_PROFILE.email.toLowerCase();

  const isClubName =
    providerName === 'club de experiencias' ||
    providerName === 'club' ||
    providerName === DEFAULT_CLUB_PROFILE.name.toLowerCase();

  // Si tiene asignado un prestador externo por nombre, slug o email,
  // prevalece siempre el prestador externo y NO el Club oficial.
  const hasExternalProvider =
    (providerName && !isClubName) ||
    (providerSlug && !isClubSlug) ||
    (providerEmail && !isClubEmail);

  if (hasExternalProvider) {
    return false;
  }

  if (exp.isClubExperience === true) return true;

  return isClubSlug || isClubName || isClubEmail;
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

