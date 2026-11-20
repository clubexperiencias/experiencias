import { Injectable, computed, inject, signal } from '@angular/core';
import { Experience, ExperienceAlbumPhoto } from '../models/experience.model';
import { SUPABASE_CLIENT, isSupabaseConfigured } from '../supabase/supabase.client';
import {
  ClubProfile,
  DEFAULT_CLUB_PROFILE,
  isClubExperience,
} from '../models/club-profile.model';

const KAYAK_IMAGE = '/assets/images/kayak-club-de-experiencias.jpg';
export const STORAGE_KEY = 'club_experiencias_catalog_v1';
export const PRIVILEGED_STORAGE_KEY = 'club_experiencias_privileged_v1';
export const PRIVILEGED_OWNER_KEY = 'club_experiencias_privileged_v1_owner';
export const DELETED_STORAGE_KEY = 'club_experiencias_deleted_ids_v1';
export const RESERVED_EXPERIENCE_SLUGS = new Set([
  'fotos',
  'prestadores',
  'nueva',
  'editar',
  'admin',
  'login',
  'ingresar',
  'socios',
  'perfil',
  '404',
]);

export const KAYAK_ALBUM_PHOTOS: ExperienceAlbumPhoto[] = [
  {
    id: 'kayak-photo-1',
    url: '/assets/images/kayak-club-de-experiencias.jpg',
    title: 'Travesía en el Dique El Jumeal',
    caption: 'Socios del Club navegando en aguas calmas frente al cordón de las Sierras de Ambato.',
    isCover: true,
    isFeatured: false,
    order: 1,
  },
  {
    id: 'kayak-photo-2',
    url: '/assets/images/dron.jpg',
    title: 'Dique El Jumeal desde el aire',
    caption: 'Vista aérea del Dique El Jumeal y su entorno natural.',
    isCover: false,
    isFeatured: true,
    order: 2,
  },
  {
    id: 'kayak-photo-3',
    url: '/assets/images/amigos.jpg',
    title: 'Travesía compartida',
    caption: 'Una salida en kayak junto a los socios del Club.',
    isCover: false,
    isFeatured: true,
    order: 3,
  },
  {
    id: 'kayak-photo-4',
    url: '/assets/images/dique.jpg',
    title: 'Kayaks en el Dique El Jumeal',
    caption: 'Punto de encuentro para nuestras travesías náuticas.',
    isCover: false,
    isFeatured: false,
    order: 4,
  },
  {
    id: 'kayak-photo-5',
    url: '/assets/images/amigas.jpg',
    title: 'Navegación en el Dique El Jumeal',
    caption: 'Remada tranquila por las aguas del Dique El Jumeal.',
    isCover: false,
    isFeatured: false,
    order: 5,
  },
];

export const KAYAK_DEFAULT_EXPERIENCE: Experience = {
  id: 'exp-kayak',
  slug: 'kayak',
  title: 'Travesía en Kayak & Sunset en el Dique El Jumeal',
  tagline: 'Remada guiada al atardecer con brindis de productos catamarqueños.',
  description:
    'Remada guiada en kayak en aguas calmas rodeadas de quebradas y vegetación de yungas andinas. Presenciamos la caída del sol reflejada en el dique y coronamos la jornada con un brindis y picada de productos artesanales catamarqueños.',
  region: 'Valle Central y Ambato',
  meetingPoint: 'Club Náutico Dique El Jumeal',
  difficulty: 'Baja',
  durationDays: 1,
  durationLabel: '4 Horas (Media Jornada)',
  altitudeMeters: 850,
  bestSeason: 'Octubre a Mayo (Primavera / Verano)',
  priceArs: 65000,
  priceUsd: 70,
  maxSpotsPerGroup: 12,
  coverImage: KAYAK_IMAGE,
  galleryImages: [KAYAK_IMAGE],
  albumPhotos: KAYAK_ALBUM_PHOTOS,
  videoUrl: '/assets/videos/kayak.mp4',
  videoPoster: '/assets/images/kayak-video.png',
  highlights: [
    'Remada guiada por instructores certificados en aguas mansas rodeadas de yungas',
    'Atardecer dorado sobre el espejo de agua del Dique El Jumeal',
    'Brindis de cierre con picada de quesos, fiambres y dulces catamarqueños',
    'Equipo de seguridad homologado y seguro personal incluido',
  ],
  included: [
    'Kayaks de travesía y remos de carbono',
    'Chaleco salvavidas reglamentario PFD',
    'Guía náutico certificado e instructor de apoyo',
    'Degustación de productos regionales y bebidas al atardecer',
    'Seguro de accidentes personales',
  ],
  notIncluded: ['Traslados hasta el Club Náutico', 'Ropa de recambio y toallas personales'],
  dates: ['2026-11-10', '2026-11-17', '2026-11-24'],
  status: 'publicada',
  publicUrl: 'https://experiencias.club/experiencias/kayak',
  isExclusiveClub: true,
  isLocked: false,
  detailRoute: '/experiencias/kayak',
  providerEmail: 'admin@experiencias.club',
  providerName: 'Club de Experiencias',
  providerSlug: 'club-de-experiencias',
  providerPhone: '+54 9 383 456-7890',
  providerCbuAlias: 'EXPERIENCIAS.CLUB.MP',
  providerCuitDni: '30-71829401-4',
  providerBankName: 'Mercado Pago / Banco Nación',
  isClubExperience: true,
};

export const POMEZ_ALBUM_PHOTOS: ExperienceAlbumPhoto[] = [
  {
    id: 'pomez-photo-1',
    url: '/assets/images/catamarca_pomez.jpg',
    title: 'Campo de Piedra Pómez',
    caption: 'Laberinto blanco esculpido por el viento a más de 3.000 msnm.',
    isCover: true,
    isFeatured: false,
    order: 1,
  },
  {
    id: 'pomez-photo-2',
    url: '/assets/images/laguna-verde.jpg',
    title: 'Laguna y Volcanes',
    caption: 'Contrastes turquesas en la alta cordillera catamarqueña.',
    isCover: false,
    isFeatured: true,
    order: 2,
  },
  {
    id: 'pomez-photo-3',
    url: '/assets/images/dron.jpg',
    title: 'Panorámica de la Puna',
    caption: 'Inmensidad andina y formaciones de ceniza volcánica.',
    isCover: false,
    isFeatured: true,
    order: 3,
  },
];

export const POMEZ_DEFAULT_EXPERIENCE: Experience = {
  id: 'exp-pomez',
  slug: 'campo-de-piedra-pomez',
  title: 'Expedición 4x4 Campo de Piedra Pómez & Volcanes',
  tagline: 'Aventura lunar en el laberinto blanco de la Puna catamarqueña a más de 3.000 msnm.',
  description:
    'Travesía en camionetas 4x4 equipadas hacia el majestuoso Campo de Piedra Pómez. Incluye cruce de médanos gigantes, avistaje de vicuñas en Laguna Blanca y merienda andina en el silencio absoluto de la cordillera.',
  region: 'Puna de Atacama',
  meetingPoint: 'Plaza Principal de El Peñón, Antofagasta de la Sierra',
  difficulty: 'Moderada',
  durationDays: 1,
  durationLabel: 'Día completo (10 h)',
  altitudeMeters: 3300,
  bestSeason: 'Todo el año',
  priceArs: 145000,
  priceUsd: 155,
  maxSpotsPerGroup: 8,
  coverImage: '/assets/images/catamarca_pomez.jpg',
  galleryImages: [
    '/assets/images/catamarca_pomez.jpg',
    '/assets/images/laguna-verde.jpg',
    '/assets/images/dron.jpg',
  ],
  albumPhotos: POMEZ_ALBUM_PHOTOS,
  highlights: [
    'Navegación off-road en camionetas 4x4 preparadas con chofer-guía de montaña',
    'Caminata por el campo de ignimbritas blancas más extenso del planeta',
    'Almuerzo campestre y merienda regional con vistas al Volcán Carachi Pampa',
    'Avistaje de fauna protegida en la Reserva de Biósfera Laguna Blanca',
  ],
  included: [
    'Transporte 4x4 homologado ida y vuelta desde El Peñón',
    'Guía matriculado y baqueano local',
    'Picada andina, bebidas y merienda de altura',
    'Seguro de turismo aventura',
  ],
  notIncluded: ['Alojamiento en El Peñón', 'Gastos personales'],
  dates: ['2026-11-12', '2026-11-19', '2026-11-26'],
  status: 'publicada',
  publicUrl: 'https://experiencias.club/experiencias/campo-de-piedra-pomez',
  isExclusiveClub: true,
  isLocked: false,
  detailRoute: '/experiencias/campo-de-piedra-pomez',
  providerEmail: 'admin@experiencias.club',
  providerName: 'Club de Experiencias',
  providerSlug: 'club-de-experiencias',
  isClubExperience: true,
};

export const SEISMILES_ALBUM_PHOTOS: ExperienceAlbumPhoto[] = [
  {
    id: 'seismiles-photo-1',
    url: '/assets/images/laguna-verde.jpg',
    title: 'Ojos Turquesas de la Laguna Verde',
    caption: 'Reflejos minerales sobre la laguna de altura en el Paso de San Francisco.',
    isCover: true,
    isFeatured: false,
    order: 1,
  },
  {
    id: 'seismiles-photo-2',
    url: '/assets/images/catamarca_pomez.jpg',
    title: 'Volcanes Gigantes',
    caption: 'Cumbres de más de 6.000 metros custodiando el horizonte cordillerano.',
    isCover: false,
    isFeatured: true,
    order: 2,
  },
  {
    id: 'seismiles-photo-3',
    url: '/assets/images/dron.jpg',
    title: 'Paso de San Francisco',
    caption: 'Inmensidad cordillerana en la Ruta de los Seismiles.',
    isCover: false,
    isFeatured: true,
    order: 3,
  },
];

