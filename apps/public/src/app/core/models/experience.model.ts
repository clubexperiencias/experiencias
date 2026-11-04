export interface ExperienceAlbumPhoto {
  id: string;
  url: string;
  title?: string;
  caption?: string;
  isCover?: boolean; // Exactamente 1 como portada
  isFeatured?: boolean; // Exactamente 2 como destacadas
  order?: number;
}

export interface Experience {
  id: string;
  slug: string;
  title: string;
  shortTitle?: string;
  kicker?: string;
  tagline: string;
  description: string;
  region: string;
  meetingPoint?: string;
  difficulty: 'Baja' | 'Moderada' | 'Exigente' | 'Alta Montaña';
  durationDays: number;
  durationLabel: string;
  altitudeMeters: number;
  bestSeason?: string;
  priceArs: number;
  priceUsd: number;
  maxSpotsPerGroup: number;
  coverImage: string;
  galleryImages: string[];
  albumPhotos?: ExperienceAlbumPhoto[];
  videoUrl?: string;
  videoPoster?: string;
  highlights: string[];
  included: string[];
  notIncluded?: string[];
  dates?: string[];
  dateSlots?: {
    date: string;
    capacity?: number;
    unlimited?: boolean;
    closed?: boolean;
    note?: string;
  }[];
  status?: 'publicada' | 'borrador' | 'oculta';
  publicUrl?: string;
  isExclusiveClub: boolean;
  isLocked?: boolean;
  detailRoute?: string;
  providerId?: string;
  providerEmail?: string;
  providerSlug?: string;
  providerName?: string;
  providerPhone?: string;
  providerCbuAlias?: string;
  providerCuitDni?: string;
  providerBankName?: string;
}
