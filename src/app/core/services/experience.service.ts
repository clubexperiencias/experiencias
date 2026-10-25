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
      id: 'exp_seismiles',
      slug: 'ruta-de-los-seismiles-pissis',
      title: 'Balcón del Pissis & Seismiles Sagrados',
      tagline: 'La segunda cumbre más alta de América rodeada de lagunas esmeralda',
      description: 'Travesía de alta montaña hacia los gigantes andinos. Lagunas de colores inverosímiles (Turquesa, Negra, Celeste y Verde) pobladas de flamencos andinos en salares vírgenes.',
      region: 'Fiambalá y Seismiles',
      difficulty: 'Exigente',
      durationDays: 3,
      durationLabel: '3 Días / 2 Noches',
      altitudeMeters: 4600,
      bestSeason: 'Noviembre a Abril',
      priceArs: 240000,
      priceUsd: 250,
      maxSpotsPerGroup: 6,
      rating: 4.98,
      reviewsCount: 34,
      coverImage: '/assets/images/catamarca_hero.jpg',
      galleryImages: ['/assets/images/catamarca_hero.jpg'],
      highlights: [
        'Vistas panorámicas del Monte Pissis (6.795 msnm)',
        'Avistaje de fauna autóctona: vicuñas silvestres y parinas',
        'Termas naturales de alta montaña al anochecer'
      ],
      included: ['Transporte 4x4 especializado', 'Equipo de aclimatación y oxígeno', 'Campamento domo premium', 'Gastronomía de autor'],
      isExclusiveClub: true
    },
    {
      id: 'exp_galan',
      slug: 'caldera-volcan-galan',
      title: 'Cráter del Volcán Galán & Laguna Diamante',
      tagline: 'El cráter volcánico más imponente del planeta Tierra',
      description: 'Una de las maravillas geológicas más extremas del mundo. Una caldera de 45 km de diámetro con aguas turquesas hipersalinas y extremófilos que replican las condiciones del origen de la vida.',
      region: 'Puna de Atacama',
      difficulty: 'Alta Montaña',
      durationDays: 3,
      durationLabel: '3 Días / Expedición Extrema',
      altitudeMeters: 4900,
      bestSeason: 'Noviembre a Marzo',
      priceArs: 290000,
      priceUsd: 310,
      maxSpotsPerGroup: 6,
      rating: 5.0,
      reviewsCount: 22,
      coverImage: '/assets/images/catamarca_hero.jpg',
      galleryImages: ['/assets/images/catamarca_hero.jpg'],
      highlights: [
        'Descenso al interior de la caldera volcánica más ancha del mundo',
        'Fumarolas activas y termas escondidas',
        'Registro fotográfico profesional incluido para tu bitácora de recuerdos'
      ],
      included: ['Vehículos oruga/4x4 de rescate', 'Guía geólogo andino', 'Seguro de alta montaña', 'Comidas gourmet liofilizadas y frescas'],
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
      coverImage: '/assets/images/catamarca_pomez.jpg',
      galleryImages: ['/assets/images/catamarca_pomez.jpg'],
      highlights: [
        'Navegación guiada por instructores certificados en aguas mansas',
        'Puntos panorámicos inaccesibles por tierra firme',
        'Atardecer con degustación de dulces y quesos de cabra catamarqueños'
      ],
      included: ['Kayaks de travesía y remos de carbono', 'Chaleco salvavidas reglamentario', 'Guía náutico certificado', 'Snack y bebidas'],
      isExclusiveClub: true
    }
  ]);

  readonly experiences = this._experiences.asReadonly();
}
