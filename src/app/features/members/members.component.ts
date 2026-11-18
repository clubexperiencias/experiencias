import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FavoritesService } from '../../core/services/favorites.service';
import { NewsletterService } from '../../core/services/newsletter.service';
import { TestimoniosService } from '../../core/services/testimonios.service';
import { SocioTestimonio } from '../../core/models/testimonial.model';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../shared/components/breadcrumb/breadcrumb.component';
import { KayakAdComponent } from '../../shared/components/kayak-ad/kayak-ad.component';

export type MembersModalType = 'login' | null;

export interface CarouselTestimonioItem {
  key: string;
  cycleIndex: number;
  testimonio: SocioTestimonio;
}

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    FooterComponent,
    HeaderComponent,
    BreadcrumbComponent,
    KayakAdComponent,
  ],
  templateUrl: './members.component.html',
  styleUrl: './members.component.css',
})
export class MembersComponent implements AfterViewInit, OnDestroy {
  readonly newsletter = inject(NewsletterService);
  readonly testimoniosService = inject(TestimoniosService);
  readonly favoritesService = inject(FavoritesService);
  readonly router = inject(Router);

  private previousTestimoniosCount = 0;

  constructor() {
    effect(() => {
      const testimonios = this.featuredTestimonios();
      const currentCount = testimonios.length;

      if (typeof document !== 'undefined') {
        const activeEl = document.activeElement;
        const addCard = document.querySelector('.showcase-add-card');
        const isShareCardFocused =
          Boolean(activeEl && addCard && (activeEl === addCard || addCard.contains(activeEl)));

        if (isShareCardFocused && currentCount > 0 && this.previousTestimoniosCount === 0) {
          // Preserve focus before the @if branch replaces the focused share card
          const stableTarget =
            document.querySelector<HTMLElement>('.section-card-header .section-main-title') ||
            document.querySelector<HTMLElement>('.section-card-header') ||
            document.querySelector<HTMLElement>('main');

          if (stableTarget) {
            if (!stableTarget.hasAttribute('tabindex')) {
              stableTarget.setAttribute('tabindex', '-1');
            }
            stableTarget.focus();
          }

          // Once active testimonials arrive, ensure focus remains on a valid active testimonial
          setTimeout(() => {
            const arrivingCard = document.querySelector<HTMLElement>(
              '.featured-carousel-wrap .featured-testimonial'
            );
            if (arrivingCard) {
              arrivingCard.focus();
            }
          }, 0);
        }
      }

      this.previousTestimoniosCount = currentCount;
    });
  }

  private _carouselRef?: ElementRef<HTMLDivElement>;
  private currentTrackEl: HTMLDivElement | null = null;

  @ViewChild('carouselRef')
  set carouselRef(ref: ElementRef<HTMLDivElement> | undefined) {
    this._carouselRef = ref;
    const el = ref?.nativeElement ?? null;
    if (this.currentTrackEl === el) return;

    // Limpiar listeners del track previo y detener autoplay si desaparece
    if (this.currentTrackEl) {
      this.currentTrackEl.removeEventListener('scrollend', this.onScrollEndBound);
      this.stopAutoplay();
      if (this.initTimer) {
        clearTimeout(this.initTimer);
        this.initTimer = null;
      }
    }

    this.currentTrackEl = el;

    // Inicializar posición y listeners reactivamente cuando el track condicional aparece
    if (el && !this.isDestroyed) {
      el.addEventListener('scrollend', this.onScrollEndBound);
      if (this.initTimer) {
        clearTimeout(this.initTimer);
      }
      this.initTimer = setTimeout(() => {
        if (this.isDestroyed || this.currentTrackEl !== el) return;
        this.initCarouselPosition();
        this.startAutoplay();
      }, 0);
    }
  }

  get carouselRef(): ElementRef<HTMLDivElement> | undefined {
    return this._carouselRef;
  }

  readonly featuredTestimonios = this.testimoniosService.featuredTestimonios;
  readonly communityTestimonios = this.testimoniosService.communityTestimonios;

  onAddTestimonialClick(): void {
    if (this.newsletter.isSubscribed()) {
      this.router.navigate(['/perfil'], { fragment: 'testimonio' });
    } else {
      this.favoritesService.showToast({
        title: 'Testimonio',
        slug: 'testimonio',
        requireAuth: true,
        heading: '¡Exclusivo para Socios!',
        message: 'Tenés que ser socio e iniciar sesión para compartir tu testimonio.',
      });
    }
  }

  private readonly cycleRepetitions = 5;
  private readonly onScrollEndBound = () => this.normalizeScroll();
  private autoplayTimer: ReturnType<typeof setInterval> | null = null;
  private readonly autoplayIntervalMs = 4000;
  private isUserHovering = false;
  private scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private initTimer: ReturnType<typeof setTimeout> | null = null;
  private isDestroyed = false;
  private readonly onVisibilityChangeBound = () => {
    if (document.hidden) {
      this.stopAutoplay();
    } else if (!this.isUserHovering) {
      this.startAutoplay();
    }
  };

