import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { filter } from 'rxjs';
import { ExperienceService, RESERVED_EXPERIENCE_SLUGS } from '../../../core/services/experience.service';
import { StorageService } from '../../../core/services/storage.service';
import { AdminStoreService } from '../../../core/services/admin-store.service';
import { ExperienceProposalRequest, parseConfirmedProposalDates, slugify } from '../../../core/services/provider-store.service';
import { ALTITUDE_OPTIONS, EXPERIENCE_CATEGORY_OPTIONS, EXPERIENCE_DURATION_OPTIONS, Experience, ExperienceAlbumPhoto, ExperiencePricingPack } from '../../../core/models/experience.model';
import {
  ExperienceFormComponent,
  ExperienceFormPayload,
} from '../../../shared/components/experience-form/experience-form.component';
import { ProviderExperience, ProviderUser } from '../../../core/models/bank-transfer.model';
import { isClubExperience } from '../../../core/models/club-profile.model';
import { ArsPipe, FechaPipe } from '../../../shared/pipes/format.pipes';
import {
  exportExperiencesToCsv,
  getPublicExperienceUrl,
} from '../../../shared/utils/csv.util';
import { SUPABASE_CLIENT, isSupabaseConfigured } from '../../../core/supabase/supabase.client';

export type ExperienceTab = 'all' | 'publicadas' | 'postulaciones' | 'ocultas' | 'borradores';

export interface ExperienceFavoritedMember {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  tier: string;
  memberNumber?: string | number | null;
  favoritedAt?: string;
}

