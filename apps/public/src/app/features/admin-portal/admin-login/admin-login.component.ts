import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { AdminStoreService } from '../../../core/services/admin-store.service';
import { SUPABASE_CLIENT, isSupabaseConfigured } from '../../../core/supabase/supabase.client';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="login-page-container admin-theme">
      <!-- Barra Superior Oficial del Portal -->
      <header class="portal-top-nav">
        <div class="nav-brand-col">
          <a href="https://experiencias.club" class="brand-link" title="Ir a experiencias.club">
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
          <div class="portal-nav-btn active-route">
            <span>Área Restringida</span>
          </div>
        </div>
      </header>

      <!-- Breadcrumb Bar con Fondo Temático Naranja #ff5f00 -->
      <nav class="portal-breadcrumb-bar" aria-label="Ruta de navegación">
        <div class="breadcrumb-inner">
          <a href="https://experiencias.club" class="bc-link">EXPERIENCIAS.CLUB</a>
          <span class="bc-sep">/</span>
          <span class="bc-section">ADMINISTRACIÓN</span>
          <span class="bc-sep">/</span>
          <span class="bc-current" aria-current="page">INICIAR SESIÓN</span>
        </div>
      </nav>

      <!-- Cuerpo con wallpaper de relieve y card de login idéntico a la web principal -->
      <div class="login-wallpaper-body">
        <div class="ambient-overlay"></div>

        <main class="login-main-content">
          <div class="login-wrapper">
            <div class="login-section-card">
              <div class="login-card-header">
                <span class="section-kicker">PORTAL DE ADMINISTRACIÓN</span>
                <h1 class="card-heading">Iniciar Sesión</h1>
              </div>

              <p class="card-subheading">
                Acceso exclusivo con Google para administradores.
              </p>

              @if (errorMessage()) {
                <div class="login-alert-error">
                  <mat-icon class="alert-icon">error_outline</mat-icon>
                  <span>{{ errorMessage() }}</span>
                </div>
              }

              <button
                type="button"
                class="google-auth-btn"
                (click)="signInGoogle()"
                [disabled]="connectingGoogle()"
              >
                <svg class="google-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{{
                  connectingGoogle() ? 'Conectando con Google...' : 'Iniciar sesión con Google (Admin)'
                }}</span>
              </button>

              @if (isDevelopmentMode) {
                <div class="google-auth-separator">
                  <span class="sep-line"></span>
                  <span class="sep-text">O ACCESO DIRECTO DEV</span>
                  <span class="sep-line"></span>
                </div>

                <button type="button" class="quick-admin-btn" (click)="quickLogin()">
                  <div class="quick-admin-info">
                    <strong>Ingresar como Superadmin</strong>
                    <span>gonzagramaglia&#64;gmail.com</span>
                  </div>
                  <span class="quick-badge">Acceder</span>
                </button>
              }

              <div class="admin-perks-box">
                <div class="perk-item">
                  <mat-icon>check_circle</mat-icon>
                  <span>Nómina completa unificada: socios oficiales y lista de espera</span>
                </div>
                <div class="perk-item">
                  <mat-icon>check_circle</mat-icon>
                  <span>Cuentas con Google vinculado marcadas como convertidas</span>
                </div>
                <div class="perk-item">
                  <mat-icon>check_circle</mat-icon>
                  <span>Revisión y validación de todos los comprobantes de pago enviados</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

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
    </div>
  `,
  styles: [
    `
      .login-page-container {
        min-height: 100vh;
        position: relative;
        display: flex;
        flex-direction: column;
        color: #ffffff;
        overflow-x: clip;
        background-color: #0b0603;
      }

      /* ── Top Navigation Bar ── */
      .portal-top-nav {
        height: 68px;
        background: rgba(14, 7, 3, 0.96);
        border-bottom: 1px solid rgba(255, 95, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 1.85rem;
        box-sizing: border-box;
        position: sticky;
        top: 0;
        z-index: 100;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }

      .nav-brand-col {
        display: flex;
        align-items: center;
      }

      .brand-link {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        text-decoration: none;
        color: inherit;
      }

      .portal-emblem-img {
        width: 42px;
        height: 42px;
        object-fit: contain;
      }

      .brand-text {
        display: flex;
        flex-direction: column;
      }

      .brand-title {
        font-size: 1.02rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        color: #ffffff;
        line-height: 1.2;
      }

      .brand-tag {
        font-size: 0.65rem;
        font-weight: 800;
        letter-spacing: 0.15em;
        color: #ff5f00;
        text-transform: uppercase;
      }

      .nav-right-col {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .portal-nav-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 64px;
        box-sizing: border-box;
        padding: 0 1.15rem;
        white-space: nowrap;
        flex-shrink: 0;
        background: transparent;
        border: none;
        border-radius: 0;
        color: #ffffff;
        font-size: 0.82rem;
        font-weight: 800;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        font-family: var(--font-sans);
        text-decoration: none;
        position: relative;
        transition: color 0.15s ease;
      }

      .portal-nav-btn::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0.75rem;
        right: 0.75rem;
        height: 3px;
        background: #ff5f00;
        transform: scaleX(1);
        transform-origin: center;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .badge-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      .nav-back-link {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        color: rgba(255, 255, 255, 0.7);
        text-decoration: none;
        font-size: 0.8rem;
        font-weight: 600;
        transition: color 0.2s ease;
      }

      .nav-back-link:hover {
        color: #ff5f00;
      }

      .link-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      /* ── Breadcrumb Bar Oficial (#ff5f00) ── */
      .portal-breadcrumb-bar {
        min-height: 42px;
        background: #ff5f00;
        display: flex;
        align-items: center;
        padding: 0 1.85rem;
        box-sizing: border-box;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
        position: sticky;
        top: 68px;
        z-index: 90;
      }

      .breadcrumb-inner {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: #0e0502;
        text-transform: uppercase;
      }

      .bc-link {
        color: #0e0502;
        text-decoration: none;
        transition: opacity 0.2s ease;
      }

      .bc-link:hover {
        opacity: 0.8;
      }

      .bc-sep {
        opacity: 0.5;
        font-size: 0.85rem;
      }

      .bc-section {
        color: #0e0502;
        opacity: 0.85;
      }

      .bc-current {
        color: #ffffff;
        font-weight: 800;
      }

      /* ── Wallpaper Body con Relieve Andino ── */
      .login-wallpaper-body {
        flex: 1;
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background-color: #0c0603;
        background-image:
          linear-gradient(rgba(18, 9, 4, 0.88), rgba(12, 6, 2, 0.94)),
          url('/assets/images/relieve.jpeg');
        background-repeat: no-repeat;
        background-position: center top;
        background-size: cover;
        background-attachment: fixed;
      }

      .ambient-overlay {
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 50% 30%, rgba(255, 95, 0, 0.12), transparent 60%);
        pointer-events: none;
      }

      .login-main-content {
        position: relative;
        z-index: 10;
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        padding: 3rem 1.5rem;
        box-sizing: border-box;
      }

      .login-wrapper {
        width: 100%;
        max-width: 480px;
        display: flex;
        flex-direction: column;
      }

      /* ── Login Card (Idéntica a la estructura de la web principal) ── */
      .login-section-card {
        width: 100%;
        box-sizing: border-box;
        background: rgba(22, 11, 5, 0.82);
        border: 1px solid rgba(255, 95, 0, 0.4);
        border-radius: 4px;
        padding: 2.3rem 2rem;
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        box-shadow:
          0 16px 45px rgba(0, 0, 0, 0.65),
          0 0 30px rgba(255, 95, 0, 0.1);
        text-align: left;
        animation: loginCardEntrance 0.45s cubic-bezier(0.16, 1, 0.3, 1) backwards;
      }

      @keyframes loginCardEntrance {
        from {
          opacity: 0;
          transform: translateY(16px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .login-card-header {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        margin-bottom: 0.75rem;
      }

      .section-kicker {
        font-size: 0.68rem;
        letter-spacing: 0.16em;
        color: #ff5f00;
        font-weight: 700;
        display: block;
        margin: 0 0 0.15rem;
        line-height: 1.1;
        text-transform: uppercase;
      }

      .card-heading {
        font-family: var(--font-serif, 'Playfair Display', Georgia, serif);
        font-size: 1.85rem;
        font-weight: 600;
        color: #ffffff;
        margin: 0;
        line-height: 1.15;
      }

      .card-subheading {
        font-size: 0.92rem;
        line-height: 1.55;
        color: rgba(255, 255, 255, 0.75);
        margin: 0 0 1.4rem;
      }

      /* ── Alerta de Error ── */
      .login-alert-error {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        background: rgba(255, 68, 68, 0.18);
        border: 1px solid rgba(255, 68, 68, 0.45);
        color: #fca5a5;
        padding: 0.75rem 1rem;
        border-radius: 3px;
        font-size: 0.85rem;
        margin-bottom: 1.25rem;
      }

      .alert-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }

      /* ── Botón Google (Idéntico a /ingresar de la web principal) ── */
      .google-auth-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        width: 100%;
        padding: 0.85rem 1.25rem;
        border-radius: 3px;
        background: #ffffff;
        color: #111827;
        border: 1px solid rgba(255, 255, 255, 0.25);
        font-family: var(--font-sans, sans-serif);
        font-weight: 600;
        font-size: 0.88rem;
        letter-spacing: 0.01em;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
      }

      .google-auth-btn:hover:not(:disabled) {
        background: #fdfdfd;
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
        border-color: rgba(255, 255, 255, 0.5);
      }

      .google-auth-btn:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }

      .google-icon {
        display: block;
        flex-shrink: 0;
      }

      /* ── Separador y Acceso Rápido Dev ── */
      .google-auth-separator {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.9rem;
        margin: 1.6rem 0 1.2rem;
        width: 100%;
      }

      .sep-line {
        flex: 1;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255, 95, 0, 0.35));
      }

      .google-auth-separator .sep-line:last-child {
        background: linear-gradient(90deg, rgba(255, 95, 0, 0.35), transparent);
      }

      .sep-text {
        font-size: 0.7rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.6);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        white-space: nowrap;
      }

      .quick-admin-btn {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 0.85rem;
        background: rgba(255, 95, 0, 0.12);
        border: 1px solid rgba(255, 95, 0, 0.45);
        padding: 0.85rem 1rem;
        border-radius: 3px;
        color: #ffffff;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: left;
      }

      .quick-admin-btn:hover {
        background: rgba(255, 95, 0, 0.2);
        border-color: #ff5f00;
        transform: translateY(-1px);
      }

      .quick-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
        color: #ff5f00;
        flex-shrink: 0;
      }

      .quick-admin-info {
        display: flex;
        flex-direction: column;
        flex: 1;
      }

      .quick-admin-info strong {
        font-size: 0.86rem;
        color: #ffffff;
      }

      .quick-admin-info span {
        font-size: 0.74rem;
        color: #ffaa73;
        font-family: var(--font-mono, monospace);
      }

      .quick-badge {
        padding: 0.28rem 0.55rem;
        background: #ff5f00;
        color: #0b0704;
        font-size: 0.7rem;
        font-weight: 800;
        border-radius: 2px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      /* ── Perks de Seguridad ── */
      .admin-perks-box {
        margin-top: 1.6rem;
        padding-top: 1.25rem;
        border-top: 1px solid rgba(255, 95, 0, 0.22);
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }

      .perk-item {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.75);
      }

      .perk-item mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #ff5f00;
        margin-top: 1px;
        flex-shrink: 0;
      }

      /* ── Footer Banner ── */
      .portal-footer {
        background: #090402;
        border-top: 1px solid rgba(255, 95, 0, 0.25);
        padding: 2rem 1.85rem;
        margin-top: auto;
      }

      .footer-inner {
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        justify-content: center;
        align-items: center;
        text-align: center;
      }

      .footer-center-logo {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
      }

      .footer-banner-img {
        height: 52px;
        max-width: 90%;
        object-fit: contain;
        display: block;
        filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.6));
      }

      .footer-subtitle {
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.65);
        margin: 0;
        letter-spacing: 0.04em;
      }

      @media (max-width: 640px) {
        .portal-top-nav {
          padding: 0 1rem;
        }
        .portal-nav-btn {
          display: none;
        }
        .portal-breadcrumb-bar {
          padding: 0 1rem;
        }
        .login-main-content {
          padding: 2rem 1rem;
        }
        .login-section-card {
          padding: 1.75rem 1.25rem;
        }
      }
    `,
  ],
})
export class AdminLoginComponent implements OnInit {
  private readonly store = inject(AdminStoreService);
  private readonly pageTitle = inject(Title);
  private readonly supabase = inject(SUPABASE_CLIENT);

  readonly isDevelopmentMode =
    !environment.production &&
    !isSupabaseConfigured() &&
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local'));
  readonly connectingGoogle = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.pageTitle.setTitle('Portal de Admin del Club de Experiencias');
  }

  async ngOnInit(): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        const { data } = await this.supabase.auth.getUser();
        const email = data.user?.email;
        if (email && !this.store.isAuthenticated()) {
          this.errorMessage.set(
            `La cuenta de Google (${email}) no tiene permisos de administrador en la plataforma.`,
          );
          await this.supabase.auth.signOut();
        }
      } catch {
        // Ignorar
      }
    }
  }

  async signInGoogle(): Promise<void> {
    this.connectingGoogle.set(true);
    this.errorMessage.set(null);

    const res = await this.store.signInWithGoogle();
    if (!res.success) {
      this.errorMessage.set(res.error || 'No se pudo completar el inicio de sesión con Google.');
      this.connectingGoogle.set(false);
    }
  }

  quickLogin(): void {
    if (this.isDevelopmentMode) {
      this.store.quickLogin();
    }
  }
}
