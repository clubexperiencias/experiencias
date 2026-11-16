import { Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { ProviderRatingService, ProviderRatingData } from '../../../core/services/provider-rating.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { NewsletterService } from '../../../core/services/newsletter.service';
import { ActivityHistoryService } from '../../../core/services/activity-history.service';
import { SUPABASE_CLIENT, isSupabaseConfigured } from '../../../core/supabase/supabase.client';
import { ProviderUser } from '../../../core/models/bank-transfer.model';
import { Experience } from '../../../core/models/experience.model';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { FounderAdComponent } from '../../../shared/components/founder-ad/founder-ad.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ArsPipe } from '../../../shared/pipes/format.pipes';
import { getSocialHandle } from '../../../shared/utils/social-url.util';

@Component({
  selector: 'app-provider-public-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    HeaderComponent,
    FooterComponent,
    FounderAdComponent,
    BreadcrumbComponent,
    ArsPipe,
  ],
  templateUrl: './provider-public-profile.component.html',
  styleUrl: './provider-public-profile.component.css',
})
export class ProviderPublicProfileComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly titleService = inject(Title);
  private readonly supabase = inject(SUPABASE_CLIENT);
  readonly providerStore = inject(ProviderStoreService);
  readonly expService = inject(ExperienceService);
  readonly ratingService = inject(ProviderRatingService);
  readonly favoritesService = inject(FavoritesService);
  readonly newsletter = inject(NewsletterService);
  readonly activityHistory = inject(ActivityHistoryService);

  private isDestroyed = false;

  readonly mobileMenuOpen = signal(false);
  readonly provider = signal<ProviderUser | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly hoveredStar = signal<number>(0);
  readonly ratingToast = this.ratingService.ratingToast;

  private readonly hasRemotePaidRecord = signal<boolean>(false);

  constructor() {
    effect(() => {
      const exps = this.providerExperiences();
      const member = this.newsletter.currentMember();
      if (exps.length > 0 && member?.email) {
        void this.checkRemotePayments(exps);
      }
    });
  }

  /**
   * Determina si el socio actual tiene permitido calificar al prestador:
   * Debe ser socio y haber abonado al menos una experiencia de este prestador.
   */
  readonly canRateProvider = computed<boolean>(() => {
    const member = this.newsletter.currentMember();
    if (!member) {
      return false;
    }

    if (this.hasRemotePaidRecord()) {
      return true;
    }

    const exps = this.providerExperiences();
    if (exps.length === 0) {
      return false;
    }

    const expIds = new Set(exps.map((e) => (e.id || '').toLowerCase().trim()));
    const expSlugs = new Set(exps.map((e) => (e.slug || '').toLowerCase().trim()).filter(Boolean));
    const expTitles = new Set(exps.map((e) => (e.title || '').toLowerCase().trim()));

    // 1. Verificar en historial de actividades del socio
    const acts = this.activityHistory.activities();
    const hasPaidActivity = acts.some((act) => {
      const matchExp =
        expIds.has((act.experienceId || '').toLowerCase().trim()) ||
        expSlugs.has((act.slug || '').toLowerCase().trim()) ||
        expTitles.has((act.title || '').toLowerCase().trim());
      const isPaid = act.status === 'confirmada' || act.receipt?.status === 'aprobado';
      return matchExp && isPaid;
    });
    if (hasPaidActivity) {
      return true;
    }

    // 2. Verificar en transferencias/pagos registrados localmente o en store
    const email = (member.email || '').toLowerCase().trim();
    const dni = (member.dni || member.documentNumber || '').trim();

    const subs = this.providerStore.submissions();
    const hasPaidSubmission = subs.some((sub) => {
      const matchUser =
        (email && (sub.email || '').toLowerCase().trim() === email) ||
        (dni && (sub.dni || '').trim() === dni);
      const matchExp =
        expIds.has((sub.experienceId || '').toLowerCase().trim()) ||
        expTitles.has((sub.experienceTitle || '').toLowerCase().trim());
      const isPaid = sub.status === 'aprobado';
      return matchUser && matchExp && isPaid;
    });

    return hasPaidSubmission;
  });

  private async checkRemotePayments(providerExps: Experience[]): Promise<void> {
    const member = this.newsletter.currentMember();
    const email = member?.email?.toLowerCase().trim();
    if (!email || !isSupabaseConfigured() || providerExps.length === 0) {
      return;
    }

    const expIds = providerExps.map((e) => e.id).filter(Boolean);
    const expTitles = providerExps.map((e) => e.title.toLowerCase().trim());

    try {
      const { data: rows, error } = await this.supabase
        .from('pagos_transferencias' as any)
        .select('id, status, experience_id, experience_title')
        .eq('email', email)
        .eq('status', 'aprobado');

      if (!error && rows && rows.length > 0) {
        const hasPaid = (rows as any[]).some((r: any) => {
          const matchId = expIds.includes(r.experience_id);
          const matchTitle = expTitles.includes((r.experience_title || '').toLowerCase().trim());
          return matchId || matchTitle;
        });
        if (hasPaid && !this.isDestroyed) {
          this.hasRemotePaidRecord.set(true);
        }
      }
    } catch (err) {
      console.warn('[ProviderPublicProfile] Error consultando pagos remotos:', err);
    }
  }

  readonly currentRating = computed<ProviderRatingData>(() => {
    const p = this.provider();
    if (!p) return { score: 5.0, count: 0 };
    return this.ratingService.getRating(p);
  });

  getProviderRating(p?: ProviderUser | null): ProviderRatingData {
    return this.currentRating();
  }

  userVote(p?: ProviderUser | null): number {
    return this.currentRating().userVote || 0;
  }

  async rateProvider(p: ProviderUser | null, stars: number): Promise<void> {
    if (!p) return;
    await this.ratingService.rateProvider(p, stars);
  }

  isFavorite(exp: Experience): boolean {
    return this.favoritesService.isFavorite(exp);
  }

  toggleFavorite(exp: Experience, event?: Event): void {
    this.favoritesService.toggleFavorite(exp, event);
  }

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const p = this.provider();
    const isLoad = this.loading();
    return [
      { label: 'Inicio', url: '/' },
      { label: 'Prestadores', url: '/prestadores' },
      { label: p ? p.agency || p.name : (isLoad ? 'Cargando...' : 'Prestador') },
    ];
  });

  readonly providerExperiences = computed<Experience[]>(() => {
    const p = this.provider();
    if (!p) return [];
    return this.expService.getExperiencesByProvider({
      slug: p.slug,
      email: p.email,
      agency: p.agency,
    });
  });

  async ngOnInit(): Promise<void> {
    this.titleService.setTitle('Cargando... - Experiencias Club');
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.notFound.set(true);
      this.loading.set(false);
      this.titleService.setTitle('Prestador no encontrado - Experiencias Club');
      return;
    }

    await this.expService.remoteLoadPromise;
    const found = await this.providerStore.getPublicProvider(slug);
    if (this.isDestroyed) {
      return;
    }

    if (found) {
      this.provider.set(found);
      this.titleService.setTitle(`${found.agency || found.name} - Experiencias Club`);
    } else {
      this.notFound.set(true);
      this.titleService.setTitle('Prestador no encontrado - Experiencias Club');
    }
    this.loading.set(false);
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
  }

  formatSocialUrl(social: string | undefined): string {
    if (!social) return '#';
    const s = social.trim();
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    if (s.includes('instagram.com/')) return `https://${s}`;
    if (s.startsWith('@')) return `https://instagram.com/${s.slice(1)}`;
    return `https://${s}`;
  }

  socialHandle(social: string | undefined, isSecondary = false): string {
    if (!social) return '';
    const formatted = this.formatSocialUrl(social);
    const handle = getSocialHandle(formatted);
    if (
      handle === '@share' ||
      handle.toLowerCase() === 'share' ||
      handle === 'Red Social Secundaria'
    ) {
      return 'Red Social Secundaria';
    }
    try {
      const parsed = new URL(formatted);
      const segments = parsed.pathname.toLowerCase().split('/').filter(Boolean);
      if (segments.includes('share')) {
        return 'Red Social Secundaria';
      }
    } catch {
      // not a parseable URL
    }
    return handle;
  }

  formatWebsiteUrl(url: string | undefined): string {
    if (!url) return '#';
    const u = url.trim();
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    return `https://${u}`;
  }

  cleanWhatsApp(phone: string | undefined): string {
    if (!phone) return '';
    return phone.replace(/[^0-9]/g, '');
  }

  getWhatsAppUrl(p: any): string {
    const clean = this.cleanWhatsApp(p?.phone);
    if (!clean) return '#';
    const text = encodeURIComponent(
      'Hola! Te contacto a través de tu perfil en Experiencias.club para consultar sobre tus actividades.',
    );
    return `https://wa.me/${clean}?text=${text}`;
  }

  getInitials(name?: string): string {
    if (!name) return 'PR';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
}

