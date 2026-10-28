import { Injectable, signal, computed } from '@angular/core';
import { WaitlistEntry, WaitlistSubmissionDto, WaitlistStats } from '../models/waitlist.model';
import { DiscountCode } from '../models/bank-transfer.model';

const STORAGE_KEY = 'catamarca_club_waitlist';
const SUBSCRIBED_KEY = 'catamarca_club_user_subscribed';
const SPOTS_KEY = 'catamarca_club_reserved_spots';
const USED_MEMBER_DISCOUNTS_KEY = 'catamarca_club_used_member_discounts';

/**
 * NewsletterService — Modo Mock (localStorage)
 *
 * Cuando se active Supabase, este servicio se reemplazará por la versión
 * que usa el InjectionToken SUPABASE_CLIENT. Todo el contrato público
 * (signals, joinWaitlist, stats) se mantiene idéntico.
 */
@Injectable({
  providedIn: 'root',
})
export class NewsletterService {
  private readonly baseWaitlistCount = 142;

  private readonly _entries = signal<WaitlistEntry[]>(this.loadStoredEntries());
  private readonly _currentMember = signal<WaitlistEntry | null>(this.loadCurrentMember());
  private readonly _reservedSpots = signal<number>(this.loadReservedSpots());
  private readonly _isLoading = signal<boolean>(false);
  private readonly _errorMessage = signal<string | null>(null);
  private readonly _loginSuccessFlag = signal<boolean>(false);
  private readonly usedMemberDiscounts = new Set(this.loadUsedMemberDiscounts());

  readonly profileSuccessHighlight = signal<boolean>(false);

  setLoginSuccessFlag(): void {
    this._loginSuccessFlag.set(true);
  }

  consumeLoginSuccessFlag(): boolean {
    const val = this._loginSuccessFlag();
    if (val) {
      this._loginSuccessFlag.set(false);
    }
    return val;
  }

  readonly entries = this._entries.asReadonly();
  readonly currentMember = this._currentMember.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly errorMessage = this._errorMessage.asReadonly();
  readonly isSubscribed = computed(() => this._currentMember() !== null);
  readonly isMonthlyActive = computed(() => {
    const member = this._currentMember();
    return member?.membershipTier === 'activo' || member?.subscription?.status === 'active';
  });
  readonly activeSubscription = computed(() => this._currentMember()?.subscription || null);

  readonly stats = computed<WaitlistStats>(() => {
    const maxSpots = 60;
    return {
      totalMembers: 50,
      seasonLaunchDate: 'Noviembre 2026',
      exclusiveSpotsTotal: maxSpots,
      exclusiveSpotsRemaining: this._reservedSpots(),
    };
  });

  findMemberDiscount(rawCode: string): DiscountCode | undefined {
    const code = rawCode.trim().toUpperCase();
    const member = this._currentMember();
    if (!member || this.usedMemberDiscounts.has(code)) return undefined;

    if (member.membershipTier === 'fundador' && code === 'FUNDADOR20') {
      return { code, percentOff: 20, label: '20% socios fundadores' };
    }

    if (member.membershipTier === 'activo' && code === 'SOCIO10') {
      return { code, percentOff: 10, label: '10% socios' };
    }

    return undefined;
  }

  markMemberDiscountUsed(code: string, reference: string, experienceTitle: string): void {
    const normalizedCode = code.trim().toUpperCase();
    if (!this.findMemberDiscount(normalizedCode)) return;

    this.usedMemberDiscounts.add(normalizedCode);
    try {
      localStorage.setItem(
        USED_MEMBER_DISCOUNTS_KEY,
        JSON.stringify([...this.usedMemberDiscounts]),
      );
    } catch {
      // El descuento ya queda bloqueado durante esta sesión aunque no haya persistencia.
    }
  }

