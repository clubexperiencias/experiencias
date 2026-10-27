import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../core/services/newsletter.service';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../../shared/components/breadcrumb/breadcrumb.component';

export type NotFoundModalType = 'login' | null;

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, FooterComponent, HeaderComponent, BreadcrumbComponent],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.css'
})
export class NotFoundComponent {
  readonly newsletter = inject(NewsletterService);
  readonly router = inject(Router);

  readonly bg = signal('/assets/images/laguna_blanca.jpg');

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Página no encontrada' }
  ];

  readonly mobileMenuOpen = signal(false);
  readonly activeModal = signal<NotFoundModalType>(null);
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

  openModal(modal: NotFoundModalType): void {
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
