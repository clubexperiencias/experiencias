export interface ExperienceAlbumPhoto {
  id: string;
  url: string;
  title?: string;
  caption?: string;
  isCover?: boolean; // Exactamente 1 como portada
  isFeatured?: boolean; // Exactamente 2 como destacadas
  order?: number;
}

export interface AltitudeOption {
  value: number;
  label: string;
}

export interface ExperienceCategoryOption {
  value: string;
  label: string;
}

export const EXPERIENCE_CATEGORY_OPTIONS: readonly ExperienceCategoryOption[] = [
  { value: 'expediciones', label: 'Expediciones & Aventuras' },
  { value: 'hospedajes', label: 'Hospedajes & Refugios' },
];

export const ALTITUDE_OPTIONS: readonly AltitudeOption[] = [
  { value: 0, label: '0 msnm (Sin altitud / Llano o Náutica)' },
  { value: 500, label: '500 msnm (Valle Central / Diques)' },
  { value: 850, label: '850 msnm (San Fernando del Valle / Yungas)' },
  { value: 1000, label: '1.000 msnm (Piedemonte / Dique Las Pirquitas)' },
  { value: 1200, label: '1.200 msnm (El Rodeo / Paclín / Belén)' },
  { value: 1500, label: '1.500 msnm (Las Juntas / Valle de Abaucán / Tinogasta)' },
  { value: 2000, label: '2.000 msnm (Valles Calchaquíes / Santa María)' },
  { value: 2500, label: '2.500 msnm (Pre-cordillera / Hualfín)' },
  { value: 3000, label: '3.000 msnm (Inicio de la Puna / Aconquija)' },
  { value: 3400, label: '3.400 msnm (El Peñón / Antofagasta de la Sierra)' },
  { value: 3800, label: '3.800 msnm (Laguna Blanca / Campo de Piedra Pómez)' },
  { value: 4050, label: '4.050 msnm (Las Grutas / Paso San Francisco)' },
  { value: 4500, label: '4.500 msnm (Laguna Grande / Volcán Galán)' },
  { value: 5000, label: '5.000 msnm (Campo Base Seismiles / Lagunas de Altura)' },
  { value: 5500, label: '5.500 msnm (Refugios de Alta Montaña)' },
  { value: 6000, label: '6.000 msnm (Campamento Alto Seismiles)' },
  { value: 6500, label: '6.500 msnm (Cumbre San Francisco / Incahuasi)' },
  { value: 6893, label: '6.893 msnm (+6.000 Cumbre Ojos del Salado / Monte Pissis)' },
];

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
  meetingPointUrl?: string;
  difficulty: 'Baja' | 'Moderada' | 'Exigente' | 'Alta Montaña' | 'Ninguna';
  durationDays: number;
  durationLabel: string;
  altitudeMeters: number;
  bestSeason?: string;
  promosAndPricing?: string;
  priceArs: number;
  priceUsd: number;
  maxSpotsPerGroup: number;
  coverImage: string;
  galleryImages: string[];
  albumPhotos?: ExperienceAlbumPhoto[];
  videoUrl?: string;
  videoPoster?: string;
  itinerary?: string;
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
  status?: 'publicada' | 'borrador' | 'oculta' | 'pendiente' | 'rechazada';
  category?: 'expediciones' | 'hospedajes' | string;
  displayLocation?: 'destacada' | 'catalogo' | 'no_listada';
  publicUrl?: string;
  isExclusiveClub: boolean;
  isLocked?: boolean;
  detailRoute?: string;
  providerId?: string;
  providerEmail?: string;
  providerSlug?: string;
  providerName?: string;
  providerPhone?: string;
  providerAgency?: string;
  providerCbuAlias?: string;
  providerCuitDni?: string;
  providerBankName?: string;
  participantRequirements?: string;
  coverImageName?: string;
  coverVideoName?: string;
  notes?: string;
  reviewedAt?: string;
  isClubExperience?: boolean;
  mpConnected?: boolean;
  mpCollectorId?: string;
  pendingRemoteSync?: boolean;
  favoritesCount?: number;
  deletedAt?: string | null;
}
