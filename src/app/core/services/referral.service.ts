import { Injectable, computed, signal } from '@angular/core';

export interface ReferralCoupon {
  code: string;
  discountPercent: number; // 10%
  experienceTitle: string;
  generatedAt: string;
  isUsed: boolean;
}

export interface ReferredMember {
  id: string;
  email: string;
  registeredAt: string;
  experiencesPurchasedCount: number;
  couponsEarned: ReferralCoupon[];
  isDemo?: boolean;
}

const STORAGE_REFERRALS_KEY = 'catamarca_club_referrals_v4';

@Injectable({
  providedIn: 'root'
})
export class ReferralService {
  // Un solo referido mockeado de demo
  private readonly defaultReferrals: ReferredMember[] = [
    {
      id: 'ref_demo_1',
      email: 'lucas.mendoza@gmail.com',
      registeredAt: '26 de Octubre',
      experiencesPurchasedCount: 1,
      isDemo: true,
      couponsEarned: [
        {
          code: 'DESC10-LUC-4891',
          discountPercent: 10,
          experienceTitle: 'Volcán Galán & Caldera Gigante',
          generatedAt: '26 de Octubre',
          isUsed: false
        }
      ]
    }
  ];

  readonly referrals = signal<ReferredMember[]>(this.loadStoredReferrals());

  readonly totalReferred = computed(() => this.referrals().length);

  readonly totalExperiencesPurchased = computed(() =>
    this.referrals().reduce((acc, r) => acc + r.experiencesPurchasedCount, 0)
  );

  readonly totalCouponsEarned = computed(() =>
    this.referrals().reduce((acc, r) => acc + r.couponsEarned.length, 0)
  );

  readonly availableCoupons = computed(() =>
    this.referrals().flatMap((r) => r.couponsEarned).filter((c) => !c.isUsed)
  );

  private loadStoredReferrals(): ReferredMember[] {
    try {
      const data = localStorage.getItem(STORAGE_REFERRALS_KEY);
      return data ? JSON.parse(data) : this.defaultReferrals;
    } catch {
      return this.defaultReferrals;
    }
  }
}
