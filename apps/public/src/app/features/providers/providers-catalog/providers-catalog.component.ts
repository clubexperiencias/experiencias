import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { FounderAdComponent } from '../../../shared/components/founder-ad/founder-ad.component';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { ProviderRatingService, ProviderRatingData } from '../../../core/services/provider-rating.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { NewsletterService } from '../../../core/services/newsletter.service';
import { ProviderUser } from '../../../core/models/bank-transfer.model';
import { getSocialHandle } from '../../../shared/utils/social-url.util';

export type ProviderTier = 'fundador' | 'pleno' | 'emergente';

export interface CarouselProviderItem {
  key: string;
  cycleIndex: number;
  provider: ProviderUser;
}

@Component({
  selector: 'app-providers-catalog',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatIconModule,
    HeaderComponent,
    BreadcrumbComponent,
    FooterComponent,
    FounderAdComponent,
  ],
  templateUrl: './providers-catalog.component.html',
  styleUrl: './providers-catalog.component.css',
})
export class ProvidersCatalogComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('carouselRef') carouselRef?: ElementRef<HTMLDivElement>;

  private readonly providerStore = inject(ProviderStoreService);
  private readonly expService = inject(ExperienceService);
  readonly ratingService = inject(ProviderRatingService);
  readonly newsletter = inject(NewsletterService);

  private scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private carouselInitTimer: ReturnType<typeof setTimeout> | null = null;
  private isDestroyed = false;
  private readonly cycleRepetitions = 5;
  private readonly onScrollEndBound = () => this.normalizeScroll();
  private autoplayTimer: ReturnType<typeof setInterval> | null = null;
  private readonly autoplayIntervalMs = 3200;
  private isUserHovering = false;
  private readonly onVisibilityChangeBound = () => {
    if (document.hidden) {
      this.stopAutoplay();
    } else if (!this.isUserHovering) {
      this.startAutoplay();
    }
  };

  readonly mobileMenuOpen = signal(false);
  readonly loading = signal(true);
  readonly providers = signal<ProviderUser[]>([]);
  readonly searchQuery = signal('');

  // Filtros de la sección "Explorá Todos los Prestadores"
  readonly selectedTierFilter = signal<'todos' | 'fundador' | 'pleno' | 'emergente'>('todos');
  readonly selectedCategoryFilter = signal<string>('todos');
  readonly selectedSortOrder = signal<'rating' | 'experiences' | 'name'>('rating');

  getProviderRating(p: ProviderUser): ProviderRatingData {
    return this.ratingService.getRating(p);
  }

  getProviderTier(p: ProviderUser): ProviderTier {
    // 1. Identity checks primero
    if (
      p.slug === 'club-de-experiencias' ||
      p.id === 'prov-club-oficial' ||
      p.agency?.toLowerCase().includes('club de experiencias')
    ) {
      return 'fundador';
    }

    // 2. Si p.tier es uno de los niveles soportados, retornarlo directamente antes de reglas de fallback
    if (p.tier === 'fundador' || p.tier === 'pleno' || p.tier === 'emergente') {
      return p.tier;
    }

    // 3. Reglas de fallback existentes
    if (p.notes?.toLowerCase().includes('fundador')) {
      return 'fundador';
    }

    const count = this.getExperiencesCount(p);
    if (
      p.notes?.toLowerCase().includes('pleno') ||
      count > 0 ||
      p.verified
    ) {
      return 'pleno';
    }

    return 'emergente';
  }

  getProviderTierLabel(p: ProviderUser): string {
    const tier = this.getProviderTier(p);
    switch (tier) {
      case 'fundador':
        return 'FUNDADOR';
      case 'pleno':
        return 'PLENO';
      case 'emergente':
        return 'EMERGENTE';
    }
  }

  getProviderRubro(p: ProviderUser): string {
    if (p.rubro && p.rubro.trim()) {
      return p.rubro.trim();
    }
    const bio = (p.bio || '').toLowerCase();
    const agency = (p.agency || '').toLowerCase();
    if (
      bio.includes('montaña') ||
      bio.includes('trekking') ||
      agency.includes('montaña') ||
      agency.includes('trekking')
    ) {
      return 'Alta Montaña & Trekking';
    }
    if (
      bio.includes('4x4') ||
      bio.includes('travesía') ||
      bio.includes('puna') ||
      agency.includes('4x4')
    ) {
      return 'Travesías 4x4 & Puna';
    }
    if (
      bio.includes('kayak') ||
      bio.includes('náutica') ||
      bio.includes('agua') ||
      agency.includes('kayak')
    ) {
      return 'Kayak & Náutica';
    }
    if (
      bio.includes('cabalgata') ||
      bio.includes('caballo') ||
      bio.includes('gaucha')
    ) {
      return 'Cabalgatas & Rutas Gauchas';
    }
    if (
      bio.includes('cultura') ||
      bio.includes('taller') ||
      bio.includes('artesan')
    ) {
      return 'Cultura & Sabores';
    }
    return 'Turismo Aventura';
  }

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Prestadores' },
  ];

  // Prestadores Destacados (Plenos y Fundadores) para el carrusel superior
  readonly featuredProviders = computed(() => {
    const list = this.providers();
    const plenos = list.filter((p) => {
      const t = this.getProviderTier(p);
      return t === 'pleno' || t === 'fundador';
    });
    return plenos.length > 0 ? plenos : list;
  });

  // Repetición infinita para animación continua fluida (idéntico a experiencias)
  readonly infiniteFeaturedProviders = computed<CarouselProviderItem[]>(() => {
    const base = this.featuredProviders();
    if (base.length === 0) return [];
    const items: CarouselProviderItem[] = [];
    for (let c = 0; c < this.cycleRepetitions; c++) {
      for (let i = 0; i < base.length; i++) {
        items.push({
          key: `cycle_${c}_${base[i].id}_${i}`,
          cycleIndex: c,
          provider: base[i],
        });
      }
    }
    return items;
  });

  // Prestadores filtrados para el catálogo general inferior
  readonly filteredAllProviders = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const tier = this.selectedTierFilter();
    const cat = this.selectedCategoryFilter();
    const sort = this.selectedSortOrder();

    const list = this.providers().filter((p) => {
      if (q) {
        const name = (p.name || '').toLowerCase();
        const agency = (p.agency || '').toLowerCase();
        const bio = (p.bio || '').toLowerCase();
        const slug = (p.slug || '').toLowerCase();
        if (!name.includes(q) && !agency.includes(q) && !bio.includes(q) && !slug.includes(q)) {
          return false;
        }
      }

      if (tier !== 'todos' && this.getProviderTier(p) !== tier) {
        return false;
      }

      if (cat !== 'todos') {
        const rubro = this.getProviderRubro(p).toLowerCase();
        if (!rubro.includes(cat.toLowerCase())) {
          return false;
        }
      }

      return true;
    });

    return list.sort((a, b) => {
      if (sort === 'rating') {
        const ratingA = this.getProviderRating(a);
        const ratingB = this.getProviderRating(b);
        const hasVotesA = ratingA.count > 0;
        const hasVotesB = ratingB.count > 0;

        if (hasVotesA && !hasVotesB) return -1;
        if (!hasVotesA && hasVotesB) return 1;

        if (hasVotesA && hasVotesB) {
          if (ratingB.score !== ratingA.score) {
            return ratingB.score - ratingA.score;
          }
        }

        return this.getExperiencesCount(b) - this.getExperiencesCount(a);
      }
      if (sort === 'experiences') {
        return this.getExperiencesCount(b) - this.getExperiencesCount(a);
      }
      const nameA = (a.agency || a.name || '').toLowerCase();
      const nameB = (b.agency || b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  });

  readonly filteredProviders = this.filteredAllProviders;

  ngAfterViewInit(): void {
    if (this.isDestroyed) return;
    if (!this.loading()) {
      if (this.carouselInitTimer) clearTimeout(this.carouselInitTimer);
      this.carouselInitTimer = setTimeout(() => {
        this.carouselInitTimer = null;
        if (this.isDestroyed) return;
        this.initCarouselPosition();
        this.startAutoplay();
        this.attachCarouselListeners();
      }, 60);
    }
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.carouselInitTimer) {
      clearTimeout(this.carouselInitTimer);
      this.carouselInitTimer = null;
    }
    this.stopAutoplay();
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
      this.scrollDebounceTimer = null;
    }
    const container = this.carouselRef?.nativeElement;
    if (container) {
      container.removeEventListener('scrollend', this.onScrollEndBound);
    }
    document.removeEventListener('visibilitychange', this.onVisibilityChangeBound);
  }

  startAutoplay(): void {
    if (this.isDestroyed) return;
    this.stopAutoplay();
    this.autoplayTimer = setInterval(() => {
      if (this.isDestroyed) {
        this.stopAutoplay();
        return;
      }
      if (!this.isUserHovering && !document.hidden) {
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
    this.startAutoplay();
  }

  onUserNav(direction: 'prev' | 'next'): void {
    this.scrollCarousel(direction);
    if (!this.isUserHovering) {
      this.startAutoplay();
    }
  }

  private initCarouselPosition(): void {
    if (!this.carouselRef?.nativeElement) return;
    const container = this.carouselRef.nativeElement;
    const items = container.querySelectorAll<HTMLElement>('.carousel-provider-item');
    const baseCount = this.featuredProviders().length;
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
    const items = container.querySelectorAll<HTMLElement>('.carousel-provider-item');
    const baseCount = this.featuredProviders().length;
    if (baseCount === 0 || items.length < baseCount * 2) return 0;

    const diff = items[baseCount].offsetLeft - items[0].offsetLeft;
    return diff > 0 ? diff : 0;
  }

  scrollCarousel(direction: 'prev' | 'next'): void {
    if (!this.carouselRef?.nativeElement) return;
    const container = this.carouselRef.nativeElement;
    const items = container.querySelectorAll<HTMLElement>('.carousel-provider-item');
    const baseCount = this.featuredProviders().length;
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

  private attachCarouselListeners(): void {
    if (this.isDestroyed) return;
    const container = this.carouselRef?.nativeElement;
    if (container) {
      container.removeEventListener('scrollend', this.onScrollEndBound);
      container.addEventListener('scrollend', this.onScrollEndBound);
    }
    document.removeEventListener('visibilitychange', this.onVisibilityChangeBound);
    document.addEventListener('visibilitychange', this.onVisibilityChangeBound);
  }

  resetAllFilters(): void {
    this.searchQuery.set('');
    this.selectedTierFilter.set('todos');
    this.selectedCategoryFilter.set('todos');
    this.selectedSortOrder.set('rating');
  }

  async ngOnInit(): Promise<void> {
    try {
      await this.expService.remoteLoadPromise;
    } catch {
      // Continuar con carga de prestadores si falla la carga remota de experiencias
    }

    try {
      const list = await this.providerStore.getPublicProviders();
      if (!this.isDestroyed) {
        this.providers.set(list);
      }
    } catch (err) {
      console.warn('[ProvidersCatalog] Error cargando prestadores públicos:', err);
    } finally {
      if (!this.isDestroyed) {
        this.loading.set(false);
        if (this.carouselInitTimer) clearTimeout(this.carouselInitTimer);
        this.carouselInitTimer = setTimeout(() => {
          this.carouselInitTimer = null;
          if (this.isDestroyed) return;
          this.initCarouselPosition();
          this.startAutoplay();
          this.attachCarouselListeners();
        }, 80);
      }
    }
  }

  getExperiencesCount(p: ProviderUser): number {
    return this.expService.getExperiencesByProvider({
      slug: p.slug,
      email: p.email,
      agency: p.agency,
    }).length;
  }

  getProviderSlug(p: ProviderUser): string {
    return p.slug || p.id;
  }

  getProviderCover(p: ProviderUser): string {
    if (p.coverImage && p.coverImage.trim()) {
      const c = p.coverImage.trim();
      if (c.startsWith('http://') || c.startsWith('https://') || c.startsWith('/')) {
        return c;
      }
      return `/${c}`;
    }
    return '/assets/images/kayak-club-de-experiencias.jpg';
  }

  onCoverError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && !img.src.includes('kayak-club-de-experiencias.jpg')) {
      img.src = '/assets/images/kayak-club-de-experiencias.jpg';
    }
  }

  cleanSocialUrl(social: string | undefined): string {
    if (!social) return '#';
    const s = social.trim();
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    if (s.startsWith('@')) return `https://instagram.com/${s.slice(1)}`;
    return `https://${s}`;
  }

  socialHandle(social: string | undefined): string {
    if (!social) return '';
    const clean = social.trim();
    if (clean.toLowerCase().includes('facebook.com/share') || clean.toLowerCase() === '@share') {
      return 'Red Social Secundaria';
    }
    return getSocialHandle(this.cleanSocialUrl(social));
  }

  resetSearch(): void {
    this.searchQuery.set('');
  }
}

