import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../core/services/newsletter.service';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../shared/components/breadcrumb/breadcrumb.component';
import { KayakAdComponent } from '../../shared/components/kayak-ad/kayak-ad.component';

export type MembersModalType = 'login' | 'payments' | null;

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    FooterComponent,
    HeaderComponent,
    BreadcrumbComponent,
    KayakAdComponent,
  ],
  templateUrl: './members.component.html',
  styleUrl: './members.component.css',
})
export class MembersComponent {
  readonly newsletter = inject(NewsletterService);
  readonly router = inject(Router);

  readonly bg = signal('/assets/images/laguna_blanca.jpg');

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Niveles de Socio' },
  ];

  // Menús de navegación
  readonly mobileMenuOpen = signal(false);
  readonly activeModal = signal<MembersModalType>(null);
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

  openModal(modal: MembersModalType): void {
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
    this.mobileMenuOpen.set(false);
  }

  submitLogin(): void {
    const email = this.loginEmail().trim();
    if (!email) return;

    if (
      this.newsletter.isSubscribed() &&
      this.newsletter.currentMember()?.email.toLowerCase() === email.toLowerCase()
    ) {
      this.closeModal();
      this.router.navigate(['/perfil']);
      return;
    }

    this.newsletter
      .joinWaitlist({ email })
      .then(() => {
        this.closeModal();
        this.router.navigate(['/perfil']);
      })
      .catch(() => {
        this.loginError.set('Ocurrió un error al ingresar. Intentá nuevamente.');
      });
  }

  logout(): void {
    this.newsletter.resetCurrentSubscription();
    this.mobileMenuOpen.set(false);
    this.router.navigate(['/']);
  }
}
