import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { filter } from 'rxjs';
import { AdminStoreService } from '../../core/services/admin-store.service';
import { AdminLoginComponent } from './admin-login/admin-login.component';

const ROUTE_LABELS: Record<string, string> = {
  socios: 'SOCIOS',
  comprobantes: 'COMPROBANTES',
  propuestas: 'PROPUESTAS',
  postulaciones: 'PROPUESTAS',
  experiencias: 'EXPERIENCIAS',
  nueva: 'NUEVA',
  editar: 'EDITAR',
  perfil: 'PERFIL',
};

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [RouterOutlet, RouterLink, MatIconModule, AdminLoginComponent],
  template: `
    <div class="admin-portal-root">
      @if (!store.isAuthenticated()) {
        <!-- Login cuando no hay sesión activa -->
        <app-admin-login />
      } @else {
        <!-- Barra Superior Unificada idéntica al Login -->
        <header class="portal-top-nav">
          <div class="nav-brand-col">
            <a routerLink="/dashboard" class="brand-link" title="Panel de Administración">
              <img
                src="/assets/images/logo-admin-experiencias.png"
                alt="Emblema Admin"
                class="portal-emblem-img"
                referrerpolicy="no-referrer"
              />
              <div class="brand-text">
                <span class="brand-title">EXPERIENCIAS.CLUB</span>
                <span class="brand-tag">ADMINISTRACIÓN CENTRAL</span>
              </div>
            </a>
          </div>

          <div class="nav-right-col">
            <a routerLink="dashboard" class="portal-nav-btn active-route">
              <span>Área Restringida</span>
            </a>

            <!-- Menú de administrador -->
            <button
              type="button"
              class="user-pill"
              [class.is-open]="userMenuOpen()"
              (click)="toggleUserMenu()"
              aria-label="Menú de usuario"
              [attr.aria-expanded]="userMenuOpen()"
            >
              <div class="user-meta">
                <strong class="user-name">{{ admin()?.name || 'Gonzalo Gramaglia' }}</strong>
                <span class="user-agency">Superadmin</span>
              </div>
              <mat-icon class="user-pill-icon">{{ userMenuOpen() ? 'close' : 'menu' }}</mat-icon>
            </button>

            @if (userMenuOpen()) {
              <div class="dropdown-menu enlarged-menu" (click)="$event.stopPropagation()">
                <!-- Navegación mínima del administrador -->
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
                    routerLink="/socios"
                    class="dropdown-item enlarged-item"
                    (click)="userMenuOpen.set(false)"
                  >
                    <mat-icon class="menu-item-icon">group</mat-icon>
                    <div class="menu-item-info">
                      <strong class="menu-item-title">Ver Socios</strong>
                    </div>
                  </a>

                  <a
                    routerLink="/comprobantes"
                    class="dropdown-item enlarged-item"
                    (click)="userMenuOpen.set(false)"
                  >
                    <mat-icon class="menu-item-icon">receipt_long</mat-icon>
                    <div class="menu-item-info">
                      <strong class="menu-item-title">Ver Comprobantes</strong>
                    </div>
                  </a>

                  <a
                    routerLink="/propuestas"
                    class="dropdown-item enlarged-item"
                    (click)="userMenuOpen.set(false)"
                  >
                    <mat-icon class="menu-item-icon">assignment_ind</mat-icon>
                    <div class="menu-item-info">
                      <strong class="menu-item-title">Ver Propuestas</strong>
                    </div>
                  </a>

                  <a
                    routerLink="/experiencias"
                    class="dropdown-item enlarged-item"
                    (click)="userMenuOpen.set(false)"
                  >
                    <mat-icon class="menu-item-icon">travel_explore</mat-icon>
                    <div class="menu-item-info">
                      <strong class="menu-item-title">Ver Experiencias</strong>
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
        </header>

        <!-- Breadcrumb Bar con Fondo Temático Naranja #ff5f00 -->
        <nav class="portal-breadcrumb-bar" aria-label="Ruta de navegación">
          <div class="breadcrumb-inner">
            <a href="https://experiencias.club" target="_blank" rel="noopener noreferrer" class="bc-link">EXPERIENCIAS.CLUB</a>
            <span class="bc-sep">/</span>
            @if (breadcrumbs().length === 0) {
              <span class="bc-current" aria-current="page">ADMINISTRACIÓN</span>
            } @else {
              <a routerLink="/dashboard" class="bc-link">ADMINISTRACIÓN</a>
              @for (item of breadcrumbs(); track item.label) {
                <span class="bc-sep">/</span>
                @if (item.link) {
                  <a [routerLink]="item.link" class="bc-link">{{ item.label }}</a>
                } @else {
                  <span class="bc-current" aria-current="page">{{ item.label }}</span>
                }
              }
            }
          </div>
        </nav>

        <!-- Contenedor principal -->
        <main class="portal-main">
          <div class="portal-content-container">
            <router-outlet />
          </div>
        </main>
        <!-- Footer oficial con logo banner horizontal -->
        <footer class="portal-footer">
          <div class="footer-inner">
            <div class="footer-center-logo">
              <img
                src="/assets/images/logo-admin-experiencias-club.png"
                alt="EXPERIENCIAS.CLUB ADMINISTRACIÓN"
                class="footer-banner-img"
                referrerpolicy="no-referrer"
              />
              <p class="footer-subtitle">
                Portal Oficial de Administración Central del Club de Experiencias Catamarca
              </p>
            </div>
          </div>
        </footer>
      }
    </div>
  `,
  styleUrl: './admin-panel.component.css',
})
export class AdminPanelComponent {
  readonly store = inject(AdminStoreService);
  private readonly router = inject(Router);
  private readonly pageTitle = inject(Title);

  readonly admin = this.store.currentAdmin;
  readonly userMenuOpen = signal(false);
  readonly currentUrl = signal(this.router.url);

  readonly breadcrumbs = computed<{ label: string; link?: string }[]>(() => {
    const rawPath = this.currentUrl().split('?')[0].split('#')[0];
    const segments = rawPath.split('/').filter(Boolean);
    const cleanSegments = segments.filter((s) => s !== 'admin' && s !== 'dashboard');

    const items: { label: string; link?: string }[] = [];
    if (cleanSegments.length === 0) {
      return items;
    }

    let accumulated = '';
    for (let i = 0; i < cleanSegments.length; i++) {
      const seg = cleanSegments[i];
      accumulated += `/${seg}`;
      const label = ROUTE_LABELS[seg.toLowerCase()] || seg.toUpperCase();
      const isLast = i === cleanSegments.length - 1;
      items.push({
        label,
        link: isLast ? undefined : accumulated,
      });
    }

    return items;
  });

  constructor() {
    this.pageTitle.setTitle('Portal de Admin del Club de Experiencias');
    void this.store.restoreSupabaseSession();

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects || event.url);
      });
  }

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
    this.router.navigate(['/']);
  }
}