  async joinWaitlist(
    dto: WaitlistSubmissionDto,
  ): Promise<{ success: boolean; entry?: WaitlistEntry; message: string }> {
    this._isLoading.set(true);
    this._errorMessage.set(null);

    const cleanEmail = dto.email.trim().toLowerCase();
    if (!this.isValidEmail(cleanEmail) || cleanEmail.length > 254) {
      this._isLoading.set(false);
      const msg = 'Por favor, ingresá un correo electrónico válido.';
      this._errorMessage.set(msg);
      return { success: false, message: msg };
    }

    // Simular latencia de red
    await new Promise((resolve) => setTimeout(resolve, 550));

    const existing = this._entries().find((e) => e.email === cleanEmail);
    if (existing) {
      this._currentMember.set(existing);
      this.persistCurrentMember(existing);
      this._isLoading.set(false);
      this.setLoginSuccessFlag();
      return {
        success: true,
        entry: existing,
        message: '¡Ya estás en la lista de espera exclusiva! Tu lugar está reservado.',
      };
    }

    const position = this.baseWaitlistCount + this._entries().length + 1;
    const referralCode = 'CAT-' + Math.random().toString(36).substring(2, 7).toUpperCase();

    const newEntry: WaitlistEntry = {
      id: 'waitlist_' + Date.now().toString(),
      email: cleanEmail,
      fullName: dto.fullName?.trim().slice(0, 100),
      dni: (dto.dni ?? dto.documentNumber)?.replace(/\D/g, '').slice(0, 9),
      documentNumber: (dto.documentNumber ?? dto.dni)?.replace(/\D/g, '').slice(0, 9),
      phone: dto.phone?.trim().slice(0, 25),
      nationality: dto.nationality?.trim().slice(0, 80),
      experiencesWishlist: dto.experiencesWishlist || [],
      wishlistNotes: dto.wishlistNotes?.trim().slice(0, 1000),
      bio: dto.bio?.trim().slice(0, 1000),
      interest: dto.interest || 'all',
      position,
      referralCode,
      createdAt: new Date(),
      status: 'confirmed',
      source: 'web_minimal_landing',
    };

    const updated = [newEntry, ...this._entries()];
    this._entries.set(updated);
    this._currentMember.set(newEntry);

    const nextSpots = Math.max(11, this._reservedSpots() + 1);
    this._reservedSpots.set(nextSpots);
    this.persistReservedSpots(nextSpots);

    this.persistEntries(updated);
    this.persistCurrentMember(newEntry);

    this._isLoading.set(false);
    this.setLoginSuccessFlag();

    return {
      success: true,
      entry: newEntry,
      message: `¡Bienvenido al Club! Sos el miembro fundador #${position}.`,
    };
  }

  private loadUsedMemberDiscounts(): string[] {
    try {
      const stored = localStorage.getItem(USED_MEMBER_DISCOUNTS_KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) && parsed.every((code) => typeof code === 'string')
        ? parsed
        : [];
    } catch {
      return [];
    }
  }

  resetCurrentSubscription(): void {
    this._currentMember.set(null);
    localStorage.removeItem(SUBSCRIBED_KEY);
  }

  updateMemberProfile(data: {
    fullName: string;
    nationality: string;
    experiencesWishlist: string[];
    wishlistNotes?: string;
    bio?: string;
  }): { success: boolean; entry?: WaitlistEntry; message: string } {
    const current = this._currentMember();
    if (!current) {
      return { success: false, message: 'No hay una suscripción activa.' };
    }

    const updatedMember: WaitlistEntry = {
      ...current,
      fullName: data.fullName.slice(0, 100),
      nationality: data.nationality.slice(0, 80),
      experiencesWishlist: data.experiencesWishlist,
      wishlistNotes: data.wishlistNotes?.slice(0, 1000),
      bio: data.bio?.slice(0, 1000),
      profileCompleted: true,
    };

    this._currentMember.set(updatedMember);
    this.persistCurrentMember(updatedMember);

    const nextSpots = Math.max(11, this._reservedSpots());
    this._reservedSpots.set(nextSpots);
    this.persistReservedSpots(nextSpots);

    const updatedEntries = this._entries().map((e) =>
      e.id === updatedMember.id || e.email === updatedMember.email ? updatedMember : e,
    );
    this._entries.set(updatedEntries);
    this.persistEntries(updatedEntries);

    return {
      success: true,
      entry: updatedMember,
      message: '¡Perfil de Socio Emergente guardado con éxito!',
    };
  }

