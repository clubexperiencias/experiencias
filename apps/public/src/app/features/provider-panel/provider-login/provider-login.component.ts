import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProviderStoreService, SEED_PROVIDERS } from '../../../core/services/provider-store.service';

@Component({
  selector: 'app-provider-login',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule],
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
          <div class="portal-badge">
            <span class="square-dot"></span>
            PORTAL OFICIAL PRESTADORES · EXPERIENCIAS.CLUB
          </div>
          <h1 class="login-title">Ingreso al Panel Operativo</h1>
          <p class="login-sub">
            Gestioná tus expediciones andinas, revisá los ingresos de tus salidas y validá comprobantes de los socios.
          </p>
        </div>

        <!-- Quick Demo Profiles for 1-click testing -->
        <div class="demo-box">
          <div class="demo-title">
            ACCESO RÁPIDO PARA PRUEBAS
          </div>
          <div class="demo-buttons">
            @for (p of demoProviders; track p.id) {
              <button
                type="button"
                class="demo-btn"
                (click)="quickLogin(p.id)"
              >
                <img [src]="p.avatar" [alt]="p.name" class="demo-avatar" referrerpolicy="no-referrer" />
                <div class="demo-info">
                  <strong>{{ p.name }}</strong>
                  <span>{{ p.agency }}</span>
                </div>
                <span class="demo-enter-label">Ingresar</span>
              </button>
            }
          </div>
        </div>

        <div class="divider">
          <span>o ingresá con tu cuenta</span>
        </div>

        @if (!showRegister()) {
          <!-- Login Form -->
          <form [formGroup]="loginForm" (ngSubmit)="onLogin()" class="login-form">
            <div class="form-group">
              <label for="email" class="form-label">Correo electrónico corporativo</label>
              <input
                id="email"
                type="email"
                formControlName="email"
                class="form-input"
                placeholder="ejemplo@prestador.com"
                autocomplete="email"
              />
            </div>

            <div class="form-group">
              <label for="password" class="form-label">Contraseña</label>
              <input
                id="password"
                type="password"
                formControlName="password"
                class="form-input"
                placeholder="••••••••"
                autocomplete="current-password"
              />
            </div>

            @if (errorMessage()) {
              <div class="alert-error">
                <span>{{ errorMessage() }}</span>
              </div>
            }

            <button type="submit" class="submit-btn" [disabled]="loginForm.invalid">
              Ingresar al Panel
            </button>

            <div class="switch-action">
              ¿Sos un nuevo prestador o guía en Catamarca?
              <button type="button" class="link-btn" (click)="showRegister.set(true)">
                Registrar emprendimiento
              </button>
            </div>
          </form>
        } @else {
          <!-- Register Form -->
          <form [formGroup]="registerForm" (ngSubmit)="onRegister()" class="login-form">
            <div class="form-group">
              <label class="form-label">Nombre y Apellido del responsable</label>
              <input type="text" formControlName="name" class="form-input" placeholder="Ej: Marcos Albarracín" />
            </div>

            <div class="form-group">
              <label class="form-label">Nombre del Emprendimiento / Agencia</label>
              <input type="text" formControlName="agency" class="form-input" placeholder="Ej: Puna Secreta 4x4" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">CUIT o DNI</label>
                <input type="text" formControlName="cuitDni" class="form-input" placeholder="20-33445566-7" />
              </div>
              <div class="form-group">
                <label class="form-label">Teléfono / WhatsApp</label>
                <input type="text" formControlName="phone" class="form-input" placeholder="+54 383 4..." />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Correo electrónico</label>
              <input type="email" formControlName="email" class="form-input" placeholder="contacto@agencia.com" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">CBU o Alias de cobro</label>
                <input type="text" formControlName="cbuAlias" class="form-input" placeholder="ALIAS.COBRO.MP" />
              </div>
              <div class="form-group">
                <label class="form-label">Banco / Billetera</label>
                <input type="text" formControlName="bankName" class="form-input" placeholder="Ej: Banco Nación" />
              </div>
            </div>

            @if (errorMessage()) {
              <div class="alert-error">
                <span>{{ errorMessage() }}</span>
              </div>
            }

            <button type="submit" class="submit-btn" [disabled]="registerForm.invalid">
              Registrar Emprendimiento
            </button>

            <div class="switch-action">
              ¿Ya tenés cuenta?
              <button type="button" class="link-btn" (click)="showRegister.set(false)">
                Volver al inicio de sesión
              </button>
            </div>
          </form>
        }
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 3rem 1rem;
      min-height: calc(100vh - 200px);
    }
    .login-card {
      width: 100%;
      max-width: 520px;
      background: rgba(18, 28, 64, 0.75);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(128, 179, 255, 0.35);
      border-radius: 2px;
      padding: 2.5rem;
      box-shadow: 0 15px 40px rgba(0, 0, 0, 0.65);
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
      height: 44px;
      width: 44px;
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
      font-size: 0.82rem;
      letter-spacing: 0.16em;
      color: #80b3ff;
      font-weight: 700;
      margin-top: 2px;
      text-transform: uppercase;
    }
    .portal-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.3rem 0.75rem;
      background: rgba(128, 179, 255, 0.12);
      border: 1px solid rgba(128, 179, 255, 0.35);
      border-radius: 2px;
      color: #80b3ff;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
    }
    .square-dot {
      width: 6px;
      height: 6px;
      background: #80b3ff;
    }
    .login-title {
      font-size: 1.6rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 0.4rem;
      letter-spacing: -0.02em;
    }
    .login-sub {
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.7);
      line-height: 1.5;
      margin: 0;
    }
    .demo-box {
      background: rgba(128, 179, 255, 0.05);
      border: 1px solid rgba(128, 179, 255, 0.25);
      border-radius: 2px;
      padding: 1.25rem;
      margin-bottom: 1.75rem;
    }
    .demo-title {
      font-size: 0.72rem;
      font-weight: 700;
      color: #80b3ff;
      letter-spacing: 0.08em;
      margin-bottom: 0.75rem;
      text-transform: uppercase;
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
      padding: 0.65rem 0.85rem;
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
      font-size: 0.75rem;
      font-weight: 700;
      color: #80b3ff;
      border: 1px solid rgba(128, 179, 255, 0.4);
      padding: 0.2rem 0.6rem;
      border-radius: 2px;
    }
    .divider {
      display: flex;
      align-items: center;
      text-align: center;
      margin: 1.5rem 0;
      color: rgba(255, 255, 255, 0.4);
      font-size: 0.8rem;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      border-bottom: 1px solid rgba(128, 179, 255, 0.15);
    }
    .divider span {
      padding: 0 0.75rem;
    }
    .login-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    @media (max-width: 480px) {
      .form-row {
        grid-template-columns: 1fr;
      }
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .form-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.85);
    }
    .form-input {
      width: 100%;
      background: rgba(7, 13, 28, 0.65);
      border: 1px solid rgba(128, 179, 255, 0.25);
      border-radius: 2px;
      padding: 0.75rem 0.85rem;
      color: #ffffff;
      font-size: 0.9rem;
      transition: all 0.2s ease;
    }
    .form-input:focus {
      outline: none;
      border-color: #80b3ff;
      background: rgba(12, 22, 48, 0.85);
    }
    .alert-error {
      padding: 0.75rem;
      background: rgba(255, 80, 80, 0.15);
      border: 1px solid rgba(255, 80, 80, 0.3);
      border-radius: 2px;
      color: #ff8080;
      font-size: 0.85rem;
    }
    .submit-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.85rem;
      background: #80b3ff;
      color: #060b17;
      font-weight: 700;
      font-size: 0.92rem;
      border-radius: 2px;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-top: 0.5rem;
    }
    .submit-btn:hover:not(:disabled) {
      background: #a6c8ff;
    }
    .submit-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .switch-action {
      text-align: center;
      font-size: 0.82rem;
      color: rgba(255, 255, 255, 0.65);
      margin-top: 0.5rem;
    }
    .link-btn {
      background: none;
      border: none;
      color: #80b3ff;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
      margin-left: 0.25rem;
    }
    .link-btn:hover {
      color: #a6c8ff;
    }
  `],
})
export class ProviderLoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(ProviderStoreService);
  private readonly router = inject(Router);

  readonly demoProviders = SEED_PROVIDERS;
  readonly showRegister = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly loginForm = this.fb.nonNullable.group({
    email: ['guia@experiencias.club', [Validators.required, Validators.email]],
    password: ['prestador2026', [Validators.required, Validators.minLength(4)]],
  });

  readonly registerForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    agency: ['', [Validators.required, Validators.minLength(4)]],
    cuitDni: ['', [Validators.required, Validators.minLength(7)]],
    phone: ['', [Validators.required, Validators.minLength(8)]],
    email: ['', [Validators.required, Validators.email]],
    cbuAlias: ['', [Validators.required, Validators.minLength(6)]],
    bankName: ['Banco Nación / Mercado Pago', Validators.required],
  });

  quickLogin(providerId: string): void {
    this.store.loginAs(providerId);
    this.router.navigate(['/prestadores/dashboard']);
  }

  onLogin(): void {
    if (this.loginForm.invalid) return;
    const { email } = this.loginForm.getRawValue();
    this.store.login(email);
    this.router.navigate(['/prestadores/dashboard']);
  }

  onRegister(): void {
    if (this.registerForm.invalid) return;
    const data = this.registerForm.getRawValue();
    this.store.register(data);
    this.router.navigate(['/prestadores/dashboard']);
  }
}
