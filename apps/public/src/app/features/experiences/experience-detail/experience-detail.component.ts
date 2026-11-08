import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { ExperienceService } from '../../../core/services/experience.service';
import { DEFAULT_CLUB_PROFILE, isClubExperience } from '../../../core/models/club-profile.model';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ArsPipe, FechaPipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-experience-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    HeaderComponent,
    FooterComponent,
    BreadcrumbComponent,
    ArsPipe,
    FechaPipe,
  ],
  templateUrl: './experience-detail.component.html',
  styleUrl: './experience-detail.component.css',
})
export class ExperienceDetailComponent {
  private readonly route = inject(ActivatedRoute);
  readonly experienceService = inject(ExperienceService);
  readonly isClubExperience = isClubExperience;
  readonly isLoading = signal(!this.experienceService.hasRemoteExperiences());

  constructor() {
    this.experienceService.remoteLoadPromise
      .finally(() => {
        this.isLoading.set(false);
      })
      .catch((err) => {
        console.warn('[ExperienceDetail] Error cargando experiencias remotas:', err);
      });
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

  readonly mobileMenuOpen = signal(false);

  private readonly slug = toSignal(
    this.route.paramMap.pipe(
      map(
        (params) =>
          params.get('slug') ?? (this.route.snapshot.data?.['slug'] as string) ?? '',
      ),
    ),
    {
      initialValue:
        this.route.snapshot.paramMap.get('slug') ??
        (this.route.snapshot.data?.['slug'] as string) ??
        '',
    },
  );

  readonly exp = computed(() => {
    const s = this.slug();
    if (!s) return undefined;
    return this.experienceService.getPublishedExperienceBySlug(s);
  });

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const e = this.exp();
    return [
      { label: 'Inicio', url: '/' },
      { label: 'Experiencias', url: '/experiencias' },
      { label: e?.shortTitle || e?.title || 'Detalle' },
    ];
  });

  readonly paymentRoute = computed(() => {
    const e = this.exp();
    return e ? `/experiencias/${e.slug}/pago` : '/experiencias';
  });

  isUrl(value?: string): boolean {
    if (!value) return false;
    return /^https?:\/\//i.test(value.trim());
  }

  private isValidGoogleMapsUrl(url: string): boolean {
    if (!/^https?:\/\//i.test(url)) return false;
    try {
      const parsed = new URL(url);
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

  getGoogleMapsUrl(meetingPoint?: string, region?: string, meetingPointUrl?: string): string {
    const explicitUrl = meetingPointUrl?.trim();
    if (explicitUrl && this.isValidGoogleMapsUrl(explicitUrl)) {
      return explicitUrl;
    }
    if (!meetingPoint) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        region ? region + ', Catamarca' : 'Catamarca',
      )}`;
    }
    const trimmed = meetingPoint.trim();
    if (this.isValidGoogleMapsUrl(trimmed)) {
      return trimmed;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      trimmed + (region ? ', ' + region : ', Catamarca'),
    )}`;
  }

  hasAlbumPhotos(item?: { albumPhotos?: any[] } | null): boolean {
    if (!item || !Array.isArray(item.albumPhotos)) return false;
    return item.albumPhotos.some((p) => !p.isCover) || item.albumPhotos.length > 1;
  }

  readonly upcomingDates = computed<string[]>(() => {
    const e = this.exp();
    if (!e || !e.dates) return [];
    const today = new Date().toISOString().split('T')[0];
    return e.dates.filter((d) => d >= today).sort();
  });

  readonly whatsAppInquiryUrl = computed(() => {
    const e = this.exp();
    const phone = e?.providerPhone || DEFAULT_CLUB_PROFILE.phone;
    const cleanPhone = (phone || '5493834567890').replace(/\D/g, '') || '5493834567890';
    const title = e?.title || 'Experiencia';
    const text = encodeURIComponent(
      `Hola! Quisiera consultar por próximas fechas y disponibilidad para la experiencia: "${title}".`,
    );
    return `https://wa.me/${cleanPhone}?text=${text}`;
  });

  readonly shareCopied = signal(false);
  private shareTimeout: any = null;

  async shareExperience(item?: any): Promise<void> {
    if (!item) return;
    const url =
      typeof window !== 'undefined'
        ? window.location.href
        : `https://experiencias.club/experiencias/${item.slug}`;
    const shareData = {
      title: `${item.title} | Club de Experiencias`,
      text: item.tagline || `Descubrí "${item.title}" en el Club de Experiencias de Catamarca.`,
      url,
    };

    const isMobile =
      typeof window !== 'undefined' &&
      (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches));

    if (
      isMobile &&
      typeof navigator !== 'undefined' &&
      navigator.share &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare(shareData)
    ) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      this.shareCopied.set(true);
      if (this.shareTimeout) clearTimeout(this.shareTimeout);
      this.shareTimeout = setTimeout(() => {
        this.shareCopied.set(false);
      }, 2500);
    } catch {
      // Ignorar fallback error
    }
  }

  readonly itinerarySteps = computed<{ time: string; title: string; description: string }[]>(() => {
    const e = this.exp();
    if (!e) return [];

    if (e.slug === 'campo-de-piedra-pomez') {
      return [
        {
          time: '08:30 hs',
          title: 'Punto de Encuentro & Partida 4x4',
          description:
            'Recepción en la Plaza Principal de El Peñón. Chequeo de equipamiento, hidratación y partida en vehículos 4x4 hacia la alta cordillera.',
        },
        {
          time: '10:30 hs',
          title: 'Laguna Blanca & Reserva de Biosfera',
          description:
            'Travesía por la estepa altoandina con avistaje de vicuñas silvestres y parada técnica de aclimatación a más de 3.000 msnm.',
        },
        {
          time: '13:00 hs',
          title: 'Ingreso al Campo de Piedra Pómez',
          description:
            'Caminata guiada e interpretación geomorfológica entre las gigantescas formaciones esculpidas de piedra pómez y médanos blancos.',
        },
        {
          time: '16:30 hs',
          title: 'Merienda de Altura & Regreso',
          description:
            'Pausa con productos regionales catamarqueños y regreso panorámico hacia el punto de partida en El Peñón.',
        },
      ];
    }

    if (e.slug === 'kayak') {
      return [
        {
          time: '15:30 hs',
          title: 'Recepción & Charla de Seguridad Lacustre',
          description:
            'Punto de encuentro en el Club Náutico Dique El Jumeal. Asignación de chalecos salvavidas, ajuste de remos ergonómicos y briefing de técnica básica de remada en aguas mansas.',
        },
        {
          time: '16:15 hs',
          title: 'Zarpada & Exploración de Bahías',
          description:
            'Navegación guiada ingresando por ensenadas y paredones de roca rojiza inaccesibles por tierra. Avistaje de fauna acuática y vegetación de yungas andinas.',
        },
        {
          time: '18:15 hs',
          title: 'Pausa Sunset en Bahía Tranquila',
          description:
            'Agrupamiento de embarcaciones en aguas calmas para contemplar la caída del sol reflejada en el dique y las Sierras de Ambato.',
        },
        {
          time: '19:00 hs',
          title: 'Desembarco & Brindis con Sabores Catamarqueños',
          description:
            'Regreso al club náutico, entrega de equipos y cierre gastronómico con degustación de productos artesanales locales.',
        },
      ];
    }

    if (e.itinerary && e.itinerary.trim()) {
      const lines = e.itinerary
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length > 0) {
        return lines.map((line, idx) => {
          const matchTime = line.match(/^(\d{1,2}:\d{2}(?:\s*hs)?)(?:\s*[-–:]\s*|\s+)(.*)$/i);
          if (matchTime) {
            const time = matchTime[1];
            const rest = matchTime[2];
            const parts = rest.split(/\s+[-–]\s+|\s*:\s+/);
            const title = parts[0] || `Etapa ${idx + 1}`;
            const description = parts.slice(1).join(' - ') || parts[0];
            return { time, title, description };
          }
          const parts = line.split(/\s+[-–]\s+|\s*:\s+/);
          if (parts.length > 1) {
            return {
              time: `Etapa ${idx + 1}`,
              title: parts[0],
              description: parts.slice(1).join(' - '),
            };
          }
          return {
            time: `Etapa ${idx + 1}`,
            title: `Actividad ${idx + 1}`,
            description: line,
          };
        });
      }
    }

    return [
      {
        time: 'Punto de Inicio',
        title: 'Recepción & Charla Técnica de Seguridad',
        description:
          'Encuentro en el punto fijado con los guías locales, verificación de indumentaria y briefing sobre el recorrido y protocolos de la zona.',
      },
      {
        time: 'Media Jornada',
        title: 'Desarrollo de la Travesía & Exploración Guiada',
        description:
          'Avance a ritmo cuidado con paradas interpretativas de flora, fauna y geología local, optimizando las mejores condiciones de luz para fotografía.',
      },
      {
        time: 'Cierre',
        title: 'Desconcentración & Momento Compartido',
        description:
          'Finalización del recorrido, retorno seguro y espacio para compartir impresiones y refrigerio con productos catamarqueños.',
      },
    ];
  });

  toggleMobileMenu(event: Event): void {
    event.stopPropagation();
    this.mobileMenuOpen.update((v) => !v);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.mobileMenuOpen.set(false);
  }
}
