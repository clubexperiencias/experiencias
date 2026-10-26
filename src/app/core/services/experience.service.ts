import { Injectable, signal } from '@angular/core';
import { Experience } from '../models/experience.model';

@Injectable({
  providedIn: 'root'
})
export class ExperienceService {
  private readonly _experiences = signal<Experience[]>([
    {
      id: 'exp_pomez',
      slug: 'campo-de-piedra-pomez',
      title: 'Campo de Piedra Pómez & Duna Gigante',
      tagline: 'Un océano blanco de olas petrificadas en el corazón de la Puna',
      description: 'Expedición 4x4 guiada por geólogos y guías locales hacia el paisaje más surrealista de Argentina. Formaciones de piedra pómez labradas por el viento andino a más de 3.000 metros de altitud.',
      region: 'Antofagasta de la Sierra',
      difficulty: 'Moderada',
      durationDays: 2,
      durationLabel: '2 Días / 1 Noche en Puna',
      altitudeMeters: 3300,
      bestSeason: 'Octubre a Mayo',
      priceArs: 185000,
      priceUsd: 190,
      maxSpotsPerGroup: 8,
      rating: 4.96,
      reviewsCount: 48,
      coverImage: '/assets/images/catamarca_pomez.jpg',
      galleryImages: ['/assets/images/catamarca_pomez.jpg'],
      highlights: [
        'Atardecer y noche estrellada bajo el cielo más limpio de América del Sur',
        'Caminata silenciosa por las gargantas de piedra pómez blanca',
        'Degustación de vinos de altura y empanadas tradicionales catamarqueñas'
      ],
      included: ['Camioneta 4x4 equipada', 'Guía certificado WFR', 'Alojamiento en refugio puneño', 'Pensión completa'],
      isExclusiveClub: true
    },
    {
      id: 'exp_kayak_pirquitas',
      slug: 'kayak-sunset-dique-las-pirquitas',
      title: 'Travesía en Kayak & Sunset en Las Pirquitas',
      tagline: 'Navegación al atardecer en espejo de agua entre las Sierras de Ambato',
      description: 'Remada en kayak doble o individual en aguas calmas rodeadas de quebradas y vegetación de yungas. Finalizamos con un brindis al atardecer y picada de quesos y embutidos regionales.',
      region: 'Valle Central y Ambato',
      difficulty: 'Baja',
      durationDays: 1,
      durationLabel: 'Media Jornada (4 horas)',
      altitudeMeters: 850,
      bestSeason: 'Todo el año',
      priceArs: 65000,
      priceUsd: 70,
      maxSpotsPerGroup: 12,
      rating: 4.95,
      reviewsCount: 62,
      coverImage: '/assets/images/laguna_blanca.jpg',
      galleryImages: ['/assets/images/laguna_blanca.jpg'],
      highlights: [
        'Navegación guiada por instructores certificados en aguas mansas',
        'Puntos panorámicos inaccesibles por tierra firme',
        'Atardecer con degustación de dulces y quesos de cabra catamarqueños'
      ],
      included: ['Kayaks de travesía y remos de carbono', 'Chaleco salvavidas reglamentario', 'Guía náutico certificado', 'Snack y bebidas'],
      isExclusiveClub: true
    },
    {
      id: 'exp_seismiles',
      slug: 'ruta-de-los-seismiles-laguna-verde',
      title: 'Ruta de los Seismiles & Laguna Verde',
      tagline: 'Expedición de alta montaña entre gigantes andinos de más de 6.000 metros',
      description: 'Travesía escénica por la mítica Ruta Nacional 60 ascendiendo hacia el Paso de San Francisco, avistando el Volcán Pissis, Ojos del Salado e hipnóticas lagunas turquesas de altura.',
      region: 'Fiambalá y Seismiles',
      difficulty: 'Exigente',
      durationDays: 3,
      durationLabel: '3 Días / 2 Noches',
      altitudeMeters: 4700,
      bestSeason: 'Noviembre a Abril',
      priceArs: 240000,
      priceUsd: 250,
      maxSpotsPerGroup: 6,
      rating: 4.98,
      reviewsCount: 39,
      coverImage: '/assets/images/catamarca_hero.jpg',
      galleryImages: ['/assets/images/catamarca_hero.jpg'],
      highlights: [
        'Vistas a las cumbres más altas de la Cordillera de los Andes después del Aconcagua',
        'Termas naturales de Fiambalá bajo el cielo estrellado',
        'Avistaje de vicuñas, flamencos andinos y salares de altura'
      ],
      included: ['Transporte 4x4 especializado', 'Guía matriculado de montaña', 'Alojamiento en hosterías de cordillera', 'Seguro de aventura'],
      isExclusiveClub: true
    }
  ]);

  readonly experiences = this._experiences.asReadonly();
}
