import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AdminStoreService } from '../../../core/services/admin-store.service';
import { ClubProfile } from '../../../core/models/club-profile.model';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div class="settings-page-container">
      @if (feedbackToast()) {
        <div class="toast-banner">
          <span>{{ feedbackToast() }}</span>
        </div>
      }

      <div class="settings-page-card">
        <!-- Encabezado Principal -->
        <div class="settings-header">
          <div class="header-titles">
            <span class="section-kicker">CONFIGURACIÓN GENERAL & FINANZAS</span>
            <h1 class="card-heading">Configuración del Sistema & Perfil del Club</h1>
            <p class="card-subheading">
              Ajustá la cotización de referencia en dólares para el catálogo de experiencias y actualizá los datos institucionales y de cobro oficiales del <strong>Club de Experiencias</strong>.
            </p>
          </div>
        </div>

        <div class="settings-body">
          <!-- 1. Cotización Global USD -->
          <div class="settings-section-card">
            <div class="section-title-row">
              <h3 class="settings-section-title">1. Cotización Global del Dólar (USD / ARS)</h3>
              <p class="section-subtext">
                Tipo de cambio referencial aplicado en todo el portal para calcular los valores en dólares en las fichas públicas de experiencias y en las propuestas de los prestadores.
              </p>
            </div>

            <div class="usd-rate-grid">
              <div class="form-field rate-field">
                <label for="cfg-usd-rate">Cotización de Referencia (1 USD = $ ARS): <span class="req-star">*</span></label>
                <div class="rate-input-wrap">
                  <span class="currency-prefix">$ ARS</span>
                  <input
                    id="cfg-usd-rate"
                    type="number"
                    class="form-input font-bold"
                    [(ngModel)]="usdRate"
                    placeholder="1400"
                    min="100"
                    max="100000"
                    required
                  />
                </div>
              </div>

              <div class="usd-preview-box">
                <div class="preview-sample">
                  <span class="sample-ars">$100.000 ARS</span>
                  <span class="sample-arrow">&rarr;</span>
                  <span class="sample-usd">~{{ sampleUsd() }} USD</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Perfil Institucional Oficial -->
          <div class="settings-section-card">
            <div class="section-title-row">
              <h3 class="settings-section-title">2. Perfil Público Institucional del Club de Experiencias</h3>
              <p class="section-subtext">
                Identidad pública oficial asignada como prestador en las expediciones exclusivas creadas por el Club.
              </p>
            </div>

            <div class="form-grid-2">
              <div class="form-field">
                <label for="cfg-name">Nombre Comercial / Institucional: <span class="req-star">*</span></label>
                <input
                  id="cfg-name"
                  type="text"
                  class="form-input"
                  [(ngModel)]="clubName"
                  placeholder="Club de Experiencias"
                  required
                />
              </div>

              <div class="form-field">
                <label for="cfg-agency">Denominación / Agencia Oficial: <span class="req-star">*</span></label>
                <input
                  id="cfg-agency"
                  type="text"
                  class="form-input"
                  [(ngModel)]="clubAgency"
                  placeholder="Club de Experiencias Catamarca"
                  required
                />
              </div>
            </div>

            <div class="form-grid-3">
              <div class="form-field">
                <label for="cfg-email">Email Institucional: <span class="req-star">*</span></label>
                <input
                  id="cfg-email"
                  type="email"
                  class="form-input"
                  [(ngModel)]="clubEmail"
                  placeholder="admin@experiencias.club"
                  required
                />
              </div>

              <div class="form-field">
                <label for="cfg-phone">Teléfono / WhatsApp Oficial: <span class="req-star">*</span></label>
                <input
                  id="cfg-phone"
                  type="tel"
                  class="form-input"
                  [(ngModel)]="clubPhone"
                  placeholder="+54 9 383 456-7890"
                  required
                />
              </div>

              <div class="form-field">
                <label for="cfg-address">Sede o Ubicación Física:</label>
                <input
                  id="cfg-address"
                  type="text"
                  class="form-input"
                  [(ngModel)]="clubAddress"
                  placeholder="San Fernando del Valle de Catamarca"
                />
              </div>
            </div>
          </div>

          <!-- 3. Datos Bancarios Oficiales -->
          <div class="settings-section-card">
            <div class="section-title-row">
              <h3 class="settings-section-title">3. Datos Bancarios Oficiales para Liquidación & Cobros (CBU)</h3>
              <p class="section-subtext">
                Información bancaria a la que se dirigen las reservas de las experiencias organizadas por el Club.
              </p>
            </div>

            <div class="form-grid-2">
              <div class="form-field">
                <label for="cfg-cbu">CBU / CVU o Alias de Destino: <span class="req-star">*</span></label>
                <input
                  id="cfg-cbu"
                  type="text"
                  class="form-input font-bold"
                  [(ngModel)]="clubCbuAlias"
                  placeholder="EXPERIENCIAS.CLUB.MP"
                  maxlength="22"
                  required
                />
                <span class="field-hint">Alias o CBU único de la cuenta recaudadora oficial.</span>
              </div>

              <div class="form-field">
                <label for="cfg-cuit">CUIT / CUIL del Titular: <span class="req-star">*</span></label>
                <input
                  id="cfg-cuit"
                  type="text"
                  class="form-input"
                  [(ngModel)]="clubCuitDni"
                  placeholder="30-71829401-4"
                  maxlength="13"
                  required
                />
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-field">
                <label for="cfg-bank">Banco o Billetera Virtual: <span class="req-star">*</span></label>
                <input
                  id="cfg-bank"
                  type="text"
                  class="form-input"
                  [(ngModel)]="clubBankName"
                  placeholder="Mercado Pago / Banco Nación"
                  maxlength="60"
                  required
                />
              </div>

              <div class="form-field">
                <label for="cfg-holder">Nombre / Razón Social del Titular: <span class="req-star">*</span></label>
                <input
                  id="cfg-holder"
                  type="text"
                  class="form-input"
                  [(ngModel)]="clubAccountHolder"
                  placeholder="Club de Experiencias Catamarca"
                  maxlength="70"
                  required
                />
              </div>
            </div>
          </div>

          <!-- 4. Presentación & Redes -->
          <div class="settings-section-card">
            <div class="section-title-row">
              <h3 class="settings-section-title">4. Presentación Institucional & Enlaces Web</h3>
              <p class="section-subtext">
                Información complementaria visible en el perfil institucional y fichas del Club.
              </p>
            </div>

            <div class="form-field">
              <label for="cfg-bio">Presentación Institucional (Biografía):</label>
              <textarea
                id="cfg-bio"
                rows="3"
                class="form-textarea"
                [(ngModel)]="clubBio"
                maxlength="500"
                placeholder="Cuenta institucional oficial del Club de Experiencias. Administrada conjuntamente por el equipo..."
              ></textarea>
              <span class="field-hint">Breve síntesis de la misión institucional del Club.</span>
            </div>

            <div class="form-grid-2">
              <div class="form-field">
                <label for="cfg-website">Sitio Web Oficial:</label>
                <input
                  id="cfg-website"
                  type="url"
                  class="form-input"
                  [(ngModel)]="clubWebsite"
                  placeholder="https://experiencias.club"
                />
              </div>

              <div class="form-field">
                <label for="cfg-social">Redes Sociales (Instagram):</label>
                <input
                  id="cfg-social"
                  type="text"
                  class="form-input"
                  [(ngModel)]="clubSocialMedia"
                  placeholder="instagram.com/experiencias.club"
                />
              </div>
            </div>
          </div>

          <!-- 5. Configuración de Mercado Pago & Recargos -->
          <div class="settings-section-card">
            <div class="section-title-row">
              <h3 class="settings-section-title">5. Pasarela de Pago & Comisiones de Mercado Pago</h3>
              <p class="section-subtext">
                Definí el recargo porcentual aplicado en el checkout a los exploradores que elijan pagar con Mercado Pago (Checkout Pro). Este porcentaje absorbe la comisión de procesamiento de la pasarela y retiene la comisión de servicio del Club.
              </p>
            </div>

            <div class="usd-rate-grid">
              <div class="form-field rate-field">
                <label for="cfg-mp-surcharge">Recargo por pago con Mercado Pago (%): <span class="req-star">*</span></label>
                <div class="rate-input-wrap">
                  <span class="currency-prefix">%</span>
                  <input
                    id="cfg-mp-surcharge"
                    type="number"
                    class="form-input font-bold"
                    [(ngModel)]="mercadoPagoSurcharge"
                    placeholder="12"
                    min="0"
                    max="100"
                    required
                  />
                </div>
                <span class="field-hint">Por defecto 12%. Si el prestador no vinculó Mercado Pago, el checkout solo muestra transferencia tradicional al 0% de recargo.</span>
              </div>

              <div class="usd-preview-box">
                <div class="preview-sample">
                  <span class="sample-ars">$100.000 ARS (CBU)</span>
                  <span class="sample-arrow">&rarr;</span>
                  <span class="sample-usd font-bold" style="color: #60a5fa;">$ {{ sampleMpPrice() | number:'1.0-0' }} ARS (MP +{{ mercadoPagoSurcharge() }}%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer / Acciones -->
        <div class="settings-footer">
          <button
            type="button"
            class="btn-cancel-settings"
            (click)="cancelSettings()"
            [disabled]="isSaving() || isLoading()"
          >
            Cancelar
          </button>

          <div class="footer-right">
            @if (saveError()) {
              <span class="error-text">{{ saveError() }}</span>
            }
            <button
              type="button"
              class="btn-save-settings"
              [disabled]="isSaving() || isLoading()"
              (click)="saveAllSettings()"
            >
              @if (isLoading()) {
                <mat-icon class="btn-spin">sync</mat-icon>
                <span>Cargando configuración...</span>
              } @else if (isSaving()) {
                <mat-icon class="btn-spin">sync</mat-icon>
                <span>Guardando configuración...</span>
              } @else {
                <span>Guardar configuración</span>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .settings-page-container {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .toast-banner {
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        background: #10b981;
        color: #ffffff;
        font-weight: 700;
        font-size: 0.9rem;
        padding: 0.85rem 1.4rem;
        border-radius: 4px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
        z-index: 9999;
        max-width: 90vw;
        width: max-content;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 0.5rem;
        animation: fadeIn 0.25s ease-out;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translate(-50%, 8px);
        }
        to {
          opacity: 1;
          transform: translate(-50%, 0);
        }
      }

      .settings-page-card {
        background: rgba(18, 10, 5, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        padding: 1.75rem;
        display: flex;
        flex-direction: column;
        gap: 1.75rem;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
        margin-top: 1.5rem;
      }

      .settings-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .header-titles {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        max-width: 100%;
        width: 100%;
      }

      .section-kicker {
        font-size: 0.72rem;
        font-weight: 800;
        color: #ff5f00;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .card-heading {
        font-size: 1.75rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0.2rem 0;
        letter-spacing: -0.02em;
      }

      .card-subheading {
        font-size: 0.88rem;
        color: rgba(255, 255, 255, 0.75);
        margin: 0;
        line-height: 1.45;
      }

      .settings-body {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .settings-section-card {
        background: rgba(26, 14, 8, 0.6);
        border: 1px solid rgba(255, 95, 0, 0.2);
        border-radius: 4px;
        padding: 1.25rem 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1.15rem;
      }

      .section-title-row {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        border-bottom: 1px solid rgba(255, 95, 0, 0.18);
        padding-bottom: 0.65rem;
      }

      .settings-section-title {
        font-size: 1rem;
        font-weight: 800;
        color: #ffaa00;
        margin: 0;
        letter-spacing: 0.01em;
      }

      .section-subtext {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.65);
        margin: 0.2rem 0 0 0;
        line-height: 1.4;
      }

      .usd-rate-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.5rem;
        align-items: flex-end;
      }

      @media (max-width: 768px) {
        .usd-rate-grid {
          grid-template-columns: 1fr;
          align-items: stretch;
          gap: 1rem;
        }
      }

      .rate-field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      .rate-input-wrap {
        display: flex;
        align-items: stretch;
        min-height: 38px;
      }

      .currency-prefix {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 0.85rem;
        background: rgba(255, 95, 0, 0.2);
        border: 1px solid rgba(255, 95, 0, 0.45);
        border-right: none;
        border-radius: 4px 0 0 4px;
        color: #ffaa00;
        font-weight: 800;
        font-size: 0.8rem;
        white-space: nowrap;
        flex-shrink: 0;
        box-sizing: border-box;
      }

      .rate-input-wrap .form-input {
        border-radius: 0 4px 4px 0;
        color: #33ffaa;
        font-size: 0.95rem;
        height: 100%;
        box-sizing: border-box;
      }

      .usd-preview-box {
        background: rgba(0, 0, 0, 0.35);
        border: 1px dashed rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        padding: 0 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 38px;
        box-sizing: border-box;
      }

      .preview-sample {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        font-size: 0.92rem;
        font-weight: 700;
      }

      .sample-ars {
        color: #ffffff;
      }

      .sample-arrow {
        color: rgba(255, 255, 255, 0.4);
        font-size: 0.85rem;
      }

      .sample-usd {
        color: #33ffaa;
      }

      .form-grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }

      .form-grid-3 {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
      }

      @media (max-width: 800px) {
        .form-grid-2,
        .form-grid-3 {
          grid-template-columns: 1fr;
        }
      }

      .form-field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      .form-field label {
        font-size: 0.78rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.85);
        display: flex;
        align-items: flex-end;
      }

      .req-star {
        color: #ff5f00;
        font-weight: 800;
        margin-left: 0.25rem;
      }

      .form-input,
      .form-textarea {
        width: 100%;
        box-sizing: border-box;
        background: rgba(0, 0, 0, 0.45);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: #ffffff;
        padding: 0.55rem 0.75rem;
        font-size: 0.85rem;
        outline: none;
        transition: border-color 0.2s ease, background 0.2s ease;
      }

      .form-input {
        min-height: 38px;
      }

      .form-input:focus,
      .form-textarea:focus {
        border-color: #ff5f00;
        background: rgba(0, 0, 0, 0.65);
      }

      .text-blue-input {
        color: #ffffff !important;
        font-weight: 700 !important;
      }

      .font-bold {
        font-weight: 800;
      }

      .field-hint {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.5);
        line-height: 1.3;
      }

      .settings-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding-top: 1.25rem;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        margin-top: 0.5rem;
      }

      .footer-right {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .btn-cancel-settings {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.75rem 1.6rem;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.25);
        color: rgba(255, 255, 255, 0.85);
        font-size: 0.88rem;
        font-weight: 700;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-cancel-settings:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.5);
        color: #ffffff;
      }

      .btn-cancel-settings:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .error-text {
        color: #fca5a5;
        font-size: 0.85rem;
        font-weight: 600;
      }

      .btn-save-settings {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.6rem;
        background: linear-gradient(135deg, #ff5f00 0%, #e05300 100%);
        border: 1px solid #ff7a26;
        color: #ffffff;
        font-size: 0.88rem;
        font-weight: 800;
        border-radius: 4px;
        cursor: pointer;
        box-shadow: 0 6px 18px rgba(255, 95, 0, 0.35);
        transition: all 0.2s ease;
      }

      .btn-save-settings:hover:not(:disabled) {
        background: linear-gradient(135deg, #ff701a 0%, #ff5f00 100%);
        box-shadow: 0 8px 22px rgba(255, 95, 0, 0.5);
        transform: translateY(-1px);
      }

      .btn-save-settings:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .btn-spin {
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        100% {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class AdminSettingsComponent implements OnInit {
  protected readonly adminStore = inject(AdminStoreService);
  private readonly router = inject(Router);

  readonly usdRate = signal<number>(1400);
  readonly clubName = signal('');
  readonly clubAgency = signal('');
  readonly clubEmail = signal('');
  readonly clubPhone = signal('');
  readonly clubAddress = signal('');
  readonly clubCbuAlias = signal('');
  readonly clubCuitDni = signal('');
  readonly clubBankName = signal('');
  readonly clubAccountHolder = signal('');
  readonly clubBio = signal('');
  readonly clubWebsite = signal('');
  readonly clubSocialMedia = signal('');
  readonly mercadoPagoSurcharge = signal<number>(12);

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly feedbackToast = signal<string | null>(null);

  sampleUsd(): number {
    const rate = this.usdRate() || 1400;
    return Math.round(100000 / rate);
  }

  sampleMpPrice(): number {
    const pct = Number(this.mercadoPagoSurcharge()) || 0;
    return Math.round(100000 * (1 + pct / 100));
  }

  async ngOnInit(): Promise<void> {
    this.isLoading.set(true);
    try {
      await this.adminStore.loadClubProfile();
      this.loadFromStore();
    } finally {
      this.isLoading.set(false);
    }
  }

  private loadFromStore(): void {
    const profile = this.adminStore.clubProfile();
    this.usdRate.set(this.adminStore.usdExchangeRate() || 1400);

    this.clubName.set(profile.name || 'Club de Experiencias');
    this.clubAgency.set(profile.agency || 'Club de Experiencias Catamarca');
    this.clubEmail.set(profile.email || 'admin@experiencias.club');
    this.clubPhone.set(profile.phone || '+54 9 383 456-7890');
    this.clubAddress.set(profile.address || 'San Fernando del Valle de Catamarca');
    this.clubCbuAlias.set(profile.cbuAlias || 'EXPERIENCIAS.CLUB.MP');
    this.clubCuitDni.set(profile.cuitDni || '30-71829401-4');
    this.clubBankName.set(profile.bankName || 'Mercado Pago / Banco Nación');
    this.clubAccountHolder.set(profile.accountHolder || 'Club de Experiencias Catamarca');
    this.clubBio.set(profile.bio || '');
    this.clubWebsite.set(profile.website || 'https://experiencias.club');
    this.clubSocialMedia.set(profile.socialMedia || 'instagram.com/experiencias.club');
    this.mercadoPagoSurcharge.set(
      profile.mercadoPagoSurchargePercentage !== undefined
        ? profile.mercadoPagoSurchargePercentage
        : 12,
    );
  }

  cancelSettings(): void {
    this.saveError.set(null);
    this.feedbackToast.set(null);
    this.loadFromStore();
    const currentUrl = this.router.url || '';
    const dashboardRoute = currentUrl.startsWith('/admin') ? '/admin/dashboard' : '/dashboard';
    this.router.navigateByUrl(dashboardRoute);
  }

  async saveAllSettings(): Promise<void> {
    if (this.isLoading()) {
      return;
    }
    const rawRate = Number(this.usdRate());
    if (!Number.isFinite(rawRate) || rawRate < 100) {
      this.saveError.set('Por favor ingresá una cotización válida (mínimo $100 ARS).');
      return;
    }
    const rate = Math.round(rawRate);

    const name = this.clubName().trim();
    if (!name) {
      this.saveError.set('El nombre del Club es obligatorio.');
      return;
    }

    const cbu = this.clubCbuAlias().trim();
    if (!cbu) {
      this.saveError.set('El CBU / Alias de cobro es obligatorio.');
      return;
    }

    this.saveError.set(null);
    this.isSaving.set(true);

    try {
      const profilePayload: Partial<ClubProfile> = {
        name,
        agency: this.clubAgency().trim() || name,
        email: this.clubEmail().trim() || 'admin@experiencias.club',
        phone: this.clubPhone().trim(),
        address: this.clubAddress().trim(),
        cbuAlias: cbu,
        cuitDni: this.clubCuitDni().trim(),
        bankName: this.clubBankName().trim(),
        accountHolder: this.clubAccountHolder().trim(),
        bio: this.clubBio().trim(),
        website: this.clubWebsite().trim(),
        socialMedia: this.clubSocialMedia().trim(),
        usdExchangeRate: rate,
        mercadoPagoSurchargePercentage: Math.max(
          0,
          Math.min(100, Number(this.mercadoPagoSurcharge()) || 12),
        ),
      };

      const res = await this.adminStore.updateClubProfile(profilePayload);
      if (res && !res.success) {
        this.saveError.set(res.error || 'Ocurrió un error al guardar la configuración.');
        return;
      }

      this.showToast('Configuración global y Perfil del Club actualizados con éxito.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      this.saveError.set(msg);
    } finally {
      this.isSaving.set(false);
    }
  }

  private showToast(msg: string): void {
    const cleanMsg = (msg || '')
      .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u2600-\u27BF\uFE0F\s]+/u, '')
      .trim();
    this.feedbackToast.set(cleanMsg || msg);
    setTimeout(() => {
      this.feedbackToast.set(null);
    }, 3500);
  }
}

