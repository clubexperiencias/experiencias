import { Injectable, computed, inject, signal } from '@angular/core';
import { Experience, ExperienceAlbumPhoto } from '../models/experience.model';
import { SUPABASE_CLIENT, isSupabaseConfigured } from '../supabase/supabase.client';

const KAYAK_IMAGE = '/assets/images/kayak-club-de-experiencias.jpg';
const STORAGE_KEY = 'club_experiencias_catalog_v1';
const DELETED_STORAGE_KEY = 'club_experiencias_deleted_ids_v1';
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
};

export const DEFAULT_EXPERIENCES: Experience[] = [
  KAYAK_DEFAULT_EXPERIENCE,
  POMEZ_DEFAULT_EXPERIENCE,
  SEISMILES_DEFAULT_EXPERIENCE,
];

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
    return this.publishedExperiences().find((e: Experience) => e.slug === slug);
  }

  getPublishedExperienceById(id: string): Experience | undefined {
    return this.publishedExperiences().find((e: Experience) => e.id === id || e.slug === id);
  }
  readonly hasRemoteExperiences = this._hasRemoteExperiences.asReadonly();
  readonly remoteLoadPromise: Promise<boolean> = isSupabaseConfigured()
    ? this.loadFromSupabase()
    : Promise.resolve(true);

  constructor() {}

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

  async updateExperience(updated: Partial<Experience> & { id: string }): Promise<void> {
    const prevList = this._experiences();
    const index = prevList.findIndex((e) => e.id === updated.id);
    if (index === -1) {
      throw new Error(`Experiencia con ID ${updated.id} no encontrada.`);
    }

    const current = prevList[index];
    const merged: Experience = {
      ...current,
      ...updated,
      detailRoute: updated.slug ? `/experiencias/${updated.slug}` : current.detailRoute,
      publicUrl: updated.slug
        ? `https://experiencias.club/experiencias/${updated.slug}`
        : current.publicUrl,
    };

    const nextList = [...prevList];
    nextList[index] = merged;
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
          cover_image: merged.coverImage,
          video_url: merged.videoUrl || '',
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

        if (merged.albumPhotos) {
          payload['album_photos'] = merged.albumPhotos;
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

        const { data, error } = await this.supabase
          .from('experiencias')
          .update(payload as any)
          .eq('id', merged.id)
          .select();

        if (error || !data || data.length === 0) {
          throw error || new Error(`No se encontró la experiencia remota con id ${merged.id}`);
        }

        const targetProviderEmail = (
          updated.providerEmail ||
          merged.providerEmail ||
          (data[0] as any)?.provider_email ||
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
            const { error: pbErr } = await (this.supabase.from('provider_access') as any)
              .update(providerBankingUpdate)
              .eq('email', targetProviderEmail);
            if (pbErr) {
              console.warn('[ExperienceService] Error al actualizar provider_access:', pbErr);
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

  async createExperience(newExp: Experience): Promise<void> {
    const list = this._experiences();
    const slug =
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
      throw new Error(`El slug "${slug}" está reservado por el sistema y no puede ser utilizado.`);
    }
    if (list.some((e) => e.slug.toLowerCase() === slug.toLowerCase())) {
      throw new Error(`Ya existe una experiencia con el slug "${slug}".`);
    }

    const experience: Experience = {
      ...newExp,
      slug,
      detailRoute: `/experiencias/${slug}`,
      publicUrl: `https://experiencias.club/experiencias/${slug}`,
      status: newExp.status || 'publicada',
      isExclusiveClub: true,
      isLocked: false,
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
          tagline: experience.tagline,
          description: experience.description,
          region: experience.region,
          meeting_point: experience.meetingPoint || '',
          difficulty: experience.difficulty,
          duration_label: experience.durationLabel,
          price_ars: experience.priceArs,
          price_usd: experience.priceUsd,
          capacity_per_date: experience.maxSpotsPerGroup,
          cover_image: experience.coverImage || KAYAK_IMAGE,
          video_url: experience.videoUrl || '',
          video_poster: experience.videoPoster || '',
          altitude_meters: experience.altitudeMeters || 0,
          dates: experience.dates || [],
          highlights: experience.highlights || [],
          included: experience.included || [],
          not_included: experience.notIncluded || [],
          status: experience.status,
          public_url: experience.publicUrl,
          album_photos: experience.albumPhotos || [],
          provider_name: experience.providerName || null,
          provider_phone: experience.providerPhone || null,
          provider_email: experience.providerEmail || null,
        };

        const { error } = await this.supabase.from('experiencias').insert(payload as any);
        if (error) {
          console.warn('[ExperienceService] Error al insertar experiencia en Supabase:', error);
          this._experiences.set(list);
          this.persistToLocalStorage(list);
          throw error;
        }

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
            const { error: pbErr } = await (this.supabase.from('provider_access') as any)
              .update(providerBankingUpdate)
              .eq('email', targetProviderEmail);
            if (pbErr) {
              console.warn(
                '[ExperienceService] Error al actualizar provider_access en createExperience:',
                pbErr,
              );
            }
          }
        }
      } catch (err) {
        console.warn('[ExperienceService] Fallo al crear remoto:', err);
        this._experiences.set(list);
        this.persistToLocalStorage(list);
        throw err;
      }
    }
  }

  async toggleExperienceStatus(id: string, newStatus: 'publicada' | 'oculta'): Promise<void> {
    await this.updateExperience({ id, status: newStatus });
  }

  async deleteExperience(id: string): Promise<void> {
    const prevList = this._experiences();
    const expToDelete = prevList.find((e) => e.id === id || e.slug === id);
    const targetId = expToDelete?.id ?? id;
    const list = prevList.filter((e) => e.id !== targetId && e.slug !== id);

    this.recordDeletedId(targetId, expToDelete?.slug);
    this._experiences.set(list);
    this.persistToLocalStorage(list);

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await this.supabase
          .from('experiencias')
          .delete()
          .eq('id', targetId)
          .select('id');

        if (error || !data || data.length === 0) {
          throw error || new Error(`No se encontró la experiencia remota con id ${targetId}`);
        }
      } catch (err) {
        console.warn('[ExperienceService] Fallo al eliminar en Supabase:', err);
        this.removeDeletedId(targetId, expToDelete?.slug);
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

  private loadInitialExperiences(): Experience[] {
    const deletedIds = this.getDeletedIds();
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Experience[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            const activeList = parsed.filter(
              (e) => !deletedIds.has(e.id) && !deletedIds.has(e.slug),
            );
            const existingSlugs = new Set(activeList.map((e) => e.slug));
            const missingDefaults = DEFAULT_EXPERIENCES.filter(
              (d) => !existingSlugs.has(d.slug) && !deletedIds.has(d.id) && !deletedIds.has(d.slug),
            );
            return [
              ...activeList,
              ...missingDefaults,
            ];
          }
        }
      } catch {
        // Fallback
      }
    }
    return DEFAULT_EXPERIENCES.filter(
      (d) => !deletedIds.has(d.id) && !deletedIds.has(d.slug),
    );
  }

  private persistToLocalStorage(list: Experience[]): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      } catch {
        // Ignorar quota errors
      }
    }
  }

  async loadProviderBanking(
    providerEmail: string,
  ): Promise<{ cbuAlias?: string; cuitDni?: string; bankName?: string } | null> {
    if (!isSupabaseConfigured() || !providerEmail) return null;
    try {
      const { data, error } = await (this.supabase.from('provider_access') as any)
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
        'not_included, status, public_url, album_photos, provider_name, provider_phone, ' +
        'provider_email, date_slots, created_at';

      const { data, error } = await this.supabase
        .from('experiencias')
        .select(publicColumns)
        .order('created_at', { ascending: true });

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
            const { data: accessRows } = await (this.supabase.from('provider_access') as any)
              .select('email, cbu_alias, cuit_dni, bank_name');
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

        const remoteExperiences: Experience[] = data.map((exp: any) => {
          const image = exp.cover_image || KAYAK_IMAGE;
          const email = (exp.provider_email || '').trim().toLowerCase();
          const banking = providerBankingMap.get(email);
          return {
            id: exp.id,
            slug: exp.slug,
            title: exp.title,
            shortTitle: exp.title,
            kicker: '',
            tagline: exp.tagline,
            description: exp.description,
            region: exp.region,
            meetingPoint: exp.meeting_point || '',
            difficulty: exp.difficulty || 'Baja',
            durationDays: 1,
            durationLabel: exp.duration_label || '4 horas',
            altitudeMeters: exp.altitude_meters ?? 0,
            bestSeason: '',
            priceArs: exp.price_ars,
            priceUsd: exp.price_usd ?? 70,
            maxSpotsPerGroup: exp.capacity_per_date || 12,
            coverImage: image,
            galleryImages: [image],
            albumPhotos:
              Array.isArray(exp.album_photos) && exp.album_photos.length > 0
                ? exp.album_photos
                : undefined,
            videoUrl: exp.video_url || undefined,
            videoPoster: exp.video_poster || undefined,
            highlights:
              Array.isArray(exp.highlights) && exp.highlights.length > 0
                ? exp.highlights
                : [],
            included:
              Array.isArray(exp.included) && exp.included.length > 0
                ? exp.included
                : [],
            notIncluded:
              Array.isArray(exp.not_included) && exp.not_included.length > 0
                ? exp.not_included
                : [],
            dates:
              Array.isArray(exp.dates) && exp.dates.length > 0
                ? exp.dates
                : [],
            dateSlots: Array.isArray(exp.date_slots) ? exp.date_slots : undefined,
            providerEmail: exp.provider_email || undefined,
            providerName: exp.provider_name || undefined,
            providerPhone: exp.provider_phone || undefined,
            providerCbuAlias: banking?.cbu_alias || undefined,
            providerCuitDni: banking?.cuit_dni || undefined,
            providerBankName: banking?.bank_name || undefined,
            status: exp.status || 'publicada',
            publicUrl: exp.public_url || `https://experiencias.club/experiencias/${exp.slug}`,
            isExclusiveClub: true,
            isLocked: false,
            detailRoute: `/experiencias/${exp.slug}`,
          };
        });

        this._hasRemoteExperiences.set(true);
        this._experiences.set(remoteExperiences);
        this.persistToLocalStorage(remoteExperiences);
      }
      return true;
    } catch (err) {
      console.warn('[ExperienceService] Error cargando desde Supabase:', err);
      return false;
    }
  }
}
