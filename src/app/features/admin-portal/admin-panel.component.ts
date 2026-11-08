import { Component, HostListener, computed, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AdminStoreService } from '../../core/services/admin-store.service';
import { ExperienceService } from '../../core/services/experience.service';
import { ProviderStoreService } from '../../core/services/provider-store.service';
import { AdminLoginComponent } from './admin-login/admin-login.component';

const ROUTE_LABELS: Record<string, string> = {
  socios: 'SOCIOS',
  prestadores: 'PRESTADORES',
  comprobantes: 'COMPROBANTES',
  experiencias: 'EXPERIENCIAS',
  nueva: 'NUEVA',
  editar: 'EDITAR',
  perfil: 'PERFIL',
  logs: 'REGISTRO DE ACTIVIDAD',
  admins: 'ADMINS',
  configuracion: 'CONFIGURACIÓN',
};

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, FormsModule, AdminLoginComponent],
  template: `
    <div class="admin-portal-root">
      @if (!store.isAuthenticated()) {
        <!-- Login cuando no hay sesión activa -->
        <app-admin-login />
      } @else {
        <!-- Barra Superior Unificada idéntica al Login -->
        <header class="portal-top-nav">
          <div class="nav-brand-col">
            <a [routerLink]="adminLink('/dashboard')" class="brand-link" title="Panel de Administración">
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
            <a
              routerLink="dashboard"
              class="portal-nav-btn"
              routerLinkActive="active-route"
              [routerLinkActiveOptions]="{ paths: 'exact', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' }"
            >
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
                    [routerLink]="adminLink('/dashboard')"
                    class="dropdown-item enlarged-item"
                    (click)="userMenuOpen.set(false)"
                  >
                    <mat-icon class="menu-item-icon">dashboard</mat-icon>
                    <div class="menu-item-info">
                      <strong class="menu-item-title">Panel de Control</strong>
                    </div>
                  </a>

                  <a
                    [routerLink]="adminLink('/socios')"
                    class="dropdown-item enlarged-item"
                    (click)="userMenuOpen.set(false)"
                  >
                    <mat-icon class="menu-item-icon">group</mat-icon>
                    <div class="menu-item-info">
                      <strong class="menu-item-title">Ver Socios</strong>
                    </div>
                  </a>

                  <a
                    [routerLink]="adminLink('/prestadores')"
                    class="dropdown-item enlarged-item"
                    (click)="userMenuOpen.set(false)"
                  >
                    <mat-icon class="menu-item-icon">badge</mat-icon>
                    <div class="menu-item-info">
                      <strong class="menu-item-title">Ver Prestadores</strong>
                    </div>
                  </a>

                  <a
                    [routerLink]="adminLink('/comprobantes')"
                    class="dropdown-item enlarged-item"
                    (click)="userMenuOpen.set(false)"
                  >
                    <mat-icon class="menu-item-icon">receipt_long</mat-icon>
                    <div class="menu-item-info">
                      <strong class="menu-item-title">Ver Comprobantes</strong>
                    </div>
                  </a>

                  <a
                    [routerLink]="adminLink('/experiencias')"
                    class="dropdown-item enlarged-item"
                    (click)="userMenuOpen.set(false)"
                  >
                    <mat-icon class="menu-item-icon">travel_explore</mat-icon>
                    <div class="menu-item-info">
                      <strong class="menu-item-title">Ver Experiencias</strong>
                    </div>
                  </a>

                  <a
                    [routerLink]="adminLink('/logs')"
                    class="dropdown-item enlarged-item"
                    (click)="userMenuOpen.set(false)"
                  >
                    <mat-icon class="menu-item-icon">history</mat-icon>
                    <div class="menu-item-info">
                      <strong class="menu-item-title">Registro de Actividad</strong>
                    </div>
                  </a>

                  <a
                    [routerLink]="adminLink('/configuracion')"
                    class="dropdown-item enlarged-item club-profile-item"
                    (click)="userMenuOpen.set(false)"
                  >
                    <mat-icon class="menu-item-icon club-icon">settings</mat-icon>
                    <div class="menu-item-info">
                      <strong class="menu-item-title">Configuración</strong>
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
              <a [routerLink]="adminLink('/dashboard')" class="bc-link">ADMINISTRACIÓN</a>
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

        <!-- Botón Flotante Volver Atrás réplica de la web principal y portal de prestadores -->
        @if (canShowBackButton()) {
          <button
            type="button"
            class="desktop-floating-btn desktop-floating-back-btn"
            (click)="goBack()"
            aria-label="Volver atrás"
            title="Volver atrás"
          >
            <mat-icon class="floating-btn-icon">arrow_back</mat-icon>
          </button>
        }

        <!-- Contenedor principal -->
        <main class="portal-main">
          <div class="portal-content-container">
            <router-outlet />
          </div>

          <!-- Box de Mesa de Ayuda, Asistencia Técnica & Infraestructura -->
          <section class="admin-support-box" aria-label="Mesa de Ayuda, Asistencia Técnica & Infraestructura">
            <div class="admin-support-box-inner">
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

              <!-- Accesos directos a Infraestructura y Repositorio -->
              <div class="admin-quick-links-section">
                <div class="quick-links-header">
                  <span class="quick-links-kicker">ACCESOS DIRECTOS</span>
                </div>
                <div class="admin-quick-links-row">
                  <a
                    href="https://supabase.com/dashboard/project/pgdtjfcngadesifsqwms"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="admin-quick-link-btn supabase-btn"
                    title="Abrir base de datos y autenticación en Supabase (nueva pestaña)"
                  >
                    <svg class="quick-link-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21.362 9.354H12V.396a.396.396 0 0 0-.716-.233L.103 13.914a.792.792 0 0 0 .619 1.282h9.278v8.958a.396.396 0 0 0 .716.233l11.181-13.751a.792.792 0 0 0-.619-1.282z"/>
                    </svg>
                    <span class="quick-link-label">Supabase</span>
                    <mat-icon class="external-icon-sm">open_in_new</mat-icon>
                  </a>

                  <a
                    href="https://vercel.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="admin-quick-link-btn vercel-btn"
                    title="Abrir deployments y dominios en Vercel (nueva pestaña)"
                  >
                    <svg class="quick-link-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 1L24 22H0L12 1Z"/>
                    </svg>
                    <span class="quick-link-label">Vercel</span>
                    <mat-icon class="external-icon-sm">open_in_new</mat-icon>
                  </a>

                  <a
                    href="https://github.com/clubexperiencias/experiencias"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="admin-quick-link-btn github-btn"
                    title="Abrir repositorio de código en GitHub (nueva pestaña)"
                  >
                    <svg class="quick-link-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                    </svg>
                    <span class="quick-link-label">GitHub</span>
                    <mat-icon class="external-icon-sm">open_in_new</mat-icon>
                  </a>
                </div>
              </div>
            </div>
          </section>
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

        <!-- Modal Editar Perfil Oficial del Club de Experiencias -->
        @if (store.isClubProfileModalOpen()) {
          <div class="club-profile-backdrop" (click)="!isSavingClubProfile() && closeClubProfileModal()">
            <div
              class="club-profile-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cp-dialog-title"
              (click)="$event.stopPropagation()"
            >
              <div class="cp-dialog-header">
                <div class="cp-title-wrap">
                  <div class="cp-icon-pill">
                    <mat-icon>account_balance</mat-icon>
                  </div>
                  <div>
                    <h3 class="cp-dialog-title" id="cp-dialog-title">Perfil Oficial del Club de Experiencias</h3>
                    <p class="cp-dialog-sub">
                      Cuenta prestadora oficial del Club gestionada centralizadamente por todos los administradores.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  class="cp-close-btn"
                  [disabled]="isSavingClubProfile()"
                  (click)="closeClubProfileModal()"
                  aria-label="Cerrar modal"
                >
                  ×
                </button>
              </div>

              <div class="cp-dialog-body">
                @if (clubProfileError()) {
                  <div class="cp-error-banner" role="alert">
                    <mat-icon class="cp-error-icon">error_outline</mat-icon>
                    <span>{{ clubProfileError() }}</span>
                  </div>
                }

                <div class="cp-info-banner">
                  <mat-icon class="cp-info-icon">verified</mat-icon>
                  <p>
                    Las experiencias creadas por el <strong>Club de Experiencias</strong> (como Kayak y travesías propias)
                    utilizan automáticamente esta información de prestador y estos datos bancarios para su cobro.
                  </p>
                </div>

                <div class="cp-form-grid">
                  <div class="cp-field cp-span-2">
                    <label for="cp-field-name">Nombre Institucional / Prestador Oficial:</label>
                    <input
                      id="cp-field-name"
                      type="text"
                      class="cp-input"
                      [(ngModel)]="clubFormName"
                      placeholder="Club de Experiencias"
                    />
                  </div>

                  <div class="cp-field">
                    <label for="cp-field-email">Email Oficial del Club:</label>
                    <input
                      id="cp-field-email"
                      type="email"
                      class="cp-input"
                      [(ngModel)]="clubFormEmail"
                      placeholder="admin@experiencias.club"
                    />
                    <span class="cp-field-hint">Email corporativo para vincular las fichas del Club.</span>
                  </div>

                  <div class="cp-field">
                    <label for="cp-field-phone">Teléfono / WhatsApp de Contacto:</label>
                    <input
                      id="cp-field-phone"
                      type="tel"
                      class="cp-input"
                      [(ngModel)]="clubFormPhone"
                      placeholder="+54 9 383 456-7890"
                    />
                  </div>

                  <div class="cp-section-sep cp-span-2">
                    <span class="cp-sep-badge">
                      <mat-icon>account_balance_wallet</mat-icon>
                      Datos de Cobro (CBU / Alias) para Experiencias del Club
                    </span>
                  </div>

                  <div class="cp-field cp-span-2">
                    <label for="cp-field-cbu-alias">CBU / CVU o Alias Oficial:</label>
                    <input
                      id="cp-field-cbu-alias"
                      type="text"
                      class="cp-input cp-input-blue font-mono"
                      [(ngModel)]="clubFormCbuAlias"
                      placeholder="EXPERIENCIAS.CLUB.MP"
                    />
                    <span class="cp-field-hint">
                      Alias o CBU que se asigna a todas las reservas de expediciones oficiales del Club.
                    </span>
                  </div>

                  <div class="cp-field">
                    <label for="cp-field-cuit-dni">CUIT / CUIL:</label>
                    <input
                      id="cp-field-cuit-dni"
                      type="text"
                      class="cp-input font-mono"
                      [(ngModel)]="clubFormCuitDni"
                      placeholder="30-71829401-4"
                    />
                  </div>

                  <div class="cp-field">
                    <label for="cp-field-bank-name">Banco / Entidad Financiera:</label>
                    <input
                      id="cp-field-bank-name"
                      type="text"
                      class="cp-input"
                      [(ngModel)]="clubFormBankName"
                      placeholder="Mercado Pago / Banco Nación"
                    />
                  </div>

                  <div class="cp-field cp-span-2">
                    <label for="cp-field-account-holder">Titular de la Cuenta:</label>
                    <input
                      id="cp-field-account-holder"
                      type="text"
                      class="cp-input"
                      [(ngModel)]="clubFormAccountHolder"
                      placeholder="Club de Experiencias Catamarca"
                    />
                  </div>

                  <div class="cp-section-sep cp-span-2">
                    <span class="cp-sep-badge">
                      <mat-icon>public</mat-icon>
                      Información Institucional & Redes
                    </span>
                  </div>

                  <div class="cp-field cp-span-2">
                    <label for="cp-field-bio">Presentación Institucional (Bio):</label>
                    <textarea
                      id="cp-field-bio"
                      rows="2"
                      class="cp-textarea"
                      [(ngModel)]="clubFormBio"
                      placeholder="Cuenta institucional oficial del Club de Experiencias..."
                    ></textarea>
                  </div>

                  <div class="cp-field">
                    <label for="cp-field-website">Sitio Web Oficial:</label>
                    <input
                      id="cp-field-website"
                      type="text"
                      class="cp-input"
                      [(ngModel)]="clubFormWebsite"
                      placeholder="https://experiencias.club"
                    />
                  </div>

                  <div class="cp-field">
                    <label for="cp-field-social-media">Instagram / Red Social:</label>
                    <input
                      id="cp-field-social-media"
                      type="text"
                      class="cp-input"
                      [(ngModel)]="clubFormSocialMedia"
                      placeholder="instagram.com/experiencias.club"
                    />
                  </div>
                </div>
              </div>

              <div class="cp-dialog-footer">
                <button
                  type="button"
                  class="cp-btn-secondary"
                  [disabled]="isSavingClubProfile()"
                  (click)="closeClubProfileModal()"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  class="cp-btn-primary"
                  [disabled]="isSavingClubProfile()"
                  (click)="saveClubProfile()"
                >
                  @if (isSavingClubProfile()) {
                    <mat-icon class="btn-spin">sync</mat-icon>
                  }
                  <span>{{ isSavingClubProfile() ? 'Guardando...' : 'Guardar Perfil del Club' }}</span>
                </button>
              </div>
            </div>
          </div>
        }
      }
    </div>
  `,
  styleUrl: './admin-panel.component.css',
})
export class AdminPanelComponent {
  readonly store = inject(AdminStoreService);
  private readonly experienceService = inject(ExperienceService);
  private readonly providerStore = inject(ProviderStoreService);
  private readonly router = inject(Router);
  private readonly pageTitle = inject(Title);
  private readonly destroyRef = inject(DestroyRef);

