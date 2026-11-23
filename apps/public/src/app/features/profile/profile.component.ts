import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import {
  AUTH_SUCCESS_FEEDBACK_DURATION_MS,
  NewsletterService,
} from '../../core/services/newsletter.service';
import { ActivityHistoryService } from '../../core/services/activity-history.service';
import { ActivityRecord, PaymentReceipt } from '../../core/models/activity-history.model';
import { ExperienceService } from '../../core/services/experience.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { ProviderStoreService } from '../../core/services/provider-store.service';
import { TestimoniosService } from '../../core/services/testimonios.service';
import { Experience } from '../../core/models/experience.model';
import { DEFAULT_CLUB_PROFILE, isClubExperience } from '../../core/models/club-profile.model';
import { ModalType } from '../waitlist/waitlist.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../shared/components/breadcrumb/breadcrumb.component';
import { ReceiptModalComponent } from '../../shared/components/receipt-modal/receipt-modal.component';
import { ExperienceCardComponent } from '../../shared/components/experience-card/experience-card.component';
import { ExperienceDrawerComponent } from '../../shared/components/experience-drawer/experience-drawer.component';
import { buildGoogleCalendarUrl } from '../../shared/utils/google-calendar.util';

export interface CarouselExperienceItem {
  key: string;
  exp: Experience;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatIconModule,
    FooterComponent,
    HeaderComponent,
    BreadcrumbComponent,
    ReceiptModalComponent,
    ExperienceCardComponent,
    ExperienceDrawerComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('carouselRef') carouselRef?: ElementRef<HTMLDivElement>;

  private readonly route = inject(ActivatedRoute);
  readonly newsletter = inject(NewsletterService);
  readonly activityService = inject(ActivityHistoryService);
  readonly experienceService = inject(ExperienceService);
  readonly favoritesService = inject(FavoritesService);
  readonly router = inject(Router);
  private readonly providerStore = inject(ProviderStoreService, { optional: true });
  readonly testimoniosService = inject(TestimoniosService);

  readonly testimonialText = signal<string>('');
  readonly testimonialSaving = signal<boolean>(false);
  readonly testimonialSuccess = signal<boolean>(false);
  readonly testimonialError = signal<string | null>(null);
  private isTestimonialDirty = false;

  readonly isMyTestimonioPublished = computed(() => {
    const my = this.testimoniosService.myTestimonio();
    if (!my) return false;
    const currentOwner = (this.newsletter.currentMember()?.email || this.authenticatedEmail() || '')
      .toLowerCase()
      .trim();
    if (!currentOwner) return false;
    const myEmail = (my.email || '').toLowerCase().trim();
    const currentMemberId = this.newsletter.currentMember()?.id;
    return (myEmail !== '' && myEmail === currentOwner) ||
           (Boolean(my.socioId) && Boolean(currentMemberId) && my.socioId === currentMemberId);
  });

  readonly favoriteExperiences = this.favoritesService.favoriteExperiences;
  private readonly nowMs = signal<number>(Date.now());
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  readonly memberNumber = computed<string | number | null>(() => {
    const member = this.newsletter.currentMember();
    if (!member) return null;
    const raw: unknown = member.position;
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'string') {
      const cleaned = raw.replace(/^#/, '').trim();
      return cleaned || null;
    }
    return typeof raw === 'number' && raw > 0 ? raw : null;
  });

  readonly emergingTenureLabel = computed<string | null>(() => {
    const nowMs = this.nowMs();
    const member = this.newsletter.currentMember();
    if (!member?.createdAt) return null;
    return this.formatElapsedSince(member.createdAt, nowMs);
  });

  readonly plenoTenureLabel = computed<string | null>(() => {
    const nowMs = this.nowMs();
    const member = this.newsletter.currentMember();
    if (!member) return null;
    const isPlenoOrFounder =
      this.newsletter.isMonthlyActive() ||
      member.membershipTier === 'activo' ||
      member.membershipTier === 'fundador';
    const startIso = member.plenoActivatedAt || member.subscription?.startedAt || null;
    if (!isPlenoOrFounder || !startIso) return null;
    return this.formatElapsedSince(startIso, nowMs);
  });

