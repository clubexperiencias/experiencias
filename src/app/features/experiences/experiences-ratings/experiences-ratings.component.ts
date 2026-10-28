import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../../core/services/newsletter.service';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../shared/components/breadcrumb/breadcrumb.component';

export interface GlobalReview {
  id: string;
  userName: string;
  userLocation: string;
  userTier: string;
  verifiedBooking: boolean;
  experienceName: string;
  experienceSlug: string;
  experienceRoute: string;
  activityDate: string;
  rating: number;
  date: string;
  title: string;
  comment: string;
  providerReply?: {
    responderName: string;
    badge: string;
    date: string;
    message: string;
  };
}

export type GlobalReviewFilter = 'all' | 'kayak' | 'pomez' | 'seismiles' | 'with-reply' | '5-stars';

@Component({
  selector: 'app-experiences-ratings',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatIconModule,
    FooterComponent,
    HeaderComponent,
    BreadcrumbComponent,
  ],
  templateUrl: './experiences-ratings.component.html',
  styleUrl: './experiences-ratings.component.css',
})
export class ExperiencesRatingsComponent {
  readonly newsletter = inject(NewsletterService);
  readonly router = inject(Router);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Experiencias', url: '/experiencias' },
    { label: 'Calificaciones Verificadas' },
  ];

  readonly mobileMenuOpen = signal(false);
  readonly activeFilter = signal<GlobalReviewFilter>('all');
  readonly showNewReviewForm = signal(false);
  readonly reviewSubmitted = signal(false);

  // Form State
  newRating = signal(5);
  newExperience = signal('kayak');
  newTitle = signal('');
  newComment = signal('');
  newUserName = signal('');

  readonly memberProfileName = computed(
    () => this.newsletter.currentMember()?.fullName?.trim() || '',
  );
  readonly hasProfileName = computed(() => !!this.memberProfileName());

  readonly reviewsList = signal<GlobalReview[]>([
    {
      id: 'rev_kayak_1',
      userName: 'Martín S.',
      userLocation: 'Córdoba Capital',
      userTier: 'Socio Fundador #014',
      verifiedBooking: true,
      experienceName: 'Travesía en Kayak & Sunset en Las Pirquitas',
      experienceSlug: 'kayak',
      experienceRoute: '/experiencias/kayak',
      activityDate: '12 de Octubre, 2026',
      rating: 5,
      date: '14 de Octubre, 2026',
      title: 'Una experiencia transformadora en aguas calmas',
      comment:
        'El espejo de agua de Las Pirquitas con el atardecer cayendo sobre el cordón de Ambato es impresionante. Los kayaks son de travesía profesional, livianos y estables. Lucas, el guía, nos explicó la hidrografía de la cuenca y la picada regional con quesos de cabra fue el broche de oro.',
      providerReply: {
        responderName: 'Lucas Nieto',
        badge: 'Guía Náutico Homologado',
        date: '15 de Octubre, 2026',
        message:
          '¡Gracias Martín! Un orgullo remar juntos. Cuidamos cada detalle para que la navegación y el atardecer sean inolvidables.',
      },
    },
    {
      id: 'rev_pomez_1',
      userName: 'Florencia & Diego V.',
      userLocation: 'Rosario, Santa Fe',
      userTier: 'Socio Pleno Mensual',
      verifiedBooking: true,
      experienceName: 'Campo de Piedra Pómez & Duna Gigante',
      experienceSlug: 'pomez',
      experienceRoute: '/experiencias',
      activityDate: '28 de Septiembre, 2026',
      rating: 5,
      date: '1 de Octubre, 2026',
      title: 'Paisaje de otro planeta, logística impecable',
      comment:
        'Caminar entre las olas blancas de piedra pómez a más de 3.000 metros fue surrealista. La camioneta 4x4 súper confortable y el conocimiento geológico de Sergio nos abrió los ojos a un paisaje único en el planeta. La noche estrellada en la Puna no se compara con nada.',
      providerReply: {
        responderName: 'Sergio Albarracín',
        badge: 'Guía de Alta Montaña WFR',
        date: '2 de Octubre, 2026',
        message:
          '¡Abrazo grande Flor y Diego! El Campo de Piedra Pómez requiere respeto y amor por la montaña andina. Los esperamos para el cruce de Seismiles.',
      },
    },
    {
      id: 'rev_seismiles_1',
      userName: 'Gustavo Peralta',
      userLocation: 'San Miguel de Tucumán',
      userTier: 'Socio Fundador #029',
      verifiedBooking: true,
      experienceName: 'Ruta de los Seismiles & Laguna Verde',
      experienceSlug: 'seismiles',
      experienceRoute: '/experiencias',
      activityDate: '18 de Septiembre, 2026',
      rating: 5,
      date: '22 de Septiembre, 2026',
      title: 'La inmensidad de los Andes en su máxima expresión',
      comment:
        'Subir por la RN 60 hacia el Paso de San Francisco y ver los gigantes de 6.000 metros reflejados en las lagunas de altura te cambia la perspectiva. La seguridad médica, los oxímetros y la hidratación coordinada por el club fueron intachables.',
      providerReply: {
        responderName: 'Equipo de Operaciones Club',
        badge: 'Staff Oficial EXPERIENCIAS.CLUB',
        date: '23 de Septiembre, 2026',
        message:
          'Estimado Gustavo, la seguridad en altura es nuestra prioridad número uno. Nos alegra profundamente que hayas disfrutado de los Seismiles.',
      },
    },
    {
      id: 'rev_kayak_2',
      userName: 'Camila Rossi',
      userLocation: 'Buenos Aires',
      userTier: 'Socio Pleno Mensual',
      verifiedBooking: true,
      experienceName: 'Travesía en Kayak & Sunset en Las Pirquitas',
      experienceSlug: 'kayak',
      experienceRoute: '/experiencias/kayak',
      activityDate: '5 de Octubre, 2026',
      rating: 5,
      date: '6 de Octubre, 2026',
      title: 'Paz absoluta y trato ultra personalizado',
      comment:
        'Fui sola con dudas de si me costaría remar, pero los chalecos y la instrucción previa de 20 minutos te dan total confianza. El silencio cuando el sol toca la montaña es mágico.',
      providerReply: {
        responderName: 'Lucas Nieto',
        badge: 'Guía Náutico Homologado',
        date: '7 de Octubre, 2026',
        message:
          '¡Genia Camila! El kayak de travesía es accesible para todos cuando se navega con paciencia y en equipo.',
      },
    },
    {
      id: 'rev_pomez_2',
      userName: 'Ignacio M.',
      userLocation: 'Mendoza',
      userTier: 'Socio Emergente',
      verifiedBooking: true,
      experienceName: 'Campo de Piedra Pómez & Duna Gigante',
      experienceSlug: 'pomez',
      experienceRoute: '/experiencias',
      activityDate: '10 de Septiembre, 2026',
      rating: 5,
      date: '12 de Septiembre, 2026',
      title: 'La mejor experiencia de aventura del norte argentino',
      comment:
        'Manejo en arena volcánica impecable y la subida a la Duna Gigante te deja sin aliento. Un 10 rotundo en servicio y hospitalidad local.',
    },
  ]);

  filteredReviews(): GlobalReview[] {
    const filter = this.activeFilter();
    const list = this.reviewsList();

    switch (filter) {
      case 'kayak':
        return list.filter((r) => r.experienceSlug === 'kayak');
      case 'pomez':
        return list.filter((r) => r.experienceSlug === 'pomez');
      case 'seismiles':
        return list.filter((r) => r.experienceSlug === 'seismiles');
      case 'with-reply':
        return list.filter((r) => !!r.providerReply);
      case '5-stars':
        return list.filter((r) => r.rating === 5);
      default:
        return list;
    }
  }

  setFilter(filter: GlobalReviewFilter): void {
    this.activeFilter.set(filter);
  }

  toggleReviewForm(): void {
    this.showNewReviewForm.update((v) => !v);
  }

  submitReview(): void {
    const effectiveName = this.memberProfileName() || this.newUserName().trim();
    if (!effectiveName || !this.newTitle().trim() || !this.newComment().trim()) return;

    let expName = 'Travesía en Kayak & Sunset en Las Pirquitas';
    let expRoute = '/experiencias/kayak';
    if (this.newExperience() === 'pomez') {
      expName = 'Campo de Piedra Pómez & Duna Gigante';
      expRoute = '/experiencias';
    } else if (this.newExperience() === 'seismiles') {
      expName = 'Ruta de los Seismiles & Laguna Verde';
      expRoute = '/experiencias';
    }

    const current = this.newsletter.currentMember();
    const userTier = this.newsletter.isMonthlyActive()
      ? 'Socio Pleno Mensual'
      : current
        ? 'Socio Emergente'
        : 'Socio Verificado';

    const newRev: GlobalReview = {
      id: 'rev_' + Date.now(),
      userName: effectiveName,
      userLocation: current?.nationality ? current.nationality : 'Catamarca',
      userTier,
      verifiedBooking: true,
      experienceName: expName,
      experienceSlug: this.newExperience(),
      experienceRoute: expRoute,
      activityDate: 'Reciente',
      rating: this.newRating(),
      date: 'Hoy',
      title: this.newTitle().trim(),
      comment: this.newComment().trim(),
      providerReply: {
        responderName: 'Equipo de Calidad EXPERIENCIAS.CLUB',
        badge: 'Staff Oficial Homologado',
        date: 'Inmediata',
        message:
          '¡Muchas gracias por compartir tu experiencia con toda la comunidad del club! Valoramos enormemente tus palabras.',
      },
    };

    this.reviewsList.update((arr) => [newRev, ...arr]);
    this.reviewSubmitted.set(true);
    this.newTitle.set('');
    this.newComment.set('');
    this.showNewReviewForm.set(false);
  }

  toggleMobileMenu(event: Event): void {
    event.stopPropagation();
    this.mobileMenuOpen.update((v) => !v);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.mobileMenuOpen.set(false);
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.mobileMenuOpen.set(false);
  }
}