export const SEISMILES_DEFAULT_EXPERIENCE: Experience = {
  id: 'exp-seismiles',
  slug: 'ruta-de-los-seismiles',
  title: 'Ruta de los Seismiles & Laguna Verde',
  tagline:
    'Travesía paisajística entre los volcanes más altos del planeta y lagunas turquesas a 4.000 msnm.',
  description:
    'Expedición de alta montaña por la emblemática Ruta Nacional 60 hacia el Paso de San Francisco. Contemplamos gigantes de más de 6.000 m como el Pissis, Ojos del Salado e Incahuasi, culminando en los reflejos minerales de la Laguna Verde.',
  region: 'Tinogasta & Fiambalá',
  meetingPoint: 'Plaza Principal de Fiambalá',
  difficulty: 'Moderada',
  durationDays: 1,
  durationLabel: 'Día completo (9 h)',
  altitudeMeters: 4100,
  bestSeason: 'Noviembre a Abril',
  priceArs: 160000,
  priceUsd: 170,
  maxSpotsPerGroup: 10,
  coverImage: '/assets/images/laguna-verde.jpg',
  galleryImages: [
    '/assets/images/laguna-verde.jpg',
    '/assets/images/catamarca_pomez.jpg',
    '/assets/images/dron.jpg',
  ],
  albumPhotos: SEISMILES_ALBUM_PHOTOS,
  highlights: [
    'Circuito panorámico frente a los conos volcánicos más altos del mundo',
    'Termas y humedales de altura custodiados por flamencos andinos',
    'Paradas fotográficas en refugios históricos de montaña',
    'Avistaje de fauna autóctona de alta montaña',
  ],
  included: [
    'Vehículo 4x4 con chofer profesional habilitado',
    'Guía de alta montaña habilitado',
    'Desayuno de campo y vianda gourmet de altura',
    'Seguro de actividad',
  ],
  notIncluded: ['Noche previa en Fiambalá', 'Equipamiento térmico personal'],
  dates: ['2026-11-15', '2026-11-22', '2026-11-29'],
  status: 'publicada',
  publicUrl: 'https://experiencias.club/experiencias/ruta-de-los-seismiles',
  isExclusiveClub: true,
  isLocked: false,
  detailRoute: '/experiencias/ruta-de-los-seismiles',
  providerEmail: 'admin@experiencias.club',
  providerName: 'Club de Experiencias',
  providerSlug: 'club-de-experiencias',
  isClubExperience: true,
};

export const SEEDED_REMOVED_EXPERIENCE_ID = 'req-sunset-las-pirquitas';
export const SEEDED_REMOVED_EXPERIENCE_SLUG =
  'travesia-en-kayak-nocturna-luna-llena-en-el-jumeal';

export const DEFAULT_EXPERIENCES: Experience[] = [];

@Injectable({
  providedIn: 'root',
})
export class ExperienceService {
  private readonly supabase = inject(SUPABASE_CLIENT);
  private readonly _experiences = signal<Experience[]>(this.loadInitialExperiences());
  private readonly _hasRemoteExperiences = signal(false);

  readonly experiences = this._experiences.asReadonly();
  readonly publishedExperiences = computed(() =>
    this._experiences().filter((e) => e.status === 'publicada'),
  );

  getPublishedExperienceBySlug(slug: string): Experience | undefined {
    if (!slug) return undefined;
    const clean = slug.trim().toLowerCase();
    return this.publishedExperiences().find((e: Experience) => {
      const expSlug = (e.slug || '').trim().toLowerCase();
      const expId = (e.id || '').trim().toLowerCase();
      return (
        expSlug === clean ||
        expId === clean ||
        expId === `exp-${clean}` ||
        clean === `exp-${expSlug}`
      );
    });
  }

  getPublishedExperienceById(id: string): Experience | undefined {
    return this.publishedExperiences().find((e: Experience) => e.id === id || e.slug === id);
  }

  getExperiencesByProvider(
    providerIdentity:
      | string
      | {
          slug?: string | null;
          email?: string | null;
          agency?: string | null;
          name?: string | null;
        },
  ): Experience[] {
    const normalizeAgency = (val: string) =>
      val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

    let querySlug = '';
    let queryEmail = '';
    let queryAgencyNorm = '';

    if (typeof providerIdentity === 'string') {
      const clean = providerIdentity.trim().toLowerCase();
      if (!clean) return [];
      querySlug = clean;
      queryEmail = clean;
      queryAgencyNorm = normalizeAgency(clean);
    } else if (providerIdentity && typeof providerIdentity === 'object') {
      querySlug = (providerIdentity.slug || '').trim().toLowerCase();
      queryEmail = (providerIdentity.email || '').trim().toLowerCase();
      const rawAgency = (providerIdentity.agency || providerIdentity.name || '').trim();
      queryAgencyNorm = rawAgency ? normalizeAgency(rawAgency) : '';
    } else {
      return [];
    }

    if (!querySlug && !queryEmail && !queryAgencyNorm) return [];

    return this.publishedExperiences().filter((e) => {
      const expSlug = (e.providerSlug || '').trim().toLowerCase();
      const expEmail = (e.providerEmail || '').trim().toLowerCase();
      const expAgency = (e.providerName || '').trim();
      const expAgencyNorm = expAgency ? normalizeAgency(expAgency) : '';

      if (querySlug && expSlug && expSlug === querySlug) return true;
      if (queryEmail && expEmail && expEmail === queryEmail) return true;
      if (queryAgencyNorm && expAgencyNorm && expAgencyNorm === queryAgencyNorm) return true;
      return false;
    });
  }
  private activeAccountIdentifier: string | null = null;
  readonly hasRemoteExperiences = this._hasRemoteExperiences.asReadonly();
  readonly remoteLoadPromise: Promise<boolean> = isSupabaseConfigured()
    ? this.loadFromSupabase()
    : Promise.resolve(true);

  constructor() {
    if (typeof window !== 'undefined') {
      this.activeAccountIdentifier = this.resolveActiveAccount();
      window.addEventListener('online', () => {
        void this.reloadFromSupabase();
      });
    }
    if (isSupabaseConfigured()) {
      try {
        this.supabase.auth?.onAuthStateChange?.((event: string, session: any) => {
          const newUserId = session?.user?.id || session?.user?.email;
          const newAccount = newUserId
            ? String(newUserId).trim().toLowerCase()
            : this.resolveActiveAccount();

          if (event === 'SIGNED_OUT') {
            this.clearPrivilegedCache();
            this.activeAccountIdentifier = null;
          } else if (
            this.activeAccountIdentifier &&
            newAccount &&
            this.activeAccountIdentifier !== newAccount
          ) {
            const prior = this.activeAccountIdentifier;
            this.activeAccountIdentifier = newAccount;
            this.clearAccountCache(prior);
            void this.reloadFromSupabase();
          } else {
            this.activeAccountIdentifier = newAccount;
          }
        });
      } catch {
        // ignore
      }
    }
  }

  async reloadFromSupabase(): Promise<boolean> {
    return this.loadFromSupabase();
  }

  getExperienceBySlug(slug: string): Experience | undefined {
    return this._experiences().find(
      (e) => e.slug === slug || e.id === slug || e.id === `exp-${slug}`,
    );
  }

  getExperienceById(id: string): Experience | undefined {
    return this._experiences().find((e) => e.id === id || e.slug === id);
  }

  /**
   * Comprueba si un objeto contiene todos los campos obligatorios para constituir
   * un registro íntegro de Experiencia.
   *
   * @param exp Objeto a validar.
   * @returns `true` si el objeto es una Experiencia completa.
   */
  private isCompleteExperience(exp: any): exp is Experience {
    if (!exp || typeof exp !== 'object') return false;
    return (
      typeof exp.id === 'string' &&
      exp.id.trim() !== '' &&
      typeof exp.slug === 'string' &&
      exp.slug.trim() !== '' &&
      typeof exp.title === 'string' &&
      exp.title.trim() !== '' &&
      typeof exp.tagline === 'string' &&
      typeof exp.description === 'string' &&
      typeof exp.region === 'string' &&
      typeof exp.difficulty === 'string' &&
      typeof exp.durationLabel === 'string' &&
      typeof exp.priceArs === 'number' &&
      typeof exp.maxSpotsPerGroup === 'number' &&
      typeof exp.coverImage === 'string' &&
      exp.coverImage.trim() !== ''
    );
  }

  updateFavoritesCount(experienceIdOrSlug: string, count: number): void {
    const norm = (experienceIdOrSlug || '').trim().toLowerCase();
    if (!norm) return;
    this._experiences.update((list) =>
      list.map((exp) => {
        if ((exp.id || '').toLowerCase() === norm || (exp.slug || '').toLowerCase() === norm) {
          return { ...exp, favoritesCount: count };
        }
        return exp;
      })
    );
  }

