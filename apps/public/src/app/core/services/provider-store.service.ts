export type { ProviderUser, PublicPaymentDestination };
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  BANK_TRANSFER_DESTINATION,
  ExperienceAlbumPhoto,
  ExperienceDateSlot,
  MAX_PARTICIPANTS_PER_BOOKING,
  MP_TRANSFER_RECEIPT,
  MercadoPagoPaymentInput,
  NewProviderExperience,
  NewTransferSubmission,
  ProviderExperience,
  ProviderUser,
  PublicPaymentDestination,
  RECEIPT_ACCEPTED_TYPES,
  RECEIPT_MAX_BYTES,
  TransferStatus,
  TransferSubmission,
  discountAmount,
  findDiscountCode,
} from '../models/bank-transfer.model';
import { Experience } from '../models/experience.model';
import { TransactionalEmailService } from './transactional-email.service';
import { NewsletterService } from './newsletter.service';
import { ActivityHistoryService } from './activity-history.service';
import { ClubProfile, isClubExperience, isClubProvider } from '../models/club-profile.model';
import {
  ExperienceService,
  KAYAK_ALBUM_PHOTOS,
  RESERVED_EXPERIENCE_SLUGS,
} from './experience.service';
import { StorageService } from './storage.service';
import { SUPABASE_CLIENT, isSupabaseConfigured } from '../supabase/supabase.client';
import { environment } from '../../../environments/environment';

const PROVIDER_CONTACT_EMAIL = 'prestadores@experiencias.club';
const SAMPLE_RECEIPT_URL = '/assets/images/comprobante-ejemplo.png';

const STORAGE_KEYS = {
  experiences: 'catamarca_provider_experiences_v5',
  submissions: 'catamarca_provider_submissions_v5',
  session: 'catamarca_provider_session_v5',
  providers: 'catamarca_providers_registry_v5',
  experienceRequests: 'catamarca_experience_requests_v1',
};

export interface ExperienceProposalRequest {
  id: string;
  slug?: string;
  providerId: string;
  providerName: string;
  providerAgency: string;
  providerEmail: string;
  providerPhone?: string;
  providerCbuAlias?: string;
  providerBankName?: string;
  providerCuitDni?: string;
  title: string;
  kicker: string;
  subheading: string;
  region: string;
  difficulty: string;
  duration: string;
  altitude?: string;
  capacity: number;
  season: string;
  dates: string;
  priceArs: number;
  priceUsd?: number | null;
  promosAndPricing?: string;
  itinerary: string;
  meetingPoint: string;
  meetingPointUrl?: string;
  includedServices: string;
  participantRequirements: string;
  notes?: string;
  coverImage?: string;
  coverImageName?: string;
  coverVideoUrl?: string;
  coverVideoName?: string;
  albumPhotos?: ExperienceAlbumPhoto[];
  galleryImages?: string[];
  status: 'pendiente' | 'aprobada' | 'rechazada';
  createdAt: string;
  reviewedAt?: string;
}

const SEED_EXPERIENCE_REQUESTS: ExperienceProposalRequest[] = [];

function upcomingDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

export const MP_PENDING_HOLD_MINUTES = 30;
export const MP_PENDING_HOLD_MS = MP_PENDING_HOLD_MINUTES * 60 * 1000;

