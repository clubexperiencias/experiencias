import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../core/services/newsletter.service';
import { ExperienceService } from '../../core/services/experience.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { Experience } from '../../core/models/experience.model';
import { DEFAULT_CLUB_PROFILE, isClubExperience } from '../../core/models/club-profile.model';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../shared/components/breadcrumb/breadcrumb.component';
import { FounderAdComponent } from '../../shared/components/founder-ad/founder-ad.component';

export type ExperiencesModalType = 'login' | null;

export interface CarouselExperienceItem {
  key: string;
  cycleIndex: number;
  exp: Experience;
}

@Component({
  selector: 'app-experiences',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    FooterComponent,
    HeaderComponent,
    BreadcrumbComponent,
    FounderAdComponent,
  ],
  templateUrl: './experiences.component.html',
  styleUrl: './experiences.component.css',
})
export class ExperiencesComponent implements AfterViewInit, OnDestroy {
  readonly newsletter = inject(NewsletterService);
  readonly experienceService = inject(ExperienceService);
  readonly favoritesService = inject(FavoritesService);
  readonly router = inject(Router);
  readonly isClubExperience = isClubExperience;

  isFavorite(exp: Experience): boolean {
    return this.favoritesService.isFavorite(exp);
  }

  toggleFavorite(exp: Experience, event?: Event): void {
    if (exp.isLocked) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    this.favoritesService.toggleFavorite(exp, event);
  }

  getProviderSlug(exp: Experience): string | null {
    if (exp.providerSlug) {
      return exp.providerSlug.toLowerCase().trim() === 'club'
        ? DEFAULT_CLUB_PROFILE.slug
        : exp.providerSlug;
    }
    if (this.isClubExperience(exp)) return DEFAULT_CLUB_PROFILE.slug;
    const rawName = (exp.providerName || exp.providerAgency || '').trim();
    if (rawName && rawName.toLowerCase() !== 'club de experiencias' && rawName.toLowerCase() !== 'club') {
      const fallback = rawName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      if (fallback) return fallback;
    }
    return null;
  }

