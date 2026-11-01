import { Injectable, inject, signal } from '@angular/core';
import { Experience } from '../models/experience.model';
import { SUPABASE_CLIENT, isSupabaseConfigured } from '../supabase/supabase.client';

const KAYAK_IMAGE = '/assets/images/kayak-club-de-experiencias.jpg';
const STORAGE_KEY = 'club_experiencias_catalog_v1';

export const KAYAK_DEFAULT_EXPERIENCE: Experience = {
  id: 'exp-kayak',
  slug: 'kayak',
  title: 'Travesía en Kayak & Sunset en el Dique El Jumeal',
  shortTitle: 'Travesía en Kayak',
  kicker: 'EXPEDICIÓN NÁUTICA: VALLE CENTRAL',
  tagline: 'Remada guiada al atardecer con brindis de productos catamarqueños.',
  description:
    'Remada guiada en kayak en aguas calmas rodeadas de quebradas y vegetación de yungas andinas. Presenciamos la caída del sol reflejada en el dique y coronamos la jornada con un brindis y picada de productos artesanales catamarqueños.',
  region: 'Valle Central y Ambato',
  meetingPoint: 'Club Náutico Dique El Jumeal',
  difficulty: 'Baja',
  durationDays: 1,
  durationLabel: '4 Horas (Media Jornada)',
  altitudeMeters: 850,
  bestSeason: 'Todo el año',
  priceArs: 65000,
  priceUsd: 70,
  maxSpotsPerGroup: 12,
  rating: 4.95,
  reviewsCount: 62,
  coverImage: KAYAK_IMAGE,
  galleryImages: [KAYAK_IMAGE],
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
  notIncluded: [
    'Traslados hasta el Club Náutico',
    'Ropa de recambio y toallas personales',
  ],
  dates: [
    '2026-11-10',
    '2026-11-17',
    '2026-11-24',
  ],
  status: 'publicada',
  publicUrl: 'https://experiencias.club/experiencias/kayak',
  isExclusiveClub: true,
  isLocked: false,
  detailRoute: '/experiencias/kayak',
};

@Injectable({
  providedIn: 'root',
})
export class ExperienceService {
  private readonly supabase = inject(SUPABASE_CLIENT);
  private readonly _experiences = signal<Experience[]>(this.loadInitialExperiences());
  private readonly _hasRemoteExperiences = signal(false);

  readonly experiences = this._experiences.asReadonly();
  readonly hasRemoteExperiences = this._hasRemoteExperiences.asReadonly();

