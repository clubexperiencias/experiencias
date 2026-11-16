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

function normalizeAgency(val: string): string {
  return val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

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
      const p = this.provider();
      const member = this.newsletter.currentMember();
      this.hasRemotePaidRecord.set(false);
      if (p && member?.email) {
        void this.checkRemotePayments(p, member.email);
      }
    });
  }

  private getHistoricalExperiencesForProvider(p: ProviderUser): Experience[] {
    const queryId = (p.id || '').trim().toLowerCase();
    const querySlug = (p.slug || '').trim().toLowerCase();
    const queryEmail = (p.email || '').trim().toLowerCase();
    const rawAgency = (p.agency || p.name || '').trim();
    const queryAgencyNorm = rawAgency ? normalizeAgency(rawAgency) : '';

    return this.expService.experiences().filter((e) => {
      const expProviderId = (e.providerId || '').trim().toLowerCase();
      if (queryId && expProviderId && expProviderId === queryId) return true;
      const expSlug = (e.providerSlug || '').trim().toLowerCase();
      if (querySlug && expSlug && expSlug === querySlug) return true;
      const expEmail = (e.providerEmail || '').trim().toLowerCase();
      if (queryEmail && expEmail && expEmail === queryEmail) return true;
      const expAgency = (e.providerAgency || e.providerName || '').trim();
      if (queryAgencyNorm && expAgency && normalizeAgency(expAgency) === queryAgencyNorm) return true;
      return false;
    });
  }

  /**
   * Determina si el socio actual tiene permitido calificar al prestador:
   * Debe ser socio y haber abonado al menos una experiencia de este prestador.
   */
  readonly canRateProvider = computed<boolean>(() => {
    const member = this.newsletter.currentMember();
    const p = this.provider();
    if (!member || !p) {
      return false;
    }

    if (this.hasRemotePaidRecord()) {
      return true;
    }

    const histExps = this.getHistoricalExperiencesForProvider(p);
    const expIds = new Set(histExps.map((e) => (e.id || '').toLowerCase().trim()).filter(Boolean));
    const expSlugs = new Set(histExps.map((e) => (e.slug || '').toLowerCase().trim()).filter(Boolean));
    const expTitles = new Set(histExps.map((e) => (e.title || '').toLowerCase().trim()).filter(Boolean));
    const provEmail = (p.email || '').toLowerCase().trim();
    const provName = (p.name || '').toLowerCase().trim();
    const provAgency = (p.agency || '').toLowerCase().trim();

    // 1. Verificar en historial de actividades del socio
    const acts = this.activityHistory.activities();
    const hasPaidActivity = acts.some((act) => {
      const isPaid = act.status === 'confirmada' || act.receipt?.status === 'aprobado';
      if (!isPaid) return false;

      const actExpId = (act.experienceId || '').toLowerCase().trim();
      const actSlug = (act.slug || '').toLowerCase().trim();
      const actTitle = (act.title || '').toLowerCase().trim();
      const actProvName = (act.provider?.name || '').toLowerCase().trim();

      const matchId = Boolean(
        (actExpId && expIds.has(actExpId)) ||
        (actSlug && expSlugs.has(actSlug)) ||
        (actExpId && expSlugs.has(actExpId))
      );

      // Si el item tiene ID de experiencia y el prestador tiene IDs conocidos, solo aceptar matchId
      if (actExpId && expIds.size > 0) {
        return matchId;
      }

      if (matchId) {
        return true;
      }

      const matchTitle = Boolean(actTitle && expTitles.has(actTitle));
      if (!matchTitle) {
        const matchProvDirect = Boolean(
          (provAgency && actProvName === provAgency) ||
          (provName && actProvName === provName)
        );
        return matchProvDirect;
      }

      // Para pagos legacy con solo título, resolver el pago al prestador antes de aceptar coincidencia por título
      if (
        (provAgency && actProvName === provAgency) ||
        (provName && actProvName === provName)
      ) {
        return true;
      }

      return this.resolveExperienceTitleToProvider(actTitle, p);
    });
    if (hasPaidActivity) {
      return true;
    }

    // 2. Verificar en transferencias/pagos registrados localmente o en store
    const email = (member.email || '').toLowerCase().trim();
    const dni = (member.dni || member.documentNumber || '').trim();
    const socioId = (member.id || '').trim();

    const subs = this.providerStore.submissions();
    const hasPaidSubmission = subs.some((sub) => {
      const matchUser =
        (email && (sub.email || '').toLowerCase().trim() === email) ||
        (socioId && (sub as any).socioId && (sub as any).socioId === socioId) ||
        (dni && (sub.dni || '').trim() === dni);
      if (!matchUser) return false;

      const isPaid = sub.status === 'aprobado';
      if (!isPaid) return false;

      const subProvEmail = (((sub as any).providerEmail as string) || '').toLowerCase().trim();
      if (provEmail && subProvEmail && subProvEmail !== provEmail) {
        return false;
      }

      const subExpId = (sub.experienceId || '').toLowerCase().trim();
      const subExpTitle = (sub.experienceTitle || '').toLowerCase().trim();

      const matchId = Boolean(
        (subExpId && expIds.has(subExpId)) ||
        (subExpId && expSlugs.has(subExpId))
      );

      // Si el item tiene ID de experiencia y el prestador tiene IDs conocidos, solo aceptar matchId
      if (subExpId && expIds.size > 0) {
        return matchId;
      }

      if (matchId) {
        return true;
      }

      const matchTitle = Boolean(subExpTitle && expTitles.has(subExpTitle));
      if (!matchTitle) {
        return Boolean(provEmail && subProvEmail && subProvEmail === provEmail);
      }

      // Para pagos legacy con solo título, resolver el pago al prestador
      if (provEmail && subProvEmail && subProvEmail === provEmail) {
        return true;
      }

      return this.resolveExperienceTitleToProvider(subExpTitle, p);
    });

    return hasPaidSubmission;
  });

  private resolveExperienceTitleToProvider(title: string, p: ProviderUser): boolean {
    if (!title || !p) return false;
    const cleanTitle = title.trim().toLowerCase();
    const provEmail = (p.email || '').trim().toLowerCase();
    const provId = (p.id || '').trim().toLowerCase();
    const provSlug = (p.slug || '').trim().toLowerCase();
    const provAgencyNorm = p.agency ? normalizeAgency(p.agency) : '';

    const matching = this.expService
      .experiences()
      .filter((e: Experience) => (e.title || '').trim().toLowerCase() === cleanTitle);

    if (matching.length === 0) {
      const hist = this.getHistoricalExperiencesForProvider(p);
      return hist.some((e: Experience) => (e.title || '').trim().toLowerCase() === cleanTitle);
    }

    // Para resolver de forma segura pagos legacy sin ID, todas las experiencias con ese título
    // deben pertenecer a este prestador para evitar atribuir pagos de experiencias homónimas de otros
    return matching.every((e: Experience) => {
      const eEmail = (e.providerEmail || '').trim().toLowerCase();
      const eId = (e.providerId || '').trim().toLowerCase();
      const eSlug = (e.providerSlug || '').trim().toLowerCase();
      const eAgency = (e.providerAgency || e.providerName || '').trim();
      return (
        (provEmail && eEmail === provEmail) ||
        (provId && eId === provId) ||
        (provSlug && eSlug === provSlug) ||
        (provAgencyNorm && eAgency && normalizeAgency(eAgency) === provAgencyNorm)
      );
    });
  }

  private async checkRemotePayments(p: ProviderUser, memberEmail?: string): Promise<void> {
    const member = this.newsletter.currentMember();
    const email = (memberEmail || member?.email || '').toLowerCase().trim();
    if (!email || !isSupabaseConfigured() || !p) {
      return;
    }

    const histExps = this.getHistoricalExperiencesForProvider(p);
    const expIds = new Set(histExps.map((e) => (e.id || '').toLowerCase().trim()).filter(Boolean));
    const expSlugs = new Set(histExps.map((e) => (e.slug || '').toLowerCase().trim()).filter(Boolean));
    const expTitles = new Set(histExps.map((e) => (e.title || '').toLowerCase().trim()).filter(Boolean));
    const provEmail = (p.email || '').toLowerCase().trim();
    const targetProvId = (p.id || '').toLowerCase().trim();
    const targetProvSlug = (p.slug || '').toLowerCase().trim();

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let targetProviderUuid: string | null = null;
    if (p.id && uuidRegex.test(p.id)) {
      targetProviderUuid = p.id;
    } else if (p.email || p.slug) {
      try {
        let q = (this.supabase as any).from('prestadores').select('id');
        if (p.email) {
          q = q.eq('email', p.email.trim().toLowerCase());
        } else if (p.slug) {
          q = q.eq('slug', p.slug.trim().toLowerCase());
        }
        const { data: pRow } = await q.maybeSingle();
        if (pRow?.id && uuidRegex.test(pRow.id)) {
          targetProviderUuid = pRow.id;
        }
      } catch (err) {
        console.warn('[ProviderPublicProfile] Error resolviendo UUID del prestador:', err);
      }
    }

    // 1. Alinear directamente con can_socio_rate_provider (regla canónica del servidor)
    if (targetProviderUuid) {
      try {
        const { data: rpcData, error: rpcErr } = await (this.supabase as any).rpc('can_socio_rate_provider', {
          p_provider_id: targetProviderUuid,
        });

        if (!rpcErr && rpcData && typeof rpcData === 'object') {
          if (rpcData.can_vote === true || rpcData.has_voted === true) {
            const currentMember = this.newsletter.currentMember();
            const currentMemberEmail = (currentMember?.email || '').toLowerCase().trim();
            const currentP = this.provider();
            const currentPId = (currentP?.id || '').toLowerCase().trim();
            const currentPSlug = (currentP?.slug || '').toLowerCase().trim();
            const currentPEmail = (currentP?.email || '').toLowerCase().trim();

            const isSameMember = currentMemberEmail === email;
            const isSameProvider = Boolean(
              currentP &&
              ((targetProvId && currentPId === targetProvId) ||
               (targetProvSlug && currentPSlug === targetProvSlug) ||
               (provEmail && currentPEmail === provEmail))
            );

            if (!this.isDestroyed && isSameMember && isSameProvider) {
              this.hasRemotePaidRecord.set(true);
              return;
            }
          }
        }
      } catch (rpcErr) {
        // Continuar al fallback de pagos_transferencias
      }
    }

    // 2. Fallback: Consulta sobre pagos_transferencias considerando tanto email como socio_id y dni
    const socioId = member?.id && uuidRegex.test(member.id) ? member.id : null;
    const memberDni = (member?.dni || member?.documentNumber || '').trim();

    try {
      let query = this.supabase
        .from('pagos_transferencias' as any)
        .select('id, status, experience_id, experience_title, provider_email, socio_id, dni, email')
        .eq('status', 'aprobado');

      if (socioId) {
        query = query.or(`email.ilike.${email},socio_id.eq.${socioId}`);
      } else {
        query = query.eq('email', email);
      }

      const { data: rows, error } = await query;

      if (!error && rows && rows.length > 0) {
        const hasPaid = (rows as any[]).some((r: any) => {
          const rowProvEmail = (r.provider_email || '').toLowerCase().trim();
          if (provEmail && rowProvEmail && rowProvEmail !== provEmail) {
            return false;
          }

          const rowEmail = (r.email || '').toLowerCase().trim();
          const rowSocioId = (r.socio_id || '').trim();
          const rowDni = (r.dni || '').trim();

          const matchUser =
            (email && rowEmail === email) ||
            (socioId && rowSocioId && rowSocioId === socioId) ||
            (memberDni && rowDni && rowDni === memberDni);

          if (!matchUser) {
            return false;
          }

          const rowExpId = (r.experience_id || '').toLowerCase().trim();
          const rowExpTitle = (r.experience_title || '').toLowerCase().trim();

          const matchId = Boolean(
            (rowExpId && expIds.has(rowExpId)) ||
            (rowExpId && expSlugs.has(rowExpId))
          );

          // Si el registro de pago tiene ID y el prestador tiene IDs conocidos, solo aceptar matchId
          if (rowExpId && expIds.size > 0) {
            return matchId;
          }

          if (matchId) {
            return true;
          }

          const matchTitle = Boolean(rowExpTitle && expTitles.has(rowExpTitle));
          if (!matchTitle) {
            return Boolean(provEmail && rowProvEmail && rowProvEmail === provEmail);
          }

          // Para pagos legacy con solo título, resolver el pago al prestador
          if (provEmail && rowProvEmail && rowProvEmail === provEmail) {
            return true;
          }

          return this.resolveExperienceTitleToProvider(rowExpTitle, p);
        });

        // Aplicar la respuesta solo si el componente sigue activo y el socio y prestador aún coinciden con el perfil actual
        const currentMember = this.newsletter.currentMember();
        const currentMemberEmail = (currentMember?.email || '').toLowerCase().trim();
        const currentP = this.provider();
        const currentPId = (currentP?.id || '').toLowerCase().trim();
        const currentPSlug = (currentP?.slug || '').toLowerCase().trim();
        const currentPEmail = (currentP?.email || '').toLowerCase().trim();

        const isSameMember = currentMemberEmail === email;
        const isSameProvider = Boolean(
          currentP &&
          ((targetProvId && currentPId === targetProvId) ||
           (targetProvSlug && currentPSlug === targetProvSlug) ||
           (provEmail && currentPEmail === provEmail))
        );

        if (hasPaid && !this.isDestroyed && isSameMember && isSameProvider) {
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

  isRatingToastError(msg?: string | null): boolean {
    const toast = msg || this.ratingToast();
    if (!toast) return false;
    const lower = toast.toLowerCase();
    return (
      lower.includes('no se pudo') ||
      lower.includes('error') ||
      lower.includes('falló') ||
      lower.includes('fallo') ||
      lower.includes('inválid') ||
      lower.includes('invalid') ||
      lower.includes('debes') ||
      lower.includes('solo los socios') ||
      lower.includes('rechazad')
    );
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

