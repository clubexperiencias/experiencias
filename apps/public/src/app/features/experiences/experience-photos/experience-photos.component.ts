import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { ExperienceService, KAYAK_ALBUM_PHOTOS } from '../../../core/services/experience.service';
import { ExperienceAlbumPhoto } from '../../../core/models/experience.model';
import { DEFAULT_CLUB_PROFILE, isClubExperience } from '../../../core/models/club-profile.model';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../shared/components/breadcrumb/breadcrumb.component';
import { FounderAdComponent } from '../../../shared/components/founder-ad/founder-ad.component';
import { ArsPipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-experience-photos',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    HeaderComponent,
    FooterComponent,
    BreadcrumbComponent,
    FounderAdComponent,
    ArsPipe,
  ],
  templateUrl: './experience-photos.component.html',
  styleUrl: './experience-photos.component.css',
})
export class ExperiencePhotosComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly expService = inject(ExperienceService);
  readonly isClubExperience = isClubExperience;

  readonly mobileMenuOpen = signal(false);
  readonly activePhotoIndex = signal<number | null>(null);

  isUrl(value?: string): boolean {
    if (!value) return false;
    return /^https?:\/\//i.test(value.trim());
  }

  isValidGoogleMapsUrl(value?: string): boolean {
    if (!value) return false;
    const trimmed = value.trim();
    if (!/^https?:\/\//i.test(trimmed)) return false;
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      const pathname = parsed.pathname.toLowerCase();
      if (host === 'maps.app.goo.gl') return true;
      if (host === 'goo.gl' && pathname.startsWith('/maps')) return true;
      const isGoogleDomain = /(^|\.)google\.(com|com\.[a-z]{2}|[a-z]{2})$/i.test(host);
      if (isGoogleDomain && (pathname.startsWith('/maps') || /(^|\.)maps\.google\./i.test(host))) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  getTrimmedUrl(value?: string): string {
    if (!value) return '';
    const trimmed = value.trim();
    if (this.isValidGoogleMapsUrl(trimmed) && /^http:\/\//i.test(trimmed)) {
      return trimmed.replace(/^http:\/\//i, 'https://');
    }
    return trimmed;
  }

  getMeetingPointUrl(meetingPointUrl?: string, meetingPoint?: string): string | null {
    if (this.isValidGoogleMapsUrl(meetingPointUrl)) {
      return this.getTrimmedUrl(meetingPointUrl);
    }
    if (this.isValidGoogleMapsUrl(meetingPoint)) {
      return this.getTrimmedUrl(meetingPoint);
    }
    return null;
  }

  getProviderSlug(item?: any): string | null {
    if (!item) return null;
    if (item.providerSlug) {
      return item.providerSlug.toLowerCase().trim() === 'club'
        ? DEFAULT_CLUB_PROFILE.slug
        : item.providerSlug;
    }
    if (this.isClubExperience(item)) return DEFAULT_CLUB_PROFILE.slug;
    return null;
  }

  // Slug extraído de los parámetros de ruta o del route data
  private readonly slug = toSignal(
    this.route.paramMap.pipe(
      map((params) => {
        const s = params.get('slug');
        if (s) return s;
        return (this.route.snapshot.data['slug'] as string) || '';
      }),
    ),
    {
      initialValue:
        this.route.snapshot.paramMap.get('slug') ||
        (this.route.snapshot.data['slug'] as string) ||
        '',
    },
  );

  // Experiencia asociada
  readonly exp = computed(() => {
    const s = this.slug();
    if (!s) return undefined;
    return this.expService.getPublishedExperienceBySlug(s);
  });

  // Lista de fotos del álbum (hasta 12)
  readonly albumPhotos = computed<ExperienceAlbumPhoto[]>(() => {
    const e = this.exp();
    if (!e) return [];

    // Si tiene fotos personalizadas en el álbum
    if (e.albumPhotos && e.albumPhotos.length > 0) {
      return e.albumPhotos.slice(0, 12);
    }

    // Fallback para kayak
    if (e.slug === 'kayak') {
      return KAYAK_ALBUM_PHOTOS;
    }

    // Fallback general para cualquier otra experiencia
    const list: ExperienceAlbumPhoto[] = [];
    const coverUrl = e.coverImage || '/assets/images/catamarca_pomez.jpg';
    list.push({
      id: `${e.id}-cover`,
      url: coverUrl,
      title: e.title,
      caption: e.tagline || 'Portada oficial de la experiencia',
      isCover: true,
      isFeatured: false,
      order: 1,
    });

    const gallery = 'galleryImages' in e && Array.isArray(e.galleryImages) ? e.galleryImages : [];
    if (gallery.length > 0) {
      gallery.forEach((imgUrl: string, idx: number) => {
        if (imgUrl !== coverUrl && list.length < 12) {
          list.push({
            id: `${e.id}-gallery-${idx}`,
            url: imgUrl,
            title: `${e.shortTitle || e.title} · Postal ${idx + 1}`,
            caption: e.region,
            isCover: false,
            isFeatured: list.length < 3, // Las 2 siguientes como destacadas
            order: list.length + 1,
          });
        }
      });
    }

    return list;
  });

  // 1 Foto de Portada
  readonly coverPhoto = computed<ExperienceAlbumPhoto | undefined>(() => {
    const list = this.albumPhotos();
    return list.find((p) => p.isCover) || list[0];
  });

  // 2 Fotos Destacadas
  readonly featuredPhotos = computed<ExperienceAlbumPhoto[]>(() => {
    const list = this.albumPhotos();
    const cover = this.coverPhoto();
    const withoutCover = list.filter((p) => p.id !== cover?.id);

    const explicitlyFeatured = withoutCover.filter((p) => p.isFeatured);
    if (explicitlyFeatured.length >= 2) {
      return explicitlyFeatured.slice(0, 2);
    }

    // Si hay menos de 2 marcadas como destacadas, completar con las primeras de la lista
    const combined = [...explicitlyFeatured];
    for (const p of withoutCover) {
      if (combined.length >= 2) break;
      if (!combined.some((c) => c.id === p.id)) {
        combined.push(p);
      }
    }
    return combined.slice(0, 2);
  });

  // Resto de Fotos de la Galería (hasta 9 fotos restantes para completar máx 12)
  readonly galleryPhotos = computed<ExperienceAlbumPhoto[]>(() => {
    const list = this.albumPhotos();
    const cover = this.coverPhoto();
    const featured = this.featuredPhotos();
    const excludeIds = new Set([cover?.id, ...featured.map((f) => f.id)]);
    return list.filter((p) => !excludeIds.has(p.id));
  });

  // Lista ordenada completa para el Lightbox (Portada, luego Destacadas, luego Galería)
  readonly allPhotosOrdered = computed<ExperienceAlbumPhoto[]>(() => {
    const cover = this.coverPhoto();
    const featured = this.featuredPhotos();
    const rest = this.galleryPhotos();
    const list: ExperienceAlbumPhoto[] = [];
    if (cover) list.push(cover);
    list.push(...featured);
    list.push(...rest);
    return list;
  });

  // Foto actualmente activa en el modal ampliado
  readonly activeModalPhoto = computed<ExperienceAlbumPhoto | null>(() => {
    const idx = this.activePhotoIndex();
    if (idx === null) return null;
    const list = this.allPhotosOrdered();
    return list[idx] || null;
  });

  // Breadcrumbs dinámicos
  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const e = this.exp();
    return [
      { label: 'Inicio', url: '/' },
      { label: 'Experiencias', url: '/experiencias' },
      {
        label: e?.shortTitle || e?.title || 'Experiencia',
        url: e ? `/experiencias/${e.slug}` : '/experiencias',
      },
      { label: 'Álbum de Fotos' },
    ];
  });

  // ═══════════════ LIGHTBOX METHODS ═══════════════
  openLightbox(photo: ExperienceAlbumPhoto): void {
    const list = this.allPhotosOrdered();
    const idx = list.findIndex((p) => p.id === photo.id);
    this.activePhotoIndex.set(idx >= 0 ? idx : 0);
  }

  closeLightbox(): void {
    this.activePhotoIndex.set(null);
  }

  nextPhoto(event?: Event): void {
    if (event) event.stopPropagation();
    const current = this.activePhotoIndex();
    if (current === null) return;
    const total = this.allPhotosOrdered().length;
    this.activePhotoIndex.set((current + 1) % total);
  }

  prevPhoto(event?: Event): void {
    if (event) event.stopPropagation();
    const current = this.activePhotoIndex();
    if (current === null) return;
    const total = this.allPhotosOrdered().length;
    this.activePhotoIndex.set((current - 1 + total) % total);
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (this.activePhotoIndex() === null) return;

    if (event.key === 'Escape') {
      this.closeLightbox();
    } else if (event.key === 'ArrowRight') {
      this.nextPhoto();
    } else if (event.key === 'ArrowLeft') {
      this.prevPhoto();
    }
  }

  toggleMobileMenu(event: Event): void {
    event.stopPropagation();
    this.mobileMenuOpen.update((v) => !v);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.mobileMenuOpen.set(false);
  }
}
