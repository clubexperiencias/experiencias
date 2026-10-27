import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../../../core/services/newsletter.service';
import { FooterComponent } from '../../../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../../../../shared/components/breadcrumb/breadcrumb.component';

export interface GalleryPhoto {
  src: string;
  title: string;
  caption: string;
  tag: string;
}

@Component({
  selector: 'app-kayak-photos',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, FooterComponent, HeaderComponent, BreadcrumbComponent],
  templateUrl: './kayak-photos.component.html',
  styleUrl: './kayak-photos.component.css'
})
export class KayakPhotosComponent {
  readonly newsletter = inject(NewsletterService);
  readonly router = inject(Router);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Experiencias', url: '/experiencias' },
    { label: 'Travesía en Kayak', url: '/experiencias/kayak' },
    { label: 'Galería de Fotos' }
  ];

  readonly mobileMenuOpen = signal(false);
  readonly activePhotoModal = signal<GalleryPhoto | null>(null);

  readonly photos: GalleryPhoto[] = [
    {
      src: '/assets/images/kayak-club-de-experiencias.jpg',
      title: 'Travesía en Las Pirquitas',
      caption: 'Socios del Club navegando en aguas calmas frente al cordón de las Sierras de Ambato.',
      tag: 'PORTADA OFICIAL'
    }
  ];

  toggleMobileMenu(event: Event): void {
    event.stopPropagation();
    this.mobileMenuOpen.update((v) => !v);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.mobileMenuOpen.set(false);
  }

  openPhotoModal(photo: GalleryPhoto): void {
    this.activePhotoModal.set(photo);
  }

  closePhotoModal(): void {
    this.activePhotoModal.set(null);
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
