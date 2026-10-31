import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { TransferSubmission } from '../../../core/models/bank-transfer.model';
import { ArsPipe, FechaPipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-provider-dashboard',
  standalone: true,
  imports: [FormsModule, MatIconModule, ArsPipe, FechaPipe],
  template: `
    <div class="dash-container">
      <!-- Welcome & Agency Header -->
      <section class="welcome-card">
        <div class="welcome-main">
          <div class="avatar-ring">
            <img
              [src]="provider()?.avatar || '/assets/aistudio/patricio.jpg'"
              [alt]="provider()?.name || 'Patricio Facundo'"
              class="provider-avatar"
              referrerpolicy="no-referrer"
            />
          </div>
          <div class="welcome-text">
            <div class="welcome-tag">
              <span>PRESTADOR OFICIAL</span>
            </div>
            <h1 class="welcome-name">Hola, {{ provider()?.name || 'Patricio Facundo' }}</h1>
            <p class="welcome-agency">
              {{ provider()?.agency }}
            </p>
          </div>
        </div>

      </section>

      <!-- KPI Metrics Grid - Boxes rectangulares sobrias sin iconos -->
      <section class="metrics-grid">
        <!-- 1. Experiencias Activas -->
        <div class="metric-card">
          <div class="metric-content">
            <span class="metric-label">Experiencias Activas</span>
            <strong class="metric-value">{{ activeExperiences().length }}</strong>
            <span class="metric-hint">Publicadas en el catálogo oficial</span>
          </div>
        </div>

        <!-- 2. Socios Anotados Totales -->
        <div class="metric-card">
          <div class="metric-content">
            <span class="metric-label">Socios Anotados Totales</span>
            <strong class="metric-value">{{ stats().totalEnrolled }}</strong>
            <span class="metric-hint">Inscriptos en el histórico de experiencias</span>
          </div>
        </div>

        <!-- 3. Recaudación Total -->
        <div class="metric-card">
          <div class="metric-content">
            <span class="metric-label">Recaudación Total</span>
            <strong class="metric-value">{{
              stats().confirmedRevenue + stats().pendingRevenue | ars
            }}</strong>
            <span class="metric-hint">Confirmados + pendientes</span>
          </div>
        </div>

        <!-- 4. Próxima Salida -->
        <div class="metric-card">
          <div class="metric-content">
            <span class="metric-label">Próxima Salida</span>
            <strong class="metric-value">
              @if (nearestSlot(); as slot) {
                {{ slot.date | fecha }}
              } @else {
                —
              }
            </strong>
            <span class="metric-hint">
              @if (nearestSlot(); as slot) {
                {{ slot.experienceTitle }}
              } @else {
                Sin salidas programadas
              }
            </span>
          </div>
        </div>
      </section>

      <!-- Experiencias Activas - Box de ancho completo que ocupa las dos columnas -->
      <section class="dash-card full-width-card active-experiences-section">
        <div class="card-head">
          <div>
            <span class="card-kicker">CATÁLOGO ACTIVO</span>
            <h2 class="card-title">Experiencias Activas</h2>
          </div>
        </div>

        @if (activeExperiences().length === 0) {
          <div class="empty-active-box">
            <p class="empty-text">No tenés experiencias activas publicadas actualmente.</p>
          </div>
        } @else {
          <div class="active-experiences-list">
            @for (exp of activeExperiences(); track exp.id) {
              <div class="active-exp-row">
                <div class="active-exp-cover-wrap">
                  <img
                    [src]="exp.coverImage || '/assets/images/kayak-club-de-experiencias.jpg'"
                    [alt]="exp.title"
                    class="active-exp-cover"
                    referrerpolicy="no-referrer"
                  />
                  <span class="exp-live-pill">Activa</span>
                </div>

                <div class="active-exp-main">
                  <div class="active-exp-top-row">
                    <span class="exp-cat-tag">{{ exp.region }}</span>
                    <span class="exp-sep">·</span>
                    <span class="exp-duration-tag"
                      >{{ exp.difficulty }} · {{ exp.durationLabel }}</span
                    >
                  </div>

                  <h3 class="active-exp-name">{{ exp.title }}</h3>
                  <p class="active-exp-desc">{{ exp.tagline }}</p>

                  <div class="active-exp-kpis">
                    <div class="kpi-mini-col">
                      <span class="kpi-mini-lbl">Precio por Socio</span>
                      <strong class="kpi-mini-val text-blue">{{ exp.priceArs | ars }}</strong>
                    </div>

                    <div class="kpi-mini-col">
                      <span class="kpi-mini-lbl">Capacidad por Salida</span>
                      <strong class="kpi-mini-val">{{ exp.capacityPerDate }} cupos</strong>
                    </div>

                    <div class="kpi-mini-col">
                      <span class="kpi-mini-lbl">Próximas Salidas</span>
                      <div class="exp-mini-dates">
                        @for (d of exp.dates; track d) {
                          <span class="mini-date-badge">
                            {{ d | fecha }}
                            <span class="date-occupancy"
                              >({{ store.reservedSeats(exp.id, d) }}/{{
                                exp.capacityPerDate
                              }})</span
                            >
                          </span>
                        }
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            }
          </div>
        }

        <!-- Box: Solicitar a los administradores que carguen una nueva experiencia -->
        <div class="request-new-exp-card" (click)="openRequestModal()">
          <div class="request-new-exp-content">
            <div class="request-new-exp-info">
              <span class="request-new-exp-kicker">NUEVA EXPERIENCIA</span>
              <h3 class="request-new-exp-title">
                Solicitá a los administradores que carguen una nueva experiencia
              </h3>
              <p class="request-new-exp-desc">
                ¿Tenés una nueva propuesta, salida o travesía para sumar al catálogo? Completá el formulario con los detalles técnicos, fechas y tarifas para que el equipo de administración la revise y publique.
              </p>
            </div>
          </div>

          <div class="request-new-exp-action">
            <button
              type="button"
              class="request-form-btn"
              (click)="openRequestModal(); $event.stopPropagation()"
            >
              <span>Completar formulario</span>
            </button>
          </div>
        </div>
      </section>

      <!-- Finanzas y Conciliación de Pagos - Expanded Full Width Section -->
      <section class="dash-card full-width-card finanzas-section">
        <div class="card-head">
          <div>
            <span class="card-kicker">FINANZAS Y RECAUDACIÓN</span>
            <h2 class="card-title">Últimos Pagos de Socios del Club</h2>
          </div>
        </div>

        <!-- Bank Details Info Strip -->
        <div class="fin-bank-banner">
          <div class="fin-bank-item">
            <span class="fin-bank-lbl">CBU</span>
            <strong class="fin-bank-val code-font">{{
              provider()?.cbuAlias || '3840200500000056402423'
            }}</strong>
          </div>
          <div class="fin-bank-item">
            <span class="fin-bank-lbl">Nombre</span>
            <strong class="fin-bank-val">{{
              provider()?.name || 'Patricio Facundo Diaz Tillar'
            }}</strong>
          </div>
          <div class="fin-bank-item">
            <span class="fin-bank-lbl">CUIT/CUIL</span>
            <strong class="fin-bank-val code-font">{{
              provider()?.cuitDni || '20-38628297-9'
            }}</strong>
          </div>
          <div class="fin-bank-item">
            <span class="fin-bank-lbl">Entidad</span>
            <strong class="fin-bank-val">{{
              provider()?.bankName || 'Uala Bank S.A.U'
            }}</strong>
          </div>
        </div>

        @if (recentSubmissions().length === 0) {
          <p class="empty-text">Aún no hay comprobantes de pago registrados.</p>
        } @else {
          <div class="fin-table-wrap">
            <table class="fin-data-table">
              <thead>
                <tr>
                  <th class="col-th-socio">Socio</th>
                  <th class="col-th-exp">Experiencia</th>
                  <th class="col-th-date">Fecha</th>
                  <th class="col-th-seats">Cupos</th>
                  <th class="col-th-amount">Importe</th>
                  <th class="col-th-action">Acción</th>
                </tr>
              </thead>
              <tbody>
                @for (sub of recentSubmissions(); track sub.id) {
                  <tr [class.row-pending]="sub.status === 'pendiente'">
                    <td>
                      <div class="cell-stack">
                        <strong class="socio-name">{{ sub.fullName }}</strong>
                        <span class="cell-sub">DNI: {{ sub.dni }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="exp-title-text" [title]="sub.experienceTitle">{{
                        sub.experienceTitle
                      }}</span>
                    </td>
                    <td>
                      <span class="cell-date">{{ sub.date | fecha }}</span>
                    </td>
                    <td class="text-center">
                      <span class="seats-badge">{{ sub.participants }}</span>
                    </td>
                    <td class="text-right">
                      <strong class="amount-val">{{ sub.amountArs | ars }}</strong>
                    </td>
                    <td class="text-right">
                      <a
                        type="button"
                        (click)="openReceipt(sub)"
                        class="fin-review-btn"
                        title="Revisar comprobante de pago"
                      >
                        Revisar
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
      @if (selectedSubmission(); as sub) {
        <div class="dashboard-modal-backdrop" (click)="closeReceipt()">
          <div class="dashboard-receipt-modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
            <div class="dashboard-receipt-preview">
              <img [src]="sub.receipt.url" [alt]="'Comprobante de ' + sub.fullName" />
            </div>
            <div class="dashboard-receipt-details">
              <div class="dashboard-modal-head">
                <div>
                  <span class="card-kicker">COMPROBANTE</span>
                  <h2 class="card-title">{{ sub.fullName }}</h2>
                </div>
                <button type="button" class="dashboard-modal-close" (click)="closeReceipt()">×</button>
              </div>
              <p><strong>Importe:</strong> {{ sub.amountArs | ars }}</p>
              <p><strong>Experiencia:</strong> {{ sub.experienceTitle }}</p>
              <p><strong>Fecha:</strong> {{ sub.date | fecha: 'larga' }}</p>
              <p><strong>Email:</strong> {{ sub.email }}</p>
              <p><strong>Celular:</strong> {{ sub.phone }}</p>
              <p><strong>DNI:</strong> {{ sub.dni }}</p>
              @if (sub.status !== 'pendiente') {
                <p class="dashboard-receipt-status">Pago {{ sub.status }}.</p>
              }
              <a
                class="dashboard-receipt-download"
                [href]="sub.receipt.url"
                [download]="sub.receipt.fileName"
                target="_blank"
                rel="noopener"
              >
                DESCARGAR COMPROBANTE
              </a>
            </div>
          </div>
        </div>
      }

      <!-- Modal: Formulario para Solicitar Alta de Nueva Experiencia (Campos que matchean /experiencias/kayak) -->
      @if (requestModalOpen()) {
        <div class="exp-request-modal-backdrop" (click)="closeRequestModal()">
          <div
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
                  Completá la ficha técnica y logística de tu propuesta para que los administradores la revisen y carguen al catálogo.
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
                      {{ getFormProgress() }}% {{ getFormProgress() === 100 ? '¡Completo!' : 'completado' }}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                class="modal-close-icon-btn"
                (click)="closeRequestModal()"
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
                    Los administradores recibieron los datos, archivos multimedia y especificaciones técnicas de
                    <strong>"{{ reqForm.title || 'tu propuesta' }}"</strong>.
                    Revisarán el itinerario, logística y tarifas para darla de alta en el catálogo oficial de Experiencias.
                  </p>
                  @if (coverImagePreview()) {
                    <div class="request-success-media-preview">
                      <img [src]="coverImagePreview()" alt="Portada cargada" class="success-thumb-img" />
                      <div class="success-thumb-info">
                        <span class="success-thumb-title">Foto de portada adjuntada</span>
                        <span class="success-thumb-name">{{ coverImageFile()?.name }}</span>
                        @if (coverVideoFile()) {
                          <span class="success-thumb-video">+ Video de portada: {{ coverVideoFile()?.name }}</span>
                        }
                      </div>
                    </div>
                  }
                  <button
                    type="button"
                    class="modal-btn-submit"
                    (click)="closeRequestModal()"
                  >
                    Entendido, volver al panel
                  </button>
                </div>
              } @else {
                <form class="exp-modal-form" (ngSubmit)="submitRequestForm()">
                  <!-- 1. Cabecera y Resumen de la Experiencia -->
                  <div class="form-section">
                    <div class="form-section-header">
                      <span class="form-section-num">1</span>
                      <h4 class="form-section-title">Cabecera y Resumen</h4>
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="req-title">Título Principal de la Experiencia *</label>
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

                    <div class="form-row">
                      <div class="form-group">
                        <label class="form-label" for="req-kicker">Categoría *</label>
                        <input
                          id="req-kicker"
                          type="text"
                          class="form-input"
                          placeholder="Ej: EXPEDICIÓN NÁUTICA..."
                          [(ngModel)]="reqForm.kicker"
                          name="kicker"
                          required
                        />
                      </div>

                      <div class="form-group">
                        <label class="form-label" for="req-region">Región Turística de Catamarca *</label>
                        <select
                          id="req-region"
                          class="form-input form-select"
                          [(ngModel)]="reqForm.region"
                          name="region"
                        >
                          <option value="Valle Central y Ambato">Valle Central y Ambato</option>
                          <option value="Puna de Atacama">Puna de Atacama</option>
                          <option value="Fiambalá y Seismiles">Fiambalá y Seismiles</option>
                          <option value="Antofagasta de la Sierra">Antofagasta de la Sierra</option>
                          <option value="Belén y Ruta del Telar">Belén y Ruta del Telar</option>
                          <option value="Andalgalá y Cuesta de Zapata">Andalgalá y Cuesta de Zapata</option>
                        </select>
                      </div>
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="req-subheading">Bajada o Síntesis Atractiva *</label>
                      <textarea
                        id="req-subheading"
                        rows="3"
                        class="form-input form-textarea"
                        placeholder="Ej: Remada guiada en kayak en aguas calmas al atardecer..."
                        [(ngModel)]="reqForm.subheading"
                        name="subheading"
                        required
                      ></textarea>
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
                              <img [src]="coverImagePreview()" alt="Foto de portada" class="media-img-preview" />
                            </div>
                            <div class="media-preview-meta">
                              <span class="media-file-name" [title]="coverImageFile()?.name">{{ coverImageFile()?.name }}</span>
                              <span class="media-file-size">{{ formatFileSize(coverImageFile()?.size) }}</span>
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
                              <svg class="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21 15 16 10 5 21"/>
                              </svg>
                              <span class="dropzone-main-text">Subir foto de portada *</span>
                              <span class="dropzone-sub-text">Hacé click o arrastrá tu imagen (JPG, PNG, WEBP)</span>
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
                              <video [src]="coverVideoPreview()" class="media-video-preview" controls muted playsinline></video>
                            </div>
                            <div class="media-preview-meta">
                              <span class="media-file-name" [title]="coverVideoFile()?.name">{{ coverVideoFile()?.name }}</span>
                              <span class="media-file-size">{{ formatFileSize(coverVideoFile()?.size) }}</span>
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
                              <svg class="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                                <polygon points="23 7 16 12 23 17 23 7"/>
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                              </svg>
                              <span class="dropzone-main-text">Subir video de portada</span>
                              <span class="dropzone-sub-text">Hacé click o arrastrá un video (MP4, MOV, WEBM)</span>
                            </div>
                          </label>
                        }
                        @if (coverVideoError()) {
                          <span class="field-error-text">{{ coverVideoError() }}</span>
                        }
                      </div>
                    </div>
                  </div>

                  <!-- 3. Especificaciones Técnicas (Specs de Kayak) -->
                  <div class="form-section">
                    <div class="form-section-header">
                      <span class="form-section-num">3</span>
                      <h4 class="form-section-title">Especificaciones Técnicas (Specs Rápidas)</h4>
                    </div>

                    <div class="form-grid-3">
                      <div class="form-group">
                        <label class="form-label" for="req-difficulty">Dificultad *</label>
                        <select
                          id="req-difficulty"
                          class="form-input form-select"
                          [(ngModel)]="reqForm.difficulty"
                          name="difficulty"
                        >
                          <option value="Baja (Sin experiencia previa)">Baja (Sin experiencia previa)</option>
                          <option value="Moderada">Moderada</option>
                          <option value="Exigente">Exigente</option>
                          <option value="Alta Montaña">Alta Montaña</option>
                        </select>
                      </div>

                      <div class="form-group">
                        <label class="form-label" for="req-duration">Duración *</label>
                        <input
                          id="req-duration"
                          type="text"
                          class="form-input"
                          placeholder="Ej: 4 Horas (Media Jornada)"
                          [(ngModel)]="reqForm.duration"
                          name="duration"
                          required
                        />
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

                      <div class="form-group">
                        <label class="form-label" for="req-capacity">Cupo Máximo por Salida *</label>
                        <input
                          id="req-capacity"
                          type="number"
                          class="form-input"
                          placeholder="Ej: 12"
                          [(ngModel)]="reqForm.capacity"
                          name="capacity"
                          min="1"
                          max="100"
                          required
                        />
                      </div>

                      <div class="form-group">
                        <label class="form-label" for="req-season">Temporada *</label>
                        <input
                          id="req-season"
                          type="text"
                          class="form-input"
                          placeholder="Ej: Todo el año"
                          [(ngModel)]="reqForm.season"
                          name="season"
                        />
                      </div>

                      <div class="form-group">
                        <label class="form-label" for="req-dates">Fechas / Frecuencia Operativa *</label>
                        <input
                          id="req-dates"
                          type="text"
                          class="form-input"
                          placeholder="Ej: Sábados y Domingos 15:30 hs..."
                          [(ngModel)]="reqForm.dates"
                          name="dates"
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

                    <div class="form-row">
                      <div class="form-group">
                        <label class="form-label" for="req-price-ars">Arancel en Pesos ($ ARS) *</label>
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
                      </div>

                      <div class="form-group">
                        <label class="form-label" for="req-price-usd">Referencia en Dólares (USD opcional)</label>
                        <input
                          id="req-price-usd"
                          type="number"
                          class="form-input"
                          placeholder="Ej: 70"
                          [(ngModel)]="reqForm.priceUsd"
                          name="priceUsd"
                        />
                      </div>
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="req-promos">Promociones, Descuentos u Otros Precios a Considerar</label>
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
                  </div>

                  <!-- 6. Equipamiento, Seguridad & Logística -->
                  <div class="form-section">
                    <div class="form-section-header">
                      <span class="form-section-num">6</span>
                      <h4 class="form-section-title">Equipamiento, Seguridad & Punto de Encuentro</h4>
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="req-meeting">Punto de Encuentro & Ubicación *</label>
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
                        <label class="form-label" for="req-included">Servicios e Indumentaria Provista *</label>
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
                        <label class="form-label" for="req-requirements">Qué Debe Traer el Participante *</label>
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
                      <label class="form-label" for="req-notes">Notas o Enlace a Fotos / Videos en Drive (Opcional)</label>
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
                    <button
                      type="button"
                      class="modal-btn-cancel"
                      (click)="closeRequestModal()"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      class="modal-btn-submit"
                      [disabled]="submittingRequest()"
                    >
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
    </div>
  `,
  styles: [
    `
      .dash-container {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }
      .welcome-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(22, 33, 85, 0.55);
        border: 1px solid rgba(128, 179, 255, 0.35);
        border-radius: 2px;
        padding: 1.75rem 2rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        gap: 1.5rem;
        flex-wrap: wrap;
      }
      .welcome-main {
        display: flex;
        align-items: center;
        gap: 1.5rem;
      }
      .avatar-ring {
        position: relative;
        flex-shrink: 0;
      }
      .provider-avatar {
        width: 96px;
        height: 96px;
        border-radius: 4px;
        border: 2px solid #80b3ff;
        box-shadow: 0 4px 16px rgba(0, 56, 143, 0.35);
        object-fit: cover;
        display: block;
      }
      .welcome-text {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .welcome-tag {
        display: inline-flex;
        align-items: center;
        font-size: 0.72rem;
        font-weight: 700;
        color: #80b3ff;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .welcome-name {
        font-size: 1.6rem;
        font-weight: 700;
        color: #ffffff;
        margin: 0;
        letter-spacing: -0.02em;
      }
      .welcome-agency {
        font-size: 0.88rem;
        color: rgba(255, 255, 255, 0.75);
        margin: 0;
      }
      .welcome-agency code {
        background: rgba(128, 179, 255, 0.12);
        border: 1px solid rgba(128, 179, 255, 0.25);
        padding: 0.15rem 0.45rem;
        border-radius: 2px;
        color: #80b3ff;
        font-size: 0.8rem;
      }
      .welcome-actions {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        flex-wrap: wrap;
      }
      .cta-blue-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.65rem 1.25rem;
        background: #80b3ff;
        color: #081124;
        font-weight: 700;
        font-size: 0.85rem;
        border-radius: 2px;
        transition: all 0.2s ease;
        text-decoration: none;
        letter-spacing: 0.02em;
      }
      .cta-blue-btn:hover {
        background: #a6c8ff;
      }
      .cta-secondary-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.65rem 1.15rem;
        background: rgba(22, 33, 85, 0.6);
        border: 1px solid rgba(128, 179, 255, 0.35);
        color: #ffffff;
        font-weight: 600;
        font-size: 0.85rem;
        border-radius: 2px;
        transition: all 0.2s ease;
        text-decoration: none;
      }
      .cta-secondary-btn:hover {
        border-color: #80b3ff;
        color: #80b3ff;
      }
      .btn-badge {
        background: #80b3ff;
        color: #081124;
        font-size: 0.7rem;
        font-weight: 800;
        padding: 0.1rem 0.4rem;
        border-radius: 2px;
        line-height: 1;
      }
      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
        gap: 1rem;
      }
      .metric-card {
        display: flex;
        flex-direction: column;
        justify-content: center;
        background: rgba(22, 33, 85, 0.55);
        border: 1px solid rgba(128, 179, 255, 0.25);
        border-radius: 2px;
        padding: 1.35rem 1.25rem;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
        backdrop-filter: blur(14px);
      }
      .metric-card.blue-highlight-border {
        border-color: rgba(128, 179, 255, 0.5);
        background: rgba(128, 179, 255, 0.08);
      }
      .metric-content {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .metric-label {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.65);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .metric-value {
        font-size: 1.55rem;
        font-weight: 700;
        color: #ffffff;
        line-height: 1.2;
      }
      .text-blue {
        color: #ffffff !important;
      }
      .metric-hint {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.5);
      }
      .moderation-alert-card {
        background: rgba(128, 179, 255, 0.06);
        border: 1px solid rgba(128, 179, 255, 0.35);
        border-radius: 2px;
        padding: 1.25rem 1.5rem;
      }
      .alert-body h3 {
        font-size: 0.95rem;
        font-weight: 700;
        color: #80b3ff;
        margin-bottom: 0.25rem;
      }
      .alert-body p {
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.75);
        margin-bottom: 0.75rem;
      }
      .moderation-items {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .mod-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(7, 13, 28, 0.6);
        border: 1px solid rgba(128, 179, 255, 0.2);
        border-radius: 2px;
        padding: 0.6rem 0.85rem;
        gap: 1rem;
      }
      .mod-item-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
      .mod-item-info strong {
        font-size: 0.88rem;
        color: #ffffff;
      }
      .mod-pill {
        font-size: 0.72rem;
        padding: 0.15rem 0.5rem;
        border-radius: 2px;
        background: rgba(128, 179, 255, 0.15);
        border: 1px solid rgba(128, 179, 255, 0.3);
        color: #80b3ff;
        font-weight: 600;
      }
      .sim-admin-btn {
        display: inline-flex;
        align-items: center;
        background: rgba(128, 179, 255, 0.15);
        border: 1px solid rgba(128, 179, 255, 0.45);
        color: #80b3ff;
        padding: 0.35rem 0.75rem;
        border-radius: 2px;
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .sim-admin-btn:hover {
        background: #80b3ff;
        color: #070d18;
      }
      .dash-card {
        background: rgba(22, 33, 85, 0.55);
        border: 1px solid rgba(128, 179, 255, 0.25);
        border-radius: 2px;
        padding: 1.5rem;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.25);
        backdrop-filter: blur(14px);
      }
      .card-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1.25rem;
      }
      .card-kicker {
        font-size: 0.7rem;
        font-weight: 700;
        color: #80b3ff;
        letter-spacing: 0.08em;
      }
      .card-title {
        font-size: 1.15rem;
        font-weight: 700;
        color: #ffffff;
        margin: 0.15rem 0 0 0;
      }
      .card-link {
        font-size: 0.8rem;
        color: #80b3ff;
        font-weight: 600;
        text-decoration: none;
      }
      .card-link:hover {
        text-decoration: underline;
      }
      .empty-text {
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.5);
        text-align: center;
        padding: 2rem 0;
      }

      /* Finanzas Section - Full Width */
      .finanzas-section {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .finanzas-section .card-head {
        margin-bottom: 0;
      }
      .badge-pending {
        background: rgba(128, 179, 255, 0.25) !important;
        border-color: #80b3ff !important;
        color: #ffffff !important;
      }

      /* Bank Details Info Strip */
      .fin-bank-banner {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1rem;
        padding: 1rem 1.25rem;
        background: rgba(7, 13, 28, 0.6);
        border: 1px solid rgba(128, 179, 255, 0.25);
        border-radius: 2px;
      }
      .fin-bank-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .fin-bank-lbl {
        font-size: 0.68rem;
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: rgba(255, 255, 255, 0.55);
      }
      .fin-bank-val {
        font-size: 0.88rem;
        color: #ffffff;
        word-break: break-all;
      }
      .code-font {
        font-family: monospace;
        color: #ffffff;
        letter-spacing: 0.04em;
      }

      /* Table Container & Semantic Table */
      .fin-table-wrap {
        width: 100%;
        overflow-x: auto;
        border: 1px solid rgba(128, 179, 255, 0.25);
        border-radius: 2px;
        background: rgba(7, 13, 28, 0.6);
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.25);
      }
      .fin-data-table {
        width: 100%;
        min-width: 860px;
        border-collapse: collapse;
        text-align: left;
      }
      .fin-data-table th {
        padding: 0.85rem 1rem;
        background: rgba(22, 33, 85, 0.85);
        border-bottom: 1px solid rgba(128, 179, 255, 0.3);
        font-size: 0.72rem;
        font-weight: 700;
        color: #80b3ff;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        white-space: nowrap;
      }
      .fin-data-table td {
        padding: 0.95rem 1rem;
        border-bottom: 1px solid rgba(128, 179, 255, 0.12);
        vertical-align: middle;
        font-size: 0.86rem;
        color: #ffffff;
      }
      .fin-data-table tbody tr:last-child td {
        border-bottom: none;
      }
      .fin-data-table tbody tr:hover {
        background: rgba(128, 179, 255, 0.05);
      }
      .fin-data-table tbody tr.row-pending {
        background: rgba(128, 179, 255, 0.09);
      }
      .fin-status-pill {
        display: inline-block;
        font-size: 0.65rem;
        font-weight: 800;
        letter-spacing: 0.05em;
        padding: 0.25rem 0.5rem;
        border-radius: 2px;
        text-align: center;
        white-space: nowrap;
      }
      .status-pendiente {
        background: rgba(128, 179, 255, 0.2);
        border: 1px solid #80b3ff;
        color: #80b3ff;
      }
      .status-aprobado {
        background: rgba(128, 179, 255, 0.1);
        border: 1px solid rgba(128, 179, 255, 0.35);
        color: #ffffff;
      }
      .status-rechazado {
        background: rgba(255, 95, 95, 0.15);
        border: 1px solid #ff5f5f;
        color: #ff8080;
      }
      .cell-stack {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }
      .socio-name {
        font-size: 0.88rem;
        color: #ffffff;
      }
      .cell-sub {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.55);
      }
      .exp-title-text {
        font-size: 0.85rem;
        color: #ffffff;
        max-width: 260px;
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cell-date {
        font-size: 0.82rem;
        color: #ffffff;
        white-space: nowrap;
      }
      .ref-code {
        font-family: monospace;
        font-size: 0.8rem;
        color: #80b3ff;
      }
      .seats-badge {
        display: inline-block;
        padding: 0.2rem 0.55rem;
        border-radius: 2px;
        background: rgba(128, 179, 255, 0.12);
        border: 1px solid rgba(128, 179, 255, 0.25);
        color: #ffffff;
        font-size: 0.8rem;
        font-weight: 700;
      }
      .amount-val {
        font-size: 0.95rem;
        font-weight: 700;
        color: #80b3ff;
        white-space: nowrap;
      }
      .text-center {
        text-align: center;
      }
      .text-right {
        text-align: right;
      }
      .fin-review-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.45rem 0.85rem;
        font-size: 0.75rem;
        font-weight: 700;
        border-radius: 2px;
        text-decoration: none;
        transition: all 0.2s ease;
        background: rgba(128, 179, 255, 0.15);
        border: 1px solid rgba(128, 179, 255, 0.35);
        color: #80b3ff;
        text-align: center;
        white-space: nowrap;
        cursor: pointer;
      }
      .fin-review-btn:hover {
        background: #80b3ff;
        color: #070d18;
      }
      .fin-review-btn.btn-pending {
        background: #80b3ff;
        color: #070d18;
        border-color: #80b3ff;
      }
      .fin-review-btn.btn-pending:hover {
        background: #a3c7ff;
      }

      /* Experiencias Activas - Full Width Box */
      .full-width-card {
        width: 100%;
        box-sizing: border-box;
      }
      .active-experiences-section {
        display: flex;
        flex-direction: column;
      }
      .card-head-actions {
        display: flex;
        align-items: center;
        gap: 0.85rem;
      }
      .active-count-badge {
        background: rgba(128, 179, 255, 0.15);
        border: 1px solid rgba(128, 179, 255, 0.35);
        color: #80b3ff;
        font-size: 0.72rem;
        font-weight: 700;
        padding: 0.2rem 0.55rem;
        border-radius: 2px;
        letter-spacing: 0.04em;
      }
      .empty-active-box {
        text-align: center;
        padding: 2rem 1rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
      }
      .active-experiences-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .active-exp-row {
        display: grid;
        grid-template-columns: 240px 1fr auto;
        gap: 0;
        background: rgba(7, 13, 28, 0.5);
        border: 1px solid rgba(128, 179, 255, 0.2);
        border-radius: 2px;
        padding: 0;
        align-items: stretch;
        overflow: hidden;
      }
      .active-exp-cover-wrap {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 165px;
        border-radius: 0;
        overflow: hidden;
        border-right: 1px solid rgba(128, 179, 255, 0.2);
        flex-shrink: 0;
      }
      .active-exp-cover {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .exp-live-pill {
        position: absolute;
        top: 8px;
        left: 8px;
        background: #80b3ff;
        color: #070d18;
        font-size: 0.65rem;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        padding: 0.2rem 0.55rem;
        border-radius: 2px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
      }
      .active-exp-main {
        padding: 1.25rem 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        min-width: 0;
      }
      .active-exp-top-row {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        font-size: 0.74rem;
        color: rgba(255, 255, 255, 0.6);
        flex-wrap: wrap;
      }
      .exp-cat-tag {
        color: #80b3ff;
        font-weight: 700;
        text-transform: uppercase;
        font-size: 0.7rem;
        letter-spacing: 0.05em;
      }
      .exp-sep {
        color: rgba(128, 179, 255, 0.4);
      }
      .exp-duration-tag {
        color: rgba(255, 255, 255, 0.75);
      }
      .active-exp-name {
        font-size: 1.05rem;
        font-weight: 700;
        color: #ffffff;
        margin: 0;
        line-height: 1.3;
      }
      .active-exp-desc {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.7);
        margin: 0;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .active-exp-kpis {
        display: flex;
        gap: 1.25rem;
        flex-wrap: wrap;
        margin-top: 0.35rem;
        padding-top: 0.45rem;
        border-top: 1px solid rgba(128, 179, 255, 0.12);
      }
      .kpi-mini-col {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }
      .kpi-mini-lbl {
        font-size: 0.68rem;
        color: rgba(255, 255, 255, 0.5);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .kpi-mini-val {
        font-size: 0.88rem;
        font-weight: 700;
        color: #ffffff;
      }
      .exp-mini-dates {
        display: flex;
        gap: 0.35rem;
        flex-wrap: wrap;
      }
      .mini-date-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.72rem;
        background: rgba(128, 179, 255, 0.1);
        border: 1px solid rgba(128, 179, 255, 0.25);
        color: #ffffff;
        padding: 0.15rem 0.45rem;
        border-radius: 2px;
      }
      .date-occupancy {
        color: #ffffff;
        font-weight: 700;
      }
      .active-exp-btns {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0.5rem;
        min-width: 130px;
        padding: 1.25rem 1.5rem 1.25rem 0;
      }
      .active-action-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.55rem 0.95rem;
        font-size: 0.78rem;
        font-weight: 700;
        border-radius: 2px;
        text-decoration: none;
        transition: all 0.2s ease;
        text-align: center;
        white-space: nowrap;
      }
      .edit-action {
        background: rgba(128, 179, 255, 0.15);
        border: 1px solid rgba(128, 179, 255, 0.35);
        color: #80b3ff;
      }
      .edit-action:hover {
        background: #80b3ff;
        color: #070d18;
      }
      .socios-action {
        background: rgba(22, 33, 85, 0.55);
        border: 1px solid rgba(128, 179, 255, 0.25);
        color: #ffffff;
      }
      .socios-action:hover {
        background: rgba(128, 179, 255, 0.25);
        border-color: #80b3ff;
      }

      /* Box: Solicitar nueva experiencia a administradores */
      .request-new-exp-card {
        margin-top: 1.25rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.5rem;
        padding: 1.25rem 1.5rem;
        background: rgba(14, 22, 54, 0.75);
        border: 1px dashed rgba(128, 179, 255, 0.45);
        border-radius: 2px;
        transition: border-color 0.2s ease, background 0.2s ease;
        cursor: pointer;
      }
      .request-new-exp-card:hover {
        border-color: #80b3ff;
        background: rgba(18, 28, 68, 0.85);
      }
      .request-new-exp-content {
        display: flex;
        align-items: center;
        gap: 1.25rem;
        min-width: 0;
      }
      .request-new-exp-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        min-width: 0;
      }
      .request-new-exp-kicker {
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #80b3ff;
      }
      .request-new-exp-title {
        margin: 0;
        font-size: 1.02rem;
        font-weight: 700;
        color: #ffffff;
        line-height: 1.3;
      }
      .request-new-exp-desc {
        margin: 0;
        font-size: 0.84rem;
        color: rgba(255, 255, 255, 0.75);
        line-height: 1.45;
      }
      .request-new-exp-action {
        flex-shrink: 0;
      }
      .request-form-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.75rem 1.4rem;
        background: #80b3ff;
        border: 1px solid #80b3ff;
        color: #070d18;
        font-size: 0.88rem;
        font-weight: 700;
        border-radius: 2px;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
        letter-spacing: 0.02em;
        box-shadow: 0 4px 15px rgba(128, 179, 255, 0.25);
      }
      .request-form-btn:hover {
        background: #a6c8ff;
        border-color: #a6c8ff;
        box-shadow: 0 6px 20px rgba(128, 179, 255, 0.4);
        transform: translateY(-1px);
      }

      /* Modal: Formulario para Solicitar Alta de Nueva Experiencia */
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
        background: linear-gradient(90deg, #2563eb 0%, #60a5fa 70%, #38bdf8 100%);
        box-shadow: 0 0 8px rgba(96, 165, 250, 0.7);
        border-radius: 999px;
        transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .header-progress-bar-fill.is-100 {
        background: linear-gradient(90deg, #059669 0%, #10b981 70%, #34d399 100%);
        box-shadow: 0 0 8px rgba(16, 185, 129, 0.7);
      }
      .header-progress-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.76rem;
      }
      .progress-hint {
        color: rgba(255, 255, 255, 0.6);
        font-size: 0.75rem;
      }
      .progress-badge {
        font-weight: 700;
        letter-spacing: 0.03em;
        color: #80b3ff;
      }
      .progress-badge.is-complete {
        color: #34d399;
      }
      .exp-request-kicker {
        font-size: 0.68rem;
        font-weight: 800;
        color: #80b3ff;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .exp-request-title {
        font-size: 1.25rem;
        font-weight: 700;
        color: #ffffff;
        margin: 0.2rem 0;
      }
      .exp-request-sub {
        font-size: 0.84rem;
        color: rgba(255, 255, 255, 0.7);
        margin: 0;
      }
      .modal-close-icon-btn {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.6);
        font-size: 1.8rem;
        line-height: 1;
        cursor: pointer;
        padding: 0.2rem 0.5rem;
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
        gap: 1.25rem;
      }
      .form-section {
        background: rgba(14, 22, 54, 0.42);
        border: 1px solid rgba(128, 179, 255, 0.2);
        border-radius: 2px;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .form-section-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid rgba(128, 179, 255, 0.15);
      }
      .form-section-num {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: rgba(128, 179, 255, 0.2);
        border: 1px solid #80b3ff;
        color: #80b3ff;
        font-weight: 800;
        font-size: 0.8rem;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .form-section-title {
        margin: 0;
        font-size: 0.96rem;
        font-weight: 700;
        color: #ffffff;
      }
      .form-section-sub {
        margin: 0;
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.6);
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
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
      .form-label {
        font-size: 0.75rem;
        font-weight: 700;
        color: #80b3ff;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .form-input {
        width: 100%;
        box-sizing: border-box;
        background: rgba(7, 13, 28, 0.75);
        border: 1px solid rgba(128, 179, 255, 0.3);
        border-radius: 2px;
        padding: 0.65rem 0.85rem;
        color: #ffffff;
        font-size: 0.88rem;
        outline: none;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }
      .form-input:focus {
        border-color: #80b3ff;
        box-shadow: 0 0 0 2px rgba(128, 179, 255, 0.2);
      }
      .form-select {
        cursor: pointer;
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
        background: rgba(24, 42, 85, 0.72);
        border: 1px solid rgba(128, 179, 255, 0.42);
        color: #f0f4ff;
        transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
      }
      .form-select::-ms-expand {
        display: none;
      }
      .form-select:hover {
        background: rgba(32, 54, 108, 0.82);
        border-color: rgba(128, 179, 255, 0.65);
      }
      .form-select:focus {
        background: rgba(28, 48, 98, 0.9);
        border-color: #80b3ff;
        box-shadow: 0 0 0 2px rgba(128, 179, 255, 0.25);
      }
      .form-select option {
        background: #0d1b38;
        color: #ffffff;
      }
      .form-textarea {
        resize: vertical;
        min-height: 80px;
        font-family: inherit;
        line-height: 1.45;
      }
      .media-upload-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.25rem;
      }
      .media-upload-group {
        display: flex;
        flex-direction: column;
      }
      .badge-required {
        display: inline-block;
        padding: 0.15rem 0.5rem;
        background: rgba(128, 179, 255, 0.14);
        border: 1px solid rgba(128, 179, 255, 0.4);
        color: #80b3ff;
        border-radius: 2px;
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        margin-left: 0.35rem;
        vertical-align: middle;
      }
      .badge-optional {
        display: inline-block;
        padding: 0.15rem 0.45rem;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.18);
        color: rgba(255, 255, 255, 0.6);
        border-radius: 2px;
        font-size: 0.7rem;
        font-weight: 600;
        margin-left: 0.35rem;
        vertical-align: middle;
      }
      .media-dropzone {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 145px;
        padding: 1.25rem 1rem;
        border: 1.5px dashed rgba(128, 179, 255, 0.4);
        border-radius: 4px;
        background: rgba(10, 20, 44, 0.55);
        cursor: pointer;
        text-align: center;
        transition: all 0.2s ease;
      }
      .media-dropzone:hover {
        border-color: #80b3ff;
        background: rgba(18, 32, 70, 0.7);
        box-shadow: 0 0 12px rgba(128, 179, 255, 0.15);
      }
      .media-dropzone.dropzone-error {
        border-color: #ff5f00;
        background: rgba(255, 95, 0, 0.06);
      }
      .dropzone-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.45rem;
        pointer-events: none;
      }
      .dropzone-icon {
        width: 32px;
        height: 32px;
        stroke: #80b3ff;
        opacity: 0.9;
        margin-bottom: 0.15rem;
      }
      .dropzone-main-text {
        font-size: 0.88rem;
        font-weight: 600;
        color: #ffffff;
        letter-spacing: 0.01em;
      }
      .dropzone-sub-text {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.6);
        max-width: 260px;
        line-height: 1.35;
      }
      .media-preview-card {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        padding: 0.85rem;
        background: rgba(10, 20, 44, 0.75);
        border: 1px solid rgba(128, 179, 255, 0.35);
        border-radius: 4px;
      }
      .media-preview-visual {
        width: 100%;
        height: 150px;
        border-radius: 3px;
        overflow: hidden;
        background: #040814;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      .media-img-preview {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .media-video-preview {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .media-preview-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.85);
        gap: 0.75rem;
      }
      .media-file-name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-weight: 500;
      }
      .media-file-size {
        color: #80b3ff;
        font-weight: 600;
        white-space: nowrap;
        font-size: 0.75rem;
      }
      .media-action-btn {
        align-self: flex-start;
        background: rgba(255, 95, 0, 0.12);
        border: 1px solid rgba(255, 95, 0, 0.35);
        color: #ff5f00;
        font-size: 0.76rem;
        font-weight: 600;
        padding: 0.35rem 0.75rem;
        border-radius: 2px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .media-action-btn:hover {
        background: rgba(255, 95, 0, 0.25);
        border-color: #ff5f00;
        color: #ffffff;
      }
      .field-error-text {
        display: block;
        font-size: 0.76rem;
        color: #ff5f00;
        margin-top: 0.4rem;
        font-weight: 500;
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
      .modal-form-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        margin-top: 1.25rem;
        padding-top: 1.25rem;
        border-top: 1px solid rgba(128, 179, 255, 0.2);
      }
      .modal-btn-cancel {
        padding: 0.7rem 1.4rem;
        background: rgba(22, 33, 85, 0.6);
        border: 1px solid rgba(128, 179, 255, 0.35);
        color: #ffffff;
        font-weight: 600;
        font-size: 0.86rem;
        border-radius: 2px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .modal-btn-cancel:hover {
        border-color: #80b3ff;
        color: #80b3ff;
      }
      .modal-btn-submit {
        padding: 0.7rem 1.6rem;
        background: #80b3ff;
        border: 1px solid #80b3ff;
        color: #070d18;
        font-weight: 700;
        font-size: 0.88rem;
        border-radius: 2px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 15px rgba(128, 179, 255, 0.3);
      }
      .modal-btn-submit:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }
      .modal-btn-submit:not(:disabled):hover {
        background: #a6c8ff;
        border-color: #a6c8ff;
        box-shadow: 0 6px 20px rgba(128, 179, 255, 0.45);
        transform: translateY(-1px);
      }
      .request-success-view {
        padding: 3rem 1.5rem;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1.15rem;
      }
      .request-success-badge {
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        color: #070d18;
        background: #80b3ff;
        padding: 0.3rem 0.8rem;
        border-radius: 2px;
      }
      .request-success-title {
        font-size: 1.4rem;
        font-weight: 700;
        color: #ffffff;
        margin: 0;
      }
      .request-success-desc {
        font-size: 0.92rem;
        color: rgba(255, 255, 255, 0.8);
        max-width: 520px;
        line-height: 1.5;
        margin: 0;
      }
      .request-success-media-preview {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin: 0.5rem 0;
        padding: 0.85rem 1.25rem;
        background: rgba(14, 24, 52, 0.55);
        border: 1px solid rgba(128, 179, 255, 0.3);
        border-radius: 4px;
        text-align: left;
      }
      .success-thumb-img {
        width: 60px;
        height: 60px;
        object-fit: cover;
        border-radius: 3px;
        border: 1px solid rgba(128, 179, 255, 0.4);
      }
      .success-thumb-info {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }
      .success-thumb-title {
        color: #80b3ff;
        font-weight: 600;
        font-size: 0.74rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .success-thumb-name {
        color: #ffffff;
        font-weight: 500;
        font-size: 0.84rem;
      }
      .success-thumb-video {
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.76rem;
      }
      .dashboard-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 3000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: rgba(4, 8, 19, 0.82);
        backdrop-filter: blur(5px);
      }
      .dashboard-receipt-modal {
        display: grid;
        grid-template-columns: minmax(240px, 0.9fr) minmax(320px, 1.1fr);
        width: min(900px, 100%);
        max-height: min(680px, 92vh);
        overflow: auto;
        background: #101a35;
        border: 1px solid rgba(128, 179, 255, 0.4);
        border-radius: 2px;
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
      }
      .dashboard-receipt-preview {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 320px;
        height: 100%;
        padding: 0;
        background: #070d18;
      }
      .dashboard-receipt-preview img {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 320px;
        object-fit: cover;
      }
      .dashboard-receipt-download {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        align-self: flex-end;
        margin-top: auto;
        padding: 0.6rem 0.9rem;
        background: #ffffff;
        color: #070d18;
        font-size: 0.8rem;
        font-weight: 700;
        text-transform: uppercase;
        text-decoration: none;
        border-radius: 2px;
      }
      .dashboard-receipt-download:hover {
        background: rgba(255, 255, 255, 0.85);
      }
      .dashboard-receipt-details {
        display: flex;
        flex-direction: column;
        padding: 1.5rem;
        color: #ffffff;
      }
      .dashboard-modal-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1.25rem;
      }
      .dashboard-modal-close {
        color: #ffffff;
        font-size: 1.75rem;
        line-height: 1;
        cursor: pointer;
      }
      .dashboard-receipt-details p {
        margin: 0 0 0.7rem;
        color: rgba(255, 255, 255, 0.75);
      }
      .dashboard-receipt-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.7rem;
        margin-top: 1.5rem;
      }
      .dashboard-receipt-status {
        margin-top: 1.5rem !important;
        color: #80b3ff !important;
        font-weight: 700;
      }
      @media (max-width: 768px) {
        .welcome-main {
          gap: 1rem;
        }
        .provider-avatar {
          width: 76px;
          height: 76px;
        }
        .dashboard-receipt-modal {
          grid-template-columns: 1fr;
        }
        .active-exp-row {
          grid-template-columns: 1fr;
        }
        .active-exp-cover-wrap {
          width: 100%;
          height: 190px;
          min-height: 190px;
          border-right: none;
          border-bottom: 1px solid rgba(128, 179, 255, 0.2);
        }
        .active-exp-main {
          padding: 1.25rem;
        }
        .active-exp-btns {
          padding: 0 1.25rem 1.25rem 1.25rem;
          flex-direction: row;
          width: 100%;
          box-sizing: border-box;
        }
        .active-action-btn {
          flex: 1;
        }
        .request-new-exp-card {
          flex-direction: column;
          align-items: stretch;
          gap: 1.15rem;
          padding: 1.25rem 1rem;
        }
        .request-new-exp-content {
          align-items: flex-start;
          gap: 1rem;
        }
        .request-new-exp-action {
          width: 100%;
        }
        .request-form-btn {
          width: 100%;
          box-sizing: border-box;
        }
        .exp-request-modal {
          max-height: 94vh;
        }
        .exp-request-header {
          padding: 1rem 1.25rem;
        }
        .exp-request-body {
          padding: 1rem 1.25rem;
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
export class ProviderDashboardComponent {
  readonly store = inject(ProviderStoreService);
  readonly selectedSubmission = signal<TransferSubmission | null>(null);

  readonly provider = this.store.currentProvider;
  readonly stats = this.store.providerStats;

  readonly requestModalOpen = signal(false);
  readonly requestSuccess = signal(false);
  readonly submittingRequest = signal(false);

  readonly coverImageFile = signal<File | null>(null);
  readonly coverImagePreview = signal<string | null>(null);
  readonly coverImageError = signal<string | null>(null);

  readonly coverVideoFile = signal<File | null>(null);
  readonly coverVideoPreview = signal<string | null>(null);
  readonly coverVideoError = signal<string | null>(null);

  readonly reqForm = {
    title: '',
    kicker: 'EXPEDICIÓN NÁUTICA: VALLE CENTRAL',
    subheading: '',
    region: 'Valle Central y Ambato',
    difficulty: 'Baja (Sin experiencia previa)',
    duration: '4 Horas (Media Jornada)',
    altitude: '850 msnm',
    capacity: 12,
    season: 'Todo el año',
    dates: 'Sábados y Domingos 15:30 hs',
    priceArs: 65000,
    priceUsd: 70,
    promosAndPricing: '',
    itinerary: '',
    meetingPoint: '',
    includedServices: '',
    participantRequirements: '',
    notes: '',
  };

  formatFileSize(bytes?: number): string {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  getFormProgress(): number {
    let score = 0;
    const total = 10;
    if (this.reqForm.title?.trim()) score++;
    if (this.reqForm.subheading?.trim()) score++;
    if (this.coverImageFile()) score++;
    if (this.reqForm.difficulty?.trim() && this.reqForm.region?.trim()) score++;
    if (this.reqForm.duration?.trim() && this.reqForm.capacity > 0) score++;
    if (this.reqForm.dates?.trim()) score++;
    if (this.reqForm.priceArs && this.reqForm.priceArs > 0) score++;
    if (this.reqForm.itinerary?.trim()) score++;
    if (this.reqForm.meetingPoint?.trim()) score++;
    if (this.reqForm.includedServices?.trim() || this.reqForm.participantRequirements?.trim()) score++;

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
    if (file.size > 20 * 1024 * 1024) {
      this.coverImageError.set('La imagen supera el límite máximo de 20 MB.');
      return;
    }
    this.coverImageError.set(null);
    if (this.coverImagePreview()) {
      URL.revokeObjectURL(this.coverImagePreview()!);
    }
    this.coverImageFile.set(file);
    this.coverImagePreview.set(URL.createObjectURL(file));
  }

  removeCoverImage(): void {
    if (this.coverImagePreview()) {
      URL.revokeObjectURL(this.coverImagePreview()!);
    }
    this.coverImageFile.set(null);
    this.coverImagePreview.set(null);
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
    if (this.requestModalOpen()) {
      this.closeRequestModal();
    }
    if (this.selectedSubmission()) {
      this.closeReceipt();
    }
  }

  openRequestModal(): void {
    this.requestSuccess.set(false);
    this.submittingRequest.set(false);
    this.requestModalOpen.set(true);
  }

  closeRequestModal(): void {
    this.requestModalOpen.set(false);
    this.requestSuccess.set(false);
    this.submittingRequest.set(false);
    this.removeCoverImage();
    this.removeCoverVideo();
  }

  submitRequestForm(): void {
    if (!this.reqForm.title.trim()) return;
    if (!this.coverImageFile()) {
      this.coverImageError.set('La foto de portada es obligatoria para enviar la propuesta.');
      return;
    }
    this.submittingRequest.set(true);

    const prov = this.provider();
    this.store.submitExperienceRequest({
      providerId: prov?.id || 'prov-patricio',
      providerName: prov?.name || 'Patricio Facundo Diaz Tillar',
      providerAgency: prov?.agency || 'Catamarca Kayak & Aventura Náutica',
      providerEmail: prov?.email || 'patricio@experiencias.club',
      providerPhone: prov?.phone || '+54 383 455 8812',
      title: this.reqForm.title.trim(),
      kicker: this.reqForm.kicker.trim(),
      subheading: this.reqForm.subheading.trim(),
      region: this.reqForm.region,
      difficulty: this.reqForm.difficulty,
      duration: this.reqForm.duration,
      altitude: this.reqForm.altitude,
      capacity: Number(this.reqForm.capacity) || 12,
      season: this.reqForm.season,
      dates: this.reqForm.dates,
      priceArs: Number(this.reqForm.priceArs) || 65000,
      priceUsd: this.reqForm.priceUsd ? Number(this.reqForm.priceUsd) : null,
      promosAndPricing: this.reqForm.promosAndPricing,
      itinerary: this.reqForm.itinerary,
      meetingPoint: this.reqForm.meetingPoint,
      includedServices: this.reqForm.includedServices,
      participantRequirements: this.reqForm.participantRequirements,
      notes: this.reqForm.notes,
      coverImage: this.coverImagePreview() || '/assets/images/kayak-club-de-experiencias.jpg',
      coverImageName: this.coverImageFile()?.name,
      coverVideoName: this.coverVideoFile()?.name,
    });

    setTimeout(() => {
      this.submittingRequest.set(false);
      this.requestSuccess.set(true);
    }, 850);
  }

  readonly activeExperiences = computed(() =>
    this.store.providerExperiences().filter((e) => e.status === 'publicada'),
  );

  readonly recentSubmissions = computed(() => this.store.providerSubmissions().slice(0, 8));

  readonly upcomingSlots = computed(() => {
    const list: Array<{
      experienceId: string;
      experienceTitle: string;
      date: string;
      reserved: number;
      capacity: number;
    }> = [];

    for (const exp of this.store.providerExperiences()) {
      for (const date of exp.dates.slice(0, 3)) {
        list.push({
          experienceId: exp.id,
          experienceTitle: exp.shortTitle || exp.title,
          date,
          reserved: this.store.reservedSeats(exp.id, date),
          capacity: exp.capacityPerDate,
        });
      }
    }

    return list.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  });

  readonly nearestSlot = computed(() => {
    const list = this.upcomingSlots();
    return list.length > 0 ? list[0] : null;
  });

  readonly nearestExperienceEnrolled = computed(() => {
    const slot = this.nearestSlot();
    return slot ? slot.reserved : 0;
  });

  getExperienceEnrolled(experienceId: string): number {
    return this.store
      .providerSubmissions()
      .filter((s) => s.experienceId === experienceId && s.status !== 'rechazado')
      .reduce((sum, s) => sum + s.participants, 0);
  }

  openReceipt(submission: TransferSubmission): void {
    this.selectedSubmission.set(submission);
  }

  closeReceipt(): void {
    this.selectedSubmission.set(null);
  }
}
