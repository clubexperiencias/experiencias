import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../core/services/newsletter.service';
import { ExperienceService } from '../../core/services/experience.service';
import { Experience } from '../../core/models/experience.model';
import { ModalType } from '../waitlist/waitlist.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../../shared/components/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-providers',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, FooterComponent, HeaderComponent, BreadcrumbComponent],
  templateUrl: './providers.component.html',
  styleUrl: './providers.component.css'
})
export class ProvidersComponent {
  readonly newsletter = inject(NewsletterService);
  readonly experienceService = inject(ExperienceService);
  readonly router = inject(Router);

  readonly bg = signal('/assets/images/laguna_blanca.jpg');

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Experiencias', url: '/experiencias' },
    { label: 'Prestadores & Guías' }
  ];

  // Menús de navegación idénticos a los de /perfil y /
  readonly mobileMenuOpen = signal(false);
  readonly profileMenuOpen = signal(false);

  // Modales interactivos para navegación compartida
  readonly activeModal = signal<ModalType>(null);
  readonly selectedExperience = signal<Experience | null>(null);

  // Formulario de Postulación de Prestadores
  readonly providerName = signal('');
  readonly providerEmail = signal('');
  readonly providerPhone = signal('');
  readonly providerWebsite = signal('');
  readonly providerCategory = signal('guia_montaña');
  readonly providerRegion = signal('Puna & Fiambalá');
  readonly providerDescription = signal('');
  readonly providerSuccess = signal(false);

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
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.activeModal()) {
      this.closeModal();
    }
    this.profileMenuOpen.set(false);
    this.mobileMenuOpen.set(false);
  }

  submitProvider(): void {
    if (!this.providerEmail().trim() || !this.providerName().trim()) return;
    this.providerSuccess.set(true);
  }

  resetForm(): void {
    this.providerName.set('');
    this.providerEmail.set('');
    this.providerPhone.set('');
    this.providerWebsite.set('');
    this.providerDescription.set('');
    this.providerSuccess.set(false);
  }

  goToHomeSubscribe(): void {
    this.closeModal();
    this.router.navigate(['/']);
  }

  openMembershipPayment(tier?: string): void {
    this.closeModal();
    if (this.newsletter.isSubscribed()) {
      this.router.navigate(['/perfil'], { queryParams: { modal: 'payments' } });
    } else {
      this.router.navigate(['/'], { queryParams: { modal: 'payments' } });
    }
  }

  openFounderApplication(): void {
    this.closeModal();
    this.router.navigate(['/'], { queryParams: { modal: 'founder_application' } });
  }

  logout(): void {
    this.newsletter.resetCurrentSubscription();
    this.profileMenuOpen.set(false);
    this.mobileMenuOpen.set(false);
    this.router.navigate(['/']);
  }
}
