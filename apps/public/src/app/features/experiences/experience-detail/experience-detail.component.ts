import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { ExperienceService } from '../../../core/services/experience.service';
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

  readonly mobileMenuOpen = signal(false);

  private readonly slug = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('slug') ?? '')),
    {
      initialValue: this.route.snapshot.paramMap.get('slug') ?? '',
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