@Component({
  selector: 'app-admin-experiences',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatIconModule, ArsPipe, FechaPipe, ExperienceFormComponent],
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
      } @else if ((isRouteEditMode() || isRouteCreateMode()) && editingExperience(); as exp) {
        <!-- Modo Edición / Creación en Subruta: /experiencias/:slug/editar o /experiencias/nueva -->
        <div class="edit-page-card">
          <div class="admin-page-header">
            <div class="header-titles">
              <span class="section-kicker">GESTIÓN DE CATÁLOGO & RUTAS WEB</span>
              <div class="title-row">
                <h1 class="card-heading">{{ isRouteCreateMode() ? 'Crear Nueva Experiencia' : ('Editar Experiencia: ' + editTitle()) }}</h1>
              </div>
              <p class="card-subheading">
                {{ isRouteCreateMode()
                  ? 'Como administrador, podés cargar una nueva experiencia oficial para el catálogo de experiencias.club definiendo su slug, tarifas, cupos y contenidos.'
                  : 'Como administrador, podés actualizar el slug de publicación oficial, tarifas, cupos y contenidos de la experiencia.' }}
              </p>
            </div>
          </div>

          <div class="edit-page-body">
            <app-experience-form
              [mode]="'admin'"
              [initialExperience]="initialExperience()"
              [isCreateMode]="isRouteCreateMode()"
              [isClubExperience]="isCurrentExperienceClub()"
              [clubConfigRoute]="getConfigRoute()"
              [providerMpInfo]="currentAdminMpInfo()"
              [registeredProviders]="registeredProviders()"
              [clubProfile]="adminStore.clubProfile()"
              [usdExchangeRate]="usdExchangeRate()"
              [saving]="saving()"
              [cancelRoute]="isRouteCreateMode() ? backToListLink() : getDetailRoute(exp)"
              (providerChange)="onAdminProviderChange($event)"
              (saveExperience)="onSaveAdminExperience($event)"
              (cancel)="onCancelAdminEdit()"
            />
          </div>
        </div>
      } @else if (isRouteDetailMode() && editingExperience(); as exp) {
        <!-- Modo Ficha de la Experiencia: /experiencias/:slug (Punto intermedio) -->
        <div class="fiche-page-card">
          <!-- Contenido de la Ficha (Estilo Web Pública) -->
          <div class="fiche-body">
            <!-- 1. HERO CARD: Título, Kicker, Bajada y Badges Oficiales -->
            <div class="fiche-section-card hero-fiche-card" [class.is-club-card]="isClub(exp)">
              <div class="fiche-hero-header">
                <div class="hero-kicker-row">
                  <span class="hero-kicker">{{ exp.kicker || 'EXPEDICIÓN OFICIAL DEL CLUB' }}</span>
                  <div class="hero-badges-row">
                    <a
                      [href]="getPublicExperienceUrl(exp)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn-hero-public-web"
                      title="Ver cómo se visualiza actualmente en la web pública"
                    >
                      <mat-icon class="btn-icon-sm">open_in_new</mat-icon>
                      <span>Ver en la Web</span>
                    </a>
                    @if (exp.status === 'publicada') {
                      <button
                        type="button"
                        class="status-pill is-published is-clickable"
                        (click)="toggleStatus(exp, 'oculta')"
                        title="Click para pausar esta experiencia"
                      >
                        Publicada
                      </button>
                    } @else if (exp.status === 'pendiente') {
                      <button
                        type="button"
                        class="status-pill is-pending is-clickable"
                        [disabled]="isProposalProcessing(exp.id)"
                        (click)="approveProposal(exp)"
                        title="Click para aprobar esta nueva experiencia y publicarla"
                      >
                        Postulación
                      </button>
                    } @else if (exp.status === 'borrador' || !exp.status) {
                      <button
                        type="button"
                        class="status-pill is-draft is-clickable"
                        (click)="toggleStatus(exp, 'publicada')"
                        title="Click para aprobar nueva experiencia y publicarla"
                      >
                        Borrador
                      </button>
                    } @else {
                      <button
                        type="button"
                        class="status-pill is-hidden is-clickable"
                        (click)="toggleStatus(exp, 'publicada')"
                        title="Click para activar y publicar esta experiencia"
                      >
                        {{ exp.status === 'rechazada' ? 'Rechazada' : 'Pausada' }}
                      </button>
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
                  <span class="spec-label">{{ isLodging() ? 'ACCESIBILIDAD / PERFIL' : 'DIFICULTAD' }}</span>
                  <span class="spec-value">{{ isLodging() ? 'Accesible / Familiar' : exp.difficulty }}</span>
                </div>
                <div class="spec-tile">
                  <span class="spec-label">{{ isLodging() ? 'ESTADÍA MÍNIMA' : 'DURACIÓN' }}</span>
                  <span class="spec-value">{{ exp.durationLabel }}</span>
                </div>
                <div class="spec-tile">
                  <span class="spec-label">ALTITUD</span>
                  <span class="spec-value">{{ exp.altitudeMeters > 0 ? (exp.altitudeMeters + ' msnm') : 'N/A' }}</span>
                </div>
                <div class="spec-tile">
                  <span class="spec-label">{{ isLodging() ? 'CAPACIDAD MÁXIMA' : 'CUPO MÁXIMO' }}</span>
                  <span class="spec-value">{{ exp.maxSpotsPerGroup }} {{ isLodging() ? (exp.maxSpotsPerGroup === 1 ? 'huésped' : 'huéspedes') : 'personas' }}</span>
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
            <div class="fiche-section-card pricing-fiche-card" [class.is-club-card]="isClub(exp)">
              <div class="pricing-card-flex">
                <div class="price-data">
                  <span class="price-title">ARANCEL OFICIAL DE PUBLICACIÓN</span>
                  <div class="price-figures">
                    <span class="ars-price">{{ exp.priceArs | ars }}</span>
                    @if (exp.priceUsd) {
                      <span class="usd-price">USD {{ exp.priceUsd }}</span>
                    }
                  </div>
                  <span class="price-note">
                    {{ exp.promosAndPricing || 'Prioridad y aranceles especiales para socios de nuestro Club de Experiencias.' }}
                  </span>
                </div>
              </div>

              @if (upcomingDates().length > 0) {
                <div class="fiche-dates-section">
                  <h4 class="fiche-subhead-title">Fechas de Salida Programadas</h4>
                  <div class="dates-chips-grid">
                    @for (d of upcomingDates(); track d) {
                      <div class="date-chip-item">
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

            <!-- 3.1 COBROS CON MERCADO PAGO -->
            <div class="fiche-section-card" [class.is-club-card]="isClub(exp)">
              <div class="section-title-row">
                <h3 class="fiche-card-title">Cobros con Mercado Pago (Acreditación Instantánea)</h3>
                @if (getExpMpConnected(exp)) {
                  <span class="mp-status-pill connected">
                    Cuenta Vinculada
                  </span>
                } @else {
                  <span class="mp-status-pill disconnected">
                    No Vinculada
                  </span>
                }
              </div>

              <div class="provider-info-grid">
                <div class="info-item">
                  <span class="info-label">ESTADO DE INTEGRACIÓN</span>
                  <strong class="info-value" [class.text-green]="getExpMpConnected(exp)">
                    {{ getExpMpConnected(exp) ? 'Habilitada y activa en checkout' : 'Deshabilitada (Solo CBU)' }}
                  </strong>
                </div>
                <div class="info-item">
                  <span class="info-label">ID DE COBRADOR (COLLECTOR ID)</span>
                  <span class="info-value">
                    @if (getExpMpCollectorId(exp)) {
                      <code class="mp-code-badge">{{ getExpMpCollectorId(exp) }}</code>
                    } @else {
                      <span class="text-muted">No asignado</span>
                    }
                  </span>
                </div>
                <div class="info-item">
                  <span class="info-label">TITULAR REGISTRADO</span>
                  <span class="info-value">{{ getExpMpNickname(exp) || '—' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">DESTINO DE FONDOS</span>
                  <span class="info-value">{{ getExpMpConnected(exp) ? (isClub(exp) ? 'Acreditación instantánea a la cuenta oficial del Club' : 'Acreditación instantánea a la cuenta del prestador') : 'Transferencia bancaria directa por CBU' }}</span>
                </div>
              </div>
            </div>

            <!-- 3.2 SOCIOS QUE GUARDARON EN FAVORITOS (ME GUSTA) -->
            <div class="fiche-section-card" [class.is-club-card]="isClub(exp)">
              <div class="section-title-row">
                <div class="favorites-title-wrap">
                  <div class="title-with-icon">
                    <span class="material-icons-outlined card-header-icon" style="color: #ff4081;">favorite</span>
                    <h3 class="fiche-card-title">Socios que Guardaron en Favoritos</h3>
                  </div>
                  <p class="section-subtext">
                    Nómina de socios activos y registrados que han agregado esta experiencia a sus me gusta en la plataforma.
                  </p>
                </div>
                <div class="favorites-header-actions">
                  <span class="favorites-count-badge" [class.has-favorites]="detailFavoritedMembers().length > 0">
                    <span class="material-icons-outlined count-icon">favorite</span>
                    {{ detailFavoritedMembers().length }} {{ detailFavoritedMembers().length === 1 ? 'me gusta' : 'me gustas' }}
                  </span>
                </div>
              </div>

              @if (isLoadingDetailFavorites()) {
                <div class="favorites-loading-placeholder">
                  <span class="loading-spinner-sm"></span>
                  <span>Consultando registros de favoritos en la base de datos...</span>
                </div>
              } @else if (detailFavoritesError()) {
                <div class="favorites-error-placeholder">
                  <span class="material-icons-outlined error-fav-icon">error_outline</span>
                  <div class="error-fav-texts">
                    <strong>Error al cargar favoritos</strong>
                    <p>{{ detailFavoritesError() }}</p>
                  </div>
                  <button
                    type="button"
                    class="btn-retry-favorites"
                    (click)="loadExperienceFavorites(editingExperience())"
                  >
                    <span class="material-icons-outlined">refresh</span>
                    Reintentar
                  </button>
                </div>
              } @else if (detailFavoritedMembers().length > 0) {
                <div class="favorited-members-table-wrap">
                  <table class="favorited-members-table">
                    <thead>
                      <tr>
                        <th>Socio</th>
                        <th>N° Socio / Categoría</th>
                        <th>Contacto</th>
                        <th>Fecha de Favorito</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (member of detailFavoritedMembers(); track member.id || member.email) {
                        <tr>
                          <td class="col-socio">
                            <div class="socio-profile-cell">
                              @if (member.avatar) {
                                <img [src]="member.avatar" alt="Avatar" class="socio-avatar-img" />
                              } @else {
                                <div class="socio-avatar-fallback">
                                  {{ member.name.charAt(0).toUpperCase() }}
                                </div>
                              }
                              <div class="socio-names-wrap">
                                <span class="socio-display-name">{{ member.name }}</span>
                                <span class="socio-email-subtext">{{ member.email }}</span>
                              </div>
                            </div>
                          </td>
                          <td class="col-tier">
                            <div class="tier-pill-wrap">
                              <span class="socio-tier-pill" [class]="'tier-' + member.tier.toLowerCase()">
                                {{ member.tier | uppercase }}
                              </span>
                              @if (member.memberNumber) {
                                <span class="socio-number-tag">#{{ member.memberNumber }}</span>
                              }
                            </div>
                          </td>
                          <td class="col-contact">
                            <div class="contact-cell-wrap">
                              @if (member.phone) {
                                <a [href]="getWhatsappLink(member.phone, member.name)" target="_blank" rel="noopener noreferrer" class="contact-link whatsapp" title="Escribir por WhatsApp">
                                  <span class="material-icons-outlined contact-icon">chat</span>
                                  {{ member.phone }}
                                </a>
                              } @else {
                                <span class="text-muted">—</span>
                              }
                            </div>
                          </td>
                          <td class="col-date">
                            <span class="favorited-date-text">
                              {{ member.favoritedAt ? (member.favoritedAt | date:'dd/MM/yyyy HH:mm') : '—' }}
                            </span>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <div class="favorites-empty-placeholder">
                  <span class="material-icons-outlined empty-fav-icon">favorite_border</span>
                  <div class="empty-fav-texts">
                    <strong>Sin me gustas registrados</strong>
                    <p>Ningún socio ha guardado esta experiencia en favoritos todavía en la base de datos (0 registros en experiencias_favoritas).</p>
                  </div>
                </div>
              }
            </div>

            <!-- 4. CRONOGRAMA E ITINERARIO DE LA JORNADA -->
            <div class="fiche-section-card" [class.is-club-card]="isClub(exp)">
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
                        @if (step.description && step.description !== step.title) {
                          <p>{{ step.description }}</p>
                        }
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

            <!-- 5. DETALLES DE LA EXPERIENCIA -->
            @if ((exp.included && exp.included.length > 0) || (exp.highlights && exp.highlights.length > 0)) {
              <div class="fiche-section-card" [class.is-club-card]="isClub(exp)">
                <h3 class="fiche-card-title">Detalles de la Experiencia</h3>
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
            <div class="fiche-section-card" [class.is-club-card]="isClub(exp)">
              <h3 class="fiche-card-title">{{ isLodging() ? 'Ubicación & Acceso al Alojamiento' : 'Logística & Punto de Encuentro' }}</h3>
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
                    <span>Abrir en Google Maps</span>
                  </a>
                </div>
              }
            </div>

            <!-- 7. ÁLBUM & GALERÍA DE FOTOS -->
            @if (exp.albumPhotos && exp.albumPhotos.length > 0) {
              <div class="fiche-section-card" [class.is-club-card]="isClub(exp)">
                <div class="section-title-row">
                  <div>
                    <h3 class="fiche-card-title">Álbum Oficial</h3>
                    <p class="section-subtext">
                      {{ exp.albumPhotos.length }} fotos cargadas ({{ detailFeaturedPhotos().length }} destacadas, {{ detailGalleryPhotos().length }} en la galería).
                    </p>
                  </div>
                </div>

                <div class="fiche-album-grid">
                  @for (photo of exp.albumPhotos; track photo.id) {
                    <div class="fiche-album-card" [class.is-featured-card]="photo.isFeatured" [class.is-cover-card]="photo.isCover">
                      <div class="thumb-wrap">
                        <img [src]="photo.url" [alt]="photo.caption || photo.title || 'Foto de álbum'" class="fiche-album-img" />
                        <div class="photo-badge-overlay">
                          @if (photo.isCover) {
                            <span class="photo-badge badge-cover">Portada</span>
                          }
                          @if (photo.isFeatured) {
                            <span class="photo-badge badge-featured">Destacada</span>
                          }
                        </div>
                      </div>
                      @if (photo.caption || photo.title) {
                        <span class="fiche-album-caption">{{ photo.caption || photo.title }}</span>
                      }
                    </div>
                  }
                </div>
              </div>
            }

            <!-- 8. PIE DE ACCIONES: Volver, Pausar/Activar, Editar -->
            <div class="fiche-bottom-cta-bar" [class.is-club-card]="isClub(exp)">
              <div class="cta-bar-left">
                <span class="cta-exp-title">{{ exp.title }}</span>
                @if (exp.slug) {
                  <a
                    [href]="getPublicExperienceUrl(exp)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="cta-exp-route"
                    title="Abrir página pública de la experiencia en una nueva pestaña"
                  >experiencias.club/experiencias/{{ exp.slug }}</a>
                }
              </div>
              <div class="cta-bar-right">
                @if (exp.status === 'pendiente') {
                  <button
                    type="button"
                    class="btn-approve"
                    [disabled]="isProposalProcessing(exp.id)"
                    (click)="approveProposal(exp)"
                    title="Aprobar nueva experiencia y publicarla en la web"
                  >
                    <span>Aprobar nueva experiencia</span>
                  </button>
                  <button
                    type="button"
                    class="btn-reject"
                    [disabled]="isProposalProcessing(exp.id)"
                    (click)="rejectProposal(exp)"
                    title="Rechazar propuesta"
                  >
                    <span>Rechazar</span>
                  </button>
                  @if (getExpProviderPhone(exp)) {
                    <a
                      [href]="getWhatsappLink(getExpProviderPhone(exp), getExpProviderName(exp))"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn-whatsapp btn-contact-provider"
                      title="Contactar al prestador por WhatsApp"
                    >
                      <span>Contactar prestador</span>
                    </a>
                  }
                  <a [routerLink]="getEditRoute(exp)" class="btn-action-edit-orange">
                    <span>Editar Experiencia</span>
                  </a>
                } @else {
                  <a [routerLink]="getEditRoute(exp)" class="btn-action-edit-orange">
                    <span>Editar Experiencia</span>
                  </a>
                  @if (exp.status === 'publicada') {
                    <button
                      type="button"
                      class="btn-pause-exp-bottom"
                      (click)="toggleStatus(exp, 'oculta')"
                      title="Pausar ruta y ocultarla de la web pública"
                    >
                      <span>Pausar</span>
                    </button>
                  } @else if (exp.status === 'oculta') {
                    <button
                      type="button"
                      class="btn-activate-exp-bottom"
                      (click)="toggleStatus(exp, 'publicada')"
                      title="Activar y publicar en la web pública"
                    >
                      <span>Activar</span>
                    </button>
                  } @else {
                    <button
                      type="button"
                      class="btn-activate-exp-bottom"
                      (click)="toggleStatus(exp, 'publicada')"
                      title="Aprobar nueva experiencia y publicarla en la web pública"
                    >
                      <span>Aprobar nueva experiencia</span>
                    </button>
                  }
                  <button
                    type="button"
                    class="btn-delete-exp-bottom"
                    (click)="openDeleteModal(exp)"
                    title="Eliminar experiencia del catálogo"
                  >
                    <span>Borrar</span>
                  </button>
                  @if (getExpProviderPhone(exp)) {
                    <a
                      [href]="getWhatsappLink(getExpProviderPhone(exp), getExpProviderName(exp))"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn-whatsapp btn-contact-provider"
                      title="Contactar al prestador por WhatsApp"
                    >
                      <span>Contactar prestador</span>
                    </a>
                  }
                }
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
              <a [routerLink]="newExperienceRoute()" class="btn-create-exp-yellow">
                <span>Crear Nueva Experiencia</span>
              </a>
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
          <span class="table-count">{{ filteredExperiences().length }} de {{ allCount() }} registradas</span>
        </div>

        <!-- Barra de herramientas: Búsqueda y Pestañas -->
        <div class="table-toolbar">
          <div class="search-box">
            <mat-icon class="search-icon">search</mat-icon>
            <input
              type="text"
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              placeholder="Buscar por título, región, prestador o slug..."
              class="search-input"
            />
            @if (searchQuery()) {
              <button
                type="button"
                class="clear-search-btn"
                (click)="searchQuery.set('')"
                aria-label="Limpiar búsqueda"
              >
                ×
              </button>
            }
          </div>

          <div class="tabs-group">
            <button
              type="button"
              class="filter-tab"
              [class.is-active]="activeTab() === 'all'"
              (click)="activeTab.set('all')"
            >
              Todas ({{ allCount() }})
            </button>
            <button
              type="button"
              class="filter-tab"
              [class.is-active]="activeTab() === 'publicadas'"
              (click)="activeTab.set('publicadas')"
            >
              Publicadas ({{ publishedCount() }})
            </button>
            <button
              type="button"
              class="filter-tab"
              [class.is-active]="activeTab() === 'postulaciones'"
              (click)="activeTab.set('postulaciones')"
            >
              Postulaciones ({{ pendingCount() }})
            </button>
            <button
              type="button"
              class="filter-tab"
              [class.is-active]="activeTab() === 'ocultas'"
              (click)="activeTab.set('ocultas')"
            >
              Pausadas ({{ pausedCount() }})
            </button>
            <button
              type="button"
              class="filter-tab"
              [class.is-active]="activeTab() === 'borradores'"
              (click)="activeTab.set('borradores')"
            >
              Borradores ({{ draftCount() }})
            </button>
          </div>
        </div>

        @if (filteredExperiences().length === 0) {
          <div class="empty-box" style="margin: 1.5rem; padding: 2.5rem 1.5rem; text-align: center;">
            <mat-icon style="font-size: 2.5rem; width: 2.5rem; height: 2.5rem; color: rgba(255, 95, 0, 0.7); margin-bottom: 0.75rem;">explore_off</mat-icon>
            <h3 style="color: #ffffff; font-size: 1.1rem; margin-bottom: 0.5rem;">No se encontraron experiencias</h3>
            <p style="color: rgba(255, 255, 255, 0.6); font-size: 0.85rem; max-width: 480px; margin: 0 auto;">
              No hay experiencias que coincidan con la pestaña seleccionada o el término de búsqueda ingresado.
            </p>
          </div>
        } @else {
        <div class="table-responsive">
          <table class="admin-exp-table">
            <thead>
              <tr>
                <th>Experiencia</th>
                <th>Ruta Web Oficial</th>
                <th>Región & Dificultad</th>
                <th>Arancel</th>
                <th class="col-cupo">Cupo Máx.</th>
                <th>Estado</th>
                <th class="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (exp of filteredExperiences(); track exp.id) {
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
                        </div>
                        <span class="exp-table-sub">{{ getExpProviderName(exp) }}</span>
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
                  <td class="col-cupo">
                    <span class="cupo-badge">{{ exp.maxSpotsPerGroup }} {{ exp.maxSpotsPerGroup === 1 ? 'socio' : 'socios' }}</span>
                  </td>

                  <!-- Columna Estado -->
                  <td>
                    @if (exp.status === 'publicada') {
                      <span class="status-pill is-published">PUBLICADA</span>
                    } @else if (exp.status === 'pendiente') {
                      <span class="status-pill is-pending">POSTULACIÓN</span>
                    } @else if (exp.status === 'oculta') {
                      <span class="status-pill is-hidden">PAUSADA</span>
                    } @else if (exp.status === 'rechazada') {
                      <span class="status-pill is-rejected">RECHAZADA</span>
                    } @else {
                      <span class="status-pill is-draft">BORRADOR</span>
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

                      <!-- Acciones según estado -->
                      @if (exp.status === 'pendiente') {
                        <button
                          type="button"
                          class="btn-activate-exp"
                          [disabled]="isProposalProcessing(exp.id)"
                          (click)="approveProposal(exp)"
                          title="Aprobar y publicar experiencia en la web"
                        >
                          APROBAR
                        </button>
                        <button
                          type="button"
                          class="btn-pause-exp"
                          [disabled]="isProposalProcessing(exp.id)"
                          (click)="rejectProposal(exp)"
                          title="Rechazar propuesta"
                        >
                          RECHAZAR
                        </button>
                      } @else if (exp.status === 'publicada') {
                        <button
                          type="button"
                          class="btn-pause-exp"
                          (click)="toggleStatus(exp, 'oculta')"
                          title="Pausar ruta y ocultarla de la web pública"
                        >
                          PAUSAR
                        </button>
                      } @else if (exp.status === 'oculta') {
                        <button
                          type="button"
                          class="btn-activate-exp"
                          (click)="toggleStatus(exp, 'publicada')"
                          title="Volver a publicar ruta en la web pública"
                        >
                          ACTIVAR
                        </button>
                      } @else {
                        <button
                          type="button"
                          class="btn-activate-exp"
                          (click)="toggleStatus(exp, 'publicada')"
                          title="Publicar experiencia en la web pública"
                        >
                          PUBLICAR
                        </button>
                      }
                      <button
                        type="button"
                        class="btn-delete-exp-table"
                        (click)="openDeleteModal(exp)"
                        title="Eliminar experiencia del catálogo"
                      >
                        BORRAR
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        }

        <!-- Acciones al pie de la tabla -->
        <div class="table-footer-actions">
          <button
            type="button"
            class="btn-footer-action"
            (click)="refresh()"
            [disabled]="isRefreshing()"
          >
            {{ isRefreshing() ? 'Actualizando...' : 'Refrescar Datos' }}
          </button>

          <button type="button" class="btn-footer-action" (click)="downloadExperiencesCsv()">
            Descargar Planilla
          </button>
        </div>
      </div>
    }

      <!-- MODAL DE CONFIRMACIÓN DE BORRADO -->
      @if (experienceToDelete()) {
        <div class="confirm-delete-modal-backdrop" (click)="closeDeleteModal()">
          <div class="confirm-delete-modal-dialog" (click)="$event.stopPropagation()">
            <div class="delete-modal-header">
              <div class="delete-modal-title-col">
                <h3 class="delete-modal-title">¿Eliminar Experiencia?</h3>
                <span class="delete-modal-sub">Esta acción dará de baja la experiencia del catálogo y liberará su enlace web</span>
              </div>
            </div>

            <div class="delete-modal-body">
              <div class="delete-target-card">
                <span class="target-label">EXPERIENCIA SELECCIONADA:</span>
                <strong class="target-title">{{ experienceToDelete()?.title }}</strong>
                <span class="target-id">ID: <code>{{ experienceToDelete()?.id }}</code> &bull; Ruta: <code>/experiencias/{{ experienceToDelete()?.slug }}</code></span>
              </div>

              <div class="delete-consequences-list">
                <div class="consequence-item">
                  <span class="bullet">•</span>
                  <span><strong>Baja lógica y persistencia:</strong> La experiencia se conserva en la base de datos (marcada como borrada) para preservar la trazabilidad y el historial de compras de los socios.</span>
                </div>
                <div class="consequence-item">
                  <span class="bullet">•</span>
                  <span><strong>Liberación de slug:</strong> El slug <code>{{ experienceToDelete()?.slug }}</code> se libera inmediatamente para poder ser reutilizado en una nueva experiencia.</span>
                </div>
                <div class="consequence-item">
                  <span class="bullet">•</span>
                  <span><strong>Remoción del catálogo:</strong> Dejará de mostrarse en la web pública y en las listas operativas de los portales.</span>
                </div>
              </div>
            </div>

            <div class="delete-modal-actions">
              <button
                type="button"
                class="btn-cancel-delete"
                (click)="closeDeleteModal()"
                [disabled]="isDeletingExp()"
              >
                Cancelar
              </button>
              <button
                type="button"
                class="btn-confirm-delete"
                (click)="confirmDeleteExperience()"
                [disabled]="isDeletingExp()"
              >
                <span>{{ isDeletingExp() ? 'Dando de baja...' : 'Eliminar Experiencia' }}</span>
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
        margin-top: 2.25rem;
      }

      .edit-page-card .admin-page-header {
        width: 100%;
      }

      .edit-page-card .header-titles {
        max-width: 100%;
        width: 100%;
        flex: 1 1 100%;
      }

      .edit-page-card .title-row {
        width: 100%;
      }

      .edit-page-card .card-heading {
        font-size: clamp(1.4rem, 2.2vw, 1.75rem);
        max-width: 100%;
        width: 100%;
      }

      .edit-page-body {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .edit-page-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding-top: 1.25rem;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        margin-top: 0.5rem;
      }

      .btn-cancel-edit {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 38px;
        min-height: 38px;
        box-sizing: border-box;
        line-height: 1;
        padding: 0 1.45rem;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.25);
        color: #ffffff;
        border-radius: 4px;
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
        margin-top: 1.5rem;
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
        color: #ffffff;
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

      .fiche-section-card.is-club-card,
      .pricing-fiche-card.is-club-card,
      .fiche-bottom-cta-bar.is-club-card {
        border-color: rgba(0, 204, 136, 0.35) !important;
        background: linear-gradient(180deg, rgba(18, 10, 5, 0.98) 0%, rgba(5, 25, 18, 0.7) 100%) !important;
      }

      .hero-fiche-card {
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
        flex-wrap: wrap;
      }

      .hero-badges-row .btn-hero-public-web,
      .hero-badges-row .btn-hero-edit,
      .hero-badges-row .status-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 28px;
        box-sizing: border-box;
        line-height: 1;
      }

      .btn-hero-public-web {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0 0.75rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.22);
        border-radius: 4px;
        color: #ffffff;
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .btn-hero-public-web:hover {
        background: rgba(255, 255, 255, 0.16);
        border-color: rgba(255, 255, 255, 0.45);
        color: #ffffff;
      }

      .btn-hero-edit {
        display: inline-flex;
        align-items: center;
        padding: 0 0.75rem;
        background: #ff5f00;
        border: 1px solid #ff5f00;
        border-radius: 4px;
        color: #ffffff;
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .btn-hero-edit:hover {
        background: #ff7722;
        border-color: #ff7722;
        color: #ffffff;
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
        background: linear-gradient(135deg, rgba(28, 16, 8, 0.98) 0%, rgba(18, 10, 5, 0.98) 100%);
        border: 1px solid rgba(255, 95, 0, 0.28);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
      }

      .pricing-card-flex {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 1.25rem;
      }

      .price-data {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .price-title {
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #ff9955;
      }

      .price-figures {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        flex-wrap: wrap;
      }

      .ars-price {
        font-size: 2.25rem;
        font-weight: 900;
        color: #ffffff;
        letter-spacing: -0.02em;
        line-height: 1.1;
      }

      .usd-price {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.65rem;
        background: rgba(255, 170, 85, 0.12);
        border: 1px solid rgba(255, 170, 85, 0.3);
        border-radius: 4px;
        font-size: 0.88rem;
        font-weight: 800;
        color: #ffbb77;
        letter-spacing: 0.02em;
      }

      .price-note {
        font-size: 0.86rem;
        color: rgba(255, 255, 255, 0.72);
        line-height: 1.5;
        max-width: 720px;
        margin-top: 0.15rem;
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

      .simple-check-list li::before,
      .simple-check-list.blue-checks li::before {
        content: "✓";
        color: #ffffff;
        font-weight: 800;
        font-size: 0.9rem;
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
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.22);
        color: #ffffff;
      }

      .location-btn.maps-btn:hover {
        background: rgba(255, 255, 255, 0.16);
        border-color: rgba(255, 255, 255, 0.45);
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
        font-family: 'Geist', var(--font-sans), sans-serif;
        text-decoration: none;
        transition: color 0.2s ease;
      }
      .cta-exp-route:hover {
        color: #ff5f00;
        text-decoration: underline;
      }

      .cta-bar-right {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .cta-bar-right .btn-cancel-edit,
      .cta-bar-right .btn-action-edit-orange,
      .cta-bar-right .btn-pause-exp-bottom,
      .cta-bar-right .btn-activate-exp-bottom,
      .cta-bar-right .btn-approve,
      .cta-bar-right .btn-reject,
      .cta-bar-right .btn-whatsapp,
      .cta-bar-right .btn-contact-provider {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 34px;
        min-height: 34px;
        padding: 0 1.15rem;
        font-size: 0.8rem;
        font-weight: 800;
        border-radius: 4px;
        box-sizing: border-box;
        line-height: 1;
        transition: all 0.2s ease;
        text-decoration: none;
        cursor: pointer;
      }

      .cta-bar-right .btn-approve {
        background: transparent;
        border: 1px solid #00cc88;
        color: #ffffff;
      }

      .cta-bar-right .btn-approve:hover:not(:disabled) {
        background: rgba(0, 204, 136, 0.15);
        border-color: #33ffaa;
        color: #ffffff;
      }

      .cta-bar-right .btn-reject {
        background: rgba(255, 77, 77, 0.15);
        border: 1px solid rgba(255, 77, 77, 0.4);
        color: #ff6666;
      }

      .cta-bar-right .btn-reject:hover:not(:disabled) {
        background: #ff4d4d;
        border-color: #ff4d4d;
        color: #ffffff;
      }

      .cta-bar-right .btn-whatsapp,
      .cta-bar-right .btn-contact-provider {
        background: transparent;
        border: 1px solid #ffffff;
        color: #ffffff;
      }

      .cta-bar-right .btn-whatsapp:hover,
      .cta-bar-right .btn-contact-provider:hover {
        background: rgba(255, 255, 255, 0.15);
        border-color: #ffffff;
        color: #ffffff;
      }

      .btn-pause-exp-bottom {
        background: rgba(255, 80, 80, 0.16);
        border: 1px solid rgba(255, 80, 80, 0.4);
        color: #ff8080;
        cursor: pointer;
      }

      .btn-pause-exp-bottom:hover {
        background: rgba(255, 80, 80, 0.28);
        border-color: #ff6060;
        color: #ffffff;
      }

      .btn-activate-exp-bottom {
        background: transparent;
        border: 1px solid #00cc88;
        color: #ffffff;
        cursor: pointer;
      }

      .btn-activate-exp-bottom:hover {
        background: rgba(0, 204, 136, 0.15);
        border-color: #33ffaa;
        color: #ffffff;
      }

      .cta-bar-right .btn-delete-exp-bottom {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 34px;
        min-height: 34px;
        padding: 0 1.15rem;
        font-size: 0.8rem;
        font-weight: 800;
        border-radius: 4px;
        box-sizing: border-box;
        line-height: 1;
        transition: all 0.2s ease;
        background: rgba(239, 68, 68, 0.16);
        border: 1px solid rgba(239, 68, 68, 0.45);
        color: #fca5a5;
        cursor: pointer;
      }
      .cta-bar-right .btn-delete-exp-bottom:hover {
        background: #dc2626;
        border-color: #dc2626;
        color: #ffffff !important;
        box-shadow: 0 2px 10px rgba(220, 38, 38, 0.4);
      }
      .cta-bar-right .btn-delete-exp-bottom:hover span {
        color: #ffffff !important;
      }

      .badge-exp-deleted {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.35rem 0.85rem;
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #fca5a5;
        border-radius: 4px;
        font-size: 0.8rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .btn-view-fiche {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 0.75rem;
        height: 28px;
        min-height: 28px;
        box-sizing: border-box;
        background: rgba(255, 95, 0, 0.18);
        border: 1px solid #ff5f00;
        border-radius: 3px;
        color: #ffffff;
        font-size: 0.75rem;
        font-weight: 700;
        text-decoration: none;
        cursor: pointer;
        white-space: nowrap !important;
        letter-spacing: 0.04em;
        transition: all 0.2s ease;
      }

      .btn-view-fiche:hover {
        background: #ff5f00;
        border-color: #ff5f00;
        color: #0b0704;
      }

      .btn-view-fiche-top {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.5rem 0.9rem;
        background: rgba(255, 95, 0, 0.18);
        border: 1px solid rgba(255, 95, 0, 0.45);
        border-radius: 4px;
        color: #ff7722;
        font-size: 0.8rem;
        font-weight: 700;
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .btn-view-fiche-top:hover {
        background: #ff5f00;
        border-color: #ff5f00;
        color: #070d18;
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
        color: #ffffff !important;
        border: 1px solid #ffcc00 !important;
        border-radius: 4px;
        font-size: 0.85rem;
        font-weight: 800;
        cursor: pointer;
        text-decoration: none;
        transition: all 0.2s ease;
        white-space: nowrap;
        box-shadow: 0 4px 15px rgba(255, 204, 0, 0.3);
      }

      .btn-create-exp-yellow:hover {
        background: #ffd633 !important;
        border-color: #ffd633 !important;
        color: #ffffff !important;
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(255, 204, 0, 0.45);
      }

      /* Toast */
      .toast-banner {
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        max-width: 90vw;
        width: max-content;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
        padding: 0.85rem 1.4rem;
        background: #1e110a;
        border: 1px solid rgba(255, 95, 0, 0.6);
        border-radius: 4px;
        color: #ffaa55;
        font-size: 0.9rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 0.6rem;
        animation: fadeInToast 0.25s ease-out;
      }

      @keyframes fadeInToast {
        from {
          opacity: 0;
          transform: translate(-50%, 10px);
        }
        to {
          opacity: 1;
          transform: translate(-50%, 0);
        }
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
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      .table-responsive::-webkit-scrollbar {
        height: 6px;
      }

      .table-responsive::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.25);
        border-radius: 3px;
      }

      .table-responsive::-webkit-scrollbar-thumb {
        background: rgba(255, 95, 0, 0.4);
        border-radius: 3px;
      }

      .table-responsive::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 95, 0, 0.7);
      }

      .admin-exp-table {
        width: 100%;
        min-width: 1380px;
        border-collapse: collapse;
        font-size: 0.85rem;
      }

      .admin-exp-table th {
        text-align: left;
        padding: 0.75rem 1rem;
        background: #0f0703;
        color: rgba(255, 255, 255, 0.65);
        font-size: 0.72rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        border-bottom: 1px solid rgba(255, 95, 0, 0.2);
        white-space: nowrap;
      }

      .admin-exp-table th.text-right,
      .admin-exp-table td.text-right {
        text-align: right;
        white-space: nowrap;
        min-width: 135px;
        width: 135px;
        position: sticky;
        right: 0;
        z-index: 5;
        background: #140b06;
        box-shadow: -6px 0 16px rgba(0, 0, 0, 0.5);
      }

      .admin-exp-table th.text-right {
        background: #0f0703;
        text-align: center;
      }

      .admin-exp-table td {
        padding: 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        vertical-align: middle;
      }

      .admin-exp-table tr:hover td {
        background: rgba(255, 95, 0, 0.06);
      }

      .admin-exp-table tr:hover td.text-right {
        background: #241309;
      }

      .admin-exp-table tr.is-paused td {
        opacity: 0.65;
      }

      .admin-exp-table tr.is-paused td.text-right {
        opacity: 1;
      }

      .admin-exp-table tr.is-paused td.text-right .action-buttons-cell {
        opacity: 0.65;
      }

      .col-cupo {
        min-width: 140px;
        white-space: nowrap;
      }

      .exp-cell-main {
        display: flex;
        align-items: center;
        gap: 1rem;
        min-width: 320px;
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
        white-space: nowrap;
      }

      .exp-table-sub {
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.65);
        white-space: nowrap;
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
        min-width: 160px;
        white-space: nowrap;
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
        min-width: 110px;
        white-space: nowrap;
      }

      .price-cell strong {
        font-size: 0.95rem;
      }

      .usd-label {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.6);
      }

      .cupo-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        white-space: nowrap;
        height: 28px;
        box-sizing: border-box;
        line-height: 1;
        padding: 0 0.65rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 4px;
        font-size: 0.78rem;
        font-weight: 700;
        color: #ffffff;
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 28px;
        box-sizing: border-box;
        line-height: 1;
        padding: 0 0.65rem;
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

      .status-pill.is-pending {
        background: rgba(255, 170, 0, 0.22);
        border: 1px solid rgba(255, 170, 0, 0.6);
        color: #ffaa00;
      }

      .status-pill.is-rejected {
        background: rgba(255, 80, 80, 0.18);
        border: 1px solid rgba(255, 80, 80, 0.45);
        color: #ff8080;
      }

      .table-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
        padding: 0.85rem 1.25rem;
        background: rgba(255, 255, 255, 0.02);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }

      .search-box {
        position: relative;
        flex: 1;
        min-width: 260px;
        max-width: 420px;
      }

      .search-icon {
        position: absolute;
        left: 0.75rem;
        top: 50%;
        transform: translateY(-50%);
        font-size: 1.15rem;
        width: 1.15rem;
        height: 1.15rem;
        color: rgba(255, 255, 255, 0.4);
        pointer-events: none;
      }

      .search-input {
        width: 100%;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 2px;
        padding: 0.55rem 2rem 0.55rem 2.35rem;
        color: #ffffff;
        font-size: 0.82rem;
        font-family: inherit;
        outline: none;
        transition: border-color 0.2s ease;
      }

      .search-input:focus {
        border-color: #ff5f00;
      }

      .clear-search-btn {
        position: absolute;
        right: 0.5rem;
        top: 50%;
        transform: translateY(-50%);
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        font-size: 1.15rem;
        cursor: pointer;
        line-height: 1;
        padding: 0.2rem 0.4rem;
      }

      .tabs-group {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 2px;
        padding: 0.2rem;
        flex-wrap: wrap;
      }

      .filter-tab {
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.65);
        padding: 0.45rem 0.85rem;
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;
        border-radius: 2px;
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      .filter-tab:hover {
        color: #ffffff;
      }
      .filter-tab.is-active {
        background: #ff5f00;
        color: #ffffff;
      }

      .status-pill.is-clickable {
        cursor: pointer;
        transition: all 0.2s ease;
        border-style: solid;
        font-family: inherit;
      }

      .status-pill.is-clickable:hover {
        filter: brightness(1.25);
        transform: translateY(-1px);
      }

      .text-right {
        text-align: right;
      }

      .action-buttons-cell {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        justify-content: center;
        gap: 0.35rem;
        width: 105px;
        min-width: 105px;
        max-width: 105px;
        margin: 0 auto;
      }

      .action-buttons-cell .btn-view-fiche,
      .action-buttons-cell .btn-edit-exp,
      .action-buttons-cell .btn-pause-exp,
      .action-buttons-cell .btn-activate-exp {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 28px;
        min-height: 28px;
        padding: 0 0.5rem;
        font-size: 0.7rem;
        box-sizing: border-box;
      }

      .btn-edit-exp {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 0.75rem;
        height: 32px;
        min-height: 32px;
        box-sizing: border-box;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.22);
        border-radius: 3px;
        color: rgba(255, 255, 255, 0.85);
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap !important;
        text-decoration: none;
        letter-spacing: 0.04em;
        transition: all 0.2s ease;
      }

      .btn-edit-exp:hover {
        background: rgba(255, 255, 255, 0.16);
        border-color: rgba(255, 255, 255, 0.45);
        color: #ffffff;
      }

      .btn-edit-exp mat-icon {
        font-size: 15px;
        width: 15px;
        height: 15px;
      }

      .btn-pause-exp {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 0.75rem;
        height: 32px;
        min-height: 32px;
        box-sizing: border-box;
        background: rgba(255, 80, 80, 0.12);
        border: 1px solid rgba(255, 80, 80, 0.38);
        border-radius: 3px;
        color: #ff8080;
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap !important;
        letter-spacing: 0.04em;
        transition: all 0.2s ease;
      }

      .btn-pause-exp:hover {
        background: rgba(255, 80, 80, 0.25);
        border-color: #ff8080;
        color: #ffffff;
      }

      .btn-activate-exp {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 0.75rem;
        height: 32px;
        min-height: 32px;
        box-sizing: border-box;
        background: rgba(0, 204, 136, 0.12);
        border: 1px solid rgba(0, 204, 136, 0.38);
        border-radius: 3px;
        color: #ffffff;
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap !important;
        letter-spacing: 0.04em;
        transition: all 0.2s ease;
      }

      .btn-activate-exp:hover {
        background: rgba(0, 204, 136, 0.25);
        border-color: #00cc88;
        color: #ffffff;
      }

      .btn-activate-exp:disabled,
      .btn-pause-exp:disabled,
      .btn-delete-exp-table:disabled {
        opacity: 0.45;
        cursor: not-allowed;
        pointer-events: none;
      }

      .btn-delete-exp-table {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 0.75rem;
        height: 32px;
        min-height: 32px;
        box-sizing: border-box;
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.38);
        border-radius: 3px;
        color: #fca5a5;
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap !important;
        letter-spacing: 0.04em;
        transition: all 0.2s ease;
      }

      .btn-delete-exp-table:hover {
        background: #dc2626;
        border-color: #dc2626;
        color: #ffffff !important;
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

      .table-footer-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        margin-top: 1rem;
        box-sizing: border-box;
      }

      .btn-footer-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.6rem 1.15rem;
        border-radius: 2px;
        font-size: 0.82rem;
        font-weight: 700;
        cursor: pointer;
        transition:
          background 0.2s ease,
          border-color 0.2s ease,
          filter 0.2s ease;
        background: rgba(30, 15, 8, 0.75);
        border: 1px solid rgba(255, 95, 0, 0.35);
        color: #ffffff;
      }

      .btn-footer-action:hover:not(:disabled) {
        background: rgba(45, 22, 12, 0.85);
        border-color: rgba(255, 95, 0, 0.5);
        filter: brightness(1.15);
      }

      .btn-footer-action:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn-view-web mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      /* Delete Confirmation Modal */
      .confirm-delete-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(12px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
      }
      .confirm-delete-modal-dialog {
        width: 100%;
        max-width: 520px;
        background: #0f172a;
        border: 1px solid rgba(239, 68, 68, 0.4);
        border-radius: 8px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7), 0 0 20px rgba(239, 68, 68, 0.2);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .delete-modal-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1.25rem 1.5rem;
        background: rgba(239, 68, 68, 0.1);
        border-bottom: 1px solid rgba(239, 68, 68, 0.2);
      }
      .delete-modal-icon-wrap {
        width: 44px;
        height: 44px;
        border-radius: 8px;
        background: rgba(239, 68, 68, 0.2);
        color: #ef4444;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .delete-modal-icon-wrap mat-icon {
        font-size: 26px;
        width: 26px;
        height: 26px;
      }
      .delete-modal-title-col {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }
      .delete-modal-title {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 800;
        color: #ffffff;
      }
      .delete-modal-sub {
        font-size: 0.8rem;
        color: #fca5a5;
      }
      .delete-modal-body {
        padding: 1.35rem 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .delete-target-card {
        padding: 0.85rem 1rem;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .target-label {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: rgba(255, 255, 255, 0.5);
        font-weight: 700;
      }
      .target-title {
        font-size: 0.95rem;
        color: #ffffff;
      }
      .target-id {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.45);
      }
      .target-id code {
        color: #80b3ff;
      }
      .delete-consequences-list {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
      }
      .consequence-item {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        font-size: 0.82rem;
        line-height: 1.45;
        color: rgba(255, 255, 255, 0.75);
      }
      .consequence-item .bullet {
        color: #ef4444;
        font-weight: 900;
      }
      .consequence-item strong {
        color: #ffffff;
      }
      .delete-modal-actions {
        padding: 1rem 1.5rem;
        background: rgba(0, 0, 0, 0.25);
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.85rem;
      }
      .btn-cancel-delete {
        padding: 0.6rem 1.25rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #ffffff;
        border-radius: 4px;
        font-size: 0.85rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .btn-cancel-delete:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.15);
      }
      .btn-confirm-delete {
        padding: 0.6rem 1.35rem;
        background: #dc2626;
        border: 1px solid #ef4444;
        color: #ffffff !important;
        border-radius: 4px;
        font-size: 0.85rem;
        font-weight: 800;
        cursor: pointer;
        transition: all 0.15s ease;
        box-shadow: 0 4px 14px rgba(220, 38, 38, 0.35);
      }
      .btn-confirm-delete span {
        color: #ffffff !important;
      }
      .btn-confirm-delete:hover:not(:disabled) {
        background: #b91c1c;
        border-color: #dc2626;
        box-shadow: 0 6px 18px rgba(220, 38, 38, 0.5);
      }
      .btn-confirm-delete:disabled,
      .btn-cancel-delete:disabled {
        opacity: 0.5;
        cursor: not-allowed;
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

      .form-grid-arancel {
        display: grid;
        grid-template-columns: 1fr 1fr 2fr;
        gap: 1rem;
      }

      @media (max-width: 900px) {
        .form-grid-arancel {
          grid-template-columns: 1fr 1fr;
        }
        .form-grid-arancel .field-dates-col {
          grid-column: span 2;
        }
      }

      @media (max-width: 600px) {
        .form-grid-arancel {
          grid-template-columns: 1fr;
        }
        .form-grid-arancel .field-dates-col {
          grid-column: span 1;
        }
      }

      .form-field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        justify-content: flex-start;
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
        background: #99c2ff;
        color: #ffffff !important;
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
      .mp-status-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.25rem 0.65rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .mp-status-pill.connected {
        background: rgba(16, 185, 129, 0.15);
        color: #10b981;
        border: 1px solid rgba(16, 185, 129, 0.4);
      }
      .mp-status-pill.disconnected {
        background: rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.18);
      }
      .mp-code-badge {
        display: inline-block;
        padding: 0.15rem 0.45rem;
        background: rgba(128, 179, 255, 0.12);
        border: 1px solid rgba(128, 179, 255, 0.3);
        border-radius: 3px;
        color: #80b3ff;
        font-family: monospace;
        font-size: 0.85rem;
        font-weight: 700;
      }
      .text-green {
        color: #10b981 !important;
      }
      .mp-sync-hint-row {
        margin-top: 0.85rem;
        padding: 0.65rem 0.85rem;
        background: rgba(128, 179, 255, 0.08);
        border: 1px dashed rgba(128, 179, 255, 0.3);
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
      .mp-sync-hint-row .hint-text {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.8);
      }
      .mp-sync-hint-row .hint-text code {
        color: #80b3ff;
        font-weight: 700;
      }
      .btn-sync-mp-provider {
        padding: 0.35rem 0.75rem;
        background: #80b3ff;
        color: #ffffff !important;
        border: 1px solid #80b3ff;
        border-radius: 3px;
        font-size: 0.78rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .btn-sync-mp-provider:hover {
        background: #99c2ff;
      }

      .form-field label:not(.btn-upload-file) {
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

      .req-star {
        color: #ff5f00;
        font-weight: 800;
        margin-left: 0.25rem;
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

      .btn-upload-file,
      .btn-remove-media {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 34px;
        min-height: 34px;
        box-sizing: border-box;
        line-height: normal;
        font-family: inherit;
        font-size: 0.78rem;
        font-weight: 700;
        padding: 0 0.95rem;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: center;
        vertical-align: middle;
      }

      .btn-upload-file span,
      .btn-remove-media span {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }

      .btn-upload-file {
        white-space: nowrap;
        background: rgba(255, 95, 0, 0.2);
        border: 1px solid rgba(255, 95, 0, 0.45);
        color: #ffffff !important;
      }

      .btn-upload-file span {
        color: #ffffff !important;
      }

      .btn-upload-file:hover {
        background: rgba(255, 95, 0, 0.35);
        color: #ffffff !important;
      }

      .btn-upload-file:hover span {
        color: #ffffff !important;
      }

      .btn-upload-file.is-uploading {
        opacity: 0.6;
        pointer-events: none;
      }

      .btn-remove-media {
        white-space: nowrap;
        background: transparent;
        border: 1px solid rgba(255, 95, 95, 0.4);
        color: #ffffff !important;
      }

      .btn-remove-media span {
        color: #ffffff !important;
      }

      .btn-remove-media:hover {
        background: rgba(255, 95, 95, 0.15);
        color: #ffffff !important;
        border-color: #ff5f5f;
      }

      .btn-remove-media:hover span {
        color: #ffffff !important;
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
        justify-content: center;
        gap: 0.4rem;
        height: 34px;
        box-sizing: border-box;
        line-height: 1;
        padding: 0 0.95rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.25);
        border-radius: 4px;
        color: #ffffff;
        font-size: 0.78rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-upload-album-file:hover {
        background: rgba(255, 255, 255, 0.16);
        border-color: rgba(255, 255, 255, 0.45);
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

      .album-counter-pill.is-cover-pill {
        background: rgba(255, 122, 26, 0.15);
        border-color: rgba(255, 122, 26, 0.4);
        color: #ffaa66;
      }

      .album-counter-pill.is-featured-pill {
        background: rgba(255, 170, 0, 0.12);
        border-color: rgba(255, 170, 0, 0.4);
        color: #ffaa00;
      }

      .album-counter-pill.is-gallery-pill {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.3);
        color: #ffffff;
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
        top: 6px;
        left: 6px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        z-index: 2;
      }

      .photo-badge {
        display: inline-block;
        padding: 2.5px 6px;
        border-radius: 3px;
        font-size: 0.65rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        line-height: 1;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
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

      .btn-photo-action.btn-action-featured {
        background: rgba(255, 170, 0, 0.12);
        border: 1px solid rgba(255, 170, 0, 0.35);
        color: #ffaa00;
      }

      .btn-photo-action.btn-action-featured:hover {
        background: rgba(255, 170, 0, 0.22);
        border-color: rgba(255, 170, 0, 0.6);
        color: #ffbb22;
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
        flex-shrink: 0;
      }

      .slug-field {
        border: none !important;
        background: transparent !important;
        flex: 1;
        min-width: 0;
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
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        padding: 1.25rem 1.75rem;
        background: rgba(26, 14, 8, 0.9);
        border-top: 1px solid rgba(255, 95, 0, 0.25);
      }

      .btn-cancel {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 38px;
        min-height: 38px;
        box-sizing: border-box;
        line-height: 1;
        padding: 0 1.25rem;
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
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 38px;
        min-height: 38px;
        box-sizing: border-box;
        line-height: 1;
        padding: 0 1.45rem;
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
        .form-field label:not(.btn-upload-file) {
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

      .provider-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.68rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        background: rgba(14, 165, 233, 0.16);
        border: 1px solid rgba(56, 189, 248, 0.45);
        color: #38bdf8;
        padding: 0.15rem 0.45rem;
        border-radius: 4px;
        line-height: 1;
      }

      .provider-chip mat-icon {
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

      .provider-external-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.72rem;
        font-weight: 700;
        color: #80b3ff;
        background: rgba(128, 179, 255, 0.12);
        border: 1px solid rgba(128, 179, 255, 0.35);
        padding: 0.2rem 0.55rem;
        border-radius: 4px;
      }

      .provider-external-chip mat-icon {
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

      .club-locked-notice.external-notice {
        background: rgba(128, 179, 255, 0.08);
        border-color: rgba(128, 179, 255, 0.25);
      }

      .club-locked-notice.external-notice .locked-info-icon {
        color: #80b3ff;
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

      /* 3.2 Favoritos Section */
      .favorites-title-wrap {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      .title-with-icon {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .card-header-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      .favorites-count-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.35rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.8rem;
        font-weight: 700;
        background: rgba(255, 255, 255, 0.05);
        color: rgba(255, 255, 255, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .favorites-count-badge.has-favorites {
        background: rgba(255, 64, 129, 0.15);
        color: #ff4081;
        border-color: rgba(255, 64, 129, 0.35);
      }

      .favorites-count-badge .count-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }

      .favorites-loading-placeholder,
      .favorites-empty-placeholder,
      .favorites-error-placeholder {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1.5rem;
        border-radius: 6px;
        background: rgba(0, 0, 0, 0.25);
        border: 1px dashed rgba(255, 255, 255, 0.12);
      }

      .favorites-error-placeholder {
        border-color: rgba(244, 67, 54, 0.35);
        background: rgba(244, 67, 54, 0.08);
      }

      .error-fav-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: #f44336;
      }

      .error-fav-texts {
        flex: 1;
      }

      .error-fav-texts strong {
        display: block;
        font-size: 0.88rem;
        color: #ff8a80;
        margin-bottom: 0.2rem;
      }

      .error-fav-texts p {
        margin: 0;
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.7);
      }

      .btn-retry-favorites {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.45rem 0.85rem;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        font-size: 0.82rem;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s, border-color 0.2s;
        white-space: nowrap;
      }

      .btn-retry-favorites:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.35);
      }

      .btn-retry-favorites .material-icons-outlined {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      .empty-fav-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: rgba(255, 255, 255, 0.3);
      }

      .empty-fav-texts strong {
        display: block;
        font-size: 0.88rem;
        color: rgba(255, 255, 255, 0.85);
        margin-bottom: 0.2rem;
      }

      .empty-fav-texts p {
        margin: 0;
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.55);
      }

      .favorited-members-table-wrap {
        width: 100%;
        overflow-x: auto;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .favorited-members-table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
        font-size: 0.84rem;
      }

      .favorited-members-table th {
        background: rgba(0, 0, 0, 0.4);
        padding: 0.75rem 1rem;
        color: rgba(255, 255, 255, 0.5);
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .favorited-members-table td {
        padding: 0.85rem 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        vertical-align: middle;
      }

      .favorited-members-table tbody tr:hover {
        background: rgba(255, 255, 255, 0.02);
      }

      .socio-profile-cell {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .socio-avatar-img,
      .socio-avatar-fallback {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        object-fit: cover;
      }

      .socio-avatar-fallback {
        display: flex;
        align-items: center;
        justify-content: center;
        background: #2a1b14;
        border: 1px solid rgba(255, 149, 0, 0.3);
        color: #ff9500;
        font-weight: 700;
        font-size: 0.85rem;
      }

      .socio-names-wrap {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }

      .socio-display-name {
        font-weight: 600;
        color: #ffffff;
      }

      .socio-email-subtext {
        font-size: 0.74rem;
        color: rgba(255, 255, 255, 0.5);
      }

      .tier-pill-wrap {
        display: flex;
        align-items: center;
        gap: 0.45rem;
      }

      .socio-tier-pill {
        display: inline-block;
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.03em;
        background: rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.75);
      }

      .socio-tier-pill.tier-fundador,
      .socio-tier-pill.tier-vip {
        background: rgba(255, 149, 0, 0.15);
        color: #ffa726;
        border: 1px solid rgba(255, 149, 0, 0.3);
      }

      .socio-tier-pill.tier-activo,
      .socio-tier-pill.tier-socio {
        background: rgba(0, 204, 136, 0.15);
        color: #00cc88;
        border: 1px solid rgba(0, 204, 136, 0.3);
      }

      .socio-number-tag {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.45);
        font-family: monospace;
      }

      .contact-link.whatsapp {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        color: #25d366;
        text-decoration: none;
        font-size: 0.78rem;
      }

      .contact-link.whatsapp:hover {
        text-decoration: underline;
      }

      .contact-link.whatsapp .contact-icon {
        font-size: 15px;
        width: 15px;
        height: 15px;
      }

      .favorited-date-text {
        color: rgba(255, 255, 255, 0.6);
        font-size: 0.78rem;
      }

      @media (max-width: 768px) {
        .table-footer-actions {
          flex-direction: column;
          gap: 0.75rem;
        }

        .table-footer-actions .btn-footer-action {
          width: 100%;
          justify-content: center;
        }
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
  private readonly supabase = inject(SUPABASE_CLIENT, { optional: true });

  readonly detailFavoritedMembers = signal<ExperienceFavoritedMember[]>([]);
  readonly isLoadingDetailFavorites = signal<boolean>(false);
  readonly detailFavoritesError = signal<string | null>(null);
  private experienceFavoritesRequestToken = 0;

  isClub(exp?: Partial<Experience> | null): boolean {
    return isClubExperience(exp);
  }

  getExpProviderName(exp?: Partial<Experience> | null): string {
    if (!exp) return 'Club de Experiencias';
    const rawExpProviderName = (exp.providerAgency?.trim() || exp.providerName?.trim() || '');
    const isExplicitExternal =
      rawExpProviderName !== '' &&
      rawExpProviderName.toLowerCase() !== 'club de experiencias' &&
      rawExpProviderName.toLowerCase() !== 'club';

    if (isExplicitExternal) {
      return rawExpProviderName;
    }

    if (exp.id) {
      const matchingProposal = this.findMatchingProposal({ id: exp.id, slug: exp.slug, title: exp.title });
      const proposalCreator = (matchingProposal?.providerAgency || matchingProposal?.providerName || '').trim();
      if (
        proposalCreator !== '' &&
        proposalCreator.toLowerCase() !== 'club de experiencias' &&
        proposalCreator.toLowerCase() !== 'club'
      ) {
        return proposalCreator;
      }
    }

    if (this.isClub(exp)) {
      return this.adminStore.clubProfile().name || 'Club de Experiencias';
    }

    return rawExpProviderName || 'Club de Experiencias';
  }

  getExpProviderPhone(exp?: Partial<Experience> | null): string {
    if (!exp) return '';
    if (exp.providerPhone) return exp.providerPhone;
    if (exp.id) {
      const matching = this.findMatchingProposal({ id: exp.id, slug: exp.slug, title: exp.title });
      if (matching?.providerPhone) return matching.providerPhone;
    }
    if (exp.providerId) {
      const p = this.registeredProviders().find((pr) => pr.id === exp.providerId);
      if (p?.phone) return p.phone;
    }
    return '';
  }

  getWhatsappLink(phone?: string, name?: string): string {
    if (!phone) return '#';
    const cleanDigits = phone.replace(/\D/g, '');
    const text = encodeURIComponent(
      `Hola ${name || ''}, te contactamos desde el equipo de Experiencias Club respecto a tu postulación.`,
    );
    return `https://wa.me/${cleanDigits}?text=${text}`;
  }

  readonly isCurrentExperienceClub = computed(() => {
    const inputName = this.editProviderName().trim().toLowerCase();
    if (inputName && inputName !== 'club de experiencias' && inputName !== 'club') {
      return false;
    }
    const exp = this.editingExperience();
    if (!exp) return false;
    const matchingProposal = this.findMatchingProposal(exp);
    const proposalCreator = (matchingProposal?.providerAgency || matchingProposal?.providerName || '').trim().toLowerCase();
    if (proposalCreator && proposalCreator !== 'club de experiencias' && proposalCreator !== 'club') {
      return false;
    }
    return isClubExperience(exp);
  });

  openClubProfileModal(): void {
    this.adminStore.openClubProfileModal();
  }

  readonly experiences = this.experienceService.experiences;
  readonly activeTab = signal<ExperienceTab>('all');
  readonly searchQuery = signal<string>('');

  readonly allCount = computed(() => this.experienceService.experiences().length);
  readonly publishedCount = computed(
    () => this.experienceService.experiences().filter((e) => e.status === 'publicada').length,
  );
  readonly pendingCount = computed(
    () => this.experienceService.experiences().filter((e) => e.status === 'pendiente').length,
  );
  readonly pausedCount = computed(
    () => this.experienceService.experiences().filter((e) => e.status === 'oculta').length,
  );
  readonly draftCount = computed(
    () =>
      this.experienceService
        .experiences()
        .filter((e) => !e.status || e.status === 'borrador' || e.status === 'rechazada').length,
  );

  readonly filteredExperiences = computed(() => {
    const tab = this.activeTab();
    const q = this.searchQuery().trim().toLowerCase();
    let list = this.experienceService.experiences();

    if (tab === 'publicadas') {
      list = list.filter((e) => e.status === 'publicada');
    } else if (tab === 'postulaciones') {
      list = list.filter((e) => e.status === 'pendiente');
    } else if (tab === 'ocultas') {
      list = list.filter((e) => e.status === 'oculta');
    } else if (tab === 'borradores') {
      list = list.filter((e) => !e.status || e.status === 'borrador' || e.status === 'rechazada');
    }

    if (q) {
      list = list.filter(
        (e) =>
          (e.title && e.title.toLowerCase().includes(q)) ||
          (e.slug && e.slug.toLowerCase().includes(q)) ||
          (e.region && e.region.toLowerCase().includes(q)) ||
          (e.providerName && e.providerName.toLowerCase().includes(q)) ||
          (e.providerAgency && e.providerAgency.toLowerCase().includes(q)) ||
          (this.getExpProviderName(e) && this.getExpProviderName(e).toLowerCase().includes(q)) ||
          (e.providerEmail && e.providerEmail.toLowerCase().includes(q)),
      );
    }

    return list;
  });

  readonly feedbackToast = signal<string | null>(null);
  readonly saving = signal(false);
  readonly processingProposalIds = signal<Set<string>>(new Set<string>());

  isProposalProcessing(id: string): boolean {
    return this.processingProposalIds().has(id);
  }

  readonly isRouteEditMode = signal(false);
  readonly isRouteCreateMode = signal(false);
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

  readonly newExperienceRoute = computed(() => {
    return this.isAdminRoute() ? '/admin/experiencias/nueva' : '/experiencias/nueva';
  });

  readonly isLodging = computed(() => {
    return this.editCategory() === 'hospedajes';
  });

  getDetailRoute(exp: Experience | { slug?: string }): string {
    const base = this.isAdminRoute() ? '/admin/experiencias' : '/experiencias';
    return `${base}/${exp.slug || ''}`;
  }

  getEditRoute(exp: Experience | { slug?: string }): string {
    const base = this.isAdminRoute() ? '/admin/experiencias' : '/experiencias';
    return `${base}/${exp.slug || ''}/editar`;
  }

  getConfigRoute(): string {
    const base = this.isAdminRoute() ? '/admin' : '';
    return `${base}/configuracion`;
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

    // 1. Respetar siempre el itinerario real configurado y guardado en la experiencia
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
            const parts = rest.split(/\s+[-–—]\s+|:\s+/);
            const title = parts[0] || `Etapa ${idx + 1}`;
            const description = parts.slice(1).join(' - ') || parts[0];
            return { time, title, description };
          }
          const parts = line.split(/\s+[-–—]\s+/);
          if (parts.length > 1) {
            return {
              time: lines.length > 1 ? `Etapa ${idx + 1}` : 'Horario',
              title: parts[0],
              description: parts.slice(1).join(' - '),
            };
          }
          return {
            time: lines.length > 1 ? `Etapa ${idx + 1}` : 'Horario & Salidas',
            title: lines.length > 1 ? line : 'Cronograma de la Actividad',
            description: line,
          };
        });
      }
    }

    return [];
  });

  readonly registeredProviders = computed<ProviderUser[]>(() => {
    return this.adminStore.allRegisteredProviders
      ? this.adminStore.allRegisteredProviders()
      : this.adminStore.providerStore.providers();
  });

  async ngOnInit(): Promise<void> {
    void this.experienceService.reloadFromSupabase();
    void this.adminStore.providerStore.loadProposalsFromSupabase();
    void this.adminStore.loadAllApplications();

    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const tab = params.get('tab');
        if (tab === 'postulaciones' || tab === 'experiencias' || tab === 'pendientes') {
          this.activeTab.set('postulaciones');
        } else if (tab === 'publicadas') {
          this.activeTab.set('publicadas');
        } else if (tab === 'ocultas' || tab === 'pausadas') {
          this.activeTab.set('ocultas');
        } else if (tab === 'borradores') {
          this.activeTab.set('borradores');
        } else if (tab === 'todas' || tab === 'all') {
          this.activeTab.set('all');
        }
      });

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
    const isNew = rawPath.endsWith('/nueva');
    const isEdit = rawPath.endsWith('/editar');
    const slug = slugParam !== undefined ? slugParam : this.route.snapshot.paramMap.get('slug');

    if (isNew || slug === 'nueva') {
      this.notFound.set(false);
      this.isRouteDetailMode.set(false);
      this.isRouteEditMode.set(false);
      this.isRouteCreateMode.set(true);
      this.openCreateModal();
      return;
    }

    this.isRouteCreateMode.set(false);
    if (slug) {
      this.notFound.set(false);
      await this.experienceService.remoteLoadPromise;
      if (this.route.snapshot.paramMap.get('slug') !== slug) {
        return;
      }
      let exp =
        this.experienceService.getExperienceBySlug(slug) ||
        this.experienceService.getExperienceById(slug);

      let matchingReq: ExperienceProposalRequest | undefined;
      if (!exp) {
        matchingReq = this.findMatchingProposal({ id: slug, slug, title: slug });
        if (!matchingReq) {
          try {
            await this.adminStore.providerStore.loadProposalsFromSupabase();
          } catch {
            // fallback si supabase no está disponible
          }
          if (this.route.snapshot.paramMap.get('slug') !== slug) {
            return;
          }
          matchingReq = this.findMatchingProposal({ id: slug, slug, title: slug });
        }
        if (!matchingReq && this.adminStore.providerStore.experiences) {
          const cleanSlug = slug.replace(/^(?:exp|req)-/, '').toLowerCase();
          const provExp = this.adminStore.providerStore.experiences().find(
            (p) =>
              p.id === slug ||
              p.slug === slug ||
              p.id.replace(/^(?:exp|req)-/, '').toLowerCase() === cleanSlug ||
              (p.title && slugify(p.title) === cleanSlug),
          );
          if (provExp) {
            matchingReq = this.findMatchingProposal({ id: provExp.id, slug: provExp.slug, title: provExp.title });
            if (!matchingReq) {
              exp = this.mapProviderExpToExperience(provExp);
            }
          }
        }
        if (matchingReq && !exp) {
          exp = this.mapProposalToExperience(matchingReq);
        }
      }

      if (this.route.snapshot.paramMap.get('slug') !== slug) {
        return;
      }

      if (exp) {
        this.editingExperience.set(exp);
        this.openEditModal(exp);
        const targetReq = matchingReq || (exp.id.startsWith('req-') ? this.findMatchingProposal(exp) : undefined);
        let canRedirect = Boolean(exp.slug && exp.slug !== slug);
        if (canRedirect) {
          if (targetReq) {
            const conflictingExp = this.experienceService.getExperienceBySlug(exp.slug!);
            const requests = this.adminStore.providerStore.experienceRequests();
            const cleanCanonical = exp.slug!.toLowerCase().trim();
            const matchingProposals = requests.filter(
              (r) =>
                (r.slug && r.slug.toLowerCase().trim() === cleanCanonical) ||
                (r.title && slugify(r.title) === cleanCanonical),
            );
            canRedirect =
              !conflictingExp &&
              matchingProposals.length === 1 &&
              matchingProposals[0].id === targetReq.id;
          } else {
            const resolvedExp = this.experienceService.getExperienceBySlug(exp.slug!);
            if (resolvedExp && resolvedExp.id !== exp.id) {
              canRedirect = false;
            }
          }
        }
        if (canRedirect) {
          void this.router.navigateByUrl(isEdit ? this.getEditRoute(exp) : this.getDetailRoute(exp), { replaceUrl: true });
        }
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
    const firstWithPrice = this.experiences().find((e) => e.priceArs && e.priceArs > 0);
    return firstWithPrice?.priceArs || 65000;
  });

  readonly avgCapacity = computed(() => {
    const list = this.experiences();
    if (!list.length) return 12;
    const total = list.reduce((sum, e) => sum + (e.maxSpotsPerGroup || 12), 0);
    return Math.round(total / list.length);
  });

  // Modal State
  readonly editingExperience = signal<Experience | null>(null);
  readonly initialExperience = computed<Experience | null>(() => {
    const exp = this.editingExperience();
    if (!exp) return null;
    const matching = this.findMatchingProposal(exp);
    const resolvedPhone = (
      this.editProviderPhone() ||
      exp.providerPhone ||
      matching?.providerPhone ||
      this.getExpProviderPhone(exp) ||
      ''
    ).trim();
    const resolvedName = (
      this.editProviderName() ||
      exp.providerName ||
      matching?.providerAgency ||
      matching?.providerName ||
      this.getExpProviderName(exp) ||
      ''
    ).trim();
    const resolvedCbu = (this.editProviderCbuAlias() || exp.providerCbuAlias || matching?.providerCbuAlias || '').trim();
    const resolvedCuit = (this.editProviderCuitDni() || exp.providerCuitDni || matching?.providerCuitDni || '').trim();
    const resolvedBank = (this.editProviderBankName() || exp.providerBankName || matching?.providerBankName || '').trim();

    return {
      ...exp,
      providerName: resolvedName || exp.providerName,
      providerPhone: resolvedPhone || exp.providerPhone,
      providerCbuAlias: resolvedCbu || exp.providerCbuAlias,
      providerCuitDni: resolvedCuit || exp.providerCuitDni,
      providerBankName: resolvedBank || exp.providerBankName,
    };
  });
  readonly isCreating = signal(false);

  // Uploading state
  readonly uploadingCover = signal(false);
  readonly uploadingVideo = signal(false);
  readonly uploadingAlbum = signal(false);
  readonly editAlbumPhotos = signal<ExperienceAlbumPhoto[]>([]);

  readonly featuredPhotos = computed(() => this.editAlbumPhotos().filter((p) => p.isFeatured));
  readonly galleryPhotos = computed(() =>
    this.editAlbumPhotos().filter((p) => !p.isFeatured),
  );

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
  readonly editDifficulty = signal<'Baja' | 'Moderada' | 'Exigente' | 'Alta Montaña' | 'Ninguna'>('Ninguna');
  readonly durationOptions: readonly string[] = EXPERIENCE_DURATION_OPTIONS;
  readonly editDurationLabel = signal('4 horas (Media jornada)');
  readonly categoryOptions = EXPERIENCE_CATEGORY_OPTIONS;
  readonly editCategory = signal<string>('expediciones');
  isCustomCategory(val: string | null | undefined): boolean {
    if (!val) return false;
    return !this.categoryOptions.some((opt) => opt.value === val);
  }
  readonly altitudeOptions = ALTITUDE_OPTIONS;
  readonly editAltitude = signal(850);
  isCustomAltitude(val: number | null | undefined): boolean {
    if (val === null || val === undefined) return false;
    return !this.altitudeOptions.some((opt) => opt.value === Number(val));
  }
  readonly editCapacity = signal(12);
  readonly editPriceArs = signal(65000);
  readonly editPricingPacks = signal<ExperiencePricingPack[]>([]);
  readonly usdExchangeRate = computed(() => this.adminStore.usdExchangeRate() || 1400);
  readonly calculatedUsd = computed(() => {
    const rate = this.usdExchangeRate();
    return Math.round((Number(this.editPriceArs()) || 0) / rate);
  });
  readonly editCoverImage = signal('');
  readonly editVideoUrl = signal('');
  readonly editVideoPoster = signal('');
  readonly todayIso = new Date().toISOString().slice(0, 10);
  readonly editScheduledDates = signal<string[]>([]);
  readonly newAdminScheduledDate = signal<string>('');
  readonly adminScheduledDateError = signal<string | null>(null);
  readonly editDatesRaw = signal('');

  onAdminDatePicked(val: string): void {
    this.newAdminScheduledDate.set(val);
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      this.addAdminScheduledDate();
    }
  }

  addAdminScheduledDate(): void {
    const val = this.newAdminScheduledDate();
    if (!val) return;
    if (this.editScheduledDates().includes(val)) {
      this.adminScheduledDateError.set('Esta fecha ya está cargada.');
      return;
    }
    const updated = [...this.editScheduledDates(), val].sort();
    this.editScheduledDates.set(updated);
    this.editDatesRaw.set(updated.join(', '));
    this.newAdminScheduledDate.set('');
    this.adminScheduledDateError.set(null);
  }

  removeAdminScheduledDate(dateToRemove: string): void {
    const updated = this.editScheduledDates().filter((d) => d !== dateToRemove);
    this.editScheduledDates.set(updated);
    this.editDatesRaw.set(updated.length > 0 ? updated.join(', ') : 'A coordinar');
  }
  readonly editHighlightsRaw = signal('');
  readonly editRequirementsRaw = signal('');
  readonly editIncludedRaw = signal('');
  readonly editStatus = signal<'publicada' | 'oculta' | 'borrador' | 'pendiente' | 'rechazada'>('publicada');
  readonly editDisplayLocation = signal<'destacada' | 'catalogo' | 'no_listada'>('destacada');
  readonly editProviderName = signal('');
  readonly editProviderId = signal('');
  readonly editProviderPhone = signal('');
  readonly editProviderCbuAlias = signal('');
  readonly editProviderCuitDni = signal('');
  readonly editProviderBankName = signal('');
  readonly editMpConnected = signal<boolean>(false);
  readonly editMpCollectorId = signal<string>('');
  readonly editMpNickname = signal<string>('');

  readonly currentEditingProvider = computed<ProviderUser | undefined>(() => {
    const exp = this.editingExperience();
    const name = this.editProviderName().trim().toLowerCase();
    const providers = this.registeredProviders();
    const explicitId = (this.editProviderId() || '').trim();
    if (explicitId) {
      const byExplicitId = providers.find((p) => p.id === explicitId);
      if (byExplicitId) return byExplicitId;
    }
    if (exp?.providerId) {
      const byId = providers.find((p) => p.id === exp.providerId);
      if (byId) return byId;
    }
    if (name) {
      const byName = providers.find(
        (p) => p.name?.toLowerCase() === name || p.agency?.toLowerCase() === name,
      );
      if (byName) return byName;
    }
    return undefined;
  });

  getProviderForExperience(exp: Experience | null): ProviderUser | undefined {
    if (!exp) return undefined;
    const providers = this.registeredProviders();
    if (exp.providerId) {
      const byId = providers.find((p) => p.id === exp.providerId);
      if (byId) return byId;
    }
    if (exp.providerEmail) {
      const byEmail = providers.find((p) => p.email?.toLowerCase() === exp.providerEmail?.toLowerCase());
      if (byEmail) return byEmail;
    }
    if (exp.providerSlug) {
      const bySlug = providers.find((p) => p.slug === exp.providerSlug);
      if (bySlug) return bySlug;
    }
    if (exp.providerName) {
      const name = exp.providerName.trim().toLowerCase();
      const byName = providers.find((p) => p.name?.toLowerCase() === name || p.agency?.toLowerCase() === name);
      if (byName) return byName;
    }
    if (exp.id) {
      const matching = this.findMatchingProposal({ id: exp.id, slug: exp.slug, title: exp.title });
      if (matching) {
        if (matching.providerId) {
          const byProposalId = providers.find((p) => p.id === matching.providerId);
          if (byProposalId) return byProposalId;
        }
        if (matching.providerEmail) {
          const byProposalEmail = providers.find((p) => p.email?.toLowerCase() === matching.providerEmail?.toLowerCase());
          if (byProposalEmail) return byProposalEmail;
        }
      }
    }
    return undefined;
  }

  getExpMpConnected(exp: Experience | null): boolean {
    if (!exp) return false;
    if (this.isClub(exp)) {
      return exp.mpConnected !== false;
    }
    const prov = this.getProviderForExperience(exp);
    if (prov) {
      return Boolean(prov.mpConnected && exp.mpConnected !== false);
    }
    return Boolean(exp.mpConnected);
  }

  getExpMpCollectorId(exp: Experience | null): string {
    if (!exp) return '';
    if (this.isClub(exp)) {
      return exp.mpCollectorId || 'CLUB-OFICIAL';
    }
    const prov = this.getProviderForExperience(exp);
    if (prov?.mpCollectorId) return prov.mpCollectorId;
    return exp.mpCollectorId || '';
  }

  getExpMpNickname(exp: Experience | null): string {
    if (!exp) return '';
    if (this.isClub(exp)) {
      return 'Club de Experiencias';
    }
    const prov = this.getProviderForExperience(exp);
    return prov?.mpNickname || prov?.agency || prov?.name || '';
  }

  syncMpFromProvider(): void {
    const prov = this.currentEditingProvider();
    if (!prov) return;
    this.editMpConnected.set(Boolean(prov.mpConnected));
    this.editMpCollectorId.set(prov.mpCollectorId || '');
    this.editMpNickname.set(prov.mpNickname || '');
    this.showToast(`Datos de Mercado Pago cargados desde el perfil de ${prov.name}.`);
  }

  readonly activeFormSelectedProviderId = signal<string | null>(null);

  onAdminProviderChange(event: {
    providerId: string;
    isClub: boolean;
    mpInfo?: {
      connected?: boolean;
      collectorId?: string;
      nickname?: string;
    };
  }): void {
    const currentExp = this.editingExperience();
    const isClub = event.isClub || event.providerId === 'club';

    let initialId: string | null = null;
    if (currentExp) {
      if (this.isClub(currentExp)) {
        initialId = 'club';
      } else {
        const prov = this.getProviderForExperience(currentExp);
        initialId = prov?.id || currentExp.providerId || 'custom';
      }
    }

    const previousSelectedId = this.activeFormSelectedProviderId();
    this.activeFormSelectedProviderId.set(event.providerId);

    const isInitialProvider =
      initialId !== null && (isClub ? initialId === 'club' : event.providerId === initialId);
    const hasBeenReassigned = previousSelectedId !== null && previousSelectedId !== initialId;

    if (isInitialProvider && !hasBeenReassigned) {
      return;
    }

    if (isInitialProvider && currentExp) {
      const prov = this.getProviderForExperience(currentExp);
      const hasMp = prov && prov.mpConnected !== undefined ? Boolean(prov.mpConnected) : this.getExpMpConnected(currentExp);
      this.editMpConnected.set(hasMp);
      this.editMpCollectorId.set(prov?.mpCollectorId || this.getExpMpCollectorId(currentExp));
      this.editMpNickname.set(prov?.mpNickname || this.getExpMpNickname(currentExp));
      return;
    }

    if (isClub) {
      this.editMpConnected.set(true);
      this.editMpCollectorId.set('CLUB-OFICIAL');
      this.editMpNickname.set('Club de Experiencias');
    } else if (event.providerId === 'custom') {
      this.editMpConnected.set(false);
      this.editMpCollectorId.set('');
      this.editMpNickname.set('');
    } else {
      const targetProv = this.registeredProviders().find((p) => p.id === event.providerId);
      if (targetProv) {
        this.editMpConnected.set(Boolean(targetProv.mpConnected));
        this.editMpCollectorId.set((targetProv.mpCollectorId || '').trim());
        this.editMpNickname.set((targetProv.mpNickname || targetProv.name || '').trim());
      } else if (event.mpInfo) {
        this.editMpConnected.set(Boolean(event.mpInfo.connected));
        this.editMpCollectorId.set((event.mpInfo.collectorId || '').trim());
        this.editMpNickname.set((event.mpInfo.nickname || '').trim());
      } else {
        this.editMpConnected.set(false);
        this.editMpCollectorId.set('');
        this.editMpNickname.set('');
      }
    }
  }

  readonly currentAdminMpInfo = computed(() => {
    const activeSelectedId = this.activeFormSelectedProviderId();
    if (activeSelectedId) {
      if (activeSelectedId === 'club') {
        return {
          connected: true,
          collectorId: 'CLUB_MP_OFICIAL',
          nickname: 'Club de Experiencias',
        };
      }
      if (activeSelectedId === 'custom') {
        return {
          connected: false,
          collectorId: '',
          nickname: '',
        };
      }
      const prov = this.registeredProviders().find((p) => p.id === activeSelectedId);
      if (prov) {
        return {
          connected: Boolean(prov.mpConnected),
          collectorId: prov.mpCollectorId || '',
          nickname: prov.mpNickname || prov.name || '',
        };
      }
    }

    const exp = this.editingExperience();
    const isClub = exp ? this.isClub(exp) : false;
    const prov = exp ? this.getProviderForExperience(exp) : null;
    return {
      connected: isClub ? true : Boolean(prov?.mpConnected ?? this.editMpConnected()),
      collectorId: isClub ? 'CLUB_MP_OFICIAL' : (prov?.mpCollectorId || this.editMpCollectorId()),
      nickname: isClub ? 'Club de Experiencias' : (prov?.mpNickname || this.editMpNickname()),
    };
  });

  async onSaveAdminExperience(event: { payload: ExperienceFormPayload }): Promise<void> {
    try {
      const p = event.payload;
      this.editTitle.set(p.title);
      if (p.slug) this.editSlug.set(p.slug);
      this.editTagline.set(p.tagline);
      this.editDescription.set(p.description);
      this.editCategory.set(p.category);
      this.editRegion.set(p.region);
      this.editMeetingPoint.set(p.meetingPoint);
      this.editMeetingPointUrl.set(p.meetingPointUrl);
      this.editItinerary.set(p.itinerary);
      this.editDifficulty.set(p.difficulty as any);
      this.editDurationLabel.set(p.durationLabel);
      this.editAltitude.set(p.altitudeMeters);
      this.editCapacity.set(p.capacityPerDate);
      this.editPriceArs.set(p.priceArs);
      this.editScheduledDates.set(p.dates);
      this.editDatesRaw.set(p.dates.length > 0 ? p.dates.join(', ') : 'A coordinar');
      this.editPricingPacks.set(p.pricingPacks);
      this.editCoverImage.set(p.coverImage);
      this.editVideoUrl.set(p.videoUrl);
      this.editAlbumPhotos.set(p.albumPhotos);
      this.editIncludedRaw.set(p.includedServices);
      this.editRequirementsRaw.set(p.participantRequirements);
      this.editHighlightsRaw.set(p.highlights.join('\n'));
      if (p.providerName !== undefined) this.editProviderName.set(p.providerName);
      if (p.providerId !== undefined) {
        this.editProviderId.set(p.providerId || '');
      } else {
        this.editProviderId.set('');
      }
      if (p.isClubExperience !== undefined) {
        if (p.isClubExperience) {
          this.activeFormSelectedProviderId.set('club');
        } else if (p.providerId) {
          this.activeFormSelectedProviderId.set(p.providerId);
        } else {
          this.activeFormSelectedProviderId.set('custom');
        }
      }
      if (p.providerPhone !== undefined) {
        const submittedPhone = (p.providerPhone || '').trim();
        const currentExp = this.editingExperience();
        const matchingProposal = currentExp ? this.findMatchingProposal(currentExp) : undefined;
        const currentResolvedPhone = (
          this.editProviderPhone() ||
          currentExp?.providerPhone ||
          matchingProposal?.providerPhone ||
          this.getExpProviderPhone(currentExp) ||
          ''
        ).trim();
        const finalPhone = submittedPhone || currentResolvedPhone;
        this.editProviderPhone.set(finalPhone);
      }
      if (p.providerCbuAlias !== undefined) this.editProviderCbuAlias.set(p.providerCbuAlias);
      if (p.providerCuitDni !== undefined) this.editProviderCuitDni.set(p.providerCuitDni);
      if (p.providerBankName !== undefined) this.editProviderBankName.set(p.providerBankName);
      if (p.status !== undefined) this.editStatus.set(p.status as any);
      if (p.displayLocation !== undefined) this.editDisplayLocation.set(p.displayLocation as any);

      await this.saveExperience();
    } finally {
      this.saving.set(false);
    }
  }

  onCancelAdminEdit(): void {
    this.closeEditModal();
  }

  openEditModal(exp: Experience): void {
    this.activeFormSelectedProviderId.set(null);
    this.isCreating.set(false);
    this.editingExperience.set(exp);

    this.editId.set(exp.id);
    this.editSlug.set(exp.slug);
    this.editCategory.set(exp.category || 'expediciones');
    this.editTitle.set(exp.title);
    this.editTagline.set(exp.tagline || '');
    this.editDescription.set(exp.description || '');
    this.editRegion.set(exp.region || 'Valle Central y Ambato');
    this.editMeetingPoint.set(exp.meetingPoint || '');
    this.editMeetingPointUrl.set(exp.meetingPointUrl || '');
    this.editItinerary.set(exp.itinerary || '');
    this.editDifficulty.set(exp.difficulty || 'Ninguna');
    this.editDurationLabel.set(exp.durationLabel || '4 horas (Media jornada)');
    const rawAlt = exp.altitudeMeters;
    const resolvedAltitude =
      typeof rawAlt === 'number' && Number.isFinite(rawAlt)
        ? rawAlt
        : rawAlt !== undefined &&
            rawAlt !== null &&
            String(rawAlt).replace(/\D/g, '') !== '' &&
            Number.isFinite(Number(String(rawAlt).replace(/\D/g, '')))
          ? Number(String(rawAlt).replace(/\D/g, ''))
          : 850;
    this.editAltitude.set(resolvedAltitude);
    this.editCapacity.set(exp.maxSpotsPerGroup || 12);
    this.editPriceArs.set(exp.priceArs || 65000);
    this.editPricingPacks.set(exp.pricingPacks ? exp.pricingPacks.map((p) => ({ ...p })) : []);
    const rawCover = exp.coverImage || '';
    const safeCover = rawCover.startsWith('blob:') ? '/assets/images/kayak-club-de-experiencias.jpg' : rawCover;
    this.editCoverImage.set(safeCover);

    const rawVideo = exp.videoUrl || '';
    const safeVideo = rawVideo.startsWith('blob:') ? '' : rawVideo;
    this.editVideoUrl.set(safeVideo);

    this.editVideoPoster.set(exp.videoPoster || '');
    const rawDates = Array.isArray(exp.dates)
      ? exp.dates
      : typeof exp.dates === 'string'
        ? [exp.dates]
        : [];
    const isoDates = Array.from(
      new Set(rawDates.flatMap((d) => parseConfirmedProposalDates(d))),
    ).sort();
    this.editScheduledDates.set(isoDates);
    const displayDates = isoDates.length > 0 ? isoDates.join(', ') : 'A coordinar';
    this.editDatesRaw.set(displayDates);
    this.newAdminScheduledDate.set('');
    this.adminScheduledDateError.set(null);

    const matchingProposal = this.findMatchingProposal(exp);
    const resolvedHighlights =
      exp.highlights && exp.highlights.length > 0
        ? exp.highlights.join('\n')
        : ((matchingProposal as any)?.highlights && (matchingProposal as any).highlights.length > 0
            ? (matchingProposal as any).highlights.join('\n')
            : '');
    const resolvedRequirements =
      matchingProposal?.participantRequirements ||
      (exp.notIncluded && exp.notIncluded.length > 0 ? exp.notIncluded.join('\n') : '');
    const resolvedIncluded =
      exp.included && exp.included.length > 0
        ? exp.included.join('\n')
        : (matchingProposal?.includedServices || '');

    this.editHighlightsRaw.set(resolvedHighlights);
    this.editRequirementsRaw.set(resolvedRequirements);
    this.editIncludedRaw.set(resolvedIncluded);

    const rawAlbum = exp.albumPhotos || [];
    const safeAlbum = rawAlbum
      .filter((p) => !p.isCover && p.url !== safeCover)
      .map((p) => ({
        ...p,
        isCover: false,
        url: p.url?.startsWith('blob:') ? '/assets/images/kayak-club-de-experiencias.jpg' : p.url,
      }));
    this.editAlbumPhotos.set(safeAlbum);
    this.editStatus.set(exp.status || 'publicada');
    this.editDisplayLocation.set(exp.displayLocation || 'destacada');

    const proposalCreatorName = (matchingProposal?.providerAgency || matchingProposal?.providerName || '').trim();
    const hasExternalProposalCreator =
      proposalCreatorName !== '' &&
      proposalCreatorName.toLowerCase() !== 'club de experiencias' &&
      proposalCreatorName.toLowerCase() !== 'club';

    const rawExpProviderName = (exp.providerName || exp.providerAgency || '').trim();
    const isExpProviderClub =
      !rawExpProviderName ||
      rawExpProviderName.toLowerCase() === 'club de experiencias' ||
      rawExpProviderName.toLowerCase() === 'club';

    // Priorizar al creador original (de la propuesta o de la experiencia) si no es el Club
    const resolvedProviderName =
      (hasExternalProposalCreator && isExpProviderClub)
        ? proposalCreatorName
        : (rawExpProviderName || proposalCreatorName);

    const expCreatorPhone = !isExpProviderClub ? (exp.providerPhone || '') : '';
    const expCreatorCbu = !isExpProviderClub ? (exp.providerCbuAlias || '') : '';
    const expCreatorCuit = !isExpProviderClub ? (exp.providerCuitDni || '') : '';
    const expCreatorBank = !isExpProviderClub ? (exp.providerBankName || '') : '';

    const resolvedProviderPhone =
      (hasExternalProposalCreator && isExpProviderClub)
        ? (matchingProposal?.providerPhone || '')
        : (expCreatorPhone || matchingProposal?.providerPhone || this.getExpProviderPhone(exp) || '');

    const resolvedProviderCbu =
      (hasExternalProposalCreator && isExpProviderClub)
        ? (matchingProposal?.providerCbuAlias || '')
        : (expCreatorCbu || matchingProposal?.providerCbuAlias || '');

    const resolvedProviderCuit =
      (hasExternalProposalCreator && isExpProviderClub)
        ? (matchingProposal?.providerCuitDni || '')
        : (expCreatorCuit || matchingProposal?.providerCuitDni || '');

    const resolvedProviderBank =
      (hasExternalProposalCreator && isExpProviderClub)
        ? (matchingProposal?.providerBankName || '')
        : (expCreatorBank || matchingProposal?.providerBankName || '');

    const isExplicitClub =
      !resolvedProviderName ||
      resolvedProviderName.toLowerCase() === 'club de experiencias' ||
      resolvedProviderName.toLowerCase() === 'club';

    let finalProviderName = resolvedProviderName;
    let finalProviderPhone = resolvedProviderPhone;
    let finalProviderCbu = resolvedProviderCbu;
    let finalProviderCuit = resolvedProviderCuit;
    let finalProviderBank = resolvedProviderBank;

    if (this.isClub(exp) && isExplicitClub) {
      const club = this.adminStore.clubProfile();
      finalProviderName = club.name || 'Club de Experiencias';
      finalProviderPhone = club.phone || '';
      finalProviderCbu = club.cbuAlias || '';
      finalProviderCuit = club.cuitDni || '';
      finalProviderBank = club.bankName || '';
    }

    this.editProviderName.set(finalProviderName);
    this.editProviderId.set(exp.providerId || '');
    this.editProviderPhone.set(finalProviderPhone);
    this.editProviderCbuAlias.set(finalProviderCbu);
    this.editProviderCuitDni.set(finalProviderCuit);
    this.editProviderBankName.set(finalProviderBank);

    this.editingExperience.set({
      ...exp,
      providerName: finalProviderName,
      providerPhone: finalProviderPhone,
      providerCbuAlias: finalProviderCbu,
      providerCuitDni: finalProviderCuit,
      providerBankName: finalProviderBank,
    });

    const prov = this.getProviderForExperience(exp);
    const hasMp = prov && prov.mpConnected !== undefined ? Boolean(prov.mpConnected) : this.getExpMpConnected(exp);
    const colId = prov?.mpCollectorId || this.getExpMpCollectorId(exp);
    const nickname = prov?.mpNickname || this.getExpMpNickname(exp);
    this.editMpConnected.set(hasMp);
    this.editMpCollectorId.set(colId);
    this.editMpNickname.set(nickname);

    void this.loadExperienceFavorites(exp);
  }

  async loadExperienceFavorites(exp?: Partial<Experience> | null): Promise<void> {
    const token = ++this.experienceFavoritesRequestToken;

    if (!exp) {
      this.detailFavoritedMembers.set([]);
      this.detailFavoritesError.set(null);
      this.isLoadingDetailFavorites.set(false);
      return;
    }

    this.isLoadingDetailFavorites.set(true);
    this.detailFavoritesError.set(null);

    try {
      if (!this.supabase || !isSupabaseConfigured()) {
        if (token !== this.experienceFavoritesRequestToken) return;
        this.detailFavoritedMembers.set([]);
        this.detailFavoritesError.set(null);
        return;
      }

      if (this.adminStore.members().length === 0) {
        await this.adminStore.loadAllMembers();
      }
      if (token !== this.experienceFavoritesRequestToken) return;
      const members = this.adminStore.members();

      const candidateKeys = Array.from(
        new Set(
          [exp.id, exp.slug, (exp as any).initialSlug, ...(exp.slugAliases || [])]
            .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
            .map((k) => k.trim())
        )
      );

      if (candidateKeys.length === 0) {
        if (token !== this.experienceFavoritesRequestToken) return;
        this.detailFavoritedMembers.set([]);
        this.detailFavoritesError.set(null);
        return;
      }

      const { data, error } = await this.supabase
        .from('experiencias_favoritas' as any)
        .select('id, socio_id, socio_email, experience_id, created_at')
        .in('experience_id', candidateKeys)
        .order('created_at', { ascending: false });

      if (token !== this.experienceFavoritesRequestToken) return;

      if (error) {
        this.detailFavoritedMembers.set([]);
        this.detailFavoritesError.set(
          typeof error === 'object' && (error as any)?.message
            ? String((error as any).message)
            : 'Error al consultar favoritos en la base de datos.'
        );
        return;
      }

      if (!data) {
        this.detailFavoritedMembers.set([]);
        this.detailFavoritesError.set('No se recibieron datos de favoritos desde la base de datos.');
        return;
      }

      const favoritedMembers: ExperienceFavoritedMember[] = [];
      const seen = new Set<string>();

      for (const row of (data as any[])) {
        const socioId = row.socio_id;
        const socioEmail = (row.socio_email || '').toLowerCase().trim();
        const uniqueKey = socioEmail || socioId || row.id;
        if (seen.has(uniqueKey)) continue;
        seen.add(uniqueKey);

        const matched = members.find((m) => {
          if (socioId && m.id === socioId) return true;
          if (socioEmail && m.email && m.email.toLowerCase().trim() === socioEmail) return true;
          return false;
        });

        favoritedMembers.push({
          id: socioId || matched?.id,
          name: matched?.fullName || matched?.email?.split('@')[0] || row.socio_email?.split('@')[0] || 'Socio',
          email: matched?.email || row.socio_email || '—',
          phone: matched?.phone && matched.phone !== '—' ? matched.phone : undefined,
          avatar: matched?.avatarUrl,
          tier: matched?.membershipTier || 'socio',
          memberNumber: matched?.position ?? null,
          favoritedAt: row.created_at,
        });
      }

      if (token !== this.experienceFavoritesRequestToken) return;
      this.detailFavoritedMembers.set(favoritedMembers);
      this.detailFavoritesError.set(null);
    } catch (err: any) {
      if (token !== this.experienceFavoritesRequestToken) return;
      this.detailFavoritedMembers.set([]);
      this.detailFavoritesError.set(
        err?.message ? String(err.message) : 'Error inesperado al cargar los favoritos de la experiencia.'
      );
    } finally {
      if (token === this.experienceFavoritesRequestToken) {
        this.isLoadingDetailFavorites.set(false);
      }
    }
  }

  openCreateModal(): void {
    this.experienceFavoritesRequestToken++;
    this.detailFavoritedMembers.set([]);
    this.detailFavoritesError.set(null);
    this.isLoadingDetailFavorites.set(false);
    this.activeFormSelectedProviderId.set(null);
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
      difficulty: 'Ninguna',
      durationDays: 1,
      durationLabel: '4 horas (Media jornada)',
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
    this.editCategory.set('expediciones');
    this.editTitle.set('');
    this.editTagline.set('');
    this.editDescription.set('');
    this.editRegion.set('Catamarca');
    this.editMeetingPoint.set('');
    this.editMeetingPointUrl.set('');
    this.editItinerary.set('');
    this.editDifficulty.set('Ninguna');
    this.editDurationLabel.set('4 horas (Media jornada)');
    this.editAltitude.set(1000);
    this.editCapacity.set(10);
    this.editPriceArs.set(75000);
    this.editPricingPacks.set([]);
    this.editCoverImage.set('/assets/images/kayak-club-de-experiencias.jpg');
    this.editVideoUrl.set('');
    this.editVideoPoster.set('');
    this.editScheduledDates.set([]);
    this.newAdminScheduledDate.set('');
    this.adminScheduledDateError.set(null);
    this.editDatesRaw.set('A coordinar');
    this.editHighlightsRaw.set('');
    this.editRequirementsRaw.set('');
    this.editIncludedRaw.set('');
    this.editAlbumPhotos.set([]);
    this.editStatus.set('publicada');
    this.editDisplayLocation.set('destacada');
    this.editProviderName.set('');
    this.editProviderId.set('');
    this.editProviderPhone.set('');
    this.editProviderCbuAlias.set('');
    this.editProviderCuitDni.set('');
    this.editProviderBankName.set('');
    this.editMpConnected.set(false);
    this.editMpCollectorId.set('');
    this.editMpNickname.set('');
  }

  closeEditModal(): void {
    this.experienceFavoritesRequestToken++;
    this.detailFavoritedMembers.set([]);
    this.detailFavoritesError.set(null);
    this.isLoadingDetailFavorites.set(false);
    const currentExp = this.editingExperience();
    this.editingExperience.set(null);
    this.isCreating.set(false);
    if (this.isRouteEditMode() || this.isRouteCreateMode()) {
      if (this.isRouteEditMode() && currentExp?.slug) {
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
      this.showToast('Imagen de portada subida con éxito');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al subir portada';
      this.showToast(msg);
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
      this.showToast('Video subido con éxito');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al subir video';
      this.showToast(msg);
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
      this.showToast('La galería común ya alcanzó el límite máximo de 9 fotos.');
      input.value = '';
      return;
    }

    let filesToUpload = files;
    if (files.length > remainingGallerySlots) {
      filesToUpload = files.slice(0, remainingGallerySlots);
      this.showToast(
        `Se seleccionaron ${files.length} fotos. Solo se subirán las primeras ${remainingGallerySlots} para respetar el límite de 9 de galería.`,
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
      this.showToast(`${newPhotos.length} foto(s) agregada(s) a la galería`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al subir fotos';
      this.showToast(msg);
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
        this.showToast('No se puede desmarcar: la galería común ya tiene el límite máximo de 9 fotos.');
        return;
      }
      this.editAlbumPhotos.update((photos) =>
        photos.map((p, i) => (i === index ? { ...p, isFeatured: false } : p)),
      );
      this.showToast('Foto desmarcada como destacada.');
      return;
    }

    if (this.featuredPhotos().length >= 2) {
      this.showToast('Ya tenés 2 fotos seleccionadas como destacadas. Desmarcá una primero.');
      return;
    }

    this.editAlbumPhotos.update((photos) =>
      photos.map((p, i) => (i === index ? { ...p, isFeatured: true } : p)),
    );
    this.showToast('Foto marcada como destacada (máx 2).');
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
    this.showToast('Foto eliminada del álbum.');
  }

  /**
   * Guarda o actualiza una experiencia desde el panel de administración.
   * Valida campos obligatorios, fechas de salida e inclusiones, y gestiona
   * la transición de propuestas pendientes a publicadas o rechazadas.
   */
  async saveExperience(): Promise<void> {
    const title = this.editTitle().trim();
    if (!title) {
      this.showToast('Por favor ingresá un título para la experiencia.');
      return;
    }
    if (title.length < 6) {
      this.showToast('El título debe tener al menos 6 caracteres.');
      return;
    }

    const rawSlug = this.editSlug().trim() || title;
    let slug = rawSlug
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    if (!slug) {
      this.showToast('La ruta o slug oficial no puede estar vacía.');
      return;
    }

    if (RESERVED_EXPERIENCE_SLUGS.has(slug.toLowerCase())) {
      slug = `${slug}-exp`;
      this.editSlug.set(slug);
    }

    if (slug.length > 40) {
      this.showToast(`La ruta o slug oficial no puede superar los 40 caracteres (longitud actual: ${slug.length}).`);
      return;
    }

    const tagline = this.editTagline().trim();
    if (!tagline) {
      this.showToast('Por favor ingresá un subtítulo o bajada destacada (tagline).');
      return;
    }

    const description = this.editDescription().trim();
    if (!description) {
      this.showToast('Por favor ingresá una descripción atractiva de la experiencia.');
      return;
    }

    const region = this.editRegion().trim();
    if (!region) {
      this.showToast('Por favor indicá la región turística de Catamarca.');
      return;
    }

    const meetingPoint = this.editMeetingPoint().trim();
    if (!meetingPoint) {
      this.showToast('Por favor indicá el punto de encuentro.');
      return;
    }

    let meetingPointUrl = this.editMeetingPointUrl().trim();
    if (!meetingPointUrl) {
      meetingPointUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(meetingPoint + ', Catamarca')}`;
      this.editMeetingPointUrl.set(meetingPointUrl);
    } else if (!this.isValidGoogleMapsUrl(meetingPointUrl)) {
      meetingPointUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(meetingPointUrl + ', Catamarca')}`;
      this.editMeetingPointUrl.set(meetingPointUrl);
    }

    const durationLabel = this.editDurationLabel().trim();
    if (!durationLabel) {
      this.showToast('Por favor indicá la duración estimada de la experiencia.');
      return;
    }

    const capacity = Number(this.editCapacity()) || 0;
    if (capacity < 1 || capacity > 200) {
      this.showToast('El cupo máximo por salida debe ser entre 1 y 200 personas.');
      return;
    }

    let itinerary = this.editItinerary().trim();
    if (!itinerary) {
      itinerary = 'Horario y desarrollo de la actividad a coordinar con el prestador.';
      this.editItinerary.set(itinerary);
    }

    const priceArs = Number(this.editPriceArs()) || 0;
    if (priceArs < 1000) {
      this.showToast('Por favor ingresá un arancel válido en pesos ($ ARS, mínimo $1.000).');
      return;
    }

    let datesRaw = this.editDatesRaw().trim();
    if (!datesRaw) {
      datesRaw = 'A coordinar';
      this.editDatesRaw.set('A coordinar');
    }

    const isUnscheduledProposal = datesRaw.toLowerCase().includes('a coordinar');
    const confirmedDates = isUnscheduledProposal ? [] : parseConfirmedProposalDates(datesRaw);
    const dates: string[] = isUnscheduledProposal ? [] : confirmedDates;

    if (!isUnscheduledProposal && confirmedDates.length === 0) {
      this.showToast('Por favor definí al menos una fecha válida (YYYY-MM-DD) o dejá el campo como "A coordinar".');
      return;
    }

    const included = this.editIncludedRaw()
      .split('\n')
      .map((i) => i.trim())
      .filter((i) => i.length > 0);

    const highlights = this.editHighlightsRaw()
      .split('\n')
      .map((h) => h.trim())
      .filter((h) => h.length > 0);

    const notIncluded = this.editRequirementsRaw()
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    let coverImage = this.editCoverImage().trim();
    if (!coverImage || coverImage.startsWith('blob:')) {
      coverImage = '/assets/images/kayak-club-de-experiencias.jpg';
      this.editCoverImage.set(coverImage);
    }

    const priceUsd = Math.round(priceArs / (this.adminStore.usdExchangeRate() || 1400));

    const currentExp = this.editingExperience();
    const matchingProposal = currentExp ? this.findMatchingProposal(currentExp) : undefined;
    const inputProviderName = this.editProviderName().trim();
    const inputProviderPhone = (
      this.editProviderPhone().trim() ||
      (currentExp ? this.getExpProviderPhone(currentExp) : '') ||
      matchingProposal?.providerPhone ||
      ''
    ).trim();
    const inputProviderCbu = this.editProviderCbuAlias().trim();
    const inputProviderCuit = this.editProviderCuitDni().trim();
    const inputProviderBank = this.editProviderBankName().trim();

    const proposalCreatorName = (matchingProposal?.providerAgency || matchingProposal?.providerName || '').trim();
    const expCreatorName = (currentExp?.providerName || currentExp?.providerAgency || '').trim();
    const isExpCreatorClub =
      !expCreatorName ||
      expCreatorName.toLowerCase() === 'club de experiencias' ||
      expCreatorName.toLowerCase() === 'club';

    const fallbackCreatorName = (proposalCreatorName && isExpCreatorClub)
      ? proposalCreatorName
      : (expCreatorName || proposalCreatorName);

    const finalProviderName = inputProviderName || fallbackCreatorName;
    const explicitProviderId = (this.editProviderId() || '').trim();
    const isExplicitClub =
      this.activeFormSelectedProviderId() === 'club' ||
      inputProviderName.toLowerCase() === 'club de experiencias' ||
      inputProviderName.toLowerCase() === 'club';

    const isExplicitCustomOrExternal =
      this.activeFormSelectedProviderId() === 'custom' ||
      (explicitProviderId !== '' && explicitProviderId !== 'club') ||
      (inputProviderName !== '' && !isExplicitClub);

    const isExternalExperience = Boolean(currentExp && !this.isClub(currentExp) && !this.isCreating());
    const isClub =
      isExplicitClub ||
      (!isExplicitCustomOrExternal &&
        !isExternalExperience &&
        (!finalProviderName ||
          finalProviderName.toLowerCase() === 'club de experiencias' ||
          finalProviderName.toLowerCase() === 'club'));
    const club = this.adminStore.clubProfile();

    const resolvedProviderPhone = isClub
      ? (club.phone || '')
      : (inputProviderPhone || currentExp?.providerPhone || matchingProposal?.providerPhone || '');

    const resolvedProviderCbu = isClub
      ? (club.cbuAlias || '')
      : (inputProviderCbu || currentExp?.providerCbuAlias || matchingProposal?.providerCbuAlias || '');

    const resolvedProviderCuit = isClub
      ? (club.cuitDni || '')
      : (inputProviderCuit || currentExp?.providerCuitDni || matchingProposal?.providerCuitDni || '');

    const resolvedProviderBank = isClub
      ? (club.bankName || '')
      : (inputProviderBank || currentExp?.providerBankName || matchingProposal?.providerBankName || '');

    if (!isClub) {
      if (!resolvedProviderPhone) {
        this.showToast('Por favor ingresá el teléfono o WhatsApp de contacto del prestador.');
        return;
      }
      if (!resolvedProviderCbu) {
        this.showToast('Por favor ingresá el CBU / CVU o Alias de cobro del prestador.');
        return;
      }
      if (!resolvedProviderCuit) {
        this.showToast('Por favor ingresá el CUIT o DNI del prestador.');
        return;
      }
      if (!resolvedProviderBank) {
        this.showToast('Por favor ingresá el banco o entidad financiera del prestador.');
        return;
      }
    }

    const resolvedProviderName = isClub
      ? (club.name || 'Club de Experiencias')
      : finalProviderName;

    const matchedProvider = !isClub
      ? (explicitProviderId
          ? this.registeredProviders().find((p) => p.id === explicitProviderId)
          : undefined) ||
        this.registeredProviders().find((p) => {
          const pName = (p.name || '').trim().toLowerCase();
          const pAgency = (p.agency || '').trim().toLowerCase();
          const targetName = resolvedProviderName.toLowerCase().trim();
          return (pName && pName === targetName) || (pAgency && pAgency === targetName);
        })
      : undefined;

    const proposalAgency = matchingProposal?.providerAgency || matchingProposal?.providerName;
    const fallbackSlug = (proposalAgency && !isClub ? slugify(proposalAgency) : undefined) || (resolvedProviderName && !isClub ? slugify(resolvedProviderName) : undefined);

    const isSameProviderAsCurrent = Boolean(
      currentExp &&
      (matchedProvider
        ? (currentExp.providerId && currentExp.providerId === matchedProvider.id) ||
          (currentExp.providerEmail && matchedProvider.email && currentExp.providerEmail.toLowerCase() === matchedProvider.email.toLowerCase())
        : (currentExp.providerName && resolvedProviderName && currentExp.providerName.toLowerCase().trim() === resolvedProviderName.toLowerCase().trim()))
    );

    const resolvedProviderSlug = isClub
      ? 'club-de-experiencias'
      : (matchedProvider?.slug ||
        (isSameProviderAsCurrent && currentExp?.providerSlug && currentExp.providerSlug !== 'club-de-experiencias' && currentExp.providerSlug !== 'club'
          ? currentExp.providerSlug
          : (fallbackSlug || '')));

    const resolvedProviderEmail = isClub
      ? (club.email || 'admin@experiencias.club')
      : (matchedProvider?.email ||
        (isSameProviderAsCurrent && currentExp?.providerEmail && currentExp.providerEmail !== 'admin@experiencias.club' && currentExp.providerEmail !== 'hola@experiencias.club'
          ? currentExp.providerEmail
          : (matchingProposal?.providerEmail || '')));

    const resolvedProviderId: string | null = isClub
      ? null
      : (matchedProvider?.id || (explicitProviderId ? explicitProviderId : null) || (isSameProviderAsCurrent ? (currentExp?.providerId ?? null) : null));

    const safeAlbumPhotos = this.editAlbumPhotos().map((p) => ({
      ...p,
      url: p.url?.startsWith('blob:') ? '/assets/images/kayak-club-de-experiencias.jpg' : p.url,
    }));
    const rawVideoUrl = this.editVideoUrl().trim();
    const safeVideoUrl = rawVideoUrl.startsWith('blob:') ? '' : rawVideoUrl;

    const authoritativeProviders = this.registeredProviders();
    const authoritativeMatch = matchedProvider
      ? authoritativeProviders.find(
          (p) =>
            (p.id && matchedProvider.id && p.id === matchedProvider.id) ||
            (p.email && matchedProvider.email && p.email.toLowerCase().trim() === matchedProvider.email.toLowerCase().trim()),
        )
      : (resolvedProviderId
          ? authoritativeProviders.find((p) => p.id === resolvedProviderId)
          : undefined);

    const targetProvider =
      matchedProvider ||
      authoritativeMatch ||
      (resolvedProviderId
        ? authoritativeProviders.find((p) => p.id === resolvedProviderId)
        : undefined);

    const payload: Partial<Experience> & { id: string } = {
      id: this.editId(),
      slug,
      title,
      shortTitle: title,
      tagline: this.editTagline().trim(),
      description: this.editDescription().trim(),
      category: this.editCategory(),
      region: this.editRegion().trim() || 'Catamarca',
      meetingPoint,
      meetingPointUrl,
      itinerary,
      difficulty: this.editDifficulty(),
      durationLabel: this.editDurationLabel().trim() || '4 horas (Media jornada)',
      altitudeMeters: Number(this.editAltitude()) || 0,
      maxSpotsPerGroup: Number(this.editCapacity()) || 12,
      priceArs,
      priceUsd,
      pricingPacks: this.editPricingPacks(),
      coverImage,
      albumPhotos: safeAlbumPhotos,
      galleryImages:
        safeAlbumPhotos.length > 0
          ? safeAlbumPhotos.map((p) => p.url)
          : [coverImage],
      providerName: resolvedProviderName,
      providerPhone: resolvedProviderPhone,
      providerCbuAlias: resolvedProviderCbu,
      providerCuitDni: resolvedProviderCuit,
      providerBankName: resolvedProviderBank,
      providerSlug: resolvedProviderSlug,
      providerEmail: resolvedProviderEmail,
      providerId: resolvedProviderId,
      isClubExperience: isClub,
      mpConnected: isClub
        ? (isExternalExperience ? true : this.editMpConnected())
        : (targetProvider && targetProvider.mpConnected !== undefined
          ? Boolean(targetProvider.mpConnected)
          : this.editMpConnected()),
      mpCollectorId: isClub
        ? (isExternalExperience ? 'CLUB-OFICIAL' : (this.editMpCollectorId().trim() || 'CLUB-OFICIAL'))
        : (targetProvider && targetProvider.mpConnected !== undefined
          ? (targetProvider.mpCollectorId || '').trim()
          : this.editMpCollectorId().trim()),
      videoUrl: safeVideoUrl,
      videoPoster: this.editVideoPoster().trim(),
      dates,
      highlights,
      included,
      notIncluded,
      status: this.editStatus(),
      displayLocation: this.editStatus() === 'publicada' ? this.editDisplayLocation() : (this.editDisplayLocation() || 'destacada'),
      publicUrl: `https://experiencias.club/experiencias/${slug}`,
      detailRoute: this.editCategory() === 'hospedajes' ? `/experiencias/hospedajes/${slug}` : `/experiencias/${slug}`,
    };

    const resolvedInitialSlug =
      currentExp?.initialSlug ||
      currentExp?.slug ||
      slug;

    const aliasSet = new Set<string>();
    if (Array.isArray(currentExp?.slugAliases)) {
      currentExp!.slugAliases.forEach((a) => {
        if (a) aliasSet.add(a.toLowerCase().trim());
      });
    }
    if (currentExp?.slug && currentExp.slug.toLowerCase().trim() !== slug.toLowerCase().trim()) {
      aliasSet.add(currentExp.slug.toLowerCase().trim());
    }
    if (resolvedInitialSlug && resolvedInitialSlug.toLowerCase().trim() !== slug.toLowerCase().trim()) {
      aliasSet.add(resolvedInitialSlug.toLowerCase().trim());
    }
    aliasSet.delete(slug.toLowerCase().trim());
    const resolvedSlugAliases = Array.from(aliasSet).filter(Boolean);

    payload.initialSlug = resolvedInitialSlug;
    payload.slugAliases = resolvedSlugAliases;

    this.saving.set(true);
    try {
      if (this.isCreating()) {
        let serializedNotes: string | undefined = undefined;
        const rawCollectorId = payload.mpCollectorId?.trim();
        const isMpConn = payload.mpConnected;
        const notesObj: Record<string, any> = {};
        if (rawCollectorId) notesObj['mp_collector_id'] = rawCollectorId;
        if (isMpConn !== undefined) notesObj['mp_connected'] = isMpConn;
        notesObj['initial_slug'] = slug;
        serializedNotes = JSON.stringify(notesObj);

        const fullNewExp: Experience = {
          ...payload,
          initialSlug: slug,
          slugAliases: [],
          notes: serializedNotes,
          kicker: '',
          bestSeason: '',
          durationDays: 1,
          galleryImages: payload.galleryImages || [payload.coverImage!],
          isExclusiveClub: true,
          isLocked: false,
        } as Experience;
        await this.experienceService.createExperience(fullNewExp);
        this.showToast(
          `Experiencia "${title}" creada exitosamente en la ruta /experiencias/${slug}.`,
        );
      } else {
        const isFromPending = currentExp?.status === 'pendiente';
        const newStatus = payload.status;

        if (isFromPending && (newStatus === 'publicada' || newStatus === 'rechazada')) {
          const reviewedAt = new Date().toISOString();
          payload.reviewedAt = reviewedAt;

          let req = this.findMatchingProposal({ id: payload.id, slug });

          if (!req) {
            await this.adminStore.providerStore.loadProposalsFromSupabase();
            req = this.findMatchingProposal({ id: payload.id, slug });
          }

          if (newStatus === 'publicada') {
            const confirmedDates = parseConfirmedProposalDates(this.editDatesRaw());
            if (!isUnscheduledProposal && confirmedDates.length === 0) {
              this.showToast(
                'No se puede publicar la experiencia: las fechas no tienen un formato válido (YYYY-MM-DD). Para salidas flexibles usá "A coordinar".',
              );
              return;
            }
            payload.dates = isUnscheduledProposal ? [] : confirmedDates;

            if (req) {
              const approvedOk = await this.adminStore.approveExperienceRequest(
                req.id,
                payload.publicUrl,
                confirmedDates.length > 0 ? confirmedDates : undefined,
              );
              if (!approvedOk) {
                this.showToast(
                  `No se pudo confirmar la aprobación de la propuesta "${title}" (ID: ${payload.id}).`,
                );
                return;
              }
            }
            // Preserve and apply the other form edits as part of the same save
            const { slug: _requestedSlug, ...payloadWithoutSlug } = payload;
            await this.experienceService.updateExperience(payloadWithoutSlug);
            this.showToast(`La propuesta "${title}" fue aprobada y publicada con sus cambios.`);
          } else {
            // Rechazada
            if (req) {
              await this.adminStore.rejectExperienceRequest(req.id);
            }
            // Preserve and apply the other form edits as part of the same save
            await this.experienceService.updateExperience(payload);
            this.showToast(`La propuesta "${title}" fue rechazada.`);
          }

          this.adminStore.providerStore.reloadFromStorage();
          await this.adminStore.providerStore.loadProposalsFromSupabase();
          await this.experienceService.reloadFromSupabase();
        } else {
          await this.experienceService.updateExperience(payload);
          await this.experienceService.reloadFromSupabase();
          this.showToast(`Información de la ruta /experiencias/${slug} actualizada con éxito.`);
        }
      }

      const updated = this.experienceService.getExperienceById(payload.id);
      const targetSlug = updated?.slug || payload.slug || slug;
      const targetPublicUrl =
        updated?.publicUrl || payload.publicUrl || `https://experiencias.club/experiencias/${targetSlug}`;
      const targetDetailRoute = updated?.detailRoute || payload.detailRoute;

      // Propagar actualización de slug y publicUrl a providerStore para consistencia global
      if (this.adminStore?.providerStore) {
        try {
          this.adminStore.providerStore.updateExperiencePublicUrl?.(payload.id, targetPublicUrl);
          if (typeof (this.adminStore.providerStore as any).updateExperience === 'function') {
            (this.adminStore.providerStore as any).updateExperience(payload.id, {
              slug: targetSlug,
              publicUrl: targetPublicUrl,
              detailRoute: targetDetailRoute,
            });
          }
        } catch {
          // ignore
        }
      }

      if (updated && this.editingExperience()?.id === payload.id) {
        this.editingExperience.set(updated);
      }
      if (this.isRouteEditMode() || this.isRouteCreateMode()) {
        this.router.navigateByUrl(this.getDetailRoute(updated || ({ slug: targetSlug } as Experience)));
      } else {
        this.closeEditModal();
      }
    } catch (err: unknown) {
      console.error('[AdminExperiences] Error al guardar experiencia:', err);
      const msg = err instanceof Error ? err.message : 'Error al guardar experiencia';
      this.showToast(msg);
    } finally {
      this.saving.set(false);
    }
  }

  private findMatchingProposal(exp: { id: string; slug?: string; title?: string }): ExperienceProposalRequest | undefined {
    const list = this.adminStore.providerStore.experienceRequests();
    // 1. Coincidencia directa por id
    const direct = list.find((r) => r.id === exp.id);
    if (direct) return direct;

    // 2. Mapeo de identidad explícito para entradas heredadas
    const LEGACY_PROPOSAL_MAP: Record<string, string> = {
      'exp-sunset-las-pirquitas': 'req-sunset-las-pirquitas',
      'exp-travesia-en-kayak-nocturna-luna-llena-en-el-jumeal': 'req-sunset-las-pirquitas',
      'travesia-en-kayak-nocturna-luna-llena-en-el-jumeal': 'req-sunset-las-pirquitas',
    };
    const mappedById = LEGACY_PROPOSAL_MAP[exp.id];
    if (mappedById) {
      const mapped = list.find((r) => r.id === mappedById);
      if (mapped) return mapped;
    }
    if (exp.slug) {
      const mappedBySlug = LEGACY_PROPOSAL_MAP[exp.slug];
      if (mappedBySlug) {
        const mapped = list.find((r) => r.id === mappedBySlug);
        if (mapped) return mapped;
      }
    }

    // 3. Mapeo por ID limpio ignorando prefijos 'exp-' y 'req-'
    const cleanExpId = exp.id.replace(/^(?:exp|req)-/, '');
    const byCleanId = list.find((r) => r.id.replace(/^(?:exp|req)-/, '') === cleanExpId);
    if (byCleanId) return byCleanId;

    // 4. Mapeo explícito por prefijo 'exp-' en id
    if (exp.id.startsWith('exp-')) {
      const stripped = exp.id.slice(4);
      const byStripped = list.find((r) => r.id === stripped);
      if (byStripped) return byStripped;
    } else {
      const prefixed = `exp-${exp.id}`;
      const byPrefixed = list.find((r) => r.id === prefixed);
      if (byPrefixed) return byPrefixed;
    }

    // 5. Coincidencia por slug o título (únicamente si hay coincidencia unívoca)
    if (exp.slug) {
      const cleanSlug = exp.slug.toLowerCase().trim();
      const slugMatches = list.filter(
        (r) =>
          (r.slug && r.slug.toLowerCase().trim() === cleanSlug) ||
          (r.title && slugify(r.title) === cleanSlug),
      );
      if (slugMatches.length === 1) {
        return slugMatches[0];
      }
    }

    if (exp.title) {
      const titleSlug = slugify(exp.title);
      const titleMatches = list.filter((r) => r.title && slugify(r.title) === titleSlug);
      if (titleMatches.length === 1) {
        return titleMatches[0];
      }
    }

    return undefined;
  }

  private mapProposalToExperience(req: ExperienceProposalRequest): Experience {
    const generatedSlug = req.slug || slugify(req.title);
    const rawDates = Array.isArray(req.dates)
      ? req.dates
      : typeof req.dates === 'string'
        ? parseConfirmedProposalDates(req.dates)
        : [];
    const rawDifficulty = req.difficulty ? req.difficulty.split('(')[0].trim() : '';
    const allowedDifficulties: readonly Experience['difficulty'][] = [
      'Ninguna',
      'Baja',
      'Moderada',
      'Exigente',
      'Alta Montaña',
    ];
    const normalizedDifficulty =
      allowedDifficulties.find((d) => d.toLowerCase() === rawDifficulty.toLowerCase()) || 'Ninguna';

    return {
      id: req.id,
      slug: generatedSlug,
      title: req.title,
      shortTitle: req.title.split('&')[0].trim(),
      kicker: req.kicker || 'EXPERIENCIA',
      tagline:
        req.subheading && req.subheading.length > 90
          ? req.subheading.slice(0, 90) + '...'
          : req.subheading || req.title,
      description: req.subheading || req.title,
      region: req.region || 'Catamarca',
      meetingPoint: req.meetingPoint || '',
      meetingPointUrl: req.meetingPointUrl,
      difficulty: normalizedDifficulty,
      durationDays: 1,
      durationLabel: req.duration || '1 día',
      altitudeMeters: Number(req.altitude?.replace(/\D/g, '')) || 850,
      bestSeason: req.season || 'Todo el año',
      priceArs: req.priceArs,
      priceUsd: req.priceUsd ?? 70,
      promosAndPricing: req.promosAndPricing || undefined,
      maxSpotsPerGroup: req.capacity || 12,
      dates: rawDates,
      status: (req.status as any) || 'pendiente',
      category: (req.category as any) || 'expediciones',
      detailRoute:
        req.category === 'hospedajes'
          ? `/experiencias/hospedajes/${generatedSlug}`
          : `/experiencias/${generatedSlug}`,
      itinerary: req.itinerary || '',
      included: req.includedServices
        ? req.includedServices.split('\n').filter((l) => l.trim())
        : [],
      highlights: req.participantRequirements
        ? req.participantRequirements.split('\n').filter((l) => l.trim())
        : [],
      notes: req.notes,
      coverImage: req.coverImage || '/assets/images/kayak-club-de-experiencias.jpg',
      coverImageName: req.coverImageName,
      videoUrl: req.coverVideoUrl,
      videoPoster: req.coverImage,
      albumPhotos: req.albumPhotos || [],
      galleryImages: req.galleryImages || [],
      providerId: req.providerId,
      providerName: req.providerAgency || req.providerName,
      providerAgency: req.providerAgency,
      providerEmail: req.providerEmail,
      providerPhone: req.providerPhone,
      isExclusiveClub: false,
      reviewedAt: req.reviewedAt,
    };
  }

  private mapProviderExpToExperience(p: ProviderExperience): Experience {
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      shortTitle: p.shortTitle || p.title.split('&')[0].trim(),
      kicker: 'EXPERIENCIA',
      tagline: p.tagline,
      description: p.description,
      region: p.region,
      meetingPoint: p.meetingPoint,
      meetingPointUrl: p.meetingPointUrl,
      difficulty: p.difficulty,
      durationDays: 1,
      durationLabel: p.durationLabel,
      altitudeMeters: p.altitudeMeters || 850,
      bestSeason: 'Todo el año',
      priceArs: p.priceArs,
      priceUsd: 70,
      pricingPacks: p.pricingPacks,
      maxSpotsPerGroup: p.capacityPerDate || 12,
      dates: p.dates || [],
      status: (p.status as any) || 'pendiente',
      category: (p.category as any) || 'expediciones',
      detailRoute:
        p.category === 'hospedajes'
          ? `/experiencias/hospedajes/${p.slug}`
          : `/experiencias/${p.slug}`,
      publicUrl: p.publicUrl,
      itinerary: p.itinerary || '',
      included:
        p.included ||
        (p.includedServices ? p.includedServices.split('\n').filter((l) => l.trim()) : []),
      highlights:
        p.highlights ||
        (p.participantRequirements
          ? p.participantRequirements.split('\n').filter((l) => l.trim())
          : []),
      coverImage: p.coverImage || '/assets/images/kayak-club-de-experiencias.jpg',
      videoUrl: p.videoUrl || p.coverVideoUrl,
      videoPoster: p.coverImage,
      albumPhotos: p.albumPhotos || [],
      galleryImages: p.galleryImages || [],
      providerId: p.providerId,
      providerName: p.providerName,
      providerEmail: p.providerEmail,
      providerPhone: p.providerPhone,
      isExclusiveClub: false,
    };
  }

  async approveProposal(exp: Experience): Promise<void> {
    if (this.isProposalProcessing(exp.id)) {
      return;
    }
    this.processingProposalIds.update((set) => new Set(set).add(exp.id));

    try {
      let req = this.findMatchingProposal(exp);

      if (!req) {
        await this.adminStore.providerStore.loadProposalsFromSupabase();
        req = this.findMatchingProposal(exp);
      }

      const datesRaw = Array.isArray(exp.dates)
        ? exp.dates.join(', ')
        : typeof exp.dates === 'string'
          ? exp.dates
          : req?.dates || '';

      const rawTrimmed = (datesRaw || '').trim();
      const isExplicitCoordinating = /coordinar/i.test(rawTrimmed);
      const confirmedDates = parseConfirmedProposalDates(datesRaw);

      if (rawTrimmed && !isExplicitCoordinating && confirmedDates.length === 0) {
        this.showToast('No se puede aprobar: las fechas no tienen un formato válido (AAAA-MM-DD o "A coordinar").');
        return;
      }

      const reviewedAt = new Date().toISOString();

      if (req) {
        let approvedOk = false;
        try {
          approvedOk = await this.adminStore.approveExperienceRequest(
            req.id,
            exp.publicUrl,
            confirmedDates.length > 0 ? confirmedDates : undefined,
          );
        } catch (provErr) {
          console.error('[AdminExperiences] Excepción al confirmar aprobación en ProviderStore:', provErr);
          approvedOk = false;
        }

        if (!approvedOk) {
          this.showToast(
            `No se pudo confirmar la aprobación del prestador para "${exp.title}" (ID: ${exp.id}).`,
          );
          return;
        }

        try {
          await this.experienceService.updateExperience({
            id: exp.id,
            slug: exp.slug,
            status: 'publicada',
            dates: confirmedDates,
            reviewedAt,
          });
        } catch {
          // Ya fue creado/actualizado en ExperienceService por approveExperienceRequest
        }
      } else {
        // Experiencia de catálogo directo
        await this.experienceService.updateExperience({
          id: exp.id,
          slug: exp.slug,
          status: 'publicada',
          dates: confirmedDates,
          reviewedAt,
        });
      }

      // Actualizar inmediatamente el estado en memoria para que la UI reaccione en tiempo real
      this.editingExperience.update((curr) => {
        if (!curr) return null;
        return {
          ...curr,
          status: 'publicada',
          dates: confirmedDates,
          reviewedAt,
        };
      });

      this.adminStore.providerStore.reloadFromStorage();
      await this.adminStore.providerStore.loadProposalsFromSupabase();
      await this.experienceService.reloadFromSupabase();

      const updated =
        this.experienceService.getExperienceById(exp.id) ||
        (exp.slug ? this.experienceService.getExperienceBySlug(exp.slug) : undefined);
      if (updated) {
        this.editingExperience.set(updated);
      }

      this.showToast(`La propuesta "${exp.title}" fue aprobada y publicada.`);
    } catch (err: unknown) {
      console.error('[AdminExperiences] Error al aprobar propuesta:', err);
      const msg = err instanceof Error ? err.message : 'Error al aprobar propuesta';
      this.showToast(msg);
    } finally {
      this.processingProposalIds.update((set) => {
        const next = new Set(set);
        next.delete(exp.id);
        return next;
      });
    }
  }

  async rejectProposal(exp: Experience): Promise<void> {
    if (this.isProposalProcessing(exp.id)) {
      return;
    }
    this.processingProposalIds.update((set) => new Set(set).add(exp.id));

    try {
      let req = this.findMatchingProposal(exp);

      if (!req) {
        await this.adminStore.providerStore.loadProposalsFromSupabase();
        req = this.findMatchingProposal(exp);
      }

      // 1. Si hay propuesta en ProviderStore, rechazarla primero y verificar resultado
      if (req) {
        const rejectedOk = await this.adminStore.rejectExperienceRequest(req.id);
        if (!rejectedOk) {
          this.showToast('No se pudo rechazar la propuesta. Por favor verificá la conexión e intentá nuevamente.');
          return;
        }
      }

      const reviewedAt = new Date().toISOString();

      // 2. Actualizar catálogo oficial solo si la experiencia existe en catálogo
      const existsInCatalog = this.experienceService.experiences().some(
        (e) => e.id === exp.id || e.slug === exp.slug,
      );
      if (existsInCatalog) {
        await this.experienceService.updateExperience({
          id: exp.id,
          slug: exp.slug,
          status: 'rechazada',
          reviewedAt,
        });
      }

      // 3. Actualizar inmediatamente en memoria
      this.editingExperience.update((curr) => {
        if (!curr) return null;
        return {
          ...curr,
          status: 'rechazada',
          reviewedAt,
        };
      });

      this.adminStore.providerStore.reloadFromStorage();
      await this.adminStore.providerStore.loadProposalsFromSupabase();
      await this.experienceService.reloadFromSupabase();

      const updated =
        this.experienceService.getExperienceById(exp.id) ||
        (exp.slug ? this.experienceService.getExperienceBySlug(exp.slug) : undefined);
      if (updated) {
        this.editingExperience.set(updated);
      }

      this.showToast(`La propuesta "${exp.title}" fue rechazada.`);
    } catch (err: unknown) {
      console.error('[AdminExperiences] Error al rechazar propuesta:', err);
      const msg = err instanceof Error ? err.message : 'Error al rechazar propuesta';
      this.showToast(msg);
    } finally {
      this.processingProposalIds.update((set) => {
        const next = new Set(set);
        next.delete(exp.id);
        return next;
      });
    }
  }

  async toggleStatus(
    exp: Experience,
    newStatus: 'publicada' | 'oculta' | 'rechazada' | 'borrador' | 'pendiente',
  ): Promise<void> {
    if (exp.status === 'pendiente' && newStatus === 'publicada') {
      await this.approveProposal(exp);
      return;
    }
    if (exp.status === 'pendiente' && newStatus === 'rechazada') {
      await this.rejectProposal(exp);
      return;
    }
    try {
      await this.experienceService.toggleExperienceStatus(exp.id, newStatus);
      const updated =
        this.experienceService.getExperienceById(exp.id) ||
        (exp.slug ? this.experienceService.getExperienceBySlug(exp.slug) : undefined);
      if (updated) {
        this.editingExperience.set(updated);
      } else {
        this.editingExperience.update((curr) => (curr ? { ...curr, status: newStatus } : null));
      }
      if (newStatus === 'oculta') {
        this.showToast(`La ruta /experiencias/${exp.slug} fue dada de baja y pausada.`);
      } else if (newStatus === 'publicada') {
        this.showToast(`La ruta /experiencias/${exp.slug} fue activada y publicada.`);
      } else if (newStatus === 'rechazada') {
        this.showToast(`La propuesta /experiencias/${exp.slug} fue rechazada.`);
      } else if (newStatus === 'pendiente') {
        this.showToast(`La ruta /experiencias/${exp.slug} volvió a estado de revisión.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cambiar estado';
      this.showToast(msg);
    }
  }

  private showToast(msg: string): void {
    const cleanMsg = (msg || '')
      .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u2600-\u27BF\uFE0F\s]+/u, '')
      .trim();
    this.feedbackToast.set(cleanMsg || msg);
    setTimeout(() => this.feedbackToast.set(null), 4500);
  }

  readonly isRefreshing = signal(false);

  async refresh(): Promise<void> {
    this.isRefreshing.set(true);
    try {
      await this.experienceService.reloadFromSupabase();
      this.showToast('Catálogo de experiencias actualizado con éxito.');
    } catch {
      this.showToast('No se pudieron refrescar las experiencias en este momento.');
    } finally {
      this.isRefreshing.set(false);
    }
  }

  downloadExperiencesCsv(): void {
    exportExperiencesToCsv(
      this.experiences(),
      (exp) => this.isClub(exp),
      this.adminStore.clubProfile().email || 'admin@experiencias.club',
    );
  }

  getPublicExperienceUrl(exp: { publicUrl?: string; slug?: string; detailRoute?: string }): string {
    return getPublicExperienceUrl(exp);
  }

  readonly experienceToDelete = signal<Experience | null>(null);
  readonly isDeletingExp = signal<boolean>(false);

  openDeleteModal(exp: Experience): void {
    this.experienceToDelete.set(exp);
  }

  closeDeleteModal(): void {
    if (this.isDeletingExp()) return;
    this.experienceToDelete.set(null);
  }

  async confirmDeleteExperience(): Promise<void> {
    const exp = this.experienceToDelete();
    if (!exp) return;
    this.isDeletingExp.set(true);
    try {
      await this.experienceService.deleteExperience(exp.id);
      this.experienceToDelete.set(null);
      this.showToast(`La experiencia "${exp.title}" fue eliminada del catálogo.`);
      this.router.navigateByUrl(this.backToListLink());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar la experiencia';
      this.showToast(msg);
    } finally {
      this.isDeletingExp.set(false);
    }
  }
}
