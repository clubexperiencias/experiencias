import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { filter } from 'rxjs';
import { AdminStoreService, AdminApplication } from '../../../core/services/admin-store.service';
import { ProviderUser, slugify } from '../../../core/services/provider-store.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { Experience } from '../../../core/models/experience.model';
import { FechaPipe, ArsPipe } from '../../../shared/pipes/format.pipes';

export type ProviderTab = 'todos' | 'oficiales' | 'postulaciones';

export interface ProviderListItem {
  id: string;
  origin: 'official' | 'application';
  name: string;
  agency: string;
  email: string;
  phone: string;
  categoryOrBio?: string;
  slug?: string;
  status: 'aprobado' | 'pendiente' | 'rechazado' | 'dado_de_baja';
  createdAt: string;
  rawApp?: AdminApplication;
  rawProvider?: ProviderUser;
}

const CLUB_PROVIDER_SLUGS = new Set(['club-de-experiencias', 'club']);
const CLUB_PROVIDER_EMAIL = 'admin@experiencias.club';
const CLUB_AVATAR_FALLBACK = '/assets/images/kayak-video.png';

@Component({
  selector: 'app-admin-providers',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatIconModule, FechaPipe, ArsPipe],
  template: `
    <div class="providers-view-container">
      <!-- Toast Feedback -->
      @if (feedbackToast()) {
        <div class="toast-banner">
          <span>{{ feedbackToast() }}</span>
        </div>
      }

      @if (notFound()) {
        <!-- Modo Error: Prestador no encontrado -->
        <div class="empty-state-card">
          <h2 class="card-heading">Prestador no encontrado</h2>
          <p class="card-subheading">No pudimos encontrar al prestador solicitado en el padrón.</p>
          <a [routerLink]="backToListLink()" class="btn-back-panel" style="margin-top: 1.25rem;">
            &larr; Volver a Prestadores
          </a>
        </div>
      } @else if (isRouteEditMode() && selectedProvider(); as prov) {
        <!-- Modo Edición: /prestadores/:slug/editar -->
        <div class="edit-page-card">
          <div class="edit-form-card">
            <div class="edit-header">
              <span class="section-kicker">GESTIÓN DE PRESTADORES OFICIALES</span>
              <h1 class="card-heading">Editar Prestador: {{ editName() || editAgency() }}</h1>
              <p class="card-subheading">
                Modificá los datos institucionales, URL pública (slug), información de cobro y estado del prestador en el catálogo.
              </p>
            </div>

            <form (ngSubmit)="saveProviderChanges()" class="provider-edit-form">
              <!-- Datos de Identidad & Agencia -->
              <div class="form-section">
                <h3 class="form-section-title">
                  Identidad y Marca Comercial
                </h3>
                <div class="form-grid">
                  <div class="form-group">
                    <label for="p-name">Nombre y Apellido del Responsable: <span class="required-star">*</span></label>
                    <input
                      id="p-name"
                      type="text"
                      class="form-input"
                      [ngModel]="editName()"
                      (ngModelChange)="editName.set($event)"
                      name="name"
                      placeholder="Ej: Patricio Facundo Diaz Tillar"
                      required
                    />
                  </div>

                  <div class="form-group">
                    <label for="p-agency">Agencia o Emprendimiento: <span class="required-star">*</span></label>
                    <input
                      id="p-agency"
                      type="text"
                      class="form-input"
                      [ngModel]="editAgency()"
                      (ngModelChange)="editAgency.set($event)"
                      name="agency"
                      placeholder="Ej: Catamarca Kayak & Aventura Náutica"
                      required
                    />
                  </div>

                  <div class="form-group full-width">
                    <label for="p-slug">Slug de la URL Pública (Identificador Único): <span class="required-star">*</span></label>
                    <div class="slug-input-wrapper">
                      <span class="slug-prefix">experiencias.club/prestadores/</span>
                      <input
                        id="p-slug"
                        type="text"
                        class="form-input font-mono slug-input"
                        [ngModel]="editSlug()"
                        (ngModelChange)="onSlugChange($event)"
                        name="slug"
                        placeholder="catamarca-kayak"
                        required
                      />
                    </div>
                    <span class="form-hint">
                      Ruta pública donde se visualizan todas las expediciones y perfil del prestador. Modificarla actualizará los enlaces automáticamente.
                    </span>
                  </div>

                  <div class="form-group">
                    <label for="p-email">Correo Electrónico (Login y Notificaciones): <span class="required-star">*</span></label>
                    <input
                      id="p-email"
                      type="email"
                      class="form-input font-mono opacity-70 cursor-not-allowed"
                      [ngModel]="editEmail()"
                      name="email"
                      placeholder="prestador@email.com"
                      disabled
                      readonly
                    />
                    <span class="field-hint">
                      El correo electrónico está vinculado a la cuenta y autenticación y no puede modificarse.
                    </span>
                  </div>

                  <div class="form-group">
                    <label for="p-phone">Teléfono / WhatsApp de Contacto: <span class="required-star">*</span></label>
                    <input
                      id="p-phone"
                      type="tel"
                      class="form-input"
                      [ngModel]="editPhone()"
                      (ngModelChange)="editPhone.set($event)"
                      name="phone"
                      placeholder="+54 9 383 456-7890"
                    />
                  </div>

                  <div class="form-group">
                    <label for="p-status">Estado del Prestador: <span class="required-star">*</span></label>
                    <select
                      id="p-status"
                      class="form-input"
                      [ngModel]="editStatus()"
                      (ngModelChange)="editStatus.set($event)"
                      name="status"
                    >
                      <option value="aprobado">Aprobado / Oficial Habilitado</option>
                      <option value="pendiente">Pendiente de Aprobación</option>
                      <option value="dado_de_baja">Dado de Baja / Deshabilitado</option>
                    </select>
                  </div>

                  <div class="form-group">
                    <label for="p-website">Sitio Web Oficial:</label>
                    <input
                      id="p-website"
                      type="url"
                      class="form-input"
                      [ngModel]="editWebsite()"
                      (ngModelChange)="editWebsite.set($event)"
                      name="website"
                      placeholder="https://catamarcakayak.com.ar"
                    />
                  </div>

                  <div class="form-group full-width">
                    <label for="p-social">Redes Sociales (Instagram / Redes):</label>
                    <input
                      id="p-social"
                      type="text"
                      class="form-input"
                      [ngModel]="editSocialMedia()"
                      (ngModelChange)="editSocialMedia.set($event)"
                      name="socialMedia"
                      placeholder="https://instagram.com/catamarca_kayak"
                    />
                  </div>

                  <div class="form-group full-width">
                    <label for="p-bio">Biografía y Trayectoria del Prestador:</label>
                    <textarea
                      id="p-bio"
                      rows="4"
                      class="form-input"
                      [ngModel]="editBio()"
                      (ngModelChange)="editBio.set($event)"
                      name="bio"
                      placeholder="Presentación oficial del prestador, experiencia en montaña, habilitaciones y servicios que brinda..."
                    ></textarea>
                  </div>
                </div>
              </div>

              <!-- Datos Fiscales y de Liquidación Bancaria -->
              <div class="form-section">
                <h3 class="form-section-title">
                  Datos Fiscales y Liquidación Bancaria
                </h3>
                <div class="form-grid">
                  <div class="form-group">
                    <label for="p-cbu">CBU / CVU o Alias Oficial: <span class="required-star">*</span></label>
                    <input
                      id="p-cbu"
                      type="text"
                      class="form-input font-mono text-blue"
                      [ngModel]="editCbuAlias()"
                      (ngModelChange)="editCbuAlias.set($event)"
                      name="cbuAlias"
                      placeholder="KAYAK.CATAMARCA.MP"
                    />
                  </div>

                  <div class="form-group">
                    <label for="p-cuit">CUIT / DNI: <span class="required-star">*</span></label>
                    <input
                      id="p-cuit"
                      type="text"
                      class="form-input font-mono"
                      [ngModel]="editCuitDni()"
                      (ngModelChange)="editCuitDni.set($event)"
                      name="cuitDni"
                      placeholder="20-33445566-7"
                    />
                  </div>

                  <div class="form-group">
                    <label for="p-bank">Banco / Entidad Financiera: <span class="required-star">*</span></label>
                    <input
                      id="p-bank"
                      type="text"
                      class="form-input"
                      [ngModel]="editBankName()"
                      (ngModelChange)="editBankName.set($event)"
                      name="bankName"
                      placeholder="Banco Nación / Mercado Pago"
                    />
                  </div>

                  <div class="form-group">
                    <label for="p-holder">Titular Registrado de la Cuenta: <span class="required-star">*</span></label>
                    <input
                      id="p-holder"
                      type="text"
                      class="form-input"
                      [ngModel]="editAccountHolder()"
                      (ngModelChange)="editAccountHolder.set($event)"
                      name="accountHolder"
                      placeholder="Patricio Facundo Diaz Tillar"
                    />
                  </div>
                </div>
              </div>

              <!-- Botones de Acción -->
              <div class="form-actions-bar">
                <a [routerLink]="getDetailRoute(prov)" class="btn-cancel">
                  Cancelar
                </a>

                <button
                  type="submit"
                  class="btn-save-primary"
                  [disabled]="saving()"
                >
                  <span>{{ saving() ? 'Guardando cambios...' : 'Guardar prestador' }}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      } @else if (isRouteDetailMode() && selectedProvider(); as prov) {
        <!-- Modo Ficha: /prestadores/:slug -->
        <div class="fiche-view-container">
          <!-- Hero del Prestador -->
          <div class="fiche-section-card hero-provider-card">
            <div class="provider-hero-content">
              <div class="provider-hero-avatar">
                @if (getProviderAvatar(prov); as avatarUrl) {
                  <img
                    [src]="avatarUrl"
                    [alt]="prov.agency || prov.name"
                    class="provider-avatar-img"
                  />
                } @else {
                  <span class="provider-avatar-initial">{{ (prov.agency || prov.name).charAt(0).toUpperCase() }}</span>
                }
              </div>
              <div class="provider-hero-text">
                <div class="hero-kicker-row">
                  <span class="hero-kicker">PRESTADOR OFICIAL CATAMARCA</span>
                  <div class="hero-badges-row">
                    @if (prov.slug) {
                      <a
                        [href]="getPublicProviderUrl(prov.slug)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="btn-hero-public-web"
                        title="Ver cómo se visualiza actualmente en la web pública"
                      >
                        <mat-icon class="btn-icon-sm">open_in_new</mat-icon>
                        <span>VER EN LA WEB</span>
                      </a>
                    }
                    @if (isProviderBaja(prov)) {
                      <span class="status-pill is-paused">Dado de baja</span>
                    } @else {
                      <span class="status-pill is-published">Aprobado</span>
                    }
                  </div>
                </div>
                <h1 class="provider-hero-title">{{ prov.agency || prov.name }}</h1>
                <p class="provider-hero-subtitle">
                  Responsable: <strong>{{ prov.name }}</strong> ({{ prov.email }})
                </p>
              </div>
            </div>
          </div>

          <!-- Grid de Secciones de Información -->
          <div class="fiche-grid-details">
            <!-- 1. Contacto & Redes -->
            <div class="fiche-section-card">
              <h3 class="fiche-card-title">
                Información de Contacto
              </h3>
              <div class="info-list">
                <div class="info-row">
                  <span class="info-label">Email Oficial:</span>
                  <strong class="info-val font-mono">{{ prov.email }}</strong>
                </div>
                <div class="info-row">
                  <span class="info-label">Teléfono / WhatsApp:</span>
                  @if (prov.phone && prov.phone !== '—') {
                    <a
                      [href]="getWhatsappLink(prov.phone, prov.name)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="contact-whatsapp font-mono"
                    >
                      {{ prov.phone }}
                    </a>
                  } @else {
                    <span class="text-muted">Sin teléfono cargado</span>
                  }
                </div>
                <div class="info-row">
                  <span class="info-label">Sitio Web:</span>
                  @if (prov.website) {
                    <a [href]="prov.website" target="_blank" rel="noopener noreferrer" class="link-orange">
                      {{ prov.website }}
                    </a>
                  } @else {
                    <span class="text-muted">—</span>
                  }
                </div>
                <div class="info-row">
                  <span class="info-label">Redes Sociales:</span>
                  @if (prov.socialMedia) {
                    <a [href]="prov.socialMedia" target="_blank" rel="noopener noreferrer" class="link-orange">
                      {{ prov.socialMedia }}
                    </a>
                  } @else {
                    <span class="text-muted">—</span>
                  }
                </div>
              </div>
            </div>

            <!-- 2. Datos Bancarios y Cobro -->
            <div class="fiche-section-card">
              <h3 class="fiche-card-title">
                Datos de Cobro y Liquidación
              </h3>
              <div class="info-list">
                <div class="info-row">
                  <span class="info-label">CBU / CVU o Alias:</span>
                  <strong class="info-val font-mono text-blue">{{ prov.cbuAlias || '—' }}</strong>
                </div>
                <div class="info-row">
                  <span class="info-label">CUIT / DNI:</span>
                  <strong class="info-val font-mono">{{ prov.cuitDni || '—' }}</strong>
                </div>
                <div class="info-row">
                  <span class="info-label">Banco / Entidad:</span>
                  <strong class="info-val">{{ prov.bankName || '—' }}</strong>
                </div>
                <div class="info-row">
                  <span class="info-label">Titular Registrado:</span>
                  <strong class="info-val">{{ prov.accountHolder || prov.name || '—' }}</strong>
                </div>
              </div>
            </div>

            <!-- 3. Biografía y Presentación -->
            <div class="fiche-section-card full-width">
              <h3 class="fiche-card-title">
                Presentación y Trayectoria Oficial
              </h3>
              <p class="bio-text">
                {{ prov.bio || 'El prestador aún no ha ingresado una descripción o biografía oficial.' }}
              </p>
            </div>

            <!-- 4. Experiencias del Prestador -->
            <div class="fiche-section-card full-width">
              <div class="section-title-row">
                <h3 class="fiche-card-title">
                  Experiencias a Cargo en Catálogo ({{ providerExperiencesList().length }})
                </h3>
              </div>

              @if (providerExperiencesList().length === 0) {
                <div class="empty-exp-box">
                  <p>Este prestador no cuenta aún con experiencias cargadas o publicadas en el catálogo.</p>
                </div>
              } @else {
                <div class="table-responsive">
                  <table class="providers-table">
                    <thead>
                      <tr>
                        <th>Experiencia</th>
                        <th>Región / Dificultad</th>
                        <th>Arancel ARS</th>
                        <th>Estado</th>
                        <th class="text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (e of providerExperiencesList(); track e.id) {
                        <tr>
                          <td>
                            <strong>{{ e.title }}</strong>
                          </td>
                          <td>
                            <div class="meta-cell">
                              <span>{{ e.region }}</span>
                              <span class="text-muted">{{ e.difficulty }}</span>
                            </div>
                          </td>
                          <td>
                            <strong class="text-blue">{{ e.priceArs | ars }}</strong>
                          </td>
                          <td>
                            <span class="status-pill is-published">Publicada</span>
                          </td>
                          <td class="text-right">
                            <a
                              [routerLink]="getExperienceFicheRoute(e.slug)"
                              class="btn-view-fiche"
                              title="Ver ficha de la experiencia"
                            >
                              <span>VER FICHA</span>
                            </a>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>

          <!-- Pie de acciones del Prestador -->
          <div class="fiche-bottom-cta-bar">
            <div class="cta-bar-left">
              <span class="cta-prov-name">{{ prov.agency || prov.name }}</span>
              @if (prov.slug) {
                <span class="cta-prov-route">experiencias.club/prestadores/{{ prov.slug }}</span>
              }
            </div>
            <div class="cta-bar-right">
              @if (!isClubProvider(prov)) {
                @if (isProviderBaja(prov)) {
                  <button
                    type="button"
                    class="btn-activate-exp-bottom"
                    [disabled]="saving()"
                    (click)="toggleProviderBajaStatus(prov)"
                    title="Habilitar prestador y reactivar sus experiencias que fueron pausadas"
                  >
                    <span>Habilitar</span>
                  </button>
                } @else {
                  <button
                    type="button"
                    class="btn-pause-exp-bottom"
                    [disabled]="saving()"
                    (click)="toggleProviderBajaStatus(prov)"
                    title="Dar de baja prestador y pausar sus experiencias publicadas"
                  >
                    <span>Dar de baja</span>
                  </button>
                }
              }
              @if (hasProviderRecord(prov)) {
                <a [routerLink]="getEditRoute(prov)" class="btn-action-edit-orange">
                  <span>Editar Prestador</span>
                </a>
              }
            </div>
          </div>
        </div>
      } @else {
        <!-- Modo Lista: /prestadores -->
        <!-- Encabezado de la Sección (Sin botón Volver al Panel) -->
        <div class="view-header">
          <div>
            <span class="section-kicker">COMUNIDAD DE PRESTADORES Y GUÍAS LOCALES</span>
            <h1 class="card-heading">Prestadores y Nuevas Postulaciones</h1>
            <p class="card-subheading">
              Padrón consolidado de prestadores oficiales habilitados en la plataforma y postulaciones de nuevos guías pendientes de evaluación.
            </p>
          </div>
        </div>

        <!-- Tarjetas de Métricas Rápidas (Estilo Dark Orange Glass, 5 cards) -->
        <div class="summary-strip">
          <div class="summary-item">
            <span class="sum-label">Prestadores Oficiales</span>
            <strong class="sum-value">{{ officialProvidersCount() }}</strong>
            <span class="sum-sub">Habilitados en catálogo</span>
          </div>
          <div class="summary-item">
            <span class="sum-label">Postulaciones Pendientes</span>
            <strong class="sum-value text-orange">{{ pendingApplicationsCount() }}</strong>
            <span class="sum-sub">Por evaluar y aprobar</span>
          </div>
          <div class="summary-item">
            <span class="sum-label">Experiencias a Cargo</span>
            <strong class="sum-value text-blue">{{ totalExperiencesCount() }}</strong>
            <span class="sum-sub">En catálogo activo</span>
          </div>
          <div class="summary-item">
            <span class="sum-label">Postulaciones Totales</span>
            <strong class="sum-value">{{ allApplicationsCount() }}</strong>
            <span class="sum-sub">Historial recibido</span>
          </div>
          <div class="summary-item">
            <span class="sum-label">Total Padrón</span>
            <strong class="sum-value">{{ allProviders().length }}</strong>
            <span class="sum-sub">Oficiales + Postulantes</span>
          </div>
        </div>

        <!-- Barra de Filtros y Búsqueda -->
        <div class="filters-bar">
          <div class="search-box">
            <mat-icon class="search-icon">search</mat-icon>
            <input
              type="text"
              placeholder="Buscar por prestador, agencia, email o teléfono..."
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
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
              [class.is-active]="activeTab() === 'todos'"
              (click)="activeTab.set('todos')"
            >
              Todos ({{ allProviders().length }})
            </button>
            <button
              type="button"
              class="filter-tab"
              [class.is-active]="activeTab() === 'oficiales'"
              (click)="activeTab.set('oficiales')"
            >
              Oficiales Aprobados ({{ officialProvidersCount() }})
            </button>
            <button
              type="button"
              class="filter-tab"
              [class.is-active]="activeTab() === 'postulaciones'"
              (click)="activeTab.set('postulaciones')"
            >
              Postulaciones ({{ allApplicationsCount() }})
            </button>
          </div>
        </div>

        <!-- Tabla Principal de Prestadores y Postulaciones -->
        @if (filteredProviders().length === 0) {
          <div class="empty-box">
            <mat-icon>person_search</mat-icon>
            <h3>No se encontraron prestadores ni postulaciones</h3>
            <p>Probá cambiando la búsqueda o seleccionando otra pestaña.</p>
          </div>
        } @else {
          <div class="table-card">
            <div class="table-responsive">
              <table class="providers-table">
                <thead>
                  <tr>
                    <th>Prestador / Guía</th>
                    <th>Agencia / Emprendimiento</th>
                    <th>Contacto</th>
                    <th>Estado</th>
                    <th>Fecha Alta</th>
                    <th class="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of filteredProviders(); track item.id) {
                    <tr>
                      <!-- Prestador / Guía -->
                      <td>
                        <div class="provider-identity">
                          <div class="provider-avatar">
                            @if (getProviderAvatar(item); as avatarUrl) {
                              <img [src]="avatarUrl" [alt]="item.name" class="provider-table-avatar-img" />
                            } @else {
                              <span>{{ item.name.charAt(0).toUpperCase() }}</span>
                            }
                          </div>
                          <div class="identity-text">
                            <strong class="provider-name">{{ item.name }}</strong>
                            <span class="provider-email font-mono">{{ item.email }}</span>
                          </div>
                        </div>
                      </td>

                      <!-- Agencia / Emprendimiento -->
                      <td>
                        <div class="cell-stack">
                          <strong class="agency-name">{{ item.agency || 'Prestador Independiente' }}</strong>
                          @if (item.categoryOrBio) {
                            <span class="agency-sub">{{ item.categoryOrBio }}</span>
                          }
                        </div>
                      </td>

                      <!-- Contacto (Sin icono de chat) -->
                      <td>
                        <div class="contact-stack">
                          @if (item.phone && item.phone !== '—') {
                            <a
                              [href]="getWhatsappLink(item.phone, item.name)"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="contact-whatsapp"
                              title="Contactar vía WhatsApp"
                            >
                              <span>{{ item.phone }}</span>
                            </a>
                          } @else {
                            <span class="phone-muted">Sin teléfono</span>
                          }
                        </div>
                      </td>

                      <!-- Estado -->
                      <td>
                        <span class="status-pill" [attr.data-status]="item.status">
                          @switch (item.status) {
                            @case ('aprobado') {
                              Aprobado
                            }
                            @case ('rechazado') {
                              Rechazado
                            }
                            @case ('dado_de_baja') {
                              Dado de baja
                            }
                            @default {
                              Pendiente
                            }
                          }
                        </span>
                      </td>

                      <!-- Fecha -->
                      <td>
                        <span class="date-cell font-mono">{{ item.createdAt | fecha: 'corta' }}</span>
                      </td>

                      <!-- Acciones -->
                      <td class="text-right">
                        <div class="actions-row">
                          @if ((item.origin === 'official' || item.status === 'aprobado') && item.slug) {
                            <a
                              [routerLink]="getDetailRoute(item)"
                              class="btn-view-fiche"
                              title="Ver ficha técnica del prestador"
                            >
                              <span>VER FICHA</span>
                            </a>

                            @if (item.rawProvider) {
                              <a
                                [routerLink]="getEditRoute(item)"
                                class="btn-edit-exp"
                                title="Editar datos del prestador"
                              >
                                <span>EDITAR</span>
                              </a>
                            }
                          }

                          @if (item.origin === 'application' && item.rawApp && item.status !== 'aprobado') {
                            <button
                              type="button"
                              class="btn-review-app"
                              (click)="openApplication(item.rawApp)"
                              title="Revisar postulación"
                            >
                              <span>REVISAR</span>
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
        }

        <!-- Modal de Revisión de Postulación de Prestador -->
        @if (selectedApplication(); as app) {
          <div class="modal-backdrop" (click)="closeApplication()">
            <div class="modal-dialog" (click)="$event.stopPropagation()">
              <div class="modal-head">
                <div>
                  <span class="modal-kicker">POSTULACIÓN DE NUEVO PRESTADOR</span>
                  <h2 class="modal-title">{{ app.fullName }}</h2>
                  <p class="modal-sub">{{ app.email }} · {{ app.phone }}</p>
                </div>
                <button type="button" class="modal-close-btn" (click)="closeApplication()">×</button>
              </div>

              <div class="modal-body">
                <div class="app-details-grid">
                  <div class="detail-block">
                    <span class="detail-label">Rubro / Categoría Propuesta</span>
                    <strong class="detail-value">{{ formatCategory(app.category) }}</strong>
                  </div>

                  <div class="detail-block">
                    <span class="detail-label">Fecha de Envío</span>
                    <strong class="detail-value font-mono">{{ app.createdAt | fecha: 'larga' }}</strong>
                  </div>

                  @if (app.description) {
                    <div class="detail-block full-width">
                      <span class="detail-label">Presentación y Experiencia del Prestador</span>
                      <p class="detail-desc">{{ app.description }}</p>
                    </div>
                  }

                  @if (app.motivationLetter) {
                    <div class="detail-block full-width">
                      <span class="detail-label">Carta de Motivación / Notas</span>
                      <p class="detail-desc">{{ app.motivationLetter }}</p>
                    </div>
                  }

                  <!-- Datos bancarios / fiscales si los completó -->
                  @if (app.cuitDni || app.cbuAlias || app.bankName) {
                    <div class="detail-block full-width banking-card">
                      <span class="detail-label">Datos Fiscales y de Liquidación</span>
                      <div class="banking-grid">
                        <div>
                          <span class="bank-sub-lbl">CUIT / DNI</span>
                          <strong>{{ app.cuitDni || '—' }}</strong>
                        </div>
                        <div>
                          <span class="bank-sub-lbl">CBU / Alias</span>
                          <strong>{{ app.cbuAlias || '—' }}</strong>
                        </div>
                        <div>
                          <span class="bank-sub-lbl">Banco</span>
                          <strong>{{ app.bankName || '—' }}</strong>
                        </div>
                        <div>
                          <span class="bank-sub-lbl">Titular</span>
                          <strong>{{ app.accountHolder || app.fullName }}</strong>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>

              <div class="modal-foot">
                <div class="action-buttons-group">
                  @if (app.status === 'pendiente') {
                    <button
                      type="button"
                      class="btn-action-primary"
                      [disabled]="isUpdating()"
                      (click)="approve(app)"
                    >
                      Aprobar como Prestador Oficial
                    </button>
                    <button
                      type="button"
                      class="btn-action-reject"
                      [disabled]="isUpdating()"
                      (click)="reject(app)"
                    >
                      Rechazar
                    </button>
                  } @else if (app.status === 'aprobado') {
                    <span class="approved-tag">Postulación Aprobada</span>
                  } @else {
                    <span class="rejected-tag">Postulación Rechazada</span>
                  }

                  @if (app.phone && app.phone !== '—') {
                    <a
                      [href]="getWhatsappLink(app.phone, app.fullName)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn-action-wa"
                    >
                      Contactar prestador
                    </a>
                  }
                </div>

                <button type="button" class="btn-action-close" (click)="closeApplication()">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .providers-view-container {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .view-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1.5rem;
        flex-wrap: wrap;
      }

      .section-kicker {
        display: inline-block;
        font-size: 0.72rem;
        font-weight: 800;
        color: #ff5f00;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        margin: 0 0 0.15rem;
        line-height: 1;
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
        color: rgba(255, 255, 255, 0.65);
        max-width: 820px;
        margin: 0.35rem 0 0;
        line-height: 1.5;
      }

      /* Summary Strip */
      .summary-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1rem;
      }

      .summary-item {
        background: rgba(26, 14, 8, 0.78);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 2px;
        padding: 1.15rem 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        backdrop-filter: blur(12px);
      }

      .sum-label {
        font-size: 0.7rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(255, 255, 255, 0.6);
      }

      .sum-value {
        font-size: 1.75rem;
        font-weight: 800;
        color: #ffffff;
        font-family: var(--font-mono, monospace);
        letter-spacing: -0.02em;
        line-height: 1.15;
      }

      .sum-sub {
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.5);
      }

      .text-orange {
        color: #ff5f00 !important;
      }

      .text-blue {
        color: #80b3ff !important;
      }

      /* Filters & Search */
      .filters-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        background: rgba(22, 12, 6, 0.85);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 2px;
        padding: 0.85rem 1rem;
        backdrop-filter: blur(12px);
      }

      .search-box {
        position: relative;
        flex: 1;
        min-width: 260px;
        display: flex;
        align-items: center;
      }

      .search-icon {
        position: absolute;
        left: 0.75rem;
        color: rgba(255, 255, 255, 0.4);
        font-size: 18px;
        width: 18px;
        height: 18px;
        pointer-events: none;
      }

      .search-input {
        width: 100%;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.15);
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
        background: rgba(255, 255, 255, 0.08);
      }

      .clear-search-btn {
        position: absolute;
        right: 0.5rem;
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

      /* Empty Box */
      .empty-box {
        background: rgba(22, 12, 6, 0.85);
        border: 1px dashed rgba(255, 95, 0, 0.35);
        border-radius: 2px;
        padding: 3rem 1.5rem;
        text-align: center;
        color: rgba(255, 255, 255, 0.5);
      }
      .empty-box mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        margin-bottom: 0.5rem;
        color: rgba(255, 95, 0, 0.4);
      }
      .empty-box h3 {
        color: #ffffff;
        font-size: 1.1rem;
        margin: 0 0 0.35rem;
      }
      .empty-box p {
        font-size: 0.85rem;
        margin: 0;
      }

      /* Table Card */
      .table-card {
        background: rgba(22, 12, 6, 0.85);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 2px;
        overflow: hidden;
        backdrop-filter: blur(12px);
      }

      .table-responsive {
        width: 100%;
        overflow-x: auto;
      }
      .table-responsive::-webkit-scrollbar {
        height: 6px;
      }
      .table-responsive::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.35);
      }
      .table-responsive::-webkit-scrollbar-thumb {
        background: rgba(255, 95, 0, 0.35);
        border-radius: 3px;
      }
      .table-responsive::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 95, 0, 0.6);
      }

      .providers-table {
        min-width: 1080px;
        width: 100%;
        border-collapse: collapse;
        font-size: 0.82rem;
      }

      .providers-table th {
        background: rgba(35, 18, 10, 0.95);
        color: rgba(255, 255, 255, 0.6);
        font-size: 0.68rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: 0.85rem 1rem;
        border-bottom: 1px solid rgba(255, 95, 0, 0.3);
        white-space: nowrap;
        text-align: left;
      }

      .providers-table td {
        padding: 0.85rem 1rem;
        border-bottom: 1px solid rgba(255, 95, 0, 0.15);
        color: rgba(255, 255, 255, 0.85);
        vertical-align: middle;
      }

      .providers-table tr:hover td {
        background: rgba(255, 95, 0, 0.04);
      }

      .providers-table th.text-right,
      .providers-table td.text-right {
        text-align: right !important;
        white-space: nowrap !important;
        min-width: 135px;
        width: 135px;
        position: sticky;
        right: 0;
        z-index: 5;
        background: #140b06;
        box-shadow: -6px 0 16px rgba(0, 0, 0, 0.45);
      }

      .providers-table th.text-right {
        background: #0f0703 !important;
        text-align: center !important;
      }

      .providers-table tr:hover td.text-right {
        background: #241309;
      }

      .text-right {
        text-align: right !important;
      }

      .provider-identity {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .provider-avatar {
        width: 34px;
        height: 34px;
        border-radius: 2px;
        background: rgba(255, 95, 0, 0.15);
        border: 1px solid #ff5f00;
        color: #ff5f00;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 0.85rem;
        flex-shrink: 0;
        overflow: hidden;
      }

      .provider-table-avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .identity-text {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }

      .provider-name {
        color: #ffffff;
        font-size: 0.88rem;
      }

      .provider-email {
        font-size: 0.74rem;
        color: rgba(255, 255, 255, 0.5);
      }

      .cell-stack {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }

      .agency-name {
        color: #ffffff;
        font-size: 0.85rem;
      }

      .agency-sub {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.5);
      }

      .contact-whatsapp {
        color: #ffffff;
        text-decoration: none;
        font-size: 0.82rem;
      }
      .contact-whatsapp:hover {
        color: #ffffff;
        text-decoration: underline;
      }

      .info-row .contact-whatsapp {
        color: #ffffff;
      }

      .phone-muted {
        color: rgba(255, 255, 255, 0.4);
        font-size: 0.8rem;
      }

      .status-pill {
        display: inline-block;
        padding: 0.2rem 0.5rem;
        border-radius: 2px;
        font-size: 0.7rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .status-pill[data-status='aprobado'],
      .status-pill.is-published {
        background: rgba(52, 211, 153, 0.15);
        color: #34d399;
        border: 1px solid rgba(52, 211, 153, 0.3);
      }
      .status-pill[data-status='pendiente'] {
        background: rgba(251, 191, 36, 0.15);
        color: #fbbf24;
        border: 1px solid rgba(251, 191, 36, 0.3);
      }
      .status-pill[data-status='rechazado'],
      .status-pill[data-status='dado_de_baja'] {
        background: rgba(248, 113, 113, 0.15);
        color: #f87171;
        border: 1px solid rgba(248, 113, 113, 0.3);
      }

      .date-cell {
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.6);
      }

      .actions-row {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        justify-content: center;
        gap: 0.3rem;
        min-width: 110px;
        max-width: 125px;
        margin-left: auto;
      }

      .actions-row .btn-view-fiche,
      .actions-row .btn-edit-exp,
      .actions-row .btn-review-app {
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

      /* Botones de Acción Coherentes con el Portal Admin */
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
        text-transform: uppercase;
        transition: all 0.2s ease;
      }
      .btn-view-fiche:hover {
        background: #ff5f00;
        border-color: #ff5f00;
        color: #0b0704;
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
        text-transform: uppercase;
        transition: all 0.2s ease;
      }
      .btn-edit-exp:hover {
        background: rgba(255, 255, 255, 0.16);
        border-color: rgba(255, 255, 255, 0.45);
        color: #ffffff;
      }

      .btn-review-app {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 0.75rem;
        height: 32px;
        min-height: 32px;
        box-sizing: border-box;
        background: rgba(255, 95, 0, 0.18);
        border: 1px solid #ff5f00;
        border-radius: 3px;
        color: #ffffff;
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap !important;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        transition: all 0.2s ease;
      }
      .btn-review-app:hover {
        background: #ff5f00;
        border-color: #ff5f00;
        color: #0b0704;
      }

      /* Fiche & Edit View Topbars */
      .fiche-topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.85rem 1.25rem;
        background: rgba(22, 12, 6, 0.9);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 4px;
        gap: 1rem;
        flex-wrap: wrap;
        backdrop-filter: blur(12px);
      }

      .topbar-left {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .fiche-topbar-breadcrumb {
        font-size: 0.82rem;
        color: rgba(255, 255, 255, 0.6);
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

      .btn-back-panel {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 34px;
        padding: 0 1rem;
        background: #ffffff !important;
        border: 1px solid #ffffff !important;
        color: #000000 !important;
        border-radius: 3px;
        font-size: 0.78rem;
        font-weight: 700;
        text-decoration: none;
        letter-spacing: 0.02em;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      .btn-back-panel:hover {
        background: #f0f0f0 !important;
        color: #000000 !important;
      }

      .btn-action-public-web {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        height: 34px;
        padding: 0 0.95rem;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.22);
        color: rgba(255, 255, 255, 0.9);
        font-size: 0.76rem;
        font-weight: 700;
        text-decoration: none;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        border-radius: 3px;
        transition: all 0.2s ease;
      }
      .btn-action-public-web:hover {
        background: rgba(255, 255, 255, 0.16);
        border-color: rgba(255, 255, 255, 0.45);
        color: #ffffff;
      }

      .btn-action-edit-orange {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 34px;
        padding: 0 1.15rem;
        background: rgba(255, 95, 0, 0.18);
        border: 1px solid #ff5f00;
        color: #ffffff;
        border-radius: 3px;
        font-size: 0.76rem;
        font-weight: 700;
        text-decoration: none;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .btn-action-edit-orange:hover {
        background: #ff5f00;
        border-color: #ff5f00;
        color: #0b0704;
      }

      .btn-icon-sm {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      /* Fiche Layout */
      .fiche-view-container {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .fiche-section-card {
        background: rgba(22, 12, 6, 0.85);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 4px;
        padding: 1.5rem;
        backdrop-filter: blur(12px);
      }

      .hero-provider-card {
        background: linear-gradient(135deg, rgba(35, 18, 10, 0.95), rgba(22, 12, 6, 0.95));
      }

      .provider-hero-content {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        flex-wrap: wrap;
      }

      .provider-hero-avatar {
        width: 96px;
        height: 96px;
        border-radius: 6px;
        background: rgba(255, 95, 0, 0.18);
        border: 2px solid #ff5f00;
        color: #ff5f00;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2.25rem;
        font-weight: 900;
        flex-shrink: 0;
        overflow: hidden;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.4);
      }

      .provider-avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .provider-avatar-initial {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
      }

      .provider-hero-text {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      .hero-kicker-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;
        width: 100%;
      }

      .hero-kicker {
        font-size: 0.72rem;
        font-weight: 800;
        color: #ff5f00;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .hero-badges-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .hero-badges-row .btn-hero-public-web,
      .hero-badges-row .status-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 28px;
        min-height: 28px;
        box-sizing: border-box;
        line-height: 1;
        padding: 0 0.75rem;
        font-size: 0.75rem;
        border-radius: 3px;
      }

      .btn-hero-public-web {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0 0.75rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.22);
        border-radius: 3px;
        color: #ffffff;
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        text-decoration: none;
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      .btn-hero-public-web:hover {
        background: rgba(255, 255, 255, 0.16);
        border-color: rgba(255, 255, 255, 0.45);
        color: #ffffff;
      }

      .btn-hero-edit {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.32rem 0.75rem;
        background: rgba(255, 95, 0, 0.2);
        border: 1px solid #ff5f00;
        border-radius: 3px;
        color: #ffffff;
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        text-decoration: none;
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      .btn-hero-edit:hover {
        background: #ff5f00;
        border-color: #ff5f00;
        color: #0b0704;
      }

      .slug-tag {
        font-size: 0.72rem;
        font-family: var(--font-mono, monospace);
        color: rgba(255, 255, 255, 0.6);
        background: rgba(255, 255, 255, 0.08);
        padding: 0.15rem 0.45rem;
        border-radius: 3px;
      }

      .provider-hero-title {
        font-size: 1.85rem;
        font-weight: 900;
        color: #ffffff;
        margin: 0;
        letter-spacing: -0.02em;
      }

      .provider-hero-subtitle {
        font-size: 0.9rem;
        color: rgba(255, 255, 255, 0.75);
        margin: 0;
      }

      .fiche-grid-details {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1.25rem;
      }

      .fiche-grid-details .full-width {
        grid-column: 1 / -1;
      }

      .fiche-card-title {
        display: block;
        font-size: 0.95rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0 0 1rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-bottom: 1px solid rgba(255, 95, 0, 0.25);
        padding-bottom: 0.6rem;
      }

      .fiche-bottom-cta-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 1rem;
        padding: 1.25rem 1.5rem;
        background: rgba(18, 10, 5, 0.95);
        border: 1px solid rgba(255, 95, 0, 0.25);
        border-radius: 4px;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
      }

      .cta-bar-left {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .cta-prov-name {
        font-size: 1.05rem;
        font-weight: 800;
        color: #ffffff;
      }

      .cta-prov-route {
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.55);
        font-family: var(--font-mono, monospace);
      }

      .cta-bar-right {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .cta-bar-right .btn-cancel-edit,
      .cta-bar-right .btn-action-edit-orange,
      .cta-bar-right .btn-hero-public-web,
      .cta-bar-right .btn-hero-edit,
      .cta-bar-right .btn-pause-exp-bottom,
      .cta-bar-right .btn-activate-exp-bottom {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 42px;
        min-height: 42px;
        padding: 0 1.35rem;
        font-size: 0.82rem;
        font-weight: 800;
        box-sizing: border-box;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-pause-exp-bottom {
        background: rgba(255, 80, 80, 0.16) !important;
        border: 1px solid rgba(255, 80, 80, 0.4) !important;
        color: #ff8080 !important;
        cursor: pointer;
      }

      .btn-pause-exp-bottom:hover:not(:disabled) {
        background: rgba(255, 80, 80, 0.28) !important;
        border-color: #ff6060 !important;
        color: #ffffff !important;
      }

      .btn-activate-exp-bottom {
        background: rgba(251, 191, 36, 0.16) !important;
        border: 1px solid rgba(251, 191, 36, 0.45) !important;
        color: #fbbf24 !important;
        cursor: pointer;
      }

      .btn-activate-exp-bottom:hover:not(:disabled) {
        background: rgba(251, 191, 36, 0.28) !important;
        border-color: #fbbf24 !important;
        color: #ffffff !important;
      }

      .btn-action-edit-orange {
        background: #ff5f00 !important;
        border: 1px solid #ff5f00 !important;
        color: #0b0704 !important;
        cursor: pointer;
        text-decoration: none;
      }

      .btn-action-edit-orange:hover {
        background: #ff7722 !important;
        border-color: #ff7722 !important;
        color: #ffffff !important;
      }

      .hero-badges-row .btn-pause-exp-bottom,
      .hero-badges-row .btn-activate-exp-bottom {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.32rem 0.75rem;
        border-radius: 3px;
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .required-star {
        color: #ff5f00;
        font-weight: bold;
        margin-left: 0.2rem;
      }

      .info-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .info-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        font-size: 0.85rem;
        padding-bottom: 0.45rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }

      .info-label {
        color: rgba(255, 255, 255, 0.6);
      }

      .info-val {
        color: #ffffff;
        text-align: right;
      }

      .link-orange {
        color: #ff9955;
        text-decoration: none;
      }
      .link-orange:hover {
        text-decoration: underline;
      }

      .text-muted {
        color: rgba(255, 255, 255, 0.4);
      }

      .bio-text {
        font-size: 0.9rem;
        color: rgba(255, 255, 255, 0.85);
        line-height: 1.6;
        margin: 0;
        white-space: pre-line;
      }

      .meta-cell {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }

      .empty-exp-box {
        padding: 2rem;
        text-align: center;
        color: rgba(255, 255, 255, 0.5);
        font-size: 0.88rem;
      }

      /* Edit Page */
      .edit-page-card {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        margin-top: 2.25rem;
      }

      .edit-form-card {
        background: rgba(22, 12, 6, 0.85);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 4px;
        padding: 2rem;
        backdrop-filter: blur(12px);
      }

      .edit-header {
        margin-bottom: 1.75rem;
        border-bottom: 1px solid rgba(255, 95, 0, 0.25);
        padding-bottom: 1.25rem;
      }

      .provider-edit-form {
        display: flex;
        flex-direction: column;
        gap: 2rem;
      }

      .form-section {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .form-section-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.05rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #ff9955;
      }
      .form-section-title mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1.25rem;
      }

      .form-grid .full-width {
        grid-column: 1 / -1;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .form-group label {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: rgba(255, 255, 255, 0.7);
      }

      .form-input {
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 4px;
        padding: 0.65rem 0.85rem;
        color: #ffffff;
        font-size: 0.88rem;
        font-family: inherit;
        outline: none;
        transition: border-color 0.2s ease;
      }
      .form-input:focus {
        border-color: #ff5f00;
        background: rgba(255, 255, 255, 0.05);
      }

      .slug-input-wrapper {
        display: flex;
        align-items: center;
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 4px;
        overflow: hidden;
      }

      .slug-prefix {
        font-size: 0.8rem;
        font-family: var(--font-mono, monospace);
        color: rgba(255, 255, 255, 0.45);
        padding: 0.65rem 0 0.65rem 0.85rem;
        white-space: nowrap;
      }

      .slug-input {
        border: none !important;
        background: transparent !important;
        padding-left: 0.25rem !important;
      }

      .form-hint {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.5);
        line-height: 1.35;
      }

      .form-actions-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding-top: 1.5rem;
        border-top: 1px solid rgba(255, 95, 0, 0.25);
        width: 100%;
      }

      .btn-save-primary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        height: 38px;
        padding: 0 1.35rem;
        background: #ff5f00 !important;
        border: 1px solid #ff5f00 !important;
        color: #0b0704 !important;
        border-radius: 3px;
        font-size: 0.8rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .btn-save-primary:hover:not(:disabled) {
        background: #ff7722 !important;
        border-color: #ff7722 !important;
        color: #0b0704 !important;
        transform: translateY(-1px);
      }
      .btn-save-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn-cancel {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 38px;
        padding: 0 1.25rem;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.22);
        color: rgba(255, 255, 255, 0.85);
        border-radius: 3px;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-decoration: none;
        transition: all 0.2s ease;
      }
      .btn-cancel:hover {
        background: rgba(255, 255, 255, 0.12);
        border-color: rgba(255, 255, 255, 0.45);
        color: #ffffff;
      }

      .empty-state-card {
        background: rgba(22, 12, 6, 0.85);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 4px;
        padding: 3rem 1.5rem;
        text-align: center;
      }

      .toast-banner {
        padding: 0.85rem 1.25rem;
        background: rgba(255, 95, 0, 0.15);
        border: 1px solid rgba(255, 95, 0, 0.45);
        border-radius: 4px;
        color: #ff9955;
        font-size: 0.9rem;
        font-weight: 700;
      }

      /* Modal Styling */
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1.5rem;
        backdrop-filter: blur(4px);
      }

      .modal-dialog {
        background: #180e07;
        border: 1px solid rgba(255, 95, 0, 0.4);
        border-radius: 4px;
        width: 100%;
        max-width: 620px;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
      }

      .modal-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid rgba(255, 95, 0, 0.25);
      }

      .modal-kicker {
        font-size: 0.68rem;
        font-weight: 800;
        color: #ff5f00;
        letter-spacing: 0.1em;
      }

      .modal-title {
        font-size: 1.25rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0.15rem 0;
      }

      .modal-sub {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.55);
        margin: 0;
      }

      .modal-close-btn {
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        font-size: 1.5rem;
        cursor: pointer;
      }
      .modal-close-btn:hover {
        color: #ffffff;
      }

      .modal-body {
        padding: 1.5rem;
        overflow-y: auto;
      }

      .app-details-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1.15rem;
      }

      .detail-block {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .detail-block.full-width {
        grid-column: 1 / -1;
      }

      .detail-label {
        font-size: 0.68rem;
        font-weight: 800;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.45);
      }

      .detail-value {
        font-size: 0.92rem;
        color: #ffffff;
      }

      .detail-desc {
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.8);
        line-height: 1.5;
        margin: 0;
        background: rgba(255, 255, 255, 0.03);
        padding: 0.75rem 1rem;
        border-radius: 2px;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .banking-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        padding: 1rem;
      }

      .banking-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.85rem;
        margin-top: 0.45rem;
      }
      .bank-sub-lbl {
        display: block;
        font-size: 0.65rem;
        color: rgba(255, 255, 255, 0.45);
        text-transform: uppercase;
      }
      .banking-grid strong {
        font-size: 0.82rem;
        color: #ffffff;
        font-family: var(--font-mono, monospace);
      }

      .modal-foot {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.25rem 1.5rem;
        background: rgba(0, 0, 0, 0.35);
        border-top: 1px solid rgba(255, 95, 0, 0.25);
        gap: 1rem;
        flex-wrap: wrap;
      }

      .action-buttons-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .btn-action-primary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 34px;
        padding: 0 1.15rem;
        background: rgba(0, 204, 136, 0.16);
        border: 1px solid rgba(0, 204, 136, 0.45);
        color: #33ffaa;
        font-size: 0.76rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        border-radius: 3px;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      .btn-action-primary:hover:not(:disabled) {
        background: #00cc88;
        border-color: #00cc88;
        color: #0b0704;
      }
      .btn-action-primary:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .btn-action-reject {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 34px;
        padding: 0 1.15rem;
        background: rgba(255, 80, 80, 0.12);
        border: 1px solid rgba(255, 80, 80, 0.38);
        color: #ff8080;
        font-size: 0.76rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        border-radius: 3px;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      .btn-action-reject:hover:not(:disabled) {
        background: rgba(255, 80, 80, 0.25);
        border-color: #ff8080;
        color: #ffffff;
      }
      .btn-action-reject:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .btn-action-wa {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 34px;
        padding: 0 1rem;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.22);
        color: rgba(255, 255, 255, 0.85);
        font-size: 0.76rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        border-radius: 3px;
        text-decoration: none;
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      .btn-action-wa:hover {
        background: rgba(255, 255, 255, 0.16);
        border-color: rgba(255, 255, 255, 0.45);
        color: #ffffff;
      }

      .btn-action-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 34px;
        padding: 0 1.25rem;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.22);
        color: rgba(255, 255, 255, 0.85);
        font-size: 0.76rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        border-radius: 3px;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      .btn-action-close:hover {
        background: rgba(255, 255, 255, 0.16);
        border-color: rgba(255, 255, 255, 0.45);
        color: #ffffff;
      }

      .approved-tag {
        font-size: 0.78rem;
        font-weight: 800;
        color: #34d399;
        text-transform: uppercase;
      }

      .rejected-tag {
        font-size: 0.78rem;
        font-weight: 800;
        color: #fca5a5;
        text-transform: uppercase;
      }

      @media (max-width: 768px) {
        .fiche-grid-details {
          grid-template-columns: 1fr;
        }
        .form-grid {
          grid-template-columns: 1fr;
        }
        .app-details-grid {
          grid-template-columns: 1fr;
        }
        .banking-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AdminProvidersComponent implements OnInit {
  readonly store = inject(AdminStoreService);
  private readonly expService = inject(ExperienceService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly searchQuery = signal<string>('');
  readonly activeTab = signal<ProviderTab>('todos');
  readonly selectedApplication = signal<AdminApplication | null>(null);
  readonly isUpdating = signal<boolean>(false);

  // Modos de ruta
  readonly isRouteEditMode = signal<boolean>(false);
  readonly isRouteDetailMode = signal<boolean>(false);
  readonly notFound = signal<boolean>(false);
  readonly selectedProvider = signal<ProviderUser | null>(null);
  readonly currentUrl = signal<string>(this.router.url);

  // Señales del formulario de edición
  readonly editName = signal<string>('');
  readonly editAgency = signal<string>('');
  readonly editSlug = signal<string>('');
  readonly editEmail = signal<string>('');
  readonly editPhone = signal<string>('');
  readonly editBio = signal<string>('');
  readonly editWebsite = signal<string>('');
  readonly editSocialMedia = signal<string>('');
  readonly editCuitDni = signal<string>('');
  readonly editCbuAlias = signal<string>('');
  readonly editBankName = signal<string>('');
  readonly editAccountHolder = signal<string>('');
  readonly editStatus = signal<'aprobado' | 'pendiente' | 'dado_de_baja'>('aprobado');
  readonly saving = signal<boolean>(false);
  readonly feedbackToast = signal<string | null>(null);

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((ev) => {
        this.currentUrl.set(ev.urlAfterRedirects || ev.url);
        this.resolveRouteState();
      });
  }

  ngOnInit(): void {
    this.resolveRouteState();
  }

  private resolveRouteState(): void {
    const rawPath = this.currentUrl().split('?')[0].split('#')[0];
    const segments = rawPath.split('/').filter(Boolean);
    const prestIdx = segments.indexOf('prestadores');

    if (prestIdx === -1 || prestIdx === segments.length - 1) {
      // Ruta lista: /prestadores o /admin/prestadores
      this.isRouteEditMode.set(false);
      this.isRouteDetailMode.set(false);
      this.notFound.set(false);
      this.selectedProvider.set(null);
      return;
    }

    const slug = segments[prestIdx + 1];
    const isEdit = segments.includes('editar');

    let provider = this.store.providerStore.getProviderBySlug(slug);
    if (!provider) {
      const cleanSlug = slug.toLowerCase().trim();
      const app = this.store.applications().find(
        (a) =>
          a.id.toLowerCase() === cleanSlug ||
          (Boolean(a.fullName) && slugify(a.fullName) === cleanSlug),
      );
      if (app) {
        provider = {
          id: app.id,
          name: app.fullName || 'Postulante',
          agency: app.category ? this.formatCategory(app.category) : 'Postulación de Prestador',
          email: app.email,
          phone: app.phone || '',
          slug: app.id,
          bio: app.description || app.motivationLetter || '',
          cuitDni: app.cuitDni || '',
          cbuAlias: app.cbuAlias || '',
          bankName: app.bankName || '',
          verified: app.status === 'aprobado',
          status: app.status === 'aprobado' ? 'aprobado' : 'pendiente',
          role: 'prestador',
          joinedAt: app.createdAt,
        };
      }
    }

    if (!provider) {
      this.notFound.set(true);
      this.isRouteEditMode.set(false);
      this.isRouteDetailMode.set(false);
      this.selectedProvider.set(null);
      return;
    }

    this.notFound.set(false);
    this.selectedProvider.set(provider);

    if (isEdit) {
      if (!this.hasProviderRecord(provider)) {
        this.notFound.set(true);
        this.isRouteEditMode.set(false);
        this.isRouteDetailMode.set(false);
        this.selectedProvider.set(null);
        return;
      }
      this.isRouteEditMode.set(true);
      this.isRouteDetailMode.set(false);
      this.populateEditForm(provider);
    } else {
      this.isRouteEditMode.set(false);
      this.isRouteDetailMode.set(true);
    }
  }

  private populateEditForm(p: ProviderUser): void {
    this.editName.set(p.name || '');
    this.editAgency.set(p.agency || '');
    this.editSlug.set(p.slug || '');
    this.editEmail.set(p.email || '');
    this.editPhone.set(p.phone || '');
    this.editBio.set(p.bio || '');
    this.editWebsite.set(p.website || '');
    this.editSocialMedia.set(p.socialMedia || '');
    this.editCuitDni.set(p.cuitDni || '');
    this.editCbuAlias.set(p.cbuAlias || '');
    this.editBankName.set(p.bankName || '');
    this.editAccountHolder.set(p.accountHolder || p.name || '');
    this.editStatus.set(
      p.status === 'dado_de_baja' ? 'dado_de_baja' : p.status === 'pendiente' ? 'pendiente' : 'aprobado',
    );
  }

  onSlugChange(value: string): void {
    const clean = value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    this.editSlug.set(clean);
  }

  private parseProviderNotes(raw: string | undefined | null): {
    metadata: Record<string, any>;
    freeText: string;
  } {
    const trimmed = (raw || '').trim();
    if (!trimmed) {
      return { metadata: {}, freeText: '' };
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const freeText = typeof parsed['text'] === 'string' ? parsed['text'] : '';
        return { metadata: parsed, freeText };
      }
      if (typeof parsed === 'string') {
        return { metadata: {}, freeText: parsed };
      }
      // null, arrays, numbers, booleans are treated as empty metadata with no free text
      return { metadata: {}, freeText: '' };
    } catch {
      // Non-JSON string is treated as free text
      return { metadata: {}, freeText: trimmed };
    }
  }

  private serializeProviderNotes(metadata: Record<string, any>, freeText: string): string {
    const copy: Record<string, any> = { ...metadata };
    if (freeText.trim()) {
      copy['text'] = freeText.trim();
    } else {
      delete copy['text'];
    }
    const keys = Object.keys(copy);
    if (keys.length === 0) {
      return '';
    }
    if (keys.length === 1 && typeof copy['text'] === 'string') {
      return copy['text'];
    }
    return JSON.stringify(copy);
  }

  isProviderBaja(prov: ProviderUser | null | undefined): boolean {
    if (!prov) return false;
    return prov.status === 'dado_de_baja' || prov.active === false;
  }

  async toggleProviderBajaStatus(prov: ProviderUser): Promise<void> {
    if (this.saving()) return;
    const isCurrentlyBaja = this.isProviderBaja(prov);

    this.saving.set(true);

    try {
      const cleanEmail = prov.email?.toLowerCase().trim();
      const cleanSlug = prov.slug?.toLowerCase().trim();
      const allExps = this.expService.experiences();
      const providerExps = allExps.filter((e: Experience) => {
        const eEmail = e.providerEmail?.toLowerCase().trim() || '';
        const eSlug = e.providerSlug?.toLowerCase().trim() || '';
        return (cleanEmail && eEmail === cleanEmail) || (cleanSlug && eSlug === cleanSlug);
      });

      const remoteNotes = await this.store.providerStore.loadProviderNotes(prov.email);
      const notesToUse = remoteNotes !== null ? remoteNotes : (prov.notes || '');
      const { metadata, freeText } = this.parseProviderNotes(notesToUse);
      const notesObj = metadata;

      if (!isCurrentlyBaja) {
        // DAR DE BAJA:
        // Pausar sus experiencias publicadas y registrar cuáles se pausaron por la baja
        const publishedExps = providerExps.filter((e: Experience) => e.status === 'publicada');
        const publishedIds = publishedExps.map((e: Experience) => e.id);

        notesObj['pausedByBajaExpIds'] = publishedIds;
        const updatedNotes = this.serializeProviderNotes(notesObj, freeText);

        const res = await this.store.providerStore.adminUpdateProvider(prov.email, {
          status: 'dado_de_baja',
          notes: updatedNotes,
        });

        if (!res.success) {
          this.showToast(res.message || 'Error al dar de baja al prestador.');
          return;
        }

        // Pausar cada experiencia publicada
        let pausedCount = 0;
        let hasPauseErrors = false;
        for (const exp of publishedExps) {
          try {
            await this.expService.updateExperience({ id: exp.id, status: 'oculta' });
            pausedCount++;
          } catch (expErr) {
            hasPauseErrors = true;
            console.warn(`[AdminProviders] Error al pausar experiencia ${exp.id}:`, expErr);
          }
        }

        if (hasPauseErrors) {
          this.showToast(
            `⚠️ Prestador dado de baja. Se pausaron ${pausedCount} de ${publishedIds.length} experiencia(s); algunas no pudieron actualizarse.`,
          );
        } else {
          this.showToast(
            `Prestador dado de baja. Se pausaron ${pausedCount} experiencia(s) en el catálogo.`,
          );
        }
      } else {
        // HABILITAR:
        // Reactivar únicamente las experiencias que fueron pausadas al darlo de baja
        const hasExplicitBajaList = Array.isArray(notesObj['pausedByBajaExpIds']);
        const savedIds: string[] = hasExplicitBajaList ? notesObj['pausedByBajaExpIds'] : [];

        const toReactivate = hasExplicitBajaList
          ? providerExps.filter((e: Experience) => savedIds.includes(e.id) && e.status === 'oculta')
          : [];

        delete notesObj['pausedByBajaExpIds'];
        const updatedNotes = this.serializeProviderNotes(notesObj, freeText);

        const res = await this.store.providerStore.adminUpdateProvider(prov.email, {
          status: 'aprobado',
          notes: updatedNotes,
        });

        if (!res.success) {
          this.showToast(res.message || 'Error al habilitar al prestador.');
          return;
        }

        let reactivatedCount = 0;
        let hasReactivateErrors = false;
        for (const exp of toReactivate) {
          try {
            await this.expService.updateExperience({ id: exp.id, status: 'publicada' });
            reactivatedCount++;
          } catch (expErr) {
            hasReactivateErrors = true;
            console.warn(`[AdminProviders] Error al reactivar experiencia ${exp.id}:`, expErr);
          }
        }

        if (hasReactivateErrors) {
          this.showToast(
            `⚠️ Prestador habilitado. Se reactivaron ${reactivatedCount} de ${toReactivate.length} experiencia(s); algunas no pudieron actualizarse.`,
          );
        } else if (!hasExplicitBajaList) {
          const hiddenCount = providerExps.filter((e: Experience) => e.status === 'oculta').length;
          if (hiddenCount > 0) {
            this.showToast(
              `Prestador habilitado con éxito. Sin historial de baja previa: ${hiddenCount} experiencia(s) ocultas se mantuvieron en pausa para revisión manual.`,
            );
          } else {
            this.showToast('Prestador habilitado con éxito.');
          }
        } else {
          this.showToast(
            `Prestador habilitado con éxito. Se reactivaron ${reactivatedCount} experiencia(s).`,
          );
        }
      }
    } catch (err: any) {
      console.error('[AdminProviders] Error en toggleProviderBajaStatus:', err);
      this.showToast('Ocurrió un error al actualizar el estado del prestador.');
    } finally {
      this.saving.set(false);
    }
  }

  async saveProviderChanges(): Promise<void> {
    const p = this.selectedProvider();
    if (!p) return;

    const name = this.editName().trim();
    if (!name || name.length < 3) {
      this.showToast('⚠️ Por favor ingresá el nombre y apellido del responsable (mínimo 3 caracteres).');
      return;
    }

    const agency = this.editAgency().trim();
    if (!agency || agency.length < 2) {
      this.showToast('⚠️ Por favor indicá el nombre de la agencia o emprendimiento.');
      return;
    }

    const slug = this.editSlug().trim().toLowerCase();
    if (!slug) {
      this.showToast('⚠️ Por favor ingresá un slug válido para la URL pública.');
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      this.showToast('⚠️ El slug solo puede contener letras minúsculas, números y guiones medios.');
      return;
    }

    const email = this.editEmail().trim().toLowerCase();
    const originalEmail = p.email.trim().toLowerCase();
    if (!email) {
      this.showToast('⚠️ Por favor ingresá un correo electrónico.');
      return;
    }
    if (email !== originalEmail) {
      this.showToast('⚠️ No se permite modificar el correo del prestador porque afectaría el inicio de sesión y la autenticación.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.showToast('⚠️ Por favor ingresá un correo electrónico válido (ej: nombre@dominio.com).');
      return;
    }

    const phone = this.editPhone().trim();
    if (!phone) {
      this.showToast('⚠️ Por favor indicá el teléfono o WhatsApp de contacto.');
      return;
    }
    const cleanPhoneDigits = phone.replace(/\D/g, '');
    if (cleanPhoneDigits.length < 6) {
      this.showToast('⚠️ El número de teléfono debe contener al menos 6 dígitos numéricos.');
      return;
    }

    const cbu = this.editCbuAlias().trim();
    if (!cbu) {
      this.showToast('⚠️ Por favor ingresá el CBU, CVU o Alias oficial para la liquidación.');
      return;
    }

    const cuit = this.editCuitDni().trim();
    if (!cuit) {
      this.showToast('⚠️ Por favor ingresá el CUIT, CUIL o DNI del prestador.');
      return;
    }

    const bank = this.editBankName().trim();
    if (!bank) {
      this.showToast('⚠️ Por favor indicá el banco o entidad financiera.');
      return;
    }

    const holder = this.editAccountHolder().trim() || name;

    const website = this.editWebsite().trim();
    if (website && !/^https?:\/\//i.test(website)) {
      this.showToast('⚠️ El sitio web debe comenzar con http:// o https://');
      return;
    }

    const newStatus = this.editStatus();
    const oldStatus = p.status;

    this.saving.set(true);

    const remoteNotes = await this.store.providerStore.loadProviderNotes(p.email);
    const notesToUse = remoteNotes !== null ? remoteNotes : (p.notes || '');
    const { metadata, freeText } = this.parseProviderNotes(notesToUse);
    const notesObj = metadata;

    const cleanEmail = p.email?.toLowerCase().trim();
    const cleanSlug = p.slug?.toLowerCase().trim();
    const providerExps = this.expService.experiences().filter((e: Experience) => {
      const eEmail = e.providerEmail?.toLowerCase().trim() || '';
      const eSlug = e.providerSlug?.toLowerCase().trim() || '';
      return (cleanEmail && eEmail === cleanEmail) || (cleanSlug && eSlug === cleanSlug);
    });

    let expsToPause: Experience[] = [];
    let expsToReactivate: Experience[] = [];

    if (newStatus === 'dado_de_baja' && oldStatus !== 'dado_de_baja') {
      expsToPause = providerExps.filter((e: Experience) => e.status === 'publicada');
      notesObj['pausedByBajaExpIds'] = expsToPause.map((e: Experience) => e.id);
    } else if (newStatus === 'aprobado' && oldStatus === 'dado_de_baja') {
      const hasExplicitBajaList = Array.isArray(notesObj['pausedByBajaExpIds']);
      const savedIds: string[] = hasExplicitBajaList ? notesObj['pausedByBajaExpIds'] : [];
      expsToReactivate = hasExplicitBajaList
        ? providerExps.filter((e: Experience) => savedIds.includes(e.id) && e.status === 'oculta')
        : [];
      delete notesObj['pausedByBajaExpIds'];
    }

    const statusChangedToOrFromBaja =
      (newStatus === 'dado_de_baja' && oldStatus !== 'dado_de_baja') ||
      (newStatus === 'aprobado' && oldStatus === 'dado_de_baja');

    const updatePayload: Partial<ProviderUser> = {
      name,
      agency,
      slug,
      email: originalEmail,
      phone,
      bio: this.editBio().trim(),
      website,
      socialMedia: this.editSocialMedia().trim(),
      cuitDni: cuit,
      cbuAlias: cbu,
      bankName: bank,
      accountHolder: holder,
      status: newStatus,
    };

    if (statusChangedToOrFromBaja) {
      const newNotes = this.serializeProviderNotes(notesObj, freeText);
      const originalNotes = (notesToUse || '').trim();
      if (newNotes !== originalNotes) {
        updatePayload.notes = newNotes;
      }
    }

    const res = await this.store.providerStore.adminUpdateProvider(p.email, updatePayload);

    this.saving.set(false);

    if (res.success) {
      let expUpdateErrors = false;
      for (const exp of expsToPause) {
        try {
          await this.expService.updateExperience({ id: exp.id, status: 'oculta' });
        } catch (eErr) {
          expUpdateErrors = true;
          console.warn('[AdminProviders] Error pausando experiencia:', eErr);
        }
      }
      for (const exp of expsToReactivate) {
        try {
          await this.expService.updateExperience({ id: exp.id, status: 'publicada' });
        } catch (eErr) {
          expUpdateErrors = true;
          console.warn('[AdminProviders] Error reactivando experiencia:', eErr);
        }
      }

      if (expUpdateErrors) {
        this.showToast('⚠️ Prestador guardado con éxito, pero algunas experiencias asociadas no pudieron actualizar su estado.');
      } else {
        this.showToast('¡Prestador guardado con éxito!');
      }
      void this.router.navigateByUrl(this.getDetailRoute({ ...p, slug }));
    } else {
      this.showToast(res.message || 'Error al guardar los cambios.');
    }
  }

  private showToast(msg: string): void {
    this.feedbackToast.set(msg);
    setTimeout(() => {
      this.feedbackToast.set(null);
    }, 4000);
  }

  readonly isAdminRoute = computed(() => {
    const rawPath = this.currentUrl().split('?')[0].split('#')[0];
    const segments = rawPath.split('/').filter(Boolean);
    return segments[0] === 'admin';
  });

  readonly backToListLink = computed(() => {
    return this.isAdminRoute() ? '/admin/prestadores' : '/prestadores';
  });

  getDetailRoute(item: ProviderListItem | ProviderUser): string {
    const slug =
      item.slug ||
      ('origin' in item && item.origin === 'application'
        ? item.id
        : slugify(item.agency || item.name || item.id));
    const base = this.isAdminRoute() ? '/admin/prestadores' : '/prestadores';
    return `${base}/${slug}`;
  }

  getEditRoute(item: ProviderListItem | ProviderUser): string {
    const slug =
      item.slug ||
      ('origin' in item && item.origin === 'application'
        ? item.id
        : slugify(item.agency || item.name || item.id));
    const base = this.isAdminRoute() ? '/admin/prestadores' : '/prestadores';
    return `${base}/${slug}/editar`;
  }

  hasProviderRecord(prov?: ProviderUser | null): boolean {
    if (!prov?.slug) return false;
    return Boolean(this.store.providerStore.getProviderBySlug(prov.slug));
  }

  isClubProvider(prov?: ProviderUser | ProviderListItem | null): boolean {
    if (!prov) return false;
    const slug = (prov.slug || '').toLowerCase().trim();
    const email = (prov.email || '').toLowerCase().trim();
    return CLUB_PROVIDER_SLUGS.has(slug) || email === CLUB_PROVIDER_EMAIL;
  }

  getExperienceFicheRoute(slug?: string): string {
    const base = this.isAdminRoute() ? '/admin/experiencias' : '/experiencias';
    return `${base}/${slug || ''}`;
  }

  readonly providerExperiencesList = computed<Experience[]>(() => {
    const p = this.selectedProvider();
    if (!p) return [];
    const pId = p.id;
    const pEmail = (p.email || '').toLowerCase().trim();
    const pSlug = (p.slug || '').toLowerCase().trim();
    return this.expService.experiences().filter(
      (e: Experience) =>
        e.providerId === pId ||
        (e.providerEmail && e.providerEmail.toLowerCase().trim() === pEmail) ||
        (e.providerSlug && e.providerSlug.toLowerCase().trim() === pSlug),
    );
  });

  readonly allProviders = computed<ProviderListItem[]>(() => {
    const list: ProviderListItem[] = [];
    const officialProviders = this.store.providerStore.providers();
    const providerEmails = new Set<string>();

    for (const p of officialProviders) {
      if (!p.verified || p.status === 'dado_de_baja' || p.status === 'pendiente') {
        continue;
      }
      const cleanEmail = p.email?.toLowerCase().trim() || '';
      if (cleanEmail) providerEmails.add(cleanEmail);
      const computedSlug = p.slug || slugify(p.agency || p.name || p.id || cleanEmail);
      list.push({
        id: p.id || `prov-${cleanEmail}`,
        origin: 'official',
        name: p.name || 'Prestador Oficial',
        agency: p.agency || 'Prestador Independiente',
        email: p.email,
        phone: p.phone || '—',
        categoryOrBio: p.bio,
        slug: computedSlug,
        status: 'aprobado',
        createdAt: p.joinedAt || '2024-01-01T00:00:00Z',
        rawProvider: p,
      });
    }

    const applications = this.store.applications().filter((a) => a.type === 'prestador');
    for (const app of applications) {
      const cleanEmail = app.email?.toLowerCase().trim() || '';
      if (cleanEmail && providerEmails.has(cleanEmail)) {
        continue;
      }
      const appSlug = app.id;
      list.push({
        id: app.id,
        origin: 'application',
        name: app.fullName || 'Postulante',
        agency: app.category ? this.formatCategory(app.category) : 'Postulación de Prestador',
        email: app.email,
        phone: app.phone || '—',
        categoryOrBio: app.description || app.motivationLetter,
        slug: appSlug,
        status:
          app.status === 'aprobado'
            ? 'aprobado'
            : app.status === 'rechazado'
              ? 'rechazado'
              : app.status === 'dado_de_baja'
                ? 'dado_de_baja'
                : 'pendiente',
        createdAt: app.createdAt,
        rawApp: app,
      });
    }

    return list;
  });

  readonly officialProvidersCount = computed(
    () => this.allProviders().filter((p) => p.origin === 'official').length,
  );

  readonly pendingApplicationsCount = computed(
    () => this.allProviders().filter((p) => p.origin === 'application' && p.status === 'pendiente').length,
  );

  readonly allApplicationsCount = computed(
    () => this.allProviders().filter((p) => p.origin === 'application').length,
  );

  readonly totalExperiencesCount = computed(
    () => this.store.providerStore.experiences().length,
  );

  readonly filteredProviders = computed(() => {
    let list = this.allProviders();
    const tab = this.activeTab();
    const query = this.searchQuery().trim().toLowerCase();

    if (tab === 'oficiales') {
      list = list.filter((p) => p.origin === 'official');
    } else if (tab === 'postulaciones') {
      list = list.filter((p) => p.origin === 'application');
    }

    if (query) {
      list = list.filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(query);
        const agencyMatch = p.agency.toLowerCase().includes(query);
        const emailMatch = p.email.toLowerCase().includes(query);
        const phoneMatch = p.phone.toLowerCase().includes(query);
        return nameMatch || agencyMatch || emailMatch || phoneMatch;
      });
    }

    return list;
  });

  getWhatsappLink(phone?: string, name?: string): string {
    const cleanDigits = (phone || '').replace(/\D/g, '');
    const cleanName = encodeURIComponent(name || 'Prestador');
    return `https://wa.me/${cleanDigits}?text=Hola%20${cleanName},%20nos%20comunicamos%20desde%20la%20administraci%C3%B3n%20de%20EXPERIENCIAS.CLUB`;
  }

  formatCategory(category?: string): string {
    switch (category) {
      case 'trekking':
        return 'Trekking & Montañismo';
      case '4x4':
        return 'Expediciones 4x4 & Puna';
      case 'kayak':
        return 'Kayak & Deportes Náuticos';
      case 'cabalgata':
        return 'Cabalgatas de Altura';
      case 'arqueologia':
        return 'Rutas Arqueológicas';
      case 'vino_gastronomia':
        return 'Enoturismo & Sabores';
      case 'astro':
        return 'Astroturismo & Cielos Limpios';
      case 'fotografia':
        return 'Safaris Fotográficos';
      default:
        return category || 'Guía de Expediciones';
    }
  }

  openApplication(app: AdminApplication): void {
    this.selectedApplication.set(app);
  }

  closeApplication(): void {
    this.selectedApplication.set(null);
  }

  private readonly providerCoverByExperienceMap = computed(() => {
    const map = new Map<string, string>();
    const exps = this.store.providerStore.experiences();
    for (const exp of exps) {
      if (!exp.coverImage) continue;
      if (exp.providerId && !map.has(exp.providerId)) {
        map.set(exp.providerId, exp.coverImage);
      }
      if (exp.providerEmail) {
        const normEmail = exp.providerEmail.toLowerCase().trim();
        if (normEmail && !map.has(normEmail)) {
          map.set(normEmail, exp.coverImage);
        }
      }
      if (exp.providerSlug) {
        const normSlug = exp.providerSlug.toLowerCase().trim();
        if (normSlug && !map.has(normSlug)) {
          map.set(normSlug, exp.coverImage);
        }
      }
    }
    return map;
  });

  getProviderAvatar(prov?: ProviderUser | ProviderListItem | null): string | null {
    if (!prov) return null;
    const user: ProviderUser | undefined =
      'rawProvider' in prov && prov.rawProvider ? prov.rawProvider : (prov as ProviderUser);

    if (user.avatar && user.avatar.trim()) {
      return user.avatar.trim();
    }
    const slug = (user.slug || '').toLowerCase().trim();
    const email = (user.email || '').toLowerCase().trim();
    if (CLUB_PROVIDER_SLUGS.has(slug) || email === CLUB_PROVIDER_EMAIL) {
      return CLUB_AVATAR_FALLBACK;
    }
    if (user.coverImage && user.coverImage.trim()) {
      return user.coverImage.trim();
    }
    const coverMap = this.providerCoverByExperienceMap();
    if (user.id && coverMap.has(user.id)) {
      return coverMap.get(user.id)!;
    }
    if (email && coverMap.has(email)) {
      return coverMap.get(email)!;
    }
    if (slug && coverMap.has(slug)) {
      return coverMap.get(slug)!;
    }
    return null;
  }

  getPublicProviderUrl(slug?: string | null): string {
    const cleanSlug = encodeURIComponent((slug || '').trim());
    if (typeof window !== 'undefined' && window.location) {
      const origin = window.location.origin;
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return `${origin}/prestadores/${cleanSlug}`;
      }
    }
    return `https://experiencias.club/prestadores/${cleanSlug}`;
  }

  async approve(app: AdminApplication): Promise<void> {
    this.isUpdating.set(true);
    const ok = await this.store.updateApplicationStatus(app.id, 'prestador', 'aprobado');
    this.isUpdating.set(false);
    if (ok) {
      this.closeApplication();
      this.store.providerStore.reloadFromStorage();
    }
  }

  async reject(app: AdminApplication): Promise<void> {
    this.isUpdating.set(true);
    const ok = await this.store.updateApplicationStatus(app.id, 'prestador', 'rechazado');
    this.isUpdating.set(false);
    if (ok) {
      this.closeApplication();
    }
  }
}
