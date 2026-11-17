import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../../core/services/newsletter.service';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../shared/components/breadcrumb/breadcrumb.component';
import { FounderAdComponent } from '../../../shared/components/founder-ad/founder-ad.component';
import { ProviderTiersComponent } from '../../../shared/components/provider-tiers/provider-tiers.component';

@Component({
  selector: 'app-provider-pleno',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatIconModule,
    FooterComponent,
    HeaderComponent,
    BreadcrumbComponent,
    FounderAdComponent,
    ProviderTiersComponent,
  ],
  templateUrl: './provider-pleno.component.html',
  styleUrl: './provider-pleno.component.css',
})
export class ProviderPlenoComponent {
  readonly newsletter = inject(NewsletterService);
  readonly router = inject(Router);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Prestadores', url: '/prestadores' },
    { label: 'NIVEL 2: PLENOS' },
  ];

  readonly mobileMenuOpen = signal(false);

  readonly highlights = [
    {
      title: 'Salidas Verificadas',
      description: 'Publicación oficial en el catálogo tras la validación de seguridad.',
    },
    {
      title: 'Destaque Prioritario',
      description: 'Mayor visibilidad y recomendaciones directas a socios emergentes y plenos.',
    },
    {
      title: 'Reputación Oficial',
      description: 'Calificaciones, reseñas y confianza directa de la comunidad de socios.',
    },
  ];

  // Estado de usuario y Google
  readonly currentMember = computed(() => this.newsletter.currentMember());
  readonly authenticatedEmail = computed(() => this.currentMember()?.email || '');
  readonly requiresGoogle = computed(() => !this.authenticatedEmail());
  readonly authError = signal<string | null>(null);

  // Formulario de Solicitud de Prestador Pleno
  readonly fullName = signal('');
  readonly agency = signal('');
  readonly email = signal('');
  readonly phone = signal('');
  readonly invitationCode = signal('');
  readonly codeValid = signal(false);
  readonly codeError = signal<string | null>(null);
  readonly isSubmitting = signal(false);
  readonly submitted = signal(false);

  constructor() {
    effect(() => {
      const member = this.currentMember();
      if (member) {
        if (member.fullName && !this.fullName()) this.fullName.set(member.fullName);
        if (member.email && !this.email()) this.email.set(member.email);
        if (member.phone && !this.phone()) this.phone.set(member.phone);
      }
    });
  }

  async linkGoogleAccount(): Promise<void> {
    try {
      this.authError.set(null);
      await this.newsletter.signInWithGoogle(window.location.href);
    } catch {
      this.authError.set('No pudimos iniciar sesión con Google. Intentá nuevamente.');
    }
  }

  applyCode(): void {
    const code = this.invitationCode().trim().toUpperCase();
    if (!code) {
      this.codeError.set('Ingresá un código de invitación.');
      this.codeValid.set(false);
      return;
    }
    // Acepta códigos de prueba o de invitación del Club
    if (code === 'PLENO2027' || code === 'INVITACION' || code === 'FUNDADOR' || code.length >= 5) {
      this.codeValid.set(true);
      this.codeError.set(null);
    } else {
      this.codeError.set('Código de invitación no válido o expirado.');
      this.codeValid.set(false);
    }
  }

  submitPleno(): void {
    if (!this.fullName().trim() || !this.agency().trim() || !this.email().trim() || !this.phone().trim()) {
      return;
    }
    this.isSubmitting.set(true);
    setTimeout(() => {
      this.isSubmitting.set(false);
      this.submitted.set(true);
    }, 600);
  }

  toggleMobileMenu(event: Event): void {
    event.stopPropagation();
    this.mobileMenuOpen.update((v) => !v);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.mobileMenuOpen.set(false);
  }
}
