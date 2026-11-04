import { Injectable, computed, inject, signal } from '@angular/core';
import {
  ExperienceAlbumPhoto,
  ExperienceDateSlot,
  MAX_PARTICIPANTS_PER_BOOKING,
  NewProviderExperience,
  NewTransferSubmission,
  ProviderExperience,
  ProviderUser,
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
import { ExperienceService, KAYAK_ALBUM_PHOTOS } from './experience.service';
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

const SEED_EXPERIENCE_REQUESTS: ExperienceProposalRequest[] = [
  {
    id: 'req-sunset-las-pirquitas',
    providerId: 'prov-patricio',
    providerName: 'Patricio Facundo Diaz Tillar',
    providerAgency: 'Catamarca Kayak & Aventura Náutica',
    providerEmail: 'patriciofacundodiaztillar@gmail.com',
    providerPhone: '+54 383 455 8812',
    title: 'Travesía en Kayak Nocturna & Luna Llena en El Jumeal',
    kicker: 'EXPEDICIÓN NÁUTICA: VALLE CENTRAL',
    subheading:
      'Remada nocturna bajo el cielo estrellado y la luna llena en el espejo de agua de El Jumeal, con fogón criollo y degustación de vinos de altura.',
    region: 'Valle Central y Ambato',
    difficulty: 'Baja (Sin experiencia previa)',
    duration: '5 Horas (Jornada Nocturna)',
    altitude: '920 msnm',
    capacity: 14,
    season: 'Primavera y Verano (noches de Luna Llena)',
    dates: 'Viernes y Sábados de Luna Llena 19:30 hs',
    priceArs: 72000,
    priceUsd: 75,
    promosAndPricing: '10% de descuento abonando en efectivo o para grupos de 4 o más personas.',
    itinerary:
      '19:30 hs Recepción y equipamiento en Club Náutico\n20:15 hs Zarpada con balizas acuáticas\n22:00 hs Desembarco en ensenada y fogón bajo las estrellas\n23:30 hs Brindis de cierre',
    meetingPoint: 'Club Náutico El Jumeal (Fray Mamerto Esquiú, RP 1)',
    includedServices:
      'Kayaks de travesía, remos, chalecos homologados, balizas estancas, lancha de apoyo y cena rústica al fuego.',
    participantRequirements:
      'Muda de ropa seca para recambio, campera térmica/rompevientos y calzado para agua.',
    notes: 'Fotos de alta resolución y ruta GPS cargadas.',
    coverImage: '/assets/images/kayak-club-de-experiencias.jpg',
    coverImageName: 'kayak-nocturno-pirquitas.jpg',
    coverVideoName: 'kayak-trailer.mp4',
    status: 'pendiente',
    createdAt: hoursAgo(14),
  },
];

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

export const SEED_PROVIDERS: ProviderUser[] = [
  {
    id: 'prov-patricio',
    email: 'patriciofacundodiaztillar@gmail.com',
    name: 'Patricio Facundo Diaz Tillar',
    agency: 'Catamarca Kayak & Aventura Náutica',
    slug: 'catamarca-kayak',
    bio: 'Pioneros en turismo náutico y expediciones en kayak en los diques andinos de Catamarca. Instructores certificados, flota propia y experiencias seguras en aguas mansas con degustaciones de productos regionales al atardecer.',
    phone: '+54 383 455 8812',
    website: 'https://experiencias.club/experiencias/kayak',
    socialMedia: 'instagram.com/catamarca.kayak',
    cuitDni: '20-30456123-4',
    cbuAlias: '3840200500000056402423',
    bankName: 'Uala Bank S.A.U',
    verified: true,
    status: 'aprobado',
    role: 'prestador',
    avatar: '/assets/aistudio/patricio.jpg',
    coverImage: '/assets/images/kayak-club-de-experiencias.jpg',
    joinedAt: '2024-03-15T10:00:00Z',
  },
  {
    id: 'prov-vegvarel',
    email: 'vegvarel@gmail.com',
    name: 'vegvarel',
    agency: 'Catamarca Expediciones & Trekking',
    slug: 'catamarca-expediciones',
    bio: 'Especialistas en travesías 4x4 y alta montaña en la Puna catamarqueña. Rutas al Campo de Piedra Pómez, Volcán Galán y Seismiles con logística integral y guías de montaña habilitados.',
    phone: '+54 383 488 9900',
    website: 'https://experiencias.club',
    socialMedia: 'instagram.com/catamarcaexpediciones',
    cuitDni: '20-33221144-5',
    cbuAlias: 'VEGVAREL.EXPERIENCIAS',
    bankName: 'Banco Nación',
    verified: true,
    status: 'aprobado',
    role: 'prestador',
    avatar: '/assets/aistudio/patricio.jpg',
    coverImage: '/assets/images/catamarca_pomez.jpg',
    joinedAt: '2024-05-10T11:00:00Z',
  },
  {
    id: 'prov-gonza',
    email: 'gonzagramaglia@gmail.com',
    name: 'Gonzalo Gramaglia',
    agency: 'Catamarca Experiencias & Expediciones',
    slug: 'gonzagramaglia',
    bio: 'Expediciones y experiencias exclusivas por las quebradas y cordillera catamarqueña para socios del club.',
    phone: '+54 9 11 5566 7788',
    website: 'https://experiencias.club',
    socialMedia: 'instagram.com/experiencias.club',
    cuitDni: '',
    cbuAlias: '',
    bankName: '',
    verified: true,
    status: 'aprobado',
    role: 'prestador',
    avatar: '/assets/images/gonza.jpg',
    coverImage: '/assets/images/laguna_blanca.jpg',
    joinedAt: '2024-01-01T00:00:00Z',
  },
];

const KAYAK_ID = 'exp-kayak';
const POMEZ_ID = 'exp-pomez-4x4';

const SEED_EXPERIENCES: ProviderExperience[] = [
  {
    id: KAYAK_ID,
    slug: 'kayak',
    title: 'Travesía en Kayak & Sunset en El Jumeal',
    shortTitle: 'Travesía en Kayak',
    tagline: 'Remada guiada al atardecer con brindis de productos catamarqueños.',
    description:
      'Remada guiada en kayak en aguas calmas rodeadas de quebradas y vegetación de yungas andinas. Presenciamos la caída del sol reflejada en el dique y cerramos con un brindis.',
    region: 'Valle Central y Ambato',
    meetingPoint: 'Club Náutico Dique El Jumeal',
    difficulty: 'Baja',
    durationLabel: '4 horas',
    priceArs: 65000,
    capacityPerDate: 12,
    dates: [upcomingDate(9), upcomingDate(16), upcomingDate(23)],
    status: 'publicada',
    publicUrl: 'https://experiencias.club/experiencias/kayak',
    providerId: 'prov-patricio',
    providerName: 'Catamarca Kayak & Aventura Náutica',
    coverImage: '/assets/images/kayak-club-de-experiencias.jpg',
    albumPhotos: KAYAK_ALBUM_PHOTOS,
    createdAt: hoursAgo(24 * 30),
  },
  {
    id: POMEZ_ID,
    slug: 'campo-de-piedra-pomez',
    title: 'Expedición 4x4 Campo de Piedra Pómez & Volcanes',
    shortTitle: 'Piedra Pómez 4x4',
    tagline: 'Aventura lunar en el laberinto blanco de la Puna catamarqueña a más de 3.000 msnm.',
    description:
      'Travesía en camionetas 4x4 equipadas hacia el majestuoso Campo de Piedra Pómez. Incluye cruce de médanos gigantes, avistaje de vicuñas en Laguna Blanca y merienda andina en el silencio absoluto de la cordillera.',
    region: 'Puna de Atacama',
    meetingPoint: 'Plaza Principal de El Peñón, Antofagasta de la Sierra',
    difficulty: 'Moderada',
    durationLabel: 'Día completo (10 h)',
    priceArs: 145000,
    capacityPerDate: 8,
    dates: [upcomingDate(12), upcomingDate(26)],
    status: 'borrador',
    providerId: 'prov-claudio',
    providerName: 'Catamarca Kayak & Aventura Náutica',
    coverImage: '/assets/images/catamarca_pomez.jpg',
    albumPhotos: [
      {
        id: 'pomez-1',
        url: '/assets/images/catamarca_pomez.jpg',
        title: 'Campo de Piedra Pómez',
        caption: 'Laberinto blanco esculpido por el viento a más de 3.000 msnm.',
        isCover: true,
        isFeatured: false,
        order: 1,
      },
      {
        id: 'pomez-2',
        url: '/assets/images/laguna-verde.jpg',
        title: 'Laguna y Volcanes',
        caption: 'Contrastes turquesas en la alta cordillera catamarqueña.',
        isCover: false,
        isFeatured: true,
        order: 2,
      },
      {
        id: 'pomez-3',
        url: '/assets/images/dron.jpg',
        title: 'Panorámica de la Puna',
        caption: 'Inmensidad andina y formaciones de ceniza volcánica.',
        isCover: false,
        isFeatured: true,
        order: 3,
      },
    ],
    createdAt: hoursAgo(24 * 5),
  },
];

const SEED_SUBMISSIONS: TransferSubmission[] = [
  {
    id: 'sub-1',
    reference: 'KAY-4F7Q',
    experienceId: KAYAK_ID,
    experienceTitle: SEED_EXPERIENCES[0].title,
    date: SEED_EXPERIENCES[0].dates[0],
    participants: 2,
    amountArs: 130000,
    fullName: 'Lucía Fernández',
    email: 'lucia.fernandez@ejemplo.com',
    dni: '32458190',
    phone: '+54 383 455 1290',
    receipt: {
      fileName: 'transferencia-lucia.png',
      mimeType: 'image/png',
      sizeBytes: 412_000,
      url: SAMPLE_RECEIPT_URL,
    },
    status: 'pendiente',
    submittedAt: hoursAgo(3),
  },
  {
    id: 'sub-2',
    reference: 'KAY-9M2D',
    experienceId: KAYAK_ID,
    experienceTitle: SEED_EXPERIENCES[0].title,
    date: SEED_EXPERIENCES[0].dates[0],
    participants: 1,
    amountArs: 65000,
    fullName: 'Martín Quiroga',
    email: 'mquiroga@ejemplo.com',
    dni: '28771034',
    phone: '+54 11 5021 7781',
    receipt: {
      fileName: 'comprobante.png',
      mimeType: 'image/png',
      sizeBytes: 388_000,
      url: SAMPLE_RECEIPT_URL,
    },
    status: 'pendiente',
    submittedAt: hoursAgo(20),
  },
  {
    id: 'sub-3',
    reference: 'KAY-2X8B',
    experienceId: KAYAK_ID,
    experienceTitle: SEED_EXPERIENCES[0].title,
    date: SEED_EXPERIENCES[0].dates[1],
    participants: 3,
    amountArs: 195000,
    fullName: 'Carla Ahumada',
    email: 'carla.ahumada@ejemplo.com',
    dni: '35120988',
    phone: '+54 383 412 0033',
    receipt: {
      fileName: 'pago-kayak.png',
      mimeType: 'image/png',
      sizeBytes: 401_000,
      url: SAMPLE_RECEIPT_URL,
    },
    status: 'aprobado',
    submittedAt: hoursAgo(52),
    reviewedAt: hoursAgo(48),
  },
];

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

    const confirmedRevenue = subs
      .filter((s) => s.status === 'aprobado')
      .reduce((sum, s) => sum + s.amountArs, 0);

    const pendingRevenue = subs
      .filter((s) => s.status === 'pendiente')
      .reduce((sum, s) => sum + s.amountArs, 0);

    const totalEnrolled = subs
      .filter((s) => s.status !== 'rechazado')
      .reduce((sum, s) => sum + s.participants, 0);

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
      pendingReceiptsCount: subs.filter((s) => s.status === 'pendiente').length,
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

      const { data: access, error } = await (this.supabase.from('provider_access') as any)
        .select('email, name, agency, active, status, cbu_alias, cuit_dni, bank_name, account_holder, phone, website, social_media, slug, bio, avatar_url, cover_url')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.warn('[ProviderStore] Error consultando provider_access:', error);
      }

      if (
        error ||
        !access ||
        access.active !== true ||
        access.status !== 'aprobado'
      ) {
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
      const provider: ProviderUser = {
        id: existing?.id ?? `provider-${email.replace(/[^a-z0-9]+/g, '-')}`,
        email,
        name: access.account_holder || access.name || userMeta['full_name'] || userMeta['name'] || existing?.name || email,
        agency: access.agency || existing?.agency || 'Prestador EXPERIENCIAS.CLUB',
        slug:
          access.slug ||
          existing?.slug ||
          (access.agency
            ? access.agency
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)+/g, '')
            : `prov-${email.split('@')[0]}`),
        bio: access.bio || existing?.bio || '',
        phone: access.phone || existing?.phone || '',
        website: access.website || existing?.website || '',
        socialMedia: access.social_media || existing?.socialMedia || '',
        cuitDni: access.cuit_dni === '20-33445566-7' ? '' : (access.cuit_dni || ''),
        cbuAlias: access.cbu_alias === 'EXPERIENCIAS.CLUB.MP' ? '' : (access.cbu_alias || ''),
        bankName: access.bank_name === 'Banco Nación / Mercado Pago' ? '' : (access.bank_name || ''),
        verified: true,
        status: 'aprobado',
        role: 'prestador',
        avatar: access.avatar_url || googleAvatar || existing?.avatar || '/assets/aistudio/patricio.jpg',
        coverImage: access.cover_url || existing?.coverImage || '/assets/images/kayak-club-de-experiencias.jpg',
        joinedAt: existing?.joinedAt ?? new Date().toISOString(),
      };

      if (!existing) this._providers.update((providers) => [...providers, provider]);
      else
        this._providers.update((providers) =>
          providers.map((p) => (p.email.toLowerCase() === email ? provider : p)),
        );
      this.lastSessionRestoreTime = Date.now();
      this._currentProvider.set(provider);
      this.saveSession(provider);
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

  async logout(): Promise<void> {
    if (isSupabaseConfigured()) {
      await this.supabase.auth.signOut();
    }
    this.lastSessionRestoreTime = 0;
    this._currentProvider.set(null);
    this.saveSession(null);
  }

  async updateProfile(updates: Partial<ProviderUser>): Promise<{ success: boolean; message?: string }> {
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
        if (updates.cuitDni !== undefined) payload['cuit_dni'] = updates.cuitDni.trim();
        if (updates.cbuAlias !== undefined) payload['cbu_alias'] = updates.cbuAlias.trim();
        if (updates.bankName !== undefined) payload['bank_name'] = updates.bankName.trim();

        const { error } = await (this.supabase.from('provider_access') as any)
          .update(payload)
          .eq('email', email);

        if (error) {
          console.warn('[ProviderStore] Error actualizando provider_access:', error);
          return { success: false, message: 'No se pudieron guardar los cambios en la base de datos.' };
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
          if (
            e.providerId === current.id ||
            (e.providerEmail || '').toLowerCase() === email
          ) {
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

  // ==========================================
  // Experience Management & Moderation
  // ==========================================
  getProviderById(id: string): ProviderUser | undefined {
    return this._providers().find((p) => p.id === id);
  }

  getProviderByEmail(email: string): ProviderUser | undefined {
    return this._providers().find((p) => p.email.toLowerCase() === email.trim().toLowerCase());
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
        .from('public_provider_profiles')
        .select(
          'email, name, agency, active, status, phone, website, social_media, slug, bio, avatar_url, cover_url',
        )
        .or(`slug.eq.${querySlug},email.eq.${queryEmail}`)
        .maybeSingle();

      if (!error && data) {
        remoteData = data;
      } else if (error) {
        const { data: fallbackData } = await (this.supabase.from('provider_access') as any)
          .select(
            'email, name, agency, active, status, phone, website, social_media, slug, bio, avatar_url, cover_url',
          )
          .eq('active', true)
          .eq('status', 'aprobado')
          .or(`slug.eq.${querySlug},email.eq.${queryEmail}`)
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
    return this._submissions()
      .filter((s) => s.experienceId === experienceId && s.date === date && s.status !== 'rechazado')
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
      this.expService.getExperienceById(id) ||
      this.expService.getExperienceBySlug(updated.slug);
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
          console.warn('[ProviderStoreService] Error sincronizando fecha con ExperienceService:', err);
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
          console.warn('[ProviderStoreService] Error sincronizando slot con ExperienceService:', err);
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
          console.warn('[ProviderStoreService] Error sincronizando slot con ExperienceService:', err);
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
          console.warn('[ProviderStoreService] Error sincronizando eliminación con ExperienceService:', err);
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
    if (!experience.dates.includes(input.date)) {
      throw new Error('La fecha elegida no está disponible.');
    }
    if (this.isDateClosed(experience, input.date)) {
      throw new Error('La fecha elegida se encuentra cerrada para nuevas reservas.');
    }
    if (
      !Number.isInteger(input.participants) ||
      input.participants < 1 ||
      input.participants > MAX_PARTICIPANTS_PER_BOOKING
    ) {
      throw new Error('Cantidad de personas inválida.');
    }
    if (input.participants > this.availableSeats(experience, input.date)) {
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
          err?.message?.includes('importe')
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
    const provider = experience.providerId ? this.getProviderById(experience.providerId) : undefined;
    const targetProviderEmail = provider?.email || PROVIDER_CONTACT_EMAIL;
    const targetProviderPhone = provider?.phone || '';
    this.emails.notifyReceiptReceived(submission, targetProviderEmail, targetProviderPhone);
    this.emails.notifyProviderNewReceipt(submission, targetProviderEmail);
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
    const dateLabel = new Intl.DateTimeFormat('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${submission.date}T12:00:00`));
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
      status: 'pendiente_pago',
      provider: {
        name: experience.shortTitle ?? experience.title,
        category: experience.difficulty,
        contactPhone: '',
      },
      receipt: {
        receiptNumber: submission.reference,
        transactionId: submission.id,
        gateway: 'custom',
        gatewayDisplayName: 'Transferencia bancaria',
        amountArs: submission.amountArs,
        amountUsd: 0,
        paidAt: new Date(submission.submittedAt).toLocaleString('es-AR'),
        paymentMethodSummary: 'Transferencia a CBU · comprobante en revisión',
        payerEmail: submission.email,
        payerName: submission.fullName,
        authCode: submission.reference,
        status: 'pendiente_verificacion',
        ...(submission.discountCode
          ? { discountCode: submission.discountCode, discountArs: submission.discountArs }
          : {}),
      },
      memoriesCount: 0,
      memoryPhotos: [],
    });
  }

  private buildReference(slug: string): string {
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
      const list = raw ? JSON.parse(raw) : SEED_PROVIDERS;
      return Array.isArray(list) ? list.map((p) => this.sanitizeProvider(p)) : SEED_PROVIDERS;
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
    if (typeof window === 'undefined') return SEED_EXPERIENCES;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.experiences);
      return raw ? JSON.parse(raw) : SEED_EXPERIENCES;
    } catch {
      return SEED_EXPERIENCES;
    }
  }

  private loadStoredSubmissions(): TransferSubmission[] {
    if (typeof window === 'undefined') return SEED_SUBMISSIONS;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.submissions);
      return raw ? JSON.parse(raw) : SEED_SUBMISSIONS;
    } catch {
      return SEED_SUBMISSIONS;
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
        localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(provider));
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
    const newReq: ExperienceProposalRequest = {
      ...data,
      id,
      status: 'pendiente',
      createdAt: new Date().toISOString(),
    };
    this._experienceRequests.update((list) => [newReq, ...list]);
    this.saveRequests();

    // Persistir en Supabase en tabla propuestas_experiencias
    if (isSupabaseConfigured()) {
      try {
        const proposalPayload: Record<string, any> = {
          id: newReq.id,
          provider_id: newReq.providerId,
          provider_name: newReq.providerName,
          provider_agency: newReq.providerAgency || '',
          provider_email: newReq.providerEmail.trim().toLowerCase(),
          provider_phone: newReq.providerPhone || '',
          title: newReq.title,
          kicker: newReq.kicker || 'EXPERIENCIA',
          subheading: newReq.subheading || '',
          region: newReq.region || '',
          difficulty: newReq.difficulty || 'Moderada',
          duration: newReq.duration || '4 horas',
          altitude: newReq.altitude || '',
          capacity: newReq.capacity || 12,
          season: newReq.season || 'Todo el año',
          dates: newReq.dates || 'A coordinar',
          price_ars: newReq.priceArs,
          price_usd: newReq.priceUsd || null,
          promos_and_pricing: newReq.promosAndPricing || '',
          itinerary: newReq.itinerary || '',
          meeting_point: newReq.meetingPoint || '',
          included_services: newReq.includedServices || '',
          participant_requirements: newReq.participantRequirements || '',
          notes: newReq.notes || '',
          cover_image: newReq.coverImage || '',
          cover_image_name: newReq.coverImageName || '',
          cover_video_url: newReq.coverVideoUrl || '',
          cover_video_name: newReq.coverVideoName || '',
          album_photos: newReq.albumPhotos || [],
          status: 'pendiente',
        };

        const { error } = await (this.supabase.from('propuestas_experiencias') as any).insert(proposalPayload);
        if (error) {
          // Si la columna album_photos no existiera aún en Supabase, reintentar sin ella
          if (error.message?.includes('album_photos') || error.code === '42703') {
            const fallbackPayload = { ...proposalPayload };
            delete fallbackPayload['album_photos'];
            const retryRes = await (this.supabase.from('propuestas_experiencias') as any).insert(fallbackPayload);
            if (retryRes.error) {
              console.warn('[ProviderStore] Error insertando propuesta en Supabase (fallback):', retryRes.error);
              this._experienceRequests.update((list) => list.filter((r) => r.id !== newReq.id));
              this.saveRequests();
              throw retryRes.error;
            }
          } else {
            console.warn('[ProviderStore] Error insertando propuesta en Supabase:', error);
            this._experienceRequests.update((list) => list.filter((r) => r.id !== newReq.id));
            this.saveRequests();
            throw error;
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
      let query = (this.supabase.from('propuestas_experiencias') as any).select('*');
      if (providerEmail) {
        query = query.ilike('provider_email', providerEmail.trim().toLowerCase());
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) {
        console.warn('[ProviderStore] Error consultando propuestas en Supabase:', error);
        return;
      }
      if (data && Array.isArray(data)) {
        const mapped: ExperienceProposalRequest[] = data.map((row: any) => ({
          id: row.id,
          providerId: row.provider_id,
          providerName: row.provider_name,
          providerAgency: row.provider_agency || '',
          providerEmail: row.provider_email,
          providerPhone: row.provider_phone || '',
          title: row.title,
          kicker: row.kicker || 'EXPERIENCIA',
          subheading: row.subheading || '',
          region: row.region || '',
          difficulty: row.difficulty || 'Moderada',
          duration: row.duration || '4 horas',
          altitude: row.altitude || '',
          capacity: row.capacity || 12,
          season: row.season || 'Todo el año',
          dates: row.dates || 'A coordinar',
          priceArs: row.price_ars,
          priceUsd: row.price_usd,
          promosAndPricing: row.promos_and_pricing || '',
          itinerary: row.itinerary || '',
          meetingPoint: row.meeting_point || '',
          includedServices: row.included_services || '',
          participantRequirements: row.participant_requirements || '',
          notes: row.notes || '',
          coverImage: row.cover_image || '',
          coverImageName: row.cover_image_name || '',
          coverVideoUrl: row.cover_video_url || '',
          coverVideoName: row.cover_video_name || '',
          albumPhotos: row.album_photos || [],
          status: row.status as 'pendiente' | 'aprobada' | 'rechazada',
          createdAt: row.created_at || new Date().toISOString(),
          reviewedAt: row.reviewed_at || undefined,
        }));

        const existingMap = new Map(this._experienceRequests().map((r) => [r.id, r]));
        for (const m of mapped) {
          existingMap.set(m.id, m);
        }
        const merged = Array.from(existingMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        this._experienceRequests.set(merged);
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

    const baseSlug = slugify(req.title) || 'experiencia';
    let generatedSlug = baseSlug;
    let suffix = 2;
    const existingSlugs = new Set([
      ...this.expService.experiences().map((e) => e.slug.toLowerCase()),
      ...this._experiences().map((e) => e.slug.toLowerCase()),
    ]);
    while (existingSlugs.has(generatedSlug.toLowerCase())) {
      generatedSlug = `${baseSlug}-${suffix++}`;
    }
    const resolvedUrl =
      publicUrl?.trim() || `https://experiencias.club/experiencias/${generatedSlug}`;

    // Solo usar fechas confirmadas por el prestador o administrador.
    // Cuando las fechas son "A coordinar", se publican sin fechas reservables fijas ([]).
    const publishedDates: string[] =
      confirmedDates && confirmedDates.length > 0
        ? confirmedDates
        : parseConfirmedProposalDates(req.dates);

    // 1. Crear en el catálogo oficial de ExperienceService antes de reportar aprobación
    const experienceForCatalog: Experience = {
      id: 'exp-' + generatedSlug,
      slug: generatedSlug,
      title: req.title,
      shortTitle: req.title.split('&')[0].trim(),
      tagline: req.subheading.length > 90 ? req.subheading.slice(0, 90) + '...' : req.subheading,
      description: req.subheading,
      region: req.region,
      meetingPoint: req.meetingPoint,
      difficulty:
        (req.difficulty.split('(')[0].trim() as
          | 'Baja'
          | 'Moderada'
          | 'Exigente'
          | 'Alta Montaña') || 'Moderada',
      durationDays: 1,
      durationLabel: req.duration,
      altitudeMeters: Number(req.altitude?.replace(/\D/g, '')) || 850,
      bestSeason: req.season || 'Todo el año',
      priceArs: req.priceArs,
      priceUsd: req.priceUsd ?? 70,
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
        ? req.includedServices.split('\n').map((s) => s.trim()).filter(Boolean)
        : [],
      notIncluded: req.participantRequirements
        ? req.participantRequirements.split('\n').map((s) => s.trim()).filter(Boolean)
        : [],
      providerId: req.providerId,
      providerEmail: normalizedEmail || undefined,
      providerSlug: resolvedProviderSlug,
      providerName: resolvedProviderName || undefined,
      providerPhone: resolvedProviderPhone,
      providerCbuAlias: req.providerCbuAlias || existingProvider?.cbuAlias,
      providerCuitDni: req.providerCuitDni || existingProvider?.cuitDni,
      providerBankName: req.providerBankName || existingProvider?.bankName,
    };

    try {
      await this.expService.createExperience(experienceForCatalog);
    } catch (err) {
      console.warn('[ProviderStore] Error creando experiencia en ExperienceService:', err);
    }

    this._experienceRequests.update((list) =>
      list.map((r) =>
        r.id === requestId
          ? { ...r, status: 'aprobada' as const, reviewedAt: new Date().toISOString() }
          : r,
      ),
    );
    this.saveRequests();

    if (isSupabaseConfigured()) {
      try {
        const { error } = await (this.supabase.from('propuestas_experiencias') as any)
          .update({
            status: 'aprobada',
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', requestId);
        if (error) {
          console.warn('[ProviderStore] Error actualizando estado de propuesta en Supabase:', error);
        }
      } catch (err) {
        console.warn('[ProviderStore] Excepción al actualizar estado en Supabase:', err);
      }
    }

    if (req) {
      const exists = this._experiences().some(
        (e) => e.title.toLowerCase() === req.title.toLowerCase(),
      );
      if (!exists) {
        const resolvedUrl =
          publicUrl?.trim() || `https://experiencias.club/experiencias/${generatedSlug}`;
        const newExp: ProviderExperience = {
          id: 'exp-' + generatedSlug,
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
          providerCbuAlias: req.providerCbuAlias || existingProvider?.cbuAlias,
          providerCuitDni: req.providerCuitDni || existingProvider?.cuitDni,
          providerBankName: req.providerBankName || existingProvider?.bankName,
          coverImage: req.coverImage || '/assets/images/kayak-club-de-experiencias.jpg',
          createdAt: new Date().toISOString(),
        };
        this._experiences.update((exps) => [newExp, ...exps]);
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

  rejectExperienceRequest(requestId: string): void {
    this._experienceRequests.update((list) =>
      list.map((r) =>
        r.id === requestId
          ? { ...r, status: 'rechazada' as const, reviewedAt: new Date().toISOString() }
          : r,
      ),
    );
    this.saveRequests();

    if (isSupabaseConfigured()) {
      (this.supabase.from('propuestas_experiencias') as any)
        .update({
          status: 'rechazada',
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .then(({ error }: any) => {
          if (error) {
            console.warn('[ProviderStore] Error actualizando estado de propuesta en Supabase:', error);
          }
        })
        .catch((err: any) => {
          console.warn('[ProviderStore] Excepción al rechazar propuesta en Supabase:', err);
        });
    }
  }

  private loadStoredRequests(): ExperienceProposalRequest[] {
    if (typeof window === 'undefined') return SEED_EXPERIENCE_REQUESTS;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.experienceRequests);
      return raw ? JSON.parse(raw) : SEED_EXPERIENCE_REQUESTS;
    } catch {
      return SEED_EXPERIENCE_REQUESTS;
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
