import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../../../core/services/newsletter.service';
import { FooterComponent } from '../../../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../shared/components/breadcrumb/breadcrumb.component';
import { FounderAdComponent } from '../../../../shared/components/founder-ad/founder-ad.component';

export interface ProviderReply {
  responderName: string;
  badge: string;
  date: string;
  message: string;
}

export interface UserReview {
  id: string;
  userName: string;
  userLocation: string;
  userTier: string;
  verifiedBooking: boolean;
  activityDate: string;
  rating: number;
  date: string;
  title: string;
  comment: string;
  providerReply?: ProviderReply;
}

export type ReviewFilter = 'all' | 'with-reply' | '5-stars' | '4-stars';

@Component({
  selector: 'app-kayak-ratings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    FooterComponent,
    FounderAdComponent,
    HeaderComponent,
    BreadcrumbComponent,
  ],
  templateUrl: './kayak-ratings.component.html',
  styleUrl: './kayak-ratings.component.css',
})
export class KayakRatingsComponent {
  readonly newsletter = inject(NewsletterService);
  readonly router = inject(Router);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Experiencias', url: '/experiencias' },
    { label: 'Travesía en Kayak', url: '/experiencias/kayak' },
    { label: 'Calificaciones y Reseñas' },
  ];

  readonly mobileMenuOpen = signal(false);
  readonly activeFilter = signal<ReviewFilter>('all');
  readonly showNewReviewForm = signal(false);
  readonly reviewSubmitted = signal(false);

  // Form State
  newRating = signal(5);
  ratingNature = signal(5);
  ratingEquipment = signal(5);
  ratingGuides = signal(5);
  newTitle = signal('');
  newComment = signal('');

  readonly memberProfileName = computed(
    () => this.newsletter.currentMember()?.fullName?.trim() || '',
  );
  readonly memberProfileLocation = computed(
    () => 'Catamarca, Argentina',
  );
  readonly hasProfileCompleted = computed(
    () => !!this.memberProfileName(),
  );

  readonly reviewsList = signal<UserReview[]>([
    {
      id: 'rev_1',
      userName: 'Valentina Morán',
      userLocation: 'Córdoba, Argentina',
      userTier: 'Socio Pleno #143',
      verifiedBooking: true,
      activityDate: 'Marzo 2026',
      rating: 5,
      date: '14 de Marzo, 2026',
      title: 'Una experiencia única, el atardecer en Las Pirquitas es surreal',
      comment:
        'Hicimos la remada con mi pareja el sábado al atardecer. Los kayaks son comodísimos y súper estables, no nos mojamos nada salvo las manos al remar. El momento de la pausa sunset cuando el sol cae sobre las Sierras de Ambato te deja sin palabras. La picada de quesos de cabra y vino catamarqueño al final fue el broche de oro.',
      providerReply: {
        responderName: 'Lucas Nieto • Guía Náutico & Prestador Habilitado',
        badge: 'Prestador Oficial Habilitado',
        date: '15 de Marzo, 2026',
        message:
          '¡Muchas gracias Valentina! Un placer enorme recibirlos en Las Pirquitas. El atardecer de marzo estuvo especialmente calmo y con una luz dorada increíble. Nos alegra mucho que hayan disfrutado tanto los kayaks como la degustación de productores locales de Fray Mamerto Esquiú. ¡Los esperamos en la próxima expedición andina!',
      },
    },
    {
      id: 'rev_3',
      userName: 'Dra. Camila Albarracín',
      userLocation: 'Buenos Aires',
      userTier: 'Socio Emergente #89',
      verifiedBooking: true,
      activityDate: 'Enero 2026',
      rating: 5,
      date: '18 de Enero, 2026',
      title: 'Paz absoluta y rincones inaccesibles por tierra',
      comment:
        'Navegar entre las quebradas del dique donde no llega ningún camino de tierra te conecta de lleno con el silencio de la naturaleza. Avistamos garzas y fauna autóctona. Totalmente recomendable.',
      providerReply: {
        responderName: 'Lucas Nieto • Guía Náutico & Prestador Habilitado',
        badge: 'Prestador Oficial Habilitado',
        date: '19 de Enero, 2026',
        message:
          '¡Qué alegría leerte Camila! Esas bahías protegidas son el gran secreto del dique. Cuidar ese silencio y el impacto ambiental es nuestro mayor compromiso. ¡Bienvenida siempre a Catamarca!',
      },
    },
    {
      id: 'rev_4',
      userName: 'Esteban Carrizo',
      userLocation: 'Catamarca Capital',
      userTier: 'Socio Pleno #312',
      verifiedBooking: true,
      activityDate: 'Enero 2026',
      rating: 5,
      date: '08 de Enero, 2026',
      title: 'Orgullo de nuestra provincia, nivel internacional',
      comment:
        'Siendo catamarqueño hacía años que no disfrutaba del dique de esta manera. La coordinación, el cuidado del ecosistema y los sabores de nuestra tierra hicieron que fuera un paseo de primer nivel.',
      providerReply: {
        responderName: 'Comité de Prestadores • Experiencias.club',
        badge: 'Prestador Oficial Habilitado',
        date: '09 de Enero, 2026',
        message:
          '¡Muchísimas gracias Esteban! El apoyo de los socios locales es el corazón de este proyecto. Revalorizar el patrimonio lacustre y andino junto a nuestra gente es lo que nos impulsa día a día.',
      },
    },
    {
      id: 'rev_5',
      userName: 'Mariana Soria',
      userLocation: 'Rosario, Santa Fe',
      userTier: 'Socio Pleno #205',
      verifiedBooking: true,
      activityDate: 'Diciembre 2025',
      rating: 4,
      date: '28 de Diciembre, 2025',
      title: 'Hermoso atardecer y gran equipo humano',
      comment:
        'Todo excelente. El agua estaba súper calma y el grupo fue muy amigable. Como única sugerencia, estaría bueno sumar alguna opción sin tacc o vegana en la picada de cierre para quienes tenemos restricciones alimentarias.',
      providerReply: {
        responderName: 'Lucas Nieto • Guía Náutico & Prestador Habilitado',
        badge: 'Prestador Oficial Habilitado',
        date: '29 de Diciembre, 2025',
        message:
          '¡Excelente sugerencia Mariana! Ya incorporamos opciones celíacas y veganas certificadas de productores locales en todas las picadas de cierre informándolo al momento de la reserva. ¡Agradecemos enormemente tu aporte para seguir mejorando!',
      },
    },
  ]);

  readonly filteredReviews = () => {
    const list = this.reviewsList();
    const filter = this.activeFilter();
    switch (filter) {
      case 'with-reply':
        return list.filter((r) => !!r.providerReply);
      case '5-stars':
        return list.filter((r) => r.rating === 5);
      case '4-stars':
        return list.filter((r) => r.rating === 4);
      case 'all':
      default:
        return list;
    }
  };

  toggleMobileMenu(event: Event): void {
    event.stopPropagation();
    this.mobileMenuOpen.update((v) => !v);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.mobileMenuOpen.set(false);
  }

  setFilter(filter: ReviewFilter): void {
    this.activeFilter.set(filter);
  }

  setRating(stars: number): void {
    this.newRating.set(stars);
  }

  setAspectRating(aspect: 'nature' | 'equipment' | 'guides', stars: number): void {
    if (aspect === 'nature') this.ratingNature.set(stars);
    if (aspect === 'equipment') this.ratingEquipment.set(stars);
    if (aspect === 'guides') this.ratingGuides.set(stars);
    const avg = Math.round(
      (this.ratingNature() + this.ratingEquipment() + this.ratingGuides()) / 3,
    );
    this.newRating.set(Math.max(1, Math.min(5, avg)));
  }

  submitReview(): void {
    if (!this.hasProfileCompleted() || !this.newTitle().trim() || !this.newComment().trim()) {
      return;
    }

    const name = this.memberProfileName();
    const loc = this.memberProfileLocation();
    const tier = this.newsletter.isSubscribed()
      ? this.newsletter.isMonthlyActive()
        ? 'Socio Pleno'
        : 'Socio Emergente'
      : 'Socio Emergente';

    const createdReview: UserReview = {
      id: 'rev_' + Date.now(),
      userName: name,
      userLocation: loc,
      userTier: tier,
      verifiedBooking: true,
      activityDate: 'Temporada 2026',
      rating: this.newRating(),
      date: 'Recientemente',
      title: this.newTitle().trim(),
      comment: this.newComment().trim(),
      providerReply: {
        responderName: 'Lucas Nieto • Guía Náutico & Prestador Habilitado',
        badge: 'Prestador Oficial Habilitado',
        date: 'En proceso de moderación',
        message: `¡Hola ${name}! Agradecemos profundamente tu reseña y el tiempo dedicado a compartir tu experiencia lacustre en Las Pirquitas. ¡Nos alegra contar con vos en el Club!`,
      },
    };

    this.reviewsList.update((prev) => [createdReview, ...prev]);
    this.reviewSubmitted.set(true);
    this.showNewReviewForm.set(false);

    // Reset inputs
    this.newTitle.set('');
    this.newComment.set('');
    this.ratingNature.set(5);
    this.ratingEquipment.set(5);
    this.ratingGuides.set(5);
    this.newRating.set(5);
  }
}
