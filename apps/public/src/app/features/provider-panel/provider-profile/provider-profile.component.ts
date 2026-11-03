import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProviderStoreService } from '../../../core/services/provider-store.service';

@Component({
  selector: 'app-provider-profile',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <div class="profile-container">
      <div class="profile-head">
        <div>
          <span class="section-kicker">CUENTA Y FISCALIDAD</span>
          <h2 class="card-heading">Perfil del Prestador y Datos de Cobro</h2>
          <p class="card-subheading">
            Esta información se utiliza para las fichas técnicas de tus experiencias y los datos de destino donde los socios transfieren los pagos.
          </p>
        </div>
      </div>

      <!-- Alerta informativa de auditoría bancaria -->
      <aside class="audit-notice-card" aria-label="Aviso de seguridad bancaria">
        <mat-icon class="audit-icon">verified_user</mat-icon>
        <div class="audit-text">
          <strong class="audit-title">Registro Seguro de Datos Bancarios</strong>
          <p class="audit-desc">
            Podés actualizar tus datos de cobro cuando lo necesites. Cada modificación queda registrada con fecha y hora de auditoría para asegurar la trazabilidad y la correcta acreditación de los comprobantes de tus socios.
          </p>
        </div>
      </aside>

      <div class="profile-card">
        <form [formGroup]="form" (ngSubmit)="onSave()" class="profile-form">
          <div class="form-section">
            <h3 class="section-title">Datos del Emprendimiento</h3>

            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Email Asociado a la Cuenta</label>
                <input
                  type="email"
                  [value]="store.currentProvider()?.email || 'prestador@experiencias.club'"
                  class="form-input text-muted"
                  readonly
                  disabled
                />
                <span class="field-hint"
                  >Email oficial verificado vinculado a tu cuenta de prestador</span
                >
              </div>

              <div class="form-group">
                <label class="form-label">Nombre Comercial o Agencia</label>
                <input
                  type="text"
                  formControlName="agency"
                  class="form-input"
                  placeholder="Ej. Catamarca Kayak & Aventura"
                />
              </div>

              <div class="form-group">
                <label class="form-label">Teléfono / WhatsApp de Contacto</label>
                <input
                  type="text"
                  formControlName="phone"
                  class="form-input"
                  placeholder="Ej. +54 9 383 455-8812"
                />
              </div>
            </div>
          </div>

          <div class="form-section">
            <div>
              <h3 class="section-title">Datos Bancarios para Transferencias de Socios</h3>
              <p class="section-desc">
                Es la cuenta bancaria o billetera donde los socios transferirán los importes bonificados de sus reservas.
              </p>
            </div>

            <div class="form-grid">
              <div class="form-group full-col">
                <label class="form-label">CBU o Alias de Destino</label>
                <input
                  type="text"
                  formControlName="cbuAlias"
                  class="form-input text-mono"
                  placeholder="Ej. EXPERIENCIAS.CLUB.MP o 22 dígitos"
                />
                <span class="field-hint">Alias o CBU de 22 dígitos exactos</span>
              </div>

              <div class="form-group">
                <label class="form-label">Nombre / Titular de la Cuenta</label>
                <input
                  type="text"
                  formControlName="name"
                  class="form-input"
                  placeholder="Ej. Gonzalo Gramaglia"
                />
              </div>

              <div class="form-group">
                <label class="form-label">CUIT / CUIL del Titular</label>
                <input
                  type="text"
                  formControlName="cuitDni"
                  class="form-input text-mono"
                  placeholder="Ej. 20-33445566-7"
                />
              </div>

              <div class="form-group full-col">
                <label class="form-label">Entidad Bancaria o Billetera</label>
                <input
                  type="text"
                  formControlName="bankName"
                  class="form-input"
                  placeholder="Ej. Banco Nación / Mercado Pago"
                />
              </div>
            </div>
          </div>

          @if (savedSuccess()) {
            <div class="alert-success" role="status">
              <mat-icon class="alert-icon">check_circle</mat-icon>
              <span>¡Perfil y datos bancarios actualizados correctamente! El historial de cambios ha sido registrado.</span>
            </div>
          }

          @if (errorMessage()) {
            <div class="alert-error" role="alert">
              <mat-icon class="alert-icon">error_outline</mat-icon>
              <span>{{ errorMessage() }}</span>
            </div>
          }

          <div class="form-actions-split">
            <button type="button" class="btn-logout" (click)="onLogout()">
              <mat-icon class="btn-icon">logout</mat-icon>
              <span>Cerrar Sesión</span>
            </button>
            <button
              type="submit"
              class="cta-save-btn"
              [disabled]="form.invalid || isSaving()"
            >
              @if (isSaving()) {
                <span>Guardando...</span>
              } @else {
                <span>Guardar Cambios</span>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [
    `
      .profile-container {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        max-width: 900px;
        margin: 0 auto;
        padding-bottom: 3rem;
      }
      .section-kicker {
        font-size: 0.72rem;
        font-weight: 700;
        color: #80b3ff;
        letter-spacing: 0.08em;
      }
      .card-heading {
        font-size: 1.5rem;
        font-weight: 700;
        color: #ffffff;
        margin: 0.2rem 0;
      }
      .card-subheading {
        font-size: 0.88rem;
        color: rgba(255, 255, 255, 0.7);
        margin: 0;
        line-height: 1.5;
      }
      .audit-notice-card {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        padding: 1.15rem 1.35rem;
        background: rgba(13, 30, 68, 0.55);
        border: 1px solid rgba(128, 179, 255, 0.35);
        border-radius: 2px;
        backdrop-filter: blur(10px);
      }
      .audit-icon {
        color: #80b3ff;
        font-size: 1.5rem;
        width: 1.5rem;
        height: 1.5rem;
        flex-shrink: 0;
        margin-top: 0.15rem;
      }
      .audit-text {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }
      .audit-title {
        color: #80b3ff;
        font-size: 0.88rem;
        font-weight: 700;
        letter-spacing: 0.02em;
      }
      .audit-desc {
        color: rgba(255, 255, 255, 0.78);
        font-size: 0.82rem;
        line-height: 1.5;
        margin: 0;
      }
      .profile-card {
        background: rgba(22, 33, 85, 0.55);
        border: 1px solid rgba(128, 179, 255, 0.35);
        border-radius: 2px;
        padding: 2rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
      }
      @media (max-width: 600px) {
        .profile-card {
          padding: 1.25rem;
        }
      }
      .profile-form {
        display: flex;
        flex-direction: column;
        gap: 2rem;
      }
      .form-section {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        border-bottom: 1px solid rgba(128, 179, 255, 0.15);
        padding-bottom: 1.75rem;
      }
      .form-section:last-of-type {
        border-bottom: none;
        padding-bottom: 0;
      }
      .section-title {
        font-size: 1.1rem;
        font-weight: 700;
        color: #80b3ff;
        margin: 0;
      }
      .section-desc {
        font-size: 0.82rem;
        color: rgba(255, 255, 255, 0.65);
        margin: 0.25rem 0 0;
      }
      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.25rem;
      }
      .full-col {
        grid-column: 1 / -1;
      }
      @media (max-width: 600px) {
        .form-grid {
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
        background: rgba(7, 13, 28, 0.6);
        border: 1px solid rgba(128, 179, 255, 0.25);
        border-radius: 2px;
        padding: 0.75rem 0.9rem;
        color: #ffffff;
        font-size: 0.9rem;
        font-family: 'Geist', var(--font-sans), sans-serif !important;
        font-weight: 400;
        transition: border-color 0.2s ease;
      }
      .form-input:focus {
        outline: none;
        border-color: #80b3ff;
      }
      .text-mono {
        font-family: var(--font-mono, monospace) !important;
        letter-spacing: 0.05em;
      }
      .alert-success {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.85rem 1.15rem;
        background: rgba(128, 179, 255, 0.12);
        border: 1px solid rgba(128, 179, 255, 0.4);
        border-radius: 2px;
        color: #80b3ff;
        font-size: 0.88rem;
        font-weight: 600;
      }
      .alert-error {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.85rem 1.15rem;
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.4);
        border-radius: 2px;
        color: #fca5a5;
        font-size: 0.88rem;
        font-weight: 600;
      }
      .alert-icon {
        font-size: 1.25rem;
        width: 1.25rem;
        height: 1.25rem;
        flex-shrink: 0;
      }
      .field-hint {
        font-size: 0.72rem;
        color: rgba(128, 179, 255, 0.7);
      }
      .text-muted {
        opacity: 0.75;
        cursor: not-allowed;
        background: rgba(7, 13, 28, 0.85);
      }
      .form-actions-split {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        padding-top: 0.5rem;
        flex-wrap: wrap;
      }
      .btn-logout {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        justify-content: center;
        padding: 0.85rem 1.75rem;
        background: transparent;
        border: 1.5px solid #0d1e44;
        color: #80b3ff;
        font-weight: 700;
        font-size: 0.95rem;
        border-radius: 2px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .btn-logout:hover {
        background: rgba(13, 30, 68, 0.35);
        border-color: #80b3ff;
        color: #ffffff;
      }
      .btn-icon {
        font-size: 1.1rem;
        width: 1.1rem;
        height: 1.1rem;
      }
      .cta-save-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.85rem 2.25rem;
        background: #80b3ff;
        color: #070d18;
        font-weight: 700;
        font-size: 0.95rem;
        border-radius: 2px;
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .cta-save-btn:hover:not(:disabled) {
        background: #a6c8ff;
      }
      .cta-save-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `,
  ],
})
export class ProviderProfileComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly store = inject(ProviderStoreService);

  readonly savedSuccess = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isSaving = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: [this.store.currentProvider()?.name || '', Validators.required],
    agency: [this.store.currentProvider()?.agency || '', Validators.required],
    cuitDni: [this.store.currentProvider()?.cuitDni || '', Validators.required],
    phone: [this.store.currentProvider()?.phone || '', Validators.required],
    cbuAlias: [this.store.currentProvider()?.cbuAlias || '', Validators.required],
    bankName: [this.store.currentProvider()?.bankName || '', Validators.required],
  });

  constructor() {
    effect(() => {
      const p = this.store.currentProvider();
      if (p && !this.form.dirty) {
        this.form.patchValue({
          name: p.name || '',
          agency: p.agency || '',
          cuitDni: p.cuitDni || '',
          phone: p.phone || '',
          cbuAlias: p.cbuAlias || '',
          bankName: p.bankName || '',
        });
      }
    });
  }

  async onSave(): Promise<void> {
    if (this.form.invalid) return;

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.savedSuccess.set(false);

    const values = this.form.getRawValue();
    const result = await this.store.updateProfile(values);

    this.isSaving.set(false);
    if (result.success) {
      this.savedSuccess.set(true);
      setTimeout(() => this.savedSuccess.set(false), 5000);
    } else {
      this.errorMessage.set(result.message || 'Error al guardar los cambios.');
    }
  }

  onLogout(): void {
    this.store.logout();
    this.router.navigate(['/prestadores/dashboard']);
  }
}
