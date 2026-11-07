import { Injectable, computed, inject, signal } from '@angular/core';
import { SUPABASE_CLIENT, isSupabaseConfigured } from '../supabase/supabase.client';
import { environment } from '../../../environments/environment';
import { TransferSubmission, TransferStatus } from '../models/bank-transfer.model';
import { NewsletterService } from './newsletter.service';
import { ProviderStoreService, ExperienceProposalRequest } from './provider-store.service';
import { NotificationService } from './notification.service';
import { ExperienceService } from './experience.service';
import { ClubProfile, DEFAULT_CLUB_PROFILE } from '../models/club-profile.model';

export type { ExperienceProposalRequest } from './provider-store.service';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'superadmin' | 'operador';
  avatar?: string;
  joinedAt: string;
}

export interface AdminMember {
  id: string;
  type: 'socio' | 'waitlist';
  email: string;
  fullName?: string;
  dni?: string;
  phone?: string;
  position?: number | null;
  membershipTier: 'emergente' | 'activo' | 'fundador' | 'waitlist' | 'dado_de_baja';
  googleLinked: boolean;
  converted: boolean;
  avatarUrl?: string;
  isProvider?: boolean;
  experiencesWishlist: string[];
  experiencesOther?: string | null;
  createdAt: string;
}

export type ApplicationType = 'prestador' | 'fundador';
export type ApplicationStatus = 'pendiente' | 'aprobado' | 'rechazado' | 'dado_de_baja';

export interface AdminApplication {
  id: string;
  type: ApplicationType;
  fullName: string;
  email: string;
  phone: string;
  category?: string;
  region?: string;
  website?: string;
  description?: string;
  motivationLetter?: string;
  status: ApplicationStatus;
  createdAt: string;
  // Datos de cobro y fiscales del prestador gestionados por el admin
  cbuAlias?: string;
  cuitDni?: string;
  bankName?: string;
  accountHolder?: string;
}

const STORAGE_KEYS = {
  adminSession: 'catamarca_admin_session_v1',
  adminMembersCache: 'catamarca_admin_members_cache_v2',
  adminApplicationsCache: 'catamarca_admin_applications_cache_v1',
};

const DEFAULT_SUPERADMIN: AdminUser = {
  id: 'admin-gonza',
  email: 'gonzagramaglia@gmail.com',
  name: 'Gonzalo Gramaglia',
  role: 'superadmin',
  avatar: '/assets/images/gonza.jpg',
  joinedAt: '2024-01-01T00:00:00Z',
};

@Injectable({
  providedIn: 'root',
})
export class AdminStoreService {
  private readonly supabase = inject(SUPABASE_CLIENT);
  private readonly newsletter = inject(NewsletterService);
  readonly providerStore = inject(ProviderStoreService);
  private readonly notificationService = inject(NotificationService);
  private readonly experienceService = inject(ExperienceService);

  private readonly _currentAdmin = signal<AdminUser | null>(null);
  private readonly _members = signal<AdminMember[]>(this.loadStoredMembers());
  private readonly _submissions = signal<TransferSubmission[]>([]);
  private readonly _applications = signal<AdminApplication[]>(this.loadStoredApplications());
  private readonly _isLoadingMembers = signal<boolean>(false);
  private readonly _isLoadingSubmissions = signal<boolean>(false);
  private readonly _isLoadingApplications = signal<boolean>(false);
  private readonly _lastRefreshedAt = signal<string | null>(null);

  private readonly _clubProfile = signal<ClubProfile>(this.loadStoredClubProfile());
  private readonly _isClubProfileModalOpen = signal<boolean>(false);
  private readonly _usdExchangeRate = signal<number>(this.loadStoredUsdExchangeRate());
  private readonly _isLoadingClubProfile = signal<boolean>(false);
  private readonly _clubProfileLoaded = signal<boolean>(false);

  readonly currentAdmin = this._currentAdmin.asReadonly();
  readonly isAuthenticated = computed(() => this._currentAdmin() !== null);
  readonly members = this._members.asReadonly();
  readonly submissions = this._submissions.asReadonly();
  readonly applications = this._applications.asReadonly();
  readonly isLoadingMembers = this._isLoadingMembers.asReadonly();
  readonly isLoadingSubmissions = this._isLoadingSubmissions.asReadonly();
  readonly isLoadingApplications = this._isLoadingApplications.asReadonly();
  readonly isLoadingClubProfile = this._isLoadingClubProfile.asReadonly();
  readonly clubProfileLoaded = this._clubProfileLoaded.asReadonly();
  readonly lastRefreshedAt = this._lastRefreshedAt.asReadonly();
  readonly clubProfile = this._clubProfile.asReadonly();
  readonly isClubProfileModalOpen = this._isClubProfileModalOpen.asReadonly();
  readonly usdExchangeRate = this._usdExchangeRate.asReadonly();

