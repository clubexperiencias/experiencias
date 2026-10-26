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

export type ExperiencesModalType = 'login' | null;

@Component({
  selector: 'app-experiences',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, FooterComponent, HeaderComponent, BreadcrumbComponent],
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
