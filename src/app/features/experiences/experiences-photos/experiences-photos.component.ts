import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../../core/services/newsletter.service';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../../../shared/components/breadcrumb/breadcrumb.component';

export interface AdminFeaturedPhoto {
  id: string;
  src: string;
  title: string;
  caption: string;
  experienceName: string;
  experienceSlug: string;
  experienceRoute: string;
  region: string;
  altitudeMeters: number;
  adminName: string;
  adminRole: string;
  badge: string;
  spanClass?: string; // 'span-hero' | 'span-tall' | 'span-wide' | 'span-normal'
}

export type PhotoExperienceFilter = 'all' | 'kayak' | 'pomez' | 'seismiles' | 'laguna-blanca';

@Component({
  selector: 'app-experiences-photos',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, FooterComponent, HeaderComponent, BreadcrumbComponent],
  templateUrl: './experiences-photos.component.html',
  styleUrl: './experiences-photos.component.css'
})
export class ExperiencesPhotosComponent {
  readonly newsletter = inject(NewsletterService);
  readonly router = inject(Router);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Experiencias', url: '/experiencias' },
    { label: 'Fotos Destacadas' }
  ];

  readonly mobileMenuOpen = signal(false);
  readonly activeFilter = signal<PhotoExperienceFilter>('all');
  readonly activeModalPhoto = signal<AdminFeaturedPhoto | null>(null);

  readonly featuredPhotos: AdminFeaturedPhoto[] = [
    {
      id: 'photo_kayak_1',
      src: '/assets/images/kayak-club-de-experiencias.jpg',
      title: 'Sunset de Espejos en Las Pirquitas',
      caption: 'Navegación en kayak doble durante la hora dorada sobre las aguas calmas del dique, con el telón de fondo de las Sierras de Ambato.',
      experienceName: 'Travesía en Kayak & Sunset en Las Pirquitas',
      experienceSlug: 'kayak',
      experienceRoute: '/experiencias/kayak',
      region: 'Valle Central y Ambato',
      altitudeMeters: 850,
      adminName: 'Lucas Nieto',
      adminRole: 'Guía Náutico Homologado',
      badge: 'DESTACADA POR GUÍA',
      spanClass: 'span-hero'
    },
    {
      id: 'photo_pomez_1',
      src: '/assets/images/catamarca_pomez.jpg',
      title: 'Laberinto de Ceniza Blanca en Antofagasta',
      caption: 'Formaciones eólicas únicas en el mundo esculpidas en pumita volcánica a más de 3.000 metros de altitud bajo el cielo más transparente del continente.',
      experienceName: 'Campo de Piedra Pómez & Duna Gigante',
      experienceSlug: 'pomez',
      experienceRoute: '/experiencias',
      region: 'Antofagasta de la Sierra',
      altitudeMeters: 3300,
      adminName: 'Valentina Morales',
      adminRole: 'Co-Fundadora & Curadora',
      badge: 'DESTACADA POR ADMIN',
      spanClass: 'span-wide'
    },
    {
      id: 'photo_seismiles_1',
      src: '/assets/images/laguna-verde.jpg',
      title: 'Ojos Turquesas de la Laguna Verde',
      caption: 'Reflejos minerales sobre la laguna de altura en el Paso de San Francisco, custodiada por conos volcánicos de más de 6.000 metros.',
      experienceName: 'Ruta de los Seismiles & Laguna Verde',
      experienceSlug: 'seismiles',
      experienceRoute: '/experiencias',
      region: 'Fiambalá y Seismiles',
      altitudeMeters: 4700,
      adminName: 'Sergio Albarracín',
      adminRole: 'Guía de Alta Montaña WFR',
      badge: 'SELECCIÓN DE EXPEDICIÓN',
      spanClass: 'span-tall'
    },
    {
      id: 'photo_laguna_blanca_1',
      src: '/assets/images/laguna_blanca.jpg',
      title: 'Vicuñas Silvestres en Reserva Laguna Blanca',
      caption: 'Tarde de silencio andino en la Reserva de Biosfera, donde manadas de vicuñas pastan junto a las vegas altoandinas.',
      experienceName: 'Reserva de Biosfera Laguna Blanca',
      experienceSlug: 'laguna-blanca',
      experienceRoute: '/experiencias',
      region: 'Belén & Laguna Blanca',
      altitudeMeters: 3200,
      adminName: 'Equipo Club',
      adminRole: 'Admin de Operaciones',
      badge: 'DESTACADA POR ADMIN',
      spanClass: 'span-normal'
    },
    {
      id: 'photo_pomez_2',
      src: '/assets/images/piedra-pomez.png',
      title: 'Geometría del Viento Puneño',
      caption: 'Relieve esculpido en piedra pómez durante milenios. Los estratos volcánicos revelan la historia geológica de la cordillera catamarqueña.',
      experienceName: 'Campo de Piedra Pómez & Duna Gigante',
      experienceSlug: 'pomez',
      experienceRoute: '/experiencias',
      region: 'Antofagasta de la Sierra',
      altitudeMeters: 3300,
      adminName: 'Lucas Nieto',
      adminRole: 'Fotografía Oficial Club',
      badge: 'ARCHIVOS DE BITÁCORA',
      spanClass: 'span-normal'
    },
    {
      id: 'photo_relieve_1',
      src: '/assets/images/relieve.jpeg',
      title: 'Relieve de la Puna y Cumbres Occidentales',
      caption: 'Captura aérea del filo montañoso que divide los valles centrales de las altas mesetas puneñas.',
      experienceName: 'Ruta de los Seismiles & Cordillera',
      experienceSlug: 'seismiles',
      experienceRoute: '/experiencias',
      region: 'Tinogasta & Fiambalá',
      altitudeMeters: 4100,
      adminName: 'Valentina Morales',
      adminRole: 'Co-Fundadora & Curadora',
      badge: 'DESTACADA POR ADMIN',
      spanClass: 'span-wide'
    },
    {
      id: 'photo_hero_ambato',
      src: '/assets/images/catamarca_hero.jpg',
      title: 'Amanecer en las Quebradas de Ambato',
      caption: 'Primeros rayos de sol iluminando los cordones de yungas que alimentan la cuenca del Río Las Pirquitas.',
      experienceName: 'Travesía en Kayak & Sunset en Las Pirquitas',
      experienceSlug: 'kayak',
      experienceRoute: '/experiencias/kayak',
      region: 'Valle Central y Ambato',
      altitudeMeters: 850,
      adminName: 'Sergio Albarracín',
      adminRole: 'Baqueano Local',
      badge: 'SELECCIÓN DE EXPEDICIÓN',
      spanClass: 'span-normal'
    }
  ];

  filteredPhotos(): AdminFeaturedPhoto[] {
    const filter = this.activeFilter();
    if (filter === 'all') return this.featuredPhotos;
    return this.featuredPhotos.filter((p) => p.experienceSlug === filter);
  }

  setFilter(filter: PhotoExperienceFilter): void {
    this.activeFilter.set(filter);
  }

  openPhotoModal(photo: AdminFeaturedPhoto): void {
    this.activeModalPhoto.set(photo);
  }

  closePhotoModal(): void {
    this.activeModalPhoto.set(null);
  }

  toggleMobileMenu(event: Event): void {
    event.stopPropagation();
    this.mobileMenuOpen.update((v) => !v);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.mobileMenuOpen.set(false);
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.closePhotoModal();
    this.mobileMenuOpen.set(false);
  }
}
