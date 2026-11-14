import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../core/services/newsletter.service';
import { ExperienceService } from '../../core/services/experience.service';
import { Experience } from '../../core/models/experience.model';
import { WaitlistEntry } from '../../core/models/waitlist.model';
import { ModalType } from '../waitlist/waitlist.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../shared/components/breadcrumb/breadcrumb.component';
import { FounderAdComponent } from '../../shared/components/founder-ad/founder-ad.component';

@Component({
  selector: 'app-providers',
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
  templateUrl: './providers.component.html',
  styleUrl: './providers.component.css',
})
export class ProvidersComponent implements OnInit {
  readonly newsletter = inject(NewsletterService);
  readonly experienceService = inject(ExperienceService);
  readonly router = inject(Router);

  readonly bg = signal('/assets/images/laguna_blanca.jpg');

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Experiencias', url: '/experiencias' },
    { label: 'Prestadores & Guías' },
  ];

  // Menús de navegación idénticos a los de /perfil y /
  readonly mobileMenuOpen = signal(false);
  readonly profileMenuOpen = signal(false);

  // Modales interactivos para navegación compartida
  readonly activeModal = signal<ModalType>(null);
  readonly selectedExperience = signal<Experience | null>(null);

  // Cuenta de socio vinculada con Google
  readonly authenticatedMember = signal<WaitlistEntry | null>(null);
  readonly requiresGoogle = computed(() => !this.authenticatedMember());
  readonly authError = signal<string | null>(null);

  // Formulario de Postulación de Prestadores
  readonly providerAgency = signal('');
  readonly providerName = signal('');
  readonly providerEmail = signal('');
  readonly providerPhone = signal('');
  readonly providerWebsite = signal('');
  readonly providerCategory = signal('guia_montaña');
  readonly providerCustomCategory = signal('');
  readonly providerRegion = signal('');
  readonly providerDescription = signal('');
  readonly providerSuccess = signal(false);
  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const member = await this.newsletter.getAuthenticatedMember();
      if (member) {
        this.authenticatedMember.set(member);
        this.providerEmail.set(member.email);
        this.providerName.set(member.fullName || member.email.split('@')[0]);
        if (member.phone) {
          this.providerPhone.set(member.phone);
        }
      }
    } catch {
      // non-blocking
    }
  }

  async linkGoogleAccount(): Promise<void> {
    this.authError.set(null);
    const currentPath = '/prestadores';
    this.newsletter.saveAuthReturnUrl(currentPath);
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}${currentPath}`
        : undefined;

    const result = await this.newsletter.signInWithGoogle(redirectTo);
    if (!result.success) {
      this.authError.set(result.message);
    } else {
      const member = await this.newsletter.getAuthenticatedMember();
      if (member) {
        this.authenticatedMember.set(member);
        this.providerEmail.set(member.email);
        this.providerName.set(member.fullName || member.email.split('@')[0]);
        if (member.phone) {
          this.providerPhone.set(member.phone);
        }
      }
    }
  }

  selectCategory(category: string): void {
    this.providerCategory.set(category);
    const formElement = document.getElementById('registro-form');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

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

  async submitProvider(): Promise<void> {
    if (
      !this.providerAgency().trim() ||
      !this.providerEmail().trim() ||
      (this.providerCategory() === 'otro' && !this.providerCustomCategory().trim())
    ) {
      return;
    }
    const finalCategory =
      this.providerCategory() === 'otro'
        ? this.providerCustomCategory().trim() || 'Otro'
        : this.providerCategory();

    this.isSubmitting.set(true);
    this.submitError.set(null);

    const resolvedName =
      this.authenticatedMember()?.fullName?.trim() ||
      this.providerName().trim() ||
      this.providerEmail().split('@')[0];

    const result = await this.newsletter.submitProviderApplication({
      fullName: resolvedName,
      agency: this.providerAgency().trim(),
      category: finalCategory,
      region: this.providerRegion(),
      email: this.providerEmail(),
      phone: this.providerPhone(),
      website: this.providerWebsite(),
      description: this.providerDescription(),
    });

    this.isSubmitting.set(false);
    if (result.success) {
      this.providerSuccess.set(true);
    } else {
      this.submitError.set(
        result.message ||
          'El sistema no pudo registrar la postulación en este momento por un inconveniente técnico de recepción. Por favor intentá nuevamente.',
      );
    }
  }

  resetForm(): void {
    this.providerAgency.set('');
    this.providerWebsite.set('');
    this.providerCategory.set('guia_montaña');
    this.providerCustomCategory.set('');
    this.providerRegion.set('');
    this.providerDescription.set('');
    this.providerSuccess.set(false);
    this.submitError.set(null);
    this.isSubmitting.set(false);
  }

  goToHomeSubscribe(): void {
    this.closeModal();
    this.router.navigate(['/']);
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