  readonly admin = this.store.currentAdmin;
  readonly userMenuOpen = signal(false);
  readonly currentUrl = signal(this.router.url);
  readonly supportWhatsappUrl =
    'https://wa.me/5493515490431?text=Hola!%20Tengo%20una%20duda%20y%20necesito%20asistencia%20con%20el%20Panel%20de%20Administraci%C3%B3n%2C%20%C2%BFme%20podr%C3%ADan%20ayudar%3F';

  readonly basePath = computed(() => {
    const rawPath = this.currentUrl().split('?')[0].split('#')[0];
    const segments = rawPath.split('/').filter(Boolean);
    return segments[0] === 'admin' ? '/admin' : '';
  });

  adminLink(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.basePath()}${cleanPath}`;
  }

  readonly canShowBackButton = computed(() => {
    const rawPath = this.currentUrl().split('?')[0].split('#')[0];
    const cleanSegments = rawPath
      .split('/')
      .filter(Boolean)
      .filter((s) => s !== 'admin' && s !== 'dashboard');
    return cleanSegments.length > 0;
  });

  goBack(): void {
    const list = this.breadcrumbs();
    if (list && list.length > 1) {
      for (let i = list.length - 2; i >= 0; i--) {
        if (list[i]?.link) {
          this.router.navigateByUrl(list[i].link!);
          return;
        }
      }
    }
    this.router.navigateByUrl(this.adminLink('/dashboard'));
  }

  readonly breadcrumbs = computed<{ label: string; link?: string }[]>(() => {
    const rawPath = this.currentUrl().split('?')[0].split('#')[0];
    const segments = rawPath.split('/').filter(Boolean);
    const cleanSegments = segments.filter((s) => s !== 'admin' && s !== 'dashboard');
    const basePath = this.basePath();

    const items: { label: string; link?: string }[] = [];
    if (cleanSegments.length === 0) {
      return items;
    }

    if (cleanSegments[0] === 'experiencias') {
      if (cleanSegments.length === 1) {
        items.push({ label: 'EXPERIENCIAS' });
      } else {
        const slug = cleanSegments[1];
        const exp = this.experienceService.getExperienceBySlug(slug);
        const expTitle = exp ? (exp.shortTitle || exp.title).toUpperCase() : slug.toUpperCase();

        if (cleanSegments.includes('editar')) {
          items.push({ label: 'EXPERIENCIAS', link: `${basePath}/experiencias` });
          items.push({ label: expTitle, link: `${basePath}/experiencias/${slug}` });
          items.push({ label: 'EDITAR' });
        } else {
          items.push({ label: 'EXPERIENCIAS', link: `${basePath}/experiencias` });
          items.push({ label: expTitle });
        }
      }
      return items;
    }

    if (cleanSegments[0] === 'prestadores') {
      if (cleanSegments.length === 1) {
        items.push({ label: 'PRESTADORES' });
      } else {
        const slug = cleanSegments[1];
        const prov = this.providerStore.getProviderBySlug(slug);
        const provTitle = prov ? (prov.agency || prov.name).toUpperCase() : slug.toUpperCase();

        if (cleanSegments.includes('editar')) {
          items.push({ label: 'PRESTADORES', link: `${basePath}/prestadores` });
          items.push({ label: provTitle, link: `${basePath}/prestadores/${slug}` });
          items.push({ label: 'EDITAR' });
        } else {
          items.push({ label: 'PRESTADORES', link: `${basePath}/prestadores` });
          items.push({ label: provTitle });
        }
      }
      return items;
    }

    if (cleanSegments[0] === 'logs') {
      if (cleanSegments.length === 1) {
        items.push({ label: 'REGISTRO DE ACTIVIDAD' });
      } else if (cleanSegments[1] === 'admins') {
        items.push({ label: 'REGISTRO DE ACTIVIDAD', link: `${basePath}/logs` });
        items.push({ label: 'ADMINISTRADORES' });
      } else if (cleanSegments[1] === 'prestadores') {
        items.push({ label: 'REGISTRO DE ACTIVIDAD', link: `${basePath}/logs` });
        items.push({ label: 'PRESTADORES' });
      } else {
        items.push({ label: 'REGISTRO DE ACTIVIDAD', link: `${basePath}/logs` });
        items.push({ label: cleanSegments[1].toUpperCase() });
      }
      return items;
    }

    let accumulated = basePath;
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
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects || event.url);
      });
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update((v) => !v);
  }

  readonly clubFormName = signal('');
  readonly clubFormEmail = signal('');
  readonly clubFormPhone = signal('');
  readonly clubFormCbuAlias = signal('');
  readonly clubFormCuitDni = signal('');
  readonly clubFormBankName = signal('');
  readonly clubFormAccountHolder = signal('');
  readonly clubFormBio = signal('');
  readonly clubFormWebsite = signal('');
  readonly clubFormSocialMedia = signal('');
  readonly isSavingClubProfile = signal(false);
  readonly clubProfileError = signal<string | null>(null);
  private lastFocusedElement: HTMLElement | null = null;

  openClubProfileModal(): void {
    if (typeof document !== 'undefined') {
      const active = document.activeElement as HTMLElement | null;
      const userPill = document.querySelector<HTMLElement>('.user-pill');
      if (active && active.closest('.dropdown-menu')) {
        this.lastFocusedElement = userPill;
      } else {
        this.lastFocusedElement = active || userPill;
      }
    }
    this.clubProfileError.set(null);
    const p = this.store.clubProfile();
    this.clubFormName.set(p.name || 'Club de Experiencias');
    this.clubFormEmail.set(p.email || 'admin@experiencias.club');
    this.clubFormPhone.set(p.phone || '');
    this.clubFormCbuAlias.set(p.cbuAlias || '');
    this.clubFormCuitDni.set(p.cuitDni || '');
    this.clubFormBankName.set(p.bankName || '');
    this.clubFormAccountHolder.set(p.accountHolder || '');
    this.clubFormBio.set(p.bio || '');
    this.clubFormWebsite.set(p.website || '');
    this.clubFormSocialMedia.set(p.socialMedia || '');
    this.store.openClubProfileModal();

    setTimeout(() => {
      const firstInput = document.getElementById('cp-field-name');
      if (firstInput) {
        firstInput.focus();
      } else {
        const dialog = document.querySelector<HTMLElement>('.club-profile-dialog');
        dialog?.focus();
      }
    }, 50);
  }

  closeClubProfileModal(force = false): void {
    if (this.isSavingClubProfile() && !force) return;
    this.clubProfileError.set(null);
    this.store.closeClubProfileModal();
    if (typeof document !== 'undefined') {
      if (
        this.lastFocusedElement &&
        this.lastFocusedElement.isConnected &&
        typeof this.lastFocusedElement.focus === 'function'
      ) {
        this.lastFocusedElement.focus();
      } else {
        const fallback = document.querySelector<HTMLElement>('.user-pill');
        fallback?.focus();
      }
    }
    this.lastFocusedElement = null;
  }

  @HostListener('keydown', ['$event'])
  handleModalKeydown(event: KeyboardEvent): void {
    if (!this.store.isClubProfileModalOpen()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      if (!this.isSavingClubProfile()) {
        this.closeClubProfileModal();
      }
      return;
    }

    if (event.key === 'Tab') {
      const dialog = document.querySelector('.club-profile-dialog');
      if (!dialog) return;

      const focusables = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
  }

  async saveClubProfile(): Promise<void> {
    this.isSavingClubProfile.set(true);
    this.clubProfileError.set(null);
    try {
      const res = await this.store.updateClubProfile({
        name: this.clubFormName().trim() || 'Club de Experiencias',
        agency: this.clubFormName().trim() || 'Club de Experiencias',
        email: this.clubFormEmail().trim() || 'admin@experiencias.club',
        phone: this.clubFormPhone().trim(),
        cbuAlias: this.clubFormCbuAlias().trim(),
        cuitDni: this.clubFormCuitDni().trim(),
        bankName: this.clubFormBankName().trim(),
        accountHolder: this.clubFormAccountHolder().trim(),
        bio: this.clubFormBio().trim(),
        website: this.clubFormWebsite().trim(),
        socialMedia: this.clubFormSocialMedia().trim(),
      });

      if (!res.success) {
        this.clubProfileError.set(res.error || 'No se pudo guardar el perfil del Club.');
        return;
      }
      this.closeClubProfileModal(true);
    } catch (err: any) {
      this.clubProfileError.set(err?.message || 'Error inesperado al guardar el perfil del Club.');
    } finally {
      this.isSavingClubProfile.set(false);
    }
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
