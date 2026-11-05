import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { StorageService } from '../../../core/services/storage.service';
import {
  socialUrlValidator,
  normalizeSocialUrl,
  migrateLegacySocialHandle,
} from '../../../shared/utils/social-url.util';

@Component({
  selector: 'app-provider-profile',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule, RouterLink],
  template: `
    <div class="profile-container">
      <div class="profile-head">
        <div class="header-titles">
          <span class="section-kicker">CUENTA Y FISCALIDAD</span>
          <div class="heading-row">
            <h2 class="card-heading">Perfil del Prestador y Datos de Cobro</h2>
          </div>
          <p class="card-subheading">
            Esta información se utiliza para las fichas técnicas de tus experiencias y los datos de
            destino donde los socios transfieren los pagos.
          </p>
        </div>
      </div>

      <div class="profile-card">
        <form [formGroup]="form" (ngSubmit)="onSave()" class="profile-form">
          <div class="form-section">
            <div>
              <h3 class="section-title">Datos Bancarios para Liquidación de Pagos</h3>
              <p class="section-desc">
                Es la cuenta bancaria o virtual donde se liquidan las recaudaciones y aranceles de
                tus experiencias.
              </p>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label class="form-label"
                  >CBU o Alias de Destino <span class="req-star">*</span></label
                >
                <input
                  type="text"
                  formControlName="cbuAlias"
                  class="form-input text-mono"
                  placeholder="Ej. EXPERIENCIAS.CLUB.MP o 22 dígitos"
                  required
                />
                <span class="field-hint">Alias o CBU de 22 dígitos exactos</span>
              </div>

              <div class="form-group">
                <label class="form-label"
                  >Entidad Bancaria o Billetera <span class="req-star">*</span></label
                >
                <input
                  type="text"
                  formControlName="bankName"
                  class="form-input"
                  placeholder="Ej. Banco Nación / Mercado Pago"
                  required
                />
              </div>

              <div class="form-group">
                <label class="form-label"
                  >Nombre / Titular de la Cuenta <span class="req-star">*</span></label
                >
                <input
                  type="text"
                  formControlName="name"
                  class="form-input"
                  placeholder="Ej. Gonzalo Gramaglia"
                  required
                />
              </div>

              <div class="form-group">
                <label class="form-label"
                  >CUIT / CUIL del Titular <span class="req-star">*</span></label
                >
                <input
                  type="text"
                  formControlName="cuitDni"
                  class="form-input text-mono"
                  placeholder="Ej. 20-33445566-7"
                  required
                />
              </div>
            </div>

            <!-- Alerta informativa de auditoría bancaria -->
            <div class="audit-notice-card" aria-label="Aviso de seguridad bancaria">
              <div class="audit-text">
                <strong class="audit-title">Registro Seguro de Datos Bancarios</strong>
                <p class="audit-desc">
                  Podés actualizar tus datos de cobro cuando lo necesites. Cada modificación queda
                  registrada con fecha y hora de auditoría para asegurar la trazabilidad y la
                  correcta liquidación de tus servicios.
                </p>
              </div>
            </div>
          </div>

          <div class="form-section">
            <h3 class="section-title">Datos del Emprendimiento</h3>

            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Prestador Asociado a la Cuenta</label>
                <div class="locked-input-wrapper">
                  <input
                    type="text"
                    [value]="store.currentProvider()?.name || 'Prestador Verificado'"
                    class="form-input text-muted"
                    readonly
                    disabled
                  />
                  <mat-icon class="lock-icon" aria-hidden="true">lock</mat-icon>
                </div>
                <span class="field-hint">Nombre oficial registrado del titular de la cuenta</span>
              </div>

              <div class="form-group">
                <label class="form-label">Email Asociado a la Cuenta</label>
                <div class="locked-input-wrapper">
                  <input
                    type="email"
                    [value]="store.currentProvider()?.email || 'prestador@experiencias.club'"
                    class="form-input text-muted"
                    readonly
                    disabled
                  />
                  <mat-icon class="lock-icon" aria-hidden="true">lock</mat-icon>
                </div>
                <span class="field-hint"
                  >Email oficial verificado vinculado a tu cuenta de prestador</span
                >
              </div>

              <div class="form-group">
                <label class="form-label"
                  >Nombre Comercial o Agencia <span class="req-star">*</span></label
                >
                <input
                  type="text"
                  formControlName="agency"
                  class="form-input"
                  placeholder="Ej. Catamarca Kayak & Aventura"
                  required
                />
              </div>

              <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label class="form-label">Nombre de Usuario / Enlace Público (Slug)</label>
                  <a
                    [href]="getPublicProfileUrl(form.get('slug')?.value || currentSlug())"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="live-profile-pill"
                    title="Abrir perfil público en una nueva pestaña"
                  >
                    Ver perfil público ↗
                  </a>
                </div>
                <input
                  type="text"
                  formControlName="slug"
                  class="form-input"
                  [placeholder]="currentSlug()"
                />
                <span class="field-hint"
                  >experiencias.club/prestadores/{{
                    form.get('slug')?.value || currentSlug()
                  }}</span
                >
              </div>

              <div class="form-group full-col">
                <label class="form-label">Descripción Atractiva del Emprendimiento</label>
                <textarea
                  formControlName="bio"
                  class="form-input form-textarea"
                  rows="3"
                  placeholder="Contá a los exploradores sobre tu trayectoria, guías certificados y qué hace únicas a tus salidas..."
                ></textarea>
                <span class="field-hint"
                  >Esta descripción se presentará en tu ficha técnica y en tu perfil público
                  oficial.</span
                >
              </div>

              <div class="form-group media-field-group">
                <label class="form-label" for="profile-avatar-input">Foto de Perfil / Logo</label>
                <div class="media-input-wrapper">
                  @if (form.get('avatar')?.value) {
                    <div class="media-thumb-preview avatar-thumb" title="Vista previa de avatar">
                      <img [src]="form.get('avatar')?.value" alt="Preview Avatar" />
                    </div>
                  }
                  <input
                    id="profile-avatar-input"
                    type="text"
                    formControlName="avatar"
                    class="form-input"
                    placeholder="URL de imagen o subí un archivo..."
                  />
                  <label
                    class="btn-file-upload"
                    [class.is-loading]="isUploadingAvatar()"
                    title="Elegir y subir imagen a Supabase Storage"
                  >
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      class="sr-only"
                      (change)="onFileSelected($event, 'avatar')"
                      [disabled]="isUploadingAvatar()"
                    />
                    <mat-icon class="upload-icon">{{
                      isUploadingAvatar() ? 'hourglass_empty' : 'cloud_upload'
                    }}</mat-icon>
                    <span>{{ isUploadingAvatar() ? 'Subiendo...' : 'Subir imagen' }}</span>
                  </label>
                </div>
                @if (uploadAvatarError()) {
                  <span class="field-error-text">{{ uploadAvatarError() }}</span>
                }
                <span class="field-hint">Imagen redonda o isotipo del prestador.</span>
              </div>

              <div class="form-group media-field-group">
                <label class="form-label" for="profile-cover-input"
                  >Foto de Portada de la Agencia</label
                >
                <div class="media-input-wrapper">
                  @if (form.get('coverImage')?.value) {
                    <div class="media-thumb-preview cover-thumb" title="Vista previa de portada">
                      <img [src]="form.get('coverImage')?.value" alt="Preview Portada" />
                    </div>
                  }
                  <input
                    id="profile-cover-input"
                    type="text"
                    formControlName="coverImage"
                    class="form-input"
                    placeholder="URL de imagen o subí un archivo..."
                  />
                  <label
                    class="btn-file-upload"
                    [class.is-loading]="isUploadingCover()"
                    title="Elegir y subir imagen a Supabase Storage"
                  >
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      class="sr-only"
                      (change)="onFileSelected($event, 'coverImage')"
                      [disabled]="isUploadingCover()"
                    />
                    <mat-icon class="upload-icon">{{
                      isUploadingCover() ? 'hourglass_empty' : 'cloud_upload'
                    }}</mat-icon>
                    <span>{{ isUploadingCover() ? 'Subiendo...' : 'Subir imagen' }}</span>
                  </label>
                </div>
                @if (uploadCoverError()) {
                  <span class="field-error-text">{{ uploadCoverError() }}</span>
                }
                <span class="field-hint">Banner panorámico superior de tu perfil público.</span>
              </div>

              <div class="form-group">
                <label class="form-label"
                  >Teléfono / WhatsApp de Contacto <span class="req-star">*</span></label
                >
                <input
                  type="text"
                  formControlName="phone"
                  class="form-input"
                  placeholder="Ej. +54 9 383 455-8812"
                  required
                />
              </div>

              <div class="form-group">
                <label class="form-label">Página Web Oficial</label>
                <input
                  type="text"
                  formControlName="website"
                  class="form-input"
                  placeholder="Ej. www.catamarcakayak.com"
                />
                <span class="field-hint">Sitio web de tu agencia o emprendimiento</span>
              </div>

              <div class="form-group">
                <label class="form-label">Red Social Principal</label>
                <input
                  type="url"
                  formControlName="socialMedia"
                  class="form-input"
                  maxlength="200"
                  placeholder="Ej. https://instagram.com/catamarcakayak"
                />
                @if (form.controls.socialMedia.invalid && form.controls.socialMedia.touched) {
                  <span class="field-error-text"
                    >Ingresá la URL completa del perfil (ej. https://instagram.com/usuario).</span
                  >
                } @else {
                  <span class="field-hint"
                    >URL de tu perfil de Instagram, Facebook u otra red. En tu perfil público se
                    mostrará solo el usuario.</span
                  >
                }
              </div>

              <div class="form-group">
                <label class="form-label">Red Social Secundaria</label>
                <input
                  type="url"
                  formControlName="socialMediaSecondary"
                  class="form-input"
                  maxlength="200"
                  placeholder="Ej. https://facebook.com/catamarcakayak"
                />
                @if (
                  form.controls.socialMediaSecondary.invalid &&
                  form.controls.socialMediaSecondary.touched
                ) {
                  <span class="field-error-text"
                    >Ingresá la URL completa del perfil (ej. https://facebook.com/usuario).</span
                  >
                } @else {
                  <span class="field-hint"
                    >Opcional. Segunda red para difundir tus experiencias.</span
                  >
                }
              </div>
            </div>
          </div>

          @if (savedSuccess()) {
            <div class="alert-success" role="status">
              <mat-icon class="alert-icon">check_circle</mat-icon>
              <span
                >¡Perfil y datos bancarios actualizados correctamente! El historial de cambios ha
                sido registrado.</span
              >
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
              <span>Cerrar Sesión</span>
            </button>
            <button
              type="submit"
              class="cta-save-btn"
              [disabled]="form.invalid || isSaving() || isUploadingAvatar() || isUploadingCover()"
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
      .profile-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1.5rem;
        flex-wrap: wrap;
      }
      .header-titles {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        width: 100%;
      }
      .heading-row {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        flex-wrap: wrap;
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
        margin: 0;
      }
      .btn-back-panel {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.48rem 1.05rem;
        background: #80b3ff;
        border: 1px solid #80b3ff;
        color: #ffffff;
        border-radius: 4px;
        font-size: 0.82rem;
        font-weight: 700;
        text-decoration: none;
        letter-spacing: 0.02em;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        white-space: nowrap;
        box-shadow: 0 4px 14px rgba(128, 179, 255, 0.25);
      }
      .btn-back-panel:hover {
        background: #9cc4ff;
        border-color: #9cc4ff;
        color: #ffffff;
        transform: translateY(-2px);
        box-shadow: 0 6px 18px rgba(128, 179, 255, 0.4);
      }
      .btn-back-panel:active {
        transform: translateY(0);
        box-shadow: 0 2px 6px rgba(128, 179, 255, 0.3);
      }
      .card-subheading {
        font-size: 0.88rem;
        color: rgba(255, 255, 255, 0.7);
        margin: 0.25rem 0 0;
        line-height: 1.5;
      }
      .audit-notice-card {
        display: flex;
        align-items: flex-start;
        padding: 1.15rem 1.35rem;
        background: rgba(13, 30, 68, 0.55);
        border: 1px solid rgba(128, 179, 255, 0.35);
        border-radius: 2px;
        backdrop-filter: blur(10px);
        margin-top: 1.25rem;
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
      .req-star {
        color: #ffcc00;
        font-weight: 700;
        margin-left: 0.15rem;
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
      .live-profile-pill {
        font-size: 0.75rem;
        font-weight: 700;
        color: #80b3ff;
        text-decoration: none;
        letter-spacing: 0.02em;
        transition: color 0.2s ease;
      }
      .live-profile-pill:hover {
        color: #ffffff;
        text-decoration: underline;
      }
      .form-textarea {
        resize: vertical;
        min-height: 80px;
        line-height: 1.5;
      }
      .media-field-group {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
      .media-input-wrapper {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .media-input-wrapper .form-input {
        flex: 1;
        min-width: 0;
      }
      .media-thumb-preview {
        width: 38px;
        height: 38px;
        flex-shrink: 0;
        border: 1px solid rgba(128, 179, 255, 0.4);
        background: #070d18;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .media-thumb-preview.avatar-thumb {
        border-radius: 50%;
      }
      .media-thumb-preview.cover-thumb {
        border-radius: 2px;
      }
      .media-thumb-preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .btn-file-upload {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        height: 40px;
        padding: 0 0.9rem;
        background: rgba(128, 179, 255, 0.15);
        border: 1px solid rgba(128, 179, 255, 0.4);
        border-radius: 2px;
        color: #80b3ff;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
        user-select: none;
        flex-shrink: 0;
      }
      .btn-file-upload:hover {
        background: rgba(128, 179, 255, 0.28);
        border-color: #80b3ff;
        color: #ffffff;
      }
      .btn-file-upload.is-loading {
        opacity: 0.65;
        cursor: not-allowed;
      }
      .upload-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
      .field-error-text {
        color: #ff8080;
        font-size: 0.78rem;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
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
      .locked-input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }
      .locked-input-wrapper .form-input {
        width: 100%;
        padding-right: 2.6rem;
      }
      .lock-icon {
        position: absolute;
        right: 0.8rem;
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #80b3ff;
        pointer-events: none;
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
      @media (max-width: 768px) {
        .heading-row {
          gap: 0.5rem;
        }
        .heading-row .btn-back-panel {
          justify-content: center;
          text-align: center;
        }
      }
    `,
  ],
})
export class ProviderProfileComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly store = inject(ProviderStoreService);
  readonly storageService = inject(StorageService);

  readonly savedSuccess = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isSaving = signal(false);
  readonly isUploadingAvatar = signal(false);
  readonly isUploadingCover = signal(false);
  readonly uploadAvatarError = signal<string | null>(null);
  readonly uploadCoverError = signal<string | null>(null);

  readonly currentSlug = computed(() => {
    const p = this.store.currentProvider();
    if (p?.slug) return p.slug;
    if (p?.agency) {
      return p.agency
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
    }
    return 'prestador-oficial';
  });

  readonly form = this.fb.nonNullable.group({
    name: [this.store.currentProvider()?.name || '', Validators.required],
    agency: [this.store.currentProvider()?.agency || '', Validators.required],
    slug: [this.store.currentProvider()?.slug || ''],
    bio: [this.store.currentProvider()?.bio || ''],
    avatar: [this.store.currentProvider()?.avatar || ''],
    coverImage: [this.store.currentProvider()?.coverImage || ''],
    cuitDni: [this.store.currentProvider()?.cuitDni || '', Validators.required],
    phone: [this.store.currentProvider()?.phone || '', Validators.required],
    website: [this.store.currentProvider()?.website || ''],
    socialMedia: [
      migrateLegacySocialHandle(this.store.currentProvider()?.socialMedia),
      [socialUrlValidator],
    ],
    socialMediaSecondary: [
      migrateLegacySocialHandle(this.store.currentProvider()?.socialMediaSecondary),
      [socialUrlValidator],
    ],
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
          slug: p.slug || '',
          bio: p.bio || '',
          avatar: p.avatar || '',
          coverImage: p.coverImage || '',
          cuitDni: p.cuitDni || '',
          phone: p.phone || '',
          website: p.website || '',
          socialMedia: migrateLegacySocialHandle(p.socialMedia),
          socialMediaSecondary: migrateLegacySocialHandle(p.socialMediaSecondary),
          cbuAlias: p.cbuAlias || '',
          bankName: p.bankName || '',
        });
      }
    });
  }

  async onSave(): Promise<void> {
    if (this.form.invalid || this.isSaving() || this.isUploadingAvatar() || this.isUploadingCover())
      return;

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.savedSuccess.set(false);

    const values = this.form.getRawValue();
    const rawSlug = (values.slug || '').trim();
    const normalizedSlug = rawSlug
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    values.slug = normalizedSlug || this.currentSlug();
    values.socialMedia = normalizeSocialUrl(values.socialMedia);
    values.socialMediaSecondary = normalizeSocialUrl(values.socialMediaSecondary);

    const result = await this.store.updateProfile(values);

    this.isSaving.set(false);
    if (result.success) {
      this.savedSuccess.set(true);
      setTimeout(() => this.savedSuccess.set(false), 5000);
    } else {
      this.errorMessage.set(result.message || 'Error al guardar los cambios.');
    }
  }

  getPublicProfileUrl(slug?: string): string {
    const raw = (slug || this.currentSlug() || '').trim();
    const clean =
      raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/(^-|-$)+/g, '') || this.currentSlug();

    if (
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1'))
    ) {
      return `/prestadores/${clean}`;
    }
    return `https://experiencias.club/prestadores/${clean}`;
  }

  async onFileSelected(event: Event, field: 'avatar' | 'coverImage'): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      if (field === 'avatar') {
        this.uploadAvatarError.set(
          'El archivo seleccionado debe ser una imagen válida (JPG, PNG, WEBP o SVG).',
        );
      } else {
        this.uploadCoverError.set(
          'El archivo seleccionado debe ser una imagen válida (JPG, PNG, WEBP).',
        );
      }
      input.value = '';
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      if (field === 'avatar') {
        this.uploadAvatarError.set('La imagen de perfil no debe superar los 8 MB.');
      } else {
        this.uploadCoverError.set('La imagen de portada no debe superar los 8 MB.');
      }
      input.value = '';
      return;
    }

    const isAvatar = field === 'avatar';
    const setLoading = isAvatar ? this.isUploadingAvatar : this.isUploadingCover;
    const setError = isAvatar ? this.uploadAvatarError : this.uploadCoverError;

    setLoading.set(true);
    setError.set(null);

    try {
      const res = await this.storageService.uploadFile(file, isAvatar ? 'AVATAR' : 'PORTADA');
      if (res?.url) {
        this.form.patchValue({ [field]: res.url });
        this.form.markAsDirty();
      }
    } catch (err: any) {
      console.warn('[ProviderProfile] Error subiendo imagen a Supabase Storage:', err);
      setError.set(err?.message || 'Error al subir la imagen a Supabase Storage. Reintentá.');
    } finally {
      setLoading.set(false);
      input.value = '';
    }
  }

  onLogout(): void {
    this.store.logout();
    this.router.navigate(['/prestadores/dashboard']);
  }
}
