import { Injectable, inject, signal } from '@angular/core';
import { Experience } from '../models/experience.model';
import { SUPABASE_CLIENT, isSupabaseConfigured } from '../supabase/supabase.client';

const KAYAK_IMAGE = '/assets/images/kayak-club-de-experiencias.jpg';

const KAYAK_FALLBACK: Experience = {
  id: 'exp-kayak',
  slug: 'kayak',
  title: 'Travesía en Kayak & Sunset en el Dique El Jumeal',
  tagline: 'Remada guiada al atardecer con brindis de productos catamarqueños.',
  description:
    'Remada guiada en kayak en aguas calmas rodeadas de quebradas y vegetación de yungas andinas.',
  region: 'Valle Central y Ambato',
  difficulty: 'Baja',
  durationDays: 1,
  durationLabel: '4 horas',
  altitudeMeters: 850,
  bestSeason: 'Todo el año',
  priceArs: 65000,
  priceUsd: 70,
  maxSpotsPerGroup: 12,
  rating: 0,
  reviewsCount: 0,
  coverImage: KAYAK_IMAGE,
  galleryImages: [KAYAK_IMAGE],
  highlights: [],
  included: [],
  isExclusiveClub: true,
  isLocked: false,
  detailRoute: '/experiencias/kayak',
};

@Injectable({
  providedIn: 'root',
})
export class ExperienceService {
  private readonly supabase = inject(SUPABASE_CLIENT);
  private readonly _experiences = signal<Experience[]>([KAYAK_FALLBACK]);
  private readonly _hasRemoteExperiences = signal(false);

  readonly experiences = this._experiences.asReadonly();
  readonly hasRemoteExperiences = this._hasRemoteExperiences.asReadonly();

  constructor() {
    if (isSupabaseConfigured()) {
      void this.loadFromSupabase();
    }
  }

  private async loadFromSupabase(): Promise<void> {
    const { data, error } = await this.supabase
      .from('experiencias_club')
      .select('*')
      .eq('status', 'publicada')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[ExperienceService] No se pudieron cargar las experiencias remotas.', error);
      return;
    }

    const remoteExperiences = (data ?? []).map((experience) => {
        const image = experience.cover_image || KAYAK_IMAGE;
        return {
          id: experience.id,
          slug: experience.slug,
          title: experience.title,
          tagline: experience.tagline,
          description: experience.description,
          region: experience.region,
          difficulty: experience.difficulty,
          durationDays: 1,
          durationLabel: experience.duration_label,
          altitudeMeters: 0,
          bestSeason: 'Todo el año',
          priceArs: experience.price_ars,
          priceUsd: 0,
          maxSpotsPerGroup: experience.capacity_per_date,
          rating: 0,
          reviewsCount: 0,
          coverImage: image,
          galleryImages: [image],
          highlights: [],
          included: [],
          isExclusiveClub: true,
          isLocked: false,
          detailRoute: `/experiencias/${experience.slug}`,
        };
      });

    this._hasRemoteExperiences.set(remoteExperiences.length > 0);
    this._experiences.set(remoteExperiences.length > 0 ? remoteExperiences : [KAYAK_FALLBACK]);
  }
}
