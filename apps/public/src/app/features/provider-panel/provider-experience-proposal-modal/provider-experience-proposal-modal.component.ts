import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { StorageService } from '../../../core/services/storage.service';

const DEFAULT_REQ_FORM = {
  title: '',
  kicker: 'EXPERIENCIA',
  subheading: '',
  region: '',
  difficulty: 'Baja (Sin experiencia previa)',
  duration: '4 horas (Media jornada)',
  altitude: '',
  capacity: 12,
  season: 'Todo el año',
  dates: 'A coordinar',
  priceArs: 65000,
  priceUsd: 41,
  promosAndPricing: '',
  itinerary: '',
  meetingPoint: '',
  includedServices: '',
  participantRequirements: '',
  notes: '',
};

@Component({
  selector: 'app-provider-experience-proposal-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    @if (isOpen()) {
      <div class="exp-request-modal-backdrop" (click)="onClose()">
        <div
          #modalDialog
          tabindex="-1"
          class="exp-request-modal"
          (click)="$event.stopPropagation()"
          role="dialog"
          aria-modal="true"
          aria-labelledby="req-modal-title"
        >
          <div class="exp-request-header">
            <div class="modal-top-progress-stripe" [style.width.%]="getFormProgress()"></div>
            <div class="exp-request-header-content">
              <span class="exp-request-kicker">SOLICITUD DE ALTA</span>
              <h2 id="req-modal-title" class="exp-request-title">
                Solicitar Nueva Experiencia a Administradores
              </h2>
              <p class="exp-request-sub">
                Completá la ficha técnica y logística de tu propuesta para que los administradores
                la revisen y carguen al catálogo.
              </p>

              <!-- Barra de Progreso Arriba -->
              <div class="header-progress-wrap">
                <div class="header-progress-bar-bg">
                  <div
                    class="header-progress-bar-fill"
                    [class.is-100]="getFormProgress() === 100"
                    [style.width.%]="getFormProgress()"
                  ></div>
                </div>
                <div class="header-progress-info">
                  <span class="progress-hint">Completitud de la propuesta</span>
                  <span class="progress-badge" [class.is-complete]="getFormProgress() === 100">
                    {{ getFormProgress() }}%
                    {{ getFormProgress() === 100 ? '¡Completo!' : 'completado' }}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              class="modal-close-icon-btn"
              (click)="onClose()"
              aria-label="Cerrar modal"
            >
              &times;
            </button>
          </div>

          <div class="exp-request-body">
            @if (requestSuccess()) {
              <div class="request-success-view">
                <div class="request-success-badge">SOLICITUD ENVIADA</div>
                <h3 class="request-success-title">¡Propuesta enviada con éxito!</h3>
                <p class="request-success-desc">
                  Los administradores recibieron los datos, archivos multimedia y especificaciones
                  técnicas de
                  <strong>"{{ reqForm.title || 'tu propuesta' }}"</strong>. Revisarán el itinerario,
                  logística y tarifas para darla de alta en el catálogo oficial de Experiencias.
                </p>
                @if (finalSuccessCoverUrl() || coverImagePreview()) {
                  <div class="request-success-media-preview">
                    <img
                      [src]="finalSuccessCoverUrl() || coverImagePreview()"
                      alt="Portada cargada"
                      class="success-thumb-img"
                      referrerpolicy="no-referrer"
                    />
                    <div class="success-thumb-info">
                      <span class="success-thumb-title">Foto de portada adjuntada</span>
                      <span class="success-thumb-name">{{ coverImageFile()?.name || 'portada.jpg' }}</span>
                      @if (coverVideoFile()) {
                        <span class="success-thumb-video"
                          >+ Video de portada: {{ coverVideoFile()?.name }}</span
                        >
                      }
                    </div>
                  </div>
                }
                <button type="button" class="modal-btn-submit return-to-panel-btn" (click)="onClose()">
                  Entendido, volver al panel
                </button>
              </div>
            } @else {
              <form #proposalForm="ngForm" class="exp-modal-form" (ngSubmit)="submitRequestForm(proposalForm)">
                <!-- 1. Cabecera y Resumen de la Experiencia -->
                <div class="form-section">
                  <div class="form-section-header">
                    <span class="form-section-num">1</span>
                    <h4 class="form-section-title">Cabecera y Resumen</h4>
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label class="form-label" for="req-title"
                        >Título Principal de la Experiencia *</label
                      >
                      <input
                        id="req-title"
                        type="text"
                        class="form-input"
                        placeholder="Ej: Travesía en Kayak & Sunset..."
                        [(ngModel)]="reqForm.title"
                        name="title"
                        required
                      />
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="req-region"
                        >Región Turística de Catamarca *</label
                      >
                      <input
                        id="req-region"
                        type="text"
                        class="form-input"
                        placeholder="Ej: Valle Central, Fiambalá, etc."
                        [(ngModel)]="reqForm.region"
                        name="region"
                        required
                      />
                    </div>
                  </div>

                  <div class="form-group">
                    <div class="label-with-counter">
                      <label class="form-label" for="req-subheading"
                        >Síntesis Atractiva *</label
                      >
                      <span class="char-counter">
                        {{ (reqForm.subheading || '').length }}/500
                      </span>
                    </div>
                    <textarea
                      id="req-subheading"
                      rows="3"
                      maxlength="500"
                      class="form-input form-textarea"
                      placeholder="Ej: Remada guiada en kayak en aguas calmas al atardecer..."
                      [(ngModel)]="reqForm.subheading"
                      name="subheading"
                      required
                    ></textarea>
                    <span class="field-hint">Máximo 2 párrafos descriptivos (hasta 500 caracteres).</span>
                  </div>
                </div>

                <!-- 2. Multimedia de Portada -->
                <div class="form-section">
                  <div class="form-section-header">
                    <span class="form-section-num">2</span>
                    <h4 class="form-section-title">Multimedia de Portada</h4>
                  </div>

                  <div class="media-upload-row">
                    <!-- Foto de Portada (Obligatoria) -->
                    <div class="form-group media-upload-group">
                      <label class="form-label" for="req-cover-image">
                        Foto de Portada <span class="badge-required">* Obligatoria</span>
                      </label>

                      @if (coverImagePreview()) {
                        <div class="media-preview-card">
                          <div class="media-preview-visual">
                            <img
                              [src]="coverImagePreview()"
                              alt="Foto de portada"
                              class="media-img-preview"
                            />
                          </div>
                          <div class="media-preview-meta">
                            <span class="media-file-name" [title]="coverImageFile()?.name">{{
                              coverImageFile()?.name
                            }}</span>
                            <span class="media-file-size">{{
                              formatFileSize(coverImageFile()?.size)
                            }}</span>
                          </div>
                          <button
                            type="button"
                            class="media-action-btn"
                            (click)="removeCoverImage()"
                            aria-label="Cambiar foto de portada"
                          >
                            Cambiar foto
                          </button>
                        </div>
                      } @else {
                        <label
                          class="media-dropzone"
                          [class.dropzone-error]="coverImageError()"
                          (dragover)="$event.preventDefault()"
                          (drop)="onCoverImageDrop($event)"
                        >
                          <input
                            id="req-cover-image"
                            type="file"
                            class="sr-only"
                            accept="image/*"
                            (change)="onCoverImageSelected($event)"
                          />
                          <div class="dropzone-content">
                            <svg
                              class="dropzone-icon"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.8"
                            >
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <polyline points="21 15 16 10 5 21" />
                            </svg>
                            <span class="dropzone-main-text">Subir foto de portada *</span>
                            <span class="dropzone-sub-text"
                              >Hacé click o arrastrá tu imagen (JPG, PNG, WEBP)</span
                            >
                          </div>
                        </label>
                      }
                      @if (coverImageError()) {
                        <span class="field-error-text">{{ coverImageError() }}</span>
                      }
                    </div>

                    <!-- Video de Portada (Opcional) -->
                    <div class="form-group media-upload-group">
                      <label class="form-label" for="req-cover-video">
                        Video de Portada <span class="badge-optional">(Opcional)</span>
                      </label>

                      @if (coverVideoPreview()) {
                        <div class="media-preview-card">
                          <div class="media-preview-visual">
                            <video
                              [src]="coverVideoPreview()"
                              class="media-video-preview"
                              controls
                              muted
                              playsinline
                            ></video>
                          </div>
                          <div class="media-preview-meta">
                            <span class="media-file-name" [title]="coverVideoFile()?.name">{{
                              coverVideoFile()?.name
                            }}</span>
                            <span class="media-file-size">{{
                              formatFileSize(coverVideoFile()?.size)
                            }}</span>
                          </div>
                          <button
                            type="button"
                            class="media-action-btn"
                            (click)="removeCoverVideo()"
                            aria-label="Cambiar video de portada"
                          >
                            Cambiar video
                          </button>
                        </div>
                      } @else {
                        <label
                          class="media-dropzone"
                          [class.dropzone-error]="coverVideoError()"
                          (dragover)="$event.preventDefault()"
                          (drop)="onCoverVideoDrop($event)"
                        >
                          <input
                            id="req-cover-video"
                            type="file"
                            class="sr-only"
                            accept="video/*"
                            (change)="onCoverVideoSelected($event)"
                          />
                          <div class="dropzone-content">
                            <svg
                              class="dropzone-icon"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.8"
                            >
                              <polygon points="23 7 16 12 23 17 23 7" />
                              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                            </svg>
                            <span class="dropzone-main-text">Subir video de portada</span>
                            <span class="dropzone-sub-text"
                              >Hacé click o arrastrá un video (MP4, MOV, WEBM)</span
                            >
                          </div>
                        </label>
                      }
                      @if (coverVideoError()) {
                        <span class="field-error-text">{{ coverVideoError() }}</span>
                      }
                    </div>
                  </div>
                </div>

                <!-- 3. Especificaciones Técnicas (Specs Rápidas) -->
                <div class="form-section">
                  <div class="form-section-header">
                    <span class="form-section-num">3</span>
                    <h4 class="form-section-title">Especificaciones Técnicas</h4>
                  </div>

                  <div class="form-grid-3">
                    <div class="form-group">
                      <label class="form-label" for="req-difficulty">Dificultad Técnica *</label>
                      <select
                        id="req-difficulty"
                        class="form-input form-select"
                        [(ngModel)]="reqForm.difficulty"
                        name="difficulty"
                      >
                        <option value="Baja (Sin experiencia previa)">
                          Baja (Sin experiencia previa)
                        </option>
                        <option value="Moderada">Moderada</option>
                        <option value="Exigente">Exigente</option>
                        <option value="Alta Montaña">Alta Montaña</option>
                      </select>
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="req-duration">Duración Aproximada *</label>
                      <select
                        id="req-duration"
                        class="form-input form-select"
                        [(ngModel)]="reqForm.duration"
                        name="duration"
                        required
                      >
                        <option value="1 hora">1 hora</option>
                        <option value="2 horas">2 horas</option>
                        <option value="3 horas">3 horas</option>
                        <option value="4 horas (Media jornada)">4 horas (Media jornada)</option>
                        <option value="5 horas">5 horas</option>
                        <option value="6 horas">6 horas</option>
                        <option value="7 horas">7 horas</option>
                        <option value="8 horas (Jornada completa)">8 horas (Jornada completa)</option>
                        <option value="Día completo / Más de 8 horas">Día completo / Más de 8 horas</option>
                        <option value="2 o más días">2 o más días</option>
                      </select>
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="req-altitude">Altitud</label>
                      <input
                        id="req-altitude"
                        type="text"
                        class="form-input"
                        placeholder="Ej: 850 msnm"
                        [(ngModel)]="reqForm.altitude"
                        name="altitude"
                      />
                    </div>
                  </div>
                </div>

                <!-- 4. Arancel & Tarifas -->
                <div class="form-section">
                  <div class="form-section-header">
                    <span class="form-section-num">4</span>
                    <h4 class="form-section-title">Arancel por Persona</h4>
                  </div>

                  <div class="form-group">
                    <label class="form-label" for="req-price-ars"
                      >Arancel en Pesos ($ ARS) *</label
                    >
                    <input
                      id="req-price-ars"
                      type="number"
                      class="form-input"
                      placeholder="Ej: 65000"
                      [(ngModel)]="reqForm.priceArs"
                      name="priceArs"
                      min="1000"
                      step="500"
                      required
                    />
                    <div class="usd-auto-hint">
                      Equivalente estimado: <strong class="usd-calc-val">~&#36;{{ Math.round((reqForm.priceArs || 0) / 1600) }} USD</strong>
                      <span class="usd-formula">(calculado automáticamente a cotización $1.600)</span>
                    </div>
                  </div>

                  <div class="form-group">
                    <label class="form-label" for="req-promos"
                      >Promociones, Descuentos u Otros Precios a Considerar</label
                    >
                    <textarea
                      id="req-promos"
                      rows="3"
                      class="form-input form-textarea"
                      placeholder="Ej: Descuento 15% grupos familiares, menores sin cargo..."
                      [(ngModel)]="reqForm.promosAndPricing"
                      name="promosAndPricing"
                    ></textarea>
                  </div>
                </div>

                <!-- 5. Cronograma & Itinerario -->
                <div class="form-section">
                  <div class="form-section-header">
                    <span class="form-section-num">5</span>
                    <h4 class="form-section-title">Cronograma e Itinerario</h4>
                  </div>

                  <div class="form-group">
                    <label class="form-label" for="req-itinerary">Itinerario de la Jornada *</label>
                    <textarea
                      id="req-itinerary"
                      rows="4"
                      class="form-input form-textarea"
                      placeholder="Ej: 15:30 hs Recepción, 16:15 hs Zarpada, 18:15 hs Sunset..."
                      [(ngModel)]="reqForm.itinerary"
                      name="itinerary"
                      required
                    ></textarea>
                  </div>

                  <div class="form-group">
                    <label class="form-label" for="req-dates">Fechas Programadas o Disponibilidad</label>
                    <input
                      id="req-dates"
                      type="text"
                      class="form-input"
                      placeholder="A coordinar (o ingresá fechas YYYY-MM-DD separadas por coma)"
                      [(ngModel)]="reqForm.dates"
                      name="dates"
                    />
                    <span class="field-hint">Dejá "A coordinar" si las fechas se definirán tras la aprobación.</span>
                  </div>
                </div>

                <!-- 6. Equipamiento, Seguridad & Logística -->
                <div class="form-section">
                  <div class="form-section-header">
                    <span class="form-section-num">6</span>
                    <h4 class="form-section-title">Equipamiento, Seguridad & Punto de Encuentro</h4>
                  </div>

                  <div class="form-group">
                    <label class="form-label" for="req-meeting"
                      >Punto de Encuentro & Ubicación *</label
                    >
                    <input
                      id="req-meeting"
                      type="text"
                      class="form-input"
                      placeholder="Ej: Dique El Jumeal, Club Náutico (RP 1)..."
                      [(ngModel)]="reqForm.meetingPoint"
                      name="meetingPoint"
                      required
                    />
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label class="form-label" for="req-included"
                        >Servicios e Indumentaria Provista *</label
                      >
                      <textarea
                        id="req-included"
                        rows="3"
                        class="form-input form-textarea"
                        placeholder="Ej: Kayaks de travesía, chalecos salvavidas, seguro..."
                        [(ngModel)]="reqForm.includedServices"
                        name="includedServices"
                        required
                      ></textarea>
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="req-requirements"
                        >Qué Debe Traer el Participante *</label
                      >
                      <textarea
                        id="req-requirements"
                        rows="3"
                        class="form-input form-textarea"
                        placeholder="Ej: Ropa de agua, toalla personal, protección solar..."
                        [(ngModel)]="reqForm.participantRequirements"
                        name="participantRequirements"
                        required
                      ></textarea>
                    </div>
                  </div>

                  <div class="form-group">
                    <label class="form-label" for="req-notes"
                      >Notas o Enlace a Fotos / Videos en Drive (Opcional)</label
                    >
                    <input
                      id="req-notes"
                      type="text"
                      class="form-input"
                      placeholder="Ej: https://drive.google.com/drive/folders/... (fotos o videos)"
                      [(ngModel)]="reqForm.notes"
                      name="notes"
                    />
                  </div>
                </div>

                <div class="modal-form-actions">
                  <button type="button" class="modal-btn-cancel" (click)="onClose()">
                    Cancelar
                  </button>
                  <button type="submit" class="modal-btn-submit" [disabled]="submittingRequest()">
                    @if (submittingRequest()) {
                      Enviando...
                    } @else {
                      Enviar Solicitud a Administradores
                    }
                  </button>
                </div>
              </form>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .exp-request-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 3500;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        background: rgba(4, 8, 20, 0.72);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        animation: fadeIn 0.15s ease;
      }
      .exp-request-modal {
        background: rgba(9, 18, 36, 0.84);
        border: 1px solid rgba(128, 179, 255, 0.45);
        border-radius: 4px;
        width: 100%;
        max-width: 840px;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        overflow: hidden;
      }
      .exp-request-header {
        position: relative;
        padding: 1.25rem 1.75rem 1.15rem 1.75rem;
        border-bottom: 1px solid rgba(128, 179, 255, 0.2);
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1.25rem;
        background: rgba(18, 28, 64, 0.55);
        flex-shrink: 0;
      }
      .modal-top-progress-stripe {
        position: absolute;
        top: 0;
        left: 0;
        height: 3px;
        background: linear-gradient(90deg, #2563eb 0%, #60a5fa 60%, #38bdf8 100%);
        box-shadow: 0 0 10px rgba(96, 165, 250, 0.7);
        transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 10;
      }
      .exp-request-header-content {
        flex: 1;
        min-width: 0;
      }
      .header-progress-wrap {
        margin-top: 0.85rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .header-progress-bar-bg {
        width: 100%;
        height: 6px;
        background: rgba(7, 13, 28, 0.75);
        border: 1px solid rgba(128, 179, 255, 0.25);
        border-radius: 999px;
        overflow: hidden;
      }
      .header-progress-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #2563eb 0%, #60a5fa 100%);
        transition: width 0.3s ease;
      }
      .header-progress-bar-fill.is-100 {
        background: linear-gradient(90deg, #10b981 0%, #34d399 100%);
      }
      .header-progress-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.72rem;
      }
      .progress-hint {
        color: rgba(255, 255, 255, 0.6);
      }
      .progress-badge {
        font-weight: 700;
        color: #80b3ff;
      }
      .progress-badge.is-complete {
        color: #34d399;
      }
      .exp-request-kicker {
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #80b3ff;
      }
      .exp-request-title {
        font-size: 1.28rem;
        font-weight: 700;
        color: #ffffff;
        margin: 0.2rem 0 0.3rem 0;
      }
      .exp-request-sub {
        font-size: 0.82rem;
        color: rgba(255, 255, 255, 0.7);
        margin: 0;
        line-height: 1.4;
      }
      .modal-close-icon-btn {
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.6);
        font-size: 1.8rem;
        cursor: pointer;
        line-height: 1;
        padding: 0;
        transition: color 0.15s ease;
      }
      .modal-close-icon-btn:hover {
        color: #ffffff;
      }
      .exp-request-body {
        padding: 1.5rem 1.75rem;
        overflow-y: auto;
        flex: 1;
      }
      .exp-modal-form {
        display: flex;
        flex-direction: column;
        gap: 1.75rem;
      }
      .form-section {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        background: rgba(14, 23, 50, 0.45);
        border: 1px solid rgba(128, 179, 255, 0.18);
        border-radius: 4px;
        padding: 1.15rem 1.35rem;
      }
      .form-section-header {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        margin-bottom: 0.25rem;
      }
      .form-section-num {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #80b3ff;
        color: #070d18;
        font-size: 0.74rem;
        font-weight: 800;
      }
      .form-section-title {
        font-size: 0.95rem;
        font-weight: 700;
        color: #ffffff;
        margin: 0;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .form-label {
        font-size: 0.78rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.85);
      }
      .badge-required {
        color: #80b3ff;
        font-size: 0.72rem;
        font-weight: 600;
      }
      .badge-optional {
        color: rgba(255, 255, 255, 0.45);
        font-size: 0.72rem;
        font-weight: 400;
      }
      .form-input {
        width: 100%;
        background: rgba(7, 13, 28, 0.8);
        border: 1px solid rgba(128, 179, 255, 0.3);
        border-radius: 2px;
        padding: 0.55rem 0.85rem;
        color: #ffffff;
        font-size: 0.85rem;
        font-family: inherit;
        box-sizing: border-box;
      }
      .form-input::placeholder,
      .form-textarea::placeholder {
        font-family: inherit;
        color: rgba(255, 255, 255, 0.42);
      }
      .form-input:focus {
        outline: none;
        border-color: #80b3ff;
        box-shadow: 0 0 0 2px rgba(128, 179, 255, 0.25);
      }
      .form-input.ng-invalid.ng-touched {
        border-color: #ef4444;
        box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.25);
      }
      .form-select {
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2380b3ff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 1.25rem center;
        background-size: 14px 14px;
        padding-right: 2.85rem !important;
        cursor: pointer;
      }
      .form-select option {
        background: #0b1528;
        color: #ffffff;
      }
      .label-with-counter {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .char-counter {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.5);
      }
      .field-hint {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.45);
        margin-top: 0.25rem;
        display: block;
      }
      .usd-auto-hint {
        font-size: 0.76rem;
        color: rgba(255, 255, 255, 0.7);
        margin-top: 0.4rem;
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }
      .usd-calc-val {
        color: #80b3ff;
      }
      .usd-formula {
        color: rgba(255, 255, 255, 0.4);
      }
      .form-textarea {
        resize: vertical;
        line-height: 1.45;
      }
      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
      .form-grid-3 {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
      }
      .media-upload-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
      .media-upload-group {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
      .media-dropzone {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 130px;
        padding: 1.25rem;
        border: 1.5px dashed rgba(128, 179, 255, 0.4);
        border-radius: 4px;
        background: rgba(7, 13, 28, 0.55);
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: center;
      }
      .media-dropzone:hover {
        border-color: #80b3ff;
        background: rgba(128, 179, 255, 0.08);
      }
      .media-dropzone.dropzone-error {
        border-color: #ef4444;
        background: rgba(239, 68, 68, 0.08);
      }
      .dropzone-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.35rem;
        color: rgba(255, 255, 255, 0.75);
      }
      .dropzone-icon {
        width: 32px;
        height: 32px;
        color: #80b3ff;
        margin-bottom: 0.15rem;
      }
      .dropzone-main-text {
        font-size: 0.82rem;
        font-weight: 700;
        color: #ffffff;
      }
      .dropzone-sub-text {
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.5);
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
      .media-preview-card {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        background: rgba(7, 13, 28, 0.85);
        border: 1px solid rgba(128, 179, 255, 0.4);
        border-radius: 4px;
        padding: 0.75rem;
      }
      .media-preview-visual {
        width: 100%;
        height: 120px;
        border-radius: 2px;
        overflow: hidden;
        background: #000000;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .media-img-preview {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .media-video-preview {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .media-preview-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.74rem;
      }
      .media-file-name {
        color: #ffffff;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .media-file-size {
        color: rgba(255, 255, 255, 0.5);
        flex-shrink: 0;
      }
      .media-action-btn {
        background: rgba(128, 179, 255, 0.15);
        border: 1px solid rgba(128, 179, 255, 0.4);
        color: #80b3ff;
        border-radius: 2px;
        padding: 0.35rem 0.65rem;
        font-size: 0.74rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .media-action-btn:hover {
        background: #80b3ff;
        color: #070d18;
      }
      .field-error-text {
        font-size: 0.72rem;
        color: #fca5a5;
        font-weight: 600;
      }
      .modal-form-actions {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 0.85rem;
        padding-top: 0.5rem;
      }
      .modal-btn-cancel {
        padding: 0.55rem 1.15rem;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 2px;
        color: #ffffff;
        font-size: 0.82rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .modal-btn-cancel:hover {
        border-color: #ffffff;
      }
      .modal-btn-submit {
        padding: 0.55rem 1.35rem;
        background: #80b3ff;
        border: 1px solid #80b3ff;
        border-radius: 2px;
        color: #070d18;
        font-size: 0.82rem;
        font-weight: 800;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .modal-btn-submit:hover:not(:disabled) {
        background: #a3c9ff;
        box-shadow: 0 4px 15px rgba(128, 179, 255, 0.4);
      }
      .modal-btn-submit:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .request-success-view {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 2.5rem 1.5rem;
        gap: 1rem;
      }
      .request-success-badge {
        display: inline-block;
        padding: 0.3rem 0.85rem;
        border-radius: 999px;
        background: rgba(16, 185, 129, 0.2);
        border: 1px solid #10b981;
        color: #34d399;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.08em;
      }
      .request-success-title {
        font-size: 1.5rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0;
      }
      .request-success-desc {
        font-size: 0.9rem;
        color: rgba(255, 255, 255, 0.8);
        max-width: 580px;
        margin: 0;
        line-height: 1.5;
      }
      .request-success-media-preview {
        display: flex;
        align-items: center;
        gap: 1rem;
        background: rgba(7, 13, 28, 0.7);
        border: 1px solid rgba(128, 179, 255, 0.3);
        border-radius: 4px;
        padding: 0.75rem 1rem;
        max-width: 500px;
        width: 100%;
        text-align: left;
      }
      .success-thumb-img {
        width: 64px !important;
        height: 64px !important;
        min-width: 64px !important;
        min-height: 64px !important;
        max-width: 64px !important;
        max-height: 64px !important;
        flex-shrink: 0 !important;
        object-fit: cover !important;
        border-radius: 4px;
        border: 1px solid rgba(128, 179, 255, 0.4);
        background: #0d1b38;
        display: block;
      }
      .return-to-panel-btn {
        background: #ffffff !important;
        color: #000000 !important;
        border: 1px solid #ffffff !important;
        font-weight: 700 !important;
      }
      .return-to-panel-btn:hover {
        background: #f0f0f0 !important;
        color: #000000 !important;
      }
      .success-thumb-info {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        min-width: 0;
      }
      .success-thumb-title {
        font-size: 0.75rem;
        font-weight: 700;
        color: #80b3ff;
      }
      .success-thumb-name {
        font-size: 0.8rem;
        color: #ffffff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .success-thumb-video {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.6);
      }
      @media (max-width: 680px) {
        .exp-request-modal-backdrop {
          padding: 0.5rem;
        }
        .exp-request-modal {
          max-height: 96vh;
        }
        .exp-request-header {
          padding: 1.25rem 1rem 1rem;
        }
        .exp-request-body {
          padding: 1.25rem 1rem;
        }
        .form-row,
        .form-grid-3,
        .media-upload-row {
          grid-template-columns: 1fr;
        }
        .modal-form-actions {
          flex-direction: column-reverse;
          gap: 0.75rem;
        }
        .modal-btn-cancel,
        .modal-btn-submit {
          width: 100%;
          text-align: center;
        }
      }
    `,
  ],
})
export class ProviderExperienceProposalModalComponent {
  private readonly store = inject(ProviderStoreService);
  private readonly storageService = inject(StorageService);

  readonly isOpen = input<boolean>(false);
  readonly closeModal = output<void>();
  readonly submitted = output<void>();

  @ViewChild('modalDialog') modalDialog?: ElementRef<HTMLElement>;
  private previousActiveElement: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        if (typeof document !== 'undefined') {
          this.previousActiveElement = document.activeElement as HTMLElement | null;
        }
        setTimeout(() => {
          this.focusInitialElement();
        }, 0);
      }
    });
  }

  private getFocusableElements(): HTMLElement[] {
    if (!this.modalDialog?.nativeElement) return [];
    const selector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(this.modalDialog.nativeElement.querySelectorAll<HTMLElement>(selector));
  }

  private focusInitialElement(): void {
    const focusable = this.getFocusableElements();
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      this.modalDialog?.nativeElement.focus();
    }
  }

  @HostListener('keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (!this.isOpen() || event.key !== 'Tab') return;

    const focusable = this.getFocusableElements();
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = typeof document !== 'undefined' ? document.activeElement : null;

    if (event.shiftKey) {
      if (active === first || !this.modalDialog?.nativeElement.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !this.modalDialog?.nativeElement.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  readonly requestSuccess = signal(false);
  readonly submittingRequest = signal(false);

  readonly coverImageFile = signal<File | null>(null);
  readonly coverImagePreview = signal<string | null>(null);
  readonly coverImageDataUrl = signal<string | null>(null);
  readonly finalSuccessCoverUrl = signal<string | null>(null);
  readonly coverImageError = signal<string | null>(null);

  readonly coverVideoFile = signal<File | null>(null);
  readonly coverVideoPreview = signal<string | null>(null);
  readonly coverVideoError = signal<string | null>(null);

  readonly Math = Math;

  reqForm = { ...DEFAULT_REQ_FORM };
  private successTimer: ReturnType<typeof setTimeout> | null = null;

  formatFileSize(bytes?: number): string {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  getFormProgress(): number {
    let score = 0;
    const total = 7;
    if (this.reqForm.title?.trim()) score++;
    if (this.reqForm.region?.trim()) score++;
    if (this.reqForm.subheading?.trim()) score++;
    if (this.coverImageFile()) score++;
    if (this.reqForm.difficulty?.trim() && this.reqForm.duration?.trim()) score++;
    if (this.reqForm.priceArs && this.reqForm.priceArs > 0) score++;
    if (this.reqForm.itinerary?.trim() && this.reqForm.meetingPoint?.trim()) score++;

    return Math.min(100, Math.round((score / total) * 100));
  }

  onCoverImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.handleCoverImageFile(file);
    input.value = '';
  }

  onCoverImageDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    this.handleCoverImageFile(file);
  }

  private handleCoverImageFile(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.coverImageError.set('El archivo seleccionado debe ser una imagen (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.coverImageError.set('La imagen supera el límite máximo de 5 MB.');
      return;
    }
    this.coverImageError.set(null);
    if (this.coverImagePreview()) {
      URL.revokeObjectURL(this.coverImagePreview()!);
    }
    this.coverImageFile.set(file);
    this.coverImageDataUrl.set(null);
    const objectUrl = URL.createObjectURL(file);
    this.coverImagePreview.set(objectUrl);
    this.finalSuccessCoverUrl.set(objectUrl);

    // Also read as DataURL to guarantee bulletproof thumbnail display
    if (typeof FileReader !== 'undefined') {
      const reader = new FileReader();
      reader.onload = () => {
        if (this.coverImageFile() === file && typeof reader.result === 'string') {
          this.coverImageDataUrl.set(reader.result);
          this.finalSuccessCoverUrl.set(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  removeCoverImage(): void {
    if (this.coverImagePreview()) {
      URL.revokeObjectURL(this.coverImagePreview()!);
    }
    this.coverImageFile.set(null);
    this.coverImagePreview.set(null);
    this.coverImageDataUrl.set(null);
    this.finalSuccessCoverUrl.set(null);
    this.coverImageError.set(null);
  }

  onCoverVideoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.handleCoverVideoFile(file);
    input.value = '';
  }

  onCoverVideoDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    this.handleCoverVideoFile(file);
  }

  private handleCoverVideoFile(file: File): void {
    if (!file.type.startsWith('video/')) {
      this.coverVideoError.set('El archivo seleccionado debe ser un video (MP4, MOV, WEBM).');
      return;
    }
    if (file.size > 150 * 1024 * 1024) {
      this.coverVideoError.set('El video supera el límite máximo de 150 MB.');
      return;
    }
    this.coverVideoError.set(null);
    if (this.coverVideoPreview()) {
      URL.revokeObjectURL(this.coverVideoPreview()!);
    }
    this.coverVideoFile.set(file);
    this.coverVideoPreview.set(URL.createObjectURL(file));
  }

  removeCoverVideo(): void {
    if (this.coverVideoPreview()) {
      URL.revokeObjectURL(this.coverVideoPreview()!);
    }
    this.coverVideoFile.set(null);
    this.coverVideoPreview.set(null);
    this.coverVideoError.set(null);
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.onClose();
    }
  }

  onClose(): void {
    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
    }
    if (this.successTimer) {
      clearTimeout(this.successTimer);
      this.successTimer = null;
    }
    this.reqForm = { ...DEFAULT_REQ_FORM };
    this.requestSuccess.set(false);
    this.submittingRequest.set(false);
    this.removeCoverImage();
    this.removeCoverVideo();
    this.closeModal.emit();
  }

  async submitRequestForm(form?: NgForm): Promise<void> {
    if (form) {
      form.control.markAllAsTouched();
      if (form.invalid) {
        return;
      }
    }

    const title = this.reqForm.title?.trim();
    const region = this.reqForm.region?.trim();
    if (!title || !region) return;

    const priceArs = Number(this.reqForm.priceArs);
    if (!Number.isFinite(priceArs) || priceArs < 1) {
      return;
    }

    if (!this.coverImageFile() && !this.coverImagePreview()) {
      this.coverImageError.set('La foto de portada es obligatoria para enviar la propuesta.');
      return;
    }
    this.submittingRequest.set(true);

    const prov = this.store.currentProvider();
    let coverImageUrl = this.coverImageDataUrl() || this.coverImagePreview() || '/assets/images/kayak-club-de-experiencias.jpg';
    const coverFile = this.coverImageFile();

    if (coverFile) {
      try {
        const uploadRes = await this.storageService.uploadFile(coverFile, 'PROPOSAL');
        if (uploadRes?.url) {
          coverImageUrl = uploadRes.url;
        }
      } catch (err) {
        console.warn('[ProposalModal] No se pudo subir imagen a storage, usando fallback:', err);
      }
    }

    this.finalSuccessCoverUrl.set(this.coverImageDataUrl() || this.coverImagePreview() || coverImageUrl);

    let coverVideoUrl: string | undefined = undefined;
    const videoFile = this.coverVideoFile();
    if (videoFile) {
      try {
        const uploadRes = await this.storageService.uploadFile(videoFile, 'VIDEO');
        if (uploadRes?.url) {
          coverVideoUrl = uploadRes.url;
        }
      } catch (err) {
        console.warn('[ProposalModal] No se pudo subir video a storage:', err);
      }
    }

    const priceUsd = Math.round(priceArs / 1600);

    try {
      this.store.submitExperienceRequest({
        providerId: prov?.id || 'prov-patricio',
        providerName: prov?.name || 'Patricio Facundo Diaz Tillar',
        providerAgency: prov?.agency || 'Catamarca Kayak & Aventura Náutica',
        providerEmail: prov?.email || 'patriciofacundodiaztillar@gmail.com',
        providerPhone: prov?.phone || '+54 383 455 8812',
        title,
        kicker: this.reqForm.kicker?.trim() || 'EXPERIENCIA',
        subheading: this.reqForm.subheading?.trim() || '',
        region,
        difficulty: this.reqForm.difficulty,
        duration: this.reqForm.duration,
        altitude: this.reqForm.altitude || '850 msnm',
        capacity: Number(this.reqForm.capacity) || 12,
        season: this.reqForm.season || 'Todo el año',
        dates: this.reqForm.dates?.trim() || 'A coordinar',
        priceArs,
        priceUsd,
        promosAndPricing: this.reqForm.promosAndPricing,
        itinerary: this.reqForm.itinerary,
        meetingPoint: this.reqForm.meetingPoint,
        includedServices: this.reqForm.includedServices,
        participantRequirements: this.reqForm.participantRequirements,
        notes: this.reqForm.notes,
        coverImage: coverImageUrl,
        coverImageName: coverFile?.name || 'portada.jpg',
        coverVideoUrl,
        coverVideoName: videoFile?.name,
      });

      this.successTimer = setTimeout(() => {
        this.submittingRequest.set(false);
        this.requestSuccess.set(true);
        this.submitted.emit();
      }, 850);
    } catch (err: any) {
      this.submittingRequest.set(false);
      alert(err?.message || 'Error al enviar la propuesta.');
    }
  }
}