export function parseConfirmedProposalDates(datesStr?: string): string[] {
  if (!datesStr) return [];
  const trimmed = datesStr.trim();
  if (!trimmed || trimmed.toLowerCase().includes('a coordinar')) {
    return [];
  }
  const matches = trimmed.match(/\b\d{4}-\d{2}-\d{2}\b/g);
  if (!matches || matches.length === 0) {
    return [];
  }
  return Array.from(new Set(matches)).sort();
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function validateReceiptFile(file: File): string | null {
  if (!(RECEIPT_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return 'Formato no admitido. Subí una imagen (JPG, PNG, WEBP) o un PDF.';
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    return 'El archivo supera los 5 MB.';
  }
  return null;
}

export function mapLiveExperienceToProvider(live: Experience): ProviderExperience {
  return {
    id: live.id,
    slug: live.slug,
    providerId: 'provider-oficial',
    providerName: 'Club de Experiencias',
    title: live.title,
    shortTitle: live.shortTitle || live.title,
    tagline: live.tagline,
    description: live.description,
    region: live.region,
    meetingPoint: live.meetingPoint,
    difficulty: live.difficulty as any,
    durationDays: live.durationDays,
    durationLabel: live.durationLabel,
    priceArs: live.priceArs,
    priceUsd: live.priceUsd,
    capacityPerDate: live.maxSpotsPerGroup,
    dates: live.dates || [],
    dateSlots: live.dateSlots || [],
    status: live.status,
    coverImage: live.coverImage,
    galleryImages: live.galleryImages,
    albumPhotos: live.albumPhotos,
    highlights: live.highlights,
    included: live.included,
    notIncluded: live.notIncluded,
    altitudeMeters: live.altitudeMeters,
    bestSeason: live.bestSeason,
    detailRoute: live.detailRoute,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as ProviderExperience;
}

export const CLUB_OFFICIAL_PROVIDER: ProviderUser = {
  id: 'prov-club',
  email: 'admin@experiencias.club',
  name: 'Club de Experiencias',
  agency: 'Club de Experiencias',
  slug: 'club-de-experiencias',
  bio: 'Cuenta institucional oficial del Club de Experiencias. Administrada conjuntamente por el equipo de administradores.',
  phone: '+54 9 383 456-7890',
  website: 'https://experiencias.club',
  socialMedia: 'instagram.com/experiencias.club',
  cuitDni: '30-71829401-4',
  cbuAlias: 'EXPERIENCIAS.CLUB.MP',
  bankName: 'Mercado Pago / Banco Nación',
  accountHolder: 'Club de Experiencias Catamarca',
  verified: true,
  status: 'aprobado',
  role: 'prestador',
  avatar: '/assets/images/kayak-video.png',
  coverImage: '/assets/images/kayak-club-de-experiencias.jpg',
  joinedAt: '2024-01-01T00:00:00Z',
};

export const SEED_PROVIDERS: ProviderUser[] = [
  CLUB_OFFICIAL_PROVIDER,
];

const SEED_EXPERIENCES: ProviderExperience[] = [];
const SEED_SUBMISSIONS: TransferSubmission[] = [];

@Injectable({ providedIn: 'root' })
export class ProviderStoreService {
  private readonly emails = inject(TransactionalEmailService);
  private readonly newsletter = inject(NewsletterService);
  private readonly activities = inject(ActivityHistoryService);
  private readonly expService = inject(ExperienceService);
  private readonly supabase = inject(SUPABASE_CLIENT);
  private readonly storageService = inject(StorageService);

  private readonly _providers = signal<ProviderUser[]>(this.loadStoredProviders());
  private readonly _currentProvider = signal<ProviderUser | null>(this.loadStoredSession());
  private readonly _experiences = signal<ProviderExperience[]>(this.loadStoredExperiences());
  private readonly _submissions = signal<TransferSubmission[]>(this.loadStoredSubmissions());
  private readonly _experienceRequests = signal<ExperienceProposalRequest[]>(
    this.loadStoredRequests(),
  );

  private lastSessionRestoreTime = 0;
  private readonly SESSION_RESTORE_TTL_MS = 60_000;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEYS.experienceRequests) {
          this._experienceRequests.set(this.loadStoredRequests());
        }
      });
      const stored = this.loadStoredSession();
      if (stored?.email) {
        void this.loadProposalsFromSupabase(stored.email);
      }
    }
  }

  // Public readonly signals
  readonly currentProvider = this._currentProvider.asReadonly();
  readonly isAuthenticated = computed(() => this._currentProvider() !== null);
  readonly isProviderApproved = computed(() => {
    const prov = this._currentProvider();
    if (!prov) return false;
    return prov.verified === true && prov.status !== 'dado_de_baja' && prov.status !== 'pendiente';
  });
  readonly allProviders = this._providers.asReadonly();
  readonly providers = this._providers.asReadonly();
  readonly experiences = this._experiences.asReadonly();
  readonly experienceRequests = computed(() =>
    [...this._experienceRequests()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
  readonly submissions = computed(() =>
    [...this._submissions()].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
  );

  // Submissions filtered for current logged-in provider
  readonly providerSubmissions = computed(() => {
    const provider = this._currentProvider();
    if (!provider) return this.submissions();
    const providerExpIds = new Set(
      this._experiences()
        .filter((e) => e.providerId === provider.id)
        .map((e) => e.id),
    );
    return this.submissions().filter((s) => providerExpIds.has(s.experienceId));
  });

  // Experiences for current logged-in provider
  readonly providerExperiences = computed(() => {
    const provider = this._currentProvider();
    if (!provider) return this._experiences();
    return this._experiences().filter((e) => e.providerId === provider.id);
  });

  // Proposals/requests submitted by current provider
  readonly providerExperienceRequests = computed(() => {
    const provider = this._currentProvider();
    if (!provider) return this.experienceRequests();
    return this.experienceRequests().filter(
      (r) => r.providerId === provider.id || r.providerEmail === provider.email,
    );
  });

  readonly pendingCount = computed(
    () => this.providerSubmissions().filter((s) => s.status === 'pendiente').length,
  );

  // Financial KPIs for provider dashboard
  readonly providerStats = computed(() => {
    const subs = this.providerSubmissions();
    const exps = this.providerExperiences();

    const approvedSubs = subs.filter((s) => s.status === 'aprobado');
    const pendingSubs = subs.filter((s) => s.status === 'pendiente');

    const confirmedRevenue = approvedSubs
      .reduce((sum, s) => sum + (Number(s.amountArs) || 0), 0);

    const pendingRevenue = pendingSubs
      .reduce((sum, s) => sum + (Number(s.amountArs) || 0), 0);

    const totalEnrolled = approvedSubs
      .reduce((sum, s) => sum + (Number(s.participants) || 0), 0);

    const publishedCount = exps.filter((e) => e.status === 'publicada').length;
    const pendingModerationCount = exps.filter(
      (e) =>
        e.status === 'pendiente_publicacion' ||
        e.status === 'pendiente_ocultar' ||
        e.status === 'pendiente_eliminar',
    ).length;

    return {
      confirmedRevenue,
      pendingRevenue,
      totalEnrolled,
      publishedCount,
      pendingModerationCount,
      totalExperiences: exps.length,
      pendingReceiptsCount: pendingSubs.length,
    };
  });

  reloadFromStorage(): void {
    this._experiences.set(this.loadStoredExperiences());
    this._submissions.set(this.loadStoredSubmissions());
    this._experienceRequests.set(this.loadStoredRequests());
    this._providers.set(this.loadStoredProviders());
  }

  async restoreSupabaseSession(force = false): Promise<boolean> {
    const now = Date.now();
    if (!force && this.isAuthenticated() && this.isProviderApproved()) {
      if (now - this.lastSessionRestoreTime < this.SESSION_RESTORE_TTL_MS) {
        return true;
      }
    }

    if (!isSupabaseConfigured()) {
      if (environment.production) {
        this.lastSessionRestoreTime = 0;
        this._currentProvider.set(null);
        this.saveSession(null);
        return false;
      }
      return this.isAuthenticated() && this.isProviderApproved();
    }

    try {
      const { data, error: userError } = await this.supabase.auth.getUser();
      if (userError || !data?.user?.email) {
        this.lastSessionRestoreTime = 0;
        this._currentProvider.set(null);
        this.saveSession(null);
        return false;
      }

      const email = data.user.email.trim().toLowerCase();

      const { data: access, error } = await (this.supabase.from('prestadores') as any)
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.warn('[ProviderStore] Error consultando prestadores:', error);
      }

      if (error || !access || access.active !== true || access.status !== 'aprobado') {
        this.lastSessionRestoreTime = 0;
        this._currentProvider.set(null);
        this.saveSession(null);
        return false;
      }

      const existing = this._providers().find((provider) => provider.email.toLowerCase() === email);
      const userMeta = data.user?.user_metadata || {};
      const googleAvatar =
        userMeta['avatar_url'] ||
        userMeta['picture'] ||
        (data.user as any)?.identities?.[0]?.identity_data?.['avatar_url'] ||
        (data.user as any)?.identities?.[0]?.identity_data?.['picture'] ||
        '';
      const resolvedSlug =
        access.slug ||
        existing?.slug ||
        (access.agency
          ? access.agency
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)+/g, '')
          : `prov-${email.split('@')[0]}`);

      const isClub = isClubProvider({
        id: existing?.id,
        email,
        slug: resolvedSlug,
      });

      const provider: ProviderUser = {
        id: existing?.id ?? `provider-${email.replace(/[^a-z0-9]+/g, '-')}`,
        email,
        name:
          access.account_holder ||
          access.name ||
          userMeta['full_name'] ||
          userMeta['name'] ||
          existing?.name ||
          email,
        agency: access.agency || existing?.agency || 'Prestador EXPERIENCIAS.CLUB',
        slug: resolvedSlug,
        bio: access.bio || existing?.bio || '',
        phone: access.phone || existing?.phone || '',
        website: access.website || existing?.website || '',
        socialMedia: access.social_media || existing?.socialMedia || '',
        socialMediaSecondary: access.social_media_secondary || existing?.socialMediaSecondary || '',
        cuitDni: (!isClub && access.cuit_dni === '20-33445566-7') ? '' : access.cuit_dni || '',
        cbuAlias: (!isClub && access.cbu_alias === 'EXPERIENCIAS.CLUB.MP') ? '' : access.cbu_alias || '',
        bankName: (!isClub && access.bank_name === 'Banco Nación / Mercado Pago') ? '' : access.bank_name || '',
        verified: true,
        status: 'aprobado',
        role: 'prestador',
        avatar:
          access.avatar_url || googleAvatar || existing?.avatar || '/assets/aistudio/patricio.jpg',
        coverImage:
          access.cover_url ||
          existing?.coverImage ||
          '/assets/images/kayak-club-de-experiencias.jpg',
        joinedAt: existing?.joinedAt ?? new Date().toISOString(),
        mpConnected: Boolean(
          (access.notes && (() => {
            try {
              const parsed = JSON.parse(access.notes);
              if (parsed?.mp_collector_id && String(parsed.mp_collector_id).startsWith('mp-col-')) {
                return false;
              }
              return Boolean(parsed?.mp_connected && parsed?.mp_collector_id);
            } catch { return false; }
          })()) ||
          ((access as any).mp_connected && (access as any).mp_collector_id && !String((access as any).mp_collector_id).startsWith('mp-col-'))
        ),
        mpCollectorId:
          (access.notes && (() => {
            try {
              const parsed = JSON.parse(access.notes);
              if (parsed?.mp_collector_id && String(parsed.mp_collector_id).startsWith('mp-col-')) {
                return undefined;
              }
              return parsed?.mp_collector_id || undefined;
            } catch { return undefined; }
          })()) ||
          ((access as any).mp_collector_id && !String((access as any).mp_collector_id).startsWith('mp-col-') ? (access as any).mp_collector_id : undefined),
        mpNickname:
          (access as any).mp_nickname ||
          (access.notes && (() => {
            try { return JSON.parse(access.notes)?.mp_nickname; } catch { return undefined; }
          })()) || undefined,
      };

      if (!existing) this._providers.update((providers) => [...providers, provider]);
      else
        this._providers.update((providers) =>
          providers.map((p) => (p.email.toLowerCase() === email ? provider : p)),
        );
      this.lastSessionRestoreTime = Date.now();
      this._currentProvider.set(provider);
      this.saveSession(provider);
      if (!access.slug && provider.slug) {
        // El slug derivado solo existía en el cliente: se persiste para que el perfil público resuelva.
        void (this.supabase.from('prestadores') as any)
          .update({ slug: provider.slug.toLowerCase() })
          .eq('email', email)
          .then(({ error: slugError }: { error: unknown }) => {
            if (slugError) console.warn('[ProviderStore] No se pudo persistir el slug:', slugError);
          });
      }
      void this.loadProposalsFromSupabase(email);
      return true;
    } catch (err) {
      console.warn('[ProviderStore] Error restaurando sesión Supabase:', err);
      if (this.isAuthenticated() && this.isProviderApproved()) {
        return true;
      }
      this.lastSessionRestoreTime = 0;
      this._currentProvider.set(null);
      this.saveSession(null);
      return false;
    }
  }

  async signInWithGoogle(): Promise<{ success: boolean; message: string }> {
    if (!isSupabaseConfigured()) {
      if (environment.production) {
        return {
          success: false,
          message: 'El servicio de autenticación no está disponible en este momento.',
        };
      }
      const isBrowser = typeof window !== 'undefined';
      const host = isBrowser ? window.location.hostname.toLowerCase() : '';
      const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
      if (!isLocalHost) {
        return { success: false, message: 'Acceso no disponible en este entorno.' };
      }
      this._currentProvider.set(SEED_PROVIDERS[0]);
      this.saveSession(SEED_PROVIDERS[0]);
      return { success: true, message: '' };
    }

    const isBrowser = typeof window !== 'undefined';
    const host = isBrowser ? window.location.hostname.toLowerCase() : '';
    const search = isBrowser ? window.location.search.toLowerCase() : '';
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
    const isProviderHost =
      host.startsWith('prestadores.') ||
      host.includes('prestadores.experiencias') ||
      (isLocalHost && (search.includes('portal=prestador') || search.includes('prestador=true')));

    const origin = isBrowser ? window.location.origin : 'https://prestadores.experiencias.club';
    const redirectPath = isProviderHost ? '/dashboard' : '/prestadores/panel/dashboard';

    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}${redirectPath}`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    return error
      ? { success: false, message: error.message }
      : { success: true, message: 'Redirigiendo a Google...' };
  }

  // ==========================================
  // Auth & Session
  // ==========================================
  login(email: string, _password?: string): { success: boolean; message: string } {
    const normalized = email.trim().toLowerCase();
    const provider = this._providers().find((p) => p.email.toLowerCase() === normalized);

    if (provider) {
      if (provider.status === 'dado_de_baja') {
        return {
          success: false,
          message:
            'La cuenta de este prestador se encuentra dada de baja. Comunicate con administración.',
        };
      }
      if (provider.status === 'pendiente' || !provider.verified) {
        return {
          success: false,
          message:
            'Tu postulación como prestador aún está pendiente de aprobación por el equipo de administración.',
        };
      }
      this._currentProvider.set(provider);
      this.saveSession(provider);
      return { success: true, message: 'Ingreso exitoso.' };
    }

    return {
      success: false,
      message: 'No se encontró un prestador autorizado para este correo.',
    };
  }

  syncProviderStatusFromAdmin(
    email: string,
    status: 'aprobado' | 'pendiente' | 'rechazado' | 'dado_de_baja',
    details?: Partial<ProviderUser>,
  ): void {
    const normalized = email.trim().toLowerCase();
    const existing = this._providers().find((p) => p.email.toLowerCase() === normalized);

    if (existing) {
      this._providers.update((list) =>
        list.map((p) =>
          p.email.toLowerCase() === normalized
            ? {
                ...p,
                ...(details?.name ? { name: details.name } : {}),
                ...(details?.agency ? { agency: details.agency } : {}),
                ...(details?.phone ? { phone: details.phone } : {}),
                ...(details?.cuitDni ? { cuitDni: details.cuitDni } : {}),
                ...(details?.cbuAlias ? { cbuAlias: details.cbuAlias } : {}),
                ...(details?.bankName ? { bankName: details.bankName } : {}),
                slug:
                  p.slug ||
                  details?.slug ||
                  slugify(details?.agency || details?.name || p.agency || p.name || normalized.split('@')[0]),
                verified: status === 'aprobado',
                status,
              }
            : p,
        ),
      );
    } else {
      const newProvider: ProviderUser = {
        id: `provider-${normalized.replace(/[^a-z0-9]+/g, '-')}`,
        email: normalized,
        name: details?.name || email,
        agency: details?.agency || 'Prestador EXPERIENCIAS.CLUB',
        slug:
          details?.slug ||
          slugify(details?.agency || details?.name || normalized.split('@')[0]),
        phone: details?.phone || '',
        cuitDni: details?.cuitDni || '',
        cbuAlias: details?.cbuAlias || '',
        bankName: details?.bankName || '',
        verified: status === 'aprobado',
        status,
        role: 'prestador',
        joinedAt: new Date().toISOString(),
      };
      this._providers.update((list) => [...list, newProvider]);
    }

    const current = this._currentProvider();
    if (current && current.email.toLowerCase() === normalized) {
      if (status !== 'aprobado') {
        this._currentProvider.set(null);
        this.saveSession(null);
      } else {
        const updated = this._providers().find((p) => p.email.toLowerCase() === normalized) || null;
        this._currentProvider.set(updated);
        if (updated) this.saveSession(updated);
      }
    }
    this.saveProviders();
  }

  loginAs(providerId: string): void {
    if (environment.production || isSupabaseConfigured()) {
      return;
    }
    const isBrowser = typeof window !== 'undefined';
    const host = isBrowser ? window.location.hostname.toLowerCase() : '';
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
    if (!isLocalHost) {
      return;
    }
    const provider = this._providers().find((p) => p.id === providerId);
    if (provider) {
      this._currentProvider.set(provider);
      this.saveSession(provider);
    }
  }

  register(data: {
    email: string;
    name: string;
    agency: string;
    phone: string;
    cuitDni: string;
    cbuAlias: string;
    bankName: string;
  }): ProviderUser {
    const newUser: ProviderUser = {
      id: `prov-${crypto.randomUUID().slice(0, 8)}`,
      email: data.email.trim().toLowerCase(),
      name: data.name.trim(),
      agency: data.agency.trim(),
      phone: data.phone.trim(),
      cuitDni: data.cuitDni.trim(),
      cbuAlias: data.cbuAlias.trim(),
      bankName: data.bankName.trim(),
      verified: false,
      role: 'prestador',
      avatar:
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
      joinedAt: new Date().toISOString(),
    };

    this._providers.update((list) => [newUser, ...list]);
    this.saveProviders();
    this._currentProvider.set(newUser);
    this.saveSession(newUser);
    return newUser;
  }

  async getAuthToken(): Promise<string | null> {
    if (!isSupabaseConfigured()) return null;
    try {
      const { data } = await this.supabase.auth.getSession();
      return data?.session?.access_token || null;
    } catch {
      return null;
    }
  }

  async disconnectMercadoPago(): Promise<{ success: boolean; message?: string }> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = await this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      await fetch('/api/mercadopago', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'disconnect' }),
      });
    } catch (err) {
      console.warn('[ProviderStore] Error invocando disconnect en backend MP:', err);
    }

    return this.updateProfile({
      mpConnected: false,
      mpCollectorId: '',
      mpNickname: '',
    });
  }

  async logout(): Promise<void> {
    if (isSupabaseConfigured()) {
      await this.supabase.auth.signOut();
    }
    this.lastSessionRestoreTime = 0;
    this._currentProvider.set(null);
    this.saveSession(null);
    this._experienceRequests.set(SEED_EXPERIENCE_REQUESTS);
    try {
      localStorage.removeItem(STORAGE_KEYS.experienceRequests);
      localStorage.removeItem(STORAGE_KEYS.experiences);
      localStorage.removeItem(STORAGE_KEYS.submissions);
    } catch {
      // ignore
    }
    this.expService.clearPrivilegedCache();
  }

  async updateProfile(
    updates: Partial<ProviderUser>,
  ): Promise<{ success: boolean; message?: string }> {
    const current = this._currentProvider();
    if (!current) return { success: false, message: 'No hay sesión de prestador activa.' };

    const email = current.email.trim().toLowerCase();
    const updated: ProviderUser = { ...current, ...updates };

    if (isSupabaseConfigured()) {
      try {
        const payload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (updates.name !== undefined) {
          payload['name'] = updates.name.trim();
          payload['account_holder'] = updates.name.trim();
        }
        if (updates.agency !== undefined) payload['agency'] = updates.agency.trim();
        if (updates.slug !== undefined) payload['slug'] = updates.slug.trim().toLowerCase();
        if (updates.bio !== undefined) payload['bio'] = updates.bio.trim();
        if (updates.avatar !== undefined) payload['avatar_url'] = updates.avatar.trim();
        if (updates.coverImage !== undefined) payload['cover_url'] = updates.coverImage.trim();
        if (updates.phone !== undefined) payload['phone'] = updates.phone.trim();
        if (updates.website !== undefined) payload['website'] = updates.website.trim();
        if (updates.socialMedia !== undefined) payload['social_media'] = updates.socialMedia.trim();
        if (updates.socialMediaSecondary !== undefined) {
          payload['social_media_secondary'] = updates.socialMediaSecondary.trim();
        }
        if (updates.cuitDni !== undefined) payload['cuit_dni'] = updates.cuitDni.trim();
        if (updates.cbuAlias !== undefined) payload['cbu_alias'] = updates.cbuAlias.trim();
        if (updates.bankName !== undefined) payload['bank_name'] = updates.bankName.trim();

        if (
          updates.mpConnected !== undefined ||
          updates.mpCollectorId !== undefined ||
          updates.mpNickname !== undefined ||
          updates.mpEmail !== undefined
        ) {
          let remoteNotes: string | null = null;
          try {
            const { data: remoteRow, error: fetchErr } = await (this.supabase.from('prestadores') as any)
              .select('notes')
              .eq('email', email)
              .maybeSingle();
            if (fetchErr) {
              console.error('[ProviderStore] Error consultando notas remotas del prestador:', fetchErr);
              return {
                success: false,
                message: 'No se pudieron verificar los datos actuales del prestador en el servidor. Intente nuevamente.',
              };
            }
            if (remoteRow) {
              remoteNotes = typeof remoteRow.notes === 'string' ? remoteRow.notes : '';
            }
          } catch (err) {
            console.error('[ProviderStore] Excepción al consultar notas remotas del prestador:', err);
            return {
              success: false,
              message: 'Error de comunicación al consultar los datos del prestador en el servidor.',
            };
          }

          if (remoteNotes === null) {
            return {
              success: false,
              message: 'No se pudo leer la configuración actual del prestador en el servidor.',
            };
          }

          const baseNotes = remoteNotes;
          let notesObj: Record<string, any> = {};
          if (baseNotes) {
            try {
              const parsed = JSON.parse(baseNotes);
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                notesObj = parsed;
              } else {
                notesObj = { text: baseNotes };
              }
            } catch {
              notesObj = { text: baseNotes };
            }
          }
          // Asegurar que nunca se conserven ni expongan tokens secretos en prestadores.notes
          delete notesObj['mp_access_token'];
          delete notesObj['mp_refresh_token'];

          if (updates.mpConnected !== undefined) notesObj['mp_connected'] = updates.mpConnected;
          if (updates.mpCollectorId !== undefined) notesObj['mp_collector_id'] = updates.mpCollectorId;
          if (updates.mpNickname !== undefined) notesObj['mp_nickname'] = updates.mpNickname;
          if (updates.mpEmail !== undefined) notesObj['mp_email'] = updates.mpEmail;
          payload['notes'] = JSON.stringify(notesObj);
          updated.notes = payload['notes'];
        }

        let { error } = await (this.supabase.from('prestadores') as any)
          .update(payload)
          .eq('email', email);

        if (error && /social_media_secondary/.test(error.message || '')) {
          // Columna aún no migrada en la base remota: reintenta sin ella
          const { social_media_secondary: _omit, ...legacyPayload } = payload;
          ({ error } = await (this.supabase.from('prestadores') as any)
            .update(legacyPayload)
            .eq('email', email));
        }

        if (error) {
          console.warn('[ProviderStore] Error actualizando prestadores:', error);
          return {
            success: false,
            message: 'No se pudieron guardar los cambios en la base de datos.',
          };
        }

        const expUpdate: Record<string, any> = {};
        if (updates.agency !== undefined && updates.agency.trim()) {
          expUpdate['provider_name'] = updates.agency.trim();
        }
        if (updates.slug !== undefined && updates.slug.trim()) {
          expUpdate['provider_slug'] = updates.slug.trim().toLowerCase();
        }
        if (Object.keys(expUpdate).length > 0) {
          const { error: expError } = await (this.supabase.from('experiencias') as any)
            .update(expUpdate)
            .eq('provider_email', email);
          if (expError) {
            console.warn('[ProviderStore] Error sincronizando experiencias:', expError);
            return {
              success: false,
              message: 'No se pudieron sincronizar las experiencias vinculadas al prestador.',
            };
          }
        }
      } catch (err: any) {
        console.warn('[ProviderStore] Error de conexión actualizando perfil:', err);
        return { success: false, message: 'Error de conexión con el servidor.' };
      }
    }

    this._currentProvider.set(updated);
    this._providers.update((list) => list.map((p) => (p.id === current.id ? updated : p)));
    this.saveSession(updated);
    this.saveProviders();

    if (
      (updates.agency !== undefined && updates.agency.trim()) ||
      (updates.slug !== undefined && updates.slug.trim())
    ) {
      const newAgency = updates.agency !== undefined ? updates.agency.trim() : undefined;
      const newSlug = updates.slug !== undefined ? updates.slug.trim().toLowerCase() : undefined;
      this._experiences.update((list) =>
        list.map((e) => {
          if (e.providerId === current.id || (e.providerEmail || '').toLowerCase() === email) {
            return {
              ...e,
              ...(newAgency ? { providerName: newAgency } : {}),
              ...(newSlug ? { providerSlug: newSlug } : {}),
            };
          }
          return e;
        }),
      );
      this.saveExperiences();
    }

    return { success: true };
  }

  syncClubProviderProfile(profile: ClubProfile): void {
    this._providers.update((list) => {
      const idx = list.findIndex(
        (p) =>
          p.id === 'prov-club' ||
          (p.email || '').toLowerCase() === profile.email.toLowerCase() ||
          p.slug === 'club-de-experiencias',
      );
      if (idx !== -1) {
        const current = list[idx];
        const updated: ProviderUser = {
          ...current,
          email: profile.email,
          name: profile.name,
          agency: profile.agency,
          slug: profile.slug,
          phone: profile.phone,
          cbuAlias: profile.cbuAlias,
          cuitDni: profile.cuitDni,
          bankName: profile.bankName,
          accountHolder: profile.accountHolder,
          bio: profile.bio,
          website: profile.website,
          socialMedia: profile.socialMedia,
        };
        const next = [...list];
        next[idx] = updated;
        return next;
      } else {
        const newProv: ProviderUser = {
          id: 'prov-club',
          email: profile.email,
          name: profile.name,
          agency: profile.agency,
          slug: profile.slug,
          phone: profile.phone,
          cbuAlias: profile.cbuAlias,
          cuitDni: profile.cuitDni,
          bankName: profile.bankName,
          accountHolder: profile.accountHolder,
          bio: profile.bio,
          website: profile.website,
          socialMedia: profile.socialMedia,
          verified: true,
          status: 'aprobado',
          role: 'prestador',
          avatar: '/assets/images/kayak-video.png',
          coverImage: '/assets/images/kayak-club-de-experiencias.jpg',
          joinedAt: '2024-01-01T00:00:00Z',
        };
        return [newProv, ...list];
      }
    });
    this.saveProviders();
  }

  // ==========================================
  // Experience Management & Moderation
  // ==========================================
  getProviderById(id: string): ProviderUser | undefined {
    return this._providers().find((p) => p.id === id);
  }

  getProviderByEmail(email: string): ProviderUser | undefined {
    return this._providers().find((p) => p.email.toLowerCase() === email.trim().toLowerCase());
  }

  getProviderBySlug(slug: string): ProviderUser | undefined {
    const clean = (slug || '').trim().toLowerCase();
    if (!clean) return undefined;
    const providers = this._providers();

    // 1er pase: coincidencia exacta por slug almacenado o id
    const exactMatch = providers.find(
      (p) => (p.slug || '').toLowerCase() === clean || p.id.toLowerCase() === clean,
    );
    if (exactMatch) {
      return exactMatch;
    }

    // 2do pase: fallbacks por agencia y nombre
    return providers.find(
      (p) =>
        slugify(p.agency || '') === clean ||
        slugify(p.name || '') === clean ||
        (p.agency || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '') === clean,
    );
  }

  /**
   * Consulta las notas remotas actuales del prestador en Supabase.
   * Si la consulta es exitosa, sincroniza la copia local en `_providers` y retorna el string de notas.
   * En caso de error o si Supabase no está configurado, retorna null para permitir fallback a las notas locales.
   */
  async loadProviderNotes(emailOrId: string): Promise<string | null> {
    if (!isSupabaseConfigured() || !emailOrId) return null;
    try {
      const cleanKey = emailOrId.trim().toLowerCase();
      let query = (this.supabase.from('prestadores') as any).select('notes');
      if (cleanKey.includes('@')) {
        query = query.eq('email', cleanKey);
      } else {
        query = query.eq('id', cleanKey);
      }
      const { data: remoteRow, error } = await query.maybeSingle();

      if (!error && remoteRow && typeof remoteRow.notes === 'string') {
        this._providers.update((list) =>
          list.map((p) =>
            (p.email || '').trim().toLowerCase() === cleanKey ||
            (p.id || '').trim().toLowerCase() === cleanKey
              ? { ...p, notes: remoteRow.notes }
              : p,
          ),
        );
        return remoteRow.notes;
      }
    } catch (err) {
      console.warn('[ProviderStore] Error cargando notas remotas del prestador:', err);
    }
    return null;
  }

  async adminUpdateProvider(
    providerIdOrEmail: string,
    updates: Partial<ProviderUser>,
  ): Promise<{ success: boolean; message?: string }> {
    const cleanKey = providerIdOrEmail.trim().toLowerCase();
    const current = this._providers().find(
      (p) =>
        p.id.toLowerCase() === cleanKey ||
        (p.email || '').toLowerCase() === cleanKey ||
        (p.slug || '').toLowerCase() === cleanKey,
    );

    if (!current) {
      return { success: false, message: 'Prestador no encontrado en el padrón local.' };
    }

    const email = current.email.trim().toLowerCase();
    if (updates.email && updates.email.trim().toLowerCase() !== email) {
      return {
        success: false,
        message: 'No se permite modificar el correo del prestador directamente porque afectaría el inicio de sesión y la autenticación.',
      };
    }

    const updated: ProviderUser = {
      ...current,
      ...updates,
    };

    if (isSupabaseConfigured()) {
      try {
        const payload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (updates.name !== undefined) {
          payload['name'] = updates.name.trim();
          payload['account_holder'] = updates.accountHolder ? updates.accountHolder.trim() : updates.name.trim();
        }
        if (updates.agency !== undefined) payload['agency'] = updates.agency.trim();
        if (updates.slug !== undefined) payload['slug'] = updates.slug.trim().toLowerCase();
        if (updates.bio !== undefined) payload['bio'] = updates.bio.trim();
        if (updates.phone !== undefined) payload['phone'] = updates.phone.trim();
        if (updates.website !== undefined) payload['website'] = updates.website.trim();
        if (updates.socialMedia !== undefined) payload['social_media'] = updates.socialMedia.trim();
        if (updates.cuitDni !== undefined) payload['cuit_dni'] = updates.cuitDni.trim();
        if (updates.cbuAlias !== undefined) payload['cbu_alias'] = updates.cbuAlias.trim();
        if (updates.bankName !== undefined) payload['bank_name'] = updates.bankName.trim();

        if (updates.accountHolder !== undefined) payload['account_holder'] = updates.accountHolder.trim();
        if (updates.status !== undefined) {
          payload['status'] = updates.status;
          payload['active'] = updates.status === 'aprobado';
        }

        const hasMpUpdates =
          updates.mpConnected !== undefined ||
          updates.mpCollectorId !== undefined ||
          updates.mpNickname !== undefined ||
          updates.mpEmail !== undefined;

        let remoteNotes: string | null = null;
        if (hasMpUpdates || updates.notes !== undefined) {
          // Cargar notas remotas actuales antes de aplicar la actualización para preservar
          // metadatos persistidos (como pausedByBajaExpIds) si el registro local no los tenía cargados.
          try {
            const { data: remoteRow, error: fetchErr } = await (this.supabase.from('prestadores') as any)
              .select('notes')
              .eq('email', email)
              .maybeSingle();
            if (fetchErr) {
              console.error('[ProviderStore] Error consultando notas remotas del prestador:', fetchErr);
              return {
                success: false,
                message: 'No se pudieron verificar los datos actuales del prestador en el servidor. Intente nuevamente.',
              };
            }
            if (remoteRow) {
              remoteNotes = typeof remoteRow.notes === 'string' ? remoteRow.notes : '';
            }
          } catch (fetchErr) {
            console.error('[ProviderStore] Excepción al consultar notas remotas del prestador:', fetchErr);
            return {
              success: false,
              message: 'Error de comunicación al consultar los datos del prestador en el servidor.',
            };
          }

          if (remoteNotes === null) {
            return {
              success: false,
              message: 'No se pudo leer la configuración actual del prestador en el servidor.',
            };
          }

          const baseNotes = remoteNotes;
          let notesObj: Record<string, any> = {};
          if (baseNotes) {
            try {
              const parsed = JSON.parse(baseNotes);
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                notesObj = parsed;
              } else {
                notesObj = { text: baseNotes };
              }
            } catch {
              notesObj = { text: baseNotes };
            }
          }

          if (updates.notes !== undefined) {
            if (typeof updates.notes === 'string' && updates.notes.trim()) {
              try {
                const parsedUpdates = JSON.parse(updates.notes);
                if (parsedUpdates && typeof parsedUpdates === 'object' && !Array.isArray(parsedUpdates)) {
                  notesObj = {
                    ...notesObj,
                    ...parsedUpdates,
                  };
                } else {
                  notesObj['text'] = updates.notes.trim();
                }
              } catch {
                notesObj['text'] = updates.notes.trim();
              }
            } else if (typeof updates.notes === 'string') {
              delete notesObj['text'];
            }
          }

          if (updates.mpConnected !== undefined) notesObj['mp_connected'] = updates.mpConnected;
          if (updates.mpCollectorId !== undefined) notesObj['mp_collector_id'] = updates.mpCollectorId;
          if (updates.mpNickname !== undefined) notesObj['mp_nickname'] = updates.mpNickname;
          if (updates.mpEmail !== undefined) notesObj['mp_email'] = updates.mpEmail;

          payload['notes'] = JSON.stringify(notesObj);
          updated.notes = payload['notes'];
        } else if (remoteNotes !== null && current.notes !== remoteNotes) {
          updated.notes = remoteNotes;
        }

        const { data: updatedRows, error } = await (this.supabase.from('prestadores') as any)
          .update(payload)
          .eq('email', email)
          .select('id');

        if (error) {
          console.warn('[ProviderStore] Error actualizando prestadores como admin:', error);
          return {
            success: false,
            message: 'No se pudieron guardar los cambios en la base de datos remota.',
          };
        }

        if (!updatedRows || updatedRows.length === 0) {
          return {
            success: false,
            message: 'No se encontró el registro del prestador en la base de datos remota.',
          };
        }

        // Si cambió la agencia o el slug, sincronizamos las experiencias en la base remota
        const expUpdate: Record<string, any> = {};
        if (updates.agency !== undefined && updates.agency.trim()) {
          expUpdate['provider_name'] = updates.agency.trim();
        }
        if (updates.slug !== undefined && updates.slug.trim()) {
          expUpdate['provider_slug'] = updates.slug.trim().toLowerCase();
        }
        if (Object.keys(expUpdate).length > 0) {
          await (this.supabase.from('experiencias') as any)
            .update(expUpdate)
            .eq('provider_email', email);
        }
      } catch (err: any) {
        console.warn('[ProviderStore] Excepción al actualizar prestador:', err);
        return { success: false, message: 'Error de conexión con el servidor.' };
      }
    }

    this._providers.update((list) =>
      list.map((p) => (p.id === current.id || p.email.toLowerCase() === email ? updated : p)),
    );
    this.saveProviders();

    if (this._currentProvider()?.email.toLowerCase() === email) {
      this._currentProvider.set(updated);
      this.saveSession(updated);
    }

    // Actualizar experiencias locales asociadas si cambiaron datos relevantes
    if (
      (updates.agency !== undefined && updates.agency.trim()) ||
      (updates.slug !== undefined && updates.slug.trim())
    ) {
      const newAgency = updates.agency !== undefined ? updates.agency.trim() : undefined;
      const newSlug = updates.slug !== undefined ? updates.slug.trim().toLowerCase() : undefined;
      this._experiences.update((list) =>
        list.map((e) => {
          if (e.providerId === current.id || (e.providerEmail || '').toLowerCase() === email) {
            return {
              ...e,
              ...(newAgency ? { providerName: newAgency } : {}),
              ...(newSlug ? { providerSlug: newSlug } : {}),
            };
          }
          return e;
        }),
      );
      this.saveExperiences();
    }

    return { success: true };
  }

  async getPublicProvider(slugOrId: string): Promise<ProviderUser | null> {
    const clean = (slugOrId || '').trim().toLowerCase();
    if (!clean) return null;

    const mapRemoteToPublicProvider = (remoteData: any, fallbackSlug: string): ProviderUser => ({
      id: `prov-${remoteData.email.replace(/[^a-z0-9]+/g, '-')}`,
      email: remoteData.email,
      name: remoteData.name || remoteData.agency || remoteData.email,
      agency: remoteData.agency || 'Prestador Catamarca',
      slug: remoteData.slug || fallbackSlug,
      bio: remoteData.bio || '',
      phone: remoteData.phone || '',
      website: remoteData.website || '',
      socialMedia: remoteData.social_media || '',
      socialMediaSecondary: remoteData.social_media_secondary || '',
      cuitDni: '',
      cbuAlias: '',
      bankName: '',
      verified: true,
      status: remoteData.status || 'aprobado',
      role: 'prestador',
      avatar: remoteData.avatar_url || '',
      coverImage: remoteData.cover_url || '/assets/images/kayak-club-de-experiencias.jpg',
      joinedAt: new Date().toISOString(),
    });

    const queryRemotePublicProfile = async (querySlug: string, queryEmail: string) => {
      let remoteData: any = null;
      const { data, error } = await (this.supabase as any)
        .from('perfiles_publicos')
        .select('*')
        .or(`slug.eq.${querySlug},email.eq.${queryEmail}`)
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        remoteData = data;
      } else if (error) {
        const { data: fallbackData } = await (this.supabase.from('prestadores') as any)
          .select(
            'email, name, agency, active, status, phone, website, social_media, social_media_secondary, slug, bio, avatar_url, cover_url',
          )
          .eq('active', true)
          .eq('status', 'aprobado')
          .or(`slug.eq.${querySlug},email.eq.${queryEmail}`)
          .limit(1)
          .maybeSingle();
        remoteData = fallbackData;
      }
      return remoteData;
    };

    const found = this._providers().find(
      (p) =>
        (p.slug || '').toLowerCase() === clean ||
        p.id.toLowerCase() === clean ||
        p.email.toLowerCase() === clean ||
        (p.agency || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '') === clean,
    );

    if (found) {
      if (!isSupabaseConfigured()) {
        return found.status === 'aprobado' && (found.active ?? true)
          ? { ...found, cuitDni: '', cbuAlias: '', bankName: '' }
          : null;
      }
      try {
        const querySlug = (found.slug || clean).trim().toLowerCase();
        const queryEmail = (found.email || clean).trim().toLowerCase();
        const remoteData = await queryRemotePublicProfile(querySlug, queryEmail);

        if (remoteData && remoteData.active === true && remoteData.status === 'aprobado') {
          return mapRemoteToPublicProvider(remoteData, found.slug || clean);
        }
        return null;
      } catch {
        return null;
      }
    }

    if (isSupabaseConfigured()) {
      try {
        const remoteData = await queryRemotePublicProfile(clean, clean);
        if (remoteData && remoteData.active === true && remoteData.status === 'aprobado') {
          return mapRemoteToPublicProvider(remoteData, clean);
        }
      } catch (err) {
        console.warn('[ProviderStore] Error consultando perfil público:', err);
      }
    }

    return null;
  }

  getExperienceById(id: string): ProviderExperience | undefined {
    const fromStore = this._experiences().find((e) => e.id === id || e.slug === id);
    if (fromStore) return fromStore;
    const live = this.expService.getExperienceById(id) || this.expService.getExperienceBySlug(id);
    if (live) {
      return mapLiveExperienceToProvider(live);
    }
    return undefined;
  }

  getExperienceBySlug(slug: string): ProviderExperience | undefined {
    const fromStore = this._experiences().find((e) => e.slug === slug);
    if (fromStore) return fromStore;
    const live = this.expService.getExperienceBySlug(slug);
    if (live) {
      return mapLiveExperienceToProvider(live);
    }
    return undefined;
  }

  getDateSlot(experience: ProviderExperience, date: string): ExperienceDateSlot | undefined {
    return experience.dateSlots?.find((s) => s.date === date);
  }

  capacityForDate(experience: ProviderExperience, date: string): number {
    const slot = this.getDateSlot(experience, date);
    if (slot?.unlimited) return 999;
    return slot?.capacity ?? experience.capacityPerDate ?? 12;
  }

  isDateClosed(experience: ProviderExperience, date: string): boolean {
    const slot = this.getDateSlot(experience, date);
    return Boolean(slot?.closed);
  }

  reservedSeats(experienceId: string, date: string): number {
    const cutoffIso = new Date(Date.now() - MP_PENDING_HOLD_MS).toISOString();
    return this._submissions()
      .filter((s) => {
        if (s.experienceId !== experienceId || s.date !== date || s.status === 'rechazado') {
          return false;
        }
        // Excluir reservas pendientes de Mercado Pago expiradas (> 30 min) para no retener cupos innecesariamente
        const isMp =
          s.paymentMethod === 'mercadopago' ||
          Boolean(s.mpPaymentId) ||
          s.receipt?.provider === 'mercadopago';
        if (s.status === 'pendiente' && isMp && s.submittedAt && s.submittedAt < cutoffIso) {
          return false;
        }
        return true;
      })
      .reduce((total, s) => total + s.participants, 0);
  }

  availableSeats(experience: ProviderExperience, date: string): number {
    if (this.isDateClosed(experience, date)) return 0;
    const capacity = this.capacityForDate(experience, date);
    if (capacity >= 999) return 999;
    return Math.max(0, capacity - this.reservedSeats(experience.id, date));
  }

  /**
   * Retorna sólo las fechas vigentes (a partir de hoy) que no estén cerradas.
   */
  getUpcomingDates(experience: ProviderExperience): string[] {
    const today = new Date().toISOString().split('T')[0];
    return (experience.dates || [])
      .filter((d) => d >= today && !this.isDateClosed(experience, d))
      .sort();
  }

  submissionsFor(experienceId: string): TransferSubmission[] {
    return this._submissions().filter((s) => s.experienceId === experienceId);
  }

  totalEnrolledInExperience(experienceId: string): number {
    return this._submissions()
      .filter((s) => s.experienceId === experienceId && s.status !== 'rechazado')
      .reduce((total, s) => total + s.participants, 0);
  }

  canDeleteExperience(experienceId: string): {
    allowed: boolean;
    reason?: string;
    enrolledCount: number;
  } {
    const submissions = this.submissionsFor(experienceId);
    const nonRejected = submissions.filter((s) => s.status !== 'rechazado');
    const enrolledCount = nonRejected.reduce((sum, s) => sum + s.participants, 0);

    if (submissions.length > 0 || enrolledCount > 0) {
      return {
        allowed: false,
        enrolledCount,
        reason: `No podés eliminar esta experiencia porque cuenta con ${enrolledCount} socio(s) inscripto(s) o pagos registrados. Si no deseás recibir más reservas, podés solicitar ocultarla.`,
      };
    }
    return { allowed: true, enrolledCount: 0 };
  }

  createExperience(input: NewProviderExperience, requestPublication = false): ProviderExperience {
    const provider = this._currentProvider() || SEED_PROVIDERS[0];
    const baseSlug = slugify(input.title) || 'experiencia';
    let slug = baseSlug;
    let suffix = 2;
    while (this._experiences().some((e) => e.slug === slug)) {
      slug = `${baseSlug}-${suffix++}`;
    }

    const experience: ProviderExperience = {
      ...input,
      id: `exp-${crypto.randomUUID()}`,
      slug,
      providerId: provider.id,
      providerName: provider.agency || provider.name,
      dates: [...input.dates].sort(),
      status: requestPublication ? 'pendiente_publicacion' : 'borrador',
      moderation: requestPublication
        ? {
            action: 'publicar',
            requestedAt: new Date().toISOString(),
            status: 'pendiente',
          }
        : undefined,
      coverImage: input.coverImage || '/assets/images/laguna_blanca.jpg',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this._experiences.update((list) => [experience, ...list]);
    this.saveExperiences();
    return experience;
  }

  updateExperience(
    id: string,
    updates: Partial<Omit<ProviderExperience, 'id' | 'createdAt' | 'providerId'>>,
  ): ProviderExperience {
    let updatedExperience: ProviderExperience | undefined;
    this._experiences.update((list) =>
      list.map((e) => {
        if (e.id !== id && e.slug !== id) return e;
        updatedExperience = {
          ...e,
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        return updatedExperience;
      }),
    );

    if (!updatedExperience) {
      const live = this.expService.getExperienceById(id) || this.expService.getExperienceBySlug(id);
      if (live) {
        const mapped = mapLiveExperienceToProvider(live);
        updatedExperience = {
          ...mapped,
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        this._experiences.update((list) => [...list, updatedExperience!]);
      } else {
        throw new Error('Experiencia no encontrada.');
      }
    }

    this.saveExperiences();
    return updatedExperience;
  }

  async saveExperienceChanges(
    id: string,
    updates: Partial<Omit<ProviderExperience, 'id' | 'createdAt' | 'providerId'>>,
  ): Promise<ProviderExperience> {
    const snapshot = this._experiences();
    const updated = this.updateExperience(id, updates);
    const expMatch =
      this.expService.getExperienceById(id) || this.expService.getExperienceBySlug(updated.slug);
    if (expMatch) {
      try {
        await this.expService.updateExperience({
          id: expMatch.id,
          title: updated.title,
          tagline: updated.tagline,
          description: updated.description,
          region: updated.region,
          meetingPoint: updated.meetingPoint,
          difficulty: updated.difficulty,
          durationLabel: updated.durationLabel,
          priceArs: updated.priceArs,
          maxSpotsPerGroup: updated.capacityPerDate,
          dates: updated.dates,
          coverImage: updated.coverImage,
        });
      } catch (err) {
        this._experiences.set(snapshot);
        this.saveExperiences();
        throw err;
      }
    }
    return updated;
  }

  addDateToExperience(
    experienceId: string,
    date: string,
    options?: { capacity?: number; unlimited?: boolean; note?: string },
  ): boolean {
    const exp = this.getExperienceById(experienceId);
    if (!exp) return false;
    const currentDates = exp.dates || [];
    if (currentDates.includes(date)) return false;
    const newDates = [...currentDates, date].sort();

    const expMatch =
      this.expService.getExperienceById(experienceId) ||
      this.expService.getExperienceBySlug(exp.slug);
    const baseSlots = expMatch?.dateSlots ?? exp.dateSlots ?? [];
    const currentSlots = [...baseSlots];
    if (options?.capacity || options?.unlimited || options?.note) {
      const idx = currentSlots.findIndex((s) => s.date === date);
      const newSlot: ExperienceDateSlot = {
        date,
        capacity: options.capacity,
        unlimited: options.unlimited,
        note: options.note,
        closed: false,
      };
      if (idx >= 0) {
        currentSlots[idx] = { ...currentSlots[idx], ...newSlot };
      } else {
        currentSlots.push(newSlot);
      }
    }

    const prevExperiences = this._experiences();
    this.updateExperience(experienceId, { dates: newDates, dateSlots: currentSlots });

    // Sincronizar con el catálogo público en ExperienceService
    if (expMatch) {
      void this.expService
        .updateExperience({
          id: expMatch.id,
          dates: newDates,
          dateSlots: currentSlots,
        })
        .catch((err) => {
          console.warn(
            '[ProviderStoreService] Error sincronizando fecha con ExperienceService:',
            err,
          );
          this._experiences.set(prevExperiences);
          this.saveExperiences();
        });
    }

    return true;
  }

  toggleDateStatus(experienceId: string, date: string): boolean {
    const exp = this.getExperienceById(experienceId);
    if (!exp) return false;
    const expMatch =
      this.expService.getExperienceById(experienceId) ||
      this.expService.getExperienceBySlug(exp.slug);
    const baseSlots = expMatch?.dateSlots ?? exp.dateSlots ?? [];
    const currentSlots = [...baseSlots];
    const existingIndex = currentSlots.findIndex((s) => s.date === date);

    if (existingIndex >= 0) {
      currentSlots[existingIndex] = {
        ...currentSlots[existingIndex],
        closed: !currentSlots[existingIndex].closed,
      };
    } else {
      currentSlots.push({
        date,
        closed: true,
      });
    }

    const prevExperiences = this._experiences();
    this.updateExperience(experienceId, { dateSlots: currentSlots });

    if (expMatch) {
      void this.expService
        .updateExperience({
          id: expMatch.id,
          dateSlots: currentSlots,
        })
        .catch((err) => {
          console.warn(
            '[ProviderStoreService] Error sincronizando slot con ExperienceService:',
            err,
          );
          this._experiences.set(prevExperiences);
          this.saveExperiences();
        });
    }

    return true;
  }

  updateDateSlot(
    experienceId: string,
    date: string,
    slotData: Partial<ExperienceDateSlot>,
  ): boolean {
    const exp = this.getExperienceById(experienceId);
    if (!exp) return false;
    const expMatch =
      this.expService.getExperienceById(experienceId) ||
      this.expService.getExperienceBySlug(exp.slug);
    const baseSlots = expMatch?.dateSlots ?? exp.dateSlots ?? [];
    const currentSlots = [...baseSlots];
    const idx = currentSlots.findIndex((s) => s.date === date);

    if (idx >= 0) {
      currentSlots[idx] = { ...currentSlots[idx], ...slotData };
    } else {
      currentSlots.push({ date, ...slotData });
    }

    const prevExperiences = this._experiences();
    this.updateExperience(experienceId, { dateSlots: currentSlots });

    if (expMatch) {
      void this.expService
        .updateExperience({
          id: expMatch.id,
          dateSlots: currentSlots,
        })
        .catch((err) => {
          console.warn(
            '[ProviderStoreService] Error sincronizando slot con ExperienceService:',
            err,
          );
          this._experiences.set(prevExperiences);
          this.saveExperiences();
        });
    }

    return true;
  }

  removeDateFromExperience(experienceId: string, date: string): boolean {
    const exp = this.getExperienceById(experienceId);
    if (!exp) return false;
    if (this.reservedSeats(experienceId, date) > 0) {
      return false;
    }
    const expMatch =
      this.expService.getExperienceById(experienceId) ||
      this.expService.getExperienceBySlug(exp.slug);
    const baseSlots = expMatch?.dateSlots ?? exp.dateSlots ?? [];
    const newDates = (exp.dates || []).filter((d) => d !== date);
    const newSlots = baseSlots.filter((s) => s.date !== date);

    const prevExperiences = this._experiences();
    this.updateExperience(experienceId, { dates: newDates, dateSlots: newSlots });

    // Sincronizar con el catálogo público en ExperienceService
    if (expMatch) {
      void this.expService
        .updateExperience({
          id: expMatch.id,
          dates: newDates,
          dateSlots: newSlots,
        })
        .catch((err) => {
          console.warn(
            '[ProviderStoreService] Error sincronizando eliminación con ExperienceService:',
            err,
          );
          this._experiences.set(prevExperiences);
          this.saveExperiences();
        });
    }

    return true;
  }

  getExperienceAlbum(experienceId: string): ExperienceAlbumPhoto[] {
    const exp = this.getExperienceById(experienceId);
    return exp?.albumPhotos ? [...exp.albumPhotos] : [];
  }

  updateExperienceAlbum(experienceId: string, photos: ExperienceAlbumPhoto[]): ProviderExperience {
    if (photos.length > 12) {
      throw new Error('El álbum no puede superar el límite de 12 fotos.');
    }

    const currentProvider = this._currentProvider();
    const existingExp = this.getExperienceById(experienceId);
    if (!existingExp) {
      throw new Error('Experiencia no encontrada.');
    }
    if (
      currentProvider &&
      existingExp.providerId &&
      existingExp.providerId !== currentProvider.id
    ) {
      throw new Error('No tenés permisos para modificar el álbum de esta experiencia.');
    }

    const coverPhoto = photos.find((p) => p.isCover);
    const coverUrl = coverPhoto?.url;

    const updates: Partial<ProviderExperience> = {
      albumPhotos: photos,
      ...(coverUrl ? { coverImage: coverUrl } : {}),
    };

    const prevExperiences = this._experiences();
    const updated = this.updateExperience(experienceId, updates);

    // Sincronizar con el catálogo público en ExperienceService
    const expMatch =
      this.expService.getExperienceById(experienceId) ||
      this.expService.getExperienceBySlug(updated.slug);
    if (expMatch) {
      void this.expService
        .updateExperience({
          id: expMatch.id,
          coverImage: coverUrl || expMatch.coverImage,
          albumPhotos: photos,
        })
        .catch((err) => {
          console.warn(
            '[ProviderStoreService] Error sincronizando álbum a ExperienceService:',
            err,
          );
          this._experiences.set(prevExperiences);
          this.saveExperiences();
        });
    }

    return updated;
  }

  /**
   * Request Publication: Prestador requests the admin to review and publish the experience
   */
  requestPublish(experienceId: string): void {
    const experience = this.getExperienceById(experienceId);
    if (!experience) return;
    if (experience.dates.length === 0) {
      throw new Error('Debés cargar al menos una fecha futura antes de solicitar publicación.');
    }

    this._experiences.update((list) =>
      list.map((e) =>
        e.id === experienceId
          ? {
              ...e,
              status: 'pendiente_publicacion',
              moderation: {
                action: 'publicar',
                requestedAt: new Date().toISOString(),
                status: 'pendiente',
              },
              updatedAt: new Date().toISOString(),
            }
          : e,
      ),
    );
    this.saveExperiences();
  }

  /**
   * Request Hide: Prestador requests the admin to hide/pause a published experience
   */
  requestHide(experienceId: string, reason?: string): void {
    this._experiences.update((list) =>
      list.map((e) =>
        e.id === experienceId
          ? {
              ...e,
              status: 'pendiente_ocultar',
              moderation: {
                action: 'ocultar',
                requestedAt: new Date().toISOString(),
                reason: reason?.trim(),
                status: 'pendiente',
              },
              updatedAt: new Date().toISOString(),
            }
          : e,
      ),
    );
    this.saveExperiences();
  }

  /**
   * Request Delete: Only allowed if 0 people are enrolled
   */
  requestDelete(experienceId: string, reason?: string): void {
    const check = this.canDeleteExperience(experienceId);
    if (!check.allowed) {
      throw new Error(check.reason);
    }

    this._experiences.update((list) =>
      list.map((e) =>
        e.id === experienceId
          ? {
              ...e,
              status: 'pendiente_eliminar',
              moderation: {
                action: 'eliminar',
                requestedAt: new Date().toISOString(),
                reason: reason?.trim(),
                status: 'pendiente',
              },
              updatedAt: new Date().toISOString(),
            }
          : e,
      ),
    );
    this.saveExperiences();
  }

  /**
   * Set status directly (backward compatibility)
   */
  setExperienceStatus(experienceId: string, status: ProviderExperience['status']): void {
    this._experiences.update((list) =>
      list.map((e) => (e.id === experienceId ? { ...e, status } : e)),
    );
    this.saveExperiences();
  }

  /**
   * Admin Moderation Simulation / Execution:
   * Approves the pending request (publish, hide, delete)
   */
  adminApproveAction(
    experienceId: string,
    adminComment = 'Aprobado por el equipo editorial',
  ): void {
    const exp = this.getExperienceById(experienceId);
    if (!exp || !exp.moderation) return;

    if (exp.moderation.action === 'eliminar') {
      // Actually remove experience
      this._experiences.update((list) => list.filter((e) => e.id !== experienceId));
      this.saveExperiences();
      return;
    }

    const newStatus = exp.moderation.action === 'publicar' ? 'publicada' : 'oculta';

    this._experiences.update((list) =>
      list.map((e) =>
        e.id === experienceId
          ? {
              ...e,
              status: newStatus,
              moderation: {
                ...e.moderation!,
                status: 'aprobada',
                reviewedAt: new Date().toISOString(),
                reviewedBy: 'Admin experiencias.club',
                adminComment,
              },
              updatedAt: new Date().toISOString(),
            }
          : e,
      ),
    );
    this.saveExperiences();
  }

  /**
   * Admin Moderation Simulation / Execution: Rejects pending request
   */
  adminRejectAction(experienceId: string, adminComment: string): void {
    this._experiences.update((list) =>
      list.map((e) => {
        if (e.id !== experienceId || !e.moderation) return e;
        // Revert to draft or published depending on action
        const revertStatus = e.moderation.action === 'publicar' ? 'borrador' : 'publicada';
        return {
          ...e,
          status: revertStatus,
          moderation: {
            ...e.moderation,
            status: 'rechazada',
            reviewedAt: new Date().toISOString(),
            reviewedBy: 'Admin experiencias.club',
            adminComment,
          },
          updatedAt: new Date().toISOString(),
        };
      }),
    );
    this.saveExperiences();
  }

  // ==========================================
  // Submissions & Receipts
  // ==========================================
  async submitTransfer(input: NewTransferSubmission): Promise<TransferSubmission> {
    const liveRecord =
      this.expService.getExperienceById(input.experienceId) ||
      this.expService.getExperienceBySlug(input.experienceId);
    let experience: ProviderExperience | undefined;
    if (liveRecord) {
      if (liveRecord.status === 'publicada') {
        experience = mapLiveExperienceToProvider(liveRecord);
      }
    } else {
      experience = this._experiences().find(
        (e) => e.id === input.experienceId || e.slug === input.experienceId,
      );
    }
    if (!experience || experience.status !== 'publicada') {
      throw new Error('La experiencia no está disponible.');
    }
    if (
      experience.dates.length > 0 &&
      !experience.dates.includes(input.date) &&
      input.date !== 'A coordinar'
    ) {
      throw new Error('La fecha elegida no está disponible.');
    }
    if (input.date !== 'A coordinar' && this.isDateClosed(experience, input.date)) {
      throw new Error('La fecha elegida se encuentra cerrada para nuevas reservas.');
    }
    if (
      !Number.isInteger(input.participants) ||
      input.participants < 1 ||
      input.participants > MAX_PARTICIPANTS_PER_BOOKING
    ) {
      throw new Error('Cantidad de personas inválida.');
    }
    // Liberar reservas pendientes de Mercado Pago expiradas (> 30 min) antes de validar cupos disponibles
    await this.releaseExpiredMercadoPagoPending(experience.id, input.date);

    if (
      experience.dates.length > 0 &&
      input.date !== 'A coordinar' &&
      input.participants > this.availableSeats(experience, input.date)
    ) {
      throw new Error('No quedan cupos suficientes para esa fecha.');
    }
    const fileError = validateReceiptFile(input.receiptFile);
    if (fileError) {
      throw new Error(fileError);
    }
    const discount = input.discountCode
      ? (findDiscountCode(input.discountCode) ??
        this.newsletter.findMemberDiscount(input.discountCode))
      : undefined;
    if (input.discountCode && !discount) {
      throw new Error('El código de descuento no es válido.');
    }
    const subtotal = experience.priceArs * input.participants;
    const discountArs = discountAmount(subtotal, discount);
    const amountArs = subtotal - discountArs;
    const ref = this.buildReference(experience.slug);

    const uploadRes = await this.storageService.uploadReceipt(input.receiptFile, ref);
    let receiptUrl = uploadRes.url;
    const storageKey = uploadRes.storageKey;
    const storageProvider = uploadRes.provider;

    if (isSupabaseConfigured()) {
      try {
        const { data: rpcRes, error: rpcErr } = await this.supabase.rpc(
          'submit_experience_transfer' as any,
          {
            p_reference: ref,
            p_experience_id: experience.id,
            p_experience_title: experience.title,
            p_date: input.date,
            p_participants: input.participants,
            p_amount_ars: amountArs,
            p_discount_code: discount?.code || null,
            p_discount_ars: discountArs,
            p_full_name: input.fullName.trim(),
            p_email: input.email.trim().toLowerCase(),
            p_dni: input.dni.trim(),
            p_phone: input.phone.trim(),
            p_receipt_file_name: input.receiptFile.name,
            p_receipt_mime_type: input.receiptFile.type || 'image/jpeg',
            p_receipt_size_bytes: input.receiptFile.size,
            p_receipt_url: receiptUrl,
            p_receipt_storage_key: storageKey || null,
            p_receipt_storage_provider: storageProvider,
          },
        );

        const rpcPayload = rpcRes as any;
        if (rpcErr) {
          console.warn('[ProviderStore] Error en submit_experience_transfer RPC:', rpcErr);
          throw new Error(
            'No se pudo registrar la transferencia en el servidor. Intentá de nuevo.',
          );
        }

        if (rpcPayload?.status === 'invalid_date') {
          throw new Error('La fecha elegida no está disponible.');
        }
        if (rpcPayload?.status === 'date_closed') {
          throw new Error('La fecha elegida se encuentra cerrada para nuevas reservas.');
        }
        if (rpcPayload?.status === 'invalid_amount') {
          throw new Error('El importe transferido no coincide con el total esperado.');
        }
        if (rpcPayload?.status === 'no_seats_available') {
          throw new Error('No quedan cupos suficientes para esa fecha.');
        }
        if (rpcPayload?.status === 'invalid_input') {
          throw new Error('Los datos ingresados no son válidos.');
        }
      } catch (err: any) {
        if (
          err?.message?.includes('cupos') ||
          err?.message?.includes('válidos') ||
          err?.message?.includes('servidor') ||
          err?.message?.includes('cerrada') ||
          err?.message?.includes('importe') ||
          err?.message?.includes('disponible')
        ) {
          throw err;
        }
        console.warn('[ProviderStore] Fallo al subir comprobante a Supabase:', err);
        throw err;
      }
    }

    if (!receiptUrl && typeof window !== 'undefined') {
      receiptUrl = URL.createObjectURL(input.receiptFile);
    }

    const submission: TransferSubmission = {
      id: `sub-${crypto.randomUUID()}`,
      reference: ref,
      experienceId: experience.id,
      experienceTitle: experience.title,
      date: input.date,
      participants: input.participants,
      amountArs,
      ...(discount ? { discountCode: discount.code, discountArs } : {}),
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      dni: input.dni.trim(),
      phone: input.phone.trim(),
      receipt: {
        fileName: input.receiptFile.name,
        mimeType: input.receiptFile.type,
        sizeBytes: input.receiptFile.size,
        url: receiptUrl,
        storageKey,
        provider: storageProvider,
      },
      status: 'pendiente',
      submittedAt: new Date().toISOString(),
    };

    if (!isSupabaseConfigured()) {
      this._submissions.update((list) => [submission, ...list]);
      this.saveSubmissions();
    }

    if (submission.discountCode) {
      this.newsletter.markMemberDiscountUsed(
        submission.discountCode,
        submission.reference,
        experience.title,
      );
    }
    this.recordMemberActivity(experience, submission);
    const provider = experience.providerId
      ? this.getProviderById(experience.providerId)
      : undefined;
    const targetProviderEmail = provider?.email || PROVIDER_CONTACT_EMAIL;
    const targetProviderPhone = provider?.phone || '';
    this.emails.notifyReceiptReceived(submission, targetProviderEmail, targetProviderPhone);
    this.emails.notifyProviderNewReceipt(submission, targetProviderEmail);
    return submission;
  }

  recordConfirmedBooking(submission: TransferSubmission): void {
    this._submissions.update((list) => {
      const idx = list.findIndex(
        (s) =>
          s.reference === submission.reference ||
          (submission.mpPaymentId && s.mpPaymentId === submission.mpPaymentId),
      );
      if (idx >= 0) {
        const copy = [...list];
        copy[idx] = submission;
        return copy;
      }
      return [submission, ...list];
    });
    this.saveSubmissions();
  }

  /**
   * Libera una reserva pendiente de Mercado Pago por cancelación o rechazo,
   * actualizando tanto el estado local como la fila persistida en Supabase a 'rechazado'.
   * Garantiza no alterar reservas que ya estén en estado pagado ('aprobado') o rechazado.
   */
  async releaseMercadoPagoPending(
    reference: string,
    reason: string = 'cancelado_checkout',
  ): Promise<boolean> {
    if (!reference) return false;

    // 1. Actualizar el registro local en _submissions sólo si está 'pendiente'
    let updatedLocal = false;
    this._submissions.update((list) =>
      list.map((s) => {
        if (s.reference === reference && s.status === 'pendiente') {
          updatedLocal = true;
          return {
            ...s,
            status: 'rechazado',
            rejectionReason: reason,
          };
        }
        return s;
      }),
    );
    if (updatedLocal) {
      this.saveSubmissions();
    }

    // 2. Actualizar en Supabase garantizando no modificar reservas aprobadas o ya rechazadas
    if (isSupabaseConfigured()) {
      try {
        const { error } = await (this.supabase.from('pagos_transferencias') as any)
          .update({
            status: 'rechazado',
            rejection_reason: reason,
            reviewed_by: 'mercadopago_checkout_release',
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('reference', reference)
          .eq('status', 'pendiente');

        if (error) {
          console.warn('[ProviderStore] Error liberando reserva pendiente MP en Supabase:', error);
          return false;
        }
      } catch (err) {
        console.warn('[ProviderStore] Excepción al liberar reserva pendiente MP:', err);
        return false;
      }
    }

    return true;
  }

  /**
   * Libera reservas pendientes de Mercado Pago que hayan expirado tras superar
   * el tiempo de retención (30 minutos) sin completarse, liberando los cupos correspondientes.
   */
  async releaseExpiredMercadoPagoPending(
    experienceId?: string,
    selectedDate?: string,
  ): Promise<number> {
    const cutoffIso = new Date(Date.now() - MP_PENDING_HOLD_MS).toISOString();

    let releasedCount = 0;
    this._submissions.update((list) =>
      list.map((s) => {
        const isMp =
          s.paymentMethod === 'mercadopago' ||
          Boolean(s.mpPaymentId) ||
          s.receipt?.provider === 'mercadopago';
        const isExpired = s.submittedAt && s.submittedAt < cutoffIso;
        const matchesExp = !experienceId || s.experienceId === experienceId;
        const matchesDate = !selectedDate || s.date === selectedDate;

        if (s.status === 'pendiente' && isMp && isExpired && matchesExp && matchesDate) {
          releasedCount++;
          return {
            ...s,
            status: 'rechazado',
            rejectionReason: 'expirado_checkout_abandonado',
          };
        }
        return s;
      }),
    );
    if (releasedCount > 0) {
      this.saveSubmissions();
    }

    if (isSupabaseConfigured()) {
      try {
        let query = (this.supabase.from('pagos_transferencias') as any)
          .update({
            status: 'rechazado',
            rejection_reason: 'expirado_checkout_abandonado',
            reviewed_by: 'mercadopago_auto_expiry',
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('status', 'pendiente')
          .eq('receipt_storage_provider', 'mercadopago')
          .lt('created_at', cutoffIso);

        if (experienceId) {
          query = query.eq('experience_id', experienceId);
        }
        if (selectedDate && selectedDate !== 'A coordinar') {
          query = query.eq('selected_date', selectedDate);
        }

        const { error } = await query;
        if (error) {
          console.warn('[ProviderStore] Error liberando reservas expiradas en Supabase:', error);
        }
      } catch (err) {
        console.warn('[ProviderStore] Excepción al liberar reservas expiradas:', err);
      }
    }

    return releasedCount;
  }

  async submitMercadoPagoPending(input: {
    experienceId: string;
    date: string;
    participants: number;
    amountArs: number;
    baseAmountArs: number;
    surchargeArs: number;
    discountCode?: string;
    discountArs?: number;
    fullName: string;
    email: string;
    dni: string;
    phone: string;
    reference: string;
  }): Promise<TransferSubmission> {
    const liveRecord =
      this.expService.getExperienceById(input.experienceId) ||
      this.expService.getExperienceBySlug(input.experienceId);
    let experience: ProviderExperience | undefined;
    if (liveRecord) {
      if (liveRecord.status === 'publicada') {
        experience = mapLiveExperienceToProvider(liveRecord);
      }
    } else {
      experience = this._experiences().find(
        (e) => e.id === input.experienceId || e.slug === input.experienceId,
      );
    }
    if (!experience || experience.status !== 'publicada') {
      throw new Error('La experiencia no está disponible.');
    }
    if (
      experience.dates.length > 0 &&
      !experience.dates.includes(input.date) &&
      input.date !== 'A coordinar'
    ) {
      throw new Error('La fecha elegida no está disponible.');
    }
    if (input.date !== 'A coordinar' && this.isDateClosed(experience, input.date)) {
      throw new Error('La fecha elegida se encuentra cerrada para nuevas reservas.');
    }
    if (
      !Number.isInteger(input.participants) ||
      input.participants < 1 ||
      input.participants > MAX_PARTICIPANTS_PER_BOOKING
    ) {
      throw new Error('Cantidad de personas inválida.');
    }
    // Liberar reservas pendientes de Mercado Pago expiradas (> 30 min) antes de validar cupos disponibles
    await this.releaseExpiredMercadoPagoPending(experience.id, input.date);

    if (
      experience.dates.length > 0 &&
      input.date !== 'A coordinar' &&
      input.participants > this.availableSeats(experience, input.date)
    ) {
      throw new Error('No quedan cupos suficientes para esa fecha.');
    }

    const discount = input.discountCode
      ? (findDiscountCode(input.discountCode) ??
        this.newsletter.findMemberDiscount(input.discountCode))
      : undefined;

    if (isSupabaseConfigured()) {
      const { data: rpcRes, error: rpcErr } = await this.supabase.rpc(
        'submit_experience_transfer' as any,
        {
          p_reference: input.reference,
          p_experience_id: experience.id,
          p_experience_title: experience.title,
          p_date: input.date,
          p_participants: input.participants,
          p_amount_ars: input.baseAmountArs,
          p_discount_code: discount?.code || null,
          p_discount_ars: input.discountArs || 0,
          p_full_name: input.fullName.trim(),
          p_email: input.email.trim().toLowerCase(),
          p_dni: input.dni.trim(),
          p_phone: input.phone.trim(),
          p_receipt_file_name: MP_TRANSFER_RECEIPT.fileName,
          p_receipt_mime_type: MP_TRANSFER_RECEIPT.mimeType,
          p_receipt_size_bytes: 0,
          p_receipt_url: MP_TRANSFER_RECEIPT.url,
          p_receipt_storage_key: input.reference,
          p_receipt_storage_provider: 'mercadopago',
        },
      );

      if (rpcErr) {
        console.warn('[ProviderStore] Error registrando reserva pendiente MP:', rpcErr);
        throw new Error('No se pudo registrar la reserva pendiente en el servidor.');
      }
      const rpcPayload = rpcRes as any;
      if (rpcPayload?.status === 'no_seats_available') {
        throw new Error('No quedan cupos suficientes para esa fecha.');
      }
      if (rpcPayload?.status === 'invalid_date') {
        throw new Error('La fecha elegida no está disponible.');
      }
      if (rpcPayload?.status === 'date_closed') {
        throw new Error('La fecha elegida se encuentra cerrada para nuevas reservas.');
      }
      if (rpcPayload?.status === 'invalid_amount') {
        throw new Error('El importe transferido no coincide con el total esperado.');
      }
      if (rpcPayload?.status === 'invalid_input') {
        throw new Error('Los datos ingresados no son válidos.');
      }
    }

    const submission: TransferSubmission = {
      id: `sub-${crypto.randomUUID()}`,
      reference: input.reference,
      experienceId: experience.id,
      experienceTitle: experience.title,
      date: input.date,
      participants: input.participants,
      amountArs: input.amountArs,
      ...(discount ? { discountCode: discount.code, discountArs: input.discountArs } : {}),
      surchargeArs: input.surchargeArs,
      paymentMethod: 'mercadopago',
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      dni: input.dni.trim(),
      phone: input.phone.trim(),
      receipt: MP_TRANSFER_RECEIPT,
      status: 'pendiente',
      submittedAt: new Date().toISOString(),
    };

    this._submissions.update((list) => [submission, ...list]);
    this.saveSubmissions();
    return submission;
  }

  async registerMercadoPagoPayment(input: MercadoPagoPaymentInput): Promise<TransferSubmission> {
    const liveRecord =
      this.expService.getExperienceById(input.experienceId) ||
      this.expService.getExperienceBySlug(input.experienceId);
    let experience: ProviderExperience | undefined;
    if (liveRecord) {
      if (liveRecord.status === 'publicada') {
        experience = mapLiveExperienceToProvider(liveRecord);
      }
    } else {
      experience = this._experiences().find(
        (e) => e.id === input.experienceId || e.slug === input.experienceId,
      );
    }

    const pendingRef = (input.reference || '').trim();
    const cleanCollectionId = input.collectionId.trim();
    const shortRef = cleanCollectionId.slice(-6).toUpperCase();
    const displayRef = `MP-${shortRef}`;
    const ref = pendingRef || `MP-${cleanCollectionId}`;

    // 1. Idempotencia: Verificar si ya existe en la lista de submissions local usando identificadores completos
    const existing = this._submissions().find(
      (s) =>
        (pendingRef && s.reference === pendingRef) ||
        s.reference === ref ||
        (s.mpPaymentId && s.mpPaymentId === cleanCollectionId),
    );
    if (existing) {
      if (existing.status === 'pendiente') {
        // Verificar o reintentar la persistencia remota antes de confirmar la reserva en caché
        let persistedOk = !isSupabaseConfigured();
        if (isSupabaseConfigured()) {
          try {
            const { data: updatedRows, error: updateErr } = await (this.supabase.from('pagos_transferencias') as any)
              .update({
                status: 'aprobado',
                receipt_storage_path: cleanCollectionId,
                reviewed_by: 'mercadopago_checkout',
                reviewed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .or(`reference.eq.${encodeURIComponent(existing.reference)},reference.eq.${encodeURIComponent(ref)},receipt_storage_path.eq.${encodeURIComponent(cleanCollectionId)}`)
              .select('id,status');

            if (!updateErr && updatedRows && updatedRows.length > 0) {
              persistedOk = true;
            } else {
              console.warn('[ProviderStore] No se pudo verificar la persistencia remota para la reserva en caché:', updateErr);
            }
          } catch (verifyErr) {
            console.warn('[ProviderStore] Error verificando persistencia de reserva en caché:', verifyErr);
          }
        }

        if (!persistedOk) {
          const reconciliationSubmission: TransferSubmission = {
            ...existing,
            status: 'pendiente',
            mpPaymentId: cleanCollectionId,
            rejectionReason: 'requiere_conciliacion',
          };
          this.recordConfirmedBooking(reconciliationSubmission);
          throw new Error(
            'El pago fue procesado pero no se pudo confirmar la persistencia de la reserva en el servidor. Requiere conciliación.',
          );
        }

        const updated: TransferSubmission = {
          ...existing,
          status: 'aprobado',
          mpPaymentId: cleanCollectionId,
          displayReference: existing.displayReference || displayRef,
          reviewedAt: new Date().toISOString(),
        };
        this.recordConfirmedBooking(updated);

        if (updated.discountCode) {
          this.newsletter.markMemberDiscountUsed(
            updated.discountCode,
            updated.reference,
            updated.experienceTitle,
          );
        }
        if (experience) {
          this.recordMemberActivity(experience, updated);
          const provider = experience.providerId
            ? this.getProviderById(experience.providerId)
            : undefined;
          const targetProviderEmail = provider?.email || PROVIDER_CONTACT_EMAIL;
          const targetProviderPhone = provider?.phone || '';
          this.emails.notifyReceiptReceived(updated, targetProviderEmail, targetProviderPhone);
          this.emails.notifyPaymentApproved(updated);
        }
        return updated;
      }
      return existing;
    }

    const expTitle = experience?.title || 'Experiencia en Catamarca';
    const participants = Math.max(1, Number(input.participants) || 1);
    const discount = input.discountCode
      ? (findDiscountCode(input.discountCode) ??
        this.newsletter.findMemberDiscount(input.discountCode))
      : undefined;

    const unitPrice =
      experience?.priceArs ??
      (input.baseAmountArs ? Math.round(input.baseAmountArs / participants) : Math.round(input.amountArs / participants));
    const subtotal = unitPrice * participants;
    const discountArs =
      input.discountArs !== undefined ? input.discountArs : discountAmount(subtotal, discount);
    const baseAmount =
      input.baseAmountArs !== undefined
        ? input.baseAmountArs
        : Math.max(0, subtotal - discountArs);
    const totalPaid =
      input.amountArs > 0 ? input.amountArs : baseAmount + (input.surchargeArs || 0);

    // 2. Persistencia en Supabase usando el flujo establecido y decremento de cupos
    let persistenceSuccess = !isSupabaseConfigured();

    if (isSupabaseConfigured()) {
      try {
        const filterConditions = [
          `reference.eq.${encodeURIComponent(ref)}`,
          `receipt_storage_path.eq.${encodeURIComponent(cleanCollectionId)}`,
        ];
        if (pendingRef && pendingRef !== ref) {
          filterConditions.push(`reference.eq.${encodeURIComponent(pendingRef)}`);
          filterConditions.push(`receipt_storage_path.eq.${encodeURIComponent(pendingRef)}`);
        }

        const { data: existingRows } = await this.supabase
          .from('pagos_transferencias')
          .select('*')
          .or(filterConditions.join(','))
          .limit(1);

        if (existingRows && existingRows.length > 0) {
          const row = existingRows[0] as any;

          // Reutilizar la fila pendiente existente actualizándola a aprobado en lugar de duplicarla
          if (row.status === 'pendiente') {
            const { error: upErr } = await (this.supabase.from('pagos_transferencias') as any)
              .update({
                status: 'aprobado',
                receipt_storage_path: cleanCollectionId,
                reviewed_by: 'mercadopago_checkout',
                reviewed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', row.id);

            if (upErr) {
              console.warn('[ProviderStore] Error actualizando fila pendiente existente:', upErr);
              throw new Error('Fallo al actualizar la reserva pendiente a aprobada en el servidor.');
            }
          }

          persistenceSuccess = true;

          const restored: TransferSubmission = {
            id: row.id ? `sub-${row.id}` : `mp-${cleanCollectionId}`,
            reference: row.reference || ref,
            displayReference:
              row.reference?.startsWith('MP-') && row.reference.length > 9
                ? `MP-${row.reference.slice(-6).toUpperCase()}`
                : displayRef,
            experienceId: row.experience_id || experience?.id || input.experienceId,
            experienceTitle: row.experience_title || expTitle,
            date: row.selected_date || row.date || input.date,
            participants: row.participants || participants,
            amountArs: totalPaid,
            discountCode: row.discount_code || discount?.code,
            discountArs: row.discount_ars || discountArs,
            surchargeArs: input.surchargeArs,
            paymentMethod: 'mercadopago',
            mpPaymentId: cleanCollectionId,
            fullName: row.full_name || input.fullName.trim(),
            email: row.email || input.email.trim().toLowerCase(),
            dni: row.dni || input.dni.trim(),
            phone: row.phone || input.phone.trim(),
            receipt: MP_TRANSFER_RECEIPT,
            status: 'aprobado',
            submittedAt: row.created_at || row.submitted_at || new Date().toISOString(),
            reviewedAt: row.reviewed_at || new Date().toISOString(),
          };

          this.recordConfirmedBooking(restored);

          if (restored.discountCode) {
            this.newsletter.markMemberDiscountUsed(
              restored.discountCode,
              restored.reference,
              restored.experienceTitle,
            );
          }
          if (experience) {
            this.recordMemberActivity(experience, restored);
            const provider = experience.providerId
              ? this.getProviderById(experience.providerId)
              : undefined;
            const targetProviderEmail = provider?.email || PROVIDER_CONTACT_EMAIL;
            const targetProviderPhone = provider?.phone || '';
            this.emails.notifyReceiptReceived(restored, targetProviderEmail, targetProviderPhone);
            this.emails.notifyPaymentApproved(restored);
          }

          return restored;
        }

        // Ejecutar el procedimiento almacenado submit_experience_transfer para validar y descontar cupos
        const { data: rpcRes, error: rpcErr } = await this.supabase.rpc(
          'submit_experience_transfer' as any,
          {
            p_reference: ref,
            p_experience_id: experience?.id || input.experienceId,
            p_experience_title: expTitle,
            p_date: input.date,
            p_participants: participants,
            p_amount_ars: baseAmount,
            p_discount_code: discount?.code || null,
            p_discount_ars: discountArs,
            p_full_name: input.fullName.trim(),
            p_email: input.email.trim().toLowerCase(),
            p_dni: input.dni.trim(),
            p_phone: input.phone.trim(),
            p_receipt_file_name: MP_TRANSFER_RECEIPT.fileName,
            p_receipt_mime_type: MP_TRANSFER_RECEIPT.mimeType,
            p_receipt_size_bytes: 0,
            p_receipt_url: MP_TRANSFER_RECEIPT.url,
            p_receipt_storage_key: cleanCollectionId,
            p_receipt_storage_provider: 'mercadopago',
          },
        );

        if (rpcErr) {
          console.warn('[ProviderStore] Error en submit_experience_transfer para MP:', rpcErr);
          persistenceSuccess = false;
        } else {
          const rpcPayload = rpcRes as any;
          if (rpcPayload?.status && rpcPayload.status !== 'created' && rpcPayload.status !== 'ok') {
            console.warn('[ProviderStore] Respuesta submit_experience_transfer para MP no exitosa:', rpcPayload);
            persistenceSuccess = false;
          } else {
            persistenceSuccess = true;
          }
        }
      } catch (dbErr) {
        console.warn('[ProviderStore] Excepción al persistir reserva MP en Supabase:', dbErr);
        persistenceSuccess = false;
      }
    }

    if (!persistenceSuccess) {
      // Dejar la reserva en estado 'pendiente' con requerimiento de conciliación sin marcar aprobada ni notificar
      const reconciliationSubmission: TransferSubmission = {
        id: `mp-${cleanCollectionId}`,
        reference: ref,
        displayReference: displayRef,
        experienceId: experience?.id || input.experienceId,
        experienceTitle: expTitle,
        date: input.date,
        participants,
        amountArs: totalPaid,
        ...(discount ? { discountCode: discount.code, discountArs } : {}),
        surchargeArs: input.surchargeArs,
        paymentMethod: 'mercadopago',
        mpPaymentId: cleanCollectionId,
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        dni: input.dni.trim(),
        phone: input.phone.trim(),
        receipt: MP_TRANSFER_RECEIPT,
        status: 'pendiente',
        rejectionReason: 'requiere_conciliacion',
        submittedAt: new Date().toISOString(),
      };

      this.recordConfirmedBooking(reconciliationSubmission);
      throw new Error(
        'El pago fue procesado en Mercado Pago pero ocurrió un error al asentar la reserva en el servidor. La reserva requiere conciliación.',
      );
    }

    const submission: TransferSubmission = {
      id: `mp-${cleanCollectionId}`,
      reference: ref,
      displayReference: displayRef,
      experienceId: experience?.id || input.experienceId,
      experienceTitle: expTitle,
      date: input.date,
      participants,
      amountArs: totalPaid,
      ...(discount ? { discountCode: discount.code, discountArs } : {}),
      surchargeArs: input.surchargeArs,
      paymentMethod: 'mercadopago',
      mpPaymentId: cleanCollectionId,
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      dni: input.dni.trim(),
      phone: input.phone.trim(),
      receipt: MP_TRANSFER_RECEIPT,
      status: 'aprobado',
      submittedAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
    };

    this._submissions.update((list) => {
      const idx = list.findIndex(
        (s) => s.reference === ref || (s.mpPaymentId && s.mpPaymentId === cleanCollectionId),
      );
      if (idx >= 0) {
        const copy = [...list];
        copy[idx] = submission;
        return copy;
      }
      return [submission, ...list];
    });
    this.saveSubmissions();

    if (submission.discountCode) {
      this.newsletter.markMemberDiscountUsed(
        submission.discountCode,
        submission.reference,
        submission.experienceTitle,
      );
    }
    if (experience) {
      this.recordMemberActivity(experience, submission);
      const provider = experience.providerId
        ? this.getProviderById(experience.providerId)
        : undefined;
      const targetProviderEmail = provider?.email || PROVIDER_CONTACT_EMAIL;
      const targetProviderPhone = provider?.phone || '';
      this.emails.notifyReceiptReceived(submission, targetProviderEmail, targetProviderPhone);
      this.emails.notifyPaymentApproved(submission);
    }

    return submission;
  }

  reviewSubmission(
    submissionId: string,
    status: Exclude<TransferStatus, 'pendiente'>,
    rejectionReason?: string,
  ): void {
    let reviewed: TransferSubmission | undefined;
    this._submissions.update((list) =>
      list.map((s) => {
        if (s.id !== submissionId) return s;
        reviewed = {
          ...s,
          status,
          rejectionReason:
            status === 'rechazado' ? rejectionReason?.trim() || undefined : undefined,
          reviewedAt: new Date().toISOString(),
        };
        return reviewed;
      }),
    );
    this.saveSubmissions();

    if (!reviewed) return;
    if (status === 'aprobado') {
      this.emails.notifyPaymentApproved(reviewed);
    } else {
      this.emails.notifyPaymentRejected(reviewed);
    }
  }

  async getSignedReceiptUrl(storageKey: string): Promise<string> {
    return this.storageService.getSignedReceiptUrl(storageKey);
  }

  private recordMemberActivity(
    experience: ProviderExperience,
    submission: TransferSubmission,
  ): void {
    const member = this.newsletter.currentMember();
    if (!member) return;

    const rawDate = submission.date?.trim();
    let dateLabel = rawDate || 'A coordinar';
    if (rawDate && rawDate.toLowerCase() !== 'a coordinar') {
      const parsed = new Date(`${rawDate}T12:00:00`);
      if (!isNaN(parsed.getTime())) {
        dateLabel = new Intl.DateTimeFormat('es-AR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(parsed);
      }
    }

    const isMp = submission.paymentMethod === 'mercadopago' || Boolean(submission.mpPaymentId);
    const isApprovedMp = submission.status === 'aprobado' && isMp;

    this.activities.addActivity({
      id: `act_${submission.id}`,
      slug: `${experience.slug}-${submission.reference.toLowerCase()}`,
      userId: member.id,
      experienceId: experience.id,
      title: experience.title,
      region: experience.region,
      altitude: experience.meetingPoint,
      coverImage: experience.coverImage || '/assets/images/laguna_blanca.jpg',
      dateLabel,
      status: isApprovedMp ? 'confirmada' : 'pendiente_pago',
      provider: {
        name: experience.shortTitle ?? experience.title,
        category: experience.difficulty,
        contactPhone: '',
      },
      receipt: {
        receiptNumber: isApprovedMp
          ? (submission.displayReference || submission.reference)
          : submission.reference,
        transactionId: isApprovedMp
          ? (submission.mpPaymentId || submission.id)
          : submission.id,
        gateway: isApprovedMp ? 'mercadopago' : 'custom',
        gatewayDisplayName: isApprovedMp ? 'Mercado Pago' : 'Transferencia bancaria',
        amountArs: submission.amountArs,
        amountUsd: 0,
        paidAt: new Date(
          isApprovedMp ? (submission.reviewedAt || submission.submittedAt) : submission.submittedAt,
        ).toLocaleString('es-AR'),
        paymentMethodSummary: isApprovedMp
          ? 'Mercado Pago · Pago acreditado online'
          : 'Transferencia a CBU · comprobante en revisión',
        payerEmail: submission.email,
        payerName: submission.fullName,
        authCode: isApprovedMp
          ? (submission.mpPaymentId || submission.reference)
          : submission.reference,
        status: isApprovedMp ? 'aprobado' : 'pendiente_verificacion',
        ...(submission.receipt?.url
          ? {
              receiptFileUrl: submission.receipt.url,
              receiptFileName: submission.receipt.fileName,
            }
          : {}),
        ...(submission.discountCode
          ? { discountCode: submission.discountCode, discountArs: submission.discountArs }
          : {}),
      },
      memoriesCount: 0,
      memoryPhotos: [],
    });
  }

  buildReference(slug: string): string {
    const prefix = slug.replace(/-/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const random = crypto.getRandomValues(new Uint32Array(4));
    const code = Array.from(random, (n) => alphabet[n % alphabet.length]).join('');
    return `${prefix}-${code}`;
  }

  // ==========================================
  // Persistence Helpers
  // ==========================================
  private sanitizeProvider(p: ProviderUser): ProviderUser {
    if (isClubProvider(p)) {
      return p;
    }
    if (p.cbuAlias === 'EXPERIENCIAS.CLUB.MP' || p.cuitDni === '20-33445566-7') {
      return {
        ...p,
        cbuAlias: p.cbuAlias === 'EXPERIENCIAS.CLUB.MP' ? '' : p.cbuAlias,
        cuitDni: p.cuitDni === '20-33445566-7' ? '' : p.cuitDni,
        bankName: p.bankName === 'Banco Nación / Mercado Pago' ? '' : p.bankName,
      };
    }
    return p;
  }

  private loadStoredProviders(): ProviderUser[] {
    if (typeof window === 'undefined') return SEED_PROVIDERS;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.providers);
      if (!raw) return SEED_PROVIDERS;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return SEED_PROVIDERS;
      return list.map((p) => this.sanitizeProvider(p));
    } catch {
      return SEED_PROVIDERS;
    }
  }

  private loadStoredSession(): ProviderUser | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.session);
      return raw ? this.sanitizeProvider(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  private loadStoredExperiences(): ProviderExperience[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.experiences);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private loadStoredSubmissions(): TransferSubmission[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.submissions);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((s) => s && !['sub-1', 'sub-2', 'sub-3'].includes(s.id))
        .map((s) => ({
          ...s,
          amountArs: Number(s.amountArs) || 0,
          status:
            s.status === 'aprobado'
              ? ('aprobado' as const)
              : s.status === 'rechazado'
                ? ('rechazado' as const)
                : ('pendiente' as const),
        }));
    } catch {
      return [];
    }
  }

  private saveProviders(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.providers, JSON.stringify(this._providers()));
    } catch {
      // quota
    }
  }

  private saveSession(provider: ProviderUser | null): void {
    if (typeof window === 'undefined') return;
    try {
      if (provider) {
        const sanitized: Record<string, any> = { ...provider };
        delete sanitized['mp_access_token'];
        delete sanitized['mp_refresh_token'];
        delete sanitized['mpAccessToken'];
        delete sanitized['mpRefreshToken'];
        if (sanitized['notes']) {
          try {
            const parsed = JSON.parse(sanitized['notes']);
            if (parsed && typeof parsed === 'object') {
              delete parsed.mp_access_token;
              delete parsed.mp_refresh_token;
              sanitized['notes'] = JSON.stringify(parsed);
            }
          } catch {
            // ignore
          }
        }
        localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(sanitized));
      } else {
        localStorage.removeItem(STORAGE_KEYS.session);
      }
    } catch {
      // quota
    }
  }

  private saveExperiences(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.experiences, JSON.stringify(this._experiences()));
    } catch {
      // quota
    }
  }

  private saveSubmissions(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.submissions, JSON.stringify(this._submissions()));
    } catch {
      // quota
    }
  }

  async submitExperienceRequest(
    data: Omit<ExperienceProposalRequest, 'id' | 'status' | 'createdAt'>,
  ): Promise<ExperienceProposalRequest> {
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'req-' + Date.now();
    const idSuffix = id.replace(/[^a-z0-9]/gi, '').slice(-8).toLowerCase() || 'prop';
    const rawSlug = slugify(data.title || '');
    const baseSlug = rawSlug || 'experiencia';
    const generatedSlug = `${baseSlug}-${idSuffix}`;

    const newReq: ExperienceProposalRequest = {
      ...data,
      id,
      slug: (data as any).slug || generatedSlug,
      status: 'pendiente',
      createdAt: new Date().toISOString(),
    };
    this._experienceRequests.update((list) => [newReq, ...list]);
    this.saveRequests();

    // Persistir en Supabase en tabla unificada experiencias (status: 'pendiente')
    if (isSupabaseConfigured()) {
      try {
        const unifiedExpPayload: Record<string, any> = {
          id: newReq.id,
          slug: newReq.slug || generatedSlug,
          title: newReq.title,
          kicker: newReq.kicker || 'EXPERIENCIA',
          tagline: newReq.subheading || '',
          description: newReq.subheading || '',
          region: newReq.region || 'Valle Central y Ambato',
          meeting_point: newReq.meetingPoint || '',
          meeting_point_url: newReq.meetingPointUrl || '',
          difficulty: (newReq.difficulty || 'Moderada').split('(')[0].trim() || 'Moderada',
          duration_label: newReq.duration || '4 horas',
          price_ars: newReq.priceArs,
          price_usd: newReq.priceUsd || null,
          capacity_per_date: newReq.capacity || 12,
          best_season: newReq.season || 'Todo el año',
          dates: newReq.dates ? [newReq.dates] : [],
          itinerary: newReq.itinerary || '',
          highlights: (newReq.participantRequirements || '')
            .split('\n')
            .map((s: string) => s.trim())
            .filter(Boolean),
          included: (newReq.includedServices || '')
            .split('\n')
            .map((s: string) => s.trim())
            .filter(Boolean),
          cover_image: newReq.coverImage || '/assets/images/kayak-club-de-experiencias.jpg',
          cover_image_name: newReq.coverImageName || '',
          video_url: newReq.coverVideoUrl || '',
          album_photos: newReq.albumPhotos || [],
          provider_name: newReq.providerName,
          provider_agency: newReq.providerAgency || '',
          provider_email: (newReq.providerEmail || '').toLowerCase(),
          provider_phone: newReq.providerPhone || '',
          participant_requirements: newReq.participantRequirements || '',
          notes: newReq.notes || '',
          status: 'pendiente',
        };

        const { error: insErr } = await (this.supabase.from('experiencias') as any).upsert(
          unifiedExpPayload,
          { onConflict: 'id' },
        );

        if (insErr) {
          console.warn('[ProviderStore] Error guardando propuesta en experiencias:', insErr);
          this._experienceRequests.update((list) => list.filter((r) => r.id !== newReq.id));
          this.saveRequests();
          throw insErr;
        }

        // Persistir identificadores bancarios de forma aislada en prestadores (protegido por RLS)
        const targetEmail = (newReq.providerEmail || '').trim().toLowerCase();
        if (
          targetEmail &&
          (newReq.providerCbuAlias || newReq.providerCuitDni || newReq.providerBankName)
        ) {
          const bankingPayload: Record<string, any> = {};
          if (newReq.providerCbuAlias) bankingPayload['cbu_alias'] = newReq.providerCbuAlias.trim();
          if (newReq.providerCuitDni) bankingPayload['cuit_dni'] = newReq.providerCuitDni.trim();
          if (newReq.providerBankName) bankingPayload['bank_name'] = newReq.providerBankName.trim();

          try {
            const { data: updatedRows, error: upErr } = await (this.supabase.from('prestadores') as any)
              .update(bankingPayload)
              .eq('email', targetEmail)
              .select('email');

            if (!upErr && (!updatedRows || updatedRows.length === 0)) {
              await (this.supabase.from('prestadores') as any).insert({
                email: targetEmail,
                name: newReq.providerName || targetEmail.split('@')[0],
                agency: newReq.providerAgency || '',
                phone: newReq.providerPhone || '',
                cbu_alias: newReq.providerCbuAlias?.trim() || '',
                cuit_dni: newReq.providerCuitDni?.trim() || '',
                bank_name: newReq.providerBankName?.trim() || '',
                active: false,
                status: 'pendiente',
              });
            }
          } catch (pErr) {
            console.warn('[ProviderStore] Error persistiendo datos bancarios en prestadores:', pErr);
          }
        }
      } catch (dbErr) {
        console.warn('[ProviderStore] Error al guardar propuesta en base de datos:', dbErr);
        this._experienceRequests.update((list) => list.filter((r) => r.id !== newReq.id));
        this.saveRequests();
        throw dbErr;
      }
    }

    return newReq;
  }

  async loadProposalsFromSupabase(providerEmail?: string): Promise<void> {
    if (!isSupabaseConfigured()) return;
    try {
      const statusFilter = ['pendiente', 'rechazada', 'publicada', 'oculta'];
      let expQuery = (this.supabase.from('experiencias') as any)
        .select('*')
        .in('status', statusFilter);
      if (providerEmail) {
        expQuery = expQuery.ilike('provider_email', providerEmail.trim().toLowerCase());
      }
      const { data: expData, error: expError } = await expQuery.order('created_at', {
        ascending: false,
      });

      if (expError) {
        console.warn('[ProviderStore] Error consultando propuestas en Supabase:', expError);
        return;
      }

      if (expData && Array.isArray(expData)) {
        let providerBankingMap = new Map<
          string,
          { cbu_alias?: string; cuit_dni?: string; bank_name?: string }
        >();
        try {
          const { data: accessRows } = await (
            this.supabase.from('prestadores') as any
          ).select('email, cbu_alias, cuit_dni, bank_name');
          if (Array.isArray(accessRows)) {
            for (const row of accessRows) {
              if (row?.email) {
                providerBankingMap.set(row.email.trim().toLowerCase(), row);
              }
            }
          }
        } catch {
          // Si no está autorizado para leer prestadores, se maneja de forma segura
        }

        const validRows = expData.filter((row: any) => {
          if (row.status === 'publicada' || row.status === 'oculta') {
            return typeof row.provider_email === 'string' && row.provider_email.trim().length > 0;
          }
          return true;
        });

        const mapped: ExperienceProposalRequest[] = validRows.map((row: any) => {
          const email = (row.provider_email || '').trim().toLowerCase();
          const banking = providerBankingMap.get(email);
          return {
            id: row.id,
            slug: row.slug || undefined,
            providerId: row.provider_id || '',
            providerName: row.provider_name || '',
            providerAgency: row.provider_agency || '',
            providerEmail: row.provider_email || '',
            providerPhone: row.provider_phone || '',
            providerCbuAlias: banking?.cbu_alias || undefined,
            providerBankName: banking?.bank_name || undefined,
            providerCuitDni: banking?.cuit_dni || undefined,
            title: row.title,
            kicker: row.kicker || 'EXPERIENCIA',
            subheading: row.tagline || row.description || '',
            region: row.region || '',
            difficulty: row.difficulty || 'Moderada',
            duration: row.duration_label || '4 horas',
            altitude: row.altitude_meters ? `${row.altitude_meters} msnm` : '',
            capacity: row.capacity_per_date || 12,
            season: row.best_season || 'Todo el año',
            dates: Array.isArray(row.dates) && row.dates.length > 0 ? row.dates[0] : 'A coordinar',
            priceArs: row.price_ars,
            priceUsd: row.price_usd,
            promosAndPricing: row.promos_and_pricing || '',
            itinerary: row.itinerary || '',
            meetingPoint: row.meeting_point || '',
            meetingPointUrl: row.meeting_point_url || '',
            includedServices:
              Array.isArray(row.included) && row.included.length > 0
                ? row.included.join('\n')
                : (row.included_services || ''),
            participantRequirements:
              Array.isArray(row.highlights) && row.highlights.length > 0
                ? row.highlights.join('\n')
                : (row.participant_requirements || ''),
            notes: row.notes || '',
            coverImage: row.cover_image || '/assets/images/kayak-club-de-experiencias.jpg',
            coverImageName: row.cover_image_name || '',
            coverVideoUrl: row.video_url || '',
            coverVideoName: row.cover_video_name || '',
            albumPhotos: Array.isArray(row.album_photos) ? row.album_photos : [],
            status: (row.status === 'publicada' || row.status === 'oculta' ? 'aprobada' : row.status) as
              | 'pendiente'
              | 'aprobada'
              | 'rechazada',
            createdAt: row.created_at || new Date().toISOString(),
            reviewedAt: row.reviewed_at || undefined,
          };
        });

        if (!providerEmail) {
          // Si es consulta global de administrador, Supabase es la fuente de verdad
          this._experienceRequests.set(mapped);
        } else {
          // Si es para un prestador particular, se actualizan sus propuestas y se preservan las demás,
          // asegurando que las propuestas aprobadas sigan disponibles tras recargar.
          const mappedIds = new Set(mapped.map((r) => r.id));
          const preservedApproved = this._experienceRequests().filter(
            (r) =>
              r.id !== 'req-sunset-las-pirquitas' &&
              r.providerEmail?.toLowerCase() === providerEmail.toLowerCase() &&
              (r.status === 'aprobada' || (r.status as string) === 'publicada' || (r.status as string) === 'oculta') &&
              !mappedIds.has(r.id),
          );
          const others = this._experienceRequests().filter(
            (r) =>
              r.id !== 'req-sunset-las-pirquitas' &&
              r.providerEmail?.toLowerCase() !== providerEmail.toLowerCase(),
          );
          const merged = [...mapped, ...preservedApproved, ...others].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          this._experienceRequests.set(merged);
        }
        this.saveRequests();
      }
    } catch (err) {
      console.warn('[ProviderStore] Excepción al cargar propuestas de Supabase:', err);
    }
  }

  async approveExperienceRequest(
    requestId: string,
    publicUrl?: string,
    confirmedDates?: string[],
  ): Promise<boolean> {
    const req = this._experienceRequests().find((r) => r.id === requestId);
    if (!req) return false;

    const normalizedEmail = (req.providerEmail || '').trim().toLowerCase();
    const existingProvider =
      (req.providerId ? this.getProviderById(req.providerId) : undefined) ||
      (normalizedEmail ? this.getProviderByEmail(normalizedEmail) : undefined);
    const resolvedProviderSlug = existingProvider?.slug || undefined;
    const resolvedProviderName = (req.providerAgency || req.providerName || '').trim();
    const resolvedProviderPhone = req.providerPhone?.trim() || undefined;

    const storedSlug = (req.slug || '').trim().toLowerCase();
    let baseSlug = storedSlug || slugify(req.title) || 'experiencia';
    if (RESERVED_EXPERIENCE_SLUGS.has(baseSlug.toLowerCase())) {
      baseSlug = `${baseSlug}-exp`;
    }
    let generatedSlug = baseSlug;
    let suffix = 2;
    const existingSlugs = new Set([
      ...this.expService
        .experiences()
        .filter((e) => e.id !== requestId)
        .map((e) => e.slug.toLowerCase()),
      ...this._experiences()
        .filter((e) => e.id !== requestId)
        .map((e) => e.slug.toLowerCase()),
    ]);
    const existingIds = new Set([
      ...this.expService
        .experiences()
        .filter((e) => e.id !== requestId)
        .map((e) => e.id.toLowerCase()),
      ...this._experiences()
        .filter((e) => e.id !== requestId)
        .map((e) => e.id.toLowerCase()),
    ]);
    while (
      existingSlugs.has(generatedSlug.toLowerCase()) ||
      existingIds.has(('exp-' + generatedSlug).toLowerCase())
    ) {
      generatedSlug = `${baseSlug}-${suffix++}`;
    }
    const finalId = 'exp-' + generatedSlug;
    const resolvedUrl = publicUrl?.trim() || `https://experiencias.club/experiencias/${generatedSlug}`;

    // Solo usar fechas confirmadas por el prestador o administrador.
    // Cuando las fechas son "A coordinar", se publican sin fechas reservables fijas ([]).
    const publishedDates: string[] =
      confirmedDates && confirmedDates.length > 0
        ? confirmedDates
        : parseConfirmedProposalDates(req.dates);

    let bankingFromPrestadores: { cbu_alias?: string; cuit_dni?: string; bank_name?: string } | null = null;
    if (isSupabaseConfigured() && normalizedEmail) {
      try {
        const { data: pRow } = await (this.supabase.from('prestadores') as any)
          .select('cbu_alias, cuit_dni, bank_name')
          .eq('email', normalizedEmail)
          .maybeSingle();
        if (pRow) {
          bankingFromPrestadores = pRow;
        }
      } catch {
        // Fallback si no hay conexión o permisos
      }
    }

    // 1. Preservar o crear en el catálogo oficial de ExperienceService antes de reportar aprobación
    const existingInService = this.expService
      .experiences()
      .find((e) => e.id === requestId || e.id === finalId || e.slug === generatedSlug);

    const publishedId = existingInService ? existingInService.id : requestId;

    let remoteRow: any = null;
    if (isSupabaseConfigured()) {
      try {
        const { data } = await (this.supabase.from('experiencias') as any)
          .select('id, slug, status')
          .eq('id', requestId)
          .maybeSingle();
        remoteRow = data;
      } catch {
        remoteRow = null;
      }
    }

    if (existingInService) {
      await this.expService.updateExperience({
        id: publishedId,
        slug: generatedSlug,
        status: 'publicada',
        dates: publishedDates,
        publicUrl: resolvedUrl,
        reviewedAt: new Date().toISOString(),
        ...(resolvedProviderName ? { providerName: resolvedProviderName } : {}),
        ...(resolvedProviderSlug ? { providerSlug: resolvedProviderSlug } : {}),
        ...(resolvedProviderPhone ? { providerPhone: resolvedProviderPhone } : {}),
        ...(req.providerEmail ? { providerEmail: req.providerEmail } : {}),
        ...(bankingFromPrestadores?.cbu_alias
          ? { providerCbuAlias: bankingFromPrestadores.cbu_alias }
          : {}),
        ...(bankingFromPrestadores?.cuit_dni
          ? { providerCuitDni: bankingFromPrestadores.cuit_dni }
          : {}),
        ...(bankingFromPrestadores?.bank_name
          ? { providerBankName: bankingFromPrestadores.bank_name }
          : {}),
        isClubExperience: false,
      });
    } else if (remoteRow) {
      try {
        const { error: updErr } = await (this.supabase.from('experiencias') as any)
          .update({
            status: 'publicada',
            slug: generatedSlug,
            public_url: resolvedUrl,
            dates: publishedDates,
            ...(resolvedProviderName ? { provider_name: resolvedProviderName } : {}),
            ...(resolvedProviderSlug ? { provider_slug: resolvedProviderSlug } : {}),
            ...(resolvedProviderPhone ? { provider_phone: resolvedProviderPhone } : {}),
            ...(req.providerEmail ? { provider_email: req.providerEmail } : {}),
            provider_cbu_alias: null,
            provider_cuit_dni: null,
            provider_bank_name: null,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', requestId);

        if (updErr) {
          console.warn('[ProviderStore] Error actualizando fila remota en experiencias:', updErr);
        }
      } catch (err) {
        console.warn('[ProviderStore] Excepción al actualizar fila remota en experiencias:', err);
      }

      try {
        await this.expService.reloadFromSupabase();
      } catch (err) {
        console.warn('[ProviderStore] Error recargando catálogo en ExperienceService:', err);
      }
    } else {
      const experienceForCatalog: Experience = {
        id: publishedId,
        slug: generatedSlug,
        title: req.title,
        shortTitle: req.title.split('&')[0].trim(),
        kicker: req.kicker || 'EXPERIENCIA',
        tagline: req.subheading.length > 90 ? req.subheading.slice(0, 90) + '...' : req.subheading,
        description: req.subheading,
        region: req.region,
        meetingPoint: req.meetingPoint,
        meetingPointUrl: req.meetingPointUrl,
        difficulty:
          (req.difficulty.split('(')[0].trim() as
            'Baja' | 'Moderada' | 'Exigente' | 'Alta Montaña') || 'Moderada',
        durationDays: 1,
        durationLabel: req.duration,
        altitudeMeters: Number(req.altitude?.replace(/\D/g, '')) || 850,
        bestSeason: req.season || 'Todo el año',
        priceArs: req.priceArs,
        priceUsd: req.priceUsd ?? 70,
        promosAndPricing: req.promosAndPricing || undefined,
        maxSpotsPerGroup: req.capacity,
        dates: publishedDates,
        status: 'publicada',
        publicUrl: resolvedUrl,
        detailRoute: `/experiencias/${generatedSlug}`,
        coverImage: req.coverImage || '/assets/images/kayak-club-de-experiencias.jpg',
        galleryImages:
          req.albumPhotos && req.albumPhotos.length > 0
            ? req.albumPhotos.map((p) => p.url)
            : [req.coverImage || '/assets/images/kayak-club-de-experiencias.jpg'],
        videoUrl: req.coverVideoUrl || '',
        isExclusiveClub: true,
        isLocked: false,
        albumPhotos: req.albumPhotos && req.albumPhotos.length > 0 ? req.albumPhotos : [],
        itinerary: req.itinerary,
        highlights: [],
        included: req.includedServices
          ? req.includedServices
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        notIncluded: req.participantRequirements
          ? req.participantRequirements
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        providerId: req.providerId,
        providerEmail: normalizedEmail || undefined,
        providerSlug: resolvedProviderSlug,
        providerName: resolvedProviderName || undefined,
        providerPhone: resolvedProviderPhone,
        providerCbuAlias:
          bankingFromPrestadores?.cbu_alias || req.providerCbuAlias || existingProvider?.cbuAlias,
        providerCuitDni:
          bankingFromPrestadores?.cuit_dni || req.providerCuitDni || existingProvider?.cuitDni,
        providerBankName:
          bankingFromPrestadores?.bank_name || req.providerBankName || existingProvider?.bankName,
      };

      try {
        await this.expService.createExperience(experienceForCatalog);
      } catch (err) {
        console.error('[ProviderStore] Error creando experiencia en ExperienceService:', err);
        throw err;
      }
    }

    this._experienceRequests.update((list) =>
      list.map((r) =>
        r.id === requestId
          ? { ...r, slug: generatedSlug, status: 'aprobada' as const, reviewedAt: new Date().toISOString() }
          : r,
      ),
    );
    this.saveRequests();

    if (isSupabaseConfigured() && !remoteRow) {
      try {
        const { error } = await (this.supabase.from('experiencias') as any)
          .update({
            status: 'publicada',
            slug: generatedSlug,
            public_url: resolvedUrl,
            dates: publishedDates,
            provider_cbu_alias: null,
            provider_cuit_dni: null,
            provider_bank_name: null,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', publishedId);

        if (error) {
          console.warn(
            '[ProviderStore] Error actualizando estado de experiencia en Supabase:',
            error,
          );
        }
      } catch (err) {
        console.warn('[ProviderStore] Excepción al actualizar estado en Supabase:', err);
      }
    }

    if (req) {
      const existsIndex = this._experiences().findIndex(
        (e) =>
          e.id === publishedId ||
          e.slug === generatedSlug ||
          e.title.toLowerCase() === req.title.toLowerCase(),
      );
      if (existsIndex === -1) {
        const newExp: ProviderExperience = {
          id: publishedId,
          slug: generatedSlug,
          title: req.title,
          shortTitle: req.title.split('&')[0].trim(),
          tagline:
            req.subheading.length > 90 ? req.subheading.slice(0, 90) + '...' : req.subheading,
          description: req.subheading,
          region: req.region,
          meetingPoint: req.meetingPoint,
          difficulty:
            (req.difficulty.split('(')[0].trim() as
              'Baja' | 'Moderada' | 'Exigente' | 'Alta Montaña') || 'Moderada',
          durationLabel: req.duration,
          priceArs: req.priceArs,
          capacityPerDate: req.capacity,
          dates: publishedDates,
          status: 'publicada',
          publicUrl: resolvedUrl,
          providerId: req.providerId,
          providerEmail: normalizedEmail || undefined,
          providerSlug: resolvedProviderSlug,
          providerName: resolvedProviderName,
          providerPhone: resolvedProviderPhone,
          providerCbuAlias:
            bankingFromPrestadores?.cbu_alias || req.providerCbuAlias || existingProvider?.cbuAlias,
          providerCuitDni:
            bankingFromPrestadores?.cuit_dni || req.providerCuitDni || existingProvider?.cuitDni,
          providerBankName:
            bankingFromPrestadores?.bank_name || req.providerBankName || existingProvider?.bankName,
          coverImage: req.coverImage || '/assets/images/kayak-club-de-experiencias.jpg',
          createdAt: new Date().toISOString(),
        };
        this._experiences.update((exps) => [newExp, ...exps]);
        this.saveExperiences();
      } else {
        this._experiences.update((exps) =>
          exps.map((e, idx) =>
            idx === existsIndex
              ? {
                  ...e,
                  id: publishedId,
                  slug: generatedSlug,
                  status: 'publicada',
                  publicUrl: resolvedUrl,
                  dates: publishedDates,
                }
              : e,
          ),
        );
        this.saveExperiences();
      }
    }
    return true;
  }

  updateExperiencePublicUrl(expId: string, publicUrl: string): void {
    this._experiences.update((list) =>
      list.map((e) => (e.id === expId ? { ...e, publicUrl: publicUrl.trim() } : e)),
    );
    this.saveExperiences();
  }

  async rejectExperienceRequest(requestId: string): Promise<boolean> {
    const previous = this._experienceRequests().find((r) => r.id === requestId);
    if (!previous) return false;
    const prevStatus = previous.status;
    const prevReviewedAt = previous.reviewedAt;

    this._experienceRequests.update((list) =>
      list.map((r) =>
        r.id === requestId
          ? { ...r, status: 'rechazada' as const, reviewedAt: new Date().toISOString() }
          : r,
      ),
    );
    this.saveRequests();

    const inService = this.expService.experiences().find((e) => e.id === requestId);
    if (inService) {
      try {
        await this.expService.updateExperience({ id: requestId, status: 'rechazada' });
      } catch (err) {
        console.warn(
          '[ProviderStore] Error actualizando experiencia en ExperienceService al rechazar:',
          err,
        );
        this._experienceRequests.update((list) =>
          list.map((r) =>
            r.id === requestId ? { ...r, status: prevStatus, reviewedAt: prevReviewedAt } : r,
          ),
        );
        this.saveRequests();
        return false;
      }
    }

    if (isSupabaseConfigured()) {
      try {
        const { error } = await (this.supabase.from('experiencias') as any)
          .update({
            status: 'rechazada',
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', requestId);

        if (error) {
          console.warn(
            '[ProviderStore] Error actualizando estado de experiencia en Supabase:',
            error,
          );
          this._experienceRequests.update((list) =>
            list.map((r) =>
              r.id === requestId ? { ...r, status: prevStatus, reviewedAt: prevReviewedAt } : r,
            ),
          );
          this.saveRequests();
          return false;
        }
      } catch (err: any) {
        console.warn('[ProviderStore] Excepción al rechazar experiencia en Supabase:', err);
        this._experienceRequests.update((list) =>
          list.map((r) =>
            r.id === requestId ? { ...r, status: prevStatus, reviewedAt: prevReviewedAt } : r,
          ),
        );
        this.saveRequests();
        return false;
      }
    }
    return true;
  }

  getPublicPaymentDetails(
    experience?: ProviderExperience | Experience | null,
  ): PublicPaymentDestination {
    const club = this.expService.getClubProfile();
    const isClub =
      !experience ||
      isClubExperience({
        slug: experience.slug,
        providerSlug: experience.providerSlug,
        providerEmail: experience.providerEmail,
        providerName: experience.providerName,
      });

    if (isClub) {
      return {
        cbu: club.cbuAlias || BANK_TRANSFER_DESTINATION.cbu,
        accountHolder: club.accountHolder || club.name || BANK_TRANSFER_DESTINATION.accountHolder,
        taxId: club.cuitDni || BANK_TRANSFER_DESTINATION.taxId,
        entity: club.bankName || BANK_TRANSFER_DESTINATION.entity,
        isOfficialClub: true,
      };
    }

    const hasPrivileged = this.expService.hasPrivilegedSession();
    if (hasPrivileged && experience.providerCbuAlias) {
      return {
        cbu: experience.providerCbuAlias,
        accountHolder: experience.providerName || BANK_TRANSFER_DESTINATION.accountHolder,
        taxId: experience.providerCuitDni || BANK_TRANSFER_DESTINATION.taxId,
        entity: experience.providerBankName || BANK_TRANSFER_DESTINATION.entity,
        isOfficialClub: false,
      };
    }

    return {
      cbu: BANK_TRANSFER_DESTINATION.cbu,
      accountHolder: BANK_TRANSFER_DESTINATION.accountHolder,
      taxId: BANK_TRANSFER_DESTINATION.taxId,
      entity: BANK_TRANSFER_DESTINATION.entity,
      isOfficialClub: true,
    };
  }

  private loadStoredRequests(): ExperienceProposalRequest[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.experienceRequests);
      const parsed: ExperienceProposalRequest[] = raw ? JSON.parse(raw) : [];
      return parsed
        .filter((r) => r && r.id !== 'req-sunset-las-pirquitas')
        .map((r) => ({
          ...r,
          coverImage: (!r.coverImage || r.coverImage.startsWith('blob:'))
            ? '/assets/images/kayak-club-de-experiencias.jpg'
            : r.coverImage,
        }));
    } catch {
      return [];
    }
  }

  private saveRequests(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        STORAGE_KEYS.experienceRequests,
        JSON.stringify(this._experienceRequests()),
      );
    } catch {
      // quota
    }
  }
}
