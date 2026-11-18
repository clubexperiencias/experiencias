export type HospedajeType =
  | 'Hostería de Altura'
  | 'Refugio Puneño'
  | 'Eco-Lodge & Cabaña'
  | 'Hotel Termal'
  | 'Glamping Andino';

export interface HospedajeAmenity {
  id: string;
  label: string;
  icon: string;
}

export interface Hospedaje {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  type: HospedajeType;
  region: string;
  locality: string;
  altitudeMeters: number;
  coverImage: string;
  galleryImages: string[];
  priceArsPerNight: number;
  priceUsdPerNight?: number;
  capacityPerRoom?: number;
  totalRooms?: number;
  amenities: string[];
  hostName?: string;
  hostAgency?: string;
  hostPhone?: string;
  isFeatured?: boolean;
  isVerified?: boolean;
  isLocked?: boolean;
  contactWhatsapp?: string;
  contactEmail?: string;
  bookingUrl?: string;
  detailRoute?: string;
  address?: string;
  checkInTime?: string;
  checkOutTime?: string;
  highlights: string[];
  includedServices: string[];
}

