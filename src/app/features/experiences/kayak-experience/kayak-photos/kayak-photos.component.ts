import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../../../core/services/newsletter.service';
import { FooterComponent } from '../../../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../shared/components/breadcrumb/breadcrumb.component';
import { FounderAdComponent } from '../../../../shared/components/founder-ad/founder-ad.component';

export interface GalleryPhoto {
  src: string;
  title: string;
  caption: string;
  tag: string;
  author?: string;
  photographer?: string;
}

@Component({
  selector: 'app-kayak-photos',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    FooterComponent,
    HeaderComponent,
    BreadcrumbComponent,
    FounderAdComponent,
  ],
  templateUrl: './kayak-photos.component.html',
  styleUrl: './kayak-photos.component.css',
})
export class KayakPhotosComponent {
  readonly newsletter = inject(NewsletterService);
  readonly router = inject(Router);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Experiencias', url: '/experiencias' },
    { label: 'Travesía en Kayak', url: '/experiencias/kayak' },
    { label: 'Galería de Fotos' },
  ];

  readonly mobileMenuOpen = signal(false);
  readonly activePhotoModal = signal<GalleryPhoto | null>(null);
  readonly currentPhotoList = signal<GalleryPhoto[]>([]);
  readonly currentPhotoIndex = signal<number>(0);
  readonly isLandscape = signal(true);

  get featuredGroup(): GalleryPhoto[] {
    return [...this.photos, ...this.secondaryPhotos];
  }

  readonly photos: GalleryPhoto[] = [
    {
      src: '/assets/images/kayak-club-de-experiencias.jpg',
      title: 'Travesía en El Jumeal',
      caption:
        'Socios del Club navegando en aguas calmas frente al cordón de las Sierras de Ambato.',
      tag: 'DESTACADA',
      photographer: 'Lucas N: Equipo Fotográfico',
    },
  ];

  // Exactamente dos boxes destacadas
  readonly secondaryPhotos: GalleryPhoto[] = [
    {
      src: '/assets/images/kayak-club-de-experiencias.jpg',
      title: 'Navegación al Atardecer',
      caption: 'Remada en grupo en las bahías protegidas del dique El Jumeal.',
      tag: 'DESTACADA',
      photographer: 'Marcos T: Guía & Fotografía',
    },
    {
      src: '/assets/images/kayak-club-de-experiencias.jpg',
      title: 'Entorno & Cordón de Ambato',
      caption: 'Panorámica de las sierras catamarqueñas reflejadas en el espejo de agua.',
      tag: 'DESTACADA',
      photographer: 'Sofía L: Producción Visual',
    },
  ];

  // Sección Comunidad de Socios (Grilla 3x3 = 9 fotos con tag DESTACADA POR EL EQUIPO)
  readonly communityPhotos: GalleryPhoto[] = [
    {
      src: '/assets/images/kayak-club-de-experiencias.jpg',
      title: 'Pausa Sunset en Bahía Grande',
      caption: '',
      tag: 'DESTACADA POR EL EQUIPO',
      author: 'Valentina M. · Socio Pleno',
    },
    {
      src: '/assets/images/kayak-club-de-experiencias.jpg',
      title: 'Remada en Grupo y Calma Total',
      caption: '',
      tag: 'DESTACADA POR EL EQUIPO',
      author: 'Ing. Matías B. · Socio Fundador',
    },
    {
      src: '/assets/images/kayak-club-de-experiencias.jpg',
      title: 'Quebradas Inaccesibles por Tierra',
      caption: '',
      tag: 'DESTACADA POR EL EQUIPO',
      author: 'Dra. Camila A. · Socio Emergente',
    },
    {
      src: '/assets/images/kayak-club-de-experiencias.jpg',
      title: 'Silencio y Fauna Autóctona',
      caption: '',
      tag: 'DESTACADA POR EL EQUIPO',
      author: 'Nicolás H. · Socio Pleno',
    },
    {
      src: '/assets/images/kayak-club-de-experiencias.jpg',
      title: 'Kayaks de Travesía en Formación',
      caption: '',
      tag: 'DESTACADA POR EL EQUIPO',
      author: 'Lucía C. · Socio Pleno',
    },
    {
      src: '/assets/images/kayak-club-de-experiencias.jpg',
      title: 'Reflejos Dorados en El Jumeal',
      caption: '',
      tag: 'DESTACADA POR EL EQUIPO',
      author: 'Federico S. · Socio Fundador',
    },
    {
      src: '/assets/images/kayak-club-de-experiencias.jpg',
      title: 'Cierre y Tertulia en la Orilla',
      caption: '',
      tag: 'DESTACADA POR EL EQUIPO',
      author: 'Mariana S. · Socio Pleno',
    },
    {
      src: '/assets/images/kayak-club-de-experiencias.jpg',
      title: 'Equipamiento Técnico y Seguridad',
      caption: '',
      tag: 'DESTACADA POR EL EQUIPO',
      author: 'Lucas N. · Guía Náutico',
    },
    {
      src: '/assets/images/kayak-club-de-experiencias.jpg',
      title: 'Perspectiva desde el Agua',
      caption: '',
      tag: 'DESTACADA POR EL EQUIPO',
      author: 'Esteban M. · Socio Pleno',
    },
  ];

  toggleMobileMenu(event: Event): void {
    event.stopPropagation();
    this.mobileMenuOpen.update((v) => !v);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.mobileMenuOpen.set(false);
  }

  onImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && img.naturalWidth && img.naturalHeight) {
      this.isLandscape.set(img.naturalWidth >= img.naturalHeight);
    }
  }

  openPhotoModal(photo: GalleryPhoto, list: GalleryPhoto[] = []): void {
    const activeList = list.length > 0 ? list : [photo];
    this.currentPhotoList.set(activeList);
    const index = activeList.indexOf(photo);
    this.currentPhotoIndex.set(index >= 0 ? index : 0);
    this.activePhotoModal.set(photo);
    this.isLandscape.set(true);
  }

  nextPhoto(event?: Event): void {
    if (event) event.stopPropagation();
    const list = this.currentPhotoList();
    if (list.length <= 1) return;
    const nextIdx = (this.currentPhotoIndex() + 1) % list.length;
    this.currentPhotoIndex.set(nextIdx);
    this.activePhotoModal.set(list[nextIdx]);
    this.isLandscape.set(true);
  }

  prevPhoto(event?: Event): void {
    if (event) event.stopPropagation();
    const list = this.currentPhotoList();
    if (list.length <= 1) return;
    const prevIdx = (this.currentPhotoIndex() - 1 + list.length) % list.length;
    this.currentPhotoIndex.set(prevIdx);
    this.activePhotoModal.set(list[prevIdx]);
    this.isLandscape.set(true);
  }

  @HostListener('window:keydown.arrowright')
  onArrowRight(): void {
    if (this.activePhotoModal()) {
      this.nextPhoto();
    }
  }

  @HostListener('window:keydown.arrowleft')
  onArrowLeft(): void {
    if (this.activePhotoModal()) {
      this.prevPhoto();
    }
  }

  closePhotoModal(): void {
    this.activePhotoModal.set(null);
  }

  downloadPhoto(photo: GalleryPhoto | null): void {
    if (!photo) return;
    const link = document.createElement('a');
    link.href = photo.src;
    const safeTitle = photo.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.download = `${safeTitle || 'kayak-experiencia'}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.closePhotoModal();
    this.mobileMenuOpen.set(false);
  }

  logout(): void {
    this.newsletter.resetCurrentSubscription();
    this.mobileMenuOpen.set(false);
    this.router.navigate(['/']);
  }
}