  private loadStoredUsdExchangeRate(): number {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('catamarca_usd_exchange_rate_v1');
        const num = Number(stored);
        if (num && num > 0) return num;
      } catch {
        // ignore
      }
    }
    const profile = this.loadStoredClubProfile();
    return profile?.usdExchangeRate || DEFAULT_CLUB_PROFILE.usdExchangeRate || 1400;
  }

  setUsdExchangeRate(rate: number): void {
    const num = Number(rate);
    if (!Number.isFinite(num) || num <= 0) {
      return;
    }
    const normalizedRate = Math.round(num);
    if (normalizedRate <= 0) {
      return;
    }
    this._usdExchangeRate.set(normalizedRate);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('catamarca_usd_exchange_rate_v1', String(normalizedRate));
      } catch {
        // ignore
      }
    }
    const current = this._clubProfile();
    if (current.usdExchangeRate !== normalizedRate) {
      this._clubProfile.update((p) => ({ ...p, usdExchangeRate: normalizedRate }));
    }
  }

  openClubProfileModal(): void {
    this._isClubProfileModalOpen.set(true);
  }

  closeClubProfileModal(): void {
    this._isClubProfileModalOpen.set(false);
  }

  readonly providerEmailsSet = computed<Set<string>>(() => {
    const set = new Set<string>();
    for (const p of this.providerStore.allProviders() || []) {
      if (p.verified && p.status !== 'dado_de_baja' && p.status !== 'pendiente' && p.status !== 'rechazado') {
        const email = p.email?.toLowerCase().trim();
        if (email) set.add(email);
      }
    }
    for (const a of this.applications() || []) {
      if (a.type === 'prestador' && (a.status === 'aprobado' || a.status === 'pendiente')) {
        const email = a.email?.toLowerCase().trim();
        if (email) set.add(email);
      }
    }
    for (const r of this.providerStore.experienceRequests() || []) {
      const email = r.providerEmail?.toLowerCase().trim();
      if (email) set.add(email);
    }
    return set;
  });

  isProviderEmail(email?: string | null): boolean {
    if (!email) return false;
    return this.providerEmailsSet().has(email.toLowerCase().trim());
  }

  // Solicitudes de Nuevas Experiencias enviadas por Prestadores
  readonly experienceRequests = this.providerStore.experienceRequests;
  readonly pendingExperienceRequestsCount = computed(
    () => this.providerStore.experienceRequests().filter((r) => r.status === 'pendiente').length,
  );

  async approveExperienceRequest(
    id: string,
    publicUrl?: string,
    confirmedDates?: string[],
  ): Promise<boolean> {
    return this.providerStore.approveExperienceRequest(id, publicUrl, confirmedDates);
  }

  updateExperiencePublicUrl(expId: string, publicUrl: string): void {
    this.providerStore.updateExperiencePublicUrl(expId, publicUrl);
  }

  rejectExperienceRequest(id: string): Promise<boolean> {
    return this.providerStore.rejectExperienceRequest(id);
  }

  // Estadísticas de Postulaciones (Prestadores y Fundadores)
  readonly applicationStats = computed(() => {
    const list = this._applications();
    const prestadores = list.filter((a) => a.type === 'prestador');
    const fundadores = list.filter((a) => a.type === 'fundador');
    const pendientes = list.filter((a) => a.status === 'pendiente');
    const aprobadas = list.filter((a) => a.status === 'aprobado');
    const bajas = list.filter((a) => a.status === 'dado_de_baja');
    return {
      total: list.length,
      prestadoresCount: prestadores.length,
      fundadoresCount: fundadores.length,
      pendientesCount: pendientes.length,
      aprobadasCount: aprobadas.length,
      bajasCount: bajas.length,
    };
  });

  // Estadísticas del Panel Admin
  readonly stats = computed(() => {
    const list = this._members();
    const subs = this._submissions();

    const officialSocios = list.filter((m) => m.type === 'socio' && m.membershipTier !== 'dado_de_baja');
    const waitlistOnly = list.filter((m) => m.type === 'waitlist' && !m.googleLinked);
    const googleLinked = list.filter((m) => Boolean(m.googleLinked));
    const converted = list.filter((m) => m.converted);

    // Los pagos se aprueban por defecto a menos que estén explícitamente rechazados
    const approvedSubs = subs.filter((s) => s.status !== 'rechazado');
    const rejectedSubs = subs.filter((s) => s.status === 'rechazado');
    const pendingSubs = subs.filter((s) => s.status === 'pendiente');

    const confirmedRevenue = approvedSubs.reduce((sum, s) => sum + (Number(s.amountArs) || 0), 0);
    const pendingRevenue = 0;
    const totalEnrolled = approvedSubs.reduce((sum, s) => sum + (Number(s.participants) || 0), 0);

    const conversionRate = list.length > 0 ? Math.round((converted.length / list.length) * 100) : 0;

    // Métricas temporales (Día, Semana, Mes)
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = startOfToday + 86400000;
    const sevenDaysAgo = startOfToday - 6 * 86400000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

    const isToday = (dateStr?: string) => {
      if (!dateStr) return false;
      const t = new Date(dateStr).getTime();
      return !isNaN(t) && t >= startOfToday && t < endOfToday;
    };

    const isThisWeek = (dateStr?: string) => {
      if (!dateStr) return false;
      const t = new Date(dateStr).getTime();
      return !isNaN(t) && t >= sevenDaysAgo && t < endOfToday;
    };

    const isThisMonth = (dateStr?: string) => {
      if (!dateStr) return false;
      const t = new Date(dateStr).getTime();
      return !isNaN(t) && t >= startOfMonth && t < nextMonth;
    };

    const sociosList = list.filter((m) => Boolean(m.googleLinked));
    const membersToday = sociosList.filter((m) => isToday(m.createdAt)).length;
    const membersThisWeek = sociosList.filter((m) => isThisWeek(m.createdAt)).length;
    const membersThisMonth = sociosList.filter((m) => isThisMonth(m.createdAt)).length;

    const getPaymentDate = (s: TransferSubmission): string => {
      return s.submittedAt || s.date || '';
    };

    const revenueToday = approvedSubs
      .filter((s) => isToday(getPaymentDate(s)))
      .reduce((sum, s) => sum + (Number(s.amountArs) || 0), 0);

    const revenueThisWeek = approvedSubs
      .filter((s) => isThisWeek(getPaymentDate(s)))
      .reduce((sum, s) => sum + (Number(s.amountArs) || 0), 0);

    const revenueThisMonth = approvedSubs
      .filter((s) => isThisMonth(getPaymentDate(s)))
      .reduce((sum, s) => sum + (Number(s.amountArs) || 0), 0);

    return {
      totalRecords: list.length,
      totalSocios: officialSocios.length,
      totalWaitlist: waitlistOnly.length,
      totalGoogleLinked: googleLinked.length,
      totalConverted: converted.length,
      conversionRate,
      totalSubmissions: subs.length,
      pendingReceiptsCount: pendingSubs.length,
      approvedReceiptsCount: approvedSubs.length,
      rejectedReceiptsCount: rejectedSubs.length,
      confirmedRevenue,
      pendingRevenue,
      totalEnrolled,
      membersToday,
      membersThisWeek,
      membersThisMonth,
      revenueToday,
      revenueThisWeek,
      revenueThisMonth,
    };
  });

  constructor() {
    void this.initStore();
  }

  private async initStore(): Promise<void> {
    this.providerStore.reloadFromStorage();
    void this.loadClubProfile();
    const isAuth = await this.restoreSupabaseSession();
    if (isAuth) {
      void this.loadAllMembers();
      void this.loadAllSubmissions();
      void this.loadAllApplications();
      void this.experienceService.reloadFromSupabase();
    }
  }

  private loadStoredClubProfile(): ClubProfile {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('catamarca_club_official_profile_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            return { ...DEFAULT_CLUB_PROFILE, ...parsed };
          }
        }
      } catch {
        // Fallback
      }
    }
    return DEFAULT_CLUB_PROFILE;
  }

  private activeLoadClubProfilePromise: Promise<void> | null = null;

  /**
   * Carga el perfil oficial del Club de Experiencias desde Supabase (tabla `prestadores`),
   * consultando por ID único, slug oficial o email institucional. Sincroniza el resultado
   * con el almacenamiento local y los servicios de experiencias y prestadores.
   */
  async loadClubProfile(): Promise<void> {
    if (!isSupabaseConfigured()) {
      this._clubProfileLoaded.set(true);
      return;
    }
    if (this.activeLoadClubProfilePromise) {
      return this.activeLoadClubProfilePromise;
    }

    this._isLoadingClubProfile.set(true);
    let thisLoadPromise: Promise<void> | null = null;
    const loadTask = async () => {
      await Promise.resolve();
      try {
        const current = this._clubProfile();
        let data: any = null;
        let error: any = null;

        // 1. Intentar buscar por id si ya lo tenemos registrado
        if (current.id) {
          const res = await (this.supabase.from('prestadores') as any)
            .select('*')
            .eq('id', current.id)
            .maybeSingle();
          data = res.data;
          error = res.error;
        }

        // 2. Si no se encontró por id, buscar por slug oficial del club
        if (!data) {
          const res = await (this.supabase.from('prestadores') as any)
            .select('*')
            .eq('slug', current.slug || DEFAULT_CLUB_PROFILE.slug)
            .maybeSingle();
          data = res.data;
          error = res.error;
        }

        // 3. Fallback por email original
        if (!data) {
          const res = await (this.supabase.from('prestadores') as any)
            .select('*')
            .eq('email', DEFAULT_CLUB_PROFILE.email)
            .maybeSingle();
          data = res.data;
          error = res.error;
        }

        if (!error && data) {
          let usdRate: number | undefined;
          let parsedAddress: string | undefined;
          if (data.notes) {
            try {
              const parsed = JSON.parse(data.notes);
              if (
                parsed &&
                typeof parsed.usd_exchange_rate === 'number' &&
                Number.isFinite(parsed.usd_exchange_rate) &&
                parsed.usd_exchange_rate > 0
              ) {
                const rounded = Math.round(parsed.usd_exchange_rate);
                if (rounded > 0) {
                  usdRate = rounded;
                }
              }
              if (parsed && typeof parsed.address === 'string' && parsed.address.trim()) {
                parsedAddress = parsed.address.trim();
              }
            } catch {
              // ignore non-json
            }
          }
          const loadedAddress =
            parsedAddress ||
            (typeof (data as any).address === 'string' && (data as any).address.trim()
              ? (data as any).address.trim()
              : current.address || DEFAULT_CLUB_PROFILE.address);

          const loaded: ClubProfile = {
            id: data.id,
            name: data.name || DEFAULT_CLUB_PROFILE.name,
            agency: data.agency || DEFAULT_CLUB_PROFILE.agency,
            email: data.email || DEFAULT_CLUB_PROFILE.email,
            slug: data.slug || DEFAULT_CLUB_PROFILE.slug,
            phone: data.phone || DEFAULT_CLUB_PROFILE.phone,
            cbuAlias: data.cbu_alias || DEFAULT_CLUB_PROFILE.cbuAlias,
            cuitDni: data.cuit_dni || DEFAULT_CLUB_PROFILE.cuitDni,
            bankName: data.bank_name || DEFAULT_CLUB_PROFILE.bankName,
            accountHolder: data.account_holder || DEFAULT_CLUB_PROFILE.accountHolder,
            bio: data.bio || DEFAULT_CLUB_PROFILE.bio,
            website: data.website || DEFAULT_CLUB_PROFILE.website,
            socialMedia: data.social_media || DEFAULT_CLUB_PROFILE.socialMedia,
            address: loadedAddress,
            updatedAt: data.updated_at || new Date().toISOString(),
            ...(usdRate !== undefined ? { usdExchangeRate: usdRate } : {}),
          };
          this._clubProfile.set(loaded);
          if (usdRate !== undefined) {
            this.setUsdExchangeRate(usdRate);
          }
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('catamarca_club_official_profile_v1', JSON.stringify(loaded));
            } catch {
              // Ignorar
            }
          }
          this.experienceService.syncClubExperiencesWithProfile(loaded);
          this.providerStore.syncClubProviderProfile(loaded);
        }
      } catch (err) {
        console.warn('[AdminStore] Error al cargar perfil del Club:', err);
      } finally {
        this._isLoadingClubProfile.set(false);
        this._clubProfileLoaded.set(true);
        if (this.activeLoadClubProfilePromise === thisLoadPromise) {
          this.activeLoadClubProfilePromise = null;
        }
      }
    };

    thisLoadPromise = loadTask();
    this.activeLoadClubProfilePromise = thisLoadPromise;
    return thisLoadPromise;
  }

  /**
   * Actualiza el perfil oficial del Club de Experiencias en Supabase sobre la fila de `prestadores`
   * correspondiente utilizando su ID estable o slug, evitando colisiones de upsert. En caso de éxito,
   * propaga la información a las experiencias del Club y al prestador oficial.
   *
   * @param updated Propiedades modificadas del perfil del Club.
   * @returns Objeto con resultado de la operación `{ success: boolean, error?: string }`.
   */
  async updateClubProfile(updated: Partial<ClubProfile>): Promise<{ success: boolean; error?: string }> {
    const current = this._clubProfile();
    const targetId = current.id;
    const targetSlug = current.slug || DEFAULT_CLUB_PROFILE.slug;

    let targetRate: number | undefined;
    if (updated.usdExchangeRate !== undefined) {
      const num = Number(updated.usdExchangeRate);
      if (Number.isFinite(num) && num > 0) {
        const rounded = Math.round(num);
        if (rounded > 0) {
          targetRate = rounded;
        }
      }
    } else if (current.usdExchangeRate !== undefined) {
      const num = Number(current.usdExchangeRate);
      if (Number.isFinite(num) && num > 0) {
        const rounded = Math.round(num);
        if (rounded > 0) {
          targetRate = rounded;
        }
      }
    }

    const merged: ClubProfile = {
      ...current,
      ...updated,
      slug: targetSlug,
      ...(targetRate !== undefined ? { usdExchangeRate: targetRate } : {}),
      updatedAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      try {
        let existingNotesObj: Record<string, any> = {};
        if (typeof (this.supabase.from as any) === 'function') {
          try {
            const table = this.supabase.from('prestadores') as any;
            if (table && typeof table.select === 'function') {
              let remoteRow: any = null;
              if (targetId) {
                try {
                  const res = await table.select('notes').eq('id', targetId).maybeSingle();
                  remoteRow = res?.data;
                } catch {
                  // fallback
                }
              }
              if (!remoteRow) {
                try {
                  const res = await table.select('notes').eq('slug', targetSlug).maybeSingle();
                  remoteRow = res?.data;
                } catch {
                  // fallback
                }
              }
              if (!remoteRow) {
                try {
                  const res = await table
                    .select('notes')
                    .eq('email', merged.email || DEFAULT_CLUB_PROFILE.email)
                    .maybeSingle();
                  remoteRow = res?.data;
                } catch {
                  // fallback
                }
              }
              if (remoteRow?.notes) {
                try {
                  const parsed = JSON.parse(remoteRow.notes);
                  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    existingNotesObj = parsed;
                  } else {
                    existingNotesObj = { text: String(remoteRow.notes) };
                  }
                } catch {
                  existingNotesObj = { text: String(remoteRow.notes) };
                }
              }
            }
          } catch {
            // Ignorar error al leer notas remotas previas
          }
        }

        if (Object.keys(existingNotesObj).length === 0) {
          try {
            const clubProv = this.providerStore.allProviders()?.find(
              (p) =>
                p.id === 'prov-club' ||
                (p.email || '').toLowerCase() === (merged.email || DEFAULT_CLUB_PROFILE.email).toLowerCase() ||
                p.slug === targetSlug,
            );
            if (clubProv?.notes) {
              try {
                const parsed = JSON.parse(clubProv.notes);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                  existingNotesObj = parsed;
                } else {
                  existingNotesObj = { text: String(clubProv.notes) };
                }
              } catch {
                existingNotesObj = { text: String(clubProv.notes) };
              }
            }
          } catch {
            // Ignorar
          }
        }

        const nextNotesObj: Record<string, any> = {
          ...existingNotesObj,
          system: 'configuracion_club',
          ...(targetRate !== undefined ? { usd_exchange_rate: targetRate } : {}),
        };

        if (typeof merged.address === 'string') {
          const trimmedAddress = merged.address.trim();
          if (trimmedAddress) {
            nextNotesObj['address'] = trimmedAddress;
          } else {
            delete nextNotesObj['address'];
          }
        }

        const notesPayload = JSON.stringify(nextNotesObj);
        const payload = {
          email: merged.email || DEFAULT_CLUB_PROFILE.email,
          name: merged.name,
          agency: merged.agency || merged.name,
          slug: targetSlug,
          phone: merged.phone,
          cbu_alias: merged.cbuAlias,
          cuit_dni: merged.cuitDni,
          bank_name: merged.bankName,
          account_holder: merged.accountHolder,
          bio: merged.bio,
          website: merged.website,
          social_media: merged.socialMedia,
          notes: notesPayload,
          active: true,
          status: 'aprobado',
          updated_at: merged.updatedAt,
        };

        let updateQuery = (this.supabase.from('prestadores') as any).update(payload);

        if (targetId) {
          updateQuery = updateQuery.eq('id', targetId);
        } else {
          updateQuery = updateQuery.eq('slug', targetSlug);
        }

        const { data, error } = await updateQuery.select();

        if (error) {
          console.error('[AdminStore] Error al actualizar perfil del Club en Supabase:', error);
          return { success: false, error: error.message || 'Error al actualizar perfil en la base de datos' };
        }

        if (!data || data.length === 0) {
          // Si aún no existía la fila por id o slug, insertar una nueva
          const { data: inserted, error: insertError } = await (this.supabase.from('prestadores') as any)
            .insert(payload)
            .select()
            .single();

          if (insertError) {
            console.error('[AdminStore] Error al insertar perfil del Club en Supabase:', insertError);
            return { success: false, error: insertError.message || 'Error al crear perfil en la base de datos' };
          }
          if (inserted?.id) {
            merged.id = inserted.id;
          }
        } else if (data[0]?.id) {
          merged.id = data[0].id;
        }
      } catch (err: any) {
        console.error('[AdminStore] Excepción al guardar perfil del Club en Supabase:', err);
        return { success: false, error: err?.message || 'Error inesperado al conectar con la base de datos' };
      }
    }

    if (targetRate !== undefined) {
      this.setUsdExchangeRate(targetRate);
    }

    this._clubProfile.set(merged);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('catamarca_club_official_profile_v1', JSON.stringify(merged));
      } catch {
        // Ignorar
      }
    }

    // Sincronizar experiencias del Club en ExperienceService
    this.experienceService.syncClubExperiencesWithProfile(merged);

    // Sincronizar prestador prov-club en ProviderStoreService
    this.providerStore.syncClubProviderProfile(merged);

    return { success: true };
  }

  // ============================================================
  // SESIÓN ADMINISTRATIVA
  // ============================================================

  async restoreSupabaseSession(): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      if (environment.production) {
        this._currentAdmin.set(null);
        this.clearSession();
        return false;
      }
      return this.isAuthenticated();
    }

    try {
      const { data, error: userError } = await this.supabase.auth.getUser();
      if (userError || !data?.user?.email) {
        this._currentAdmin.set(null);
        this.clearSession();
        return false;
      }

      const email = data.user.email.trim().toLowerCase();

      // 1. Consultar si tiene registro en administradores
      const { data: adminRow, error: adminError } = await this.supabase
        .from('administradores' as any)
        .select('*')
        .ilike('email', email)
        .eq('active', true)
        .maybeSingle();

      const userMeta = data.user?.user_metadata || {};
      const fullName =
        (adminRow as any)?.name || userMeta['full_name'] || userMeta['name'] || email.split('@')[0];
      const googleAvatar =
        userMeta['avatar_url'] ||
        userMeta['picture'] ||
        (data.user as any)?.identities?.[0]?.identity_data?.['avatar_url'] ||
        (data.user as any)?.identities?.[0]?.identity_data?.['picture'] ||
        '';
      const avatar = googleAvatar || '/assets/images/gonza.jpg';

      if (!adminError && adminRow) {
        const admin: AdminUser = {
          id: `admin-${email.replace(/[^a-z0-9]+/g, '-')}`,
          email,
          name: fullName,
          role: (adminRow as any)?.role || 'superadmin',
          avatar,
          joinedAt: (adminRow as any)?.created_at || new Date().toISOString(),
        };
        this.saveSession(admin);
        return true;
      } else {
        if (adminError) {
          console.error('[AdminStore] Error al consultar administradores:', adminError);
        }
        this._currentAdmin.set(null);
        this.clearSession();
        return false;
      }
    } catch (err) {
      console.warn('[AdminStore] Error restaurando sesión Supabase:', err);
      this._currentAdmin.set(null);
      this.clearSession();
      return false;
    }
  }

  async signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) {
      if (environment.production) {
        return {
          success: false,
          error: 'El servicio de autenticación no está disponible en este momento.',
        };
      }
      const isBrowser = typeof window !== 'undefined';
      const host = isBrowser ? window.location.hostname.toLowerCase() : '';
      const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
      if (!isLocalHost) {
        return { success: false, error: 'Acceso no disponible en este entorno.' };
      }
      this.saveSession(DEFAULT_SUPERADMIN);
      return { success: true };
    }

    try {
      const isBrowser = typeof window !== 'undefined';
      const host = isBrowser ? window.location.hostname.toLowerCase() : '';
      const search = isBrowser ? window.location.search.toLowerCase() : '';
      const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
      const isAdminHost =
        host.startsWith('admin.') ||
        host.includes('admin.experiencias') ||
        (isLocalHost && (search.includes('portal=admin') || search.includes('admin=true')));

      const redirectOrigin = isBrowser ? window.location.origin : 'https://admin.experiencias.club';
      const targetPath = isAdminHost ? '/dashboard' : '/admin/dashboard';
      const { error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${redirectOrigin}${targetPath}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al conectar con Google' };
    }
  }

  quickLogin(): void {
    if (environment.production || isSupabaseConfigured()) {
      return;
    }
    const isBrowser = typeof window !== 'undefined';
    const host = isBrowser ? window.location.hostname.toLowerCase() : '';
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
    if (!isLocalHost) {
      return;
    }
    this.saveSession(DEFAULT_SUPERADMIN);
    void this.loadAllMembers();
    void this.loadAllSubmissions();
    void this.loadAllApplications();
  }

  logout(): void {
    this._currentAdmin.set(null);
    this.clearSession();
    this._members.set([]);
    this._submissions.set([]);
    this._applications.set([]);
    try {
      localStorage.removeItem(STORAGE_KEYS.adminMembersCache);
      localStorage.removeItem(STORAGE_KEYS.adminApplicationsCache);
    } catch {
      // ignore
    }
    this.experienceService.clearPrivilegedCache();
    if (isSupabaseConfigured()) {
      void this.supabase.auth.signOut();
    }
  }

  private clearSession(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.adminSession);
    } catch {
      // ignore
    }
  }

  private saveSession(admin: AdminUser): void {
    this._currentAdmin.set(admin);
    try {
      localStorage.setItem(STORAGE_KEYS.adminSession, JSON.stringify(admin));
    } catch {
      // ignore
    }
  }

  private loadStoredSession(): AdminUser | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.adminSession);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  // ============================================================
  // GESTIÓN DE SOCIOS Y LISTA DE ESPERA (NÓMINA COMPLETA)
  // ============================================================

  async loadAllMembers(): Promise<void> {
    this._isLoadingMembers.set(true);

    try {
      if (isSupabaseConfigured()) {
        // 1. Intentar RPC get_admin_all_members
        const { data: rpcData, error: rpcErr } = await this.supabase.rpc(
          'get_admin_all_members' as any,
        );

        if (!rpcErr && rpcData) {
          const providerEmails = this.providerEmailsSet();

          const payload = rpcData as any;
          const socios: AdminMember[] = (payload.socios || []).map((s: any) => ({
            id: s.id,
            type: 'socio' as const,
            email: s.email,
            fullName: s.fullName || s.full_name || 'Socio sin nombre',
            dni: s.dni || '—',
            phone: s.phone || '—',
            position: s.position,
            membershipTier: s.membershipTier || s.membership_tier || 'emergente',
            googleLinked: Boolean(s.googleLinked || s.auth_user_id),
            // Convertido = pagó al menos una experiencia / envió comprobante
            converted: typeof s.paymentsCount === 'number' ? s.paymentsCount > 0 : Boolean(s.converted),
            avatarUrl: s.avatarUrl || s.avatar_url || s.picture || s.avatar || undefined,
            isProvider: providerEmails.has(s.email?.toLowerCase().trim()) || Boolean(s.isProvider || s.is_provider),
            experiencesWishlist: Array.isArray(s.experiencesWishlist) ? s.experiencesWishlist : [],
            experiencesOther: s.experiencesOther || s.experiences_other,
            createdAt: s.createdAt || s.created_at || new Date().toISOString(),
          }));

          const waitlist: AdminMember[] = (payload.waitlist || []).map((w: any) => ({
            id: w.id,
            type: 'waitlist' as const,
            email: w.email,
            fullName:
              w.fullName && w.fullName !== 'Lista de Espera (Email)'
                ? w.fullName
                : w.full_name || '',
            dni: w.dni || '—',
            phone: w.phone || '—',
            position: undefined,
            membershipTier: 'waitlist' as const,
            googleLinked: Boolean(w.googleLinked || w.auth_user_id),
            // Convertido = pagó al menos una experiencia / envió comprobante
            converted: typeof w.paymentsCount === 'number' ? w.paymentsCount > 0 : Boolean(w.converted),
            avatarUrl: w.avatarUrl || w.avatar_url || w.picture || w.avatar || undefined,
            isProvider: providerEmails.has(w.email?.toLowerCase().trim()) || Boolean(w.isProvider || w.is_provider),
            experiencesWishlist: Array.isArray(w.experiencesWishlist)
              ? w.experiencesWishlist
              : Array.isArray(w.experiences_wishlist)
                ? w.experiences_wishlist
                : [],
            experiencesOther: w.experiencesOther || w.experiences_other,
            createdAt: w.createdAt || w.created_at || new Date().toISOString(),
          }));

          const combined = [...socios, ...waitlist];
          this._members.set(combined);
          this.persistMembers(combined);
          this._lastRefreshedAt.set(new Date().toLocaleTimeString('es-AR'));
          this._isLoadingMembers.set(false);
          void this.enrichMembersWithAuthAvatars(combined);
          return;
        }

        // 2. Fallback de consultas directas a la tabla public.socios (esquema canónico unificado)
        const [sociosRes, paidRows] = await Promise.all([
          this.supabase.from('socios').select('*').order('position', { ascending: true }),
          this.supabase.from('pagos_transferencias' as any).select('email'),
        ]);

        const paidEmailSet = new Set(
          (paidRows.data || []).map((p: any) => p.email?.toLowerCase().trim()),
        );

        const providerEmails = this.providerEmailsSet();

        const allSocioRows = sociosRes.data || [];
        const sociosList: AdminMember[] = allSocioRows
          .filter((s: any) => s.membership_tier !== 'waitlist')
          .map((s: any) => {
            const cleanEmail = s.email?.toLowerCase().trim();
            const hasPayment = paidEmailSet.has(cleanEmail);
            return {
              id: s.id,
              type: 'socio' as const,
              email: s.email,
              fullName: s.full_name,
              dni: s.dni,
              phone: s.phone,
              position: s.position,
              membershipTier: s.membership_tier || 'emergente',
              googleLinked: Boolean(s.auth_user_id),
              converted: hasPayment,
              avatarUrl: s.avatar_url || s.avatar || s.picture || undefined,
              isProvider: providerEmails.has(cleanEmail) || Boolean(s.is_provider),
              experiencesWishlist: Array.isArray(s.experiences_wishlist)
                ? s.experiences_wishlist
                : [],
              experiencesOther: s.experiences_other,
              createdAt: s.created_at,
            };
          });

        const waitlistOnly: AdminMember[] = allSocioRows
          .filter((w: any) => w.membership_tier === 'waitlist')
          .map((w: any) => {
            const cleanEmail = w.email?.toLowerCase().trim();
            const isGoogle = Boolean(w.auth_user_id);
            const hasPayment = paidEmailSet.has(cleanEmail);
            return {
              id: w.id,
              type: 'waitlist' as const,
              email: w.email,
              fullName:
                w.fullName && w.fullName !== 'Lista de Espera (Email)'
                  ? w.fullName
                  : w.full_name || '',
              dni: w.dni || '—',
              phone: w.phone || '—',
              position: undefined,
              membershipTier: 'waitlist' as const,
              googleLinked: isGoogle,
              converted: hasPayment,
              avatarUrl: w.avatar_url || w.avatar || w.picture || undefined,
              isProvider: providerEmails.has(cleanEmail) || Boolean(w.is_provider),
              experiencesWishlist: Array.isArray(w.experiences_wishlist)
                ? w.experiences_wishlist
                : [],
              experiencesOther: w.experiences_other,
              createdAt: w.created_at,
            };
          });

        if (!sociosRes.error) {
          const combined = [...sociosList, ...waitlistOnly];
          // Cuando Supabase está configurado, la fuente de la verdad es Supabase
          this._members.set(combined);
          this.persistMembers(combined);
          this._lastRefreshedAt.set(new Date().toLocaleTimeString('es-AR'));
          this._isLoadingMembers.set(false);
          void this.enrichMembersWithAuthAvatars(combined);
          return;
        }

        console.warn(
          '[AdminStore] Error al consultar tablas de miembros en Supabase:',
          sociosRes.error,
        );
        this._isLoadingMembers.set(false);
        return;
      }
    } catch (err) {
      console.warn('[AdminStore] Error cargando socios desde Supabase:', err);
      if (isSupabaseConfigured()) {
        this._isLoadingMembers.set(false);
        return;
      }
    }

    // 3. Respaldo local SÓLO si Supabase no está configurado
    const stored = this.loadStoredMembers();
    this._members.set(stored || []);
    this._lastRefreshedAt.set(new Date().toLocaleTimeString('es-AR'));
    this._isLoadingMembers.set(false);
  }

  private async enrichMembersWithAuthAvatars(members: AdminMember[]): Promise<void> {
    try {
      const avatarRes = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'GET_AUTH_AVATARS' }),
      });
      if (avatarRes.ok) {
        const avatarData = await avatarRes.json();
        if (avatarData?.success && avatarData?.avatars) {
          const avatars = avatarData.avatars as Record<string, string>;
          let hasUpdates = false;
          const updatedMembers = members.map((m) => {
            const em = m.email?.toLowerCase().trim();
            const foundAvatar = (em && avatars[em]) || (m.id && avatars[m.id]);
            if (foundAvatar && m.avatarUrl !== foundAvatar) {
              hasUpdates = true;
              return { ...m, avatarUrl: foundAvatar };
            }
            return m;
          });
          if (hasUpdates) {
            this._members.set(updatedMembers);
            this.persistMembers(updatedMembers);
          }
        }
      }
    } catch {
      // Ignore background avatar enrichment errors
    }
  }

  getMemberById(idOrIdentifier: string): AdminMember | undefined {
    const clean = idOrIdentifier.trim().toLowerCase();
    return this._members().find(
      (m) =>
        m.id.toLowerCase() === clean ||
        (m.position !== undefined && String(m.position) === clean) ||
        m.email.toLowerCase() === clean,
    );
  }

  async updateMemberProfile(
    id: string,
    updates: Partial<AdminMember>,
  ): Promise<{ success: boolean; error?: string }> {
    const existing = this.getMemberById(id);
    if (!existing) {
      return { success: false, error: 'Socio no encontrado' };
    }

    const previousMembers = this._members();
    const rollback = () => {
      this._members.set(previousMembers);
      this.persistMembers(previousMembers);
    };

    const resolvedTier =
      updates.membershipTier ??
      (updates.type === 'waitlist'
        ? 'waitlist'
        : updates.type === 'socio' && existing.membershipTier === 'waitlist'
          ? 'emergente'
          : existing.membershipTier);
    const resolvedType: 'socio' | 'waitlist' = resolvedTier === 'waitlist' ? 'waitlist' : 'socio';

    const merged: AdminMember = {
      ...existing,
      ...updates,
      membershipTier: resolvedTier,
      type: resolvedType,
      position:
        resolvedTier === 'waitlist'
          ? undefined
          : updates.position !== undefined
            ? (updates.position && Number(updates.position) > 0 ? Number(updates.position) : undefined)
            : existing.position,
      experiencesOther:
        updates.experiencesOther !== undefined
          ? (updates.experiencesOther && updates.experiencesOther.trim() ? updates.experiencesOther.trim() : undefined)
          : existing.experiencesOther,
      converted: existing.converted, // La conversión deriva estrictamente de pagos reales, no es editable
    };

    // Actualizar estado local optimistamente
    this._members.update((list) =>
      list.map((m) => (m.id === existing.id || m.email === existing.email ? merged : m)),
    );
    this.persistMembers(this._members());

    if (isSupabaseConfigured()) {
      try {
        const payload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (updates.fullName !== undefined) payload['full_name'] = updates.fullName;
        if (updates.email !== undefined) payload['email'] = updates.email;
        if (updates.dni !== undefined) payload['dni'] = updates.dni;
        if (updates.phone !== undefined) payload['phone'] = updates.phone;
        if (resolvedTier === 'waitlist') {
          payload['position'] = null;
        } else if (updates.position !== undefined) {
          payload['position'] =
            updates.position && Number(updates.position) > 0 ? Number(updates.position) : null;
        }
        if (updates.membershipTier !== undefined || updates.type !== undefined) {
          payload['membership_tier'] = resolvedTier;
        }
        if (updates.experiencesOther !== undefined) {
          payload['experiences_other'] =
            updates.experiencesOther && updates.experiencesOther.trim()
              ? updates.experiencesOther.trim()
              : null;
        }
        if (updates.experiencesWishlist !== undefined) payload['experiences_wishlist'] = updates.experiencesWishlist;

        const isIdQuery = Boolean(existing.id && existing.id.includes('-'));
        let query = (this.supabase.from('socios') as any).update(payload, { count: 'exact' });
        query = isIdQuery ? query.eq('id', existing.id) : query.eq('email', existing.email);
        if (typeof query?.select === 'function') {
          query = query.select('id');
        }

        let { error, count, data } = await query;

        // Determinar si el fallo es un error de payload/validación (ej. violación de unicidad o check constraint)
        const isPayloadError = Boolean(
          error &&
            (error.code === '23505' ||
              error.code === '23502' ||
              error.code === '23514' ||
              error.code === '23503' ||
              (typeof error.code === 'string' && error.code.startsWith('23'))),
        );

        const primaryRows = Array.isArray(data)
          ? data.length
          : typeof count === 'number'
            ? count
            : data
              ? 1
              : 0;

        // Solo reintentar por email si la consulta primaria fue por id, el error no es de payload,
        // y el id no coincidió (0 filas) o tuvo sintaxis inválida de uuid (22P02)
        const canRetryByEmail =
          isIdQuery &&
          Boolean(existing.email) &&
          !isPayloadError &&
          (primaryRows === 0 || error?.code === '22P02');

        if (canRetryByEmail) {
          console.warn(
            '[AdminStore] Socio no encontrado por id en Supabase, reintentando por email:',
            error?.message || 'rows: 0',
          );
          let fallback = (this.supabase.from('socios') as any)
            .update(payload, { count: 'exact' })
            .eq('email', existing.email);
          if (typeof fallback?.select === 'function') {
            fallback = fallback.select('id');
          }
          const fallbackRes = await fallback;
          error = fallbackRes.error;
          count = fallbackRes.count;
          data = fallbackRes.data;
        }

        if (error) {
          rollback();
          console.warn('[AdminStore] Error al persistir socio en Supabase:', error);
          return { success: false, error: error.message };
        }

        const rowsAffected = Array.isArray(data)
          ? data.length
          : typeof count === 'number'
            ? count
            : data
              ? 1
              : 0;

        if (rowsAffected === 0) {
          rollback();
          console.warn('[AdminStore] No se encontró el registro del socio en Supabase para actualizar.');
          return {
            success: false,
            error: 'No se encontró el registro del socio en Supabase para actualizar.',
          };
        }
      } catch (err: any) {
        rollback();
        console.error('[AdminStore] Excepción al actualizar socio en Supabase:', err);
        return { success: false, error: err?.message || 'Error de red' };
      }
    }

    return { success: true };
  }

  async deleteMemberProfile(id: string): Promise<{ success: boolean; error?: string }> {
    const existing = this.getMemberById(id);
    if (!existing) {
      return { success: false, error: 'Socio no encontrado' };
    }

    const previousMembers = this._members();
    this._members.update((list) => list.filter((m) => m.id !== existing.id && m.email !== existing.email));
    this.persistMembers(this._members());

    if (isSupabaseConfigured()) {
      try {
        const isIdQuery = Boolean(existing.id && existing.id.includes('-'));
        let query = (this.supabase.from('socios') as any).delete();
        query = isIdQuery ? query.eq('id', existing.id) : query.eq('email', existing.email);
        const { error } = await query;
        if (error) {
          console.warn('[AdminStore] Error al eliminar socio en Supabase:', error);
        }
      } catch (err: any) {
        console.warn('[AdminStore] Excepción al eliminar socio en Supabase:', err);
      }
    }

    return { success: true };
  }

  // ============================================================
  // GESTIÓN DE COMPROBANTES DE PAGO ENVIADOS
  // ============================================================

  async loadAllSubmissions(): Promise<void> {
    this._isLoadingSubmissions.set(true);

    try {
      if (isSupabaseConfigured()) {
        // 1. Intentar RPC get_admin_all_submissions
        const { data: rpcData, error: rpcErr } = await this.supabase.rpc(
          'get_admin_all_submissions' as any,
        );

        if (!rpcErr && Array.isArray(rpcData)) {
          const subs: TransferSubmission[] = rpcData.map((p: any) => ({
            id: p.id,
            reference: p.reference,
            experienceId: p.experienceId || p.experience_id,
            experienceTitle: p.experienceTitle || p.experience_title,
            date: p.date,
            participants: Number(p.participants) || 1,
            amountArs: Number(p.amountArs || p.amount_ars) || 0,
            discountCode: p.discountCode || p.discount_code,
            discountArs: Number(p.discountArs || p.discount_ars) || 0,
            fullName: p.fullName || p.full_name,
            email: p.email,
            dni: p.dni,
            phone: p.phone,
            receipt: p.receipt || {
              fileName: p.receipt_file_name || 'comprobante.png',
              mimeType: p.receipt_mime_type || 'image/png',
              sizeBytes: p.receipt_size_bytes || 1,
              url: p.receipt_url || '/assets/images/comprobante-ejemplo.png',
            },
            status: p.status === 'rechazado' ? 'rechazado' : 'aprobado',
            rejectionReason: p.rejectionReason || p.rejection_reason,
            submittedAt: p.submittedAt || p.submitted_at || p.created_at || new Date().toISOString(),
            reviewedAt: p.reviewedAt || p.reviewed_at,
          }));

          this._submissions.set(subs);
          this._isLoadingSubmissions.set(false);
          return;
        }

        // 2. Consulta directa a public.pagos_transferencias
        const { data: tableData, error: tableErr } = await this.supabase
          .from('pagos_transferencias' as any)
          .select('*')
          .order('created_at', { ascending: false });

        if (!tableErr && Array.isArray(tableData)) {
          const mapped: TransferSubmission[] = tableData.map((p: any) => ({
            id: p.id,
            reference: p.reference,
            experienceId: p.experience_id,
            experienceTitle: p.experience_title,
            date: p.selected_date || p.date,
            participants: Number(p.participants) || 1,
            amountArs: Number(p.amount_ars || p.amountArs) || 0,
            discountCode: p.discount_code,
            discountArs: Number(p.discount_ars) || 0,
            fullName: p.full_name,
            email: p.email,
            dni: p.dni,
            phone: p.phone,
            receipt: {
              fileName: p.receipt_file_name || 'comprobante',
              mimeType: p.receipt_mime_type || 'image/jpeg',
              sizeBytes: p.receipt_size_bytes || 1,
              url: p.receipt_url,
              storageKey: p.receipt_storage_path || p.receipt_storage_key || p.receipt_url,
              provider: p.receipt_storage_provider,
            },
            status: p.status === 'rechazado' ? 'rechazado' : 'aprobado',
            rejectionReason: p.rejection_reason,
            submittedAt: p.created_at || p.submitted_at || p.submittedAt || new Date().toISOString(),
            reviewedAt: p.reviewed_at,
          }));

          this._submissions.set(mapped);
          this._isLoadingSubmissions.set(false);
          return;
        }

        // Si fallaron ambas en Supabase configurado, no sobrescribir con datos de prueba
        console.warn(
          '[AdminStore] Error al cargar comprobantes desde Supabase configurado:',
          rpcErr || tableErr,
        );
        this._isLoadingSubmissions.set(false);
        return;
      }
    } catch (err) {
      console.warn('[AdminStore] Error cargando comprobantes desde Supabase:', err);
      if (isSupabaseConfigured()) {
        this._isLoadingSubmissions.set(false);
        return;
      }
    }

    // 3. Respaldo local SÓLO si Supabase no está configurado
    const providerSubs = (this.providerStore.submissions() || []).map((s) => ({
      ...s,
      participants: Number(s.participants) || 1,
      amountArs: Number(s.amountArs) || 0,
      status: s.status === 'rechazado' ? ('rechazado' as const) : ('aprobado' as const),
    }));
    this._submissions.set(providerSubs);
    this._isLoadingSubmissions.set(false);
  }

  async getSignedReceiptUrl(storageKey: string): Promise<string> {
    if (!isSupabaseConfigured() || !storageKey) return storageKey;
    if (
      storageKey.startsWith('http://') ||
      storageKey.startsWith('https://') ||
      storageKey.startsWith('data:') ||
      storageKey.startsWith('blob:')
    ) {
      return storageKey;
    }
    try {
      const { data, error } = await this.supabase.storage
        .from('comprobantes')
        .createSignedUrl(storageKey, 3600);
      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    } catch (err) {
      console.warn('[AdminStore] Error al generar signed URL de comprobante:', err);
    }
    return storageKey;
  }

  async reviewSubmission(
    submissionId: string,
    status: Exclude<TransferStatus, 'pendiente'>,
    rejectionReason?: string,
  ): Promise<boolean> {
    try {
      if (isSupabaseConfigured()) {
        const { error } = await this.supabase.rpc('review_transfer_submission' as any, {
          p_submission_id: submissionId,
          p_status: status,
          p_rejection_reason: status === 'rechazado' ? rejectionReason : null,
        });

        if (error) {
          await this.supabase
            .from('pagos_transferencias' as any)
            .update({
              status,
              rejection_reason: status === 'rechazado' ? rejectionReason : null,
              reviewed_at: new Date().toISOString(),
            })
            .eq('id', submissionId);
        }
      }
    } catch (err) {
      console.warn('[AdminStore] Error al revisar comprobante en Supabase:', err);
    }

    // Actualizar signal localmente
    this._submissions.update((list) =>
      list.map((s) =>
        s.id === submissionId
          ? {
              ...s,
              status,
              rejectionReason: status === 'rechazado' ? rejectionReason : undefined,
              reviewedAt: new Date().toISOString(),
            }
          : s,
      ),
    );

    // Si se aprueba o rechaza, actualizar estado y notificar vía email (Resend)
    const targetSub = this._submissions().find((s) => s.id === submissionId);
    if (targetSub) {
      if (status === 'aprobado') {
        this._members.update((list) =>
          list.map((m) =>
            m.email.toLowerCase() === targetSub.email.toLowerCase() &&
            m.membershipTier === 'emergente'
              ? { ...m, membershipTier: 'activo' }
              : m,
          ),
        );
        this.notificationService.notifyPaymentApproved(targetSub).catch((err) => {
          console.warn('[AdminStore] Error al enviar email de aprobación:', err);
        });
      } else if (status === 'rechazado') {
        this.notificationService
          .notifyPaymentRejected(
            targetSub,
            rejectionReason?.trim() || 'Comprobante no verificado.',
          )
          .catch((err) => {
            console.warn('[AdminStore] Error al enviar email de rechazo:', err);
          });
      }
    }

    return true;
  }

  // ============================================================
  // GESTIÓN DE POSTULACIONES (PRESTADORES & SOCIOS FUNDADORES)
  // ============================================================

  async loadAllApplications(): Promise<void> {
    this._isLoadingApplications.set(true);

    try {
      if (isSupabaseConfigured()) {
        let providerRows: any[] = [];
        let fundadoresRows: any[] = [];

        // 1. Intentar consulta directa en Supabase
        const [fundadoresRes, providerAccessRes] = await Promise.all([
          this.supabase
            .from('postulaciones_fundadores' as any)
            .select('*')
            .order('created_at', { ascending: false }),
          this.supabase
            .from('prestadores' as any)
            .select('*')
            .order('created_at', { ascending: false }),
        ]);

        if (!providerAccessRes.error && Array.isArray(providerAccessRes.data) && providerAccessRes.data.length > 0) {
          providerRows = providerAccessRes.data;
        } else if (providerAccessRes.error) {
          console.warn('[AdminStore] Error al consultar prestadores en Supabase:', providerAccessRes.error);
        }

        if (!fundadoresRes.error && Array.isArray(fundadoresRes.data)) {
          fundadoresRows = fundadoresRes.data;
        }

        // 2. Si la consulta directa a prestadores falló o vino vacía (por RLS anónima), recurrir a /api/notify con service role
        if (providerRows.length === 0) {
          try {
            const notifyRes = await fetch('/api/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'GET_ADMIN_APPLICATIONS' }),
            });
            if (notifyRes.ok) {
              const notifyData = await notifyRes.json();
              if (notifyData && Array.isArray(notifyData.prestadores) && notifyData.prestadores.length > 0) {
                providerRows = notifyData.prestadores;
              }
              if (fundadoresRows.length === 0 && Array.isArray(notifyData.fundadores)) {
                fundadoresRows = notifyData.fundadores;
              }
            }
          } catch (backendErr) {
            console.warn('[AdminStore] Error en fallback backend de postulaciones:', backendErr);
          }
        }

        const prestadores: AdminApplication[] = providerRows.map((p: any) => {
          const rawStatus = p.status;
          const status =
            rawStatus === 'aprobado'
              ? 'aprobado'
              : rawStatus === 'rechazado'
                ? 'rechazado'
                : rawStatus === 'dado_de_baja'
                  ? 'dado_de_baja'
                  : 'pendiente';

          return {
            id: p.id,
            type: 'prestador' as const,
            fullName: p.name || 'Sin nombre',
            email: p.email,
            phone: p.phone || '—',
            category: p.category || 'guia_montaña',
            region: p.region || 'Puna & Fiambalá',
            website: p.website || '',
            description: p.description || '',
            status,
            accountHolder: p.account_holder || undefined,
            cuitDni: p.cuit_dni || undefined,
            cbuAlias: p.cbu_alias || undefined,
            bankName: p.bank_name || undefined,
            createdAt: p.created_at || new Date().toISOString(),
          };
        });

        const fundadores: AdminApplication[] = fundadoresRows.map((f: any) => ({
          id: f.id,
          type: 'fundador' as const,
          fullName: f.full_name || 'Sin nombre',
          email: f.email,
          phone: f.phone || '—',
          motivationLetter: f.motivation_letter || '',
          status:
            f.status === 'aprobada' || f.status === 'aprobado'
              ? 'aprobado'
              : f.status === 'dado_de_baja'
                ? 'dado_de_baja'
                : f.status === 'rechazada' || f.status === 'rechazado'
                  ? 'rechazado'
                  : 'pendiente',
          createdAt: f.created_at || new Date().toISOString(),
        }));

        const combined = [...prestadores, ...fundadores].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

        this._applications.set(combined);
        this.persistApplications(combined);
        await this.providerStore.loadProposalsFromSupabase();
        this._isLoadingApplications.set(false);
        return;
      }
    } catch (err) {
      console.warn('[AdminStore] Error cargando postulaciones desde Supabase:', err);
    }

    const stored = this.loadStoredApplications();
    this._applications.set(stored || []);
    this._isLoadingApplications.set(false);
  }

  async updateApplicationStatus(
    id: string,
    type: ApplicationType,
    status: ApplicationStatus,
    bankingData?: {
      accountHolder?: string;
      cuitDni?: string;
      cbuAlias?: string;
      bankName?: string;
    },
  ): Promise<boolean> {
    const app = this._applications().find((a) => a.id === id);
    try {
      if (isSupabaseConfigured()) {
        if (type === 'prestador') {
          const email = app?.email?.trim().toLowerCase();
          const active = status === 'aprobado';
          const paStatus =
            status === 'aprobado'
              ? 'aprobado'
              : status === 'pendiente'
                ? 'pendiente'
                : status === 'rechazado'
                  ? 'rechazado'
                  : 'dado_de_baja';

          const updatePayload: Record<string, any> = {
            status: paStatus,
            active,
            updated_at: new Date().toISOString(),
          };

          if (bankingData) {
            if (bankingData.accountHolder) updatePayload['account_holder'] = bankingData.accountHolder;
            if (bankingData.cuitDni) updatePayload['cuit_dni'] = bankingData.cuitDni;
            if (bankingData.cbuAlias) updatePayload['cbu_alias'] = bankingData.cbuAlias;
            if (bankingData.bankName) updatePayload['bank_name'] = bankingData.bankName;
          }

          let query = (this.supabase.from('prestadores') as any).update(updatePayload, {
            count: 'exact',
          });
          if (id) {
            query = query.eq('id', id);
          } else if (email) {
            query = query.eq('email', email);
          }
          const { error: paErr, count } = await query;
          if (paErr) {
            console.warn('[AdminStore] Error al actualizar prestadores en Supabase:', paErr);
            return false;
          }

          if (count !== 1) {
            console.warn(
              '[AdminStore] Se esperaba exactamente 1 fila actualizada en prestadores, pero se obtuvieron:',
              count,
            );
            return false;
          }

          if (status === 'aprobado' && email) {
            try {
              await this.notificationService.notifyProviderApproved({
                fullName: app?.fullName || '',
                email,
              });
            } catch (notifyErr) {
              console.warn('[AdminStore] Error al notificar aprobación de prestador:', notifyErr);
            }
          }
        } else {
          // postulaciones_fundadores
          const dbStatus =
            status === 'aprobado'
              ? 'aprobada'
              : status === 'dado_de_baja'
                ? 'dado_de_baja'
                : status === 'rechazado'
                  ? 'rechazada'
                  : 'en_evaluacion';

          const { error: appErr } = await (this.supabase.from('postulaciones_fundadores') as any)
            .update({
              status: dbStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id);

          if (appErr) {
            console.warn('[AdminStore] Error al actualizar postulación en Supabase:', appErr);
            return false;
          }
        }
      }
    } catch (err) {
      console.warn('[AdminStore] Error actualizando estado de postulación en Supabase:', err);
      return false;
    }

    this._applications.update((list) =>
      list.map((a) =>
        a.id === id
          ? {
              ...a,
              status,
              ...(bankingData
                ? {
                    accountHolder: bankingData.accountHolder ?? a.accountHolder,
                    cuitDni: bankingData.cuitDni ?? a.cuitDni,
                    cbuAlias: bankingData.cbuAlias ?? a.cbuAlias,
                    bankName: bankingData.bankName ?? a.bankName,
                  }
                : {}),
            }
          : a,
      ),
    );
    this.persistApplications(this._applications());

    if (type === 'prestador' && app) {
      this.providerStore.syncProviderStatusFromAdmin(app.email, status, {
        name: bankingData?.accountHolder ?? (app.accountHolder || app.fullName),
        agency: app.description || app.category || 'Prestador Oficial',
        phone: app.phone,
        cuitDni: bankingData?.cuitDni ?? app.cuitDni ?? '',
        cbuAlias: bankingData?.cbuAlias ?? app.cbuAlias ?? '',
        bankName: bankingData?.bankName ?? app.bankName ?? '',
      });
    }

    return true;
  }

  private persistApplications(apps: AdminApplication[]): void {
    if (isSupabaseConfigured()) return;
    try {
      localStorage.setItem(STORAGE_KEYS.adminApplicationsCache, JSON.stringify(apps));
    } catch {
      // ignore
    }
  }

  private loadStoredApplications(): AdminApplication[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.adminApplicationsCache);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // ============================================================
  // UTILIDADES DE EXPORTACIÓN
  // ============================================================

  generateMembersRosterText(): string {
    const list = this._members();
    const rows = [
      [
        'Nro Socio',
        'Tipo',
        'Nombre y Apellido',
        'DNI',
        'Email',
        'Teléfono',
        'Nivel',
        'Google Vinculado',
        'Convertido',
        'Fecha Alta',
      ].join('\t'),
      ...list.map((m) =>
        [
          m.position ? `#${m.position}` : 'Waitlist',
          m.type === 'socio' ? 'Oficial' : 'Lista Espera',
          m.fullName || '—',
          m.dni || '—',
          m.email,
          m.phone || '—',
          m.membershipTier.toUpperCase(),
          m.googleLinked ? 'SÍ' : 'NO',
          m.converted ? 'SÍ' : 'NO',
          new Date(m.createdAt).toLocaleDateString('es-AR'),
        ].join('\t'),
      ),
    ];
    return rows.join('\n');
  }

  // ============================================================
  // PERSISTENCIA
  // ============================================================

  private persistMembers(members: AdminMember[]): void {
    if (isSupabaseConfigured()) return;
    try {
      localStorage.setItem(STORAGE_KEYS.adminMembersCache, JSON.stringify(members));
    } catch {
      // ignore
    }
  }

  private loadStoredMembers(): AdminMember[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.adminMembersCache);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (m) =>
          m &&
          !['soc-100', 'soc-101', 'soc-102', 'soc-103', 'wl-201', 'wl-202', 'wl-203'].includes(
            m.id,
          ),
      );
    } catch {
      return [];
    }
  }
}
