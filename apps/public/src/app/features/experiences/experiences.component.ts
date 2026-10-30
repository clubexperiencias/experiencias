import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../core/services/newsletter.service';
import { ExperienceService } from '../../core/services/experience.service';
import { Experience } from '../../core/models/experience.model';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../../shared/components/breadcrumb/breadcrumb.component';
import { FounderAdComponent } from '../../shared/components/founder-ad/founder-ad.component';

export type ExperiencesModalType = 'login' | null;

@Component({
  selector: 'app-experiences',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, FooterComponent, HeaderComponent, BreadcrumbComponent, FounderAdComponent],
  templateUrl: './experiences.component.html',
  styleUrl: './experiences.component.css'
})
export class ExperiencesComponent {
  readonly newsletter = inject(NewsletterService);
  readonly experienceService = inject(ExperienceService);
  readonly router = inject(Router);

  readonly bg = signal('/assets/images/laguna_blanca.jpg');

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Experiencias' }
  ];

  // Menús de navegación y estado de selección
  readonly mobileMenuOpen = signal(false);
  readonly selectedExperience = signal<Experience | null>(null);
  readonly activeModal = signal<ExperiencesModalType>(null);
  readonly loginEmail = signal('');
  readonly loginError = signal<string | null>(null);

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
    rating: 0,
    reviewsCount: 0,
    coverImage: '/assets/images/laguna_blanca.jpg',
    galleryImages: [],
    highlights: [],
    included: [],
    isExclusiveClub: true,
    isLocked: true,
  };

  readonly featuredExperiences = () => [
    ...this.experienceService.experiences().slice(0, 1),
    ...(this.experienceService.hasRemoteExperiences() ? [] : [this.comingSoonExperience]),
  ];
  readonly otherExperiences = () =>
    this.experienceService.hasRemoteExperiences()
      ? this.experienceService.experiences().slice(1)
      : [this.comingSoonExperience];

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
      this.selectedExperience.set(null);
    } else {
      this.selectedExperience.set(exp);
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
    this.selectedExperience.set(null);
    this.mobileMenuOpen.set(false);
  }

  submitLogin(): void {
    const email = this.loginEmail().trim();
    if (!email) return;

    if (this.newsletter.isSubscribed() && this.newsletter.currentMember()?.email.toLowerCase() === email.toLowerCase()) {
      this.closeModal();
      this.router.navigate(['/perfil']);
      return;
    }

    this.newsletter.joinWaitlist({ email }).then(() => {
      this.closeModal();
      this.router.navigate(['/perfil']);
    }).catch(() => {
      this.loginError.set('Ocurrió un error al ingresar. Intentá nuevamente.');
    });
  }

  logout(): void {
    this.newsletter.resetCurrentSubscription();
    this.mobileMenuOpen.set(false);
    this.router.navigate(['/']);
  }
}
