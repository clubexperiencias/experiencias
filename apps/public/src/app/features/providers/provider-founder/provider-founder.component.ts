import { Component, HostListener, inject, signal } from '@angular/core';
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
import { FounderAdComponent } from '../../../shared/components/founder-ad/founder-ad.component';
import { ProviderTiersComponent } from '../../../shared/components/provider-tiers/provider-tiers.component';

@Component({
  selector: 'app-provider-founder',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatIconModule,
    FooterComponent,
    HeaderComponent,
    BreadcrumbComponent,
    FounderAdComponent,
    ProviderTiersComponent,
  ],
  templateUrl: './provider-founder.component.html',
  styleUrl: './provider-founder.component.css',
})
export class ProviderFounderComponent {
  readonly newsletter = inject(NewsletterService);
  readonly router = inject(Router);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Prestadores', url: '/prestadores' },
    { label: 'NIVEL 3: FUNDADORES' },
  ];

  readonly mobileMenuOpen = signal(false);

  // Formulario Carta de Postulación Institucional
  readonly agencyName = signal('');
  readonly contactName = signal('');
  readonly email = signal('');
  readonly phone = signal('');
  readonly trajectory = signal('');
  readonly founderAgreedToPrice = signal(false);
  readonly applicationSuccess = signal(false);
  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly highlights = [
    {
      title: 'Distinción Pionera',
      description: 'El más alto reconocimiento para guías y empresas de referencia andina.',
    },
    {
      title: 'Aporte Único Vitalicio',
      description: 'Aporte patrimonial de $10.000.000 ARS evaluado por el Comité del Club.',
    },
    {
      title: 'Presencia Institucional',
      description: 'Máxima visibilidad en portada oficial, coberturas y campañas del Club.',
    },
  ];

  async submitApplication(): Promise<void> {
    if (
      this.isSubmitting() ||
      !this.contactName().trim() ||
      !this.agencyName().trim() ||
      !this.email().trim() ||
      !this.phone().trim() ||
      !this.trajectory().trim() ||
      !this.founderAgreedToPrice()
    ) {
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);

    try {
      const result = await this.newsletter.submitProviderApplication({
        fullName: this.contactName().trim(),
        agency: this.agencyName().trim(),
        category: 'fundador',
        region: 'Catamarca',
        email: this.email().trim(),
        phone: this.phone().trim(),
        website: '',
        description: this.trajectory().trim(),
      });

      if (result?.success) {
        await this.newsletter.submitFounderApplication({
          fullName: this.contactName().trim(),
          email: this.email().trim(),
          phone: this.phone().trim(),
          motivationLetter: `${this.agencyName().trim()} - ${this.trajectory().trim()}`,
          agreedToProtocol: this.founderAgreedToPrice(),
        });
        this.applicationSuccess.set(true);
      } else {
        this.submitError.set(
          result?.message ||
            'El sistema no pudo registrar la postulación en este momento. Por favor intentá nuevamente.',
        );
      }
    } catch (err: any) {
      this.submitError.set(
        err?.message ||
          'Ocurrió un error inesperado al enviar la postulación. Por favor intentá nuevamente.',
      );
    } finally {
      this.isSubmitting.set(false);
    }
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
