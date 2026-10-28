import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../../core/services/newsletter.service';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../shared/components/breadcrumb/breadcrumb.component';
import { FounderAdComponent } from '../../../shared/components/founder-ad/founder-ad.component';

export interface EmergingBenefit {
  title: string;
  description: string;
}

@Component({
  selector: 'app-emerging-member',
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
  templateUrl: './emerging-member.component.html',
  styleUrl: './emerging-member.component.css',
})
export class EmergingMemberComponent {
  readonly newsletter = inject(NewsletterService);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Niveles de Socio', url: '/socios' },
    { label: 'Socios Emergentes' },
  ];

  readonly mobileMenuOpen = signal(false);

  readonly benefits: EmergingBenefit[] = [
    {
      title: 'Acceso anticipado a preventas',
      description:
        'Prioridad de reserva en expediciones privadas y aperturas de temporada 24 horas antes que el público general.',
    },
    {
      title: 'Lugar reservado en lista de espera',
      description:
        'Asignación de número oficial en el registro de Catamarca para ordenar la disponibilidad de cupos.',
    },
    {
      title: 'Bitácoras y novedades de ruta',
      description:
        'Informes técnicos sobre clima, nivel de los embalses y recomendaciones exclusivas de baqueanos locales.',
    },
    {
      title: 'Perfil personal de socio',
      description:
        'Panel digital exclusivo para consultar tu acreditación, historial de travesías y nivel de actividad.',
    },
  ];

  toggleMobileMenu(event: Event): void {
    event.stopPropagation();
    this.mobileMenuOpen.update((v) => !v);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.mobileMenuOpen.set(false);
  }
}
