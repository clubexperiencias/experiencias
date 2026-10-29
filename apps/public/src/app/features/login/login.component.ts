import { Component, HostListener, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../core/services/newsletter.service';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../shared/components/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    FooterComponent,
    HeaderComponent,
    BreadcrumbComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  readonly newsletter = inject(NewsletterService);
  readonly router = inject(Router);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Iniciar Sesión' },
  ];

  readonly mobileMenuOpen = signal(false);
  readonly email = signal('');
  readonly error = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly notFoundEmail = signal<string | null>(null);

  ngOnInit(): void {
    if (this.newsletter.isSubscribed()) {
      this.router.navigate(['/perfil']);
    }
  }

  async signInGoogle(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    const res = await this.newsletter.signInWithGoogle();
    this.isLoading.set(false);
    if (!res.success) {
      this.error.set(res.message);
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
    const emailVal = this.email().trim().toLowerCase();
    if (!emailVal) {
      this.error.set('Por favor, ingresá tu correo electrónico.');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);
    this.successMessage.set(null);
    this.notFoundEmail.set(null);

    // Acceso Inmediato directo por correo
    try {
      const res = await this.newsletter.loginWithEmail(emailVal);
      this.isLoading.set(false);

      if (res.success && res.entry) {
        this.successMessage.set(res.message);
        setTimeout(() => {
          this.router.navigate(['/perfil']);
        }, 350);
      } else if (res.notFound) {
        this.notFoundEmail.set(emailVal);
        this.error.set(
          res.message ||
            'Guardamos tu correo en la lista de espera oficial. ¡Completá tus datos para ingresar como socio!',
        );
      } else {
        this.error.set(res.message || 'Ocurrió un error al verificar tu membresía.');
      }
    } catch {
      this.isLoading.set(false);
      this.error.set('Error de conexión con el servicio. Intentá nuevamente.');
    }
  }

  registerNowWithEmail(): void {
    const emailVal = (this.notFoundEmail() || this.email()).trim().toLowerCase();
    if (!emailVal) return;

    this.router.navigate(['/socios/emergentes/ingreso'], {
      queryParams: { email: emailVal, from: 'waitlist' },
    });
  }
}
