import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import {
  ProviderStoreService,
  SEED_PROVIDERS,
} from '../../../core/services/provider-store.service';
import { SUPABASE_CLIENT, isSupabaseConfigured } from '../../../core/supabase/supabase.client';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-provider-login',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="login-page-container provider-theme">
      <!-- Barra Superior Oficial del Portal -->
      <header class="portal-top-nav">
        <div class="nav-brand-col">
          <a href="https://experiencias.club" class="brand-link" title="Ir a experiencias.club">
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
          <div class="portal-nav-btn active-route">
            <span>Panel Operativo</span>
          </div>
        </div>
      </header>

      <!-- Breadcrumb Bar con Fondo Temático Azul/Cyan #80b3ff -->
      <nav class="portal-breadcrumb-bar" aria-label="Ruta de navegación">
        <div class="breadcrumb-inner">
          <a href="https://experiencias.club" class="bc-link">EXPERIENCIAS.CLUB</a>
          <span class="bc-sep">/</span>
          <span class="bc-section">PRESTADORES</span>
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
                <span class="section-kicker">PORTAL DE PRESTADORES</span>
                <h1 class="card-heading">Iniciar Sesión</h1>
              </div>

              <p class="card-subheading">
                Accedé para administrar expediciones y comprobantes.
              </p>

              @if (accountStatus() === 'pending') {
                <div class="login-alert-status alert-pending" role="status">
                  <div class="alert-content">
                    <strong class="alert-title">Postulación en Proceso de Revisión</strong>
                    <p class="alert-text">
                      Tu postulación como prestador para <code>{{ unapprovedEmail() }}</code> fue recibida y se encuentra en validación por el equipo del Club.
                    </p>
                  </div>
                </div>
              } @else if (accountStatus() === 'unregistered') {
                <div class="login-alert-status alert-unregistered" role="status">
                  <div class="alert-content">
                    <strong class="alert-title">Cuenta No Registrada como Prestador</strong>
                    <p class="alert-text">
                      La cuenta <code>{{ unapprovedEmail() }}</code> aún no completó la postulación para ser prestador oficial de EXPERIENCIAS.CLUB.
                    </p>
                    <a
                      href="https://experiencias.club/prestadores"
                      class="alert-action-btn"
                    >
                      Completar Postulación de Prestador
                    </a>
                  </div>
                </div>
              } @else if (accountStatus() === 'inactive') {
                <div class="login-alert-status alert-inactive" role="alert">
                  <mat-icon class="alert-icon">block</mat-icon>
                  <div class="alert-content">
                    <strong class="alert-title">Cuenta Inactiva o en Pausa</strong>
                    <p class="alert-text">
                      Tu cuenta de prestador (<code>{{ unapprovedEmail() }}</code>) se encuentra inactiva o dada de baja. Si considerás que es un error, por favor contactanos a <a href="mailto:ayuda@experiencias.club" class="link-inline">ayuda@experiencias.club</a>.
                    </p>
                  </div>
                </div>
              } @else if (errorMessage()) {
                <div class="login-alert-error" role="alert">
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
                  connectingGoogle()
                    ? 'Conectando con Google...'
                    : 'Iniciar sesión con Google (Prestadores)'
                }}</span>
              </button>

              @if (isDevelopmentMode) {
                <div class="google-auth-separator">
                  <span class="sep-line"></span>
                  <span class="sep-text">O ACCESO DIRECTO DEV</span>
                  <span class="sep-line"></span>
                </div>

                <div class="demo-buttons">
                  @for (p of demoProviders; track p.id) {
                    <button type="button" class="demo-btn" (click)="quickLogin(p.id)">
                      <img
                        [src]="p.avatar"
                        [alt]="p.name"
                        class="demo-avatar"
                        referrerpolicy="no-referrer"
                      />
                      <div class="demo-info">
                        <strong>{{ p.name }}</strong>
                        <span>{{ p.agency }}</span>
                      </div>
                      <span class="demo-enter-label">Acceder</span>
                    </button>
                  }
                </div>
              }

              <div class="provider-perks-box">
                <div class="perk-item">
                  <mat-icon>check_circle</mat-icon>
                  <span>Gestión integral de expediciones, cupos y convocatorias</span>
                </div>
                <div class="perk-item">
                  <mat-icon>check_circle</mat-icon>
                  <span>Conciliación directa de transferencias y comprobantes de socios</span>
                </div>
                <div class="perk-item">
                  <mat-icon>check_circle</mat-icon>
                  <span>Subida de fotos y videos en alta resolución con enlace directo</span>
                </div>
              </div>

              <div class="provider-footer-help">
                ¿Aún no tenés cuenta de prestador aprobada?
                <a
                  href="https://experiencias.club/prestadores"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="link-btn"
                >
                  Postulate acá
                </a>
              </div>
            </div>
          </div>
        </main>
      </div>

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
  styles: [
    `
      .login-page-container {
        min-height: 100vh;
        position: relative;
        display: flex;
        flex-direction: column;
        color: #ffffff;
        overflow-x: clip;
        background-color: #80b3ff !important;
        background-image:
          linear-gradient(
            180deg,
            rgba(128, 179, 255, 0.92) 0%,
            rgba(120, 175, 255, 0.89) 50%,
            rgba(128, 179, 255, 0.93) 100%
          ),
          url('/assets/images/relieve.jpeg') !important;
        background-repeat: no-repeat !important;
        background-position: center top !important;
        background-size: cover !important;
        background-attachment: fixed !important;
      }

      /* ── Top Navigation Bar ── */
      .portal-top-nav {
        height: 68px;
        background: rgba(5, 10, 24, 0.96);
        border-bottom: 1px solid rgba(128, 179, 255, 0.25);
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
        color: #80b3ff;
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
        background: #80b3ff;
        transform: scaleX(0);
        transform-origin: center;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .portal-nav-btn:hover::after,
      .portal-nav-btn.active-route::after {
        transform: scaleX(1);
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
        color: #80b3ff;
      }

      .link-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      /* ── Breadcrumb Bar Oficial (#80b3ff) ── */
      .portal-breadcrumb-bar {
        min-height: 42px;
        background: #80b3ff;
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
        color: #050e24;
        text-transform: uppercase;
      }

      .bc-link {
        color: #050e24;
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
        color: #050e24;
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
        background: transparent;
      }

      .ambient-overlay {
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 50% 30%, rgba(128, 179, 255, 0.12), transparent 60%);
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
        background: rgba(8, 16, 36, 0.82);
        border: 1px solid rgba(128, 179, 255, 0.35);
        border-radius: 4px;
        padding: 2.3rem 2rem;
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        box-shadow:
          0 16px 45px rgba(0, 0, 0, 0.65),
          0 0 30px rgba(128, 179, 255, 0.1);
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
        color: #80b3ff;
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

      /* ── Alertas de Estado Inteligente ── */
      .login-alert-status {
        display: flex;
        align-items: flex-start;
        gap: 0.85rem;
        padding: 0.95rem 1.15rem;
        border-radius: 4px;
        font-size: 0.88rem;
        line-height: 1.45;
        margin-bottom: 1.35rem;
        text-align: left;
        box-sizing: border-box;
      }
      .login-alert-status .alert-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
        flex-shrink: 0;
        margin-top: 1px;
      }
      .alert-content {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .alert-title {
        font-size: 0.92rem;
        font-weight: 800;
        letter-spacing: 0.01em;
      }
      .alert-text {
        margin: 0;
        font-size: 0.83rem;
        line-height: 1.5;
        color: rgba(255, 255, 255, 0.9);
      }
      .alert-text code {
        background: rgba(0, 0, 0, 0.35);
        padding: 0.15rem 0.4rem;
        border-radius: 3px;
        font-size: 0.8rem;
        color: #ffffff;
      }
      .alert-pending {
        background: rgba(255, 170, 0, 0.16);
        border: 1px solid rgba(255, 170, 0, 0.45);
        color: #ffe082;
      }
      .alert-pending .alert-icon,
      .alert-pending .alert-title {
        color: #ffcc00;
      }
      .alert-unregistered {
        background: rgba(128, 179, 255, 0.16);
        border: 1px solid rgba(128, 179, 255, 0.45);
        color: #d6e8ff;
      }
      .alert-unregistered .alert-icon,
      .alert-unregistered .alert-title {
        color: #80b3ff;
      }
      .alert-action-btn {
        display: inline-flex;
        align-items: center;
        margin-top: 0.4rem;
        padding: 0.45rem 0.95rem;
        background: #80b3ff;
        color: #050a18;
        font-size: 0.82rem;
        font-weight: 800;
        border-radius: 3px;
        text-decoration: none;
        width: fit-content;
        transition: all 0.2s ease;
      }
      .alert-action-btn:hover {
        background: #a3cbff;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(128, 179, 255, 0.35);
      }
      .alert-inactive {
        background: rgba(255, 68, 68, 0.18);
        border: 1px solid rgba(255, 68, 68, 0.45);
        color: #fca5a5;
      }
      .alert-inactive .alert-icon,
      .alert-inactive .alert-title {
        color: #ef4444;
      }
      .link-inline {
        color: #ffffff;
        text-decoration: underline;
        font-weight: 700;
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
        background: linear-gradient(90deg, transparent, rgba(128, 179, 255, 0.35));
      }

      .google-auth-separator .sep-line:last-child {
        background: linear-gradient(90deg, rgba(128, 179, 255, 0.35), transparent);
      }

      .sep-text {
        font-size: 0.7rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.6);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        white-space: nowrap;
      }

      .demo-buttons {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
      }

      .demo-btn {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 0.85rem;
        background: rgba(128, 179, 255, 0.1);
        border: 1px solid rgba(128, 179, 255, 0.35);
        padding: 0.75rem 0.9rem;
        border-radius: 3px;
        color: #ffffff;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: left;
      }

      .demo-btn:hover {
        background: rgba(128, 179, 255, 0.2);
        border-color: #80b3ff;
        transform: translateY(-1px);
      }

      .demo-avatar {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        object-fit: cover;
        border: 1px solid rgba(128, 179, 255, 0.5);
      }

      .demo-info {
        flex: 1;
        display: flex;
        flex-direction: column;
      }

      .demo-info strong {
        font-size: 0.85rem;
        color: #ffffff;
      }

      .demo-info span {
        font-size: 0.73rem;
        color: #80b3ff;
      }

      .demo-enter-label {
        font-size: 0.7rem;
        font-weight: 800;
        color: #040a1d;
        background: #80b3ff;
        padding: 0.25rem 0.55rem;
        border-radius: 2px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      /* ── Perks de Seguridad ── */
      .provider-perks-box {
        margin-top: 1.6rem;
        padding-top: 1.25rem;
        border-top: 1px solid rgba(128, 179, 255, 0.2);
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
        color: #80b3ff;
        margin-top: 1px;
        flex-shrink: 0;
      }

      .provider-footer-help {
        margin-top: 1.35rem;
        text-align: center;
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.65);
      }

      .link-btn {
        background: none;
        border: none;
        color: #80b3ff;
        font-weight: 700;
        text-decoration: underline;
        margin-left: 0.35rem;
      }

      .link-btn:hover {
        color: #b3d1ff;
      }

      /* ── Footer Banner ── */
      .portal-footer {
        background: #040813;
        border-top: 1px solid rgba(128, 179, 255, 0.2);
        padding: 2rem 1.85rem;
        margin-top: auto;
      }

      .footer-inner {
        max-width: 1120px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 0.5rem;
      }

      .footer-center-logo {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
      }

      .footer-banner-img {
        height: 40px;
        max-width: 90%;
        width: auto;
        object-fit: contain;
        filter: drop-shadow(0 2px 10px rgba(128, 179, 255, 0.3));
      }

      .footer-subtitle {
        font-size: 0.82rem;
        color: rgba(255, 255, 255, 0.6);
        margin: 0.45rem 0 0;
        max-width: 540px;
      }

      @media (max-width: 680px) {
        .portal-top-nav {
          padding: 0 1rem;
        }
        .portal-nav-btn {
          display: none !important;
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
export class ProviderLoginComponent implements OnInit {
  private readonly store = inject(ProviderStoreService);
  private readonly router = inject(Router);
  private readonly pageTitle = inject(Title);
  private readonly supabase = inject(SUPABASE_CLIENT);

  readonly isDevelopmentMode =
    !environment.production &&
    !isSupabaseConfigured() &&
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local'));
  readonly demoProviders = SEED_PROVIDERS.filter((p) => p.name.includes('Patricio'));
  readonly errorMessage = signal<string | null>(null);
  readonly connectingGoogle = signal(false);
  readonly accountStatus = signal<'none' | 'pending' | 'unregistered' | 'inactive'>('none');
  readonly unapprovedEmail = signal<string>('');

  constructor() {
    this.pageTitle.setTitle('Portal de Prestadores del Club de Experiencias');
  }

  private resolveDashboardPath(): string {
    const isBrowser = typeof window !== 'undefined';
    const host = isBrowser ? window.location.hostname.toLowerCase() : '';
    const search = isBrowser ? window.location.search.toLowerCase() : '';
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
    const isProviderHost =
      host.startsWith('prestadores.') ||
      host.includes('prestadores.experiencias') ||
      (isLocalHost && (search.includes('portal=prestador') || search.includes('prestador=true')));

    return isProviderHost ? '/dashboard' : '/prestadores/panel/dashboard';
  }

  async ngOnInit(): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        const restored = await this.store.restoreSupabaseSession();
        if (restored && this.store.isProviderApproved()) {
          this.router.navigate([this.resolveDashboardPath()]);
          return;
        }

        const { data } = await this.supabase.auth.getUser();
        const rawEmail = data.user?.email;
        if (rawEmail) {
          const cleanEmail = rawEmail.trim().toLowerCase();
          this.unapprovedEmail.set(cleanEmail);
          const navigated = await this.evaluateUnapprovedStatus(cleanEmail);
          if (!navigated) {
            await this.supabase.auth.signOut();
          }
        }
      } catch {
        // Ignorar errores de verificación inicial
      }
    }
  }

  private async evaluateUnapprovedStatus(email: string): Promise<boolean> {
    try {
      const cleanEmail = email.trim().toLowerCase();

      // 1. Intentar verificación mediante RPC segura (Security Definer)
      try {
        const { data: rpcRes, error: rpcErr } = await (this.supabase as any).rpc(
          'check_provider_status',
          { p_email: cleanEmail },
        );
        if (!rpcErr && rpcRes && typeof (rpcRes as any).status === 'string') {
          const st = (rpcRes as any).status;
          if (st === 'inactive' || st === 'pending') {
            this.accountStatus.set(st);
            return false;
          }
          if (st === 'approved') {
            const restored = await this.store.restoreSupabaseSession();
            if (restored && this.store.isProviderApproved()) {
              this.router.navigate([this.resolveDashboardPath()]);
              return true;
            }
          }
        }
      } catch (rpcEx) {
        console.warn('[ProviderLogin] RPC check_provider_status fallback:', rpcEx);
      }

      // 2. Verificar vía backend /api/notify (con service role key para bypass de RLS)
      try {
        const notifyRes = await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'CHECK_PROVIDER_STATUS',
            data: { email: cleanEmail },
          }),
        });
        if (notifyRes.ok) {
          const resJson = await notifyRes.json();
          if (resJson?.success && typeof resJson.status === 'string') {
            const st = resJson.status;
            if (st === 'inactive' || st === 'pending') {
              this.accountStatus.set(st);
              return false;
            }
            if (st === 'approved') {
              const restored = await this.store.restoreSupabaseSession();
              if (restored && this.store.isProviderApproved()) {
                this.router.navigate([this.resolveDashboardPath()]);
                return true;
              }
            }
            if (st === 'unregistered') {
              this.accountStatus.set('unregistered');
              return false;
            }
          }
        }
      } catch (notifyEx) {
        console.warn('[ProviderLogin] /api/notify status check fallback:', notifyEx);
      }

      // 3. Fallback a consultas directas en tablas de Supabase
      const { data: access, error: accessErr } = await (this.supabase.from('prestadores') as any)
        .select('status, active')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (accessErr) {
        console.warn('[ProviderLogin] Error al verificar prestadores:', accessErr);
      }

      if (access) {
        if (access.status === 'pendiente') {
          this.accountStatus.set('pending');
          return false;
        }
        if (
          access.status === 'dado_de_baja' ||
          access.status === 'rechazado' ||
          access.active === false
        ) {
          this.accountStatus.set('inactive');
          return false;
        }
      }

      this.accountStatus.set('unregistered');
      return false;
    } catch (err) {
      console.warn('[ProviderLogin] Error general al verificar estado de postulación:', err);
      this.accountStatus.set('unregistered');
      return false;
    }
  }

  async signInGoogle(): Promise<void> {
    this.errorMessage.set(null);
    this.accountStatus.set('none');
    this.unapprovedEmail.set('');
    this.connectingGoogle.set(true);
    const result = await this.store.signInWithGoogle();
    this.connectingGoogle.set(false);
    if (!result.success) {
      this.errorMessage.set(result.message);
    }
  }

  quickLogin(providerId: string): void {
    if (this.isDevelopmentMode) {
      this.store.loginAs(providerId);
      this.router.navigate([this.resolveDashboardPath()]);
    }
  }
}
