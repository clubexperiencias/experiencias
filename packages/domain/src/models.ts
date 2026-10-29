import type { AppRole } from './roles';

export type MembershipTier = 'emergente' | 'activo' | 'fundador';

export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  role: AppRole;
  membershipTier: MembershipTier;
  createdAt: string;
  updatedAt: string;
}

export type WaitlistStatus = 'pending' | 'confirmed' | 'invited';

export interface WaitlistEntry {
  id: string;
  email: string;
  fullName: string | null;
  interest: string | null;
  position: number;
  status: WaitlistStatus;
  source: string;
  createdAt: string;
}

export const PROVIDER_CATEGORIES = [
  'guia_montana',
  'guia_cultural',
  'guia_nautico',
  'transporte_4x4',
  'alojamiento',
  'gastronomia',
  'artesanias',
  'fotografia',
  'bienestar_termas',
  'otro',
] as const;
export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];

export type ProviderApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface ProviderApplication {
  id: string;
  userId: string | null;
  email: string;
  fullName: string;
  phone: string | null;
  businessName: string | null;
  category: ProviderCategory;
  region: string;
  description: string;
  cuit: string | null;
  website: string | null;
  instagramHandle: string | null;
  status: ProviderApplicationStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export type ProviderStatus = 'active' | 'suspended';

export interface ProviderProfile {
  userId: string;
  applicationId: string | null;
  businessName: string;
  description: string | null;
  cuit: string | null;
  category: ProviderCategory;
  region: string;
  website: string | null;
  instagramHandle: string | null;
  whatsappNumber: string | null;
  logoUrl: string | null;
  bankAliasCbu: string | null;
  commissionPercent: number;
  status: ProviderStatus;
  createdAt: string;
  updatedAt: string;
}

export type ExperienceStatus = 'draft' | 'published' | 'archived';

export interface Experience {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  region: string;
  category: ProviderCategory;
  durationMinutes: number | null;
  priceArs: number;
  capacity: number;
  coverImageUrl: string | null;
  status: ExperienceStatus;
  createdAt: string;
  updatedAt: string;
}

export type ExperienceProviderRole = 'lead' | 'support';

export interface ExperienceProvider {
  experienceId: string;
  providerId: string;
  role: ExperienceProviderRole;
}

export type AvailabilitySlotStatus = 'open' | 'closed' | 'cancelled';

export interface AvailabilitySlot {
  id: string;
  experienceId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  bookedCount: number;
  status: AvailabilitySlotStatus;
}

export type BookingStatus = 'pending_payment' | 'confirmed' | 'cancelled' | 'completed';

export interface Booking {
  id: string;
  slotId: string;
  experienceId: string;
  memberId: string;
  seats: number;
  totalArs: number;
  status: BookingStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PayoutStatus = 'pending' | 'paid' | 'failed';

export interface ProviderPayout {
  id: string;
  providerId: string;
  periodStart: string;
  periodEnd: string;
  amountArs: number;
  status: PayoutStatus;
  receiptUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}
