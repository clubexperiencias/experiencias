export interface Experience {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  region: 'Puna de Atacama' | 'Antofagasta de la Sierra' | 'Fiambalá y Seismiles' | 'Belén y Ruta del Telar' | 'Valle Central y Ambato';
  difficulty: 'Baja' | 'Moderada' | 'Exigente' | 'Alta Montaña';
  durationDays: number;
  durationLabel: string;
  altitudeMeters: number;
  bestSeason: string;
  priceArs: number;
  priceUsd: number;
  maxSpotsPerGroup: number;
  rating: number;
  reviewsCount: number;
  coverImage: string;
  galleryImages: string[];
  highlights: string[];
  included: string[];
  isExclusiveClub: boolean;
  isLocked?: boolean;
  detailRoute?: string;
}
