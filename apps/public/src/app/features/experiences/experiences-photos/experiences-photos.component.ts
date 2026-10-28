import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../../core/services/newsletter.service';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../shared/components/breadcrumb/breadcrumb.component';
import { FounderAdComponent } from '../../../shared/components/founder-ad/founder-ad.component';

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

@Component({
  selector: 'app-experiences-photos',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    FooterComponent,
    HeaderComponent,
    BreadcrumbComponent,
    FounderAdComponent,
  ],
  templateUrl: './experiences-photos.component.html',
  styleUrl: './experiences-photos.component.css',
})
export class ExperiencesPhotosComponent {
  readonly newsletter = inject(NewsletterService);
  readonly router = inject(Router);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Experiencias', url: '/experiencias' },
    { label: 'Fotos Destacadas' },
  ];

  readonly mobileMenuOpen = signal(false);
  readonly activeModalPhoto = signal<AdminFeaturedPhoto | null>(null);
  readonly currentPhotoList = signal<AdminFeaturedPhoto[]>([]);
  readonly currentPhotoIndex = signal(0);
  readonly isLandscape = signal(true);

  readonly featuredPhotos: AdminFeaturedPhoto[] = [
    {
      id: 'photo_kayak_1',
      src: '/assets/images/kayak-club-de-experiencias.jpg',
      title: 'Sunset de Espejos en Las Pirquitas',
      caption:
        'Navegación en kayak doble durante la hora dorada sobre las aguas calmas del dique, con el telón de fondo de las Sierras de Ambato.',
      experienceName: 'Travesía en Kayak & Sunset en Las Pirquitas',
      experienceSlug: 'kayak',
      experienceRoute: '/experiencias/kayak',
      region: 'Valle Central y Ambato',
      altitudeMeters: 850,
      adminName: 'Lucas N.',
      adminRole: 'Fotógrafo/a Oficial del Club',
      badge: 'DESTACADA',
      spanClass: 'span-hero',
    },
    {
      id: 'photo_pomez_1',
      src: '/assets/images/catamarca_pomez.jpg',
      title: 'Laberinto de Ceniza Blanca en Antofagasta',
      caption:
        'Formaciones eólicas únicas en el mundo esculpidas en pumita volcánica a más de 3.000 metros de altitud bajo el cielo más transparente del continente.',
      experienceName: 'Campo de Piedra Pómez & Duna Gigante',
      experienceSlug: 'pomez',
      experienceRoute: '/experiencias',
      region: 'Antofagasta de la Sierra',
      altitudeMeters: 3300,
      adminName: 'Valentina M.',
      adminRole: 'Fotógrafo/a Oficial del Club',
      badge: 'DESTACADA',
      spanClass: 'span-wide',
    },
    {
      id: 'photo_seismiles_1',
      src: '/assets/images/laguna-verde.jpg',
      title: 'Ojos Turquesas de la Laguna Verde',
      caption:
        'Reflejos minerales sobre la laguna de altura en el Paso de San Francisco, custodiada por conos volcánicos de más de 6.000 metros.',
      experienceName: 'Ruta de los Seismiles & Laguna Verde',
      experienceSlug: 'seismiles',
      experienceRoute: '/experiencias',
      region: 'Fiambalá y Seismiles',
      altitudeMeters: 4700,
      adminName: 'Sergio A.',
      adminRole: 'Fotógrafo/a Oficial del Club',
      badge: 'DESTACADA',
      spanClass: 'span-tall',
    },
    {
      id: 'photo_laguna_blanca_1',
      src: '/assets/images/laguna_blanca.jpg',
      title: 'Vicuñas Silvestres en Reserva Laguna Blanca',
      caption:
        'Tarde de silencio andino en la Reserva de Biosfera, donde manadas de vicuñas pastan junto a las vegas altoandinas.',
      experienceName: 'Reserva de Biosfera Laguna Blanca',
      experienceSlug: 'laguna-blanca',
      experienceRoute: '/experiencias',
      region: 'Belén & Laguna Blanca',
      altitudeMeters: 3200,
      adminName: 'Equipo C.',
      adminRole: 'Fotógrafo/a Oficial del Club',
      badge: 'DESTACADA',
      spanClass: 'span-normal',
    },
    {
      id: 'photo_pomez_2',
      src: '/assets/images/piedra-pomez.png',
      title: 'Geometría del Viento Puneño',
      caption:
        'Relieve esculpido en piedra pómez durante milenios. Los estratos volcánicos revelan la historia geológica de la cordillera catamarqueña.',
      experienceName: 'Campo de Piedra Pómez & Duna Gigante',
      experienceSlug: 'pomez',
      experienceRoute: '/experiencias',
      region: 'Antofagasta de la Sierra',
      altitudeMeters: 3300,
      adminName: 'Lucas N.',
      adminRole: 'Fotógrafo/a Oficial del Club',
      badge: 'DESTACADA',
      spanClass: 'span-normal',
    },
    {
      id: 'photo_relieve_1',
      src: '/assets/images/relieve.jpeg',
      title: 'Relieve de la Puna y Cumbres Occidentales',
      caption:
        'Captura aérea del filo montañoso que divide los valles centrales de las altas mesetas puneñas.',
      experienceName: 'Ruta de los Seismiles & Cordillera',
      experienceSlug: 'seismiles',
      experienceRoute: '/experiencias',
      region: 'Tinogasta & Fiambalá',
      altitudeMeters: 4100,
      adminName: 'Valentina M.',
      adminRole: 'Fotógrafo/a Oficial del Club',
      badge: 'DESTACADA',
      spanClass: 'span-wide',
    },
  ];

  filteredPhotos(): AdminFeaturedPhoto[] {
    return this.featuredPhotos;
  }

  openPhotoModal(
    photo: AdminFeaturedPhoto,
    list: AdminFeaturedPhoto[] = this.featuredPhotos,
  ): void {
    const index = list.indexOf(photo);
    this.currentPhotoList.set(list);
    this.currentPhotoIndex.set(index >= 0 ? index : 0);
    this.activeModalPhoto.set(photo);
    this.isLandscape.set(true);
  }

  nextPhoto(event?: Event): void {
    event?.stopPropagation();
    const list = this.currentPhotoList();
    if (list.length <= 1) return;
    const nextIndex = (this.currentPhotoIndex() + 1) % list.length;
    this.currentPhotoIndex.set(nextIndex);
    this.activeModalPhoto.set(list[nextIndex]);
    this.isLandscape.set(true);
  }

  prevPhoto(event?: Event): void {
    event?.stopPropagation();
    const list = this.currentPhotoList();
    if (list.length <= 1) return;
    const previousIndex = (this.currentPhotoIndex() - 1 + list.length) % list.length;
    this.currentPhotoIndex.set(previousIndex);
    this.activeModalPhoto.set(list[previousIndex]);
    this.isLandscape.set(true);
  }

  onImageLoad(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (image.naturalWidth && image.naturalHeight) {
      this.isLandscape.set(image.naturalWidth >= image.naturalHeight);
    }
  }

  closePhotoModal(): void {
    this.activeModalPhoto.set(null);
  }

  downloadPhoto(photo: AdminFeaturedPhoto | null): void {
    if (!photo) return;
    const link = document.createElement('a');
    link.href = photo.src;
    link.download = `${photo.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'experiencia'}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  @HostListener('window:keydown.arrowright')
  onArrowRight(): void {
    if (this.activeModalPhoto()) this.nextPhoto();
  }

  @HostListener('window:keydown.arrowleft')
  onArrowLeft(): void {
    if (this.activeModalPhoto()) this.prevPhoto();
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
