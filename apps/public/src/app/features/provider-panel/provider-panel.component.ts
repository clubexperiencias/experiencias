import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ProviderStoreService } from '../../core/services/provider-store.service';
import { ProviderLoginComponent } from './provider-login/provider-login.component';

@Component({
  selector: 'app-provider-panel',
  standalone: true,
  imports: [RouterOutlet, RouterLink, MatIconModule, ProviderLoginComponent],
  template: `
    <div class="provider-portal-root">
      <!-- Domain indicator strip con estilo perfil / azul #80b3ff -->
      <div class="subdomain-strip">
        <div class="subdomain-content">
          <div class="subdomain-left">
            <span class="subdomain-host">prestadores.experiencias.club</span>
          </div>
          <div class="subdomain-right">
            <a
              href="https://experiencias.club"
              class="back-public-link"
              target="_blank"
              rel="noopener"
              title="Ir a experiencias.club"
            >
              <mat-icon>open_in_new</mat-icon>
              <span>Ir a experiencias.club</span>
            </a>
          </div>
        </div>
      </div>

      @if (!store.isAuthenticated()) {
        <!-- Login & Registro cuando no hay sesión activa -->
        <app-provider-login />
      } @else {
        <!-- Header oficial de Prestadores con logos provistos -->
        <header class="portal-header">
          <div class="header-inner">
            <div class="header-left">
              <a routerLink="/dashboard" class="portal-brand">
                <img
                  src="/assets/aistudio/logo-prestadores-experiencias_9372e925.png"
                  alt="Logo Prestadores Experiencias"
                  class="brand-emblem-img"
                  referrerpolicy="no-referrer"
                />
                <div class="brand-text">
                  <span class="brand-title">EXPERIENCIAS.CLUB</span>
                  <span class="brand-tag">PRESTADORES</span>
                </div>
              </a>
            </div>

            <!-- Menú de perfil -->
            <div class="header-right">
              <!-- Menú de Prestador activo -->
              <button
                type="button"
                class="user-pill"
                [class.is-open]="userMenuOpen()"
                (click)="toggleUserMenu()"
                aria-label="Menú de prestador"
                [attr.aria-expanded]="userMenuOpen()"
              >
                <mat-icon class="user-pill-icon">{{ userMenuOpen() ? 'close' : 'menu' }}</mat-icon>
                <div class="user-meta">
                  <strong class="user-name">{{ provider()?.name || 'Patricio Facundo' }}</strong>
                  <span class="user-agency">{{ provider()?.agency }}</span>
                </div>
              </button>

              @if (userMenuOpen()) {
                <div class="dropdown-menu enlarged-menu" (click)="$event.stopPropagation()">
                  <!-- Opciones de Navegación del Menú Agrandadas -->
                  <div class="dropdown-nav-list">
                    <a
                      routerLink="/dashboard"
                      class="dropdown-item enlarged-item"
                      (click)="userMenuOpen.set(false)"
                    >
                      <mat-icon class="menu-item-icon">dashboard</mat-icon>
                      <div class="menu-item-info">
                        <strong class="menu-item-title">Panel de Control</strong>
                      </div>
                    </a>

                    <a
                      routerLink="/experiencias"
                      class="dropdown-item enlarged-item"
                      (click)="userMenuOpen.set(false)"
                    >
                      <mat-icon class="menu-item-icon">hiking</mat-icon>
                      <div class="menu-item-info">
                        <strong class="menu-item-title">Mis Experiencias</strong>
                      </div>
                    </a>

                    <a
                      routerLink="/socios"
                      class="dropdown-item enlarged-item"
                      (click)="userMenuOpen.set(false)"
                    >
                      <mat-icon class="menu-item-icon">people</mat-icon>
                      <div class="menu-item-info">
                        <strong class="menu-item-title">Socios y Comprobantes</strong>
                      </div>
                    </a>
                  </div>

                  <div class="dropdown-divider"></div>

                  <button
                    type="button"
                    class="dropdown-item enlarged-item logout-item"
                    (click)="logout()"
                  >
                    <mat-icon class="menu-item-icon">logout</mat-icon>
                    <div class="menu-item-info">
                      <strong class="menu-item-title">Cerrar sesión</strong>
                    </div>
                  </button>
                </div>
              }
            </div>
          </div>
        </header>

        <!-- Contenedor principal con fondo relieve similar a /perfil -->
        <main class="portal-main">
          <div class="portal-content-container">
            <router-outlet />
          </div>

          <!-- Box de Asistencia y Soporte Técnico abajo de todo -->
          <section class="support-box" aria-label="Soporte y Asistencia Técnica">
            <div class="support-box-inner">
              <div class="support-text-col">
                <span class="support-kicker">MESA DE AYUDA & ASISTENCIA TÉCNICA</span>
                <p class="support-message">
                  Si tenés alguna duda o precisás asistencia técnica, mandá un mail a
                  <span class="support-email-text">ayuda&#64;experiencias.club</span> o directamente
                  <a
                    [href]="supportWhatsappUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="support-wa-link"
                    >escribinos a WhatsApp haciendo click aquí</a
                  >.
                </p>
              </div>
            </div>
          </section>
        </main>
      }

      <!-- Footer oficial con logo banner al medio -->
      <footer class="portal-footer">
        <div class="footer-inner">
          <div class="footer-center-logo">
            <img
              src="/assets/aistudio/logo-prestadores-experiencias-club_066431fd.png"
              alt="EXPERIENCIAS.CLUB PRESTADORES"
              class="footer-banner-img"
              referrerpolicy="no-referrer"
            />
            <p class="footer-subtitle">
              Portal Oficial de Prestadores y Guías del Club de Experiencias Catamarca
            </p>
          </div>
        </div>
      </footer>
    </div>
  `,
  styleUrl: './provider-panel.component.css',
})
export class ProviderPanelComponent {
  readonly store = inject(ProviderStoreService);
  private readonly router = inject(Router);

  readonly provider = this.store.currentProvider;
  readonly userMenuOpen = signal(false);
  readonly supportWhatsappUrl =
    'https://wa.me/5493515490431?text=' +
    encodeURIComponent(
      'Hola! Tengo una duda y necesito asistencia con el Portal de Prestadores, ¿me podrían ayudar?',
    );

  constructor() {
    void this.store.restoreSupabaseSession();
  }

  readonly pendingModerationCount = computed(
    () =>
      this.store
        .providerExperiences()
        .filter(
          (e) =>
            e.status === 'pendiente_publicacion' ||
            e.status === 'pendiente_ocultar' ||
            e.status === 'pendiente_eliminar',
        ).length,
  );

  toggleUserMenu(): void {
    this.userMenuOpen.update((v) => !v);
  }

  @HostListener('document:click', ['$event'])
  closeMenuOutside(event: Event): void {
    const target = event.target;
    if (target instanceof Element && !target.closest('.user-pill')) {
      this.userMenuOpen.set(false);
    }
  }

  logout(): void {
    this.store.logout();
    this.userMenuOpen.set(false);
    this.router.navigate(['/prestadores']);
  }
}
