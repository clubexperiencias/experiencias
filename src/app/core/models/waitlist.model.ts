export type MembershipTier = 'emergente' | 'activo' | 'fundador';

export interface SubscriptionDetails {
  status: 'active' | 'paused' | 'cancelled';
  tier: MembershipTier;
  amountArs: number;
  paymentMethod: string;
  startedAt: string;
  nextBillingDate: string;
  autoRenew: boolean;
  lastPaymentReceipt?: string;
}

export interface WaitlistEntry {
  id: string;
  email: string;
  fullName?: string;
  documentNumber?: string;
  nationality?: string;
  experiencesWishlist?: string[];
  wishlistNotes?: string;
  bio?: string;
  profileCompleted?: boolean;
  interest?: ExperienceInterest;
  position: number;
  referralCode: string;
  createdAt: Date;
  status: 'pending' | 'confirmed' | 'invited';
  source: string;
  membershipTier?: MembershipTier;
  subscription?: SubscriptionDetails;
}

export type ExperienceInterest =
  | 'puna_volcanes'
  | 'astroturismo_seismiles'
  | 'dunas_sandboard'
  | 'termas_bienestar'
  | 'ruta_adobe_cultura'
  | 'gastronomia_vinos'
  | 'all';

export interface WaitlistSubmissionDto {
  email: string;
  interest?: ExperienceInterest;
  fullName?: string;
  documentNumber?: string;
  nationality?: string;
  experiencesWishlist?: string[];
  wishlistNotes?: string;
  bio?: string;
}

export interface WaitlistStats {
  totalMembers: number;
  seasonLaunchDate: string;
  exclusiveSpotsTotal: number;
  exclusiveSpotsRemaining: number;
}
