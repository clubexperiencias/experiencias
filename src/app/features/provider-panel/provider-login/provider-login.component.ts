import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import {
  ProviderStoreService,
  SEED_PROVIDERS,
} from '../../../core/services/provider-store.service';
import { SUPABASE_CLIENT, isSupabaseConfigured } from '../../../core/supabase/supabase.client';

@Component({
  selector: 'app-provider-login',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <div class="logos-brand-box">
            <img
              src="/assets/aistudio/logo-prestadores-experiencias_9372e925.png"
              alt="Emblema Prestadores"
              class="login-emblem-img"
              referrerpolicy="no-referrer"
            />
            <div class="login-brand-text">
              <span class="brand-title">EXPERIENCIAS.CLUB</span>
              <span class="brand-tag">PRESTADORES</span>
            </div>
          </div>
          <h1 class="login-title">Ingreso al Panel Operativo</h1>
          <p class="login-sub">
            Ingreso exclusivo con Google para prestadores, guías y agencias oficiales habilitadas.
          </p>
        </div>

        <button
          type="button"
          class="submit-btn google-submit-btn"
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
          {{
            connectingGoogle()
              ? 'Conectando con Google...'
              : 'Iniciar sesión con Google (Prestadores)'
          }}
        </button>

        @if (errorMessage()) {
          <div class="alert-error">
            <mat-icon>error_outline</mat-icon>
            <span>{{ errorMessage() }}</span>
          </div>
        }

        @if (isDevelopmentMode) {
          <div class="divider">
            <span>O ACCESO DIRECTO DE DESARROLLO</span>
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
            <span>Subida de fotos y videos a Cloudflare R2 con enlace directo</span>
          </div>
        </div>

        <div class="provider-footer-help">
          ¿Aún no tenés cuenta de prestador aprobada?
          <a
            href="https://experiencias.club/prestadores"
            target="_blank"
            rel="noopener"
            class="link-btn"
          >
            Postulate acá
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .login-container {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 2rem 1rem;
        min-height: calc(100dvh - 160px);
        box-sizing: border-box;
      }
      .login-card {
        width: 100%;
        max-width: 520px;
        background: rgba(18, 28, 64, 0.85);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(128, 179, 255, 0.35);
        border-radius: 3px;
        padding: 2.25rem;
        box-shadow:
          0 20px 50px rgba(0, 0, 0, 0.65),
          0 0 25px rgba(128, 179, 255, 0.12);
      }
      .login-header {
        margin-bottom: 2rem;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .logos-brand-box {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        margin-bottom: 1.25rem;
      }
      .login-emblem-img {
        height: 48px;
        width: 48px;
        object-fit: contain;
        border-radius: 2px;
        filter: drop-shadow(0 2px 8px rgba(128, 179, 255, 0.35));
      }
      .login-brand-text {
        display: flex;
        flex-direction: column;
        text-align: left;
      }
      .brand-title {
        font-family: var(--font-sans, system-ui, sans-serif);
        font-size: 1.15rem;
        font-weight: 800;
        letter-spacing: -0.015em;
        color: #ffffff;
        line-height: 1.1;
        text-transform: uppercase;
      }
      .brand-tag {
        font-family: var(--font-sans, system-ui, sans-serif);
        font-size: 0.85rem;
        letter-spacing: 0.16em;
        color: #80b3ff;
        font-weight: 700;
        margin-top: 2px;
        text-transform: uppercase;
      }
      .login-title {
        font-size: 1.55rem;
        font-weight: 700;
        color: #ffffff;
        margin-bottom: 0.4rem;
        letter-spacing: -0.02em;
      }
      .login-sub {
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.72);
        line-height: 1.5;
        margin: 0;
      }
      .submit-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 0.85rem 1.25rem;
        background: #80b3ff;
        color: #060b17;
        font-weight: 700;
        font-size: 0.92rem;
        border-radius: 2px;
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .google-submit-btn {
        background: #ffffff;
        color: #202124;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.25);
      }
      .google-submit-btn:hover:not(:disabled) {
        background: #f1f3f4;
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
      }
      .google-submit-btn:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }
      .google-icon {
        flex: 0 0 auto;
      }
      .alert-error {
        margin-top: 1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        background: rgba(239, 68, 68, 0.2);
        border: 1px solid rgba(239, 68, 68, 0.45);
        border-radius: 2px;
        color: #fca5a5;
        font-size: 0.82rem;
      }
      .divider {
        display: flex;
        align-items: center;
        text-align: center;
        margin: 1.75rem 0 1.25rem;
        color: rgba(255, 255, 255, 0.45);
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.08em;
      }
      .divider::before,
      .divider::after {
        content: '';
        flex: 1;
        border-bottom: 1px solid rgba(128, 179, 255, 0.25);
      }
      .divider span {
        padding: 0 0.85rem;
      }
      .demo-buttons {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
      }
      .demo-btn {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        width: 100%;
        padding: 0.75rem 0.85rem;
        background: rgba(7, 13, 28, 0.6);
        border: 1px solid rgba(128, 179, 255, 0.2);
        border-radius: 2px;
        color: #ffffff;
        text-align: left;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .demo-btn:hover {
        background: rgba(128, 179, 255, 0.15);
        border-color: #80b3ff;
        transform: translateY(-1px);
      }
      .demo-avatar {
        width: 34px;
        height: 34px;
        border-radius: 2px;
        object-fit: cover;
        border: 1px solid #80b3ff;
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
        font-size: 0.75rem;
        color: #80b3ff;
      }
      .demo-enter-label {
        font-size: 0.72rem;
        font-weight: 800;
        color: #060b17;
        background: #80b3ff;
        padding: 0.25rem 0.6rem;
        border-radius: 1px;
        text-transform: uppercase;
      }
      .provider-perks-box {
        margin-top: 1.75rem;
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
        margin-top: 1.25rem;
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
        color: #a6c8ff;
      }
    `,
  ],
})
export class ProviderLoginComponent implements OnInit {
  private readonly store = inject(ProviderStoreService);
  private readonly router = inject(Router);
  private readonly supabase = inject(SUPABASE_CLIENT);

  readonly isDevelopmentMode = !isSupabaseConfigured();
  readonly demoProviders = SEED_PROVIDERS;
  readonly errorMessage = signal<string | null>(null);
  readonly connectingGoogle = signal(false);

  async ngOnInit(): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        const { data } = await this.supabase.auth.getUser();
        const email = data.user?.email;
        if (email && (!this.store.isAuthenticated() || !this.store.isProviderApproved())) {
          this.errorMessage.set(
            `La cuenta de Google (${email}) no tiene un perfil de prestador aprobado en la plataforma.`,
          );
          await this.supabase.auth.signOut();
        }
      } catch {
        // Ignorar
      }
    }
  }

  async signInGoogle(): Promise<void> {
    this.errorMessage.set(null);
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
      const isBrowser = typeof window !== 'undefined';
      const host = isBrowser ? window.location.hostname.toLowerCase() : '';
      const search = isBrowser ? window.location.search.toLowerCase() : '';
      const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
      const isProviderHost =
        host.startsWith('prestadores.') ||
        host.includes('prestadores.experiencias') ||
        (isLocalHost && (search.includes('portal=prestador') || search.includes('prestador=true')));

      const targetPath = isProviderHost ? '/dashboard' : '/prestadores/panel/dashboard';
      this.router.navigate([targetPath]);
    }
  }
}