  readonly plenoRemainingInfo = computed<{ label: string; expiresDateText: string; code?: string | null } | null>(() => {
    const nowMs = this.nowMs();
    const member = this.newsletter.currentMember();
    if (!member) return null;
    const isPleno = this.newsletter.isMonthlyActive() || member.membershipTier === 'activo';
    const expiresIso = member.plenoExpiresAt || member.subscription?.expiresAt || null;
    if (!isPleno || !expiresIso) return null;
    const targetMs = Date.parse(expiresIso);
    if (!Number.isFinite(targetMs)) return null;
    const diffMs = targetMs - nowMs;
    const totalDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const expiresDateText = new Date(targetMs).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    let label: string;
    if (totalDays <= 0) {
      label = 'Vence hoy';
    } else if (totalDays === 1) {
      label = 'Queda 1 día';
    } else if (totalDays < 30) {
      label = `Quedan ${totalDays} días`;
    } else {
      const months = Math.floor(totalDays / 30);
      const remDays = totalDays % 30;
      const mText = months === 1 ? '1 mes' : `${months} meses`;
      label = remDays > 0 ? `Quedan ${mText} y ${remDays} ${remDays === 1 ? 'día' : 'días'}` : `Queda ${mText}`;
    }
    return {
      label,
      expiresDateText,
      code: member.plenoDiscountCode || member.subscription?.discountCode || null,
    };
  });

