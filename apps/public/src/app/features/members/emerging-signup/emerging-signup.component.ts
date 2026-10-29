import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
export class EmergingSignupComponent implements OnInit {
  readonly newsletter = inject(NewsletterService);
  readonly router = inject(Router);
  readonly route = inject(ActivatedRoute);

  readonly mobileMenuOpen = signal(false);
  readonly fullName = signal('');
  readonly email = signal('');
  readonly documentNumber = signal('');
  readonly phone = signal('');
  readonly selectedExperiences = signal<string[]>([]);
  readonly otherExperience = signal('');
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
    { id: 'termas', title: 'Termas de Fiambalá y valles secretos' },
    { id: 'otros', title: 'Otros (especificar a continuacion)' },
  ];

  readonly showSuccessNotification = signal(false);

  ngOnInit(): void {
    // Autocompletar correo desde query params, prospecto de waitlist o sesión actual
    this.route.queryParams.subscribe((params) => {
      const paramEmail = ((params['email'] as string) || '').trim().toLowerCase();
      if (paramEmail) {
        this.email.set(paramEmail);
      } else if (this.newsletter.lastProspectEmail()) {
        this.email.set(this.newsletter.lastProspectEmail());
      } else if (this.newsletter.currentMember()?.email) {
        this.email.set(this.newsletter.currentMember()!.email);
      }

      // Activar verde en el breadcrumb y en el botón de iniciar sesión cuando viene con email de waitlist
      if (paramEmail || params['from'] === 'waitlist') {
        this.showSuccessNotification.set(true);
        this.newsletter.profileSuccessHighlight.set(true);
        setTimeout(() => {
          this.showSuccessNotification.set(false);
          this.newsletter.profileSuccessHighlight.set(false);
        }, 3500);
      }
    });

    const current = this.newsletter.currentMember();
    if (current) {
      if (current.fullName && !this.fullName()) this.fullName.set(current.fullName);
      if (current.dni && !this.documentNumber()) this.documentNumber.set(current.dni);
      if (current.phone && !this.phone()) this.phone.set(current.phone);
      if (
        current.experiencesWishlist &&
        current.experiencesWishlist.length > 0 &&
        this.selectedExperiences().length === 0
      ) {
        this.selectedExperiences.set(current.experiencesWishlist);
      }
      if (current.experiencesOther && !this.otherExperience()) {
        this.otherExperience.set(current.experiencesOther);
        if (!this.selectedExperiences().includes('otros')) {
          this.selectedExperiences.update((list) => [...list, 'otros']);
        }
      }
    }
  }

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
    const dni = this.documentNumber().replace(/\D/g, '').slice(0, 9);
    const phone = this.phone().trim().slice(0, 25);

    if (!name) {
      this.submitError.set('Ingresá tu nombre y apellido.');
      return;
    }

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      this.submitError.set('Ingresá un correo electrónico válido.');
      return;
    }

    if (!dni || dni.length < 7 || dni.length > 9) {
      this.submitError.set('El DNI es obligatorio y debe contener entre 7 y 9 números.');
      return;
    }

    if (!phone) {
      this.submitError.set('El número de celular es obligatorio.');
      return;
    }

    const otherText = this.isSelected('otros') ? this.otherExperience().trim() : undefined;

    const result = await this.newsletter.registerSocio({
      fullName: name,
      email: cleanEmail,
      dni,
      phone,
      experiencesWishlist: this.selectedExperiences(),
      experiencesOther: otherText,
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
