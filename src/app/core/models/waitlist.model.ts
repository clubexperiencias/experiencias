export type MembershipTier = 'emergente' | 'activo' | 'fundador' | 'waitlist';

export interface SubscriptionDetails {
  status: 'active' | 'paused' | 'cancelled';
  tier: MembershipTier;
  amountArs: number;
  paymentMethod: string;
  startedAt: string;
  nextBillingDate: string;
  expiresAt?: string | null;
  discountCode?: string | null;
  autoRenew: boolean;
  lastPaymentReceipt?: string;
}

export interface WaitlistEntry {
  id: string;
  email: string;
  fullName?: string;
  dni?: string;
  phone?: string;
  documentNumber?: string;
  experiencesWishlist?: string[];
  experiencesOther?: string;
  position: number;
  createdAt: Date;
  status: 'pending' | 'confirmed' | 'invited';
  source: string;
  membershipTier?: MembershipTier;
  plenoActivatedAt?: string | null;
  plenoExpiresAt?: string | null;
  plenoDiscountCode?: string | null;
  subscription?: SubscriptionDetails;
  authUserId?: string;
  googleLinked?: boolean;
  registrationToken?: string;
}

export interface WaitlistSubmissionDto {
  email: string;
  fullName?: string;
  dni?: string;
  phone?: string;
  documentNumber?: string;
  experiencesWishlist?: string[];
  experiencesOther?: string;
}

export interface WaitlistStats {
  totalMembers: number;
  seasonLaunchDate: string;
  exclusiveSpotsTotal: number;
  exclusiveSpotsRemaining: number;
}

export const SURVEY_INTEREST_KEYS: ReadonlySet<string> = new Set([
  'galan',
  'seismiles',
  'kayak',
  'pissis',
  'termas',
  'astroturismo',
  'otros',
]);