  private formatElapsedSince(dateLike: Date | string, nowMs: number): string {
    const startMs = dateLike instanceof Date ? dateLike.getTime() : Date.parse(String(dateLike));
    if (!Number.isFinite(startMs)) return 'Desde hoy';
    const diffDays = Math.max(0, Math.floor((nowMs - startMs) / (1000 * 60 * 60 * 24)));
    if (diffDays === 0) return 'Desde hoy';
    if (diffDays === 1) return '1 día';
    if (diffDays < 30) return `${diffDays} días`;
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      const remDays = diffDays % 30;
      const mText = months === 1 ? '1 mes' : `${months} meses`;
      return remDays > 0 ? `${mText} y ${remDays} ${remDays === 1 ? 'día' : 'días'}` : mText;
    }
    const years = Math.floor(diffDays / 365);
    const remMonths = Math.floor((diffDays % 365) / 30);
    const yText = years === 1 ? '1 año' : `${years} años`;
    return remMonths > 0 ? `${yText} y ${remMonths} ${remMonths === 1 ? 'mes' : 'meses'}` : yText;
  }

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
    } else {
      this.nowMs.set(Date.now());
      this.newsletter.enforcePlenoExpiration();
      if (!this.isUserHovering && !this.selectedExperience()) {
        this.startAutoplay();
      }
    }
  };

  readonly carouselFavoriteExperiences = computed<CarouselExperienceItem[]>(() => {
    const base = this.favoriteExperiences();
    if (base.length === 0) return [];
    if (base.length >= 3) {
      const items: CarouselExperienceItem[] = [];
      for (let c = 0; c < this.cycleRepetitions; c++) {
        for (let i = 0; i < base.length; i++) {
          items.push({
            key: `cycle_${c}_${base[i].id}_${i}`,
            exp: base[i],
          });
        }
      }
      return items;
    }
    return base.map((exp, i) => ({
      key: `single_${exp.id}_${i}`,
      exp,
    }));
  });

  constructor() {
    let wasEmpty = true;
    effect(() => {
      const count = this.carouselFavoriteExperiences().length;
      if (count > 0 && wasEmpty) {
        this.scheduleCarouselInit();
      }
      wasEmpty = count === 0;
    });

    let lastOwnerEmail: string | null = null;
    let initializedTestimonialKey: string | null = null;
    effect(() => {
      const currentOwner = (this.newsletter.currentMember()?.email || this.authenticatedEmail() || '')
        .toLowerCase()
        .trim();

      // Si el propietario cambió (o cerró sesión), reiniciar borrador y estado de inicialización
      if (currentOwner !== lastOwnerEmail) {
        lastOwnerEmail = currentOwner;
        initializedTestimonialKey = null;
        this.isTestimonialDirty = false;
        this.testimonialText.set('');
        this.testimonialError.set(null);
      }

      if (!currentOwner) {
        return;
      }

      const my = this.testimoniosService.myTestimonio();
      if (!my) {
        // Si no hay testimonio (o la búsqueda está pendiente) y el usuario no ha escrito activamente,
        // asegurar que el borrador no retenga contenido de otra cuenta
        if (!this.isTestimonialDirty && initializedTestimonialKey !== null) {
          this.testimonialText.set('');
          initializedTestimonialKey = null;
        }
        return;
      }

      // Verificar que el testimonio pertenezca al propietario actual del editor
      const myEmail = (my.email || '').toLowerCase().trim();
      const currentMemberId = this.newsletter.currentMember()?.id;
      const isOwner = (myEmail !== '' && myEmail === currentOwner) ||
                      (Boolean(my.socioId) && Boolean(currentMemberId) && my.socioId === currentMemberId);

      if (!isOwner) {
        // El testimonio cargado en el servicio no pertenece a la cuenta actual
        if (!this.isTestimonialDirty) {
          this.testimonialText.set('');
          initializedTestimonialKey = null;
        }
        return;
      }

      const currentTestimonialKey = `${currentOwner}:${my.id || my.createdAt || 'mine'}`;

      // Inicializar el editor una sola vez por testimonio cargado y reiniciar si se carga uno diferente
      if (initializedTestimonialKey !== currentTestimonialKey) {
        initializedTestimonialKey = currentTestimonialKey;
        if (!this.isTestimonialDirty) {
          this.testimonialText.set(my.content);
        }
      }
    });
  }

  removeFavorite(exp: Experience, event?: Event): void {
    this.favoritesService.removeFavorite(exp, event);

    const targets = new Set<string>();
    if (exp.id) targets.add(exp.id.trim().toLowerCase());
    if (exp.slug) targets.add(exp.slug.trim().toLowerCase());

    if (targets.size > 0) {
      this.selectedExperiences.update((current) =>
        current.filter((item) => !targets.has(item.trim().toLowerCase())),
      );
    }

    this.scheduleCarouselInit();
  }

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
    if (this.isFavorite(exp)) {
      this.removeFavorite(exp, event);
      return;
    }
    this.favoritesService.toggleFavorite(exp, event);
    this.scheduleCarouselInit();
  }

  onCardFavoriteToggled(event: { experience: Experience; event?: Event }): void {
    const exp = event.experience;
    if (!this.isFavorite(exp)) {
      const targets = new Set<string>();
      if (exp.id) targets.add(exp.id.trim().toLowerCase());
      if (exp.slug) targets.add(exp.slug.trim().toLowerCase());

      if (targets.size > 0) {
        this.selectedExperiences.update((current) =>
          current.filter((item) => !targets.has(item.trim().toLowerCase())),
        );
      }
    }
    this.scheduleCarouselInit();
  }

  getProviderSlug(exp: Experience): string | null {
    if (exp.providerSlug) {
      return exp.providerSlug.toLowerCase().trim() === 'club'
        ? DEFAULT_CLUB_PROFILE.slug
        : exp.providerSlug;
    }
    if (this.isClubExperience(exp)) return DEFAULT_CLUB_PROFILE.slug;

    if (this.providerStore) {
      const providers = this.providerStore.providers();
      const expEmail = (exp.providerEmail || '').trim().toLowerCase();
      const expName = (exp.providerName || '').trim().toLowerCase();
      const expAgency = (exp.providerAgency || '').trim().toLowerCase();

      const match = providers.find((p) => {
        if (!p.slug) return false;
        if (exp.providerId && p.id === exp.providerId) return true;
        const pEmail = (p.email || '').trim().toLowerCase();
        const pName = (p.name || '').trim().toLowerCase();
        const pAgency = (p.agency || '').trim().toLowerCase();

        if (expEmail && pEmail && pEmail === expEmail) return true;
        if (expName && ((pName && pName === expName) || (pAgency && pAgency === expName))) return true;
        if (expAgency && ((pAgency && pAgency === expAgency) || (pName && pName === expAgency))) return true;
        return false;
      });

      if (match?.slug) {
        return match.slug;
      }
    }

    return null;
  }

  closeExperienceDetails(): void {
    this.selectedExperience.set(null);
    if (!this.isUserHovering && !document.hidden) {
      this.startAutoplay();
    }
  }

  readonly breadcrumbs: BreadcrumbItem[] = [{ label: 'Inicio', url: '/' }, { label: 'Mi Perfil' }];

  readonly bg = signal('/assets/images/laguna_blanca.jpg');
  readonly copyStatus = signal<string | null>(null);
  readonly showSuccessNotification = signal(false);
  readonly profileJustSaved = signal(false);
  readonly profileSaveError = signal<string | null>(null);
  readonly authenticatedEmail = signal<string | null>(null);
  private readonly authenticatedName = signal<string | null>(null);
  private successTimer: ReturnType<typeof setTimeout> | null = null;

  // Actividades: Solo las últimas dos en la vista previa del perfil
  readonly recentActivities = () => this.activityService.activities().slice(0, 2);

  getExperienceRoute(experienceId: string, slug?: string): string {
    const exp =
      (slug ? this.experienceService.getExperienceBySlug(slug) : undefined) ??
      this.experienceService.getPublishedExperienceById(experienceId) ??
      this.experienceService.getExperienceById(experienceId);
    if (exp?.slug) {
      return `/experiencias/${exp.slug}`;
    }
    if (slug) {
      return `/experiencias/${slug}`;
    }
    const cleanId = experienceId.replace(/^exp[-_]/, '');
    return cleanId ? `/experiencias/${cleanId}` : '/experiencias';
  }

  readonly connectingGoogle = signal(false);

  async connectGoogleAccount(): Promise<void> {
    this.connectingGoogle.set(true);
    await this.newsletter.signInWithGoogle();
    this.connectingGoogle.set(false);
  }

  ngOnInit(): void {
    this.nowMs.set(Date.now());
    this.newsletter.enforcePlenoExpiration();
    this.clockTimer = setInterval(() => {
      this.nowMs.set(Date.now());
    }, 60_000);
    void this.loadAuthenticatedEmail();
    void this.loadTestimonioForUser();
    if (!this.newsletter.currentMember()) {
      this.newsletter.isAuthenticated().then((authed) => {
        if (!authed) {
          this.router.navigate(['/ingresar']);
        } else {
          this.syncFieldsFromMember();
        }
      });
    } else {
      this.syncFieldsFromMember();
    }

    if (this.newsletter.consumeLoginSuccessFlag()) {
      this.triggerProfileSuccessFeedback(false);
    }

    this.route.fragment.subscribe((frag) => {
      if (frag === 'favoritos' || frag === 'testimonio') {
        setTimeout(() => {
          const el = document.getElementById(frag);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 350);
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.isDestroyed) return;
    this.scheduleCarouselInit();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
    if (this.carouselInitTimer) {
      clearTimeout(this.carouselInitTimer);
      this.carouselInitTimer = null;
    }
    this.stopAutoplay();
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
      this.scrollDebounceTimer = null;
    }
    if (this.successTimer) {
      clearTimeout(this.successTimer);
      this.successTimer = null;
      this.newsletter.profileSuccessHighlight.set(false);
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
    if (this.favoriteExperiences().length <= 1) return;
    if (this.selectedExperience()) return;
    this.autoplayTimer = setInterval(() => {
      if (this.isDestroyed) {
        this.stopAutoplay();
        return;
      }
      if (!this.isUserHovering && !document.hidden && !this.selectedExperience()) {
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

  onCarouselNav(direction: 'prev' | 'next'): void {
    this.scrollCarousel(direction);
    if (!this.isUserHovering && !this.selectedExperience()) {
      this.startAutoplay();
    }
  }

  private initCarouselPosition(): void {
    if (!this.carouselRef?.nativeElement) return;
    const container = this.carouselRef.nativeElement;
    const items = container.querySelectorAll<HTMLElement>('.carousel-item');
    const baseCount = this.favoriteExperiences().length;
    if (baseCount < 3 || items.length < baseCount * 3) {
      container.scrollLeft = 0;
      return;
    }

    const targetItem = items[2 * baseCount];
    if (targetItem) {
      container.scrollLeft = targetItem.offsetLeft;
    }
  }

  private getSingleCycleWidth(): number {
    if (!this.carouselRef?.nativeElement) return 0;
    const container = this.carouselRef.nativeElement;
    const items = container.querySelectorAll<HTMLElement>('.carousel-item');
    const baseCount = this.favoriteExperiences().length;
    if (baseCount < 3 || items.length < baseCount * 2) return 0;

    const diff = items[baseCount].offsetLeft - items[0].offsetLeft;
    return diff > 0 ? diff : 0;
  }

  scrollCarousel(direction: 'prev' | 'next'): void {
    if (!this.carouselRef?.nativeElement) return;
    const container = this.carouselRef.nativeElement;
    const items = container.querySelectorAll<HTMLElement>('.carousel-item');
    const baseCount = this.favoriteExperiences().length;
    if (items.length === 0 || baseCount === 0) return;

    if (baseCount >= 3) {
      const singleCycleWidth = this.getSingleCycleWidth();
      if (singleCycleWidth > 0) {
        if (direction === 'next' && container.scrollLeft >= singleCycleWidth * 3.2) {
          container.scrollLeft -= singleCycleWidth;
        } else if (direction === 'prev' && container.scrollLeft <= singleCycleWidth * 0.8) {
          container.scrollLeft += singleCycleWidth;
        }
      }
    }

    const step = items[1]
      ? items[1].offsetLeft - items[0].offsetLeft
      : container.clientWidth * 0.45;

    if (baseCount < 3) {
      const maxScroll = container.scrollWidth - container.clientWidth;
      if (maxScroll > 10) {
        if (direction === 'next' && container.scrollLeft >= maxScroll - 10) {
          container.scrollTo({ left: 0, behavior: 'smooth' });
          return;
        }
        if (direction === 'prev' && container.scrollLeft <= 10) {
          container.scrollTo({ left: maxScroll, behavior: 'smooth' });
          return;
        }
      }
    }

    if (typeof container.scrollBy === 'function') {
      container.scrollBy({
        left: direction === 'next' ? step : -step,
        behavior: 'smooth',
      });
    } else {
      container.scrollLeft += direction === 'next' ? step : -step;
    }
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
    const baseCount = this.favoriteExperiences().length;
    if (baseCount < 3) return;

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

  private scheduleCarouselInit(): void {
    if (this.isDestroyed) return;
    if (this.carouselInitTimer) clearTimeout(this.carouselInitTimer);
    this.carouselInitTimer = setTimeout(() => {
      this.carouselInitTimer = null;
      if (this.isDestroyed) return;
      this.initCarouselPosition();
      this.startAutoplay();
      this.attachCarouselListeners();
    }, 80);
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

  @HostListener('window:resize')
  onResize(): void {
    this.normalizeScroll();
  }

  private async loadAuthenticatedEmail(): Promise<void> {
    const [email, name] = await Promise.all([
      this.newsletter.getAuthenticatedEmail(),
      this.newsletter.getAuthenticatedName(),
    ]);
    if (email) {
      this.authenticatedEmail.set(email);
    }
    if (name) {
      this.authenticatedName.set(name);
      if (!this.memberFullName() && !this.newsletter.currentMember()?.fullName) {
        this.memberFullName.set(name);
      }
    }
  }

  private syncFieldsFromMember(): void {
    const m = this.newsletter.currentMember();
    if (!m) {
      if (this.authenticatedName() && !this.memberFullName()) {
        this.memberFullName.set(this.authenticatedName()!);
      }
      return;
    }
    if (m.fullName) {
      this.memberFullName.set(m.fullName);
    } else if (this.authenticatedName() && !this.memberFullName()) {
      this.memberFullName.set(this.authenticatedName()!);
    }
    const dni = m.dni || m.documentNumber || '';
    if (dni && !this.memberDni()) this.memberDni.set(dni);
    if (m.phone && !this.memberPhone()) this.memberPhone.set(m.phone);
    if (m.experiencesWishlist?.length && this.selectedExperiences().length === 0) {
      this.selectedExperiences.set(m.experiencesWishlist);
    }
    if (m.experiencesOther && !this.memberOtherExperience()) {
      this.memberOtherExperience.set(m.experiencesOther);
    }
  }

  onTestimonialInput(val: string): void {
    this.isTestimonialDirty = true;
    this.testimonialText.set(val);
    if (this.testimonialError()) {
      this.testimonialError.set(null);
    }
  }

  async onSaveTestimonial(): Promise<void> {
    const text = this.testimonialText().trim();
    if (text.length < 10) {
      this.testimonialError.set('El testimonio debe contener al menos 10 caracteres.');
      return;
    }
    this.testimonialSaving.set(true);
    this.testimonialError.set(null);
    this.testimonialSuccess.set(false);
    const res = await this.testimoniosService.submitTestimonio(text);
    this.testimonialSaving.set(false);
    if (res.success) {
      this.isTestimonialDirty = false;
      this.testimonialSuccess.set(true);
      setTimeout(() => this.testimonialSuccess.set(false), 5000);
    } else {
      this.testimonialError.set(res.error || 'Ocurrió un error al guardar tu testimonio.');
    }
  }

  private async loadTestimonioForUser(): Promise<void> {
    const member = this.newsletter.currentMember();
    const email = member?.email || (await this.newsletter.getAuthenticatedEmail());
    if (email) {
      const t = await this.testimoniosService.loadMyTestimonioFor(email);
      const currentOwner = (this.newsletter.currentMember()?.email || this.authenticatedEmail() || email)
        .toLowerCase()
        .trim();
      const tEmail = (t?.email || '').toLowerCase().trim();
      const currentMemberId = this.newsletter.currentMember()?.id;
      const isOwner = t && ((tEmail !== '' && tEmail === currentOwner) ||
                      (Boolean(t.socioId) && Boolean(currentMemberId) && t.socioId === currentMemberId));
      if (isOwner && !this.isTestimonialDirty) {
        this.testimonialText.set(t.content);
      }
    }
  }

  private triggerProfileSuccessFeedback(highlightSaveButton: boolean): void {
    if (this.successTimer) {
      clearTimeout(this.successTimer);
    }
    this.showSuccessNotification.set(true);
    this.newsletter.profileSuccessHighlight.set(true);
    if (highlightSaveButton) {
      this.profileJustSaved.set(true);
    }
    this.successTimer = setTimeout(() => {
      this.showSuccessNotification.set(false);
      this.profileJustSaved.set(false);
      this.newsletter.profileSuccessHighlight.set(false);
      this.successTimer = null;
    }, AUTH_SUCCESS_FEEDBACK_DURATION_MS);
  }

  // Menús de navegación idénticos a los de la landing /
  readonly mobileMenuOpen = signal(false);
  readonly profileMenuOpen = signal(false);

  // Modales interactivos en la misma página de perfil
  readonly activeModal = signal<ModalType>(null);
  readonly selectedExperience = signal<Experience | null>(null);

  // Pre-registro de Prestadores de Servicio
  readonly providerName = signal('');
  readonly providerEmail = signal('');
  readonly providerPhone = signal('');
  readonly providerWebsite = signal('');
  readonly providerCategory = signal('guia_montaña');
  readonly providerCustomCategory = signal('');
  readonly providerRegion = signal('Puna & Fiambalá');
  readonly providerSuccess = signal(false);
  readonly providerError = signal<string | null>(null);
  readonly providerSubmitting = signal(false);

  // Postulación de Socio Fundador (Carta de Admisión)
  readonly founderName = signal('');
  readonly founderEmail = signal('');
  readonly founderPhone = signal('');
  readonly founderCity = signal('');
  readonly founderLetter = signal('');
  readonly founderAgreedToPrice = signal(false);
  readonly founderSuccess = signal(false);

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  toggleMobileMenu(event: Event): void {
    event.stopPropagation();
    this.profileMenuOpen.set(false);
    this.mobileMenuOpen.update((v) => !v);
  }

  toggleProfileMenu(event: Event): void {
    event.stopPropagation();
    this.mobileMenuOpen.set(false);
    this.profileMenuOpen.update((v) => !v);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.profileMenuOpen.set(false);
    this.mobileMenuOpen.set(false);
  }

  openModal(modal: ModalType, exp?: Experience): void {
    this.profileMenuOpen.set(false);
    this.mobileMenuOpen.set(false);
    this.activeModal.set(modal);
    if (exp) {
      this.selectedExperience.set(exp);
    }
  }

  closeModal(): void {
    this.activeModal.set(null);
    this.selectedExperience.set(null);
    this.activityService.closeReceipt();
    if (!this.isUserHovering && !document.hidden) {
      this.startAutoplay();
    }
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.activeModal()) {
      this.closeModal();
    } else if (this.selectedExperience()) {
      this.closeExperienceDetails();
    }
    this.profileMenuOpen.set(false);
    this.mobileMenuOpen.set(false);
  }

  toggleExperienceDetails(exp: Experience): void {
    if (this.selectedExperience()?.id === exp.id) {
      this.selectedExperience.set(null);
      if (!this.isUserHovering && !document.hidden) {
        this.startAutoplay();
      }
    } else {
      this.selectedExperience.set(exp);
      this.stopAutoplay();
    }
  }

  openFounderApplication(): void {
    const member = this.newsletter.currentMember();
    if (member) {
      if (!this.founderName().trim() && member.fullName) {
        this.founderName.set(member.fullName);
      }
      if (!this.founderEmail().trim() && member.email) {
        this.founderEmail.set(member.email);
      }
      if (!this.founderCity().trim()) {
        this.founderCity.set('Catamarca');
      }
    }
    this.openModal('founder_application');
  }

  submitFounderApplication(): void {
    if (
      !this.founderName().trim() ||
      !this.founderEmail().trim() ||
      !this.founderLetter().trim() ||
      !this.founderAgreedToPrice()
    ) {
      return;
    }
    this.founderSuccess.set(true);
  }

  async submitProvider(): Promise<void> {
    if (this.providerSubmitting()) return;

    const email = this.providerEmail().trim().toLowerCase();
    const name = this.providerName().trim();
    if (
      !email ||
      !name ||
      (this.providerCategory() === 'otro' && !this.providerCustomCategory().trim())
    ) {
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email)) {
      this.providerError.set('Ingresá un correo electrónico válido.');
      return;
    }

    const finalCategory =
      this.providerCategory() === 'otro'
        ? this.providerCustomCategory().trim() || 'Otro'
        : this.providerCategory();

    this.providerError.set(null);
    this.providerSubmitting.set(true);

    try {
      const result = await this.newsletter.submitProviderApplication({
        fullName: name,
        category: finalCategory,
        region: this.providerRegion(),
        email,
        phone: this.providerPhone().trim(),
        website: this.providerWebsite().trim(),
        description: '',
        autoApprove: true,
      });

      if (!result?.success) {
        this.providerError.set(
          result?.message ||
            'El sistema no pudo procesar la postulación en este momento por un inconveniente temporal de recepción. Por favor intentá nuevamente.',
        );
        return;
      }

      this.providerSuccess.set(true);
      setTimeout(() => {
        this.providerName.set('');
        this.providerEmail.set('');
        this.providerPhone.set('');
        this.providerCategory.set('guia_montaña');
        this.providerCustomCategory.set('');
        this.providerSuccess.set(false);
        this.closeModal();
      }, 2800);
    } finally {
      this.providerSubmitting.set(false);
    }
  }

  readonly wishlistExperiences = [
    { id: 'kayak', title: 'Kayak y aguas calmas en diques andinos' },
    { id: 'pissis', title: 'Trekking Balcón del Pissis y lagunas' },
    { id: 'termas', title: 'Termas de Fiambalá y valles secretos' },
    { id: 'otros', title: 'Otros (especificar a continuación)' },
  ];

  readonly memberFullName = signal(this.newsletter.currentMember()?.fullName || '');
  readonly memberDni = signal(
    this.newsletter.currentMember()?.dni || this.newsletter.currentMember()?.documentNumber || '',
  );
  readonly memberPhone = signal(this.newsletter.currentMember()?.phone || '');
  readonly selectedExperiences = signal<string[]>(
    this.newsletter.currentMember()?.experiencesWishlist || [],
  );
  readonly memberOtherExperience = signal(this.newsletter.currentMember()?.experiencesOther || '');
  readonly profileSaved = signal(
    Boolean(
      this.newsletter.currentMember()?.fullName?.trim() &&
        (this.newsletter.currentMember()?.dni?.trim() ||
          this.newsletter.currentMember()?.documentNumber?.trim()) &&
        this.newsletter.currentMember()?.phone?.trim(),
    ),
  );
  readonly isProfileComplete = computed(() => {
    const m = this.newsletter.currentMember();
    const hasSavedData = Boolean(
      m?.fullName?.trim() &&
        (m?.dni?.trim() || m?.documentNumber?.trim()) &&
        m?.phone?.trim(),
    );
    return this.profileSaved() || hasSavedData;
  });

  toggleExperienceWishlist(id: string): void {
    const current = this.selectedExperiences();
    if (current.includes(id)) {
      this.selectedExperiences.set(current.filter((item) => item !== id));
    } else {
      this.selectedExperiences.set([...current, id]);
    }
  }

  isExperienceSelected(id: string): boolean {
    return this.selectedExperiences().includes(id);
  }

  getExperienceTitle(id: string): string {
    if (id === 'otros' && this.memberOtherExperience().trim()) {
      return `Otros: ${this.memberOtherExperience().trim()}`;
    }
    const found = this.wishlistExperiences.find((e) => e.id === id);
    return found ? found.title : id;
  }

  async saveMemberProfile(): Promise<void> {
    this.profileSaveError.set(null);
    const dni = this.memberDni().replace(/\D/g, '').slice(0, 9);
    const phone = this.memberPhone().trim().slice(0, 25);
    if (!this.memberFullName().trim() || !/^\d{7,9}$/.test(dni) || !phone) {
      return;
    }

    const otherText = this.isExperienceSelected('otros') ? this.memberOtherExperience().trim() : '';

    const res = await this.newsletter.updateMemberProfile({
      fullName: this.memberFullName().trim().slice(0, 100),
      dni,
      phone,
      experiencesWishlist: this.selectedExperiences(),
      experiencesOther: otherText,
    });

    if (res.success) {
      this.profileSaved.set(true);
      this.triggerProfileSuccessFeedback(true);
    } else if (res.message) {
      this.profileSaveError.set(res.message);
    }
  }

  editMemberProfile(): void {
    this.profileSaved.set(false);
  }

  copyLink(): void {
    const url = location.origin;
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        this.copyStatus.set('¡Enlace de EXPERIENCIAS.CLUB copiado!');
        setTimeout(() => this.copyStatus.set(null), 2500);
      })
      .catch(() => {
        this.copyStatus.set(url);
        setTimeout(() => this.copyStatus.set(null), 3000);
      });
  }

  shareWhatsApp(): void {
    const text = encodeURIComponent(
      `Me sumé a EXPERIENCIAS.CLUB (Edición Catamarca), el club privado de expediciones andinas y náuticas. ${location.origin}`,
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  }

  shareX(): void {
    const text = encodeURIComponent(
      'Acabo de registrarme en EXPERIENCIAS.CLUB (Edición Catamarca) — expediciones andinas y travesías náuticas.',
    );
    const url = encodeURIComponent(location.origin);
    window.open(`https://x.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  }

  logout(): void {
    this.newsletter.resetCurrentSubscription();
    this.profileMenuOpen.set(false);
    this.mobileMenuOpen.set(false);
    this.router.navigate(['/']);
  }

  openReceipt(receipt: PaymentReceipt, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.activityService.viewReceipt(receipt);
  }

  closeReceipt(): void {
    this.activityService.closeReceipt();
  }

  getActivityGoogleCalendarUrl(act: ActivityRecord): string {
    const details = [
      `Experiencia reservada en Experiencias Club.`,
      act.receipt?.receiptNumber ? `Recibo Nº: ${act.receipt.receiptNumber}` : '',
      act.provider?.name ? `Prestador: ${act.provider.name}` : '',
      act.provider?.contactPhone ? `Contacto: ${act.provider.contactPhone}` : '',
      act.slug ? `Ficha: https://experiencias.club/experiencias/${act.slug}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return buildGoogleCalendarUrl({
      title: act.title,
      date: act.dateLabel,
      location: act.region || 'Catamarca, Argentina',
      details,
    });
  }

  copyCoupon(code: string): void {
    navigator.clipboard
      ?.writeText(code)
      .then(() => {
        this.copyStatus.set(`¡Cupón ${code} (10% OFF) copiado!`);
        setTimeout(() => this.copyStatus.set(null), 3000);
      })
      .catch(() => {
        this.copyStatus.set(code);
        setTimeout(() => this.copyStatus.set(null), 3000);
      });
  }

  printReceipt(): void {
    window.print();
  }
}
