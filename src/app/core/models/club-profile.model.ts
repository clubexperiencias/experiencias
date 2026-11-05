export interface ClubProfile {
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
  const providerName = (exp.providerName || '').toLowerCase().trim();
  return (
    slug === 'kayak' ||
    slug === 'exp-kayak' ||
    providerSlug === 'club-de-experiencias' ||
    providerSlug === 'club' ||
    providerEmail === 'admin@experiencias.club' ||
    providerName === 'club de experiencias'
  );
}

