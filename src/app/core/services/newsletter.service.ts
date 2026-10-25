import { Injectable, signal, computed } from '@angular/core';
import { WaitlistEntry, WaitlistSubmissionDto, WaitlistStats } from '../models/waitlist.model';

const STORAGE_KEY = 'catamarca_club_waitlist';
const SUBSCRIBED_KEY = 'catamarca_club_user_subscribed';
const SPOTS_KEY = 'catamarca_club_reserved_spots';

/**
 * NewsletterService — Modo Mock (localStorage)
 *
 * Cuando se active Supabase, este servicio se reemplazará por la versión
 * que usa el InjectionToken SUPABASE_CLIENT. Todo el contrato público
 * (signals, joinWaitlist, stats) se mantiene idéntico.
 */
@Injectable({
  providedIn: 'root'
})
export class NewsletterService {
  private readonly baseWaitlistCount = 142;

  private readonly _entries = signal<WaitlistEntry[]>(this.loadStoredEntries());
  private readonly _currentMember = signal<WaitlistEntry | null>(this.loadCurrentMember());
  private readonly _reservedSpots = signal<number>(this.loadReservedSpots());
  private readonly _isLoading = signal<boolean>(false);
  private readonly _errorMessage = signal<string | null>(null);

  readonly entries = this._entries.asReadonly();
  readonly currentMember = this._currentMember.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly errorMessage = this._errorMessage.asReadonly();
  readonly isSubscribed = computed(() => this._currentMember() !== null);

  readonly stats = computed<WaitlistStats>(() => {
    const maxSpots = 60;
    return {
      totalMembers: 50,
      seasonLaunchDate: 'Noviembre 2026',
      exclusiveSpotsTotal: maxSpots,
      exclusiveSpotsRemaining: this._reservedSpots()
    };
  });

  async joinWaitlist(dto: WaitlistSubmissionDto): Promise<{ success: boolean; entry?: WaitlistEntry; message: string }> {
    this._isLoading.set(true);
    this._errorMessage.set(null);

    const cleanEmail = dto.email.trim().toLowerCase();
    if (!this.isValidEmail(cleanEmail)) {
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
      return {
        success: true,
        entry: existing,
        message: '¡Ya estás en la lista de espera exclusiva! Tu lugar está reservado.'
      };
    }

    const position = this.baseWaitlistCount + this._entries().length + 1;
    const referralCode = 'CAT-' + Math.random().toString(36).substring(2, 7).toUpperCase();

    const newEntry: WaitlistEntry = {
      id: 'waitlist_' + Date.now().toString(),
      email: cleanEmail,
      fullName: dto.fullName?.trim(),
      interest: dto.interest || 'all',
      position,
      referralCode,
      createdAt: new Date(),
      status: 'confirmed',
      source: 'web_minimal_landing'
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

    return {
      success: true,
      entry: newEntry,
      message: `¡Bienvenido al Club! Sos el miembro fundador #${position}.`
    };
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
      fullName: data.fullName,
      nationality: data.nationality,
      experiencesWishlist: data.experiencesWishlist,
      wishlistNotes: data.wishlistNotes,
      bio: data.bio,
      profileCompleted: true
    };

    this._currentMember.set(updatedMember);
    this.persistCurrentMember(updatedMember);

    const nextSpots = Math.max(11, this._reservedSpots());
    this._reservedSpots.set(nextSpots);
    this.persistReservedSpots(nextSpots);

    const updatedEntries = this._entries().map((e) =>
      e.id === updatedMember.id || e.email === updatedMember.email ? updatedMember : e
    );
    this._entries.set(updatedEntries);
    this.persistEntries(updatedEntries);

    return {
      success: true,
      entry: updatedMember,
      message: '¡Perfil de Socio Emergente guardado con éxito!'
    };
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
    } catch { /* modo privado */ }
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
    } catch { /* modo privado */ }
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
    } catch { /* modo privado */ }
  }
}
