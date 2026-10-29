import { Component, EventEmitter, HostListener, Output, inject, model, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../../core/services/newsletter.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  readonly newsletter = inject(NewsletterService);
  private readonly router = inject(Router);

  readonly mobileMenuOpen = model<boolean>(false);
  readonly logoutModalOpen = signal<boolean>(false);
  @Output() loginClick = new EventEmitter<void>();

  toggleMobileMenu(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.mobileMenuOpen.update(v => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  onLoginClick(): void {
    this.closeMobileMenu();
    this.router.navigate(['/ingresar']);
  }

  openLogoutModal(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.closeMobileMenu();
    this.logoutModalOpen.set(true);
  }

  closeLogoutModal(): void {
    this.logoutModalOpen.set(false);
  }

  confirmLogout(): void {
    this.logoutModalOpen.set(false);
    this.closeMobileMenu();
    this.newsletter.resetCurrentSubscription();
    if (this.router.url.startsWith('/perfil')) {
      this.router.navigate(['/']);
    }
  }

  logout(): void {
    this.openLogoutModal();
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.logoutModalOpen()) {
      this.closeLogoutModal();
    }
  }
}
