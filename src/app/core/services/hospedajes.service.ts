import { Injectable, computed, signal } from '@angular/core';
import { Hospedaje } from '../models/hospedaje.model';

export const INITIAL_HOSPEDAJES: Hospedaje[] = [
  {
    id: 'hosp-coming-soon-1',
    slug: 'proximamente-hospedaje-puna',
    title: 'Nueva experiencia en Catamarca',
    tagline: 'Estamos preparando una nueva opción de hospedaje y refugio para compartir con el Club.',
    description:
      'Muy pronto vas a poder conocer todos los detalles de este alojamiento para tu descanso y aclimatación.',
    type: 'Refugio Puneño',
    region: 'Puna y Seismiles',
    locality: 'Catamarca',
    altitudeMeters: 3400,
    priceArsPerNight: 0,
    priceUsdPerNight: 0,
    capacityPerRoom: 0,
    totalRooms: 0,
    amenities: [],
    hostName: 'Club de Experiencias',
    coverImage: '/assets/images/catamarca_hero.jpg',
    galleryImages: ['/assets/images/catamarca_hero.jpg'],
    highlights: [
      'Alojamiento exclusivo en fase final de curaduría y relevamiento técnico',
      'Protocolo estricto de confort andino y hospitalidad regional',
    ],
    includedServices: [],
    isFeatured: true,
    isVerified: true,
    isLocked: true,
  },
  {
    id: 'hosp-coming-soon-2',
    slug: 'proximamente-hospedaje-valle',
    title: 'Nueva experiencia en Catamarca',
    tagline: 'Estamos preparando una nueva opción de hospedaje y refugio para compartir con el Club.',
    description:
      'Muy pronto vas a poder conocer todos los detalles de esta estancia andina para socios del Club.',
    type: 'Eco-Lodge & Cabaña',
    region: 'Valle Central y Ambato',
    locality: 'Catamarca',
    altitudeMeters: 1200,
    priceArsPerNight: 0,
    priceUsdPerNight: 0,
    capacityPerRoom: 0,
    totalRooms: 0,
    amenities: [],
    hostName: 'Club de Experiencias',
    coverImage: '/assets/images/laguna_blanca.jpg',
    galleryImages: ['/assets/images/laguna_blanca.jpg'],
    highlights: [
      'Espacio seleccionado para descanso previo y posterior a travesías',
      'Entorno natural con diseño sustentable y térmico',
    ],
    includedServices: [],
    isFeatured: true,
    isVerified: true,
    isLocked: true,
  },
  {
    id: 'hosp-coming-soon-3',
    slug: 'proximamente-hospedaje-belen',
    title: 'Nueva experiencia en Catamarca',
    tagline: 'Estamos preparando una nueva opción de hospedaje y refugio para compartir con el Club.',
    description:
      'Hostería de altura en proceso de relevamiento y homologación.',
    type: 'Hostería de Altura',
    region: 'Belén y Ruta 40',
    locality: 'Catamarca',
    altitudeMeters: 2000,
    priceArsPerNight: 0,
    priceUsdPerNight: 0,
    capacityPerRoom: 0,
    totalRooms: 0,
    amenities: [],
    hostName: 'Club de Experiencias',
    coverImage: '/assets/images/catamarca_pomez.jpg',
    galleryImages: ['/assets/images/catamarca_pomez.jpg'],
    highlights: [
      'Ubicación estratégica sobre los corredores turísticos de la provincia',
      'Atención personalizada con anfitriones y baqueanos locales',
    ],
    includedServices: [],
    isFeatured: true,
    isVerified: true,
    isLocked: true,
  },
];

@Injectable({
  providedIn: 'root',
})
export class HospedajesService {
  private readonly _hospedajes = signal<Hospedaje[]>(INITIAL_HOSPEDAJES);

  readonly hospedajes = this._hospedajes.asReadonly();

  readonly featuredHospedajes = computed(() =>
    this._hospedajes().filter((h) => h.isFeatured && !h.isLocked),
  );

  setHospedajes(items: Hospedaje[]): void {
    this._hospedajes.set(items);
  }

  getHospedajeBySlug(slug: string): Hospedaje | undefined {
    if (!slug) return undefined;
    const clean = slug.trim().toLowerCase();
    return (
      this._hospedajes().find((h) => h.slug.toLowerCase() === clean) ||
      INITIAL_HOSPEDAJES.find((h) => h.slug.toLowerCase() === clean)
    );
  }

  getHospedajeById(id: string): Hospedaje | undefined {
    if (!id) return undefined;
    return (
      this._hospedajes().find((h) => h.id === id) ||
      INITIAL_HOSPEDAJES.find((h) => h.id === id)
    );
  }
}