  readonly bg = signal('/assets/images/laguna_blanca.jpg');

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Experiencias' },
  ];

  // Menús de navegación y estado de selección
  readonly mobileMenuOpen = signal(false);
  readonly selectedExperience = signal<Experience | null>(null);
  readonly activeModal = signal<ExperiencesModalType>(null);
  readonly loginEmail = signal('');
  readonly loginError = signal<string | null>(null);

  @ViewChild('carouselRef') carouselRef?: ElementRef<HTMLDivElement>;

  private scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly cycleRepetitions = 5;
  private readonly onScrollEndBound = () => this.normalizeScroll();
  private autoplayTimer: ReturnType<typeof setInterval> | null = null;
  private readonly autoplayIntervalMs = 3200;
  private isUserHovering = false;
  private readonly onVisibilityChangeBound = () => {
    if (document.hidden) {
      this.stopAutoplay();
    } else if (!this.selectedExperience() && !this.isUserHovering) {
      this.startAutoplay();
    }
  };

  private readonly comingSoonExperience: Experience = {
    id: 'exp-coming-soon',
    slug: 'proximamente',
    title: 'Nueva experiencia en Catamarca',
    tagline: 'Estamos preparando una nueva salida para compartir con el Club.',
    description: 'Muy pronto vas a poder conocer todos los detalles de esta experiencia.',
    region: 'Catamarca',
    difficulty: 'Moderada',
    durationDays: 1,
    durationLabel: 'Próximamente',
    altitudeMeters: 0,
    bestSeason: 'Próximamente',
    priceArs: 0,
    priceUsd: 0,
    maxSpotsPerGroup: 0,
    coverImage: '/assets/images/laguna-verde.jpg',
    galleryImages: [],
    highlights: [],
    included: [],
    isExclusiveClub: true,
    isLocked: true,
  };

  readonly comingSoonCatalogExperience: Experience = {
    id: 'exp-coming-soon-catalog',
    slug: 'proximamente-valle-catamarca',
    title: 'Nueva experiencia en Catamarca',
    tagline: 'Estamos preparando una nueva salida para compartir con el Club.',
    description:
      'Muy pronto vas a poder conocer todos los detalles de esta experiencia exclusiva en Catamarca con guías habilitados y cupos reservados para socios.',
    region: 'Valle Central y Ambato',
    difficulty: 'Moderada',
    durationDays: 1,
    durationLabel: 'Próximamente',
    altitudeMeters: 1200,
    bestSeason: 'Todo el año',
    priceArs: 0,
    priceUsd: 0,
    maxSpotsPerGroup: 8,
    coverImage: '/assets/images/laguna_blanca.jpg',
    galleryImages: ['/assets/images/laguna_blanca.jpg'],
    highlights: [
      'Salida exclusiva en fase final de curaduría y relevamiento técnico',
      'Protocolo estricto de seguridad andina e impacto ambiental cero',
      'Cupos prioritarios para socios registrados del Club de Experiencias',
    ],
    included: ['Guías matriculados', 'Seguro de accidentes personales', 'Kit de bienvenida'],
    isExclusiveClub: true,
    isLocked: true,
    displayLocation: 'catalogo',
    providerName: 'Club de Experiencias',
  };

  readonly featuredExperiences = () => {
    const list = this.experienceService
      .publishedExperiences()
      .filter((e) => !e.displayLocation || e.displayLocation === 'destacada');
    return [...list, this.comingSoonExperience];
  };

  readonly infiniteFeaturedExperiences = computed<CarouselExperienceItem[]>(() => {
    const base = this.featuredExperiences();
    if (base.length === 0) return [];
    const items: CarouselExperienceItem[] = [];
    for (let c = 0; c < this.cycleRepetitions; c++) {
      for (let i = 0; i < base.length; i++) {
        items.push({
          key: `cycle_${c}_${base[i].id}_${i}`,
          cycleIndex: c,
          exp: base[i],
        });
      }
    }
    return items;
  });

  // Filtros del catálogo completo
  readonly searchTerm = signal('');
  readonly filterDifficulty = signal('todas');
  readonly filterDuration = signal('todas');
  readonly filterAltitude = signal('todas');
  readonly filterRegion = signal('todas');
  readonly filterMaxSpots = signal('todos');
  readonly filterSeason = signal('todas');

  // Catálogo completo: experiencias no destacadas primero, y destacadas al fondo (excluye cards informativas aparte)
  readonly allCatalogExperiences = computed<Experience[]>(() => {
    const all = this.experienceService
      .publishedExperiences()
      .filter((e) => !e.isLocked);
    const nonFeatured = all.filter(
      (e) =>
        e.displayLocation === 'catalogo' ||
        (e.displayLocation && e.displayLocation !== 'destacada'),
    );
    const featured = all.filter((e) => !e.displayLocation || e.displayLocation === 'destacada');
    return [...nonFeatured, ...featured];
  });

  readonly availableRegions = computed<string[]>(() => {
    const set = new Set<string>();
    for (const exp of this.allCatalogExperiences()) {
      if (exp.region?.trim()) {
        set.add(exp.region.trim());
      }
    }
    return Array.from(set).sort();
  });

  readonly availableSeasons = computed<string[]>(() => {
    const set = new Set<string>();
    for (const exp of this.allCatalogExperiences()) {
      if (exp.bestSeason?.trim()) {
        set.add(exp.bestSeason.trim());
      }
    }
    if (set.size === 0) {
      set.add('Todo el año');
    }
    return Array.from(set).sort();
  });

  private normalizeText(text: string | null | undefined): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  readonly filteredExperiences = computed<Experience[]>(() => {
    const list = this.allCatalogExperiences();
    const query = this.normalizeText(this.searchTerm());
    const diff = this.filterDifficulty();
    const dur = this.filterDuration();
    const alt = this.filterAltitude();
    const reg = this.filterRegion();
    const spots = this.filterMaxSpots();
    const season = this.filterSeason();

    return list.filter((exp) => {
      // 1. Filtro de Texto (título, subtítulo, prestador, punto de encuentro o descripción)
      if (query) {
        const titleMatch = this.normalizeText(exp.title).includes(query);
        const taglineMatch = this.normalizeText(exp.tagline).includes(query);
        const providerMatch =
          this.normalizeText(exp.providerName).includes(query) ||
          this.normalizeText(exp.providerAgency).includes(query);
        const meetingMatch = this.normalizeText(exp.meetingPoint).includes(query);
        const descMatch = this.normalizeText(exp.description).includes(query);

        if (!titleMatch && !taglineMatch && !providerMatch && !meetingMatch && !descMatch) {
          return false;
        }
      }

      // 2. DIFICULTAD
      if (diff !== 'todas') {
        if (exp.difficulty?.toLowerCase() !== diff.toLowerCase()) {
          return false;
        }
      }

      // 3. DURACIÓN
      if (dur !== 'todas') {
        const dLabel = (exp.durationLabel || '').toLowerCase();
        const dDays = exp.durationDays || 1;
        const hourMatch = dLabel.match(/\b(\d+(?:[.,]\d+)?)\s*(?:h|hs|horas?)\b/);
        const explicitHours = hourMatch ? parseFloat(hourMatch[1].replace(',', '.')) : null;

        const isFullDay =
          dLabel.includes('completo') ||
          dLabel.includes('jornada completa') ||
          dLabel.includes('dia entero') ||
          (explicitHours !== null && explicitHours >= 7);

        const isHalfDay =
          dDays <= 1 &&
          !isFullDay &&
          (dLabel.includes('medio') ||
            dLabel.includes('media') ||
            (explicitHours !== null && explicitHours <= 6) ||
            (explicitHours === null && (dLabel.includes('hora') || /\b[1-6]\s*(?:h|hs)\b/.test(dLabel))));

        if (dur === 'medio-dia') {
          if (!isHalfDay) return false;
        } else if (dur === 'dia-completo') {
          const isFull =
            dLabel.includes('completo') ||
            (dDays === 1 && !isHalfDay);
          if (!isFull) return false;
        } else if (dur === 'varios-dias') {
          if (dDays < 2) return false;
        }
      }

      // 4. ALTITUD
      if (alt !== 'todas') {
        const meters = exp.altitudeMeters || 0;
        if (alt === 'baja' && meters > 1500) return false;
        if (alt === 'media' && (meters <= 1500 || meters > 3000)) return false;
        if (alt === 'alta' && meters <= 3000) return false;
      }

      // 5. REGIÓN
      if (reg !== 'todas') {
        if (this.normalizeText(exp.region) !== this.normalizeText(reg)) {
          return false;
        }
      }

      // 6. CUPO MÁXIMO
      if (spots !== 'todos') {
        const max = exp.maxSpotsPerGroup || 0;
        if (spots === 'hasta-6' && max > 6) return false;
        if (spots === 'hasta-10' && max > 10) return false;
        if (spots === 'mas-10' && max <= 10) return false;
      }

      // 7. TEMPORADA
      if (season !== 'todas') {
        const expSeason = this.normalizeText(exp.bestSeason || 'Todo el año');
        const querySeason = this.normalizeText(season);
        if (!expSeason.includes(querySeason)) {
          return false;
        }
      }

      return true;
    });
  });

  readonly hasActiveFilters = computed(() => {
    return (
      Boolean(this.searchTerm().trim()) ||
      this.filterDifficulty() !== 'todas' ||
      this.filterDuration() !== 'todas' ||
      this.filterAltitude() !== 'todas' ||
      this.filterRegion() !== 'todas' ||
      this.filterMaxSpots() !== 'todos' ||
      this.filterSeason() !== 'todas'
    );
  });

  readonly activeCatalogCount = computed(() => {
    return this.filteredExperiences().length;
  });

  readonly totalActiveCatalogCount = computed(() => {
    return this.allCatalogExperiences().length;
  });

  resetFilters(): void {
    this.searchTerm.set('');
    this.filterDifficulty.set('todas');
    this.filterDuration.set('todas');
    this.filterAltitude.set('todas');
    this.filterRegion.set('todas');
    this.filterMaxSpots.set('todos');
    this.filterSeason.set('todas');
  }

  readonly otherExperiences = () => this.filteredExperiences();

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initCarouselPosition();
      this.startAutoplay();
    }, 60);

    const container = this.carouselRef?.nativeElement;
    if (container) {
      container.addEventListener('scrollend', this.onScrollEndBound);
    }
    document.addEventListener('visibilitychange', this.onVisibilityChangeBound);
  }

  ngOnDestroy(): void {
    this.stopAutoplay();
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
    }
    const container = this.carouselRef?.nativeElement;
    if (container) {
      container.removeEventListener('scrollend', this.onScrollEndBound);
    }
    document.removeEventListener('visibilitychange', this.onVisibilityChangeBound);
  }

  startAutoplay(): void {
    this.stopAutoplay();
    this.autoplayTimer = setInterval(() => {
      if (!this.selectedExperience() && !this.isUserHovering && !document.hidden) {
        this.scrollCarousel('next');
      }
    }, this.autoplayIntervalMs);
  }

  stopAutoplay(): void {
    if (this.autoplayTimer) {
      clearInterval(this.autoplayTimer);
      this.autoplayTimer = null;
    }
  }

  onCarouselMouseEnter(): void {
    this.isUserHovering = true;
    this.stopAutoplay();
  }

  onCarouselMouseLeave(): void {
    this.isUserHovering = false;
    if (!this.selectedExperience()) {
      this.startAutoplay();
    }
  }

  onUserNav(direction: 'prev' | 'next'): void {
    this.scrollCarousel(direction);
    if (!this.isUserHovering && !this.selectedExperience()) {
      this.startAutoplay();
    }
  }

  closeExperienceDetails(): void {
    this.selectedExperience.set(null);
    if (!this.isUserHovering) {
      this.startAutoplay();
    }
  }

  private initCarouselPosition(): void {
    if (!this.carouselRef?.nativeElement) return;
    const container = this.carouselRef.nativeElement;
    const items = container.querySelectorAll<HTMLElement>('.carousel-item');
    const baseCount = this.featuredExperiences().length;
    if (baseCount === 0 || items.length < baseCount * 3) return;

    // Centrar en el ciclo 2 (el medio de los 5 ciclos)
    const targetItem = items[2 * baseCount];
    if (targetItem) {
      container.scrollLeft = targetItem.offsetLeft;
    }
  }

  private getSingleCycleWidth(): number {
    if (!this.carouselRef?.nativeElement) return 0;
    const container = this.carouselRef.nativeElement;
    const items = container.querySelectorAll<HTMLElement>('.carousel-item');
    const baseCount = this.featuredExperiences().length;
    if (baseCount === 0 || items.length < baseCount * 2) return 0;

    const diff = items[baseCount].offsetLeft - items[0].offsetLeft;
    return diff > 0 ? diff : 0;
  }

  scrollCarousel(direction: 'prev' | 'next'): void {
    if (!this.carouselRef?.nativeElement) return;
    const container = this.carouselRef.nativeElement;
    const items = container.querySelectorAll<HTMLElement>('.carousel-item');
    const baseCount = this.featuredExperiences().length;
    if (items.length === 0 || baseCount === 0) return;

    const singleCycleWidth = this.getSingleCycleWidth();

    // Reajuste imperceptible si se acerca a los extremos del buffer
    if (singleCycleWidth > 0) {
      if (direction === 'next' && container.scrollLeft >= singleCycleWidth * 3.2) {
        container.scrollLeft -= singleCycleWidth;
      } else if (direction === 'prev' && container.scrollLeft <= singleCycleWidth * 0.8) {
        container.scrollLeft += singleCycleWidth;
      }
    }

    const step = items[1]
      ? items[1].offsetLeft - items[0].offsetLeft
      : container.clientWidth * 0.45;
    container.scrollBy({
      left: direction === 'next' ? step : -step,
      behavior: 'smooth',
    });
  }

  onCarouselScroll(): void {
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
    }
    this.scrollDebounceTimer = setTimeout(() => {
      this.normalizeScroll();
    }, 120);
  }

  private normalizeScroll(): void {
    if (!this.carouselRef?.nativeElement) return;
    const container = this.carouselRef.nativeElement;
    const singleCycleWidth = this.getSingleCycleWidth();
    if (singleCycleWidth <= 0) return;

    // Mantiene el scrollLeft siempre centrado en el ciclo 2
    while (container.scrollLeft > singleCycleWidth * 2.8) {
      container.scrollLeft -= singleCycleWidth;
    }
    while (container.scrollLeft < singleCycleWidth * 1.2) {
      container.scrollLeft += singleCycleWidth;
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.normalizeScroll();
  }

  toggleMobileMenu(event: Event): void {
    event.stopPropagation();
    this.mobileMenuOpen.update((v) => !v);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.mobileMenuOpen.set(false);
  }

  toggleExperienceDetails(exp: Experience): void {
    if (this.selectedExperience()?.id === exp.id) {
      this.closeExperienceDetails();
    } else {
      this.selectedExperience.set(exp);
      this.stopAutoplay();
    }
  }

  openModal(modal: ExperiencesModalType): void {
    this.mobileMenuOpen.set(false);
    this.activeModal.set(modal);
  }

  closeModal(): void {
    this.activeModal.set(null);
    this.loginError.set(null);
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.activeModal()) {
      this.closeModal();
    }
    this.closeExperienceDetails();
    this.mobileMenuOpen.set(false);
  }

  submitLogin(): void {
    const email = this.loginEmail().trim();
    if (!email) return;

    if (
      this.newsletter.isSubscribed() &&
      this.newsletter.currentMember()?.email.toLowerCase() === email.toLowerCase()
    ) {
      this.closeModal();
      this.router.navigate(['/perfil']);
      return;
    }

    this.newsletter
      .joinWaitlist({ email })
      .then(() => {
        this.closeModal();
        this.router.navigate(['/perfil']);
      })
      .catch(() => {
        this.loginError.set('Ocurrió un error al ingresar. Intentá nuevamente.');
      });
  }

  logout(): void {
    this.newsletter.resetCurrentSubscription();
    this.mobileMenuOpen.set(false);
    this.router.navigate(['/']);
  }
}