  readonly infiniteFeaturedTestimonios = computed<CarouselTestimonioItem[]>(() => {
    const base = this.featuredTestimonios();
    if (base.length === 0) return [];
    const items: CarouselTestimonioItem[] = [];
    for (let c = 0; c < this.cycleRepetitions; c++) {
      for (let i = 0; i < base.length; i++) {
        items.push({
          key: `cycle_${c}_${base[i].id}_${i}`,
          cycleIndex: c,
          testimonio: base[i],
        });
      }
    }
    return items;
  });

  ngAfterViewInit(): void {
    document.addEventListener('visibilitychange', this.onVisibilityChangeBound);
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.initTimer) {
      clearTimeout(this.initTimer);
      this.initTimer = null;
    }
    this.stopAutoplay();
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
      this.scrollDebounceTimer = null;
    }
    if (this.currentTrackEl) {
      this.currentTrackEl.removeEventListener('scrollend', this.onScrollEndBound);
      this.currentTrackEl = null;
    }
    document.removeEventListener('visibilitychange', this.onVisibilityChangeBound);
  }

  startAutoplay(): void {
    if (this.isDestroyed) return;
    this.stopAutoplay();
    this.autoplayTimer = setInterval(() => {
      if (!this.isUserHovering && !document.hidden && !this.isDestroyed) {
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
    const items = container.querySelectorAll<HTMLElement>('.carousel-item');
    const baseCount = this.featuredTestimonios().length;
    if (baseCount === 0 || items.length < baseCount * 3) return;

    const targetItem = items[2 * baseCount];
    if (targetItem) {
      container.scrollLeft = targetItem.offsetLeft;
    }
  }

  private getSingleCycleWidth(): number {
    if (!this.carouselRef?.nativeElement) return 0;
    const container = this.carouselRef.nativeElement;
    const items = container.querySelectorAll<HTMLElement>('.carousel-item');
    const baseCount = this.featuredTestimonios().length;
    if (baseCount === 0 || items.length < baseCount * 2) return 0;

    const diff = items[baseCount].offsetLeft - items[0].offsetLeft;
    return diff > 0 ? diff : 0;
  }

  scrollCarousel(direction: 'prev' | 'next'): void {
    if (!this.carouselRef?.nativeElement) return;
    const container = this.carouselRef.nativeElement;
    const items = container.querySelectorAll<HTMLElement>('.carousel-item');
    const baseCount = this.featuredTestimonios().length;
    if (items.length === 0 || baseCount === 0) return;

    const singleCycleWidth = this.getSingleCycleWidth();

    if (singleCycleWidth > 0) {
      if (direction === 'next' && container.scrollLeft >= singleCycleWidth * 3.2) {
        container.scrollLeft -= singleCycleWidth;
      } else if (direction === 'prev' && container.scrollLeft <= singleCycleWidth * 0.8) {
        container.scrollLeft += singleCycleWidth;
      }
    }

    const step = items[1]
      ? items[1].offsetLeft - items[0].offsetLeft
      : container.clientWidth * 0.7;
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

    while (container.scrollLeft > singleCycleWidth * 2.8) {
      container.scrollLeft -= singleCycleWidth;
    }
    while (container.scrollLeft < singleCycleWidth * 1.2) {
      container.scrollLeft += singleCycleWidth;
    }
  }

  formatMemberSince(isoDate?: string): string {
    if (!isoDate) return 'Socio';
    try {
      const d = new Date(isoDate);
      if (isNaN(d.getTime())) return 'Socio';
      const months = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
      ];
      return `Socio desde ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return 'Socio';
    }
  }

  formatSimpleTier(tier?: string): string {
    switch (tier) {
      case 'fundador':
        return 'FUNDADOR';
      case 'activo':
        return 'PLENO';
      case 'emergente':
        return 'EMERGENTE';
      default:
        return 'EMERGENTE';
    }
  }

  formatMemberSubtitle(t: any): string {
    const baseSince = this.formatMemberSince(t.memberSince || t.createdAt);
    const count = Number(t.paymentsCount) || 0;
    if (count > 0) {
      const expText = count === 1 ? '1 experiencia compartida' : `${count} experiencias compartidas`;
      return `${baseSince} con ${expText}.`;
    }
    return `${baseSince}.`;
  }

  readonly bg = signal('/assets/images/laguna_blanca.jpg');

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Socios' },
  ];

  // Menús de navegación
  readonly mobileMenuOpen = signal(false);
  readonly activeModal = signal<MembersModalType>(null);
  readonly loginEmail = signal('');
  readonly loginError = signal<string | null>(null);

  toggleMobileMenu(event: Event): void {
    event.stopPropagation();
    this.mobileMenuOpen.update((v) => !v);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.mobileMenuOpen.set(false);
  }

  openModal(modal: MembersModalType): void {
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
