import { MembershipTier, SubscriptionDetails } from './waitlist.model';
import { ActivityRecord } from './activity-history.model';

export interface ProviderDetail {
  category: string;
  zone: string;
  vehicleDescription?: string;
  licenseNumber?: string;
  certifications: string[];
  status: 'habilitado' | 'en_auditoria' | 'inactivo';
  registeredDate: string;
}

export interface AdminUser {
  id: string;
  memberNumber: string;
  email: string;
  fullName: string;
  phone: string;
  nationality: string;
  bio: string;
  membershipTier: MembershipTier;
  status: 'activo' | 'pendiente' | 'suspendido';
  isProvider: boolean;
  providerDetail?: ProviderDetail;
  registeredAt: string;
  subscription?: SubscriptionDetails;
  activities: ActivityRecord[];
  totalSpentArs: number;
  totalSpentUsd: number;
  adminNotes?: string;
}

export interface AdminDashboardMetrics {
  totalRegistered: number;
  activeSubscribers: number;
  founderMembers: number;
  emergentMembers: number;
  registeredProviders: number;
  totalRevenueArs: number;
  totalRevenueUsd: number;
  recentActivityCount: number;
}
