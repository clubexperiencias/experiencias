import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
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
import { NotificationService } from '../../../core/services/notification.service';
import { SUPABASE_CLIENT, isSupabaseConfigured } from '../../../core/supabase/supabase.client';
import { FechaPipe } from '../../../shared/pipes/format.pipes';
import { Router, RouterLink } from '@angular/router';
import { ProviderUser } from '../../../core/models/bank-transfer.model';
import { ExperienceAlbumPhoto } from '../../../core/models/experience.model';

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
  priceUsd: 46,
  promosAndPricing: '',
  itinerary: '',
  meetingPoint: '',
  includedServices: '',
  participantRequirements: '',
  notes: '',
  cbuAlias: '',
  bankName: '',
  accountHolder: '',
  cuitDni: '',
};

@Component({
  selector: 'app-provider-experience-proposal-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, RouterLink, FechaPipe],
  template: `
    @if (isOpen()) {
      <div class="proposal-page-wrapper">
        <div
          #modalDialog
          tabindex="-1"
          class="exp-request-card"
          role="region"
          aria-labelledby="req-modal-title"
        >
          <div class="exp-request-header">
            <div class="modal-top-progress-stripe" [style.width.%]="getFormProgress()"></div>
            <div class="exp-request-header-content">
              <span class="exp-request-kicker">NUEVA EXPERIENCIA</span>
              <h2 id="req-modal-title" class="exp-request-title">
                Cargar Propuesta de Experiencia
              </h2>
              <p class="exp-request-sub">
                Completá los detalles técnicos, fotos y tarifas de tu salida para que el equipo de
                administración la revise y publique en el catálogo.
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
                <div class="request-success-actions">
                  <a
                    [routerLink]="backLink()"
                    [queryParams]="{ tab: 'solicitudes' }"
                    class="modal-btn-submit return-to-panel-btn"
                  >
                    Ver mis solicitudes
                  </a>
                  <a [routerLink]="dashboardLink()" class="modal-btn-dashboard">
                    Volver al Panel
                  </a>
                </div>
              </div>
            } @else {
              @if (hasDraft()) {
                <div class="draft-notice-banner" role="status">
                  <div class="draft-notice-info">
                    <mat-icon class="draft-notice-icon">save</mat-icon>
                    <span>Borrador guardado en este navegador. Se conservará hasta que envíes la propuesta.</span>
                  </div>
                  <button
                    type="button"
                    class="draft-notice-discard-btn"
                    (click)="discardDraft()"
                    title="Borrar borrador y reiniciar formulario"
                  >
                    Descartar borrador
                  </button>
                </div>
              }
              <form #proposalForm="ngForm" class="exp-modal-form" (ngSubmit)="submitRequestForm(proposalForm)" (input)="saveDraft()" (change)="saveDraft()">
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
                              >Hacé click o arrastrá un video de hasta 50 MB (MP4, MOV, WEBM)</span
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
                      (ngModelChange)="onPriceArsChange($event)"
                      name="priceArs"
                      min="1000"
                      step="500"
                      required
                    />

                    <!-- Control flexible de Tarifa USD y Cotización Referencial -->
                    <div class="usd-box-wrapper">
                      <div class="usd-header-row">
                        <label class="usd-box-label" for="req-price-usd">Referencia en Dólares (USD)</label>
                        <div class="usd-rate-control">
                          <span class="rate-label">Cotización referencial:</span>
                          <span class="rate-prefix">&#36;</span>
                          <input
                            type="number"
                            class="rate-input"
                            [ngModel]="usdExchangeRate()"
                            (ngModelChange)="onExchangeRateChange($event)"
                            name="usdExchangeRate"
                            min="100"
                            step="50"
                            title="Modificar cotización del dólar para el cálculo"
                          />
                          <span class="rate-suffix">ARS / USD</span>
                        </div>
                      </div>

                      <div class="usd-input-wrapper">
                        <span class="usd-currency-prefix">USD</span>
                        <input
                          id="req-price-usd"
                          type="number"
                          class="form-input usd-input"
                          placeholder="Ej: 45"
                          [(ngModel)]="reqForm.priceUsd"
                          name="priceUsd"
                          min="1"
                          readonly
                        />
                      </div>
                    </div>
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

                  <div class="form-group dates-picker-group">
                    <label class="form-label" for="scheduled-date-picker">Fechas Programadas o Disponibilidad</label>

                    <!-- Opción flexible: A coordinar -->
                    <label class="flexible-dates-checkbox-label">
                      <input
                        type="checkbox"
                        [ngModel]="isDateFlexible()"
                        (ngModelChange)="toggleFlexibleDates($event)"
                        name="flexibleDates"
                        class="custom-checkbox"
                      />
                      <span>Salidas a coordinar / Todo el año (disponibilidad a convenir con el explorador)</span>
                    </label>

                    <!-- Selector visual de fechas fijas -->
                    <div class="dates-add-controls">
                      <div class="dates-input-row">
                        <input
                          id="scheduled-date-picker"
                          type="date"
                          [min]="todayIso"
                          [ngModel]="newScheduledDate()"
                          (ngModelChange)="newScheduledDate.set($event)"
                          name="newScheduledDate"
                          class="form-input datepicker-input"
                        />
                        <button
                          type="button"
                          class="btn-add-date-chip"
                          (click)="addScheduledDate()"
                          [disabled]="!newScheduledDate()"
                        >
                          + Agregar Fecha
                        </button>
                      </div>
                      @if (scheduledDateError()) {
                        <span class="field-error">{{ scheduledDateError() }}</span>
                      }
                    </div>

                    <!-- Lista de Chips Interactivos de Fechas -->
                    @if (scheduledDates().length > 0) {
                      <div class="scheduled-chips-container">
                        <span class="chips-title">Fechas fijas programadas ({{ scheduledDates().length }}):</span>
                        <div class="chips-list">
                          @for (date of scheduledDates(); track date) {
                            <div class="date-chip">
                              <span>{{ date | fecha }}</span>
                              <button
                                type="button"
                                class="chip-remove"
                                (click)="removeScheduledDate(date)"
                                title="Quitar fecha"
                              >
                                ✕
                              </button>
                            </div>
                          }
                        </div>
                      </div>
                    }

                    @if (!isDateFlexible() && scheduledDates().length === 0) {
                      <span class="field-error">Agregá al menos una fecha programada o marcá la opción "Salidas a coordinar".</span>
                    }

                    <span class="field-hint">
                      Resumen guardado: <strong>{{ reqForm.dates || 'A coordinar' }}</strong>
                    </span>
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
                      >Punto de Encuentro & Ubicación (Link de Google Maps) *</label
                    >
                    <input
                      id="req-meeting"
                      type="url"
                      class="form-input"
                      [class.input-error]="meetingPointError()"
                      placeholder="Ej: https://maps.app.goo.gl/... o https://www.google.com/maps/..."
                      [(ngModel)]="reqForm.meetingPoint"
                      (ngModelChange)="onMeetingPointChange($event)"
                      name="meetingPoint"
                      required
                    />
                    @if (meetingPointError()) {
                      <span class="field-error-text">{{ meetingPointError() }}</span>
                    } @else {
                      <span class="field-hint">
                        Ingresá el enlace de Google Maps para que el botón de Maps abra la ubicación exacta directamente.
                      </span>
                    }
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
                </div>

                <!-- 7. Álbum de Fotos de la Experiencia (Opcional) -->
                <div class="form-section album-form-section">
                  <div class="form-section-header">
                    <span class="form-section-num">7</span>
                    <div class="section-title-wrap">
                      <h4 class="form-section-title">
                        Álbum de Fotos de la Experiencia <span class="badge-optional">(Opcional)</span>
                      </h4>
                      <p class="form-section-desc">
                        Opcional: podés sumar hasta 2 fotos destacadas y hasta 9 de galería común para que se muestre el botón de fotos de experiencias pasadas en el catálogo (<code>/experiencias/:slug/fotos</code>). Si no cargás fotos adicionales, la experiencia se publicará sin galería de fotos pasadas.
                      </p>
                    </div>
                  </div>

                  <!-- Resumen visual de estado -->
                  <div class="album-counters-bar">
                    <div class="counter-badge" [class.is-valid]="!!(coverImagePreview() || coverImageFile())">
                      <span class="badge-dot"></span>
                      <span>Portada: <strong>{{ (coverImagePreview() || coverImageFile()) ? '1 / 1' : '0 / 1' }}</strong></span>
                    </div>
                    <div class="counter-badge" [class.is-valid]="featuredCount() === 2">
                      <span class="badge-dot"></span>
                      <span>Destacadas: <strong>{{ featuredCount() }} / 2</strong></span>
                    </div>
                    <div class="counter-badge" [class.is-valid]="galleryPhotos().length > 0">
                      <span class="badge-dot"></span>
                      <span>Galería común: <strong>{{ galleryPhotos().length }} / 9</strong></span>
                    </div>
                  </div>

                  <!-- Bloque 1: Portada (1 foto) -->
                  <div class="album-slot-block">
                    <div class="slot-block-header">
                      <span class="slot-role-tag role-cover">PORTADA PRINCIPAL (1/1)</span>
                      <span class="slot-hint">Imagen de portada del catálogo y presentación principal.</span>
                    </div>

                    @if (coverImagePreview()) {
                      <div class="album-photo-card is-cover-card">
                        <div class="card-thumb-wrap">
                          <img [src]="coverImagePreview()" alt="Foto de portada" class="card-thumb-img" />
                          <span class="card-role-indicator">Portada activa</span>
                        </div>
                        <div class="card-meta">
                          <span class="card-file-name" [title]="coverImageFile()?.name || 'Foto de portada'">
                            {{ coverImageFile()?.name || 'Foto de portada principal' }}
                          </span>
                          @if (coverImageFile()) {
                            <span class="card-file-size">{{ formatFileSize(coverImageFile()?.size) }}</span>
                          }
                        </div>
                        <div class="card-actions">
                          <label class="btn-card-action">
                            <span>Cambiar</span>
                            <input
                              type="file"
                              class="sr-only"
                              accept="image/*"
                              (change)="onCoverImageSelected($event)"
                            />
                          </label>
                          <button
                            type="button"
                            class="btn-card-action btn-danger"
                            (click)="removeCoverImage()"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    } @else {
                      <label
                        class="album-dropzone"
                        [class.dropzone-error]="coverImageError()"
                        (dragover)="$event.preventDefault()"
                        (drop)="onCoverImageDrop($event)"
                      >
                        <input
                          type="file"
                          class="sr-only"
                          accept="image/*"
                          (change)="onCoverImageSelected($event)"
                        />
                        <div class="dropzone-body">
                          <svg class="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                          <span class="dropzone-text-main">Subir Foto de Portada *</span>
                          <span class="dropzone-text-sub">Arrastrá o hacé click para seleccionar (JPG, PNG, WEBP)</span>
                        </div>
                      </label>
                    }
                  </div>

                  <!-- Bloque 2: Dos Fotos Destacadas -->
                  <div class="album-slot-block">
                    <div class="slot-block-header">
                      <span class="slot-role-tag role-featured">FOTOS DESTACADAS (2 FOTOS)</span>
                      <span class="slot-hint">Dos imágenes de gran atractivo visual que encabezan la galería.</span>
                    </div>

                    <div class="featured-slots-grid">
                      <!-- Destacada 1 -->
                      <div class="featured-slot-item">
                        <div class="featured-slot-title">
                          <span class="featured-slot-num">1</span>
                          <span>Destacada 1</span>
                        </div>

                        @if (featuredPhoto1Preview()) {
                          <div class="album-photo-card is-featured-card">
                            <div class="card-thumb-wrap">
                              <img [src]="featuredPhoto1Preview()" alt="Destacada 1" class="card-thumb-img" />
                              <span class="card-role-indicator">Destacada 1</span>
                            </div>
                            <div class="card-meta">
                              <span class="card-file-name" [title]="featuredPhoto1File()?.name || 'Destacada 1'">
                                {{ featuredPhoto1File()?.name || 'destacada-1.jpg' }}
                              </span>
                            </div>
                            <div class="card-actions">
                              <label class="btn-card-action">
                                <span>Cambiar</span>
                                <input
                                  type="file"
                                  class="sr-only"
                                  accept="image/*"
                                  (change)="onFeaturedPhotoSelected($event, 1)"
                                />
                              </label>
                              <button
                                type="button"
                                class="btn-card-action btn-danger"
                                (click)="removeFeaturedPhoto(1)"
                              >
                                Quitar
                              </button>
                            </div>
                          </div>
                        } @else {
                          <label
                            class="album-dropzone dropzone-sm"
                            (dragover)="$event.preventDefault()"
                            (drop)="onFeaturedPhotoDrop($event, 1)"
                          >
                            <input
                              type="file"
                              class="sr-only"
                              accept="image/*"
                              (change)="onFeaturedPhotoSelected($event, 1)"
                            />
                            <div class="dropzone-body">
                              <svg class="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                              <span class="dropzone-text-main">Subir Destacada 1</span>
                              <span class="dropzone-text-sub">JPG, PNG, WEBP</span>
                            </div>
                          </label>
                        }
                      </div>

                      <!-- Destacada 2 -->
                      <div class="featured-slot-item">
                        <div class="featured-slot-title">
                          <span class="featured-slot-num">2</span>
                          <span>Destacada 2</span>
                        </div>

                        @if (featuredPhoto2Preview()) {
                          <div class="album-photo-card is-featured-card">
                            <div class="card-thumb-wrap">
                              <img [src]="featuredPhoto2Preview()" alt="Destacada 2" class="card-thumb-img" />
                              <span class="card-role-indicator">Destacada 2</span>
                            </div>
                            <div class="card-meta">
                              <span class="card-file-name" [title]="featuredPhoto2File()?.name || 'Destacada 2'">
                                {{ featuredPhoto2File()?.name || 'destacada-2.jpg' }}
                              </span>
                            </div>
                            <div class="card-actions">
                              <label class="btn-card-action">
                                <span>Cambiar</span>
                                <input
                                  type="file"
                                  class="sr-only"
                                  accept="image/*"
                                  (change)="onFeaturedPhotoSelected($event, 2)"
                                />
                              </label>
                              <button
                                type="button"
                                class="btn-card-action btn-danger"
                                (click)="removeFeaturedPhoto(2)"
                              >
                                Quitar
                              </button>
                            </div>
                          </div>
                        } @else {
                          <label
                            class="album-dropzone dropzone-sm"
                            (dragover)="$event.preventDefault()"
                            (drop)="onFeaturedPhotoDrop($event, 2)"
                          >
                            <input
                              type="file"
                              class="sr-only"
                              accept="image/*"
                              (change)="onFeaturedPhotoSelected($event, 2)"
                            />
                            <div class="dropzone-body">
                              <svg class="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                              <span class="dropzone-text-main">Subir Destacada 2</span>
                              <span class="dropzone-text-sub">JPG, PNG, WEBP</span>
                            </div>
                          </label>
                        }
                      </div>
                    </div>
                  </div>

                  <!-- Bloque 3: Galería Común (Hasta 9 Fotos) -->
                  <div class="album-slot-block">
                    <div class="slot-block-header">
                      <span class="slot-role-tag role-gallery">FOTOS DE GALERÍA COMÚN (HASTA 9)</span>
                      <span class="slot-hint">Imágenes del entorno o participantes (quedan {{ 9 - galleryPhotos().length }} lugares).</span>
                    </div>

                    @if (galleryPhotos().length < 9) {
                      <label
                        class="album-dropzone dropzone-gallery"
                        (dragover)="$event.preventDefault()"
                        (drop)="onGalleryPhotosDrop($event)"
                      >
                        <input
                          type="file"
                          class="sr-only"
                          accept="image/*"
                          multiple
                          (change)="onGalleryPhotosSelected($event)"
                        />
                        <div class="dropzone-body">
                          <svg class="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                            <rect x="2" y="2" width="20" height="20" rx="3" ry="3" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                            <line x1="12" y1="8" x2="12" y2="16" />
                            <line x1="8" y1="12" x2="16" y2="12" />
                          </svg>
                          <span class="dropzone-text-main">Agregar Fotos a la Galería ({{ galleryPhotos().length }} / 9)</span>
                          <span class="dropzone-text-sub">
                            Podés seleccionar o arrastrar múltiples fotos a la vez
                          </span>
                        </div>
                      </label>
                    }

                    @if (galleryPhotoError()) {
                      <span class="field-error-text">{{ galleryPhotoError() }}</span>
                    }

                    @if (galleryPhotos().length > 0) {
                      <div class="gallery-thumbs-grid">
                        @for (item of galleryPhotos(); track item.id; let idx = $index) {
                          <div class="gallery-thumb-item">
                            <img [src]="item.previewUrl" [alt]="item.name" class="gallery-thumb-img" />
                            <span class="thumb-index-pill">#{{ idx + 1 }}</span>
                            <button
                              type="button"
                              class="btn-thumb-remove"
                              (click)="removeGalleryPhoto(item.id)"
                              title="Quitar foto de galería"
                              aria-label="Quitar foto"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>

                <!-- 8. Datos Bancarios para Liquidación de Pagos -->
                <div class="form-section">
                  <div class="form-section-header">
                    <span class="form-section-num">8</span>
                    <div class="section-title-wrap">
                      <h4 class="form-section-title">Datos Bancarios para Liquidación de Pagos</h4>
                      <p class="form-section-desc">
                        Cuenta bancaria o virtual donde se liquidan las recaudaciones de esta experiencia. Vinculada a tu perfil de prestador.
                      </p>
                    </div>
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label class="form-label" for="req-cbu-alias">
                        CBU o Alias de Destino <span class="req-star">*</span>
                      </label>
                      <input
                        id="req-cbu-alias"
                        type="text"
                        class="form-input text-mono"
                        placeholder="Ej. EXPERIENCIAS.CLUB.MP o 22 dígitos"
                        [(ngModel)]="reqForm.cbuAlias"
                        name="cbuAlias"
                        required
                      />
                      <span class="field-hint">Alias o CBU de 22 dígitos exactos</span>
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="req-bank-name">
                        Entidad Bancaria o Billetera <span class="req-star">*</span>
                      </label>
                      <input
                        id="req-bank-name"
                        type="text"
                        class="form-input"
                        placeholder="Ej. Banco Nación / Mercado Pago"
                        [(ngModel)]="reqForm.bankName"
                        name="bankName"
                        required
                      />
                    </div>
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label class="form-label" for="req-account-holder">
                        Nombre / Titular de la Cuenta <span class="req-star">*</span>
                      </label>
                      <input
                        id="req-account-holder"
                        type="text"
                        class="form-input"
                        placeholder="Nombre y Apellido del Titular"
                        [(ngModel)]="reqForm.accountHolder"
                        name="accountHolder"
                        required
                      />
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="req-cuit-dni">
                        CUIT o CUIL <span class="req-star">*</span>
                      </label>
                      <input
                        id="req-cuit-dni"
                        type="text"
                        class="form-input text-mono"
                        placeholder="Ej. 20-12345678-9"
                        [(ngModel)]="reqForm.cuitDni"
                        name="cuitDni"
                        required
                      />
                    </div>
                  </div>
                </div>

                @if (formValidationError()) {
                  <div class="form-validation-alert" role="alert">
                    <mat-icon class="alert-icon">error_outline</mat-icon>
                    <span>{{ formValidationError() }}</span>
                  </div>
                }

                <div class="modal-form-actions">
                  <a [routerLink]="backLink()" class="modal-btn-cancel">
                    Cancelar
                  </a>
                  <button type="submit" class="modal-btn-submit" [disabled]="submittingRequest()">
                    @if (submittingRequest()) {
                      Enviando...
                    } @else {
                      Enviar Propuesta a Administradores
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
      .proposal-page-wrapper {
        width: 100%;
        max-width: 900px;
        margin: 0 auto;
        padding: 0.5rem 0 3.5rem 0;
        display: flex;
        flex-direction: column;
        gap: 1.15rem;
      }
      .proposal-page-nav-bar {
        display: flex;
        align-items: center;
      }
      .back-to-exp-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.48rem 1.05rem;
        background: #80b3ff;
        border: 1px solid #80b3ff;
        color: #070d18;
        border-radius: 4px;
        font-size: 0.82rem;
        font-weight: 700;
        text-decoration: none !important;
        letter-spacing: 0.02em;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        white-space: nowrap;
        box-shadow: 0 4px 14px rgba(128, 179, 255, 0.25);
      }
      .back-to-exp-link:hover {
        background: #9cc4ff;
        border-color: #9cc4ff;
        color: #070d18;
        transform: translateY(-2px);
        box-shadow: 0 6px 18px rgba(128, 179, 255, 0.4);
      }
      .back-to-exp-link:active {
        transform: translateY(0);
        box-shadow: 0 2px 6px rgba(128, 179, 255, 0.3);
      }
      .exp-request-card {
        background: rgba(9, 18, 36, 0.88);
        border: 1px solid rgba(128, 179, 255, 0.35);
        border-radius: 4px;
        width: 100%;
        display: flex;
        flex-direction: column;
        box-shadow: 0 15px 40px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        overflow: hidden;
      }
      .draft-notice-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.65rem 0.95rem;
        margin-bottom: 1.25rem;
        background: rgba(37, 99, 235, 0.12);
        border: 1px solid rgba(96, 165, 250, 0.35);
        border-radius: 4px;
        font-size: 0.8125rem;
        color: #93c5fd;
      }
      .draft-notice-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .draft-notice-icon {
        font-size: 1.1rem;
        width: 1.1rem;
        height: 1.1rem;
        color: #60a5fa;
      }
      .draft-notice-discard-btn {
        background: transparent;
        border: none;
        color: #f87171;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        text-decoration: underline;
        padding: 0.2rem 0.4rem;
        white-space: nowrap;
        transition: color 0.15s ease;
      }
      .draft-notice-discard-btn:hover {
        color: #ef4444;
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
      .section-title-wrap {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }
      .form-section-desc {
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.65);
        margin: 0;
        line-height: 1.4;
      }
      .req-star {
        color: #80b3ff;
      }
      .text-mono {
        font-family: monospace;
        letter-spacing: 0.03em;
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
      .form-input.ng-invalid.ng-touched,
      .form-input.input-error {
        border-color: #ef4444 !important;
        box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.25) !important;
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
      .usd-box-wrapper {
        margin-top: 0.65rem;
        padding: 0.75rem 0.95rem;
        background: rgba(128, 179, 255, 0.05);
        border: 1px solid rgba(128, 179, 255, 0.18);
        border-radius: 4px;
      }
      .usd-header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-bottom: 0.45rem;
      }
      .usd-box-label {
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: #80b3ff;
      }
      .usd-input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }
      .usd-currency-prefix {
        position: absolute;
        left: 0.85rem;
        color: #80b3ff;
        font-weight: 700;
        font-size: 0.82rem;
        pointer-events: none;
      }
      .usd-input {
        padding-left: 3.4rem !important;
      }
      .usd-input[readonly] {
        background: rgba(10, 18, 38, 0.5);
        color: #cbd5e1;
        cursor: default;
      }
      .usd-rate-control {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        margin-top: 0;
        font-size: 0.76rem;
        color: rgba(255, 255, 255, 0.65);
      }
      .rate-input {
        width: 75px;
        padding: 0.2rem 0.4rem;
        background: rgba(10, 18, 38, 0.8);
        border: 1px solid rgba(128, 179, 255, 0.35);
        border-radius: 3px;
        color: #ffffff;
        font-size: 0.76rem;
        font-weight: 600;
        text-align: right;
      }
      .rate-input:focus {
        border-color: #80b3ff;
        outline: none;
      }
      .dates-picker-group {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
      }
      .flexible-dates-checkbox-label {
        display: inline-flex;
        align-items: center;
        gap: 0.6rem;
        font-size: 0.82rem;
        color: #ffffff;
        cursor: pointer;
        padding: 0.45rem 0.75rem;
        background: rgba(128, 179, 255, 0.06);
        border: 1px solid rgba(128, 179, 255, 0.2);
        border-radius: 4px;
        user-select: none;
      }
      .custom-checkbox {
        width: 1.05rem;
        height: 1.05rem;
        accent-color: #80b3ff;
        cursor: pointer;
      }
      .dates-add-controls {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .dates-input-row {
        display: flex;
        gap: 0.65rem;
        align-items: center;
      }
      .datepicker-input {
        max-width: 210px;
        color-scheme: dark;
      }
      .btn-add-date-chip {
        padding: 0.52rem 0.95rem;
        background: rgba(128, 179, 255, 0.16);
        border: 1px solid rgba(128, 179, 255, 0.4);
        color: #80b3ff;
        border-radius: 4px;
        font-size: 0.8125rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      .btn-add-date-chip:hover:not(:disabled) {
        background: #80b3ff;
        color: #070d18;
      }
      .btn-add-date-chip:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .scheduled-chips-container {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        margin-top: 0.25rem;
      }
      .chips-title {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: rgba(255, 255, 255, 0.6);
        font-weight: 600;
      }
      .chips-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
      }
      .date-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.35rem 0.75rem;
        background: rgba(128, 179, 255, 0.12);
        border: 1px solid rgba(128, 179, 255, 0.3);
        border-radius: 4px;
        color: #ffffff;
        font-size: 0.8125rem;
        font-weight: 600;
      }
      .chip-remove {
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.6);
        cursor: pointer;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85rem;
        transition: color 0.15s ease;
      }
      .chip-remove:hover {
        color: #ff6666;
      }
      .form-validation-alert {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0.85rem 1.15rem;
        background: rgba(255, 80, 80, 0.12);
        border: 1px solid rgba(255, 80, 80, 0.45);
        border-radius: 4px;
        color: #ffcccc;
        font-size: 0.84rem;
        font-weight: 500;
        margin-top: 1rem;
        line-height: 1.4;
      }
      .form-validation-alert .alert-icon {
        color: #ff6666;
        font-size: 1.25rem;
        width: 1.25rem;
        height: 1.25rem;
        flex-shrink: 0;
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
      .request-success-actions {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.85rem;
        flex-wrap: wrap;
        width: 100%;
        margin-top: 0.5rem;
      }
      .modal-btn-dashboard {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.75rem 1.5rem;
        background: rgba(128, 179, 255, 0.15);
        color: #ffffff !important;
        border: 1px solid rgba(128, 179, 255, 0.35);
        border-radius: 4px;
        text-decoration: none !important;
        font-weight: 600;
        font-size: 0.85rem;
        transition: all 0.2s ease;
      }
      .modal-btn-dashboard:hover {
        background: rgba(128, 179, 255, 0.28);
        border-color: rgba(128, 179, 255, 0.6);
      }
      /* Álbum de Fotos de la Experiencia */
      .album-counters-bar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.65rem;
        margin: 0.25rem 0 0.5rem;
      }
      .counter-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.3rem 0.65rem;
        background: rgba(128, 179, 255, 0.08);
        border: 1px solid rgba(128, 179, 255, 0.25);
        border-radius: 4px;
        font-size: 0.74rem;
        color: rgba(255, 255, 255, 0.75);
      }
      .counter-badge .badge-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #94a3b8;
      }
      .counter-badge.is-valid {
        border-color: rgba(52, 211, 153, 0.5);
        background: rgba(16, 185, 129, 0.12);
        color: #34d399;
      }
      .counter-badge.is-valid .badge-dot {
        background: #10b981;
        box-shadow: 0 0 6px rgba(16, 185, 129, 0.7);
      }
      .album-slot-block {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        padding: 0.95rem 1.1rem;
        background: rgba(7, 13, 28, 0.45);
        border: 1px solid rgba(128, 179, 255, 0.16);
        border-radius: 4px;
        margin-top: 0.35rem;
      }
      .slot-block-header {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        flex-wrap: wrap;
      }
      .slot-role-tag {
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        padding: 0.2rem 0.55rem;
        border-radius: 3px;
      }
      .role-cover {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
        border: 1px solid rgba(245, 158, 11, 0.45);
      }
      .role-featured {
        background: rgba(96, 165, 250, 0.15);
        color: #60a5fa;
        border: 1px solid rgba(96, 165, 250, 0.45);
      }
      .role-gallery {
        background: rgba(148, 163, 184, 0.15);
        color: #cbd5e1;
        border: 1px solid rgba(148, 163, 184, 0.35);
      }
      .slot-hint {
        font-size: 0.73rem;
        color: rgba(255, 255, 255, 0.55);
      }
      .featured-slots-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
      .featured-slot-item {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
      }
      .featured-slot-title {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        font-size: 0.76rem;
        font-weight: 700;
        color: #80b3ff;
      }
      .featured-slot-num {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: rgba(128, 179, 255, 0.22);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.68rem;
        color: #ffffff;
      }
      .album-dropzone {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 1.15rem;
        border: 1.5px dashed rgba(128, 179, 255, 0.35);
        border-radius: 4px;
        background: rgba(7, 13, 28, 0.55);
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: center;
      }
      .album-dropzone:hover {
        border-color: #80b3ff;
        background: rgba(128, 179, 255, 0.08);
      }
      .album-dropzone.dropzone-sm {
        min-height: 105px;
        padding: 0.85rem;
      }
      .album-dropzone.dropzone-gallery {
        min-height: 100px;
        padding: 1rem;
      }
      .dropzone-body {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.3rem;
      }
      .dropzone-text-main {
        font-size: 0.8rem;
        font-weight: 700;
        color: #ffffff;
      }
      .dropzone-text-sub {
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.5);
      }
      .album-photo-card {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        padding: 0.65rem 0.85rem;
        background: rgba(10, 18, 38, 0.85);
        border: 1px solid rgba(128, 179, 255, 0.3);
        border-radius: 4px;
      }
      .card-thumb-wrap {
        position: relative;
        width: 82px;
        height: 58px;
        border-radius: 3px;
        overflow: hidden;
        flex-shrink: 0;
        background: #000000;
      }
      .card-thumb-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .card-role-indicator {
        position: absolute;
        bottom: 2px;
        left: 2px;
        right: 2px;
        font-size: 0.58rem;
        font-weight: 700;
        text-align: center;
        background: rgba(0, 0, 0, 0.78);
        color: #ffffff;
        border-radius: 2px;
        padding: 1px 2px;
      }
      .card-meta {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }
      .card-file-name {
        font-size: 0.75rem;
        font-weight: 600;
        color: #ffffff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .card-file-size {
        font-size: 0.68rem;
        color: rgba(255, 255, 255, 0.45);
      }
      .card-actions {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex-shrink: 0;
      }
      .btn-card-action {
        font-size: 0.7rem;
        font-weight: 700;
        padding: 0.32rem 0.65rem;
        border-radius: 3px;
        border: 1px solid rgba(128, 179, 255, 0.4);
        background: rgba(128, 179, 255, 0.15);
        color: #80b3ff;
        cursor: pointer;
        transition: all 0.15s ease;
        line-height: 1;
      }
      .btn-card-action:hover {
        background: #80b3ff;
        color: #070d18;
      }
      .btn-card-action.btn-danger {
        border-color: rgba(239, 68, 68, 0.4);
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
      }
      .btn-card-action.btn-danger:hover {
        background: #ef4444;
        color: #ffffff;
      }
      .gallery-thumbs-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(85px, 1fr));
        gap: 0.65rem;
        margin-top: 0.65rem;
      }
      .gallery-thumb-item {
        position: relative;
        aspect-ratio: 1;
        border-radius: 4px;
        overflow: hidden;
        border: 1px solid rgba(128, 179, 255, 0.28);
        background: #000000;
      }
      .gallery-thumb-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .thumb-index-pill {
        position: absolute;
        top: 4px;
        left: 4px;
        font-size: 0.62rem;
        font-weight: 800;
        background: rgba(0, 0, 0, 0.78);
        color: #80b3ff;
        padding: 1px 4px;
        border-radius: 2px;
        line-height: 1.2;
      }
      .btn-thumb-remove {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.8);
        border: none;
        color: #f87171;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 2px;
        transition: all 0.15s ease;
      }
      .btn-thumb-remove:hover {
        background: #ef4444;
        color: #ffffff;
      }
      .btn-thumb-remove svg {
        width: 12px;
        height: 12px;
      }
      @media (max-width: 680px) {
        .featured-slots-grid {
          grid-template-columns: 1fr;
        }
        .proposal-page-wrapper {
          padding: 0.25rem 0 2rem;
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
  private readonly notificationService = inject(NotificationService);
  private readonly supabase = inject(SUPABASE_CLIENT);
  private readonly router = inject(Router);

  readonly backLink = computed(() => {
    const isPanel =
      typeof window !== 'undefined' && window.location.pathname.includes('/prestadores/panel');
    return isPanel ? '/prestadores/panel/experiencias' : '/experiencias';
  });

  readonly dashboardLink = computed(() => {
    const isPanel =
      typeof window !== 'undefined' && window.location.pathname.includes('/prestadores/panel');
    return isPanel ? '/prestadores/panel/dashboard' : '/dashboard';
  });

  readonly isOpen = input<boolean>(true);
  readonly closeModal = output<void>();
  readonly submitted = output<void>();

  @ViewChild('modalDialog') modalDialog?: ElementRef<HTMLElement>;
  private previousActiveElement: HTMLElement | null = null;

  static readonly DRAFT_STORAGE_KEY = 'experiencias_provider_proposal_draft';
  readonly hasDraft = signal<boolean>(false);

  constructor() {
    this.loadDraft();
    effect(() => {
      const prov = this.store.currentProvider();
      if (prov) {
        if (!this.reqForm.cbuAlias?.trim()) this.reqForm.cbuAlias = prov.cbuAlias || '';
        if (!this.reqForm.bankName?.trim()) this.reqForm.bankName = prov.bankName || '';
        if (!this.reqForm.accountHolder?.trim()) this.reqForm.accountHolder = prov.name || '';
        if (!this.reqForm.cuitDni?.trim()) this.reqForm.cuitDni = prov.cuitDni || '';
      }
    });
    effect(() => {
      if (this.isOpen()) {
        if (typeof document !== 'undefined') {
          this.previousActiveElement = document.activeElement as HTMLElement | null;
        }
        this.loadDraft();
        setTimeout(() => {
          this.focusInitialElement();
        }, 0);
      }
    });
  }

  private syncBankingWithProvider(): void {
    const prov = this.store.currentProvider();
    if (!prov) return;
    if (!this.reqForm.cbuAlias?.trim()) {
      this.reqForm.cbuAlias = prov.cbuAlias || '';
    }
    if (!this.reqForm.bankName?.trim()) {
      this.reqForm.bankName = prov.bankName || '';
    }
    if (!this.reqForm.accountHolder?.trim()) {
      this.reqForm.accountHolder = prov.name || '';
    }
    if (!this.reqForm.cuitDni?.trim()) {
      this.reqForm.cuitDni = prov.cuitDni || '';
    }
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

  // Álbum de fotos: 2 destacadas y hasta 9 de galería común
  readonly featuredPhoto1File = signal<File | null>(null);
  readonly featuredPhoto1Preview = signal<string | null>(null);
  readonly featuredPhoto1DataUrl = signal<string | null>(null);

  readonly featuredPhoto2File = signal<File | null>(null);
  readonly featuredPhoto2Preview = signal<string | null>(null);
  readonly featuredPhoto2DataUrl = signal<string | null>(null);

  readonly galleryPhotos = signal<
    { id: string; file?: File; previewUrl: string; dataUrl?: string; name: string }[]
  >([]);
  readonly galleryPhotoError = signal<string | null>(null);

  readonly featuredCount = computed(
    () => (this.featuredPhoto1Preview() ? 1 : 0) + (this.featuredPhoto2Preview() ? 1 : 0),
  );
  readonly galleryCount = computed(() => this.galleryPhotos().length);

  readonly meetingPointError = signal<string | null>(null);
  readonly formValidationError = signal<string | null>(null);

  // USD Rate and Calculation
  readonly usdExchangeRate = signal<number>(1400);
  readonly isUsdAutoCalc = signal<boolean>(true);

  // Scheduled Dates & Datepicker
  readonly todayIso = new Date().toISOString().slice(0, 10);
  readonly isDateFlexible = signal<boolean>(true);
  readonly scheduledDates = signal<string[]>([]);
  readonly newScheduledDate = signal<string>('');
  readonly scheduledDateError = signal<string | null>(null);

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

  isValidGoogleMapsUrl(url?: string): boolean {
    if (!url) return false;
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) return false;

    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      const pathname = parsed.pathname.toLowerCase();

      if (host === 'maps.app.goo.gl') return true;
      if (host === 'goo.gl' && pathname.startsWith('/maps')) return true;
      const isGoogleDomain = /(^|\.)google\.(com|com\.[a-z]{2}|[a-z]{2})$/i.test(host);
      if (isGoogleDomain && (pathname.startsWith('/maps') || /(^|\.)maps\.google\./i.test(host))) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  onMeetingPointChange(val: string): void {
    const trimmed = val ? val.trim() : '';
    if (!trimmed) {
      this.meetingPointError.set(null);
      this.saveDraft();
      return;
    }
    if (!this.isValidGoogleMapsUrl(trimmed)) {
      this.meetingPointError.set(
        'Ingresá un enlace válido de Google Maps (ej. https://maps.app.goo.gl/... o https://www.google.com/maps/...).',
      );
    } else {
      this.meetingPointError.set(null);
    }
    this.saveDraft();
  }

  getFormProgress(): number {
    let score = 0;
    const total = 9;
    if (this.reqForm.title?.trim()) score++;
    if (this.reqForm.region?.trim()) score++;
    if (this.reqForm.subheading?.trim()) score++;
    if (this.coverImageFile() || this.coverImagePreview()) score++;
    if (this.reqForm.difficulty?.trim() && this.reqForm.duration?.trim()) score++;
    if (this.reqForm.priceArs && this.reqForm.priceArs > 0) score++;
    if (this.reqForm.itinerary?.trim()) score++;
    if (this.reqForm.meetingPoint?.trim() && this.isValidGoogleMapsUrl(this.reqForm.meetingPoint)) score++;
    if (this.reqForm.cbuAlias?.trim() && this.reqForm.bankName?.trim()) score++;

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
          this.saveDraft();
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
    this.saveDraft();
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
    if (file.size > 50 * 1024 * 1024) {
      this.coverVideoError.set(
        'El video supera el límite de 50 MB. Podés incluir un enlace de Drive o YouTube en las notas si el archivo es más pesado.',
      );
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

  onFeaturedPhotoSelected(event: Event, slot: 1 | 2): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.handleFeaturedPhotoFile(file, slot);
    input.value = '';
  }

  onFeaturedPhotoDrop(event: DragEvent, slot: 1 | 2): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    this.handleFeaturedPhotoFile(file, slot);
  }

  private handleFeaturedPhotoFile(file: File, slot: 1 | 2): void {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return;

    const objectUrl = URL.createObjectURL(file);
    if (slot === 1) {
      if (this.featuredPhoto1Preview()) URL.revokeObjectURL(this.featuredPhoto1Preview()!);
      this.featuredPhoto1File.set(file);
      this.featuredPhoto1Preview.set(objectUrl);
    } else {
      if (this.featuredPhoto2Preview()) URL.revokeObjectURL(this.featuredPhoto2Preview()!);
      this.featuredPhoto2File.set(file);
      this.featuredPhoto2Preview.set(objectUrl);
    }

    if (typeof FileReader !== 'undefined') {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          if (slot === 1) {
            this.featuredPhoto1DataUrl.set(reader.result);
          } else {
            this.featuredPhoto2DataUrl.set(reader.result);
          }
          this.saveDraft();
        }
      };
      reader.readAsDataURL(file);
    }
  }

  removeFeaturedPhoto(slot: 1 | 2): void {
    if (slot === 1) {
      if (this.featuredPhoto1Preview()) URL.revokeObjectURL(this.featuredPhoto1Preview()!);
      this.featuredPhoto1File.set(null);
      this.featuredPhoto1Preview.set(null);
      this.featuredPhoto1DataUrl.set(null);
    } else {
      if (this.featuredPhoto2Preview()) URL.revokeObjectURL(this.featuredPhoto2Preview()!);
      this.featuredPhoto2File.set(null);
      this.featuredPhoto2Preview.set(null);
      this.featuredPhoto2DataUrl.set(null);
    }
    this.saveDraft();
  }

  onGalleryPhotosSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    this.addGalleryFiles(Array.from(input.files));
    input.value = '';
  }

  onGalleryPhotosDrop(event: DragEvent): void {
    event.preventDefault();
    if (!event.dataTransfer?.files || event.dataTransfer.files.length === 0) return;
    this.addGalleryFiles(Array.from(event.dataTransfer.files));
  }

  private addGalleryFiles(files: File[]): void {
    this.galleryPhotoError.set(null);
    const validImages = files.filter((f) => f.type.startsWith('image/'));
    if (validImages.length === 0) {
      this.galleryPhotoError.set('Solo se admiten archivos de imagen (JPG, PNG, WEBP).');
      return;
    }

    const currentCount = this.galleryPhotos().length;
    const availableSlots = 9 - currentCount;
    if (availableSlots <= 0) {
      this.galleryPhotoError.set('Ya alcanzaste el límite máximo de 9 fotos de galería común.');
      return;
    }

    const toProcess = validImages.slice(0, availableSlots);
    if (validImages.length > availableSlots) {
      this.galleryPhotoError.set(`Se agregaron ${availableSlots} fotos (límite de 9 alcanzado).`);
    }

    for (const file of toProcess) {
      if (file.size > 5 * 1024 * 1024) continue;
      const objectUrl = URL.createObjectURL(file);
      const id = `gal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newEntry = {
        id,
        file,
        previewUrl: objectUrl,
        name: file.name,
      };

      this.galleryPhotos.update((list) => [...list, newEntry]);

      if (typeof FileReader !== 'undefined') {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            this.galleryPhotos.update((list) =>
              list.map((item) => (item.id === id ? { ...item, dataUrl: reader.result as string } : item)),
            );
            this.saveDraft();
          }
        };
        reader.readAsDataURL(file);
      }
    }
    this.saveDraft();
  }

  removeGalleryPhoto(id: string): void {
    const found = this.galleryPhotos().find((p) => p.id === id);
    if (found?.previewUrl) {
      URL.revokeObjectURL(found.previewUrl);
    }
    this.galleryPhotos.update((list) => list.filter((p) => p.id !== id));
    this.galleryPhotoError.set(null);
    this.saveDraft();
  }

  onPriceArsChange(val: number): void {
    if (this.isUsdAutoCalc()) {
      const rate = this.usdExchangeRate() || 1400;
      this.reqForm.priceUsd = Math.round((Number(val) || 0) / rate);
    }
    this.formValidationError.set(null);
    this.saveDraft();
  }

  onExchangeRateChange(newRate: number): void {
    const rate = Number(newRate) || 1400;
    this.usdExchangeRate.set(rate);
    if (this.isUsdAutoCalc()) {
      this.reqForm.priceUsd = Math.round((Number(this.reqForm.priceArs) || 0) / rate);
    }
    this.saveDraft();
  }

  onManualUsdInput(): void {
    this.isUsdAutoCalc.set(false);
    this.saveDraft();
  }

  toggleUsdAutoCalc(): void {
    const next = !this.isUsdAutoCalc();
    this.isUsdAutoCalc.set(next);
    if (next) {
      const rate = this.usdExchangeRate() || 1400;
      this.reqForm.priceUsd = Math.round((Number(this.reqForm.priceArs) || 0) / rate);
    }
    this.saveDraft();
  }

  syncDatesForm(): void {
    const list = [...this.scheduledDates()];
    if (this.isDateFlexible()) {
      if (!list.includes('A coordinar')) {
        list.unshift('A coordinar');
      }
    }
    this.reqForm.dates = list.length > 0 ? list.join(', ') : (this.isDateFlexible() ? 'A coordinar' : '');
    this.formValidationError.set(null);
    this.saveDraft();
  }

  addScheduledDate(): void {
    const val = this.newScheduledDate();
    if (!val) return;
    if (val < this.todayIso) {
      this.scheduledDateError.set('La fecha debe ser futura.');
      return;
    }
    if (this.scheduledDates().includes(val)) {
      this.scheduledDateError.set('Esta fecha ya está cargada.');
      return;
    }
    this.scheduledDates.update((dates) => [...dates, val].sort());
    this.newScheduledDate.set('');
    this.scheduledDateError.set(null);
    this.formValidationError.set(null);
    this.syncDatesForm();
  }

  removeScheduledDate(dateToRemove: string): void {
    this.scheduledDates.update((dates) => dates.filter((d) => d !== dateToRemove));
    this.syncDatesForm();
  }

  toggleFlexibleDates(checked: boolean): void {
    this.isDateFlexible.set(checked);
    this.syncDatesForm();
  }

  loadDraft(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(ProviderExperienceProposalModalComponent.DRAFT_STORAGE_KEY);
      if (!raw) {
        this.hasDraft.set(false);
        return;
      }
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') {
        this.hasDraft.set(false);
        return;
      }
      if (data.reqForm && typeof data.reqForm === 'object') {
        this.reqForm = {
          ...DEFAULT_REQ_FORM,
          ...data.reqForm,
        };
      }
      this.syncBankingWithProvider();
      if (data.usdExchangeRate) {
        this.usdExchangeRate.set(Number(data.usdExchangeRate) || 1400);
      }
      if (data.isUsdAutoCalc !== undefined) {
        this.isUsdAutoCalc.set(Boolean(data.isUsdAutoCalc));
      }
      if (this.reqForm.dates) {
        const parts = this.reqForm.dates.split(',').map((p: string) => p.trim());
        const hasCoord = parts.some((p: string) => p.toLowerCase().includes('coordinar'));
        this.isDateFlexible.set(hasCoord);
        const isoDates = parts.filter((p: string) => /^\d{4}-\d{2}-\d{2}$/.test(p));
        this.scheduledDates.set(isoDates);
      }
      if (data.coverImageDataUrl && typeof data.coverImageDataUrl === 'string') {
        this.coverImageDataUrl.set(data.coverImageDataUrl);
        this.coverImagePreview.set(data.coverImageDataUrl);
        this.finalSuccessCoverUrl.set(data.coverImageDataUrl);
      }
      this.hasDraft.set(true);
    } catch (err) {
      console.warn('[ProposalModal] Error al cargar borrador:', err);
      this.hasDraft.set(false);
    }
  }

  saveDraft(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const hasMeaningfulContent = Boolean(
        this.reqForm.title?.trim() ||
        this.reqForm.subheading?.trim() ||
        this.reqForm.region?.trim() ||
        this.reqForm.altitude?.trim() ||
        this.reqForm.itinerary?.trim() ||
        this.reqForm.meetingPoint?.trim() ||
        this.reqForm.promosAndPricing?.trim() ||
        this.reqForm.includedServices?.trim() ||
        this.reqForm.participantRequirements?.trim() ||
        this.reqForm.notes?.trim() ||
        this.reqForm.cbuAlias?.trim() ||
        this.reqForm.bankName?.trim() ||
        this.reqForm.accountHolder?.trim() ||
        this.reqForm.cuitDni?.trim() ||
        this.scheduledDates().length > 0 ||
        this.coverImageDataUrl()
      );

      if (!hasMeaningfulContent) {
        return;
      }

      // No guardamos base64 pesados en localStorage para evitar QuotaExceededError.
      // Se guarda solo el estado del formulario y configuraciones; las imágenes quedan en memoria.
      const payload = {
        reqForm: this.reqForm,
        usdExchangeRate: this.usdExchangeRate(),
        isUsdAutoCalc: this.isUsdAutoCalc(),
        updatedAt: Date.now(),
      };

      try {
        localStorage.setItem(
          ProviderExperienceProposalModalComponent.DRAFT_STORAGE_KEY,
          JSON.stringify(payload),
        );
        this.hasDraft.set(true);
      } catch (err) {
        console.warn('[ProposalModal] Error guardando borrador en localStorage:', err);
      }
    } catch (err) {
      console.warn('[ProposalModal] Error al preparar guardado de borrador:', err);
    }
  }

  clearDraft(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(ProviderExperienceProposalModalComponent.DRAFT_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    this.hasDraft.set(false);
  }

  discardDraft(): void {
    this.clearDraft();
    this.reqForm = { ...DEFAULT_REQ_FORM };
    this.syncBankingWithProvider();
    this.scheduledDates.set([]);
    this.isDateFlexible.set(true);
    this.isUsdAutoCalc.set(true);
    this.usdExchangeRate.set(1400);
    this.formValidationError.set(null);
    this.meetingPointError.set(null);
    this.removeCoverImage();
    this.removeCoverVideo();
    this.removeFeaturedPhoto(1);
    this.removeFeaturedPhoto(2);
    for (const item of this.galleryPhotos()) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    }
    this.galleryPhotos.set([]);
    this.galleryPhotoError.set(null);
  }

  onClose(): void {
    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
    }
    if (this.successTimer) {
      clearTimeout(this.successTimer);
      this.successTimer = null;
    }
    // Only reset in-memory form if the request was successfully sent.
    // If user closed the modal without sending, the draft is kept in memory & localStorage.
    if (this.requestSuccess()) {
      this.reqForm = { ...DEFAULT_REQ_FORM };
      this.scheduledDates.set([]);
      this.isDateFlexible.set(true);
      this.isUsdAutoCalc.set(true);
      this.usdExchangeRate.set(1400);
      this.formValidationError.set(null);
      this.meetingPointError.set(null);
      this.removeCoverImage();
      this.removeCoverVideo();
      this.removeFeaturedPhoto(1);
      this.removeFeaturedPhoto(2);
      for (const item of this.galleryPhotos()) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
      this.galleryPhotos.set([]);
      this.galleryPhotoError.set(null);
    }
    this.requestSuccess.set(false);
    this.submittingRequest.set(false);
    this.closeModal.emit();
    this.router.navigate([this.backLink()]);
  }

  async submitRequestForm(form?: NgForm): Promise<void> {
    this.formValidationError.set(null);

    if (form) {
      form.control.markAllAsTouched();
    }

    const title = this.reqForm.title?.trim();
    const region = this.reqForm.region?.trim();
    const subheading = this.reqForm.subheading?.trim();
    const itinerary = this.reqForm.itinerary?.trim();
    const meetingPoint = this.reqForm.meetingPoint?.trim();
    const isMapsValid = this.isValidGoogleMapsUrl(meetingPoint);
    const priceArs = Number(this.reqForm.priceArs);
    const hasCoverImage = Boolean(this.coverImageFile() || this.coverImagePreview());
    const hasValidDates = this.isDateFlexible() || this.scheduledDates().length > 0;

    const isInvalid = Boolean(
      (form && form.invalid) ||
      !title ||
      !region ||
      !subheading ||
      !itinerary ||
      !meetingPoint ||
      !isMapsValid ||
      !Number.isFinite(priceArs) ||
      priceArs < 1 ||
      !hasCoverImage ||
      !hasValidDates
    );

    if (isInvalid) {
      if (!hasCoverImage) {
        this.coverImageError.set('La foto de portada es obligatoria para enviar la propuesta.');
      }
      if (!meetingPoint) {
        this.meetingPointError.set('Ingresá el enlace de Google Maps para el punto de encuentro.');
      } else if (!isMapsValid) {
        this.meetingPointError.set(
          'Ingresá un enlace válido de Google Maps (maps.app.goo.gl o google.com/maps).',
        );
      }

      const missing: string[] = [];
      if (!title) missing.push('Título');
      if (!region) missing.push('Región');
      if (!subheading) missing.push('Bajada');
      if (!itinerary) missing.push('Itinerario');
      if (!meetingPoint || !isMapsValid) missing.push('Punto de encuentro (link válido de Google Maps)');
      if (!Number.isFinite(priceArs) || priceArs < 1) missing.push('Arancel');
      if (!hasCoverImage) missing.push('Foto de Portada');
      if (!hasValidDates) missing.push('Fechas de Salida');

      this.formValidationError.set(
        missing.length > 0
          ? `Campos obligatorios incompletos: ${missing.join(', ')}. Por favor revisá los campos destacados arriba.`
          : 'Por favor completá todos los campos requeridos antes de enviar.'
      );

      if (typeof document !== 'undefined') {
        setTimeout(() => {
          const firstInvalid = document.querySelector(
            '.exp-modal-form input.ng-invalid, .exp-modal-form select.ng-invalid, .exp-modal-form textarea.ng-invalid, .media-dropzone.has-error'
          );
          if (firstInvalid) {
            firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (firstInvalid instanceof HTMLElement) {
              firstInvalid.focus();
            }
          } else if (!hasCoverImage) {
            document.querySelector('.media-dropzone')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 50);
      }
      return;
    }

    this.submittingRequest.set(true);

    // Obtener los datos reales del prestador autenticado
    const prov = this.store.currentProvider();
    let providerEmail = (prov?.email || '').trim().toLowerCase();
    let providerName = (prov?.name || '').trim();
    let providerAgency = (prov?.agency || '').trim();
    let providerPhone = (prov?.phone || '').trim();
    let providerId = (prov?.id || '').trim();

    if (!providerEmail && isSupabaseConfigured()) {
      try {
        const { data: userData } = await this.supabase.auth.getUser();
        const u = userData?.user;
        if (u?.email) {
          providerEmail = u.email.trim().toLowerCase();
          const meta = u.user_metadata || {};
          providerName = providerName || meta['full_name'] || meta['name'] || providerEmail;
          providerId = providerId || `provider-${providerEmail.replace(/[^a-z0-9]+/g, '-')}`;
        }
      } catch {
        // ignore
      }
    }

    if (!providerEmail) {
      providerEmail = 'prestador@experiencias.club';
      providerName = providerName || 'Prestador del Club';
      providerId = providerId || 'provider-anon';
    }

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

    const priceUsd =
      Number(this.reqForm.priceUsd) ||
      Math.round(priceArs / (this.usdExchangeRate() || 1400));

    const cbuAlias = this.reqForm.cbuAlias?.trim() || '';
    const bankName = this.reqForm.bankName?.trim() || '';
    const accountHolder = this.reqForm.accountHolder?.trim() || '';
    const cuitDni = this.reqForm.cuitDni?.trim() || '';

    // Sincronizar datos bancarios con el perfil del prestador
    const currentProv = this.store.currentProvider();
    const profileUpdates: Partial<ProviderUser> = {};

    if (cbuAlias && cbuAlias !== (currentProv?.cbuAlias || '')) {
      profileUpdates.cbuAlias = cbuAlias;
    }
    if (bankName && bankName !== (currentProv?.bankName || '')) {
      profileUpdates.bankName = bankName;
    }
    if (accountHolder && accountHolder !== (currentProv?.name || '')) {
      profileUpdates.name = accountHolder;
    }
    if (cuitDni && cuitDni !== (currentProv?.cuitDni || '')) {
      profileUpdates.cuitDni = cuitDni;
    }

    if (Object.keys(profileUpdates).length > 0) {
      try {
        const profileOk = await this.store.updateProfile(profileUpdates);
        if (!profileOk) {
          console.warn('[ProposalModal] No se pudieron sincronizar los datos de cobro en el perfil del prestador.');
        }
      } catch (err) {
        console.warn('[ProposalModal] Error actualizando perfil de prestador desde propuesta:', err);
      }
    }

    // Subir foto destacada 1 si existe
    let feat1Url: string | undefined = undefined;
    const feat1File = this.featuredPhoto1File();
    if (feat1File) {
      try {
        const res = await this.storageService.uploadFile(feat1File, 'PROPOSAL');
        if (res?.url) feat1Url = res.url;
      } catch (err) {
        console.warn('[ProposalModal] Error subiendo destacada 1:', err);
      }
    } else if (
      this.featuredPhoto1Preview()?.startsWith('http') &&
      !this.featuredPhoto1Preview()?.startsWith('blob:')
    ) {
      feat1Url = this.featuredPhoto1Preview() || undefined;
    }

    // Subir foto destacada 2 si existe
    let feat2Url: string | undefined = undefined;
    const feat2File = this.featuredPhoto2File();
    if (feat2File) {
      try {
        const res = await this.storageService.uploadFile(feat2File, 'PROPOSAL');
        if (res?.url) feat2Url = res.url;
      } catch (err) {
        console.warn('[ProposalModal] Error subiendo destacada 2:', err);
      }
    } else if (
      this.featuredPhoto2Preview()?.startsWith('http') &&
      !this.featuredPhoto2Preview()?.startsWith('blob:')
    ) {
      feat2Url = this.featuredPhoto2Preview() || undefined;
    }

    // Subir fotos de galería común si existen
    const galleryItems: { url: string; name: string }[] = [];
    for (const item of this.galleryPhotos()) {
      let finalUrl: string | undefined = undefined;
      if (item.file) {
        try {
          const res = await this.storageService.uploadFile(item.file, 'PROPOSAL');
          if (res?.url) finalUrl = res.url;
        } catch (err) {
          console.warn('[ProposalModal] Error subiendo foto de galería:', err);
        }
      } else if (item.previewUrl?.startsWith('http') && !item.previewUrl?.startsWith('blob:')) {
        finalUrl = item.previewUrl;
      }
      if (finalUrl) {
        galleryItems.push({ url: finalUrl, name: item.name });
      }
    }

    // Armar álbum completo: 1 portada, 2 destacadas, hasta 9 de galería común
    const albumPhotos: ExperienceAlbumPhoto[] = [];

    if (coverImageUrl) {
      albumPhotos.push({
        id: `photo_${Date.now()}_cover`,
        url: coverImageUrl,
        title: title,
        caption: 'Foto de portada principal',
        isCover: true,
        isFeatured: false,
        order: 1,
      });
    }

    if (feat1Url) {
      albumPhotos.push({
        id: `photo_${Date.now()}_feat1`,
        url: feat1Url,
        title: `${title} - Destacada 1`,
        isCover: false,
        isFeatured: true,
        order: 2,
      });
    }

    if (feat2Url) {
      albumPhotos.push({
        id: `photo_${Date.now()}_feat2`,
        url: feat2Url,
        title: `${title} - Destacada 2`,
        isCover: false,
        isFeatured: true,
        order: 3,
      });
    }

    galleryItems.forEach((g, idx) => {
      albumPhotos.push({
        id: `photo_${Date.now()}_gal_${idx + 1}`,
        url: g.url,
        title: g.name || `${title} - Galería ${idx + 1}`,
        isCover: false,
        isFeatured: false,
        order: 4 + idx,
      });
    });

    try {
      await this.store.submitExperienceRequest({
        providerId,
        providerName: accountHolder || providerName,
        providerAgency: providerAgency || 'Prestador Oficial EXPERIENCIAS.CLUB',
        providerEmail,
        providerPhone: providerPhone || undefined,
        providerCbuAlias: cbuAlias || currentProv?.cbuAlias,
        providerBankName: bankName || currentProv?.bankName,
        providerCuitDni: cuitDni || currentProv?.cuitDni,
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
        albumPhotos,
        galleryImages: albumPhotos.map((p) => p.url),
      });

      // Disparar notificación por correo (Admin y Prestador)
      void this.notificationService.notifyExperienceProposalSubmitted({
        title,
        providerName,
        providerAgency,
        providerEmail,
        providerPhone,
        region,
        difficulty: this.reqForm.difficulty,
        duration: this.reqForm.duration,
        priceArs,
        meetingPoint: this.reqForm.meetingPoint,
        itinerary: this.reqForm.itinerary,
      }).catch((notifyErr) => {
        console.warn('[ProposalModal] Error enviando notificación de propuesta:', notifyErr);
      });

      this.clearDraft();

      this.successTimer = setTimeout(() => {
        this.submittingRequest.set(false);
        this.requestSuccess.set(true);
        this.submitted.emit();
      }, 700);
    } catch (err: any) {
      this.submittingRequest.set(false);
      this.formValidationError.set(
        err?.message || 'Ocurrió un error al enviar la propuesta. Por favor verificá tu conexión e intentá nuevamente.',
      );
      if (typeof document !== 'undefined') {
        setTimeout(() => {
          document.querySelector('.form-validation-alert')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
      }
    }
  }
}
