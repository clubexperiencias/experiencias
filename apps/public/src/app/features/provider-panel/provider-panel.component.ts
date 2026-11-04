import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { filter } from 'rxjs';
import { ProviderStoreService } from '../../core/services/provider-store.service';
import { ProviderLoginComponent } from './provider-login/provider-login.component';

const ROUTE_LABELS: Record<string, string> = {
  socios: 'SOCIOS',
  comprobantes: 'COMPROBANTES',
  propuestas: 'PROPUESTAS',
  postulaciones: 'PROPUESTAS',
  experiencias: 'EXPERIENCIAS',
  nueva: 'NUEVA PROPUESTA',
  editar: 'EDITAR',
  perfil: 'PERFIL',
};

@Component({
  selector: 'app-provider-panel',
  standalone: true,
  imports: [RouterOutlet, RouterLink, MatIconModule, ProviderLoginComponent],
  template: `
    <div class="provider-portal-root">
      @if (!store.isAuthenticated()) {
        <!-- Login & Registro cuando no hay sesión activa -->
        <app-provider-login />
      } @else {
        <!-- Barra Superior Unificada idéntica al Login -->
        <header class="portal-top-nav">
          <div class="nav-brand-col">
            <a [routerLink]="dashboardLink()" class="brand-link" title="Panel de Prestadores">
              <img
                src="/assets/aistudio/logo-prestadores-experiencias_9372e925.png"
                alt="Emblema Prestadores"
                class="portal-emblem-img"
                referrerpolicy="no-referrer"
              />
              <div class="brand-text">
                <span class="brand-title">EXPERIENCIAS.CLUB</span>
                <span class="brand-tag">PRESTADORES</span>
              </div>
            </a>
          </div>

          <div class="nav-right-col">
            <a [routerLink]="dashboardLink()" class="portal-nav-btn active-route">
              <span>Panel Operativo</span>
            </a>

            <!-- Menú de prestador activo -->
            <button
              type="button"
              class="user-pill"
              [class.is-open]="userMenuOpen()"
              (click)="toggleUserMenu()"
              aria-label="Menú de prestador"
              [attr.aria-expanded]="userMenuOpen()"
            >
              <div class="user-meta">
                <strong class="user-name">{{ provider()?.name || 'Catamarca Kayak' }}</strong>
                <span class="user-agency">{{ provider()?.agency || 'Prestador Oficial' }}</span>
              </div>
              <mat-icon class="user-pill-icon">{{ userMenuOpen() ? 'close' : 'menu' }}</mat-icon>
            </button>

            @if (userMenuOpen()) {
              <div class="dropdown-menu enlarged-menu" (click)="$event.stopPropagation()">
                <!-- Opciones de Navegación del Menú Agrandadas -->
                <div class="dropdown-nav-list">
                  <a
                    [routerLink]="dashboardLink()"
                    class="dropdown-item enlarged-item"
                    (click)="userMenuOpen.set(false)"
                  >
                    <mat-icon class="menu-item-icon">dashboard</mat-icon>
                    <div class="menu-item-info">
                      <strong class="menu-item-title">Panel de Control</strong>
                    </div>
                  </a>

                  <a
                    [routerLink]="experiencesLink()"
                    class="dropdown-item enlarged-item"
                    (click)="userMenuOpen.set(false)"
                  >
                    <mat-icon class="menu-item-icon">hiking</mat-icon>
                    <div class="menu-item-info">
                      <strong class="menu-item-title">Mis Experiencias</strong>
                    </div>
                  </a>

                  <a
                    [routerLink]="membersLink()"
                    class="dropdown-item enlarged-item"
                    (click)="userMenuOpen.set(false)"
                  >
                    <mat-icon class="menu-item-icon">people</mat-icon>
                    <div class="menu-item-info">
                      <strong class="menu-item-title">Socios y Comprobantes</strong>
                    </div>
                  </a>

                  <a
                    [routerLink]="profileLink()"
                    class="dropdown-item enlarged-item"
                    (click)="userMenuOpen.set(false)"
                  >
                    <mat-icon class="menu-item-icon">manage_accounts</mat-icon>
                    <div class="menu-item-info">
                      <strong class="menu-item-title">Editar Perfil</strong>
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

        <!-- Breadcrumb Bar con Fondo Temático Azul/Cyan #80b3ff -->
        <nav class="portal-breadcrumb-bar" aria-label="Ruta de navegación">
          <div class="breadcrumb-inner">
            <a href="https://experiencias.club" target="_blank" rel="noopener noreferrer" class="bc-link">EXPERIENCIAS.CLUB</a>
            <span class="bc-sep">/</span>
            @if (breadcrumbs().length === 0) {
              <span class="bc-current" aria-current="page">PRESTADORES</span>
            } @else {
              <a [routerLink]="dashboardLink()" class="bc-link">PRESTADORES</a>
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
      }
    </div>
  `,
  styleUrl: './provider-panel.component.css',
})
export class ProviderPanelComponent {
  readonly store = inject(ProviderStoreService);
  private readonly router = inject(Router);

