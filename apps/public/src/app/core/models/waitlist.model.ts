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
  subscription?: SubscriptionDetails;
  authUserId?: string;
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
