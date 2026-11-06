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
import { Experience } from '../../core/models/experience.model';
import { isClubExperience } from '../../core/models/club-profile.model';
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
  readonly router = inject(Router);
  readonly isClubExperience = isClubExperience;

  getProviderSlug(exp: Experience): string | null {
    if (exp.providerSlug) return exp.providerSlug;
    if (this.isClubExperience(exp)) return 'club-de-experiencias';
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

  readonly featuredExperiences = () => {
    const list = this.experienceService.publishedExperiences();
    if (list.length >= 3) {
      return [...list, this.comingSoonExperience];
    }
    if (list.length === 2) {
      return [...list, this.comingSoonExperience];
    }
    if (list.length === 1) {
      return [list[0], this.comingSoonExperience];
    }
    return [this.comingSoonExperience];
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

  readonly otherExperiences = () => {
    const all = this.experienceService.publishedExperiences();
    const other = all.slice(this.featuredExperiences().length);
    return other;
  };

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
