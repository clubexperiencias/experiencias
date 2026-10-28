import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ProviderStoreService } from '../../core/services/provider-store.service';
import { ProviderLoginComponent } from './provider-login/provider-login.component';

@Component({
  selector: 'app-provider-panel',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, ProviderLoginComponent],
  template: `
    <div class="provider-portal-root">
      <!-- Domain indicator strip con estilo perfil / azul #80b3ff -->
      <div class="subdomain-strip">
        <div class="subdomain-content">
          <div class="subdomain-left">
            <span class="live-dot"></span>
            <span class="subdomain-host">prestadores.experiencias.club</span>
            <span class="subdomain-sep">·</span>
            <span class="subdomain-tag">Portal Operativo para Prestadores y Guías de Catamarca</span>
          </div>
          <div class="subdomain-right">
            <a href="https://experiencias.club" class="back-public-link" target="_blank" rel="noopener" title="Ir al sitio público de experiencias">
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

            <!-- Acciones del Header: Botón Nueva Experiencia + Menú de Perfil Ampliado -->
            <div class="header-right">
              <!-- Botón Nueva Experiencia en azul 80b3ff rectangular -->
              <a routerLink="/experiencias/nueva" class="new-exp-btn" title="Publicar o proponer una nueva experiencia">
                <mat-icon class="btn-icon">add</mat-icon>
                <span>Nueva Experiencia</span>
              </a>

              <!-- Menú de Prestador activo -->
              <div class="user-pill" (click)="toggleUserMenu()">
                <img
                  [src]="provider()?.avatar || '/assets/aistudio/patricio_84c0d3a9.jpg'"
                  [alt]="provider()?.name || 'Patricio Facundo'"
                  class="user-avatar"
                  referrerpolicy="no-referrer"
                />
                <div class="user-meta">
                  <strong class="user-name">{{ provider()?.name || 'Patricio Facundo' }}</strong>
                  <span class="user-agency">{{ provider()?.agency }}</span>
                </div>
                <mat-icon class="dropdown-chevron">expand_more</mat-icon>

                @if (userMenuOpen()) {
                  <div class="dropdown-menu enlarged-menu" (click)="$event.stopPropagation()">
                    <div class="dropdown-header">
                      <div class="dropdown-user-row">
                        <img
                          [src]="provider()?.avatar || '/assets/aistudio/patricio_84c0d3a9.jpg'"
                          [alt]="provider()?.name || 'Patricio Facundo'"
                          class="dropdown-avatar-lg"
                          referrerpolicy="no-referrer"
                        />
                        <div class="dropdown-user-details">
                          <strong class="dropdown-user-name">{{ provider()?.name || 'Patricio Facundo' }}</strong>
                          <span class="dropdown-user-email">{{ provider()?.email }}</span>
                          <span class="dropdown-user-tag">{{ provider()?.agency }}</span>
                        </div>
                      </div>
                    </div>

                    <div class="dropdown-divider"></div>

                    <!-- Opciones de Navegación del Menú Agrandadas -->
                    <div class="dropdown-nav-list">
                      <a routerLink="/dashboard" class="dropdown-item enlarged-item" (click)="userMenuOpen.set(false)">
                        <mat-icon class="menu-item-icon">dashboard</mat-icon>
                        <div class="menu-item-info">
                          <strong class="menu-item-title">Panel de Control</strong>
                          <span class="menu-item-desc">Métricas de socios, recaudación y catálogo</span>
                        </div>
                      </a>

                      <a routerLink="/experiencias" class="dropdown-item enlarged-item" (click)="userMenuOpen.set(false)">
                        <mat-icon class="menu-item-icon">hiking</mat-icon>
                        <div class="menu-item-info">
                          <strong class="menu-item-title">Mis Experiencias</strong>
                          <span class="menu-item-desc">Catálogo activo, cupos y estado de publicación</span>
                        </div>
                      </a>

                      <a routerLink="/comprobantes" class="dropdown-item enlarged-item" (click)="userMenuOpen.set(false)">
                        <mat-icon class="menu-item-icon">receipt_long</mat-icon>
                        <div class="menu-item-info">
                          <strong class="menu-item-title">Comprobantes y Socios</strong>
                          <span class="menu-item-desc">Validación de transferencias bancarias</span>
                        </div>
                      </a>

                      <a routerLink="/perfil" class="dropdown-item enlarged-item" (click)="userMenuOpen.set(false)">
                        <mat-icon class="menu-item-icon">account_balance</mat-icon>
                        <div class="menu-item-info">
                          <strong class="menu-item-title">Cobros, CBU y Perfil</strong>
                          <span class="menu-item-desc">Datos fiscales y cuenta bancaria de destino</span>
                        </div>
                      </a>
                    </div>

                    <div class="dropdown-divider"></div>

                    <span class="dropdown-section-title">Cambiar prestador demo:</span>

                    @for (p of allDemoProviders; track p.id) {
                      @if (p.id !== provider()?.id) {
                        <button
                          type="button"
                          class="dropdown-item switch-item"
                          (click)="switchProvider(p.id)"
                        >
                          <mat-icon class="menu-item-icon">swap_horiz</mat-icon>
                          <span>{{ p.name }}</span>
                        </button>
                      }
                    }

                    <div class="dropdown-divider"></div>

                    <button type="button" class="dropdown-item enlarged-item logout-item" (click)="logout()">
                      <mat-icon class="menu-item-icon">logout</mat-icon>
                      <div class="menu-item-info">
                        <strong class="menu-item-title">Cerrar sesión</strong>
                        <span class="menu-item-desc">Salir del portal de prestadores</span>
                      </div>
                    </button>
                  </div>
                }
              </div>
            </div>
          </div>
        </header>

        <!-- Contenedor principal con fondo relieve similar a /perfil -->
        <main class="portal-main">
          <div class="portal-content-container">
            <router-outlet />
          </div>
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
          <div class="footer-links">
            <a routerLink="/prestadores/dashboard">Dashboard</a>
            <a routerLink="/prestadores/experiencias">Experiencias</a>
            <a routerLink="/prestadores/comprobantes">Comprobantes y Socios</a>
            <a routerLink="/prestadores/perfil">Datos de Cobro</a>
            <a routerLink="/">Web de Socios</a>
          </div>
          <div class="footer-bottom-copy">
            <span>prestadores.experiencias.club · Todos los derechos reservados</span>
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
  readonly allDemoProviders = this.store.allProviders();
  readonly userMenuOpen = signal(false);

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

  switchProvider(providerId: string): void {
    this.store.loginAs(providerId);
    this.userMenuOpen.set(false);
  }

  logout(): void {
    this.store.logout();
    this.userMenuOpen.set(false);
    this.router.navigate(['/prestadores']);
  }
}
