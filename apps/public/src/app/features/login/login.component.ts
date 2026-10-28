import { Component, HostListener, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../core/services/newsletter.service';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../../shared/components/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatIconModule, FooterComponent, HeaderComponent, BreadcrumbComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  readonly newsletter = inject(NewsletterService);
  readonly router = inject(Router);

  readonly bg = signal('/assets/images/laguna_blanca.jpg');

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Iniciar Sesión' }
  ];

  readonly mobileMenuOpen = signal(false);
  readonly email = signal('');
  readonly error = signal<string | null>(null);
  readonly isLoading = signal(false);

  ngOnInit(): void {
    if (this.newsletter.isSubscribed()) {
      this.router.navigate(['/perfil']);
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

  async submitLogin(): Promise<void> {
    const emailVal = this.email().trim();
    if (!emailVal) {
      this.error.set('Por favor, ingresá tu correo electrónico.');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      await this.newsletter.joinWaitlist({ email: emailVal });
      this.isLoading.set(false);
      this.router.navigate(['/perfil']);
    } catch {
      this.isLoading.set(false);
      this.error.set('Ocurrió un error al ingresar. Intentá nuevamente.');
    }
  }
}
