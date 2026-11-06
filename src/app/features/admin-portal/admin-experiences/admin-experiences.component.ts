import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { filter } from 'rxjs';
import { ExperienceService } from '../../../core/services/experience.service';
import { StorageService } from '../../../core/services/storage.service';
import { AdminStoreService } from '../../../core/services/admin-store.service';
import { Experience, ExperienceAlbumPhoto } from '../../../core/models/experience.model';
import { isClubExperience } from '../../../core/models/club-profile.model';
import { ArsPipe, FechaPipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-admin-experiences',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatIconModule, ArsPipe, FechaPipe],
  template: `
    <div class="experiences-admin-container">
      <!-- Toast Feedback -->
      @if (feedbackToast()) {
        <div class="toast-banner">
          <span>{{ feedbackToast() }}</span>
        </div>
      }

      @if (notFound()) {
        <!-- Modo Error: Experiencia no encontrada -->
        <div class="empty-state-card" style="margin-top: 1.5rem; text-align: center; padding: 2.5rem 1.5rem;">
          <h2 class="card-heading">Experiencia no encontrada</h2>
          <p class="card-subheading">No pudimos encontrar la experiencia solicitada en el catálogo.</p>
          <a [routerLink]="backToListLink()" class="btn-back-panel" style="margin-top: 1.25rem; display: inline-flex;">
            Volver a Experiencias
          </a>
        </div>
      } @else if (isRouteEditMode() && editingExperience(); as exp) {
        <!-- Modo Edición en Subruta: /experiencias/:slug/editar -->
        <div class="edit-page-card">
          <div class="admin-page-header">
            <div class="header-titles">
              <span class="section-kicker">GESTIÓN DE CATÁLOGO & RUTAS WEB</span>
              <div class="title-row">
                <h1 class="card-heading">Editar Experiencia: {{ editTitle() }}</h1>
                <div class="top-header-actions">
                  <a [routerLink]="getDetailRoute(exp)" class="btn-view-fiche-top" title="Ver ficha completa">
                    <mat-icon class="btn-icon-sm">visibility</mat-icon>
                    <span>Ver Ficha</span>
                  </a>
                  <a [routerLink]="backToListLink()" class="btn-back-panel">Volver a Experiencias</a>
                </div>
              </div>
              <p class="card-subheading">
                Ruta web oficial: <code>/experiencias/{{ editSlug() }}</code>.
                Como administrador, podés actualizar el slug de publicación oficial, tarifas, cupos y contenidos de la ficha.
              </p>
            </div>
          </div>

          <div class="edit-page-body">
            <ng-container *ngTemplateOutlet="experienceFormSections" />
          </div>

          <div class="edit-page-footer">
            <a [routerLink]="getDetailRoute(exp)" class="btn-cancel-edit">Cancelar</a>
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
      } @else if (isRouteDetailMode() && editingExperience(); as exp) {
        <!-- Modo Ficha de la Experiencia: /experiencias/:slug (Punto intermedio) -->
        <div class="fiche-page-card">
          <!-- Barra Superior de Navegación & Acciones de Admin -->
          <div class="fiche-admin-topbar">
            <div class="topbar-left">
              <a [routerLink]="backToListLink()" class="btn-back-panel">
                &larr; Volver a Experiencias
              </a>
              <span class="fiche-topbar-breadcrumb">
                /experiencias / <strong>{{ exp.slug }}</strong>
              </span>
            </div>

            <div class="topbar-actions">
              <!-- Pausar o Activar -->
              @if (exp.status === 'publicada') {
                <button
                  type="button"
                  class="btn-pause-exp-top"
                  (click)="toggleStatus(exp, 'oculta')"
                  title="Pausar ruta y ocultarla de la web pública"
                >
                  <mat-icon class="btn-icon-sm">pause_circle</mat-icon>
                  <span>Pausar</span>
                </button>
              } @else {
                <button
                  type="button"
                  class="btn-activate-exp-top"
                  (click)="toggleStatus(exp, 'publicada')"
                  title="Activar y publicar en la web pública"
                >
                  <mat-icon class="btn-icon-sm">play_circle</mat-icon>
                  <span>Activar</span>
                </button>
              }

              <!-- Ver en la Web Pública -->
              <a
                [href]="getPublicExperienceUrl(exp)"
                target="_blank"
                rel="noopener noreferrer"
                class="btn-action-public-web"
                title="Ver cómo se visualiza actualmente en experiencias.club"
              >
                <mat-icon class="btn-icon-sm">open_in_new</mat-icon>
                <span>Ver en Web Pública</span>
              </a>

              <!-- Botón EDITAR EXPERIENCIA (Destacado en Naranja) -->
              <a
                [routerLink]="getEditRoute(exp)"
                class="btn-action-edit-orange"
                title="Editar los datos y contenidos de esta ficha"
              >
                <mat-icon class="btn-icon-sm">edit</mat-icon>
                <span>EDITAR EXPERIENCIA</span>
              </a>
            </div>
          </div>

          <!-- Contenido de la Ficha (Estilo Web Pública) -->
          <div class="fiche-body">
            <!-- 1. HERO CARD: Título, Kicker, Bajada y Badges Oficiales -->
            <div class="fiche-section-card hero-fiche-card">
              <div class="fiche-hero-header">
                <div class="hero-kicker-row">
                  <span class="hero-kicker">{{ exp.kicker || 'EXPEDICIÓN OFICIAL DEL CLUB' }}</span>
                  <div class="hero-badges-row">
                    @if (isClub(exp)) {
                      <span class="club-official-chip" title="Experiencia Oficial del Club de Experiencias">
                        <mat-icon>verified</mat-icon>
                        Club de Experiencias
                      </span>
                    }
                    @if (exp.status === 'publicada') {
                      <span class="status-pill is-published">Publicada</span>
                    } @else {
                      <span class="status-pill is-hidden">Pausada</span>
                    }
                  </div>
                </div>

                <h1 class="fiche-hero-title">{{ exp.title }}</h1>
                @if (exp.tagline) {
                  <p class="fiche-hero-sub">{{ exp.tagline }}</p>
                }
                @if (exp.description && exp.description !== exp.tagline) {
                  <p class="fiche-hero-desc">{{ exp.description }}</p>
                }
              </div>

              <!-- Specs Técnicas Rápidas -->
              <div class="fiche-specs-grid">
                <div class="spec-tile">
                  <span class="spec-label">DIFICULTAD</span>
                  <span class="spec-value">{{ exp.difficulty }}</span>
                </div>
                <div class="spec-tile">
                  <span class="spec-label">DURACIÓN</span>
                  <span class="spec-value">{{ exp.durationLabel }}</span>
                </div>
                <div class="spec-tile">
                  <span class="spec-label">ALTITUD</span>
                  <span class="spec-value">{{ exp.altitudeMeters > 0 ? (exp.altitudeMeters + ' msnm') : 'N/A' }}</span>
                </div>
                <div class="spec-tile">
                  <span class="spec-label">CUPO MÁXIMO</span>
                  <span class="spec-value">{{ exp.maxSpotsPerGroup }} personas</span>
                </div>
                <div class="spec-tile">
                  <span class="spec-label">REGIÓN</span>
                  <span class="spec-value">{{ exp.region }}</span>
                </div>
                <div class="spec-tile">
                  <span class="spec-label">TEMPORADA</span>
                  <span class="spec-value">{{ exp.bestSeason || 'Todo el año' }}</span>
                </div>
              </div>

              <!-- Media Principal: Video o Imagen de Portada -->
              @if (exp.videoUrl) {
                <div class="fiche-media-player-wrap">
                  <video
                    [src]="exp.videoUrl"
                    controls
                    playsinline
                    [poster]="exp.videoPoster || exp.coverImage"
                    class="fiche-video-element"
                  >
                    Tu navegador no soporta reproducción de video.
                  </video>
                </div>
              } @else if (exp.coverImage) {
                <div class="fiche-cover-img-wrap">
                  <img [src]="exp.coverImage" [alt]="exp.title" class="fiche-cover-img" />
                </div>
              }
            </div>

            <!-- 2. ARANCEL OFICIAL & SALIDAS PROGRAMADAS -->
            <div class="fiche-section-card pricing-fiche-card">
              <div class="pricing-card-flex">
                <div class="price-data">
                  <span class="price-title">ARANCEL OFICIAL DE PUBLICACIÓN</span>
                  <div class="price-figures">
                    <span class="ars-price">{{ exp.priceArs | ars }}</span>
                    @if (exp.priceUsd) {
                      <span class="usd-price">o &#36;{{ exp.priceUsd }} USD</span>
                    }
                  </div>
                  <span class="price-note">
                    {{ exp.promosAndPricing || 'Prioridad y aranceles especiales para socios de nuestro Club de Experiencias.' }}
                  </span>
                </div>

                <div class="action-btns-group">
                  <a [routerLink]="getEditRoute(exp)" class="btn-action-edit-orange">
                    <mat-icon>edit</mat-icon>
                    <span>Editar Arancel y Parámetros</span>
                  </a>
                </div>
              </div>

              @if (upcomingDates().length > 0) {
                <div class="fiche-dates-section">
                  <h4 class="fiche-subhead-title">Fechas de Salida Programadas</h4>
                  <div class="dates-chips-grid">
                    @for (d of upcomingDates(); track d) {
                      <div class="date-chip-item">
                        <mat-icon class="date-chip-icon">event</mat-icon>
                        <span class="date-chip-text">{{ d | fecha: 'larga' }}</span>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- 3. PRESTADOR ASIGNADO & DATOS DE COBRO (CBU) -->
            <div class="fiche-section-card" [class.is-club-card]="isClub(exp)">
              <div class="section-title-row">
                <h3 class="fiche-card-title">Prestador Asignado & Datos de Cobro (CBU)</h3>
                @if (isClub(exp)) {
                  <span class="club-locked-chip">
                    <mat-icon>verified</mat-icon>
                    Cuenta Oficial del Club
                  </span>
                }
              </div>

              <div class="provider-info-grid">
                <div class="info-item">
                  <span class="info-label">PRESTADOR</span>
                  <strong class="info-value">{{ isClub(exp) ? adminStore.clubProfile().name : (exp.providerName || 'No asignado') }}</strong>
                </div>
                <div class="info-item">
                  <span class="info-label">CONTACTO / TELÉFONO</span>
                  <span class="info-value">{{ isClub(exp) ? adminStore.clubProfile().phone : (exp.providerPhone || 'N/A') }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">CBU / CVU O ALIAS</span>
                  <strong class="info-value text-blue">{{ isClub(exp) ? adminStore.clubProfile().cbuAlias : (exp.providerCbuAlias || 'N/A') }}</strong>
                </div>
                <div class="info-item">
                  <span class="info-label">CUIT / DNI</span>
                  <span class="info-value">{{ isClub(exp) ? adminStore.clubProfile().cuitDni : (exp.providerCuitDni || 'N/A') }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">BANCO / ENTIDAD</span>
                  <span class="info-value">{{ isClub(exp) ? adminStore.clubProfile().bankName : (exp.providerBankName || 'N/A') }}</span>
                </div>
              </div>
            </div>

            <!-- 4. CRONOGRAMA E ITINERARIO DE LA JORNADA -->
            <div class="fiche-section-card">
              <div class="section-title-row">
                <div>
                  <h3 class="fiche-card-title">Cronograma e Itinerario de la Jornada</h3>
                  <p class="section-subtext">
                    Línea de tiempo paso a paso tal como se renderiza para los exploradores en la web pública.
                  </p>
                </div>
              </div>

              @if (itinerarySteps().length > 0) {
                <div class="timeline-list">
                  @for (step of itinerarySteps(); track $index) {
                    <div class="timeline-step">
                      <div class="timeline-time">{{ step.time }}</div>
                      <div class="timeline-body">
                        <h4>{{ step.title }}</h4>
                        <p>{{ step.description }}</p>
                      </div>
                    </div>
                  }
                </div>
              } @else if (exp.itinerary) {
                <div class="raw-itinerary-box">
                  <p style="white-space: pre-line; margin: 0; color: rgba(255, 255, 255, 0.85); font-size: 0.9rem; line-height: 1.6;">
                    {{ exp.itinerary }}
                  </p>
                </div>
              } @else {
                <div class="album-empty-placeholder">
                  <span>No se ha cargado un itinerario específico aún para esta experiencia.</span>
                </div>
              }
            </div>

            <!-- 5. SERVICIOS INCLUIDOS & QUÉ LLEVAR -->
            @if ((exp.included && exp.included.length > 0) || (exp.highlights && exp.highlights.length > 0)) {
              <div class="fiche-section-card">
                <h3 class="fiche-card-title">Equipamiento & Servicios</h3>
                <div class="simple-logistics-grid">
                  <!-- Servicios Incluidos -->
                  @if (exp.included && exp.included.length > 0) {
                    <div class="simple-logistics-col">
                      <div class="simple-col-title-wrap">
                        <h4 class="simple-col-title">Servicios e Indumentaria Provista</h4>
                      </div>
                      <ul class="simple-check-list">
                        @for (inc of exp.included; track inc) {
                          <li>{{ inc }}</li>
                        }
                      </ul>
                    </div>
                  }

                  <!-- Qué Debes Traer -->
                  @if (exp.highlights && exp.highlights.length > 0) {
                    <div class="simple-logistics-col traer-col">
                      <div class="simple-col-title-wrap">
                        <h4 class="simple-col-title">Qué Debes Traer</h4>
                      </div>
                      <ul class="simple-check-list blue-checks">
                        @for (item of exp.highlights; track item) {
                          <li>{{ item }}</li>
                        }
                      </ul>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- 6. PUNTO DE ENCUENTRO & UBICACIÓN -->
            <div class="fiche-section-card">
              <h3 class="fiche-card-title">Logística & Punto de Encuentro</h3>
              <p class="meeting-point-desc">
                {{ exp.meetingPoint || 'Lugar a coordinar con los exploradores inscriptos' }} ({{ exp.region }})
              </p>

              @if (exp.meetingPointUrl || exp.meetingPoint) {
                <div class="location-actions-row">
                  <a
                    [href]="getGoogleMapsUrl(exp.meetingPoint, exp.region, exp.meetingPointUrl)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="location-btn maps-btn"
                  >
                    <mat-icon>place</mat-icon>
                    <span>Abrir en Google Maps</span>
                  </a>
                </div>
              }
            </div>

            <!-- 7. ÁLBUM & GALERÍA DE FOTOS -->
            @if (exp.albumPhotos && exp.albumPhotos.length > 0) {
              <div class="fiche-section-card">
                <div class="section-title-row">
                  <div>
                    <h3 class="fiche-card-title">Álbum & Galería Oficial</h3>
                    <p class="section-subtext">
                      {{ exp.albumPhotos.length }} fotos cargadas ({{ detailFeaturedPhotos().length }} destacadas, {{ detailGalleryPhotos().length }} en galería común).
                    </p>
                  </div>
                  <a [routerLink]="getEditRoute(exp)" class="btn-text-edit-album">
                    Modificar fotos en edición &rarr;
                  </a>
                </div>

                <div class="fiche-album-grid">
                  @for (photo of exp.albumPhotos; track photo.id) {
                    <div class="fiche-album-card" [class.is-featured-card]="photo.isFeatured" [class.is-cover-card]="photo.isCover">
                      <div class="thumb-wrap">
                        <img [src]="photo.url" [alt]="photo.caption || photo.title || 'Foto de álbum'" class="fiche-album-img" />
                        @if (photo.isCover) {
                          <span class="photo-badge badge-cover">Portada</span>
                        }
                        @if (photo.isFeatured) {
                          <span class="photo-badge badge-featured">⭐ Destacada</span>
                        }
                      </div>
                      @if (photo.caption || photo.title) {
                        <span class="fiche-album-caption">{{ photo.caption || photo.title }}</span>
                      }
                    </div>
                  }
                </div>
              </div>
            }

            <!-- 8. PIE DE ACCIONES: Volver o Editar -->
            <div class="fiche-bottom-cta-bar">
              <div class="cta-bar-left">
                <span class="cta-exp-title">{{ exp.title }}</span>
                <span class="cta-exp-route">experiencias.club/experiencias/{{ exp.slug }}</span>
              </div>
              <div class="cta-bar-right">
                <a [routerLink]="backToListLink()" class="btn-cancel-edit">Volver al Catálogo</a>
                <a [routerLink]="getEditRoute(exp)" class="btn-action-edit-orange">
                  <mat-icon class="btn-icon-sm">edit</mat-icon>
                  <span>Editar Esta Experiencia</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      } @else {
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
                <th>Cupo Máx.</th>
                <th>Estado</th>
                <th class="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (exp of experiences(); track exp.id) {
                <tr [class.is-paused]="exp.status === 'oculta'">
                  <!-- Columna Experiencia / Portada -->
                  <td>
                    <a
                      [routerLink]="getDetailRoute(exp)"
                      class="exp-cell-main exp-cell-link"
                      title="Ver ficha de {{ exp.title }}"
                    >
                      <img
                        [src]="exp.coverImage || '/assets/images/kayak-club-de-experiencias.jpg'"
                        [alt]="exp.title"
                        class="exp-table-thumb"
                      />
                      <div class="exp-cell-text">
                        <div class="exp-title-row">
                          <strong class="exp-table-title">{{ exp.title }}</strong>
                          @if (isClub(exp)) {
                            <span class="club-official-chip" title="Experiencia Oficial creada por el Club de Experiencias">
                              <mat-icon>verified</mat-icon>
                              Club
                            </span>
                          }
                        </div>
                        <span class="exp-table-sub">{{ exp.tagline }}</span>
                      </div>
                    </a>
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
                      <!-- Ver Ficha Completa (Punto Intermedio) -->
                      <a
                        [routerLink]="getDetailRoute(exp)"
                        class="btn-view-fiche"
                        title="Ver la ficha técnica y visual de esta experiencia"
                      >
                        <mat-icon class="action-btn-icon">visibility</mat-icon>
                        <span>VER FICHA</span>
                      </a>

                      <!-- Editar Información Completa en Subruta -->
                      <a
                        [routerLink]="getEditRoute(exp)"
                        class="btn-edit-exp"
                        title="Editar toda la información de esta experiencia"
                      >
                        <span>EDITAR</span>
                      </a>

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

        <!-- MODAL: Solo para Crear Nueva Experiencia cuando no estamos en subruta -->
        @if (editingExperience() && isCreating()) {
          <div class="modal-backdrop" (click)="closeEditModal()">
            <div class="modal-container-large" (click)="$event.stopPropagation()">
              <div class="modal-header">
                <div>
                  <span class="modal-kicker">EDICIÓN DE RUTA PÚBLICA</span>
                  <h2 class="modal-title">Nueva Experiencia</h2>
                  <p class="modal-sub">
                    Ruta oficial: <code>/experiencias/{{ editSlug() }}</code>
                  </p>
                </div>
                <button type="button" class="modal-close-icon-btn" (click)="closeEditModal()">
                  ×
                </button>
              </div>

              <div class="modal-body-scrollable">
                <ng-container *ngTemplateOutlet="experienceFormSections" />
              </div>

              <div class="modal-footer">
                <button type="button" class="btn-cancel" (click)="closeEditModal()">Cancelar</button>
                <button
                  type="button"
                  class="btn-save-orange"
                  [disabled]="saving()"
                  (click)="saveExperience()"
                >
                  {{ saving() ? 'Guardando cambios...' : 'Crear Experiencia' }}
                </button>
              </div>
            </div>
          </div>
        }
      }

      <ng-template #experienceFormSections>
        <!-- Banner Experiencia Oficial del Club de Experiencias -->
        @if (isCurrentExperienceClub()) {
          <div class="club-experience-banner">
            <div class="club-banner-icon">
              <mat-icon>verified</mat-icon>
            </div>
            <div class="club-banner-text">
              <div class="club-banner-header">
                <span class="club-banner-title">Experiencia Creada por el Club de Experiencias</span>
                <span class="club-banner-badge">Prestador Oficial</span>
              </div>
              <p class="club-banner-desc">
                Esta experiencia pertenece a la cuenta oficial del <strong>Club de Experiencias</strong>.
                La asignación de prestador y los datos de cobro (CBU / Alias) están vinculados al perfil central del Club administrado conjuntamente por todos los administradores.
              </p>
            </div>
            <button
              type="button"
              class="btn-edit-club-profile"
              (click)="openClubProfileModal()"
              title="Editar Perfil del Club de Experiencias"
            >
              <mat-icon>account_balance</mat-icon>
              <span>Editar Perfil del Club</span>
            </button>
          </div>
        }

        <!-- SECCIÓN 1: Identificación y Rutas -->
        <div class="form-section-card">
          <h4 class="form-section-title">1. Identificación & Ruta Pública</h4>
          <div class="form-field">
            <label>Ruta / Slug oficial (URL final en la web pública):</label>
            <div class="slug-input-wrap">
              <span class="slug-prefix">https://experiencias.club/experiencias/</span>
              <input
                type="text"
                class="form-input slug-field"
                [(ngModel)]="editSlug"
                placeholder="ej: kayak, trekking-el-jumeal"
              />
            </div>
            <span class="field-hint">
              Control exclusivo del administrador para actualizar la ruta web pública oficial de la experiencia.
            </span>
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
                <div class="form-grid-2">
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
                    <label>Punto de Encuentro:</label>
                    <input
                      type="text"
                      class="form-input"
                      [(ngModel)]="editMeetingPoint"
                      placeholder="Ej: Club Náutico Dique El Jumeal"
                    />
                    <span class="field-hint">Lugar o referencia física de encuentro para los exploradores.</span>
                  </div>

                  <div class="form-field">
                    <div class="field-header-row">
                      <label>Ubicación (Link de Google Maps):</label>
                      @if (editMeetingPointUrl() && isValidGoogleMapsUrl(editMeetingPointUrl())) {
                        <a
                          [href]="editMeetingPointUrl()"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="link-maps-preview"
                        >
                          Abrir en Maps ↗
                        </a>
                      }
                    </div>
                    <input
                      type="url"
                      class="form-input"
                      [(ngModel)]="editMeetingPointUrl"
                      placeholder="Ej: https://maps.app.goo.gl/... o https://www.google.com/maps/..."
                    />
                    <span class="field-hint">Enlace oficial de Google Maps para el botón 'Cómo llegar' de la ficha.</span>
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

              <!-- SECCIÓN 3: Cronograma e Itinerario de la Jornada -->
              <div class="form-section-card">
                <div class="section-title-row">
                  <h4 class="form-section-title">3. Cronograma e Itinerario de la Jornada</h4>
                  <span class="char-counter" [class.counter-warn]="editItinerary().length > 1400">
                    {{ editItinerary().length }} / 1500 caracteres
                  </span>
                </div>
                <p class="section-subtext">
                  Detallá el cronograma horario o etapas de la vivencia (una por renglón). Esto se renderiza con formato de línea de tiempo interactiva en la página pública de la experiencia.
                </p>
                <div class="form-field">
                  <textarea
                    rows="5"
                    maxlength="1500"
                    class="form-input form-textarea"
                    [(ngModel)]="editItinerary"
                    placeholder="Ej:&#10;15:30 hs - Recepción de participantes y entrega de chalecos/equipamiento&#10;16:15 hs - Charla de técnica de remo y seguridad en tierra firme&#10;16:45 hs - Zarpada al espejo de agua y recorrido guiado por las bahías&#10;18:15 hs - Pausa Sunset, hidratación y merienda en la costa&#10;19:30 hs - Cierre de jornada y despedida"
                  ></textarea>
                </div>
              </div>

              <!-- SECCIÓN 4: Arancel Oficial & Fechas Programadas (Unificados) -->
              <div class="form-section-card">
                <h4 class="form-section-title">4. Arancel Oficial & Fechas Programadas</h4>
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
              <div class="form-section-card" [class.is-club-section]="isCurrentExperienceClub()">
                <div class="section-title-row">
                  <h4 class="form-section-title">Prestador Asignado & Datos de Cobro (CBU)</h4>
                  @if (isCurrentExperienceClub()) {
                    <span class="club-locked-chip">
                      <mat-icon>lock</mat-icon>
                      Vinculado al Perfil del Club
                    </span>
                  }
                </div>

                @if (isCurrentExperienceClub()) {
                  <div class="club-locked-notice">
                    <mat-icon class="locked-info-icon">info</mat-icon>
                    <div class="notice-text">
                      <span>
                        Prestador fijado como <strong>Club de Experiencias</strong>. Los datos de contacto y cobro se sincronizan automáticamente con el Perfil del Club editable por los administradores desde el menú superior.
                      </span>
                      <button type="button" class="btn-text-edit-club" (click)="openClubProfileModal()">
                        Modificar en Perfil del Club &rarr;
                      </button>
                    </div>
                  </div>
                }

                <div class="form-grid-2">
                  <div class="form-field">
                    <label>Nombre / Prestador Asignado:</label>
                    <input
                      type="text"
                      class="form-input"
                      [class.input-locked]="isCurrentExperienceClub()"
                      [disabled]="isCurrentExperienceClub()"
                      [(ngModel)]="editProviderName"
                      placeholder="Ej: Gonzalo Gramaglia o Catamarca Kayak"
                    />
                  </div>

                  <div class="form-field">
                    <label>Teléfono / WhatsApp de Contacto:</label>
                    <input
                      type="tel"
                      class="form-input"
                      [class.input-locked]="isCurrentExperienceClub()"
                      [disabled]="isCurrentExperienceClub()"
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
                      [class.input-locked]="isCurrentExperienceClub()"
                      [disabled]="isCurrentExperienceClub()"
                      [(ngModel)]="editProviderCbuAlias"
                      placeholder="Ej: EXPERIENCIAS.CLUB.MP"
                    />
                  </div>

                  <div class="form-field">
                    <label>CUIT / CUIL:</label>
                    <input
                      type="text"
                      class="form-input"
                      [class.input-locked]="isCurrentExperienceClub()"
                      [disabled]="isCurrentExperienceClub()"
                      [(ngModel)]="editProviderCuitDni"
                      placeholder="Ej: 20-33445566-7"
                    />
                  </div>

                  <div class="form-field">
                    <label>Banco / Entidad:</label>
                    <input
                      type="text"
                      class="form-input"
                      [class.input-locked]="isCurrentExperienceClub()"
                      [disabled]="isCurrentExperienceClub()"
                      [(ngModel)]="editProviderBankName"
                      placeholder="Ej: Banco Nación / Mercado Pago"
                    />
                  </div>
                </div>
              </div>

              <!-- SECCIÓN 5: Multimedia, Video & Portada (con subida a Supabase Storage y Álbum) -->
              <div class="form-section-card">
                <h4 class="form-section-title">5. Multimedia, Video & Portada</h4>
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
                      <label class="album-section-label">Álbum & Galería de Fotos Oficial</label>
                      <span class="field-hint">
                        Configurá las 2 fotos destacadas y hasta 9 fotos para la galería común (máximo 12 fotos totales).
                      </span>
                      <div class="album-counters-bar">
                        <span class="album-counter-pill is-featured-pill">
                          ⭐ Destacadas: <strong>{{ featuredPhotos().length }} / 2</strong>
                        </span>
                        <span
                          class="album-counter-pill is-gallery-pill"
                          [class.is-limit-reached]="galleryPhotos().length >= 9"
                        >
                          🖼️ Galería común: <strong>{{ galleryPhotos().length }} / 9</strong>
                        </span>
                        <span class="album-counter-pill">
                          📷 Total Álbum: <strong>{{ editAlbumPhotos().length }} / 12</strong>
                        </span>
                      </div>
                    </div>

                    <label
                      class="btn-upload-album-file"
                      [class.is-uploading]="uploadingAlbum()"
                      [class.is-disabled]="galleryPhotos().length >= 9"
                      [title]="galleryPhotos().length >= 9 ? 'Límite de 9 fotos de galería común alcanzado' : 'Subir fotos al álbum'"
                    >
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        [disabled]="galleryPhotos().length >= 9"
                        (change)="onUploadAlbumPhotos($event)"
                        style="display: none"
                      />
                      <span>
                        {{
                          uploadingAlbum()
                            ? 'Subiendo...'
                            : galleryPhotos().length >= 9
                              ? 'Límite de Galería (9/9) Alcanzado'
                              : '+ Subir Fotos al Álbum'
                        }}
                      </span>
                    </label>
                  </div>

                  @if (editAlbumPhotos().length > 0) {
                    <div class="album-photos-grid">
                      @for (photo of editAlbumPhotos(); track photo.id; let idx = $index) {
                        <div
                          class="album-photo-item"
                          [class.is-featured-item]="photo.isFeatured"
                          [class.is-cover-item]="photo.isCover"
                        >
                          <div class="photo-badge-overlay">
                            @if (photo.isCover) {
                              <span class="photo-badge badge-cover">Portada</span>
                            }
                            @if (photo.isFeatured) {
                              <span class="photo-badge badge-featured">⭐ Destacada</span>
                            }
                          </div>
                          <img [src]="photo.url" [alt]="photo.caption || 'Foto de álbum'" class="album-thumb" />
                          <div class="album-item-meta">
                            <input
                              type="text"
                              class="album-caption-input"
                              [value]="photo.caption || ''"
                              (input)="updatePhotoCaption(idx, $any($event.target).value)"
                              placeholder="Epígrafe o título..."
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
                          <div class="album-photo-actions">
                            <button
                              type="button"
                              class="btn-photo-action"
                              [class.is-active-featured]="photo.isFeatured"
                              (click)="toggleFeaturedPhoto(idx)"
                              [title]="photo.isFeatured ? 'Quitar condición de destacada' : 'Fijar como foto destacada (máx 2)'"
                            >
                              ⭐ {{ photo.isFeatured ? 'Destacada' : 'Destacar' }}
                            </button>
                            <button
                              type="button"
                              class="btn-photo-action"
                              [class.is-active-cover]="photo.isCover"
                              (click)="setCoverPhoto(idx)"
                              title="Definir como foto de portada principal"
                            >
                              📸 {{ photo.isCover ? 'Portada' : 'Hacer Portada' }}
                            </button>
                          </div>
                        </div>
                      }
                    </div>
                  } @else {
                    <div class="album-empty-placeholder">
                      <span>No hay fotos cargadas en el álbum. Podés subir imágenes para la galería (máximo 9 de galería común y 2 destacadas).</span>
                    </div>
                  }
                </div>
              </div>

              <!-- SECCIÓN 6: Servicios Incluidos & Qué Debes Traer (Orden invertido) -->
              <div class="form-section-card">
                <h4 class="form-section-title">6. Servicios Incluidos & Qué Debes Traer</h4>
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

              <!-- SECCIÓN 7: Estado de Publicación (Sin borrador) -->
              <div class="form-section-card">
                <h4 class="form-section-title">7. Estado de Publicación</h4>
                <div class="form-field">
                  <label>Estado en experiencias.club:</label>
                  <select class="form-select" [(ngModel)]="editStatus">
                    <option value="publicada">Publicada (Visible a todos los exploradores)</option>
                    <option value="oculta">Oculta / Pausada (Dada de baja temporalmente)</option>
                  </select>
                </div>
              </div>
      </ng-template>
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

      /* Edit Page View (Subruta) */
      .edit-page-card {
        background: rgba(18, 10, 5, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        padding: 1.75rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
      }

      .edit-page-body {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .edit-page-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 1rem;
        padding-top: 1.25rem;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        margin-top: 0.5rem;
      }

      .btn-cancel-edit {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.65rem 1.35rem;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.25);
        color: #ffffff;
        border-radius: 3px;
        font-size: 0.85rem;
        font-weight: 700;
        cursor: pointer;
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .btn-cancel-edit:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.5);
      }

      .empty-state-card {
        background: rgba(18, 10, 5, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
      }

      /* Fiche Page View (/experiencias/:slug) */
      .fiche-page-card {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .fiche-admin-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 1rem;
        padding: 1rem 1.25rem;
        background: rgba(18, 10, 5, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 4px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      }

      .topbar-left {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        flex-wrap: wrap;
      }

      .fiche-topbar-breadcrumb {
        font-size: 0.82rem;
        color: rgba(255, 255, 255, 0.65);
      }

      .fiche-topbar-breadcrumb strong {
        color: #ff9955;
      }

      .topbar-actions {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        flex-wrap: wrap;
      }

      .btn-action-edit-orange {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.55rem 1.15rem;
        background: #ff5f00;
        color: #ffffff;
        border: none;
        border-radius: 4px;
        font-size: 0.82rem;
        font-weight: 800;
        text-decoration: none;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 14px rgba(255, 95, 0, 0.35);
        letter-spacing: 0.02em;
      }

      .btn-action-edit-orange:hover {
        background: #ff7722;
        box-shadow: 0 6px 18px rgba(255, 95, 0, 0.5);
        transform: translateY(-1px);
        color: #ffffff;
      }

      .btn-action-public-web {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.52rem 0.95rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: #ffffff;
        font-size: 0.8rem;
        font-weight: 700;
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .btn-action-public-web:hover {
        background: rgba(255, 255, 255, 0.16);
        border-color: rgba(255, 255, 255, 0.4);
        color: #ffffff;
      }

      .btn-pause-exp-top {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.52rem 0.85rem;
        background: rgba(255, 80, 80, 0.16);
        border: 1px solid rgba(255, 80, 80, 0.4);
        border-radius: 4px;
        color: #ff8080;
        font-size: 0.78rem;
        font-weight: 800;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-pause-exp-top:hover {
        background: rgba(255, 80, 80, 0.28);
        border-color: #ff6060;
        color: #ffffff;
      }

      .btn-activate-exp-top {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.52rem 0.85rem;
        background: rgba(0, 204, 136, 0.16);
        border: 1px solid rgba(0, 204, 136, 0.4);
        border-radius: 4px;
        color: #33ffaa;
        font-size: 0.78rem;
        font-weight: 800;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-activate-exp-top:hover {
        background: rgba(0, 204, 136, 0.28);
        border-color: #00cc88;
        color: #ffffff;
      }

      .btn-icon-sm {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      .fiche-body {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .fiche-section-card {
        background: rgba(18, 10, 5, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        padding: 1.75rem;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
      }

      .fiche-section-card.is-club-card {
        border-color: rgba(0, 204, 136, 0.35);
        background: linear-gradient(180deg, rgba(18, 10, 5, 0.98) 0%, rgba(5, 25, 18, 0.7) 100%);
      }

      .hero-fiche-card {
        border-left: 4px solid #ff5f00;
      }

      .hero-kicker-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-bottom: 0.65rem;
      }

      .hero-kicker {
        font-size: 0.76rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #ff9955;
      }

      .hero-badges-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .fiche-hero-title {
        font-size: 1.85rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0 0 0.5rem 0;
        line-height: 1.2;
      }

      .fiche-hero-sub {
        font-size: 1.05rem;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.85);
        margin: 0 0 0.5rem 0;
        line-height: 1.4;
      }

      .fiche-hero-desc {
        font-size: 0.92rem;
        color: rgba(255, 255, 255, 0.7);
        margin: 0;
        line-height: 1.55;
      }

      .fiche-specs-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 0.75rem;
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 4px;
        padding: 0.85rem;
      }

      .spec-tile {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .spec-label {
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        color: rgba(255, 255, 255, 0.5);
        text-transform: uppercase;
      }

      .spec-value {
        font-size: 0.9rem;
        font-weight: 700;
        color: #ffffff;
      }

      .fiche-cover-img-wrap {
        width: 100%;
        max-height: 420px;
        border-radius: 4px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .fiche-cover-img {
        width: 100%;
        height: 100%;
        max-height: 420px;
        object-fit: cover;
        display: block;
      }

      .fiche-media-player-wrap {
        width: 100%;
        max-height: 420px;
        border-radius: 4px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: #000000;
      }

      .fiche-video-element {
        width: 100%;
        max-height: 420px;
        display: block;
      }

      .pricing-fiche-card {
        background: linear-gradient(135deg, rgba(20, 12, 6, 0.98) 0%, rgba(10, 30, 45, 0.8) 100%);
        border: 1px solid rgba(0, 180, 255, 0.3);
      }

      .pricing-card-flex {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 1.25rem;
      }

      .price-data {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      .price-title {
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #00cc88;
      }

      .price-figures {
        display: flex;
        align-items: baseline;
        gap: 0.75rem;
      }

      .ars-price {
        font-size: 2rem;
        font-weight: 900;
        color: #33ffaa;
      }

      .usd-price {
        font-size: 1.15rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.7);
      }

      .price-note {
        font-size: 0.82rem;
        color: rgba(255, 255, 255, 0.65);
      }

      .fiche-dates-section {
        padding-top: 1rem;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
      }

      .fiche-subhead-title {
        font-size: 0.85rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.75);
        margin: 0;
      }

      .dates-chips-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .date-chip-item {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.4rem 0.75rem;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 4px;
        color: #ffffff;
        font-size: 0.82rem;
        font-weight: 600;
      }

      .date-chip-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #ff9955;
      }

      .fiche-card-title {
        font-size: 1.1rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0;
      }

      .provider-info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 0.85rem;
      }

      .info-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .info-label {
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.5);
      }

      .info-value {
        font-size: 0.88rem;
        color: #ffffff;
      }

      .timeline-list {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        position: relative;
        padding-left: 0.5rem;
      }

      .timeline-step {
        display: flex;
        gap: 1.25rem;
        align-items: flex-start;
        position: relative;
      }

      .timeline-time {
        min-width: 85px;
        font-weight: 800;
        font-size: 0.82rem;
        color: #ff9955;
        padding: 0.25rem 0.5rem;
        background: rgba(255, 95, 0, 0.12);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 4px;
        text-align: center;
      }

      .timeline-body {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .timeline-body h4 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 700;
        color: #ffffff;
      }

      .timeline-body p {
        margin: 0;
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.7);
        line-height: 1.45;
      }

      .simple-logistics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 1.25rem;
      }

      .simple-logistics-col {
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 4px;
        padding: 1.15rem;
      }

      .simple-col-title {
        font-size: 0.9rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0 0 0.85rem 0;
      }

      .simple-check-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
      }

      .simple-check-list li {
        font-size: 0.84rem;
        color: rgba(255, 255, 255, 0.8);
        display: flex;
        align-items: center;
        gap: 0.45rem;
      }

      .simple-check-list li::before {
        content: "✓";
        color: #00cc88;
        font-weight: 800;
      }

      .simple-check-list.blue-checks li::before {
        content: "•";
        color: #00b4d8;
        font-size: 1.1rem;
      }

      .meeting-point-desc {
        font-size: 0.95rem;
        color: rgba(255, 255, 255, 0.85);
        margin: 0;
      }

      .location-actions-row {
        display: flex;
        gap: 0.75rem;
      }

      .location-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.55rem 1rem;
        border-radius: 4px;
        font-size: 0.82rem;
        font-weight: 700;
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .location-btn.maps-btn {
        background: rgba(0, 204, 136, 0.18);
        border: 1px solid rgba(0, 204, 136, 0.45);
        color: #33ffaa;
      }

      .location-btn.maps-btn:hover {
        background: rgba(0, 204, 136, 0.3);
        border-color: #00cc88;
        color: #ffffff;
      }

      .fiche-album-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
        gap: 0.75rem;
      }

      .fiche-album-card {
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 4px;
        overflow: hidden;
      }

      .fiche-album-card.is-featured-card {
        border-color: rgba(255, 170, 0, 0.6);
        box-shadow: 0 0 8px rgba(255, 170, 0, 0.2);
      }

      .fiche-album-card.is-cover-card {
        border-color: rgba(0, 204, 136, 0.6);
      }

      .thumb-wrap {
        position: relative;
        width: 100%;
        height: 85px;
      }

      .fiche-album-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .fiche-album-caption {
        display: block;
        padding: 0.35rem 0.45rem;
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.75);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .btn-text-edit-album {
        font-size: 0.78rem;
        color: #ff9955;
        text-decoration: underline;
        font-weight: 700;
        cursor: pointer;
      }

      .btn-text-edit-album:hover {
        color: #ffbb77;
      }

      .fiche-bottom-cta-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 1rem;
        padding: 1.25rem 1.5rem;
        background: rgba(18, 10, 5, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 4px;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
      }

      .cta-bar-left {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .cta-exp-title {
        font-size: 1.05rem;
        font-weight: 800;
        color: #ffffff;
      }

      .cta-exp-route {
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.55);
        font-family: var(--font-mono, monospace);
      }

      .cta-bar-right {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .btn-view-fiche {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.42rem 0.85rem;
        background: rgba(0, 204, 136, 0.16);
        border: 1px solid rgba(0, 204, 136, 0.45);
        border-radius: 4px;
        color: #33ffaa;
        font-size: 0.76rem;
        font-weight: 800;
        text-decoration: none;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-view-fiche:hover {
        background: rgba(0, 204, 136, 0.28);
        border-color: #00cc88;
        color: #ffffff;
      }

      .btn-view-fiche-top {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.5rem 0.9rem;
        background: rgba(0, 204, 136, 0.16);
        border: 1px solid rgba(0, 204, 136, 0.4);
        border-radius: 4px;
        color: #33ffaa;
        font-size: 0.8rem;
        font-weight: 700;
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .btn-view-fiche-top:hover {
        background: rgba(0, 204, 136, 0.28);
        border-color: #00cc88;
        color: #ffffff;
      }

      .top-header-actions {
        display: flex;
        align-items: center;
        gap: 0.65rem;
      }

      .exp-cell-link {
        text-decoration: none;
        cursor: pointer;
        transition: opacity 0.15s ease;
      }

      .exp-cell-link:hover .exp-table-title {
        color: #ff9955;
        text-decoration: underline;
      }

      .action-btn-icon {
        font-size: 15px;
        width: 15px;
        height: 15px;
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
        min-height: 1.35rem;
        line-height: 1.35rem;
        display: flex;
        align-items: flex-end;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
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

      .btn-upload-album-file.is-disabled {
        opacity: 0.5;
        cursor: not-allowed;
        border-color: rgba(255, 255, 255, 0.2);
        color: rgba(255, 255, 255, 0.5);
        background: rgba(255, 255, 255, 0.05);
      }

      .album-counters-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
        margin-top: 0.4rem;
      }

      .album-counter-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.2rem 0.55rem;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 700;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: rgba(255, 255, 255, 0.8);
      }

      .album-counter-pill.is-featured-pill {
        background: rgba(255, 170, 0, 0.12);
        border-color: rgba(255, 170, 0, 0.4);
        color: #ffaa00;
      }

      .album-counter-pill.is-gallery-pill {
        background: rgba(0, 204, 136, 0.12);
        border-color: rgba(0, 204, 136, 0.4);
        color: #00cc88;
      }

      .album-counter-pill.is-limit-reached {
        background: rgba(255, 95, 95, 0.15);
        border-color: rgba(255, 95, 95, 0.4);
        color: #ff7b7b;
      }

      .album-photos-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 0.85rem;
      }

      .album-photo-item {
        position: relative;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 4px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }

      .album-photo-item.is-featured-item {
        border-color: rgba(255, 170, 0, 0.7);
        box-shadow: 0 0 10px rgba(255, 170, 0, 0.2);
      }

      .album-photo-item.is-cover-item {
        border-color: rgba(0, 204, 136, 0.7);
        box-shadow: 0 0 10px rgba(0, 204, 136, 0.2);
      }

      .photo-badge-overlay {
        position: absolute;
        top: 4px;
        left: 4px;
        display: flex;
        flex-direction: column;
        gap: 3px;
        z-index: 2;
      }

      .photo-badge {
        padding: 2px 5px;
        border-radius: 3px;
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }

      .photo-badge.badge-cover {
        background: #00cc88;
        color: #05140d;
      }

      .photo-badge.badge-featured {
        background: #ffaa00;
        color: #1a1002;
      }

      .album-thumb {
        width: 100%;
        height: 90px;
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

      .album-photo-actions {
        display: flex;
        gap: 0.25rem;
        padding: 0.3rem 0.4rem;
        background: rgba(18, 12, 8, 0.95);
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }

      .btn-photo-action {
        flex: 1;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: rgba(255, 255, 255, 0.85);
        font-size: 0.65rem;
        font-weight: 700;
        padding: 0.25rem 0.2rem;
        border-radius: 3px;
        cursor: pointer;
        transition: all 0.15s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.2rem;
        white-space: nowrap;
      }

      .btn-photo-action:hover {
        background: rgba(255, 255, 255, 0.18);
        color: #ffffff;
      }

      .btn-photo-action.is-active-featured {
        background: rgba(255, 170, 0, 0.25);
        border-color: #ffaa00;
        color: #ffaa00;
      }

      .btn-photo-action.is-active-cover {
        background: rgba(0, 204, 136, 0.25);
        border-color: #00cc88;
        color: #00cc88;
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

      .field-header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.35rem;
      }

      .field-header-row label {
        margin-bottom: 0 !important;
      }

      .link-maps-preview {
        color: #00cc88;
        font-size: 0.75rem;
        font-weight: 600;
        text-decoration: underline;
        margin-left: auto;
      }

      .link-maps-preview:hover {
        color: #33ffaa;
      }

      .char-counter {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.55);
        font-weight: 600;
      }

      .char-counter.counter-warn {
        color: #ffaa00;
      }

      .section-subtext {
        color: rgba(255, 255, 255, 0.65);
        font-size: 0.8rem;
        margin: 0 0 0.85rem 0;
        line-height: 1.4;
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

      @media (max-width: 600px) {
        .slug-input-wrap {
          flex-direction: column;
          align-items: stretch;
        }

        .slug-prefix {
          border-right: none;
          border-bottom: 1px solid rgba(255, 95, 0, 0.35);
          font-size: 0.76rem;
          padding: 0.5rem 0.65rem;
          word-break: break-all;
        }
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
        .form-field label {
          white-space: normal;
          min-height: auto;
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

      /* Estilos Experiencia Oficial del Club */
      .exp-title-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .club-official-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.68rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        background: rgba(255, 95, 0, 0.18);
        border: 1px solid rgba(255, 95, 0, 0.45);
        color: #ff9500;
        padding: 0.15rem 0.45rem;
        border-radius: 4px;
        line-height: 1;
      }

      .club-official-chip mat-icon {
        font-size: 13px;
        width: 13px;
        height: 13px;
      }

      .club-experience-banner {
        display: flex;
        align-items: center;
        gap: 1rem;
        background: linear-gradient(135deg, rgba(35, 20, 12, 0.95), rgba(22, 12, 7, 0.95));
        border: 1px solid rgba(255, 149, 0, 0.45);
        border-radius: 8px;
        padding: 1rem 1.25rem;
        margin-bottom: 1.25rem;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
      }

      .club-banner-icon {
        width: 44px;
        height: 44px;
        border-radius: 8px;
        background: rgba(255, 95, 0, 0.18);
        border: 1px solid rgba(255, 95, 0, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ff9500;
        flex-shrink: 0;
      }

      .club-banner-icon mat-icon {
        font-size: 26px;
        width: 26px;
        height: 26px;
      }

      .club-banner-text {
        flex: 1;
      }

      .club-banner-header {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin-bottom: 0.25rem;
        flex-wrap: wrap;
      }

      .club-banner-title {
        font-size: 0.95rem;
        font-weight: 700;
        color: #ffffff;
      }

      .club-banner-badge {
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        background: #ff5f00;
        color: #ffffff;
        padding: 0.15rem 0.5rem;
        border-radius: 3px;
      }

      .club-banner-desc {
        margin: 0;
        font-size: 0.78rem;
        line-height: 1.4;
        color: rgba(255, 255, 255, 0.75);
      }

      .club-banner-desc strong {
        color: #ff9500;
      }

      .btn-edit-club-profile {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        background: rgba(255, 95, 0, 0.15);
        border: 1px solid rgba(255, 95, 0, 0.45);
        color: #ffffff;
        font-size: 0.8rem;
        font-weight: 600;
        padding: 0.55rem 0.95rem;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s ease;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .btn-edit-club-profile:hover {
        background: #ff5f00;
        color: #ffffff;
        box-shadow: 0 4px 14px rgba(255, 95, 0, 0.35);
      }

      .btn-edit-club-profile mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      .section-title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75rem;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .section-title-row .form-section-title {
        margin-bottom: 0;
      }

      .club-locked-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.72rem;
        font-weight: 700;
        color: #ff9500;
        background: rgba(255, 95, 0, 0.12);
        border: 1px solid rgba(255, 95, 0, 0.35);
        padding: 0.2rem 0.55rem;
        border-radius: 4px;
      }

      .club-locked-chip mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }

      .club-locked-notice {
        display: flex;
        align-items: flex-start;
        gap: 0.65rem;
        background: rgba(255, 149, 0, 0.08);
        border: 1px solid rgba(255, 149, 0, 0.25);
        border-radius: 5px;
        padding: 0.65rem 0.85rem;
        margin-bottom: 1rem;
      }

      .locked-info-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #ff9500;
        flex-shrink: 0;
        margin-top: 0.1rem;
      }

      .notice-text {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.8);
        line-height: 1.4;
      }

      .notice-text strong {
        color: #ffffff;
      }

      .btn-text-edit-club {
        align-self: flex-start;
        background: none;
        border: none;
        padding: 0;
        color: #ff9500;
        font-size: 0.76rem;
        font-weight: 700;
        cursor: pointer;
        text-decoration: underline;
        transition: color 0.15s ease;
      }

      .btn-text-edit-club:hover {
        color: #ffa726;
      }

      .input-locked,
      .input-locked:disabled {
        opacity: 0.75 !important;
        cursor: not-allowed !important;
        background: rgba(20, 12, 8, 0.7) !important;
        border-color: rgba(255, 149, 0, 0.25) !important;
        color: rgba(255, 255, 255, 0.85) !important;
      }

      @media (max-width: 640px) {
        .club-experience-banner {
          flex-direction: column;
          align-items: flex-start;
        }
        .btn-edit-club-profile {
          width: 100%;
          justify-content: center;
        }
      }
    `,
  ],
})
export class AdminExperiencesComponent implements OnInit {
  private readonly experienceService = inject(ExperienceService);
  private readonly storageService = inject(StorageService);
  readonly adminStore = inject(AdminStoreService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  isClub(exp?: Partial<Experience> | null): boolean {
    return isClubExperience(exp);
  }

  readonly isCurrentExperienceClub = computed(() => {
    return isClubExperience(this.editingExperience());
  });

  openClubProfileModal(): void {
    this.adminStore.openClubProfileModal();
  }

  readonly experiences = this.experienceService.experiences;
  readonly feedbackToast = signal<string | null>(null);
  readonly saving = signal(false);

  readonly isRouteEditMode = signal(false);
  readonly isRouteDetailMode = signal(false);
  readonly notFound = signal(false);
  readonly currentUrl = signal(this.router.url);

  private readonly isAdminRoute = computed(() => {
    const rawPath = this.currentUrl().split('?')[0].split('#')[0];
    const segments = rawPath.split('/').filter(Boolean);
    return segments[0] === 'admin';
  });

  readonly backToListLink = computed(() => {
    return this.isAdminRoute() ? '/admin/experiencias' : '/experiencias';
  });

  getDetailRoute(exp: Experience | { slug?: string }): string {
    const base = this.isAdminRoute() ? '/admin/experiencias' : '/experiencias';
    return `${base}/${exp.slug || ''}`;
  }

  getEditRoute(exp: Experience | { slug?: string }): string {
    const base = this.isAdminRoute() ? '/admin/experiencias' : '/experiencias';
    return `${base}/${exp.slug || ''}/editar`;
  }

  getGoogleMapsUrl(meetingPoint?: string, region?: string, customUrl?: string): string {
    if (customUrl && customUrl.trim()) {
      return customUrl.trim();
    }
    if (meetingPoint && (meetingPoint.startsWith('http://') || meetingPoint.startsWith('https://'))) {
      return meetingPoint;
    }
    const query = encodeURIComponent(`${meetingPoint || ''} ${region || 'Catamarca'}`.trim());
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  readonly upcomingDates = computed<string[]>(() => {
    const e = this.editingExperience();
    if (!e || !e.dates) return [];
    return e.dates;
  });

  readonly detailFeaturedPhotos = computed(() => {
    const e = this.editingExperience();
    if (!e?.albumPhotos) return [];
    return e.albumPhotos.filter((p) => p.isFeatured);
  });

  readonly detailGalleryPhotos = computed(() => {
    const e = this.editingExperience();
    if (!e?.albumPhotos) return [];
    return e.albumPhotos.filter((p) => !p.isFeatured && !p.isCover);
  });

  readonly itinerarySteps = computed<{ time: string; title: string; description: string }[]>(() => {
    const e = this.editingExperience();
    if (!e) return [];

    if (e.slug === 'campo-de-piedra-pomez') {
      return [
        {
          time: '08:30 hs',
          title: 'Punto de Encuentro & Partida 4x4',
          description:
            'Recepción en la Plaza Principal de El Peñón. Chequeo de equipamiento, hidratación y partida en vehículos 4x4 hacia la alta cordillera.',
        },
        {
          time: '10:30 hs',
          title: 'Laguna Blanca & Reserva de Biosfera',
          description:
            'Travesía por la estepa altoandina con avistaje de vicuñas silvestres y parada técnica de aclimatación a más de 3.000 msnm.',
        },
        {
          time: '13:00 hs',
          title: 'Ingreso al Campo de Piedra Pómez',
          description:
            'Caminata guiada e interpretación geomorfológica entre las gigantescas formaciones esculpidas de piedra pómez y médanos blancos.',
        },
        {
          time: '16:30 hs',
          title: 'Merienda de Altura & Regreso',
          description:
            'Pausa con productos regionales catamarqueños y regreso panorámico hacia el punto de partida en El Peñón.',
        },
      ];
    }

    if (e.slug === 'kayak') {
      return [
        {
          time: '15:30 hs',
          title: 'Recepción & Charla de Seguridad Lacustre',
          description:
            'Punto de encuentro en el Club Náutico Dique El Jumeal. Asignación de chalecos salvavidas, ajuste de remos ergonómicos y briefing de técnica básica de remada en aguas mansas.',
        },
        {
          time: '16:15 hs',
          title: 'Zarpada & Exploración de Bahías',
          description:
            'Navegación guiada ingresando por ensenadas y paredones de roca rojiza inaccesibles por tierra. Avistaje de fauna acuática y vegetación de yungas andinas.',
        },
        {
          time: '18:15 hs',
          title: 'Pausa Sunset en Bahía Tranquila',
          description:
            'Agrupamiento de embarcaciones en aguas calmas para contemplar la caída del sol reflejada en el dique y las Sierras de Ambato.',
        },
        {
          time: '19:00 hs',
          title: 'Desembarco & Brindis con Sabores Catamarqueños',
          description:
            'Regreso al club náutico, entrega de equipos y cierre gastronómico con degustación de productos artesanales locales.',
        },
      ];
    }

    if (e.itinerary && e.itinerary.trim()) {
      const lines = e.itinerary
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length > 0) {
        return lines.map((line, idx) => {
          const matchTime = line.match(/^(\d{1,2}:\d{2}(?:\s*hs)?)(?:\s*[-–:]\s*|\s+)(.*)$/i);
          if (matchTime) {
            const time = matchTime[1];
            const rest = matchTime[2];
            const parts = rest.split(/\s+[-–]\s+|\s*:\s+/);
            const title = parts[0] || `Etapa ${idx + 1}`;
            const description = parts.slice(1).join(' - ') || parts[0];
            return { time, title, description };
          }
          const parts = line.split(/\s+[-–]\s+|\s*:\s+/);
          if (parts.length > 1) {
            return {
              time: `Etapa ${idx + 1}`,
              title: parts[0],
              description: parts.slice(1).join(' - '),
            };
          }
          return {
            time: `Etapa ${idx + 1}`,
            title: line,
            description: line,
          };
        });
      }
    }

    return [];
  });

  async ngOnInit(): Promise<void> {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        const url = event.urlAfterRedirects || event.url;
        this.currentUrl.set(url);
        void this.syncRouteState(url);
      });

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async (params) => {
        await this.syncRouteState(this.router.url, params.get('slug'));
      });
  }

  private async syncRouteState(url: string, slugParam?: string | null): Promise<void> {
    const rawPath = url.split('?')[0].split('#')[0];
    const isEdit = rawPath.endsWith('/editar');
    const slug = slugParam !== undefined ? slugParam : this.route.snapshot.paramMap.get('slug');

    if (slug) {
      this.notFound.set(false);
      await this.experienceService.remoteLoadPromise;
      const currentSlug = this.route.snapshot.paramMap.get('slug');
      if (currentSlug && currentSlug !== slug) {
        return;
      }
      const exp =
        this.experienceService.getExperienceBySlug(slug) ||
        this.experienceService.getExperienceById(slug);

      if (exp) {
        this.editingExperience.set(exp);
        this.openEditModal(exp);
        if (isEdit) {
          this.isRouteEditMode.set(true);
          this.isRouteDetailMode.set(false);
        } else {
          this.isRouteEditMode.set(false);
          this.isRouteDetailMode.set(true);
        }
      } else {
        this.notFound.set(true);
        this.isRouteEditMode.set(false);
        this.isRouteDetailMode.set(false);
      }
    } else {
      this.isRouteEditMode.set(false);
      this.isRouteDetailMode.set(false);
      this.notFound.set(false);
      if (!this.isCreating()) {
        this.editingExperience.set(null);
      }
    }
  }

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

  readonly featuredPhotos = computed(() => this.editAlbumPhotos().filter((p) => p.isFeatured));
  readonly galleryPhotos = computed(() =>
    this.editAlbumPhotos().filter((p) => !p.isFeatured && !p.isCover),
  );
  readonly coverPhoto = computed(() => this.editAlbumPhotos().find((p) => p.isCover));

  isValidGoogleMapsUrl(url?: string): boolean {
    if (!url) return false;
    const trimmed = url.trim().toLowerCase();
    return (
      trimmed.startsWith('https://maps.app.goo.gl/') ||
      trimmed.startsWith('http://maps.app.goo.gl/') ||
      trimmed.startsWith('https://goo.gl/maps/') ||
      trimmed.startsWith('http://goo.gl/maps/') ||
      trimmed.startsWith('https://www.google.com/maps') ||
      trimmed.startsWith('https://google.com/maps') ||
      trimmed.startsWith('http://www.google.com/maps') ||
      trimmed.startsWith('http://google.com/maps') ||
      trimmed.includes('maps.google.')
    );
  }

  // Form Fields
  readonly editId = signal('');
  readonly editSlug = signal('');
  readonly editTitle = signal('');
  readonly editTagline = signal('');
  readonly editDescription = signal('');
  readonly editRegion = signal('');
  readonly editMeetingPoint = signal('');
  readonly editMeetingPointUrl = signal('');
  readonly editItinerary = signal('');
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
    this.editMeetingPointUrl.set(exp.meetingPointUrl || '');
    this.editItinerary.set(exp.itinerary || '');
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

    if (this.isClub(exp)) {
      const club = this.adminStore.clubProfile();
      this.editProviderName.set(club.name || 'Club de Experiencias');
      this.editProviderPhone.set(club.phone || '');
      this.editProviderCbuAlias.set(club.cbuAlias || '');
      this.editProviderCuitDni.set(club.cuitDni || '');
      this.editProviderBankName.set(club.bankName || '');
    } else {
      this.editProviderName.set(exp.providerName || '');
      this.editProviderPhone.set(exp.providerPhone || '');
      this.editProviderCbuAlias.set(exp.providerCbuAlias || '');
      this.editProviderCuitDni.set(exp.providerCuitDni || '');
      this.editProviderBankName.set(exp.providerBankName || '');
    }
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
    this.editMeetingPointUrl.set('');
    this.editItinerary.set('');
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
    const currentExp = this.editingExperience();
    this.editingExperience.set(null);
    this.isCreating.set(false);
    if (this.isRouteEditMode()) {
      if (currentExp?.slug) {
        this.router.navigateByUrl(this.getDetailRoute(currentExp));
      } else {
        this.router.navigateByUrl(this.backToListLink());
      }
    }
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

    const currentGalleryCount = this.galleryPhotos().length;
    const remainingGallerySlots = 9 - currentGalleryCount;

    if (remainingGallerySlots <= 0) {
      this.showToast('⚠️ La galería común ya alcanzó el límite máximo de 9 fotos.');
      input.value = '';
      return;
    }

    let filesToUpload = files;
    if (files.length > remainingGallerySlots) {
      filesToUpload = files.slice(0, remainingGallerySlots);
      this.showToast(
        `ℹ️ Se seleccionaron ${files.length} fotos. Solo se subirán las primeras ${remainingGallerySlots} para respetar el límite de 9 de galería.`,
      );
    }

    this.uploadingAlbum.set(true);
    try {
      const slug = this.editSlug() || 'exp';
      const newPhotos: ExperienceAlbumPhoto[] = [];
      for (const file of filesToUpload) {
        const res = await this.storageService.uploadFile(file, `ALBUM-${slug}`);
        newPhotos.push({
          id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          url: res.url,
          caption: '',
          isCover: false,
          isFeatured: false,
          order: this.editAlbumPhotos().length + newPhotos.length + 1,
        });
      }
      this.editAlbumPhotos.update((current) => [...current, ...newPhotos]);
      this.showToast(`✅ ${newPhotos.length} foto(s) agregada(s) a la galería`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al subir fotos';
      this.showToast(`❌ ${msg}`);
    } finally {
      this.uploadingAlbum.set(false);
      input.value = '';
    }
  }

  toggleFeaturedPhoto(index: number): void {
    const photo = this.editAlbumPhotos()[index];
    if (!photo) return;

    if (photo.isFeatured) {
      if (this.galleryPhotos().length >= 9) {
        this.showToast('⚠️ No se puede desmarcar: la galería común ya tiene el límite máximo de 9 fotos.');
        return;
      }
      this.editAlbumPhotos.update((photos) =>
        photos.map((p, i) => (i === index ? { ...p, isFeatured: false } : p)),
      );
      this.showToast('ℹ️ Foto desmarcada como destacada.');
      return;
    }

    if (photo.isCover) {
      this.showToast('⚠️ La foto de portada no puede ser destacada simultáneamente.');
      return;
    }

    if (this.featuredPhotos().length >= 2) {
      this.showToast('⚠️ Ya tenés 2 fotos seleccionadas como destacadas. Desmarcá una primero.');
      return;
    }

    this.editAlbumPhotos.update((photos) =>
      photos.map((p, i) => (i === index ? { ...p, isFeatured: true } : p)),
    );
    this.showToast('⭐ Foto marcada como destacada (máx 2).');
  }

  setCoverPhoto(index: number): void {
    const photo = this.editAlbumPhotos()[index];
    if (!photo) return;

    const prevCover = this.coverPhoto();
    const wouldIncreaseGallery = Boolean(prevCover && prevCover !== photo && photo.isFeatured);
    if (wouldIncreaseGallery && this.galleryPhotos().length >= 9) {
      this.showToast('⚠️ No se puede asignar como portada: la foto anterior pasaría a la galería y se superaría el límite de 9 fotos.');
      return;
    }

    this.editAlbumPhotos.update((photos) =>
      photos.map((p, i) => {
        if (i === index) {
          return { ...p, isCover: true, isFeatured: false };
        }
        return { ...p, isCover: false };
      }),
    );
    this.editCoverImage.set(photo.url);
    this.showToast('📸 Foto fijada como Portada Principal.');
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
    const photo = this.editAlbumPhotos()[index];
    this.editAlbumPhotos.update((photos) => photos.filter((_, i) => i !== index));
    if (photo?.isCover) {
      const remaining = this.editAlbumPhotos();
      if (remaining.length > 0) {
        this.setCoverPhoto(0);
      } else {
        this.editCoverImage.set('');
      }
    }
    this.showToast('🗑️ Foto eliminada del álbum.');
  }

  async saveExperience(): Promise<void> {
    const title = this.editTitle().trim();
    if (!title) {
      this.showToast('⚠️ Por favor ingresá un título para la experiencia.');
      return;
    }

    const rawSlug = this.editSlug().trim() || title;
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

    const isClub = this.isCurrentExperienceClub();
    const club = this.adminStore.clubProfile();
    const resolvedProviderName = isClub ? (club.name || 'Club de Experiencias') : this.editProviderName().trim();
    const resolvedProviderPhone = isClub ? (club.phone || '') : this.editProviderPhone().trim();
    const resolvedProviderCbu = isClub ? (club.cbuAlias || '') : this.editProviderCbuAlias().trim();
    const resolvedProviderCuit = isClub ? (club.cuitDni || '') : this.editProviderCuitDni().trim();
    const resolvedProviderBank = isClub ? (club.bankName || '') : this.editProviderBankName().trim();
    const resolvedProviderSlug = isClub ? 'club-de-experiencias' : (this.editingExperience()?.providerSlug || undefined);
    const resolvedProviderEmail = isClub ? (club.email || 'admin@experiencias.club') : (this.editingExperience()?.providerEmail || undefined);

    const payload: Partial<Experience> & { id: string } = {
      id: this.editId(),
      slug,
      title,
      shortTitle: title,
      tagline: this.editTagline().trim(),
      description: this.editDescription().trim(),
      region: this.editRegion().trim() || 'Catamarca',
      meetingPoint: this.editMeetingPoint().trim(),
      meetingPointUrl: this.editMeetingPointUrl().trim() || undefined,
      itinerary: this.editItinerary().trim() || undefined,
      difficulty: this.editDifficulty(),
      durationLabel: this.editDurationLabel().trim() || '4 Horas',
      altitudeMeters: Number(this.editAltitude()) || 0,
      maxSpotsPerGroup: Number(this.editCapacity()) || 12,
      priceArs,
      priceUsd,
      coverImage: this.editCoverImage().trim() || '/assets/images/kayak-club-de-experiencias.jpg',
      albumPhotos: this.editAlbumPhotos(),
      galleryImages:
        this.editAlbumPhotos().length > 0
          ? this.editAlbumPhotos().map((p) => p.url)
          : [this.editCoverImage().trim() || '/assets/images/kayak-club-de-experiencias.jpg'],
      providerName: resolvedProviderName,
      providerPhone: resolvedProviderPhone,
      providerCbuAlias: resolvedProviderCbu,
      providerCuitDni: resolvedProviderCuit,
      providerBankName: resolvedProviderBank,
      ...(isClub
        ? {
            providerSlug: resolvedProviderSlug,
            providerEmail: resolvedProviderEmail,
            isClubExperience: true,
          }
        : {}),
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
          kicker: '',
          bestSeason: '',
          durationDays: 1,
          galleryImages: payload.galleryImages || [payload.coverImage!],
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
      if (this.isRouteEditMode()) {
        this.router.navigateByUrl(this.getDetailRoute({ slug } as Experience));
      } else {
        this.closeEditModal();
      }
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
      const updated = this.experienceService.getExperienceById(exp.id);
      if (updated && this.editingExperience()?.id === exp.id) {
        this.editingExperience.set(updated);
      }
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