  constructor() {
    if (isSupabaseConfigured()) {
      void this.loadFromSupabase();
    }
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
    const list = this._experiences();
    const index = list.findIndex((e) => e.id === updated.id);
    if (index === -1) {
      throw new Error(`Experiencia con ID ${updated.id} no encontrada.`);
    }

    const current = list[index];
    const merged: Experience = {
      ...current,
      ...updated,
      detailRoute: updated.slug ? `/experiencias/${updated.slug}` : current.detailRoute,
      publicUrl: updated.slug
        ? `https://experiencias.club/experiencias/${updated.slug}`
        : current.publicUrl,
    };

    const nextList = [...list];
    nextList[index] = merged;
    this._experiences.set(nextList);
    this.persistToLocalStorage(nextList);

    if (isSupabaseConfigured()) {
      try {
        const payload: Record<string, unknown> = {
          title: merged.title,
          short_title: merged.shortTitle || merged.title,
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
          kicker: merged.kicker || '',
          video_url: merged.videoUrl || '',
          video_poster: merged.videoPoster || '',
          altitude_meters: merged.altitudeMeters || 0,
          best_season: merged.bestSeason || 'Todo el año',
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

        const { error } = await this.supabase
          .from('experiencias')
          .update(payload as any)
          .eq('id', merged.id);

        if (error) {
          console.warn('[ExperienceService] Error al actualizar experiencia en Supabase:', error);
        }
      } catch (err) {
        console.warn('[ExperienceService] Fallo remoto:', err);
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
    this._experiences.set(nextList);
    this.persistToLocalStorage(nextList);

    if (isSupabaseConfigured()) {
      try {
        const payload: Record<string, unknown> = {
          id: experience.id,
          slug: experience.slug,
          title: experience.title,
          short_title: experience.shortTitle || experience.title,
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
          kicker: experience.kicker || '',
          video_url: experience.videoUrl || '',
          video_poster: experience.videoPoster || '',
          altitude_meters: experience.altitudeMeters || 0,
          best_season: experience.bestSeason || 'Todo el año',
          dates: experience.dates || [],
          highlights: experience.highlights || [],
          included: experience.included || [],
          not_included: experience.notIncluded || [],
          status: experience.status,
          public_url: experience.publicUrl,
        };

        const { error } = await this.supabase.from('experiencias').insert(payload as any);
        if (error) {
          console.warn('[ExperienceService] Error al insertar experiencia en Supabase:', error);
        }
      } catch (err) {
        console.warn('[ExperienceService] Fallo al crear remoto:', err);
      }
    }
  }

  async toggleExperienceStatus(id: string, newStatus: 'publicada' | 'oculta'): Promise<void> {
    await this.updateExperience({ id, status: newStatus });
  }

  async deleteExperience(id: string): Promise<void> {
    const list = this._experiences().filter((e) => e.id !== id);
    this._experiences.set(list);
    this.persistToLocalStorage(list);

    if (isSupabaseConfigured()) {
      try {
        await this.supabase.from('experiencias').delete().eq('id', id);
      } catch (err) {
        console.warn('[ExperienceService] Fallo al eliminar en Supabase:', err);
      }
    }
  }

  private loadInitialExperiences(): Experience[] {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Experience[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Asegurar que kayak tenga valores default completos
            return parsed.map((e) => (e.slug === 'kayak' ? { ...KAYAK_DEFAULT_EXPERIENCE, ...e } : e));
          }
        }
      } catch {
        // Fallback
      }
    }
    return [KAYAK_DEFAULT_EXPERIENCE];
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

  private async loadFromSupabase(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('experiencias')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('[ExperienceService] No se pudieron cargar las experiencias remotas:', error);
        return;
      }

      if (data && data.length > 0) {
        const remoteExperiences: Experience[] = data.map((exp: any) => {
          const image = exp.cover_image || KAYAK_IMAGE;
          const isKayak = exp.slug === 'kayak';
          return {
            id: exp.id,
            slug: exp.slug,
            title: exp.title,
            shortTitle: exp.short_title || (isKayak ? KAYAK_DEFAULT_EXPERIENCE.shortTitle : exp.title),
            kicker: exp.kicker || (isKayak ? KAYAK_DEFAULT_EXPERIENCE.kicker : ''),
            tagline: exp.tagline,
            description: exp.description,
            region: exp.region,
            meetingPoint: exp.meeting_point || (isKayak ? KAYAK_DEFAULT_EXPERIENCE.meetingPoint : ''),
            difficulty: exp.difficulty || 'Baja',
            durationDays: 1,
            durationLabel: exp.duration_label || '4 horas',
            altitudeMeters: exp.altitude_meters ?? (isKayak ? 850 : 0),
            bestSeason: exp.best_season || 'Todo el año',
            priceArs: exp.price_ars,
            priceUsd: exp.price_usd ?? 70,
            maxSpotsPerGroup: exp.capacity_per_date || 12,
            rating: isKayak ? 4.95 : 0,
            reviewsCount: isKayak ? 62 : 0,
            coverImage: image,
            galleryImages: [image],
            videoUrl: exp.video_url || (isKayak ? KAYAK_DEFAULT_EXPERIENCE.videoUrl : undefined),
            videoPoster: exp.video_poster || (isKayak ? KAYAK_DEFAULT_EXPERIENCE.videoPoster : undefined),
            highlights: Array.isArray(exp.highlights) && exp.highlights.length > 0
              ? exp.highlights
              : (isKayak ? KAYAK_DEFAULT_EXPERIENCE.highlights : []),
            included: Array.isArray(exp.included) && exp.included.length > 0
              ? exp.included
              : (isKayak ? KAYAK_DEFAULT_EXPERIENCE.included : []),
            notIncluded: Array.isArray(exp.not_included) && exp.not_included.length > 0
              ? exp.not_included
              : (isKayak ? KAYAK_DEFAULT_EXPERIENCE.notIncluded : []),
            dates: Array.isArray(exp.dates) && exp.dates.length > 0
              ? exp.dates
              : (isKayak ? KAYAK_DEFAULT_EXPERIENCE.dates : []),
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
    } catch (err) {
      console.warn('[ExperienceService] Error cargando desde Supabase:', err);
    }
  }
}