  readonly provider = this.store.currentProvider;
  readonly userMenuOpen = signal(false);
  readonly currentUrl = signal(this.router.url);

  readonly basePath = computed(() =>
    this.currentUrl().includes('/prestadores/panel') ? '/prestadores/panel' : '',
  );
  readonly dashboardLink = computed(() => `${this.basePath()}/dashboard`);
  readonly experiencesLink = computed(() => `${this.basePath()}/experiencias`);
  readonly membersLink = computed(() => `${this.basePath()}/socios`);
  readonly profileLink = computed(() => `${this.basePath()}/perfil`);

  readonly breadcrumbs = computed<{ label: string; link?: string }[]>(() => {
    const rawPath = this.currentUrl().split('?')[0].split('#')[0];
    const segments = rawPath.split('/').filter(Boolean);
    const isPanelSubpath = rawPath.includes('/prestadores/panel');
    const basePath = isPanelSubpath ? '/prestadores/panel' : '';

    const cleanSegments = segments.filter(
      (s) => s !== 'prestadores' && s !== 'panel' && s !== 'dashboard',
    );

    const items: { label: string; link?: string }[] = [];
    if (cleanSegments.length === 0) {
      return items;
    }

    if (cleanSegments[0] === 'experiencias') {
      if (cleanSegments.length === 1) {
        items.push({ label: 'EXPERIENCIAS' });
      } else if (cleanSegments.includes('nueva')) {
        items.push({ label: 'EXPERIENCIAS', link: `${basePath}/experiencias` });
        items.push({ label: 'NUEVA' });
      } else if (cleanSegments.includes('editar')) {
        items.push({ label: 'EXPERIENCIAS', link: `${basePath}/experiencias` });
        items.push({ label: 'EDITAR' });
      } else {
        items.push({ label: 'EXPERIENCIAS', link: `${basePath}/experiencias` });
        items.push({ label: cleanSegments[cleanSegments.length - 1].toUpperCase() });
      }
    } else {
      for (let i = 0; i < cleanSegments.length; i++) {
        const seg = cleanSegments[i];
        const label = ROUTE_LABELS[seg.toLowerCase()] || seg.toUpperCase();
        const isLast = i === cleanSegments.length - 1;
        items.push({
          label,
          link: isLast ? undefined : `${basePath}/${seg}`,
        });
      }
    }

    return items;
  });

  readonly supportWhatsappUrl =
    'https://wa.me/5493515490431?text=' +
    encodeURIComponent(
      'Hola! Tengo una duda y necesito asistencia con el Portal de Prestadores, ¿me podrían ayudar?',
    );

  constructor() {
    void this.store.restoreSupabaseSession();

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects || event.url);
      });
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