  async activateMonthlySubscription(details?: {
    paymentMethod?: string;
    email?: string;
    fullName?: string;
  }): Promise<{ success: boolean; message: string }> {
    this._isLoading.set(true);
    await new Promise((resolve) => setTimeout(resolve, 600));

    let member = this._currentMember();
    if (!member && details?.email) {
      await this.joinWaitlist({ email: details.email, fullName: details.fullName });
      member = this._currentMember();
    }

    if (!member) {
      this._isLoading.set(false);
      return {
        success: false,
        message: 'Ingresá tu correo electrónico para asociar la membresía.',
      };
    }

    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const subscription = {
      status: 'active' as const,
      tier: 'activo' as const,
      amountArs: 12000,
      paymentMethod: details?.paymentMethod || 'Tarjeta de Débito (•••• 4821)',
      startedAt: today.toISOString(),
      nextBillingDate: nextMonth.toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      autoRenew: true,
      lastPaymentReceipt: 'REC-' + Math.floor(100000 + Math.random() * 900000),
    };

    const updated: WaitlistEntry = {
      ...member,
      membershipTier: 'activo',
      subscription,
    };

    this._currentMember.set(updated);
    this.persistCurrentMember(updated);

    const updatedEntries = this._entries().map((e) =>
      e.id === updated.id || e.email === updated.email ? updated : e,
    );
    this._entries.set(updatedEntries);
    this.persistEntries(updatedEntries);

    this._isLoading.set(false);
    return { success: true, message: '¡Membresía Mensual activada con éxito!' };
  }

  cancelMonthlySubscription(): { success: boolean; message: string } {
    const member = this._currentMember();
    if (!member || !member.subscription) {
      return { success: false, message: 'No hay una suscripción activa.' };
    }

    const updated: WaitlistEntry = {
      ...member,
      membershipTier: 'emergente',
      subscription: {
        ...member.subscription,
        status: 'cancelled',
        autoRenew: false,
      },
    };

    this._currentMember.set(updated);
    this.persistCurrentMember(updated);
    return {
      success: true,
      message: 'Suscripción cancelada con éxito. Continuás como Socio Emergente.',
    };
  }

  pauseMonthlySubscription(): { success: boolean; message: string } {
    const member = this._currentMember();
    if (!member || !member.subscription) {
      return { success: false, message: 'No hay una suscripción activa.' };
    }

    const updated: WaitlistEntry = {
      ...member,
      subscription: {
        ...member.subscription,
        status: 'paused',
        autoRenew: false,
      },
    };

    this._currentMember.set(updated);
    this.persistCurrentMember(updated);
    return { success: true, message: 'Suscripción pausada temporalmente.' };
  }

  resumeMonthlySubscription(): { success: boolean; message: string } {
    const member = this._currentMember();
    if (!member || !member.subscription) {
      return { success: false, message: 'No hay una suscripción activa.' };
    }

    const updated: WaitlistEntry = {
      ...member,
      membershipTier: 'activo',
      subscription: {
        ...member.subscription,
        status: 'active',
        autoRenew: true,
      },
    };

    this._currentMember.set(updated);
    this.persistCurrentMember(updated);
    return { success: true, message: 'Suscripción reactivada con éxito.' };
  }

  updateSubscriptionPaymentMethod(newMethod: string): { success: boolean; message: string } {
    const member = this._currentMember();
    if (!member || !member.subscription) {
      return { success: false, message: 'No hay una suscripción activa.' };
    }

    const updated: WaitlistEntry = {
      ...member,
      subscription: {
        ...member.subscription,
        paymentMethod: newMethod,
      },
    };

    this._currentMember.set(updated);
    this.persistCurrentMember(updated);
    return { success: true, message: 'Método de pago actualizado con éxito.' };
  }

  // ── Helpers privados ────────────────────────────────────────────────────────

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private loadReservedSpots(): number {
    try {
      const stored = localStorage.getItem(SPOTS_KEY);
      if (stored) {
        return parseInt(stored, 10);
      }
      const member = localStorage.getItem(SUBSCRIBED_KEY);
      return member ? 11 : 10;
    } catch {
      return 10;
    }
  }

  private persistReservedSpots(spots: number): void {
    try {
      localStorage.setItem(SPOTS_KEY, spots.toString());
    } catch {
      /* modo privado */
    }
  }

  private loadStoredEntries(): WaitlistEntry[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private persistEntries(entries: WaitlistEntry[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* modo privado */
    }
  }

  private loadCurrentMember(): WaitlistEntry | null {
    try {
      const data = localStorage.getItem(SUBSCRIBED_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private persistCurrentMember(entry: WaitlistEntry): void {
    try {
      localStorage.setItem(SUBSCRIBED_KEY, JSON.stringify(entry));
    } catch {
      /* modo privado */
    }
  }
}