  /**
   * Actualiza una experiencia existente en el catálogo local y la sincroniza
   * de forma persistente con Supabase. Preserva el identificador original de la
   * experiencia en caso de coincidencias por slug o formato alternativo.
   *
   * @param updated Registro parcial o completo que contiene las modificaciones.
   */
  async updateExperience(updated: Partial<Experience> & { id: string }): Promise<void> {
    const prevList = this._experiences();
    let index = prevList.findIndex((e) => e.id === updated.id);
    if (index === -1 && updated.slug) {
      index = prevList.findIndex((e) => e.slug === updated.slug);
    }
    if (index === -1) {
      index = prevList.findIndex(
        (e) => e.id === `exp-${updated.id}` || `exp-${e.id}` === updated.id,
      );
    }

    if (index === -1 && !this.isCompleteExperience(updated)) {
      throw new Error(`Experiencia con ID ${updated.id} no encontrada.`);
    }

    const current = (index !== -1 ? prevList[index] : (updated as Experience)) || ({} as Experience);
    const rawCover = updated.coverImage || current.coverImage || KAYAK_IMAGE;
    const safeCoverImage = typeof rawCover === 'string' && rawCover.startsWith('blob:')
      ? KAYAK_IMAGE
      : rawCover;

    const rawVideo = updated.videoUrl !== undefined ? updated.videoUrl : current.videoUrl;
    const safeVideoUrl = typeof rawVideo === 'string' && rawVideo.startsWith('blob:')
      ? ''
      : (rawVideo || '');

    const rawAlbum = updated.albumPhotos !== undefined ? updated.albumPhotos : current.albumPhotos;
    const safeAlbumPhotos = Array.isArray(rawAlbum)
      ? rawAlbum.map((p) => ({
          ...p,
          url: typeof p.url === 'string' && p.url.startsWith('blob:') ? KAYAK_IMAGE : p.url,
        }))
      : rawAlbum;

    const replacementGallery = updated.galleryImages !== undefined
      ? updated.galleryImages
      : (updated.albumPhotos !== undefined && Array.isArray(safeAlbumPhotos)
          ? safeAlbumPhotos.map((p) => p.url)
          : current.galleryImages);

    const resultingCategory = updated.category || current.category || 'expediciones';
    const resultingSlug = updated.slug || current.slug;
    const routePrefix = resultingCategory === 'hospedajes' ? '/experiencias/hospedajes' : '/experiencias';

    const merged: Experience = {
      ...current,
      ...updated,
      id: index !== -1 ? current.id : updated.id,
      category: resultingCategory,
      coverImage: safeCoverImage,
      videoUrl: safeVideoUrl || undefined,
      albumPhotos: safeAlbumPhotos,
      galleryImages: replacementGallery,
      detailRoute: `${routePrefix}/${resultingSlug}`,
      publicUrl: `https://experiencias.club${routePrefix}/${resultingSlug}`,
    };

    const nextList = [...prevList];
    if (index !== -1) {
      nextList[index] = merged;
    } else {
      nextList.push(merged);
    }
    this._experiences.set(nextList);
    this.persistToLocalStorage(nextList);

    if (isSupabaseConfigured()) {
      try {
        const payload: Record<string, unknown> = {
          title: merged.title,
          tagline: merged.tagline,
          description: merged.description,
          region: merged.region,
          meeting_point: merged.meetingPoint || '',
          difficulty: merged.difficulty,
          duration_label: merged.durationLabel,
          price_ars: merged.priceArs,
          price_usd: merged.priceUsd,
          capacity_per_date: merged.maxSpotsPerGroup,
          cover_image: safeCoverImage,
          video_url: safeVideoUrl,
          video_poster: merged.videoPoster || '',
          altitude_meters: merged.altitudeMeters || 0,
          dates: merged.dates || [],
          highlights: merged.highlights || [],
          included: merged.included || [],
          not_included: merged.notIncluded || [],
          status: merged.status || 'publicada',
          public_url: merged.publicUrl || '',
          updated_at: new Date().toISOString(),
        };

        if (merged.slug) {
          payload['slug'] = merged.slug;
        }

        if (Object.prototype.hasOwnProperty.call(updated, 'meetingPointUrl')) {
          // Preserve explicit empty string; omit only when the field is absent
          payload['meeting_point_url'] = updated.meetingPointUrl;
        }

        if (Object.prototype.hasOwnProperty.call(updated, 'kicker')) {
          payload['kicker'] = updated.kicker;
        } else if (merged.kicker !== undefined) {
          payload['kicker'] = merged.kicker;
        }

        if (Object.prototype.hasOwnProperty.call(updated, 'bestSeason')) {
          payload['best_season'] = updated.bestSeason;
        } else if (merged.bestSeason !== undefined) {
          payload['best_season'] = merged.bestSeason;
        }

        if (Object.prototype.hasOwnProperty.call(updated, 'itinerary')) {
          payload['itinerary'] = updated.itinerary;
        } else if (merged.itinerary !== undefined) {
          payload['itinerary'] = merged.itinerary;
        }

        if (Object.prototype.hasOwnProperty.call(updated, 'promosAndPricing')) {
          payload['promos_and_pricing'] = updated.promosAndPricing;
        } else if (merged.promosAndPricing !== undefined) {
          payload['promos_and_pricing'] = merged.promosAndPricing;
        }
        if (Object.prototype.hasOwnProperty.call(updated, 'pricingPacks')) {
          payload['pricing_packs'] = updated.pricingPacks ?? [];
        }
        if (safeAlbumPhotos) {
          payload['album_photos'] = safeAlbumPhotos;
          payload['gallery_images'] = replacementGallery || safeAlbumPhotos.map((p) => p.url);
        } else if (replacementGallery !== undefined) {
          payload['gallery_images'] = replacementGallery;
        }

        if (merged.dateSlots !== undefined) {
          payload['date_slots'] = merged.dateSlots;
        }

        if (merged.providerName !== undefined) {
          payload['provider_name'] = merged.providerName;
        }

        if (merged.providerPhone !== undefined) {
          payload['provider_phone'] = merged.providerPhone;
        }

        if (merged.providerEmail !== undefined) {
          payload['provider_email'] = merged.providerEmail;
        }

        if (updated.providerSlug !== undefined) {
          payload['provider_slug'] = updated.providerSlug || null;
        }

        if (merged.reviewedAt !== undefined) {
          payload['reviewed_at'] = merged.reviewedAt;
        }

        if (merged.displayLocation !== undefined) {
          payload['display_location'] = merged.displayLocation;
        }

        if (merged.category !== undefined) {
          payload['category'] = merged.category;
        }

        if (merged.mpCollectorId !== undefined || merged.mpConnected !== undefined) {
          let notesObj: Record<string, any> = {};
          if (merged.notes && typeof merged.notes === 'object' && !Array.isArray(merged.notes)) {
            notesObj = { ...(merged.notes as Record<string, any>) };
          } else if (typeof merged.notes === 'string') {
            const rawNotes = merged.notes.trim();
            if (rawNotes) {
              try {
                const parsed = JSON.parse(rawNotes);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                  notesObj = { ...parsed };
                } else {
                  notesObj = { text: rawNotes };
                }
              } catch {
                notesObj = { text: rawNotes };
              }
            }
          }

          if (updated.notes !== undefined) {
            if (typeof updated.notes === 'object' && updated.notes !== null && !Array.isArray(updated.notes)) {
              notesObj = { ...notesObj, ...(updated.notes as Record<string, any>) };
            } else if (typeof updated.notes === 'string') {
              const cleanUpdatedNotes = updated.notes.trim();
              if (cleanUpdatedNotes) {
                try {
                  const parsedUpdates = JSON.parse(cleanUpdatedNotes);
                  if (parsedUpdates && typeof parsedUpdates === 'object' && !Array.isArray(parsedUpdates)) {
                    notesObj = { ...notesObj, ...parsedUpdates };
                  } else {
                    notesObj['text'] = cleanUpdatedNotes;
                  }
                } catch {
                  notesObj['text'] = cleanUpdatedNotes;
                }
              } else {
                delete notesObj['text'];
              }
            }
          }

          if (merged.mpCollectorId !== undefined) notesObj['mp_collector_id'] = merged.mpCollectorId;
          if (merged.mpConnected !== undefined) notesObj['mp_connected'] = merged.mpConnected;
          payload['notes'] = JSON.stringify(notesObj);
        } else if (updated.notes !== undefined) {
          payload['notes'] = updated.notes;
        }

        let payloadToUse: Record<string, any> = { ...payload };

        let { data, error } = await this.supabase
          .from('experiencias')
          .update(payloadToUse as any)
          .eq('id', merged.id)
          .select();

        if (error && (/meeting_point_url/.test(error.message || '') || /display_location/.test(error.message || '') || /category/.test(error.message || '') || /pricing_packs/.test(error.message || ''))) {
          const hasMeetingPointUrlErr = /meeting_point_url/.test(error.message || '');
          const hasDisplayLocationErr = /display_location/.test(error.message || '');
          const hasCategoryErr = /category/.test(error.message || '');
          const hasPricingPacksErr = /pricing_packs/.test(error.message || '');

          if (hasMeetingPointUrlErr && updated.meetingPointUrl !== undefined && String(updated.meetingPointUrl).trim() !== '') {
            // A non-empty value was supplied: reject the update rather than committing without it
            throw error;
          }

          if (hasDisplayLocationErr && updated.displayLocation !== undefined) {
            // The selected placement cannot be persisted because display_location is not supported in remote DB
            throw new Error(
              'No se pudo persistir la ubicación en catálogo: la columna display_location no está disponible en la base de datos remota.',
            );
          }

          if (hasCategoryErr && updated.category !== undefined) {
            // An explicit category change was supplied: reject the update rather than committing without it
            throw error;
          }

          if (
            hasPricingPacksErr &&
            Object.prototype.hasOwnProperty.call(updated, 'pricingPacks') &&
            Array.isArray(updated.pricingPacks) &&
            updated.pricingPacks.length > 0
          ) {
            // An explicit non-empty pricingPacks change was supplied: reject rather than dropping it silently
            throw new Error(
              'No se pudieron guardar los packs promocionales: la columna pricing_packs no está disponible en la base de datos remota.',
            );
          }

          // Columna aún no migrada en la base remota: reintenta omitiendo solo el campo rechazado
          if (hasMeetingPointUrlErr) {
            delete payloadToUse['meeting_point_url'];
          }
          if (hasDisplayLocationErr) {
            delete payloadToUse['display_location'];
          }
          if (hasCategoryErr) {
            delete payloadToUse['category'];
          }
          if (hasPricingPacksErr) {
            delete payloadToUse['pricing_packs'];
          }

          ({ data, error } = (await this.supabase
            .from('experiencias')
            .update(payloadToUse as any)
            .eq('id', merged.id)
            .select()) as any);
        }

        // Si no se encontró por ID, intentar por el slug anterior (para permitir cambios seguros de slug) o el nuevo
        const previousSlug = current.slug || merged.slug;
        if (!error && (!data || data.length === 0) && previousSlug) {
          ({ data, error } = (await this.supabase
            .from('experiencias')
            .update(payloadToUse as any)
            .eq('slug', previousSlug)
            .select()) as any);
        }

        if (error || !data || data.length === 0) {
          throw error || new Error(`No se encontró la experiencia remota con id ${merged.id}`);
        }

        const targetProviderEmail = (
          updated.providerEmail ||
          merged.providerEmail ||
          (data && (data[0] as any)?.provider_email) ||
          ''
        )
          .trim()
          .toLowerCase();

        if (
          targetProviderEmail &&
          (updated.providerCbuAlias !== undefined ||
            updated.providerCuitDni !== undefined ||
            updated.providerBankName !== undefined)
        ) {
          const providerBankingUpdate: Record<string, any> = {};
          if (updated.providerCbuAlias !== undefined) {
            providerBankingUpdate['cbu_alias'] = updated.providerCbuAlias;
          }
          if (updated.providerCuitDni !== undefined) {
            providerBankingUpdate['cuit_dni'] = updated.providerCuitDni;
          }
          if (updated.providerBankName !== undefined) {
            providerBankingUpdate['bank_name'] = updated.providerBankName;
          }

          if (Object.keys(providerBankingUpdate).length > 0) {
            const { error: pbErr } = await (this.supabase.from('prestadores') as any)
              .update(providerBankingUpdate)
              .eq('email', targetProviderEmail);
            if (pbErr) {
              console.warn('[ExperienceService] Error al actualizar prestadores:', pbErr);
            }
          }
        }
      } catch (err) {
        console.warn('[ExperienceService] Fallo remoto:', err);
        this._experiences.set(prevList);
        this.persistToLocalStorage(prevList);
        throw err;
      }
    }
  }

  /**
   * Actualiza explícitamente el álbum de fotos de una experiencia,
   * sincronizando la galería de imágenes (galleryImages) y removiendo fotos omitidas.
   */
  async updateExperienceAlbum(
    experienceId: string,
    photos: ExperienceAlbumPhoto[],
  ): Promise<void> {
    const replacementGallery = photos.map((p) => p.url);
    await this.updateExperience({
      id: experienceId,
      albumPhotos: photos,
      galleryImages: replacementGallery,
    });
  }

  async createExperience(newExp: Experience): Promise<void> {
    const list = this._experiences();
    let slug =
      newExp.slug ||
      newExp.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    if (!slug) {
      throw new Error('El slug de la experiencia no puede estar vacío.');
    }
    if (RESERVED_EXPERIENCE_SLUGS.has(slug.toLowerCase())) {
      slug = `${slug}-exp`;
    }
    const baseSlug = slug;
    let suffix = 2;
    while (list.some((e) => e.slug.toLowerCase() === slug.toLowerCase())) {
      slug = `${baseSlug}-${suffix++}`;
    }

    let initialNotes = newExp.notes;
    if (newExp.mpCollectorId !== undefined || newExp.mpConnected !== undefined) {
      let notesObj: Record<string, any> = {};
      if (newExp.notes && typeof newExp.notes === 'object' && !Array.isArray(newExp.notes)) {
        notesObj = { ...(newExp.notes as Record<string, any>) };
      } else if (typeof newExp.notes === 'string') {
        const rawNotes = newExp.notes.trim();
        if (rawNotes) {
          try {
            const parsed = JSON.parse(rawNotes);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              notesObj = { ...parsed };
            } else {
              notesObj = { text: rawNotes };
            }
          } catch {
            notesObj = { text: rawNotes };
          }
        }
      }
      if (newExp.mpCollectorId !== undefined) notesObj['mp_collector_id'] = newExp.mpCollectorId;
      if (newExp.mpConnected !== undefined) notesObj['mp_connected'] = newExp.mpConnected;
      initialNotes = JSON.stringify(notesObj);
    }

    const experience: Experience = {
      ...newExp,
      notes: initialNotes,
      slug,
      detailRoute: `/experiencias/${slug}`,
      publicUrl: `https://experiencias.club/experiencias/${slug}`,
      status: newExp.status || 'publicada',
      isExclusiveClub: true,
      isLocked: false,
      pendingRemoteSync: true,
    };

    const nextList = [experience, ...list];
    this.removeDeletedId(experience.id, experience.slug);
    this._experiences.set(nextList);
    this.persistToLocalStorage(nextList);

    if (isSupabaseConfigured()) {
      try {
        const payload: Record<string, unknown> = {
          id: experience.id,
          slug: experience.slug,
          title: experience.title,
          kicker: experience.kicker || '',
          tagline: experience.tagline,
          description: experience.description,
          region: experience.region,
          meeting_point: experience.meetingPoint || '',
          meeting_point_url: experience.meetingPointUrl || '',
          difficulty: experience.difficulty,
          duration_label: experience.durationLabel,
          price_ars: experience.priceArs,
          price_usd: experience.priceUsd,
          capacity_per_date: experience.maxSpotsPerGroup,
          cover_image: experience.coverImage || KAYAK_IMAGE,
          video_url: experience.videoUrl || '',
          video_poster: experience.videoPoster || '',
          altitude_meters: experience.altitudeMeters || 0,
          best_season: experience.bestSeason || '',
          itinerary: experience.itinerary || '',
          promos_and_pricing: experience.promosAndPricing || '',
          pricing_packs: experience.pricingPacks || [],
          dates: experience.dates || [],
          highlights: experience.highlights || [],
          included: experience.included || [],
          not_included: experience.notIncluded || [],
          status: experience.status,
          category: experience.category,
          display_location: experience.displayLocation || 'destacada',
          public_url: experience.publicUrl,
          album_photos: experience.albumPhotos || [],
          gallery_images: experience.galleryImages || (experience.albumPhotos || []).map((p) => p.url),
          provider_name: experience.providerName || null,
          provider_phone: experience.providerPhone || null,
          provider_email: experience.providerEmail || null,
          provider_slug: experience.providerSlug || null,
        };

        if (experience.notes !== undefined) {
          payload['notes'] = experience.notes;
        }

        if (experience.category !== undefined) {
          payload['category'] = experience.category;
        }

        // Asegurar que el prestador exista en prestadores para evitar fallos de clave foránea
        const targetEmail = (experience.providerEmail || '').trim().toLowerCase();
        if (targetEmail) {
          try {
            const { data: existingPA } = await (this.supabase.from('prestadores') as any)
              .select('id, email')
              .eq('email', targetEmail)
              .maybeSingle();

            if (!existingPA) {
              await (this.supabase.from('prestadores') as any).insert({
                email: targetEmail,
                name: experience.providerName || targetEmail.split('@')[0],
                agency: experience.providerName || '',
                slug: experience.providerSlug || targetEmail.split('@')[0],
                phone: experience.providerPhone || '',
                cbu_alias: experience.providerCbuAlias || '',
                cuit_dni: experience.providerCuitDni || '',
                bank_name: experience.providerBankName || '',
                status: 'pendiente',
                active: false,
              });
            }
          } catch (paErr) {
            console.warn('[ExperienceService] Error asegurando prestadores:', paErr);
          }
        }

        const optionalColumns: string[] = [
          'meeting_point_url',
          'itinerary',
          'kicker',
          'best_season',
          'promos_and_pricing',
          'pricing_packs',
          'display_location',
          'category',
        ];

        let insertPayload: Record<string, any> = { ...payload };
        let migrationError: any = null;
        let error: any = null;

        while (true) {
          const res = await this.supabase.from('experiencias').insert(insertPayload as any);
          const err = res.error;
          if (!err) {
            if (migrationError) {
              error = migrationError;
            } else {
              error = null;
            }
            break;
          }

          if (
            insertPayload['provider_email'] &&
            /violates foreign key constraint.*fk_experiencias_provider_email|foreign key.*provider_email/i.test(
              err.message || '',
            )
          ) {
            console.warn(
              '[ExperienceService] Foreign key constraint violada para provider_email. Publicando experiencia como oficial/desvinculada de email ajeno para evitar limbo...',
            );
            delete insertPayload['provider_email'];
            continue;
          }

          const missingCol = optionalColumns.find(
            (col) =>
              insertPayload[col] !== undefined &&
              new RegExp(`column.*"?${col}"?.*does not exist|${col}`, 'i').test(err.message || ''),
          );

          if (missingCol) {
            if (missingCol === 'display_location') {
              const hasExplicitNonDefaultPlacement =
                experience.displayLocation !== undefined && experience.displayLocation !== 'destacada';
              if (hasExplicitNonDefaultPlacement) {
                error = err;
                break;
              }
              delete insertPayload['display_location'];
              continue;
            }

            const isNonEmpty = Boolean(
              insertPayload[missingCol] && String(insertPayload[missingCol]).trim(),
            );
            if (isNonEmpty) {
              error = err;
              break;
            }
            delete insertPayload[missingCol];
            continue;
          }

          error = err;
          break;
        }
        if (error) {
          throw error;
        }

        // Marcar la experiencia como sincronizada remotamente y actualizar localStorage
        this._experiences.update((cur) =>
          cur.map((e) =>
            e.id === experience.id || e.slug === experience.slug
              ? { ...e, pendingRemoteSync: false }
              : e,
          ),
        );
        this.persistToLocalStorage(this._experiences());

        const targetProviderEmail = (experience.providerEmail || '').trim().toLowerCase();
        if (
          targetProviderEmail &&
          (experience.providerCbuAlias || experience.providerCuitDni || experience.providerBankName)
        ) {
          const providerBankingUpdate: Record<string, any> = {};
          if (experience.providerCbuAlias !== undefined) {
            providerBankingUpdate['cbu_alias'] = experience.providerCbuAlias;
          }
          if (experience.providerCuitDni !== undefined) {
            providerBankingUpdate['cuit_dni'] = experience.providerCuitDni;
          }
          if (experience.providerBankName !== undefined) {
            providerBankingUpdate['bank_name'] = experience.providerBankName;
          }

          if (Object.keys(providerBankingUpdate).length > 0) {
            const { error: pbErr } = await (this.supabase.from('prestadores') as any)
              .update(providerBankingUpdate)
              .eq('email', targetProviderEmail);
            if (pbErr) {
              console.warn(
                '[ExperienceService] Error al actualizar prestadores en createExperience:',
                pbErr,
              );
            }
          }
        }
      } catch (err) {
        console.error('[ExperienceService] Fallo al crear experiencia remota en Supabase:', err);
        this._experiences.set(list);
        this.persistToLocalStorage(list);
        throw err;
      }
    }
  }

  async toggleExperienceStatus(
    id: string,
    newStatus: 'publicada' | 'oculta' | 'rechazada' | 'borrador' | 'pendiente',
  ): Promise<void> {
    await this.updateExperience({ id, status: newStatus });
  }

  async deleteExperience(id: string): Promise<void> {
    const prevList = this._experiences();
    const expToDelete = prevList.find((e) => e.id === id || e.slug === id);
    const targetId = expToDelete?.id ?? id;
    const originalSlug = expToDelete?.slug;
    const list = prevList.filter((e) => e.id !== targetId && e.slug !== id);

    this.recordDeletedId(targetId, originalSlug);
    this._experiences.set(list);
    this.persistToLocalStorage(list);

    if (isSupabaseConfigured()) {
      try {
        let softDeletedViaRpc = false;
        try {
          if (typeof (this.supabase as any).rpc === 'function') {
            const { data: rpcRes, error: rpcErr } = await (this.supabase as any).rpc(
              'admin_soft_delete_experience',
              { p_experience_id: targetId },
            );
            if (!rpcErr && rpcRes && (rpcRes as any).status !== 'error') {
              softDeletedViaRpc = true;
            }
          }
        } catch {
          // Fallback a actualización directa si la función RPC no está disponible aún
        }

        if (!softDeletedViaRpc) {
          let notesObj: Record<string, any> = {};
          const rawNotes = (expToDelete?.notes || '').trim();
          if (rawNotes) {
            if (rawNotes.startsWith('{')) {
              try {
                const parsed = JSON.parse(rawNotes);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                  notesObj = { ...parsed };
                } else {
                  notesObj = { text: rawNotes };
                }
              } catch {
                notesObj = { text: rawNotes };
              }
            } else {
              notesObj = { text: rawNotes };
            }
          }
          notesObj['deleted'] = true;
          notesObj['deleted_at'] = new Date().toISOString();
          notesObj['deleted_by'] = 'admin_portal';
          if (originalSlug) {
            notesObj['original_slug'] = originalSlug;
          }

          // Liberar el slug para permitir que se cree una nueva experiencia con la misma ruta
          const freedSlug = originalSlug
            ? `${originalSlug}--deleted-${Date.now()}`
            : undefined;

          const updatePayload: Record<string, any> = {
            status: 'oculta',
            display_location: 'no_listada',
            notes: JSON.stringify(notesObj),
            deleted_at: new Date().toISOString(),
          };
          if (freedSlug) {
            updatePayload['slug'] = freedSlug;
          }

          const { data, error } = await (this.supabase.from('experiencias') as any)
            .update(updatePayload)
            .eq('id', targetId)
            .select('id');

          if (error || !data || data.length === 0) {
            throw error || new Error(`No se encontró la experiencia remota con id ${targetId}`);
          }
        }
      } catch (err) {
        console.warn('[ExperienceService] Fallo al marcar como eliminada en Supabase:', err);
        this.removeDeletedId(targetId, originalSlug);
        this._experiences.set(prevList);
        this.persistToLocalStorage(prevList);
        throw err;
      }
    }
  }

  private getDeletedIds(): Set<string> {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(DELETED_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            return new Set(parsed);
          }
        }
      } catch {
        // Fallback
      }
    }
    return new Set<string>();
  }

  private recordDeletedId(id: string, slug?: string): void {
    if (typeof window !== 'undefined') {
      try {
        const set = this.getDeletedIds();
        set.add(id);
        if (slug) set.add(slug);
        localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(Array.from(set)));
      } catch {
        // Ignorar quota errors
      }
    }
  }

  private removeDeletedId(id: string, slug?: string): void {
    if (typeof window !== 'undefined') {
      try {
        const set = this.getDeletedIds();
        set.delete(id);
        if (slug) set.delete(slug);
        localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(Array.from(set)));
      } catch {
        // Ignorar quota errors
      }
    }
  }

  getClubProfile(): ClubProfile {
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

  /**
   * Sincroniza todas las experiencias pertenecientes al Club con la información
   * actualizada del Perfil Oficial del Club (nombre, teléfono, CBU/Alias bancario, etc.)
   * tanto en el estado reactivo local como remotamente en la base de datos de Supabase.
   *
   * @param profile Perfil oficial institucional del Club de Experiencias.
   */
  syncClubExperiencesWithProfile(profile: ClubProfile): void {
    const list = this._experiences().map((exp) => {
      if (isClubExperience(exp)) {
        return {
          ...exp,
          isClubExperience: true,
          providerName: profile.name,
          providerSlug: profile.slug,
          providerEmail: profile.email,
          providerPhone: profile.phone,
          providerCbuAlias: profile.cbuAlias,
          providerCuitDni: profile.cuitDni,
          providerBankName: profile.bankName,
        };
      }
      return exp;
    });
    this._experiences.set(list);
    this.persistToLocalStorage(list);

    if (isSupabaseConfigured()) {
      const escapedEmail = (profile.email || '').trim().replace(/["\\]/g, '\\$&');
      const emailFilter = escapedEmail ? `,provider_email.eq."${escapedEmail}"` : '';
      const orFilter = `slug.eq.kayak,slug.eq.exp-kayak,provider_slug.eq.club-de-experiencias${emailFilter}`;

      (this.supabase.from('experiencias') as any)
        .update({
          provider_name: profile.name,
          provider_slug: profile.slug,
          provider_email: profile.email,
          provider_phone: profile.phone,
        })
        .or(orFilter)
        .then(
          ({ error }: { error: any }) => {
            if (error) {
              console.warn(
                '[ExperienceService] Error al sincronizar experiencias del Club en Supabase:',
                error,
              );
            }
          },
          (err: any) => {
            console.warn(
              '[ExperienceService] Excepción al sincronizar experiencias del Club en Supabase:',
              err,
            );
          },
        );
    }
  }

  private loadInitialExperiences(): Experience[] {
    const deletedIds = this.getDeletedIds();
    let localExperiences: Experience[] = [];

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Experience[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            const cleaned = parsed.filter(
              (e) =>
                e &&
                e.id !== SEEDED_REMOVED_EXPERIENCE_ID &&
                e.slug !== SEEDED_REMOVED_EXPERIENCE_SLUG &&
                !deletedIds.has(e.id) &&
                !deletedIds.has(e.slug),
            );
            if (cleaned.length !== parsed.length) {
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
              } catch {
                // ignore
              }
            }
            localExperiences = this.sanitizeForPublicCatalog(cleaned);
          }
        }
      } catch {
        // Fallback
      }

      const activeAccount = this.syncActiveAccount();
      if (activeAccount) {
        try {
          const privKey = this.getPrivilegedStorageKey(activeAccount);
          const recordedOwner = localStorage.getItem(PRIVILEGED_OWNER_KEY);

          // Discard legacy/shared cache if its recorded owner differs from current identity
          if (recordedOwner && recordedOwner !== activeAccount) {
            localStorage.removeItem(PRIVILEGED_STORAGE_KEY);
            localStorage.removeItem(PRIVILEGED_OWNER_KEY);
          }

          let privRaw = localStorage.getItem(privKey);
          if (!privRaw && (!recordedOwner || recordedOwner === activeAccount)) {
            privRaw = localStorage.getItem(PRIVILEGED_STORAGE_KEY);
          }

          if (privRaw) {
            const parsedJson = JSON.parse(privRaw);
            const rawOwner =
              parsedJson && typeof parsedJson === 'object' && !Array.isArray(parsedJson)
                ? parsedJson.owner
                : null;

            if (rawOwner && rawOwner !== activeAccount) {
              localStorage.removeItem(privKey);
              localStorage.removeItem(PRIVILEGED_STORAGE_KEY);
              localStorage.removeItem(PRIVILEGED_OWNER_KEY);
            } else {
              const privParsed: Experience[] = Array.isArray(parsedJson)
                ? parsedJson
                : Array.isArray(parsedJson?.items)
                  ? parsedJson.items
                  : [];

              if (privParsed.length > 0) {
                const cleanedPriv = privParsed.filter(
                  (p) =>
                    p &&
                    p.id !== SEEDED_REMOVED_EXPERIENCE_ID &&
                    p.slug !== SEEDED_REMOVED_EXPERIENCE_SLUG,
                );
                if (cleanedPriv.length !== privParsed.length) {
                  try {
                    const toStore = Array.isArray(parsedJson)
                      ? cleanedPriv
                      : { ...parsedJson, items: cleanedPriv };
                    localStorage.setItem(privKey, JSON.stringify(toStore));
                    localStorage.setItem(PRIVILEGED_STORAGE_KEY, JSON.stringify(toStore));
                  } catch {
                    // ignore
                  }
                }
                const existingIds = new Set(localExperiences.map((e) => e.id.toLowerCase()));
                const existingSlugs = new Set(localExperiences.map((e) => e.slug.toLowerCase()));
                for (const p of cleanedPriv) {
                  if (
                    p &&
                    !deletedIds.has(p.id) &&
                    !deletedIds.has(p.slug) &&
                    !existingIds.has((p.id || '').toLowerCase()) &&
                    !existingSlugs.has((p.slug || '').toLowerCase())
                  ) {
                    localExperiences.push(p);
                    if (p.id) existingIds.add(p.id.toLowerCase());
                    if (p.slug) existingSlugs.add(p.slug.toLowerCase());
                  }
                }
              }
            }
          }
        } catch {
          // Fallback
        }
      } else {
        try {
          this.clearPrivilegedStorageKeys();
        } catch {
          // ignore
        }
      }

      const activeDefaults = DEFAULT_EXPERIENCES.filter(
        (d) => !deletedIds.has(d.id) && !deletedIds.has(d.slug),
      );

      // Recuperar experiencias de prestador publicadas de catamarca_provider_experiences_v5
      try {
        const provExpsRaw = localStorage.getItem('catamarca_provider_experiences_v5');
        if (provExpsRaw) {
          const provExps = JSON.parse(provExpsRaw);
          if (Array.isArray(provExps)) {
            const existingSlugs = new Set([
              ...localExperiences.map((e) => e.slug.toLowerCase()),
              ...activeDefaults.map((d) => d.slug.toLowerCase()),
            ]);
            const existingIds = new Set([
              ...localExperiences.map((e) => e.id.toLowerCase()),
              ...activeDefaults.map((d) => d.id.toLowerCase()),
            ]);
            for (const p of provExps) {
              if (
                p &&
                p.slug &&
                p.status === 'publicada' &&
                p.id !== SEEDED_REMOVED_EXPERIENCE_ID &&
                p.slug !== SEEDED_REMOVED_EXPERIENCE_SLUG &&
                !deletedIds.has(p.id) &&
                !deletedIds.has(p.slug) &&
                !existingSlugs.has(p.slug.toLowerCase()) &&
                !existingIds.has((p.id || '').toLowerCase())
              ) {
                const validGalleryImages = Array.isArray(p.galleryImages)
                  ? p.galleryImages.filter(
                      (u: any) => typeof u === 'string' && u.trim() !== '' && !u.startsWith('blob:'),
                    )
                  : [];
                const validAlbumPhotos = Array.isArray(p.albumPhotos)
                  ? p.albumPhotos
                      .map((ph: any) => ph?.url)
                      .filter(
                        (u: any) => typeof u === 'string' && u.trim() !== '' && !u.startsWith('blob:'),
                      )
                  : [];
                const safeCover =
                  typeof p.coverImage === 'string' &&
                  p.coverImage.trim() !== '' &&
                  !p.coverImage.startsWith('blob:')
                    ? p.coverImage
                    : KAYAK_IMAGE;

                const resolvedGallery =
                  validGalleryImages.length > 0
                    ? validGalleryImages
                    : validAlbumPhotos.length > 0
                      ? validAlbumPhotos
                      : [safeCover];

                const category = p.category || 'expediciones';
                const detailRoute =
                  category === 'hospedajes'
                    ? `/experiencias/hospedajes/${p.slug}`
                    : `/experiencias/${p.slug}`;
                const publicUrl =
                  p.publicUrl ||
                  (category === 'hospedajes'
                    ? `https://experiencias.club/experiencias/hospedajes/${p.slug}`
                    : `https://experiencias.club/experiencias/${p.slug}`);

                const rawAlt = p.altitudeMeters;
                const safeAltitude =
                  typeof rawAlt === 'number' && Number.isFinite(rawAlt)
                    ? rawAlt
                    : rawAlt !== undefined &&
                        rawAlt !== null &&
                        String(rawAlt).replace(/\D/g, '') !== '' &&
                        Number.isFinite(Number(String(rawAlt).replace(/\D/g, '')))
                      ? Number(String(rawAlt).replace(/\D/g, ''))
                      : 850;

                localExperiences.push({
                  id: p.id || `exp-${p.slug}`,
                  slug: p.slug,
                  title: p.title,
                  category,
                  shortTitle: p.shortTitle || p.title,
                  kicker: p.kicker || 'EXPERIENCIA',
                  tagline: p.tagline || p.title,
                  description: p.description || p.tagline || '',
                  region: p.region || 'Catamarca',
                  meetingPoint: p.meetingPoint || '',
                  meetingPointUrl: p.meetingPointUrl || '',
                  difficulty: p.difficulty || 'Moderada',
                  durationDays: 1,
                  durationLabel: p.durationLabel || 'Medio día',
                  altitudeMeters: safeAltitude,
                  bestSeason: p.bestSeason || 'Todo el año',
                  priceArs: p.priceArs || 0,
                  priceUsd: p.priceUsd || 70,
                  maxSpotsPerGroup: p.capacityPerDate || 12,
                  dates: Array.isArray(p.dates) ? p.dates : [],
                  status: 'publicada',
                  publicUrl,
                  detailRoute,
                  coverImage: safeCover,
                  galleryImages: resolvedGallery,
                  isExclusiveClub: true,
                  isLocked: false,
                  providerId: p.providerId,
                  providerEmail: p.providerEmail,
                  providerSlug: p.providerSlug,
                  providerName: p.providerName,
                  providerPhone: p.providerPhone,
                  providerCbuAlias: p.providerCbuAlias,
                  providerCuitDni: p.providerCuitDni,
                  providerBankName: p.providerBankName,
                  albumPhotos: p.albumPhotos || [],
                  highlights: p.highlights || [],
                  included: p.included || [],
                  notIncluded: p.notIncluded || [],
                  pendingRemoteSync: true,
                });
                existingSlugs.add(p.slug.toLowerCase());
                if (p.id) existingIds.add(p.id.toLowerCase());
              }
            }
          }
        }
      } catch {
        // Fallback
      }

      // Recuperar propuestas aprobadas de catamarca_experience_requests_v1
      try {
        const reqsRaw = localStorage.getItem('catamarca_experience_requests_v1');
        if (reqsRaw) {
          const reqs = JSON.parse(reqsRaw);
          if (Array.isArray(reqs)) {
            const existingSlugs = new Set([
              ...localExperiences.map((e) => e.slug.toLowerCase()),
              ...activeDefaults.map((d) => d.slug.toLowerCase()),
            ]);
            const existingIds = new Set([
              ...localExperiences.map((e) => e.id.toLowerCase()),
              ...activeDefaults.map((d) => d.id.toLowerCase()),
            ]);
            for (const r of reqs) {
              if (r && (r.status === 'aprobada' || r.status === 'pendiente') && r.title) {
                const slug =
                  r.experienceSlug ||
                  r.slug ||
                  r.title
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/(^-|-$)/g, '');
                const id = r.id || 'exp-' + slug;
                if (
                  slug &&
                  id !== SEEDED_REMOVED_EXPERIENCE_ID &&
                  slug !== SEEDED_REMOVED_EXPERIENCE_SLUG &&
                  !deletedIds.has(id) &&
                  !deletedIds.has(slug) &&
                  !existingSlugs.has(slug.toLowerCase()) &&
                  !existingIds.has(id.toLowerCase())
                ) {
                  const mappedStatus = r.status === 'aprobada' ? 'publicada' : 'pendiente';
                  const category = r.category || 'expediciones';
                  const detailRoute =
                    category === 'hospedajes'
                      ? `/experiencias/hospedajes/${slug}`
                      : `/experiencias/${slug}`;
                  const publicUrl =
                    r.experienceUrl ||
                    (category === 'hospedajes'
                      ? `https://experiencias.club/experiencias/hospedajes/${slug}`
                      : `https://experiencias.club/experiencias/${slug}`);

                  const rAltRaw = r.altitude;
                  const rAltDigits =
                    rAltRaw !== undefined && rAltRaw !== null
                      ? String(rAltRaw).replace(/\D/g, '')
                      : '';
                  const rAltitudeMeters =
                    rAltDigits !== '' && Number.isFinite(Number(rAltDigits))
                      ? Number(rAltDigits)
                      : 850;

                  localExperiences.push({
                    id,
                    slug,
                    title: r.title,
                    category,
                    shortTitle: r.title.split('&')[0].trim(),
                    kicker: r.kicker || 'EXPERIENCIA',
                    tagline:
                      r.subheading && r.subheading.length > 90
                        ? r.subheading.slice(0, 90) + '...'
                        : r.subheading || r.title,
                    description: r.subheading || '',
                    region: r.region || 'Catamarca',
                    meetingPoint: r.meetingPoint || '',
                    meetingPointUrl: r.meetingPointUrl || '',
                    difficulty:
                      (r.difficulty?.split('(')[0]?.trim() as any) || 'Moderada',
                    durationDays: 1,
                    durationLabel: r.duration || 'Medio día',
                    altitudeMeters: rAltitudeMeters,
                    bestSeason: r.season || 'Todo el año',
                    priceArs: r.priceArs || 0,
                    priceUsd: r.priceUsd || 70,
                    promosAndPricing: r.promosAndPricing || undefined,
                    maxSpotsPerGroup: r.capacity || 12,
                    dates: Array.isArray(r.dates) ? r.dates : r.dates ? [r.dates] : [],
                    status: mappedStatus,
                    publicUrl,
                    detailRoute,
                    coverImage: r.coverImage || KAYAK_IMAGE,
                    galleryImages:
                      r.albumPhotos && r.albumPhotos.length > 0
                        ? r.albumPhotos.map((p: any) => p.url)
                        : [r.coverImage || KAYAK_IMAGE],
                    videoUrl: r.coverVideoUrl || '',
                    isExclusiveClub: true,
                    isLocked: false,
                    albumPhotos: r.albumPhotos || [],
                    itinerary: r.itinerary,
                    highlights: r.participantRequirements
                      ? r.participantRequirements
                          .split('\n')
                          .map((s: string) => s.trim())
                          .filter(Boolean)
                      : [],
                    included: r.includedServices
                      ? r.includedServices
                          .split('\n')
                          .map((s: string) => s.trim())
                          .filter(Boolean)
                      : [],
                    notIncluded: r.participantRequirements
                      ? r.participantRequirements
                          .split('\n')
                          .map((s: string) => s.trim())
                          .filter(Boolean)
                      : [],
                    providerId: r.providerId,
                    providerEmail: r.providerEmail,
                    providerSlug: r.providerSlug,
                    providerName: r.providerAgency || r.providerName,
                    providerPhone: r.providerPhone,
                    providerCbuAlias: r.providerCbuAlias,
                    providerCuitDni: r.providerCuitDni,
                    providerBankName: r.providerBankName,
                    pendingRemoteSync: true,
                  });
                  existingSlugs.add(slug.toLowerCase());
                  existingIds.add(id.toLowerCase());
                }
              }
            }
          }
        }
      } catch {
        // Fallback
      }
    }

    const existingSlugs = new Set(localExperiences.map((e) => e.slug));
    const missingDefaults = DEFAULT_EXPERIENCES.filter(
      (d) => !existingSlugs.has(d.slug) && !deletedIds.has(d.id) && !deletedIds.has(d.slug),
    );
    const clubProfile = this.getClubProfile();
    const result = [...localExperiences, ...missingDefaults].map((exp) => {
      if (isClubExperience(exp)) {
        return {
          ...exp,
          isClubExperience: true,
          providerName: clubProfile.name,
          providerSlug: clubProfile.slug,
          providerEmail: clubProfile.email,
          providerPhone: clubProfile.phone,
          providerCbuAlias: clubProfile.cbuAlias,
          providerCuitDni: clubProfile.cuitDni,
          providerBankName: clubProfile.bankName,
        };
      }
      return exp;
    });
    if (typeof window !== 'undefined' && localExperiences.length > 0) {
      try {
        this.persistToLocalStorage(result);
      } catch {
        // Ignorar quota errors
      }
    }
    return result;
  }

  private sanitizeForPublicCatalog(list: Experience[]): Experience[] {
    return list
      .filter((exp) => (exp.status || 'publicada') === 'publicada')
      .map((exp) => {
        const copy: Experience = { ...exp };
        delete copy.notes;
        delete copy.pendingRemoteSync;
        if (!exp.isClubExperience) {
          delete copy.providerCbuAlias;
          delete copy.providerCuitDni;
          delete copy.providerBankName;
        }
        if (typeof copy.coverImage === 'string' && copy.coverImage.startsWith('blob:')) {
          copy.coverImage = KAYAK_IMAGE;
        }
        if (typeof copy.videoUrl === 'string' && copy.videoUrl.startsWith('blob:')) {
          copy.videoUrl = undefined;
        }
        if (Array.isArray(copy.albumPhotos)) {
          copy.albumPhotos = copy.albumPhotos.map((p) => ({
            ...p,
            url: typeof p.url === 'string' && p.url.startsWith('blob:') ? KAYAK_IMAGE : p.url,
          }));
        }
        if (Array.isArray(copy.galleryImages)) {
          copy.galleryImages = copy.galleryImages.map((u) => (typeof u === 'string' && u.startsWith('blob:') ? KAYAK_IMAGE : u));
        }
        return copy;
      });
  }

  resolveActiveAccount(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      // 1. Supabase auth token
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              const user = parsed?.user;
              const id = user?.id || user?.email;
              if (id) return String(id).trim().toLowerCase();
            } catch {
              // ignore
            }
          }
        }
      }

      // 2. Admin session
      const adminRaw = localStorage.getItem('catamarca_admin_session_v1');
      if (adminRaw) {
        try {
          const parsed = JSON.parse(adminRaw);
          const id = parsed?.email || parsed?.id;
          if (id) return `admin_${String(id).trim().toLowerCase()}`;
        } catch {
          // ignore
        }
      }

      // 3. Provider session
      const provRaw = localStorage.getItem('catamarca_provider_session_v5');
      if (provRaw) {
        try {
          const parsed = JSON.parse(provRaw);
          const id = parsed?.email || parsed?.id;
          if (id) return `provider_${String(id).trim().toLowerCase()}`;
        } catch {
          // ignore
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  getPrivilegedStorageKey(account?: string | null): string {
    const acc = account !== undefined ? account : this.resolveActiveAccount();
    if (!acc) return PRIVILEGED_STORAGE_KEY;
    const sanitized = acc.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${PRIVILEGED_STORAGE_KEY}:${sanitized}`;
  }

  private clearPrivilegedStorageKeys(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(PRIVILEGED_STORAGE_KEY);
      localStorage.removeItem(PRIVILEGED_OWNER_KEY);
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PRIVILEGED_STORAGE_KEY)) {
          keysToRemove.push(key);
        }
      }
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }
    } catch {
      // ignore
    }
  }

  private clearAccountCache(accountId: string): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(this.getPrivilegedStorageKey(accountId));
        const recordedOwner = localStorage.getItem(PRIVILEGED_OWNER_KEY);
        if (!recordedOwner || recordedOwner === accountId) {
          localStorage.removeItem(PRIVILEGED_STORAGE_KEY);
          localStorage.removeItem(PRIVILEGED_OWNER_KEY);
        }
      } catch {
        // ignore
      }
    }
    const current = this._experiences();
    const publicOnly = current.filter((exp) => (exp.status || 'publicada') === 'publicada');
    const sanitizedMemory = publicOnly.map((exp) => {
      const copy = { ...exp };
      delete copy.notes;
      delete copy.pendingRemoteSync;
      if (!exp.isClubExperience) {
        delete copy.providerCbuAlias;
        delete copy.providerCuitDni;
        delete copy.providerBankName;
      }
      return copy;
    });
    this._experiences.set(sanitizedMemory);
  }

  private loadPrivilegedFromLocalStorage(accountId: string): void {
    if (typeof window === 'undefined') return;
    try {
      const privKey = this.getPrivilegedStorageKey(accountId);
      const recordedOwner = localStorage.getItem(PRIVILEGED_OWNER_KEY);
      if (recordedOwner && recordedOwner !== accountId) {
        localStorage.removeItem(PRIVILEGED_STORAGE_KEY);
        localStorage.removeItem(PRIVILEGED_OWNER_KEY);
      }

      let privRaw = localStorage.getItem(privKey);
      if (!privRaw && (!recordedOwner || recordedOwner === accountId)) {
        privRaw = localStorage.getItem(PRIVILEGED_STORAGE_KEY);
      }
      if (!privRaw) return;
      const parsedJson = JSON.parse(privRaw);
      const privParsed: Experience[] = Array.isArray(parsedJson)
        ? parsedJson
        : Array.isArray(parsedJson?.items)
          ? parsedJson.items
          : [];
      if (privParsed.length > 0) {
        const deletedIds = this.getDeletedIds();
        const current = this._experiences();
        const existingIds = new Set(current.map((e) => e.id.toLowerCase()));
        const existingSlugs = new Set(current.map((e) => e.slug.toLowerCase()));
        const merged = [...current];
        for (const p of privParsed) {
          if (
            p &&
            !deletedIds.has(p.id) &&
            !deletedIds.has(p.slug) &&
            !existingIds.has((p.id || '').toLowerCase()) &&
            !existingSlugs.has((p.slug || '').toLowerCase())
          ) {
            merged.push(p);
            if (p.id) existingIds.add(p.id.toLowerCase());
            if (p.slug) existingSlugs.add(p.slug.toLowerCase());
          }
        }
        this._experiences.set(merged);
      }
    } catch {
      // ignore
    }
  }

  private syncActiveAccount(): string | null {
    const current = this.resolveActiveAccount();
    if (this.activeAccountIdentifier && current && this.activeAccountIdentifier !== current) {
      const prior = this.activeAccountIdentifier;
      this.activeAccountIdentifier = current;
      this.clearAccountCache(prior);
      this.loadPrivilegedFromLocalStorage(current);
    } else if (this.activeAccountIdentifier && !current) {
      const prior = this.activeAccountIdentifier;
      this.activeAccountIdentifier = null;
      this.clearAccountCache(prior);
    } else {
      this.activeAccountIdentifier = current;
    }
    return current;
  }

  hasPrivilegedSession(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return Boolean(this.syncActiveAccount());
    } catch {
      return false;
    }
  }

  private persistPrivilegedToLocalStorage(list: Experience[]): void {
    if (typeof window === 'undefined') return;
    try {
      const activeAccount = this.syncActiveAccount();
      if (!activeAccount) {
        this.clearPrivilegedStorageKeys();
        return;
      }
      const privKey = this.getPrivilegedStorageKey(activeAccount);
      const privilegedItems = list.filter(
        (exp) =>
          exp.status !== 'publicada' ||
          Boolean(exp.pendingRemoteSync) ||
          Boolean(exp.notes) ||
          (!exp.isClubExperience &&
            (Boolean(exp.providerCbuAlias) ||
              Boolean(exp.providerCuitDni) ||
              Boolean(exp.providerBankName))),
      );
      if (privilegedItems.length > 0) {
        localStorage.setItem(privKey, JSON.stringify(privilegedItems));
        localStorage.setItem(PRIVILEGED_STORAGE_KEY, JSON.stringify(privilegedItems));
        localStorage.setItem(PRIVILEGED_OWNER_KEY, activeAccount);
      } else {
        localStorage.removeItem(privKey);
        localStorage.removeItem(PRIVILEGED_STORAGE_KEY);
        localStorage.removeItem(PRIVILEGED_OWNER_KEY);
      }
    } catch {
      // Ignorar quota errors
    }
  }

  private persistToLocalStorage(list: Experience[]): void {
    if (typeof window !== 'undefined') {
      try {
        const publicOnly = this.sanitizeForPublicCatalog(list);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(publicOnly));
      } catch {
        // Ignorar quota errors
      }
      this.persistPrivilegedToLocalStorage(list);
    }
  }

  clearPrivilegedCache(): void {
    if (typeof window !== 'undefined') {
      try {
        this.clearPrivilegedStorageKeys();
      } catch {
        // ignore
      }
      try {
        localStorage.removeItem('catamarca_experience_requests_v1');
        localStorage.removeItem('catamarca_provider_experiences_v5');
      } catch {
        // ignore
      }
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const cleaned = parsed.filter(
              (e: any) =>
                e &&
                e.id !== SEEDED_REMOVED_EXPERIENCE_ID &&
                e.slug !== SEEDED_REMOVED_EXPERIENCE_SLUG,
            );
            const sanitized = this.sanitizeForPublicCatalog(cleaned);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
          }
        }
      } catch {
        // ignore
      }
    }

    const current = this._experiences();
    const publicOnly = current.filter((exp) => (exp.status || 'publicada') === 'publicada');
    const sanitizedMemory = publicOnly.map((exp) => {
      const copy = { ...exp };
      delete copy.notes;
      delete copy.pendingRemoteSync;
      if (!exp.isClubExperience) {
        delete copy.providerCbuAlias;
        delete copy.providerCuitDni;
        delete copy.providerBankName;
      }
      return copy;
    });
    this._experiences.set(sanitizedMemory);
  }

  async loadProviderBanking(
    providerEmail: string,
  ): Promise<{ cbuAlias?: string; cuitDni?: string; bankName?: string } | null> {
    if (!isSupabaseConfigured() || !providerEmail) return null;
    try {
      const { data, error } = await (this.supabase.from('prestadores') as any)
        .select('cbu_alias, cuit_dni, bank_name')
        .eq('email', providerEmail.trim().toLowerCase())
        .maybeSingle();
      if (error || !data) return null;
      return {
        cbuAlias: data.cbu_alias || undefined,
        cuitDni: data.cuit_dni || undefined,
        bankName: data.bank_name || undefined,
      };
    } catch {
      return null;
    }
  }

  private async loadFromSupabase(): Promise<boolean> {
    try {
      const publicColumns =
        'id, slug, title, tagline, description, region, meeting_point, difficulty, ' +
        'duration_label, price_ars, price_usd, capacity_per_date, cover_image, ' +
        'video_url, video_poster, altitude_meters, dates, highlights, included, ' +
        'not_included, status, public_url, album_photos, gallery_images, provider_name, provider_phone, ' +
        'provider_email, provider_slug, date_slots, favorites_count, created_at';

      const fetchExperiences = (columns: string): Promise<{ data: any[] | null; error: any }> =>
        this.supabase
          .from('experiencias')
          .select(columns)
          .order('created_at', { ascending: true }) as any;

      let includePricingPacks = true;
      const pricingCol = () => (includePricingPacks ? ', pricing_packs' : '');

      let { data, error } = await fetchExperiences(
        `${publicColumns}, category, meeting_point_url, kicker, best_season, itinerary, promos_and_pricing${pricingCol()}, provider_agency, participant_requirements, notes, reviewed_at, display_location`,
      );
      if (error && /pricing_packs/.test(error.message || '')) {
        includePricingPacks = false;
        ({ data, error } = await fetchExperiences(
          `${publicColumns}, category, meeting_point_url, kicker, best_season, itinerary, promos_and_pricing, provider_agency, participant_requirements, notes, reviewed_at, display_location`,
        ));
      }
      if (error) {
        const isDisplayLocationErr = /display_location/.test(error.message || '');
        if (isDisplayLocationErr) {
          // Si falló por display_location, reintentar preservando las demás columnas opcionales
          ({ data, error } = await fetchExperiences(
            `${publicColumns}, category, meeting_point_url, kicker, best_season, itinerary, promos_and_pricing${pricingCol()}, provider_agency, participant_requirements, notes, reviewed_at`,
          ));
        } else {
          // Si falló por otra columna opcional (ej: reviewed_at), preservar display_location y notes
          ({ data, error } = await fetchExperiences(
            `${publicColumns}, category, meeting_point_url, kicker, best_season, itinerary, promos_and_pricing${pricingCol()}, notes, display_location`,
          ));
        }
      }
      if (error) {
        ({ data, error } = await fetchExperiences(
          `${publicColumns}, category, meeting_point_url, kicker, best_season, itinerary, promos_and_pricing${pricingCol()}, notes`,
        ));
      }
      if (error) {
        // Reintento con fallback progresivo si alguna columna nueva no existe aún
        ({ data, error } = await fetchExperiences(`${publicColumns}, category, meeting_point_url${pricingCol()}, notes`));
        if (error && /meeting_point_url/.test(error.message || '')) {
          ({ data, error } = await fetchExperiences(`${publicColumns}, category${pricingCol()}, notes`));
        }
      }
      if (error && /notes/.test(error.message || '')) {
        // Último recurso solo si la columna notes no estuviera disponible en el esquema remoto
        ({ data, error } = await fetchExperiences(`${publicColumns}, category, meeting_point_url${pricingCol()}`));
        if (error && /meeting_point_url/.test(error.message || '')) {
          ({ data, error } = await fetchExperiences(`${publicColumns}, category${pricingCol()}`));
        }
      }
      if (error && /category/.test(error.message || '')) {
        // Si falló porque la columna category no existe aún en el esquema remoto, reintentar sin category
        ({ data, error } = await fetchExperiences(
          `${publicColumns}, meeting_point_url, kicker, best_season, itinerary, promos_and_pricing${pricingCol()}, notes, display_location`,
        ));
        if (error) {
          ({ data, error } = await fetchExperiences(`${publicColumns}, meeting_point_url${pricingCol()}, notes`));
          if (error && /meeting_point_url/.test(error.message || '')) {
            ({ data, error } = await fetchExperiences(`${publicColumns}${pricingCol()}, notes`));
          }
        }
        if (error && /notes/.test(error.message || '')) {
          ({ data, error } = await fetchExperiences(publicColumns));
        }
      }
      if (error) {
        console.warn('[ExperienceService] No se pudieron cargar las experiencias remotas:', error);
        return false;
      }

      if (data && data.length > 0) {
        let providerBankingMap = new Map<
          string,
          { cbu_alias?: string; cuit_dni?: string; bank_name?: string }
        >();
        try {
          const { data: sessionData } = await this.supabase.auth.getSession();
          if (sessionData?.session?.user) {
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
          }
        } catch {
          // Si no está autenticado o el acceso está restringido por RLS, se mantienen vacíos los datos bancarios
        }

        let providerSlugMap = new Map<string, string>();
        try {
          const { data: publicProfiles } = await (this.supabase.from('perfiles_publicos') as any)
            .select('email, name, agency, slug');
          if (Array.isArray(publicProfiles)) {
            for (const profile of publicProfiles) {
              if (profile?.slug) {
                if (profile.email) providerSlugMap.set(profile.email.trim().toLowerCase(), profile.slug);
                if (profile.name) providerSlugMap.set(profile.name.trim().toLowerCase(), profile.slug);
                if (profile.agency) providerSlugMap.set(profile.agency.trim().toLowerCase(), profile.slug);
              }
            }
          }
        } catch {
          // ignore
        }

        const clubProfile = this.getClubProfile();
        const deletedRemoteIds = new Set<string>();
        const deletedRemoteSlugs = new Set<string>();

        const remoteExperiences: Experience[] = (data.map((exp: any) => {
          const rawImage = exp.cover_image;
          const image = (rawImage && typeof rawImage === 'string' && !rawImage.startsWith('blob:'))
            ? rawImage
            : KAYAK_IMAGE;
          const email = (exp.provider_email || '').trim().toLowerCase();
          const name = (exp.provider_name || '').trim().toLowerCase();
          const agency = (exp.provider_agency || '').trim().toLowerCase();
          const banking = providerBankingMap.get(email);
          const isClub = isClubExperience({
            slug: exp.slug,
            providerSlug: exp.provider_slug,
            providerEmail: exp.provider_email,
            providerName: exp.provider_name,
          });

          const mappedSlug =
            exp.provider_slug ||
            providerSlugMap.get(email) ||
            providerSlugMap.get(name) ||
            providerSlugMap.get(agency);

          const resolvedProviderSlug = isClub ? 'club-de-experiencias' : (mappedSlug || undefined);
          const resolvedProviderName = isClub ? (clubProfile.name || 'Club de Experiencias') : (exp.provider_name || undefined);
          const resolvedProviderEmail = isClub ? (clubProfile.email || 'admin@experiencias.club') : (exp.provider_email || undefined);
          const resolvedProviderPhone = isClub ? (clubProfile.phone || '+54 9 383 456-7890') : (exp.provider_phone || undefined);
          const resolvedCbuAlias = isClub ? (clubProfile.cbuAlias || 'EXPERIENCIAS.CLUB.MP') : (banking?.cbu_alias || undefined);
          const resolvedCuitDni = isClub ? (clubProfile.cuitDni || '30-71829401-4') : (banking?.cuit_dni || undefined);
          const resolvedBankName = isClub ? (clubProfile.bankName || 'Mercado Pago / Banco Nación') : (banking?.bank_name || undefined);

          // Omitir experiencias marcadas como borradas (soft delete)
          let isSoftDeleted = Boolean(exp.deleted_at);
          try {
            if (!isSoftDeleted && exp.notes && typeof exp.notes === 'string' && exp.notes.startsWith('{')) {
              const parsedNotes = JSON.parse(exp.notes);
              if (parsedNotes?.deleted === true) {
                isSoftDeleted = true;
              }
            }
          } catch {}

          if (isSoftDeleted) {
            if (exp.id) {
              deletedRemoteIds.add(String(exp.id).toLowerCase().trim());
              this.recordDeletedId(exp.id, exp.slug);
            }
            if (exp.slug) {
              deletedRemoteSlugs.add(String(exp.slug).toLowerCase().trim());
            }
            return null;
          }

          const rawGallery = Array.isArray(exp.gallery_images) && exp.gallery_images.length > 0
            ? exp.gallery_images
                .map((u: any) => (typeof u === 'string' && !u.startsWith('blob:') ? u : ''))
                .filter(Boolean)
            : [];
          const rawAlbum = Array.isArray(exp.album_photos) && exp.album_photos.length > 0
            ? exp.album_photos
                .map((p: any) => (typeof p?.url === 'string' && !p.url.startsWith('blob:') ? p.url : ''))
                .filter(Boolean)
            : [];
          const combinedGallery = rawGallery.length > 0
            ? rawGallery
            : (rawAlbum.length > 0 ? rawAlbum : [image]);
          const persistedCover = typeof exp.cover_image === 'string' ? exp.cover_image.trim() : '';
          const combinedAlbum = Array.isArray(exp.album_photos) && exp.album_photos.length > 0
            ? exp.album_photos.map((p: any) => ({
                ...p,
                url: (typeof p?.url === 'string' && p.url.startsWith('blob:')) ? KAYAK_IMAGE : (p?.url || KAYAK_IMAGE),
              }))
            : combinedGallery.map((u: string, idx: number) => ({
                id: `photo_${idx + 1}`,
                url: u,
                title: exp.title,
                isCover: Boolean(persistedCover && u.trim() === persistedCover),
                order: idx + 1,
              }));

          return {
            id: exp.id,
            slug: exp.slug,
            title: exp.title,
            shortTitle: exp.title,
            kicker: exp.kicker || '',
            tagline: exp.tagline,
            description: exp.description,
            region: exp.region,
            meetingPoint: exp.meeting_point || '',
            meetingPointUrl: exp.meeting_point_url || '',
            difficulty: exp.difficulty || 'Baja',
            durationDays: 1,
            durationLabel: exp.duration_label || '4 horas',
            altitudeMeters: exp.altitude_meters ?? 0,
            bestSeason: exp.best_season || '',
            itinerary: exp.itinerary || undefined,
            promosAndPricing: exp.promos_and_pricing || undefined,
            pricingPacks: Array.isArray(exp.pricing_packs) && exp.pricing_packs.length > 0 ? exp.pricing_packs : undefined,
            priceArs: exp.price_ars,
            priceUsd: exp.price_usd ?? 70,
            maxSpotsPerGroup: exp.capacity_per_date || 12,
            coverImage: image,
            galleryImages: combinedGallery,
            albumPhotos: combinedAlbum,
            videoUrl: (typeof exp.video_url === 'string' && exp.video_url.startsWith('blob:')) ? undefined : (exp.video_url || undefined),
            videoPoster: exp.video_poster || undefined,
            highlights:
              Array.isArray(exp.highlights) && exp.highlights.length > 0
                ? exp.highlights
                : (Array.isArray(exp.not_included) && exp.not_included.length > 0 ? exp.not_included : []),
            included: Array.isArray(exp.included) && exp.included.length > 0 ? exp.included : [],
            notIncluded:
              Array.isArray(exp.not_included) && exp.not_included.length > 0
                ? exp.not_included
                : (Array.isArray(exp.highlights) && exp.highlights.length > 0 ? exp.highlights : []),
            dates: Array.isArray(exp.dates) && exp.dates.length > 0 ? exp.dates : [],
            dateSlots: Array.isArray(exp.date_slots) ? exp.date_slots : undefined,
            providerEmail: resolvedProviderEmail,
            providerSlug: resolvedProviderSlug,
            providerName: resolvedProviderName,
            providerPhone: resolvedProviderPhone,
            providerCbuAlias: resolvedCbuAlias,
            providerCuitDni: resolvedCuitDni,
            providerBankName: resolvedBankName,
            isClubExperience: isClub,
            providerAgency: exp.provider_agency || undefined,
            participantRequirements: exp.participant_requirements || undefined,
            favoritesCount: typeof exp.favorites_count === 'number' ? exp.favorites_count : 0,
            notes: (() => {
              if (!exp.notes) return undefined;
              if (typeof exp.notes === 'object' && !Array.isArray(exp.notes)) {
                if (typeof (exp.notes as any).text === 'string') return (exp.notes as any).text || undefined;
                return undefined;
              }
              if (typeof exp.notes === 'string') {
                const trimmed = exp.notes.trim();
                if (trimmed.startsWith('{')) {
                  try {
                    const p = JSON.parse(trimmed);
                    if (p && typeof p === 'object' && !Array.isArray(p)) {
                      if (typeof p.text === 'string') {
                        return p.text || undefined;
                      }
                      if (p.mp_connected !== undefined || p.mp_collector_id !== undefined || p.deleted !== undefined) {
                        return undefined;
                      }
                    }
                  } catch {}
                }
                return exp.notes || undefined;
              }
              return undefined;
            })(),
            mpConnected: (() => {
              try {
                if (exp.notes && typeof exp.notes === 'object' && !Array.isArray(exp.notes)) {
                  if ((exp.notes as any).mp_connected !== undefined) return Boolean((exp.notes as any).mp_connected);
                }
                if (typeof exp.notes === 'string') {
                  const trimmed = exp.notes.trim();
                  if (trimmed.startsWith('{')) {
                    const p = JSON.parse(trimmed);
                    if (p.mp_connected !== undefined) return Boolean(p.mp_connected);
                  }
                }
              } catch {}
              return undefined;
            })(),
            mpCollectorId: (() => {
              try {
                if (exp.notes && typeof exp.notes === 'object' && !Array.isArray(exp.notes)) {
                  if ((exp.notes as any).mp_collector_id) return String((exp.notes as any).mp_collector_id);
                }
                if (typeof exp.notes === 'string') {
                  const trimmed = exp.notes.trim();
                  if (trimmed.startsWith('{')) {
                    const p = JSON.parse(trimmed);
                    if (p.mp_collector_id) return String(p.mp_collector_id);
                  }
                }
              } catch {}
              return undefined;
            })(),
            reviewedAt: exp.reviewed_at || undefined,
            status: exp.status || 'publicada',
            category: exp.category || 'expediciones',
            displayLocation: (exp.display_location as 'destacada' | 'catalogo' | 'no_listada') || 'destacada',
            publicUrl: exp.public_url || (exp.category === 'hospedajes' ? `https://experiencias.club/experiencias/hospedajes/${exp.slug}` : `https://experiencias.club/experiencias/${exp.slug}`),
            isExclusiveClub: true,
            isLocked: false,
            detailRoute: exp.category === 'hospedajes' ? `/experiencias/hospedajes/${exp.slug}` : `/experiencias/${exp.slug}`,
          };
        }) as (Experience | null)[]).filter((e): e is Experience => e !== null);

        // Fin procesamiento de experiencias remotas

        const currentLocal = this._experiences();
        const remoteIds = new Set(remoteExperiences.map((e) => e.id.toLowerCase()));
        const remoteSlugs = new Set(remoteExperiences.map((e) => e.slug.toLowerCase()));
        const deletedIds = this.getDeletedIds();

        // Preservar experiencias locales (pendientes de sincronización no presentes en remoto ni borradas remotamente)
        const localOnly = currentLocal.filter((e) => {
          const eId = (e.id || '').toLowerCase().trim();
          const eSlug = (e.slug || '').toLowerCase().trim();
          return (
            Boolean(e.pendingRemoteSync) &&
            !remoteIds.has(eId) &&
            !remoteSlugs.has(eSlug) &&
            !deletedRemoteIds.has(eId) &&
            !deletedRemoteSlugs.has(eSlug) &&
            !deletedIds.has(e.id) &&
            !deletedIds.has(e.slug)
          );
        });

        const mergedExperiences = [...remoteExperiences, ...localOnly];
        this._hasRemoteExperiences.set(true);
        this._experiences.set(mergedExperiences);
        this.persistToLocalStorage(mergedExperiences);
      }
      return true;
    } catch (err) {
      console.warn('[ExperienceService] Error cargando desde Supabase:', err);
      return false;
    }
  }
}
