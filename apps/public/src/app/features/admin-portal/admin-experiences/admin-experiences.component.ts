import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ExperienceService } from '../../../core/services/experience.service';
import { StorageService } from '../../../core/services/storage.service';
import { Experience, ExperienceAlbumPhoto } from '../../../core/models/experience.model';
import { ArsPipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-admin-experiences',
  standalone: true,
  imports: [RouterLink, FormsModule, MatIconModule, ArsPipe],
  template: `
    <div class="experiences-admin-container">
      <!-- Encabezado -->
      <div class="admin-page-header">
        <div class="header-titles">
          <span class="section-kicker">GESTIÓN DE CATÁLOGO & RUTAS WEB</span>
          <div class="title-row">
            <h1 class="card-heading">Experiencias de la Web</h1>
            <a routerLink="/dashboard" class="btn-back-panel">Volver al Panel</a>
            <button type="button" class="btn-create-exp-yellow" (click)="openCreateModal()">
              <span>Crear Nueva Experiencia</span>
            </button>
          </div>
          <p class="card-subheading">
            Administrá y editá toda la información de las rutas públicas de experiencias.club en
            tiempo real: textos, aranceles, cupos, multimedia, itinerarios y estado de publicación.
          </p>
        </div>
      </div>

      <!-- Toast Feedback -->
      @if (feedbackToast()) {
        <div class="toast-banner">
          <span>{{ feedbackToast() }}</span>
        </div>
      }

      <!-- Tabla / Lista de Experiencias -->
      <div class="experiences-table-card">
        <div class="card-table-head">
          <h3>Rutas de Experiencias Publicadas en el Sitio</h3>
          <span class="table-count">{{ experiences().length }} registradas</span>
        </div>

        <div class="table-responsive">
          <table class="admin-exp-table">
            <thead>
              <tr>
                <th>Experiencia</th>
                <th>Ruta Web Oficial</th>
                <th>Región & Dificultad</th>
                <th>Arancel</th>
                <th>Cupo</th>
                <th>Estado</th>
                <th class="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (exp of experiences(); track exp.id) {
                <tr [class.is-paused]="exp.status === 'oculta'">
                  <!-- Columna Experiencia / Portada -->
                  <td>
                    <div class="exp-cell-main">
                      <img
                        [src]="exp.coverImage || '/assets/images/kayak-club-de-experiencias.jpg'"
                        [alt]="exp.title"
                        class="exp-table-thumb"
                      />
                      <div class="exp-cell-text">
                        <strong class="exp-table-title">{{ exp.title }}</strong>
                        <span class="exp-table-sub">{{ exp.tagline }}</span>
                      </div>
                    </div>
                  </td>

                  <!-- Columna Ruta -->
                  <td>
                    <div class="route-badge-box">
                      <a
                        [href]="getPublicExperienceUrl(exp)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="route-badge-link"
                        title="Abrir ruta pública"
                      >
                        <code>/.../{{ exp.slug }}</code>
                        <mat-icon class="external-icon">open_in_new</mat-icon>
                      </a>
                    </div>
                  </td>

                  <!-- Columna Región & Dificultad -->
                  <td>
                    <div class="meta-cell">
                      <strong>{{ exp.region }}</strong>
                      <span>Dificultad: {{ exp.difficulty }}</span>
                      <span class="alt-label">{{ exp.altitudeMeters }} msnm</span>
                    </div>
                  </td>

                  <!-- Columna Arancel -->
                  <td>
                    <div class="price-cell">
                      <strong class="text-blue">{{ exp.priceArs | ars }}</strong>
                      <span class="usd-label">o &#36;{{ exp.priceUsd }} USD</span>
                    </div>
                  </td>

                  <!-- Columna Cupo -->
                  <td>
                    <span class="cupo-badge">{{ exp.maxSpotsPerGroup }} pers.</span>
                  </td>

                  <!-- Columna Estado -->
                  <td>
                    @if (exp.status === 'publicada') {
                      <span class="status-pill is-published">Publicada</span>
                    } @else if (exp.status === 'oculta') {
                      <span class="status-pill is-hidden">Pausada</span>
                    } @else {
                      <span class="status-pill is-draft">Borrador</span>
                    }
                  </td>

                  <!-- Columna Acciones -->
                  <td class="text-right">
                    <div class="action-buttons-cell">
                      <!-- Editar Información Completa -->
                      <button
                        type="button"
                        class="btn-edit-exp"
                        (click)="openEditModal(exp)"
                        title="Editar toda la información de esta experiencia"
                      >
                        <span>EDITAR</span>
                      </button>

                      <!-- Pausar o Activar -->
                      @if (exp.status === 'publicada') {
                        <button
                          type="button"
                          class="btn-pause-exp"
                          (click)="toggleStatus(exp, 'oculta')"
                          title="Pausar ruta y ocultarla de la web pública"
                        >
                          PAUSAR
                        </button>
                      } @else {
                        <button
                          type="button"
                          class="btn-activate-exp"
                          (click)="toggleStatus(exp, 'publicada')"
                          title="Volver a publicar ruta en la web pública"
                        >
                          ACTIVAR
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- MODAL: Editor Completo de Experiencia -->
      @if (editingExperience(); as exp) {
        <div class="modal-backdrop" (click)="closeEditModal()">
          <div class="modal-container-large" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div>
                <span class="modal-kicker">EDICIÓN DE RUTA PÚBLICA</span>
                <h2 class="modal-title">
                  {{ isCreating() ? 'Nueva Experiencia' : 'Editar: ' + editTitle() }}
                </h2>
                <p class="modal-sub">
                  Ruta oficial: <code>/experiencias/{{ editSlug() }}</code>
                </p>
              </div>
              <button type="button" class="modal-close-icon-btn" (click)="closeEditModal()">
                ×
              </button>
            </div>

            <div class="modal-body-scrollable">
              <!-- SECCIÓN 1: Identificación y Rutas -->
              <div class="form-section-card">
                <h4 class="form-section-title">1. Identificación & Ruta Pública</h4>
                <div class="form-field">
                  <label>Ruta / Slug (URL final):</label>
                  <div class="slug-input-wrap">
                    <span class="slug-prefix">/experiencias/</span>
                    <input
                      type="text"
                      class="form-input slug-field"
                      [(ngModel)]="editSlug"
                      [disabled]="editingExperience()?.slug === 'kayak'"
                      placeholder="ej: kayak, piedra-pomez, etc."
                    />
                  </div>
                  <span class="field-hint">Determina la URL pública de acceso a la ficha.</span>
                </div>

                <div class="form-field">
                  <label>Título principal de la Experiencia:</label>
                  <input
                    type="text"
                    class="form-input"
                    [(ngModel)]="editTitle"
                    placeholder="Ej: Travesía en Kayak & Sunset en el Dique El Jumeal"
                  />
                </div>

                <div class="form-field">
                  <label>Subtítulo / Bajada destacada (Tagline):</label>
                  <input
                    type="text"
                    class="form-input"
                    [(ngModel)]="editTagline"
                    placeholder="Remada guiada al atardecer con brindis de productos catamarqueños."
                  />
                </div>

                <div class="form-field">
                  <div class="field-label-row">
                    <label>Descripción atractiva de la Experiencia:</label>
                    <span class="char-counter">{{ editDescription().length }}/500</span>
                  </div>
                  <textarea
                    class="form-textarea"
                    rows="3"
                    [(ngModel)]="editDescription"
                    maxlength="500"
                    placeholder="Escribí una síntesis atractiva de hasta 2 párrafos concisos para los exploradores..."
                  ></textarea>
                  <span class="field-hint">Máximo 2 párrafos concisos y atractivos (hasta 500 caracteres).</span>
                </div>
              </div>

              <!-- SECCIÓN 2: Ficha Técnica & Parámetros -->
              <div class="form-section-card">
                <h4 class="form-section-title">2. Ficha Técnica & Parámetros de Operación</h4>
                <div class="form-grid-3">
                  <div class="form-field">
                    <label>Región de Catamarca:</label>
                    <input
                      type="text"
                      class="form-input"
                      [(ngModel)]="editRegion"
                      placeholder="Ej: Valle Central y Ambato"
                    />
                  </div>

                  <div class="form-field">
                    <label>Punto de Encuentro:</label>
                    <input
                      type="text"
                      class="form-input"
                      [(ngModel)]="editMeetingPoint"
                      placeholder="Ej: Club Náutico Dique El Jumeal"
                    />
                  </div>

                  <div class="form-field">
                    <label>Nivel de Dificultad:</label>
                    <select class="form-select" [(ngModel)]="editDifficulty">
                      <option value="Baja">Baja</option>
                      <option value="Moderada">Moderada</option>
                      <option value="Exigente">Exigente</option>
                      <option value="Alta Montaña">Alta Montaña</option>
                    </select>
                  </div>
                </div>

                <div class="form-grid-2">
                  <div class="form-field">
                    <label>Duración estimada:</label>
                    <input
                      type="text"
                      class="form-input"
                      [(ngModel)]="editDurationLabel"
                      placeholder="Ej: 4 Horas (Media Jornada)"
                    />
                  </div>

                  <div class="form-field">
                    <label>Altitud (msnm):</label>
                    <input
                      type="number"
                      class="form-input"
                      [(ngModel)]="editAltitude"
                      placeholder="850"
                    />
                  </div>
                </div>
              </div>

              <!-- SECCIÓN 3: Arancel Oficial & Fechas Programadas (Unificados) -->
              <div class="form-section-card">
                <h4 class="form-section-title">3. Arancel Oficial & Fechas Programadas</h4>
                <div class="form-grid-2">
                  <div class="form-field">
                    <label>Arancel en Pesos Argentinos (ARS):</label>
                    <input
                      type="number"
                      class="form-input"
                      [(ngModel)]="editPriceArs"
                      placeholder="65000"
                    />
                    <span class="field-hint">
                      Equivalente estimado: ~&#36;{{ calculatedUsd() }} USD (calculado a $1.600/USD).
                    </span>
                  </div>

                  <div class="form-field">
                    <label>Fechas programadas (YYYY-MM-DD):</label>
                    <input
                      type="text"
                      class="form-input"
                      [(ngModel)]="editDatesRaw"
                      placeholder="2026-11-10, 2026-11-17, 2026-11-24"
                    />
                    <span class="field-hint">Separadas por coma. Habilitadas para reservar cupos.</span>
                  </div>
                </div>
              </div>

              <!-- SECCIÓN: Prestador Asignado & Datos de Cobro (CBU / Liquidación) -->
              <div class="form-section-card">
                <h4 class="form-section-title">Prestador Asignado & Datos de Cobro (CBU)</h4>
                <div class="form-grid-2">
                  <div class="form-field">
                    <label>Nombre / Prestador Asignado:</label>
                    <input
                      type="text"
                      class="form-input"
                      [(ngModel)]="editProviderName"
                      placeholder="Ej: Gonzalo Gramaglia o Catamarca Kayak"
                    />
                  </div>

                  <div class="form-field">
                    <label>Teléfono / WhatsApp de Contacto:</label>
                    <input
                      type="tel"
                      class="form-input"
                      [(ngModel)]="editProviderPhone"
                      placeholder="Ej: +54 9 383 4567890"
                    />
                  </div>
                </div>

                <div class="form-grid-3">
                  <div class="form-field">
                    <label>CBU / CVU o Alias:</label>
                    <input
                      type="text"
                      class="form-input text-blue-input"
                      [(ngModel)]="editProviderCbuAlias"
                      placeholder="Ej: EXPERIENCIAS.CLUB.MP"
                    />
                  </div>

                  <div class="form-field">
                    <label>CUIT / CUIL:</label>
                    <input
                      type="text"
                      class="form-input"
                      [(ngModel)]="editProviderCuitDni"
                      placeholder="Ej: 20-33445566-7"
                    />
                  </div>

                  <div class="form-field">
                    <label>Banco / Entidad:</label>
                    <input
                      type="text"
                      class="form-input"
                      [(ngModel)]="editProviderBankName"
                      placeholder="Ej: Banco Nación / Mercado Pago"
                    />
                  </div>
                </div>
              </div>

              <!-- SECCIÓN 4: Multimedia, Video & Portada (con subida a Supabase Storage y Álbum) -->
              <div class="form-section-card">
                <h4 class="form-section-title">4. Multimedia, Video & Portada</h4>
                <div class="form-grid-2">
                  <div class="form-field">
                    <label>Imagen de Portada Principal:</label>
                    <div class="media-upload-row">
                      <input
                        type="text"
                        class="form-input"
                        [(ngModel)]="editCoverImage"
                        placeholder="https://... o seleccioná un archivo"
                      />
                      <label class="btn-upload-file" [class.is-uploading]="uploadingCover()">
                        <input
                          type="file"
                          accept="image/*"
                          (change)="onUploadCoverImage($event)"
                          style="display: none"
                        />
                        <span>{{ uploadingCover() ? 'Subiendo...' : 'Subir Portada' }}</span>
                      </label>
                    </div>
                    @if (editCoverImage()) {
                      <div class="media-preview-box">
                        <img [src]="editCoverImage()" alt="Preview Portada" class="media-preview-img" />
                      </div>
                    }
                  </div>

                  <div class="form-field">
                    <label>Video Oficial (.mp4):</label>
                    <div class="media-upload-row">
                      <input
                        type="text"
                        class="form-input"
                        [(ngModel)]="editVideoUrl"
                        placeholder="/assets/videos/kayak.mp4 o seleccioná un video"
                      />
                      <label class="btn-upload-file" [class.is-uploading]="uploadingVideo()">
                        <input
                          type="file"
                          accept="video/mp4,video/*"
                          (change)="onUploadVideo($event)"
                          style="display: none"
                        />
                        <span>{{ uploadingVideo() ? 'Subiendo...' : 'Subir Video' }}</span>
                      </label>
                    </div>
                    <span class="field-hint">Video promocional reproducido en la ficha de la experiencia.</span>
                  </div>
                </div>

                <!-- Álbum de Fotos Oficial de la Experiencia -->
                <div class="album-upload-section">
                  <div class="album-header-row">
                    <div>
                      <label class="album-section-label">Álbum de Fotos de la Experiencia</label>
                      <span class="field-hint">
                        {{ editAlbumPhotos().length }} foto(s) en la galería. Podés cargar nuevas imágenes directamente a Supabase Storage.
                      </span>
                    </div>

                    <label class="btn-upload-album-file" [class.is-uploading]="uploadingAlbum()">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        (change)="onUploadAlbumPhotos($event)"
                        style="display: none"
                      />
                      <span>{{ uploadingAlbum() ? 'Subiendo...' : '+ Subir Fotos al Álbum' }}</span>
                    </label>
                  </div>

                  @if (editAlbumPhotos().length > 0) {
                    <div class="album-photos-grid">
                      @for (photo of editAlbumPhotos(); track photo.id; let idx = $index) {
                        <div class="album-photo-item">
                          <img [src]="photo.url" [alt]="photo.caption || 'Foto de álbum'" class="album-thumb" />
                          <div class="album-item-meta">
                            <input
                              type="text"
                              class="album-caption-input"
                              [value]="photo.caption || ''"
                              (input)="updatePhotoCaption(idx, $any($event.target).value)"
                              placeholder="Epígrafe..."
                            />
                            <button
                              type="button"
                              class="album-delete-btn"
                              (click)="removeAlbumPhoto(idx)"
                              title="Eliminar foto del álbum"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      }
                    </div>
                  } @else {
                    <div class="album-empty-placeholder">
                      <span>No hay fotos cargadas en el álbum. Podés subir imágenes para la galería.</span>
                    </div>
                  }
                </div>
              </div>

              <!-- SECCIÓN 5: Servicios Incluidos & Qué Debes Traer (Orden invertido) -->
              <div class="form-section-card">
                <h4 class="form-section-title">5. Servicios Incluidos & Qué Debes Traer</h4>
                <div class="form-grid-2">
                  <div class="form-field">
                    <label>Servicios Incluidos (un ítem por línea):</label>
                    <textarea
                      class="form-textarea"
                      rows="4"
                      [(ngModel)]="editIncludedRaw"
                      placeholder="Kayaks de travesía y remos de carbono&#10;Chaleco salvavidas reglamentario PFD&#10;Guía náutico certificado&#10;Seguro de accidentes"
                    ></textarea>
                  </div>

                  <div class="form-field">
                    <label>Qué Debes Traer (un ítem por línea):</label>
                    <textarea
                      class="form-textarea"
                      rows="4"
                      [(ngModel)]="editHighlightsRaw"
                      placeholder="Muda de ropa cómoda&#10;Protector solar y gorra&#10;Botella de agua personal"
                    ></textarea>
                  </div>
                </div>
              </div>

              <!-- SECCIÓN 6: Estado de Publicación (Sin borrador) -->
              <div class="form-section-card">
                <h4 class="form-section-title">6. Estado de Publicación</h4>
                <div class="form-field">
                  <label>Estado en experiencias.club:</label>
                  <select class="form-select" [(ngModel)]="editStatus">
                    <option value="publicada">Publicada (Visible a todos los exploradores)</option>
                    <option value="oculta">Oculta / Pausada (Dada de baja temporalmente)</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Footer del Modal -->
            <div class="modal-footer">
              <button type="button" class="btn-cancel" (click)="closeEditModal()">Cancelar</button>
              <button
                type="button"
                class="btn-save-orange"
                [disabled]="saving()"
                (click)="saveExperience()"
              >
                {{ saving() ? 'Guardando cambios...' : 'Guardar Información de la Ruta' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .experiences-admin-container {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        margin-top: 0;
        padding-top: 0;
      }

      /* Header */
      .admin-page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1.5rem;
        flex-wrap: wrap;
      }

      .header-titles {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        max-width: 720px;
      }

      .section-kicker {
        font-size: 0.72rem;
        font-weight: 800;
        color: #ff5f00;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .title-row {
        display: flex;
        align-items: center;
        gap: 1.25rem;
        flex-wrap: wrap;
        margin: 0.2rem 0;
      }

      .card-heading {
        font-size: 1.75rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0;
        letter-spacing: -0.02em;
      }

      .card-subheading {
        font-size: 0.88rem;
        color: rgba(255, 255, 255, 0.75);
        margin: 0;
        line-height: 1.45;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .btn-back-panel {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.52rem 1.15rem;
        background: #ffffff !important;
        border: 1px solid #ffffff !important;
        color: #000000 !important;
        border-radius: 4px;
        font-size: 0.82rem;
        font-weight: 800;
        text-decoration: none;
        letter-spacing: 0.02em;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }

      .btn-back-panel:hover {
        background: #f0f0f0 !important;
        border-color: #f0f0f0 !important;
        color: #000000 !important;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }

      .btn-back-panel:active {
        transform: translateY(0);
      }

      .btn-create-exp-yellow {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
        padding: 0.52rem 1.25rem;
        background: #ffcc00 !important;
        color: #000000 !important;
        border: 1px solid #ffcc00 !important;
        border-radius: 4px;
        font-size: 0.85rem;
        font-weight: 800;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
        box-shadow: 0 4px 15px rgba(255, 204, 0, 0.3);
      }

      .btn-create-exp-yellow:hover {
        background: #ffd633 !important;
        border-color: #ffd633 !important;
        color: #000000 !important;
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(255, 204, 0, 0.45);
      }

      /* Toast */
      .toast-banner {
        padding: 0.85rem 1.25rem;
        background: rgba(255, 95, 0, 0.15);
        border: 1px solid rgba(255, 95, 0, 0.45);
        border-radius: 4px;
        color: #ff9955;
        font-size: 0.9rem;
        font-weight: 700;
      }

      /* Summary Strip */
      .summary-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
      }

      .summary-item {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        background: rgba(26, 14, 8, 0.75);
        border: 1px solid rgba(255, 95, 0, 0.25);
        border-radius: 4px;
        padding: 1rem 1.25rem;
        backdrop-filter: blur(14px);
      }

      .sum-label {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: rgba(255, 255, 255, 0.65);
        font-weight: 700;
      }

      .sum-value {
        font-size: 1.35rem;
        font-weight: 800;
        color: #ffffff;
      }

      .sum-sub {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.6);
      }

      .text-orange {
        color: #ff5f00 !important;
      }

      .text-blue {
        color: #80b3ff !important;
      }

      /* Card & Table */
      .experiences-table-card {
        background: rgba(26, 14, 8, 0.75);
        border: 1px solid rgba(255, 95, 0, 0.25);
        border-radius: 4px;
        padding: 1.5rem;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(14px);
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .card-table-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .card-table-head h3 {
        font-size: 1.15rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0;
      }

      .table-count {
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.6);
        font-family: inherit;
      }

      .table-responsive {
        overflow-x: auto;
      }

      .admin-exp-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
      }

      .admin-exp-table th {
        text-align: left;
        padding: 0.75rem 1rem;
        background: rgba(10, 5, 2, 0.5);
        color: rgba(255, 255, 255, 0.65);
        font-size: 0.72rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        border-bottom: 1px solid rgba(255, 95, 0, 0.2);
      }

      .admin-exp-table td {
        padding: 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        vertical-align: middle;
      }

      .admin-exp-table tr:hover td {
        background: rgba(255, 95, 0, 0.06);
      }

      .admin-exp-table tr.is-paused td {
        opacity: 0.65;
      }

      .exp-cell-main {
        display: flex;
        align-items: center;
        gap: 1rem;
        min-width: 260px;
      }

      .exp-table-thumb {
        width: 58px;
        height: 58px;
        border-radius: 4px;
        object-fit: cover;
        border: 1px solid rgba(255, 95, 0, 0.4);
        flex-shrink: 0;
      }

      .exp-cell-text {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }

      .exp-table-title {
        font-size: 0.95rem;
        font-weight: 700;
        color: #ffffff;
      }

      .exp-table-sub {
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.65);
      }

      .route-badge-box {
        display: flex;
        align-items: center;
      }

      .route-badge-link {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.35rem 0.65rem;
        background: rgba(10, 5, 2, 0.6);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 4px;
        color: #ff9955;
        text-decoration: none;
        font-size: 0.8rem;
        transition: all 0.2s ease;
      }

      .route-badge-link:hover {
        background: rgba(255, 95, 0, 0.2);
        border-color: #ff5f00;
        color: #ffffff;
      }

      .route-badge-link code {
        font-family: var(--font-mono, monospace);
        font-weight: 700;
      }

      .external-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }

      .meta-cell {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        min-width: 140px;
      }

      .meta-cell strong {
        color: #ffffff;
      }

      .meta-cell span {
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.65);
      }

      .alt-label {
        color: rgba(255, 255, 255, 0.65) !important;
        font-family: inherit !important;
        font-size: 0.78rem !important;
      }

      .price-cell {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }

      .price-cell strong {
        font-size: 0.95rem;
      }

      .usd-label {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.6);
      }

      .cupo-badge {
        display: inline-block;
        padding: 0.25rem 0.55rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 4px;
        font-size: 0.78rem;
        font-weight: 700;
        color: #ffffff;
      }

      .status-pill {
        display: inline-block;
        padding: 0.25rem 0.65rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .status-pill.is-published {
        background: rgba(0, 204, 136, 0.18);
        border: 1px solid rgba(0, 204, 136, 0.45);
        color: #33ffaa;
      }

      .status-pill.is-hidden {
        background: rgba(255, 80, 80, 0.18);
        border: 1px solid rgba(255, 80, 80, 0.45);
        color: #ff8080;
      }

      .status-pill.is-draft {
        background: rgba(255, 170, 0, 0.18);
        border: 1px solid rgba(255, 170, 0, 0.45);
        color: #ffaa00;
      }

      .text-right {
        text-align: right;
      }

      .action-buttons-cell {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.45rem;
        flex-wrap: wrap;
      }

      .btn-edit-exp {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.42rem 0.85rem;
        background: rgba(255, 95, 0, 0.18);
        border: 1px solid rgba(255, 95, 0, 0.45);
        border-radius: 4px;
        color: #ff7722;
        font-size: 0.8rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-edit-exp:hover {
        background: #ff5f00;
        color: #070d18;
      }

      .btn-edit-exp mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      .btn-pause-exp {
        padding: 0.42rem 0.85rem;
        background: rgba(255, 80, 80, 0.12);
        border: 1px solid rgba(255, 80, 80, 0.38);
        border-radius: 4px;
        color: #ff8080;
        font-size: 0.8rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-pause-exp:hover {
        background: rgba(255, 80, 80, 0.25);
        border-color: #ff8080;
      }

      .btn-activate-exp {
        padding: 0.42rem 0.85rem;
        background: rgba(0, 204, 136, 0.12);
        border: 1px solid rgba(0, 204, 136, 0.38);
        border-radius: 4px;
        color: #33ffaa;
        font-size: 0.8rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-activate-exp:hover {
        background: rgba(0, 204, 136, 0.25);
        border-color: #33ffaa;
      }

      .btn-view-web {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.42rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: rgba(255, 255, 255, 0.8);
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .btn-view-web:hover {
        background: rgba(255, 255, 255, 0.18);
        color: #ffffff;
      }

      .btn-view-web mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      /* Modal */
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(12px);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
      }

      .modal-container-large {
        width: 100%;
        max-width: 860px;
        max-height: 90vh;
        background: #140b06;
        border: 1px solid rgba(255, 95, 0, 0.45);
        border-radius: 4px;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: fadeIn 0.2s ease;
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 1.5rem 1.75rem;
        background: rgba(26, 14, 8, 0.9);
        border-bottom: 1px solid rgba(255, 95, 0, 0.25);
      }

      .modal-kicker {
        font-size: 0.7rem;
        font-weight: 800;
        color: #ff5f00;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .modal-title {
        font-size: 1.35rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0.2rem 0;
      }

      .modal-sub {
        font-size: 0.82rem;
        color: rgba(255, 255, 255, 0.65);
        margin: 0;
      }

      .modal-sub code {
        color: #ffaa00;
        font-family: var(--font-mono, monospace);
        font-weight: 700;
      }

      .modal-close-icon-btn {
        background: none;
        border: none;
        font-size: 1.8rem;
        color: rgba(255, 255, 255, 0.5);
        cursor: pointer;
        line-height: 1;
        padding: 0.2rem;
        transition: color 0.15s ease;
      }

      .modal-close-icon-btn:hover {
        color: #ffffff;
      }

      .modal-body-scrollable {
        padding: 1.5rem 1.75rem;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .form-section-card {
        background: rgba(26, 14, 8, 0.6);
        border: 1px solid rgba(255, 95, 0, 0.2);
        border-radius: 4px;
        padding: 1.25rem 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .form-section-title {
        font-size: 0.95rem;
        font-weight: 800;
        color: #ff9955;
        margin: 0;
        border-bottom: 1px solid rgba(255, 95, 0, 0.18);
        padding-bottom: 0.5rem;
        letter-spacing: 0.02em;
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

      .form-grid-4 {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 1rem;
      }

      .form-field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        justify-content: flex-start;
      }

      .form-field label {
        font-size: 0.78rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.85);
        min-height: 1.25rem;
        display: flex;
        align-items: flex-end;
      }

      .field-label-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        min-height: 1.25rem;
      }

      .char-counter {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.55);
        font-weight: 700;
        font-family: monospace;
      }

      .text-blue-input {
        color: #80b3ff !important;
        font-weight: 700 !important;
      }

      .form-input,
      .form-textarea,
      .form-select {
        width: 100%;
        background: rgba(10, 5, 2, 0.8);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 4px;
        padding: 0.6rem 0.85rem;
        color: #ffffff;
        font-family: 'Geist', var(--font-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 0.85rem;
        font-weight: 400;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.2s ease;
      }

      .form-select {
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 1.25rem center;
        background-size: 14px 14px;
        padding-right: 2.85rem !important;
        cursor: pointer;
      }

      .form-select option {
        background: #1a0e08;
        color: #ffffff;
      }

      .form-input:focus,
      .form-textarea:focus,
      .form-select:focus {
        border-color: #ff5f00;
      }

      .media-upload-row {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }

      .btn-upload-file {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        white-space: nowrap;
        padding: 0.58rem 0.95rem;
        background: rgba(255, 95, 0, 0.2);
        border: 1px solid rgba(255, 95, 0, 0.45);
        border-radius: 4px;
        color: #ffaa00;
        font-size: 0.78rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-upload-file:hover {
        background: rgba(255, 95, 0, 0.35);
        color: #ffffff;
      }

      .btn-upload-file.is-uploading {
        opacity: 0.6;
        pointer-events: none;
      }

      .media-preview-box {
        margin-top: 0.5rem;
        border-radius: 4px;
        overflow: hidden;
        max-width: 160px;
        max-height: 90px;
        border: 1px solid rgba(255, 255, 255, 0.15);
      }

      .media-preview-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .album-upload-section {
        margin-top: 1.25rem;
        padding-top: 1.25rem;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .album-header-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        margin-bottom: 0.85rem;
      }

      .album-section-label {
        font-size: 0.85rem;
        font-weight: 700;
        color: #ffffff;
        display: block;
        margin-bottom: 0.2rem;
      }

      .btn-upload-album-file {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.45rem 0.85rem;
        background: rgba(0, 204, 136, 0.15);
        border: 1px solid rgba(0, 204, 136, 0.4);
        border-radius: 4px;
        color: #00cc88;
        font-size: 0.78rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-upload-album-file:hover {
        background: rgba(0, 204, 136, 0.25);
        color: #ffffff;
      }

      .btn-upload-album-file.is-uploading {
        opacity: 0.6;
        pointer-events: none;
      }

      .album-photos-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
        gap: 0.85rem;
      }

      .album-photo-item {
        position: relative;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 4px;
        overflow: hidden;
      }

      .album-thumb {
        width: 100%;
        height: 85px;
        object-fit: cover;
        display: block;
      }

      .album-item-meta {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.35rem 0.4rem;
        background: rgba(10, 5, 2, 0.9);
      }

      .album-caption-input {
        width: 100%;
        background: transparent;
        border: none;
        color: #ffffff;
        font-size: 0.72rem;
        outline: none;
      }

      .album-delete-btn {
        background: none;
        border: none;
        color: #ff5f5f;
        cursor: pointer;
        font-size: 0.8rem;
        padding: 0 0.2rem;
        line-height: 1;
      }

      .album-delete-btn:hover {
        color: #ff2a2a;
      }

      .album-empty-placeholder {
        padding: 1.25rem;
        text-align: center;
        background: rgba(255, 255, 255, 0.03);
        border: 1px dashed rgba(255, 255, 255, 0.18);
        border-radius: 4px;
        color: rgba(255, 255, 255, 0.5);
        font-size: 0.8rem;
      }

      .slug-input-wrap {
        display: flex;
        align-items: center;
        background: rgba(10, 5, 2, 0.8);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 4px;
        overflow: hidden;
      }

      .slug-prefix {
        padding: 0.6rem 0.75rem;
        background: rgba(255, 95, 0, 0.15);
        color: #ffaa00;
        font-family: inherit;
        font-size: 0.82rem;
        font-weight: 700;
        border-right: 1px solid rgba(255, 95, 0, 0.35);
        white-space: nowrap;
      }

      .slug-field {
        border: none !important;
        background: transparent !important;
      }

      .field-hint {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.55);
      }

      .modal-footer {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 1rem;
        padding: 1.25rem 1.75rem;
        background: rgba(26, 14, 8, 0.9);
        border-top: 1px solid rgba(255, 95, 0, 0.25);
      }

      .btn-cancel {
        padding: 0.55rem 1.15rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.25);
        border-radius: 4px;
        color: #ffffff;
        font-size: 0.82rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-cancel:hover {
        background: rgba(255, 255, 255, 0.18);
      }

      .btn-save-orange {
        padding: 0.58rem 1.45rem;
        background: #ff5f00;
        border: 1px solid #ff5f00;
        border-radius: 4px;
        color: #070d18;
        font-size: 0.85rem;
        font-weight: 800;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-save-orange:hover:not(:disabled) {
        background: #ff7722;
        border-color: #ff7722;
        transform: translateY(-1px);
        box-shadow: 0 4px 15px rgba(255, 95, 0, 0.4);
      }

      .btn-save-orange:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      @media (max-width: 768px) {
        .admin-page-header {
          flex-direction: column;
          gap: 1rem;
          align-items: stretch;
        }
        .header-actions {
          width: 100%;
        }
        .btn-primary-orange {
          width: 100%;
          justify-content: center;
        }
        .summary-strip {
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }
        .summary-item {
          padding: 0.85rem 1rem;
        }
        .sum-value {
          font-size: 1.15rem;
        }
        .modal-backdrop {
          padding: 0.5rem;
        }
        .modal-container-large {
          max-height: 95vh;
          max-width: 98vw;
        }
        .modal-header,
        .modal-body-scrollable,
        .modal-footer {
          padding: 1rem 1.15rem;
        }
        .form-grid-2,
        .form-grid-3,
        .form-grid-4 {
          grid-template-columns: 1fr;
        }
        .action-buttons-cell {
          justify-content: flex-start;
        }
      }

      @media (max-width: 480px) {
        .summary-strip {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AdminExperiencesComponent {
  private readonly experienceService = inject(ExperienceService);
  private readonly storageService = inject(StorageService);

  readonly experiences = this.experienceService.experiences;
  readonly feedbackToast = signal<string | null>(null);
  readonly saving = signal(false);

  readonly activeCount = computed(
    () => this.experiences().filter((e) => e.status === 'publicada').length,
  );

  readonly publicSlugs = computed(() => this.experiences().map((e) => `/${e.slug}`));

  readonly primaryArsPrice = computed(() => {
    const kayak = this.experienceService.getExperienceBySlug('kayak');
    return kayak?.priceArs || 65000;
  });

  readonly avgCapacity = computed(() => {
    const list = this.experiences();
    if (!list.length) return 12;
    const total = list.reduce((sum, e) => sum + (e.maxSpotsPerGroup || 12), 0);
    return Math.round(total / list.length);
  });

  // Modal State
  readonly editingExperience = signal<Experience | null>(null);
  readonly isCreating = signal(false);

  // Uploading state
  readonly uploadingCover = signal(false);
  readonly uploadingVideo = signal(false);
  readonly uploadingAlbum = signal(false);
  readonly editAlbumPhotos = signal<ExperienceAlbumPhoto[]>([]);

  // Form Fields
  readonly editId = signal('');
  readonly editSlug = signal('');
  readonly editTitle = signal('');
  readonly editTagline = signal('');
  readonly editDescription = signal('');
  readonly editRegion = signal('');
  readonly editMeetingPoint = signal('');
  readonly editDifficulty = signal<'Baja' | 'Moderada' | 'Exigente' | 'Alta Montaña'>('Baja');
  readonly editDurationLabel = signal('');
  readonly editAltitude = signal(850);
  readonly editCapacity = signal(12);
  readonly editPriceArs = signal(65000);
  readonly calculatedUsd = computed(() => Math.round((Number(this.editPriceArs()) || 0) / 1600));
  readonly editCoverImage = signal('');
  readonly editVideoUrl = signal('');
  readonly editVideoPoster = signal('');
  readonly editDatesRaw = signal('');
  readonly editHighlightsRaw = signal('');
  readonly editIncludedRaw = signal('');
  readonly editStatus = signal<'publicada' | 'oculta'>('publicada');
  readonly editProviderName = signal('');
  readonly editProviderPhone = signal('');
  readonly editProviderCbuAlias = signal('');
  readonly editProviderCuitDni = signal('');
  readonly editProviderBankName = signal('');

  openEditModal(exp: Experience): void {
    this.isCreating.set(false);
    this.editingExperience.set(exp);

    this.editId.set(exp.id);
    this.editSlug.set(exp.slug);
    this.editTitle.set(exp.title);
    this.editTagline.set(exp.tagline || '');
    this.editDescription.set(exp.description || '');
    this.editRegion.set(exp.region || 'Valle Central y Ambato');
    this.editMeetingPoint.set(exp.meetingPoint || '');
    this.editDifficulty.set(exp.difficulty || 'Baja');
    this.editDurationLabel.set(exp.durationLabel || '4 Horas');
    this.editAltitude.set(exp.altitudeMeters || 850);
    this.editCapacity.set(exp.maxSpotsPerGroup || 12);
    this.editPriceArs.set(exp.priceArs || 65000);
    this.editCoverImage.set(exp.coverImage || '');
    this.editVideoUrl.set(exp.videoUrl || '');
    this.editVideoPoster.set(exp.videoPoster || '');
    this.editDatesRaw.set((exp.dates || []).join(', '));
    this.editHighlightsRaw.set((exp.highlights || []).join('\n'));
    this.editIncludedRaw.set((exp.included || []).join('\n'));
    this.editAlbumPhotos.set([...(exp.albumPhotos || [])]);
    this.editStatus.set(exp.status === 'oculta' ? 'oculta' : 'publicada');
    this.editProviderName.set(exp.providerName || '');
    this.editProviderPhone.set(exp.providerPhone || '');
    this.editProviderCbuAlias.set(exp.providerCbuAlias || '');
    this.editProviderCuitDni.set(exp.providerCuitDni || '');
    this.editProviderBankName.set(exp.providerBankName || '');
  }

  openCreateModal(): void {
    const newId = `exp-${Date.now().toString(36)}`;
    const blankExp: Experience = {
      id: newId,
      slug: '',
      title: '',
      shortTitle: '',
      kicker: '',
      tagline: '',
      description: '',
      region: 'Catamarca',
      meetingPoint: '',
      difficulty: 'Baja',
      durationDays: 1,
      durationLabel: 'Media Jornada',
      altitudeMeters: 1000,
      bestSeason: '',
      priceArs: 75000,
      priceUsd: 47,
      maxSpotsPerGroup: 10,
      coverImage: '/assets/images/kayak-club-de-experiencias.jpg',
      galleryImages: ['/assets/images/kayak-club-de-experiencias.jpg'],
      albumPhotos: [],
      highlights: [],
      included: [],
      dates: [],
      status: 'publicada',
      isExclusiveClub: true,
      isLocked: false,
    };

    this.isCreating.set(true);
    this.editingExperience.set(blankExp);

    this.editId.set(newId);
    this.editSlug.set('');
    this.editTitle.set('');
    this.editTagline.set('');
    this.editDescription.set('');
    this.editRegion.set('Catamarca');
    this.editMeetingPoint.set('');
    this.editDifficulty.set('Baja');
    this.editDurationLabel.set('Media Jornada');
    this.editAltitude.set(1000);
    this.editCapacity.set(10);
    this.editPriceArs.set(75000);
    this.editCoverImage.set('/assets/images/kayak-club-de-experiencias.jpg');
    this.editVideoUrl.set('');
    this.editVideoPoster.set('');
    this.editDatesRaw.set('');
    this.editHighlightsRaw.set('');
    this.editIncludedRaw.set('');
    this.editAlbumPhotos.set([]);
    this.editStatus.set('publicada');
    this.editProviderName.set('');
    this.editProviderPhone.set('');
    this.editProviderCbuAlias.set('');
    this.editProviderCuitDni.set('');
    this.editProviderBankName.set('');
  }

  closeEditModal(): void {
    this.editingExperience.set(null);
    this.isCreating.set(false);
  }

  async onUploadCoverImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingCover.set(true);
    try {
      const slug = this.editSlug() || 'exp';
      const res = await this.storageService.uploadFile(file, `COVER-${slug}`);
      this.editCoverImage.set(res.url);
      this.showToast('✅ Imagen de portada subida con éxito');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al subir portada';
      this.showToast(`❌ ${msg}`);
    } finally {
      this.uploadingCover.set(false);
      input.value = '';
    }
  }

  async onUploadVideo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingVideo.set(true);
    try {
      const slug = this.editSlug() || 'exp';
      const res = await this.storageService.uploadFile(file, `VID-${slug}`);
      this.editVideoUrl.set(res.url);
      this.showToast('✅ Video subido con éxito');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al subir video';
      this.showToast(`❌ ${msg}`);
    } finally {
      this.uploadingVideo.set(false);
      input.value = '';
    }
  }

  async onUploadAlbumPhotos(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length) return;

    this.uploadingAlbum.set(true);
    try {
      const slug = this.editSlug() || 'exp';
      const newPhotos: ExperienceAlbumPhoto[] = [];
      for (const file of files) {
        const res = await this.storageService.uploadFile(file, `ALBUM-${slug}`);
        newPhotos.push({
          id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          url: res.url,
          caption: '',
          isCover: false,
          isFeatured: false,
        });
      }
      this.editAlbumPhotos.update((current) => [...current, ...newPhotos]);
      this.showToast(`✅ ${newPhotos.length} foto(s) agregada(s) al álbum`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al subir fotos';
      this.showToast(`❌ ${msg}`);
    } finally {
      this.uploadingAlbum.set(false);
      input.value = '';
    }
  }

  updatePhotoCaption(index: number, caption: string): void {
    this.editAlbumPhotos.update((photos) => {
      const updated = [...photos];
      if (updated[index]) {
        updated[index] = { ...updated[index], caption };
      }
      return updated;
    });
  }

  removeAlbumPhoto(index: number): void {
    this.editAlbumPhotos.update((photos) => photos.filter((_, i) => i !== index));
  }

  async saveExperience(): Promise<void> {
    const title = this.editTitle().trim();
    if (!title) {
      this.showToast('⚠️ Por favor ingresá un título para la experiencia.');
      return;
    }

    const isKayak = this.editingExperience()?.slug === 'kayak';
    const rawSlug = isKayak ? 'kayak' : this.editSlug().trim() || title;
    const slug = rawSlug
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const dates = this.editDatesRaw()
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    const highlights = this.editHighlightsRaw()
      .split('\n')
      .map((h) => h.trim())
      .filter((h) => h.length > 0);

    const included = this.editIncludedRaw()
      .split('\n')
      .map((i) => i.trim())
      .filter((i) => i.length > 0);

    const priceArs = Number(this.editPriceArs()) || 0;
    const priceUsd = Math.round(priceArs / 1600);

    const payload: Partial<Experience> & { id: string } = {
      id: this.editId(),
      slug,
      title,
      shortTitle: title,
      kicker: '',
      tagline: this.editTagline().trim(),
      description: this.editDescription().trim(),
      region: this.editRegion().trim() || 'Catamarca',
      meetingPoint: this.editMeetingPoint().trim(),
      difficulty: this.editDifficulty(),
      durationLabel: this.editDurationLabel().trim() || '4 Horas',
      altitudeMeters: Number(this.editAltitude()) || 0,
      bestSeason: '',
      maxSpotsPerGroup: Number(this.editCapacity()) || 12,
      priceArs,
      priceUsd,
      coverImage: this.editCoverImage().trim() || '/assets/images/kayak-club-de-experiencias.jpg',
      albumPhotos: this.editAlbumPhotos(),
      providerName: this.editProviderName().trim(),
      providerPhone: this.editProviderPhone().trim(),
      providerCbuAlias: this.editProviderCbuAlias().trim(),
      providerCuitDni: this.editProviderCuitDni().trim(),
      providerBankName: this.editProviderBankName().trim(),
      videoUrl: this.editVideoUrl().trim(),
      videoPoster: this.editVideoPoster().trim(),
      dates,
      highlights,
      included,
      status: this.editStatus(),
      publicUrl: `https://experiencias.club/experiencias/${slug}`,
      detailRoute: `/experiencias/${slug}`,
    };

    this.saving.set(true);
    try {
      if (this.isCreating()) {
        const fullNewExp: Experience = {
          ...payload,
          durationDays: 1,
          galleryImages: [payload.coverImage!],
          isExclusiveClub: true,
          isLocked: false,
        } as Experience;
        await this.experienceService.createExperience(fullNewExp);
        this.showToast(
          `✨ Experiencia "${title}" creada exitosamente en la ruta /experiencias/${slug}.`,
        );
      } else {
        await this.experienceService.updateExperience(payload);
        this.showToast(`✅ Información de la ruta /experiencias/${slug} actualizada con éxito.`);
      }
      this.closeEditModal();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar experiencia';
      this.showToast(`⚠️ ${msg}`);
    } finally {
      this.saving.set(false);
    }
  }

  async toggleStatus(exp: Experience, newStatus: 'publicada' | 'oculta'): Promise<void> {
    try {
      await this.experienceService.toggleExperienceStatus(exp.id, newStatus);
      if (newStatus === 'oculta') {
        this.showToast(`🔴 La ruta /experiencias/${exp.slug} fue dada de baja y pausada.`);
      } else {
        this.showToast(`🟢 La ruta /experiencias/${exp.slug} fue activada y publicada.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cambiar estado';
      this.showToast(`⚠️ ${msg}`);
    }
  }

  private showToast(msg: string): void {
    this.feedbackToast.set(msg);
    setTimeout(() => this.feedbackToast.set(null), 4500);
  }

  getPublicExperienceUrl(exp: { publicUrl?: string; slug?: string; detailRoute?: string }): string {
    if (exp.publicUrl && exp.publicUrl.trim().length > 0) {
      return exp.publicUrl.trim();
    }
    const route = exp.detailRoute || `/experiencias/${exp.slug || ''}`;
    return `https://experiencias.club${route.startsWith('/') ? '' : '/'}${route}`;
  }
}
