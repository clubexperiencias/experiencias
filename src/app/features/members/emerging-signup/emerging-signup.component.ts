import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../../core/services/newsletter.service';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../shared/components/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-emerging-signup',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    FooterComponent,
    HeaderComponent,
    BreadcrumbComponent,
  ],
  templateUrl: './emerging-signup.component.html',
  styleUrl: './emerging-signup.component.css',
})
export class EmergingSignupComponent {
  readonly newsletter = inject(NewsletterService);
  readonly router = inject(Router);
  readonly mobileMenuOpen = signal(false);
  readonly fullName = signal('');
  readonly email = signal('');
  readonly nationality = signal('');
  readonly selectedExperiences = signal<string[]>([]);
  readonly notes = signal('');
  readonly submitError = signal<string | null>(null);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Niveles de Socio', url: '/socios' },
    { label: 'Socios Emergentes', url: '/socios/emergentes' },
    { label: 'Ingreso' },
  ];

  readonly experiences = [
    { id: 'kayak', title: 'Kayak y aguas calmas en diques andinos' },
    { id: 'pissis', title: 'Trekking Balcón del Pissis y lagunas' },
    { id: 'astroturismo', title: 'Astrofotografía y cielos de la Puna' },
    { id: 'termas', title: 'Termas de Fiambalá y valles secretos' },
  ];

  toggleExperience(id: string): void {
    const selected = this.selectedExperiences();
    this.selectedExperiences.set(
      selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id],
    );
  }

  isSelected(id: string): boolean {
    return this.selectedExperiences().includes(id);
  }

  async submit(): Promise<void> {
    this.submitError.set(null);
    const name = this.fullName().trim();
    const cleanEmail = this.email().trim().toLowerCase();

    if (!name || !cleanEmail) {
      this.submitError.set('Completá tu nombre y correo electrónico para crear tu cuenta.');
      return;
    }

    const result = await this.newsletter.joinWaitlist({
      email: cleanEmail,
      fullName: name,
      nationality: this.nationality().trim(),
      experiencesWishlist: this.selectedExperiences(),
      wishlistNotes: this.notes().trim(),
      bio: this.notes().trim(),
    });

    if (result.success) {
      await this.router.navigate(['/perfil']);
    } else {
      this.submitError.set(result.message);
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.mobileMenuOpen.set(false);
  }
}
