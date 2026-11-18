import { MembershipTier } from './waitlist.model';

export interface SocioTestimonio {
  id: string;
  socioId?: string;
  email: string;
  fullName: string;
  authorDisplay: string; // ej. "Carlos M."
  membershipTier: MembershipTier;
  tierLabel: string; // "Socio Fundador", "Socio Pleno", "Socio Emergente"
  memberSince?: string;
  content: string;
  paymentsCount: number;
  featured: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function formatAuthorDisplay(fullName?: string): string {
  if (!fullName || !fullName.trim()) return 'Socio del Club';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  }
  const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  const lastNameInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastNameInitial}.`;
}

export function formatTierLabel(tier?: string): string {
  switch (tier) {
    case 'fundador':
      return 'Socio Fundador';
    case 'activo':
      return 'Socio Pleno';
    case 'emergente':
      return 'Socio Emergente';
    default:
      return 'Socio del Club';
  }
}

