export interface ExperienceAlbumPhoto {
  id: string;
  url: string;
  title?: string;
  caption?: string;
  isCover?: boolean; // Exactamente 1 como portada
  isFeatured?: boolean; // Exactamente 2 como destacadas
  order?: number;
}

export interface ExperiencePricingPack {
  id: string;
  label: string; // Ej: "Promo 2x1", "Pack Grupo x4 (pagan 3)"
  seats: number; // Cupos reales que reserva (ej. 2 para 2x1, 4 para 4x3)
  totalPriceArs: number; // Precio total del pack en ARS
  validWeekdays?: number[]; // 0=Dom .. 6=Sáb (vacío = todos los días)
  validDates?: string[]; // Fechas exactas YYYY-MM-DD (vacío = todas las fechas)
  active?: boolean;
}

export const PRICING_WEEKDAY_OPTIONS: ReadonlyArray<{ value: number; short: string; label: string }> = [
  { value: 1, short: 'Lun', label: 'Lunes' },
  { value: 2, short: 'Mar', label: 'Martes' },
  { value: 3, short: 'Mié', label: 'Miércoles' },
  { value: 4, short: 'Jue', label: 'Jueves' },
  { value: 5, short: 'Vie', label: 'Viernes' },
  { value: 6, short: 'Sáb', label: 'Sábado' },
  { value: 0, short: 'Dom', label: 'Domingo' },
];

export function isPricingPackValidForDate(
  pack: ExperiencePricingPack,
  isoDate?: string | null,
): boolean {
  if (pack.active === false) return false;
  if (!pack.seats || pack.seats < 1 || pack.totalPriceArs < 0) return false;
  const hasDates = Array.isArray(pack.validDates) && pack.validDates.length > 0;
  const hasWeekdays = Array.isArray(pack.validWeekdays) && pack.validWeekdays.length > 0;
  if (!hasDates && !hasWeekdays) return true;
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  if (hasDates && pack.validDates!.includes(isoDate)) return true;
  if (hasWeekdays) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const weekday = new Date(y, m - 1, d).getDay();
    if (pack.validWeekdays!.includes(weekday)) return true;
  }
  return false;
}

export function formatPricingPackSchedule(pack: ExperiencePricingPack): string {
  const parts: string[] = [];
  if (pack.validWeekdays && pack.validWeekdays.length > 0) {
    const labels = PRICING_WEEKDAY_OPTIONS
      .filter((w) => pack.validWeekdays!.includes(w.value))
      .map((w) => w.short);
    if (labels.length > 0) {
      parts.push(labels.join(', '));
    }
  }
  if (pack.validDates && pack.validDates.length > 0) {
    const formatted = pack.validDates.map((d) => {
      const segs = d.split('-');
      return segs.length === 3 ? `${segs[2]}/${segs[1]}` : d;
    });
    parts.push(formatted.join(', '));
  }
  return parts.length > 0 ? parts.join(' · ') : 'Todas las fechas';
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

export const EXPERIENCE_DURATION_OPTIONS: readonly string[] = [
  '15 a 30 minutos (Express)',
  '30 minutos',
  '30 a 45 minutos',
  '1 hora',
  '1 a 2 horas',
  '2 a 3 horas (Actividad corta)',
  '4 horas (Media jornada)',
  '6 a 8 horas (Jornada completa)',
  '8 horas (Jornada completa)',
  'Día completo (10 h)',
  'Día completo con noche (2 días / 1 noche)',
  'Expedición 3 días / 2 noches',
  'Travesía 4 días o más',
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
  initialSlug?: string;
  slugAliases?: string[];
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
  pricingPacks?: ExperiencePricingPack[];
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
