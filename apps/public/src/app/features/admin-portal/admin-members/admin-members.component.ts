import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { filter } from 'rxjs';
import { AdminStoreService, AdminMember } from '../../../core/services/admin-store.service';
import { FechaPipe, ArsPipe } from '../../../shared/pipes/format.pipes';

type MemberFilterTab = 'todos' | 'socios' | 'waitlist' | 'google' | 'convertidos';

@Component({
  selector: 'app-admin-members',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatIconModule, FechaPipe, ArsPipe],
  template: `
    <div class="members-container">
      <!-- Toast Feedback -->
      @if (feedbackToast()) {
        <div class="toast-banner">
          <span>{{ feedbackToast() }}</span>
        </div>
      }

      @if (notFound()) {
        <!-- Modo Error: Socio no encontrado -->
        <div class="empty-state-card">
          <mat-icon class="empty-icon-lg">person_off</mat-icon>
          <h2 class="card-heading">Socio no encontrado</h2>
          <p class="card-subheading">No pudimos encontrar al socio o registro solicitado en el padrón.</p>
          <a [routerLink]="backToListLink()" class="btn-back-panel" style="margin-top: 1.25rem;">
            &larr; Volver a Socios
          </a>
        </div>
      } @else if (isRouteEditMode() && selectedMember(); as m) {
        <!-- Modo Edición: /socios/:id/editar -->
        <div class="edit-page-card">
          <div class="fiche-topbar">
            <div class="topbar-left">
              <a [routerLink]="getDetailRoute(m)" class="btn-back-panel">
                &larr; Volver a la Ficha
              </a>
              <span class="fiche-topbar-breadcrumb">
                /socios / <strong>{{ m.position !== undefined ? '#' + m.position : (m.fullName || m.id) }}</strong> / editar
              </span>
            </div>
          </div>

          <div class="edit-form-card">
            <div class="edit-header">
              <span class="section-kicker">GESTIÓN DE SOCIOS Y NÓMINA</span>
              <h1 class="card-heading">Editar Socio: {{ editFullName() || m.email }}</h1>
              <p class="card-subheading">
                Modificá los datos personales, número de socio asignado en el padrón, nivel de membresía y observaciones.
              </p>
            </div>

            <form (ngSubmit)="saveMemberChanges()" class="member-edit-form">
              <!-- 1. Datos Personales -->
              <div class="form-section">
                <h3 class="form-section-title">
                  <mat-icon>person</mat-icon>
                  Datos de Identidad
                </h3>
                <div class="form-grid">
                  <div class="form-group">
                    <label for="m-name">Nombre y Apellido Completo:</label>
                    <input
                      id="m-name"
                      type="text"
                      class="form-input"
                      [ngModel]="editFullName()"
                      (ngModelChange)="editFullName.set($event)"
                      name="fullName"
                      placeholder="Ej: Juan Pérez"
                      required
                    />
                  </div>

                  <div class="form-group">
                    <label for="m-email">Email Oficial:</label>
                    <input
                      id="m-email"
                      type="email"
                      class="form-input font-mono"
                      [ngModel]="editEmail()"
                      (ngModelChange)="editEmail.set($event)"
                      name="email"
                      placeholder="juan@ejemplo.com"
                      required
                    />
                  </div>

                  <div class="form-group">
                    <label for="m-dni">DNI / Documento:</label>
                    <input
                      id="m-dni"
                      type="text"
                      class="form-input font-mono"
                      [ngModel]="editDni()"
                      (ngModelChange)="editDni.set($event)"
                      name="dni"
                      placeholder="Ej: 34567890"
                    />
                  </div>

                  <div class="form-group">
                    <label for="m-phone">Teléfono / WhatsApp:</label>
                    <input
                      id="m-phone"
                      type="text"
                      class="form-input font-mono"
                      [ngModel]="editPhone()"
                      (ngModelChange)="editPhone.set($event)"
                      name="phone"
                      placeholder="Ej: +54 9 383 456-7890"
                    />
                  </div>
                </div>
              </div>

              <!-- 2. Membresía y Padrón -->
              <div class="form-section">
                <h3 class="form-section-title">
                  <mat-icon>card_membership</mat-icon>
                  Membresía y Número de Socio
                </h3>
                <div class="form-grid">
                  <div class="form-group">
                    <label for="m-pos">Número de Socio en Padrón (#):</label>
                    <input
                      id="m-pos"
                      type="number"
                      class="form-input font-mono"
                      [ngModel]="editPosition()"
                      (ngModelChange)="editPosition.set($event)"
                      name="position"
                      placeholder="Ej: 1, 2, 3... (o dejar vacío)"
                    />
                    <span class="field-hint">Asigna la posición oficial en el cuadro de honor y carnet.</span>
                  </div>

                  <div class="form-group">
                    <label for="m-tier">Nivel de Membresía:</label>
                    <select
                      id="m-tier"
                      class="form-input"
                      [ngModel]="editMembershipTier()"
                      (ngModelChange)="editMembershipTier.set($event)"
                      name="membershipTier"
                    >
                      <option value="fundador">Socio Fundador (Cuadro Vitalicio)</option>
                      <option value="activo">Socio Activo / Pleno</option>
                      <option value="emergente">Socio Emergente</option>
                      <option value="waitlist">Lista de Espera (Waitlist)</option>
                    </select>
                  </div>

                  <div class="form-group">
                    <label for="m-type">Tipo de Registro:</label>
                    <select
                      id="m-type"
                      class="form-input"
                      [ngModel]="editType()"
                      (ngModelChange)="editType.set($event)"
                      name="type"
                    >
                      <option value="socio">Socio Oficial del Club</option>
                      <option value="waitlist">Lista de Espera</option>
                    </select>
                  </div>

                  <div class="form-group">
                    <label for="m-conv">Estado de Pagos / Conversión:</label>
                    <select
                      id="m-conv"
                      class="form-input"
                      [ngModel]="editConverted() ? 'si' : 'no'"
                      (ngModelChange)="editConverted.set($event === 'si')"
                      name="converted"
                    >
                      <option value="si">Pago OK / Comprobante Acreditado</option>
                      <option value="no">Sin Pago Registrado</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- 3. Observaciones & Deseos -->
              <div class="form-section">
                <h3 class="form-section-title">
                  <mat-icon>notes</mat-icon>
                  Observaciones y Expediciones Sugeridas
                </h3>
                <div class="form-group full-width">
                  <label for="m-notes">Observaciones del socio / Otras experiencias deseadas:</label>
                  <textarea
                    id="m-notes"
                    class="form-textarea"
                    rows="4"
                    [ngModel]="editExperiencesOther()"
                    (ngModelChange)="editExperiencesOther.set($event)"
                    name="experiencesOther"
                    placeholder="Comentarios adicionales, deseos de travesías o notas administrativas..."
                  ></textarea>
                </div>
              </div>

              <!-- Botones de Acción -->
              <div class="form-actions-bar">
                <a [routerLink]="getDetailRoute(m)" class="btn-cancel-edit">Cancelar</a>
                <button
                  type="submit"
                  class="btn-save-orange"
                  [disabled]="saving()"
                >
                  {{ saving() ? 'Guardando cambios...' : 'Guardar Información del Socio' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      } @else if (isRouteDetailMode() && selectedMember(); as m) {
        <!-- Modo Ficha: /socios/:id -->
        <div class="fiche-view-container">
          <!-- Topbar de Navegación -->
          <div class="fiche-topbar">
            <div class="topbar-left">
              <a [routerLink]="backToListLink()" class="btn-back-panel">
                &larr; Volver a Socios
              </a>
              <span class="fiche-topbar-breadcrumb">
                /socios / <strong>{{ m.position !== undefined ? '#' + m.position : (m.fullName || m.id) }}</strong>
              </span>
            </div>
            <div class="topbar-right">
              <a [routerLink]="getEditRoute(m)" class="btn-topbar-edit">
                <mat-icon class="btn-icon-sm">edit</mat-icon>
                <span>Editar Socio</span>
              </a>
            </div>
          </div>

          <!-- Hero del Socio -->
          <div class="fiche-section-card hero-member-card">
            <div class="member-hero-content">
              <div class="member-hero-avatar">
                @if (m.position !== undefined) {
                  <span class="member-pos-badge">#{{ m.position }}</span>
                } @else {
                  <span class="member-avatar-initial">{{ (m.fullName || m.email).charAt(0).toUpperCase() }}</span>
                }
              </div>
              <div class="member-hero-text">
                <div class="hero-kicker-row">
                  <span class="hero-kicker">
                    {{ m.type === 'waitlist' ? 'LISTA DE ESPERA' : formatTier(m.membershipTier).toUpperCase() }}
                  </span>
                  <div class="hero-badges-row">
                    <a
                      [routerLink]="getEditRoute(m)"
                      class="btn-hero-edit"
                      title="Editar datos del socio"
                    >
                      <span>EDITAR SOCIO</span>
                    </a>
                    @if (m.position !== undefined) {
                      <span class="socio-pill-badge">#{{ m.position }}</span>
                    }
                    <span class="tier-badge" [attr.data-tier]="m.membershipTier">
                      {{ formatTier(m.membershipTier) }}
                    </span>
                    @if (m.googleLinked) {
                      <span class="google-linked-pill" title="Cuenta vinculada vía Google OAuth">GOOGLE</span>
                    }
                    @if (m.converted) {
                      <span class="converted-pill" title="Pago o comprobante registrado">PAGO OK</span>
                    } @else {
                      <span class="pending-conversion-pill">SIN PAGO</span>
                    }
                  </div>
                </div>
                <h1 class="member-hero-title">
                  {{ m.fullName && m.fullName.trim() !== '' && m.fullName !== 'Lista de Espera (Email)' ? m.fullName : 'Socio sin nombre' }}
                </h1>
                <p class="member-hero-subtitle">
                  Email: <strong class="font-mono text-white">{{ m.email }}</strong>
                  @if (m.dni && m.dni !== '—') {
                    &bull; DNI: <span class="font-mono text-white">{{ m.dni }}</span>
                  }
                  @if (m.phone && m.phone !== '—') {
                    &bull; WhatsApp: <span class="font-mono text-white">{{ m.phone }}</span>
                  }
                </p>
              </div>
            </div>
          </div>

          <!-- Grid de Secciones de Información -->
          <div class="fiche-grid-details">
            <!-- 1. Datos Personales & Membresía -->
            <div class="fiche-section-card">
              <h3 class="fiche-card-title">Datos Personales y Membresía</h3>
              <div class="info-list">
                <div class="info-row">
                  <span class="info-label">Nombre y Apellido:</span>
                  <strong class="info-val">{{ m.fullName || '—' }}</strong>
                </div>
                <div class="info-row">
                  <span class="info-label">DNI / Documento:</span>
                  <strong class="info-val font-mono">{{ m.dni || '—' }}</strong>
                </div>
                <div class="info-row">
                  <span class="info-label">Nivel de Membresía:</span>
                  <span class="tier-badge" [attr.data-tier]="m.membershipTier">{{ formatTier(m.membershipTier) }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Número en Padrón:</span>
                  <strong class="info-val font-mono text-orange">
                    {{ m.position !== undefined ? '#' + m.position : 'Sin número asignado' }}
                  </strong>
                </div>
                <div class="info-row">
                  <span class="info-label">Tipo de Registro:</span>
                  <strong class="info-val">{{ m.type === 'socio' ? 'Socio Oficial' : 'Lista de Espera (Waitlist)' }}</strong>
                </div>
                <div class="info-row">
                  <span class="info-label">Fecha de Alta:</span>
                  <span class="info-val">{{ m.createdAt | fecha: 'larga' }}</span>
                </div>
              </div>
            </div>

            <!-- 2. Contacto y Canales -->
            <div class="fiche-section-card">
              <h3 class="fiche-card-title">Contacto y Comunicación</h3>
              <div class="info-list">
                <div class="info-row">
                  <span class="info-label">Email Registrado:</span>
                  <a [href]="'mailto:' + m.email" class="info-link font-mono">{{ m.email }}</a>
                </div>
                <div class="info-row">
                  <span class="info-label">WhatsApp / Teléfono:</span>
                  @if (m.phone && m.phone !== '—') {
                    <a
                      [href]="getWhatsappLink(m.phone, m.fullName)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="contact-whatsapp font-mono"
                      title="Abrir conversación en WhatsApp"
                    >
                      <span>{{ m.phone }}</span>
                    </a>
                  } @else {
                    <span class="text-muted">Sin teléfono cargado</span>
                  }
                </div>
                <div class="info-row">
                  <span class="info-label">Rol Especial:</span>
                  @if (isProvider(m)) {
                    <span class="badge-special-role text-blue">Prestador de Servicios Turísticos</span>
                  } @else {
                    <span class="text-muted">Explorador / Socio</span>
                  }
                </div>
                <div class="info-row">
                  <span class="info-label">Identificador Único (UUID):</span>
                  <span class="font-mono text-muted text-sm">{{ m.id }}</span>
                </div>
              </div>
            </div>

            <!-- 3. Estado de la Cuenta & Seguridad -->
            <div class="fiche-section-card">
              <h3 class="fiche-card-title">Cuenta, Acceso y Pagos</h3>
              <div class="info-list">
                <div class="info-row">
                  <span class="info-label">Autenticación Google:</span>
                  @if (m.googleLinked) {
                    <span class="status-pill is-published">Cuenta Google Vinculada</span>
                  } @else {
                    <span class="status-pill is-draft">Sin vincular</span>
                  }
                </div>
                <div class="info-row">
                  <span class="info-label">Estado de Pagos / Conversión:</span>
                  @if (m.converted) {
                    <span class="converted-pill">Pago OK / Acreditado</span>
                  } @else {
                    <span class="pending-conversion-pill">Sin pagos registrados</span>
                  }
                </div>
                <div class="info-row">
                  <span class="info-label">Total Comprobantes Enviados:</span>
                  <strong class="info-val font-mono">{{ memberPayments().length }}</strong>
                </div>
              </div>
            </div>

            <!-- 4. Wishlist & Preferencias de Expedición -->
            <div class="fiche-section-card">
              <h3 class="fiche-card-title">Intereses & Deseos de Expedición</h3>
              <div class="wishlist-container">
                @if (m.experiencesWishlist && m.experiencesWishlist.length > 0) {
                  <div class="wishlist-chips">
                    @for (item of m.experiencesWishlist; track item) {
                      <span class="wishlist-chip">{{ item }}</span>
                    }
                  </div>
                } @else {
                  <p class="text-muted">No seleccionó experiencias específicas en el formulario inicial.</p>
                }

                @if (m.experiencesOther) {
                  <div class="experiences-other-box">
                    <span class="info-label">Otras sugerencias / Observaciones:</span>
                    <p class="other-text">{{ m.experiencesOther }}</p>
                  </div>
                }
              </div>
            </div>

            <!-- 5. Comprobantes de Pago Registrados (si existen) -->
            @if (memberPayments().length > 0) {
              <div class="fiche-section-card full-width">
                <h3 class="fiche-card-title">Historial de Comprobantes de Pago de este Socio</h3>
                <div class="table-responsive">
                  <table class="sub-table">
                    <thead>
                      <tr>
                        <th>Referencia</th>
                        <th>Experiencia</th>
                        <th>Fecha Salida</th>
                        <th>Monto ARS</th>
                        <th>Estado</th>
                        <th>Fecha Envío</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (sub of memberPayments(); track sub.id) {
                        <tr>
                          <td class="font-mono"><strong>#{{ sub.reference }}</strong></td>
                          <td>{{ sub.experienceTitle }}</td>
                          <td>{{ sub.date | fecha: 'corta' }}</td>
                          <td><strong class="text-blue">{{ sub.amountArs | ars }}</strong></td>
                          <td>
                            <span class="status-pill" [attr.data-status]="sub.status">
                              {{ sub.status === 'aprobado' ? 'Aprobado' : sub.status === 'rechazado' ? 'Rechazado' : 'Pendiente' }}
                            </span>
                          </td>
                          <td>{{ (sub.submittedAt || sub.date) | fecha: 'corta' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          </div>
        </div>
      } @else {
        <!-- Modo Lista: /socios o /admin/socios -->
        <div class="members-header">
          <div>
            <span class="section-kicker">NÓMINA GENERAL DEL CLUB</span>
            <div class="title-row">
              <h1 class="card-heading">Lista Completa de Socios</h1>
            </div>
            <p class="card-subheading">
              Padrón consolidado de socios emergentes, plenos, fundadores y prospectos de la lista de
              espera.
            </p>
          </div>
        </div>

        <!-- Métricas Rápidas de Nómina -->
        <div class="summary-strip">
          <div class="summary-item">
            <span class="sum-label">Lista de Espera</span>
            <strong class="sum-value">{{ store.stats().totalWaitlist }}</strong>
            <span class="sum-sub">Prospectos registrados</span>
          </div>
          <div class="summary-item">
            <span class="sum-label">Socios a la Semana</span>
            <strong class="sum-value">{{ store.stats().membersThisWeek }}</strong>
            <span class="sum-sub">Últimos 7 días</span>
          </div>
          <div class="summary-item">
            <span class="sum-label">Socios al Mes</span>
            <strong class="sum-value">{{ store.stats().membersThisMonth }}</strong>
            <span class="sum-sub">Mes en curso</span>
          </div>
          <div class="summary-item">
            <span class="sum-label">Socios Totales</span>
            <strong class="sum-value">{{ store.stats().totalGoogleLinked }}</strong>
            <span class="sum-sub">Con cuenta vinculada a Google</span>
          </div>
        </div>

        <!-- Filtros y Búsqueda -->
        <div class="filters-bar">
          <div class="search-box">
            <mat-icon class="search-icon">search</mat-icon>
            <input
              type="text"
              class="search-input"
              placeholder="Buscar por nombre, email, DNI, teléfono o # socio..."
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
            />
            @if (searchQuery()) {
              <button type="button" class="clear-search-btn" (click)="searchQuery.set('')">×</button>
            }
          </div>

          <div class="filter-tabs">
            <button
              type="button"
              class="filter-tab"
              [class.is-active]="activeTab() === 'todos'"
              (click)="activeTab.set('todos')"
            >
              Todos ({{ store.stats().totalRecords }})
            </button>

            <button
              type="button"
              class="filter-tab"
              [class.is-active]="activeTab() === 'socios'"
              (click)="activeTab.set('socios')"
            >
              Socios Oficiales ({{ store.stats().totalSocios }})
            </button>

            <button
              type="button"
              class="filter-tab"
              [class.is-active]="activeTab() === 'waitlist'"
              (click)="activeTab.set('waitlist')"
            >
              Lista de Espera ({{ store.stats().totalWaitlist }})
            </button>

            <button
              type="button"
              class="filter-tab"
              [class.is-active]="activeTab() === 'google'"
              (click)="activeTab.set('google')"
            >
              Google Vinculado ({{ store.stats().totalGoogleLinked }})
            </button>

            <button
              type="button"
              class="filter-tab"
              [class.is-active]="activeTab() === 'convertidos'"
              (click)="activeTab.set('convertidos')"
            >
              Pago OK ({{ store.stats().totalConverted }})
            </button>
          </div>
        </div>

        <!-- Tabla Principal de Socios & Waitlist -->
        @if (filteredMembers().length === 0) {
          <div class="empty-box">
            <mat-icon>person_search</mat-icon>
            <h3>No se encontraron registros</h3>
            <p>Probá cambiando la búsqueda o seleccionando otra pestaña de filtro.</p>
          </div>
        } @else {
          <div class="table-wrapper">
            <table class="members-table">
              <thead>
                <tr>
                  <th class="col-socio"># Socio</th>
                  <th class="col-titular">Titular</th>
                  <th class="col-contacto">Contacto</th>
                  <th class="col-dni">DNI</th>
                  <th class="col-nivel">Membresía</th>
                  <th class="col-estado">Estado</th>
                  <th class="col-fecha">Fecha Registro</th>
                  <th class="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (m of filteredMembers(); track m.id) {
                  <tr [class.is-waitlist]="m.type === 'waitlist' && !m.googleLinked" [class.is-google]="m.googleLinked">
                    <!-- # Socio / Posición -->
                    <td>
                      @if (m.type === 'socio') {
                        <a [routerLink]="getDetailRoute(m)" class="socio-number-badge" title="Ver ficha del socio">
                          <span class="socio-hash">#</span>
                          <strong>{{ m.position }}</strong>
                        </a>
                      } @else {
                        <span class="waitlist-pill">Waitlist</span>
                      }
                    </td>

                    <!-- Titular -->
                    <td>
                      <div class="member-identity">
                        @if (m.fullName && m.fullName.trim() !== '' && m.fullName !== 'Lista de Espera (Email)') {
                          <a [routerLink]="getDetailRoute(m)" class="member-name-link" title="Ver ficha de {{ m.fullName }}">
                            <strong class="member-name">{{ m.fullName }}</strong>
                          </a>
                        } @else {
                          <a [routerLink]="getDetailRoute(m)" class="member-name-link">
                            <strong class="member-name is-unassigned">—</strong>
                          </a>
                        }
                        @if (m.type === 'waitlist' && !m.googleLinked) {
                          <span class="member-sub-hint">Pendiente de completar formulario</span>
                        } @else if (m.type === 'waitlist' && m.googleLinked) {
                          <span class="member-sub-hint">Cuenta Google vinculada</span>
                        } @else if (m.experiencesWishlist && m.experiencesWishlist.length > 0) {
                          <span class="member-sub-hint"
                            >Deseos: {{ m.experiencesWishlist.join(', ') }}</span
                          >
                        }
                      </div>
                    </td>

                    <!-- Contacto (Email + WhatsApp) -->
                    <td>
                      <div class="member-contact">
                        <span class="contact-email">
                          {{ m.email }}
                        </span>
                        @if (m.phone && m.phone !== '—') {
                          <a
                            [href]="getWhatsappLink(m.phone, m.fullName)"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="contact-whatsapp"
                            title="Contactar vía WhatsApp"
                          >
                            <span>{{ m.phone }}</span>
                          </a>
                        }
                      </div>
                    </td>

                    <!-- DNI -->
                    <td>
                      <span class="member-dni font-mono">{{ m.dni || '—' }}</span>
                    </td>

                    <!-- Membresía -->
                    <td>
                      <span class="tier-badge" [attr.data-tier]="m.membershipTier">
                        {{ formatTier(m.membershipTier) }}
                      </span>
                    </td>

                    <!-- Google y Conversión -->
                    <td>
                      <div class="status-tags-row">
                        @if (m.googleLinked) {
                          <span
                            class="google-linked-pill"
                            [class.is-provider-google]="isProvider(m)"
                            [title]="isProvider(m) ? 'Prestador con cuenta vinculada vía Google OAuth' : 'Cuenta vinculada vía Google OAuth'"
                            >GOOGLE</span
                          >
                        }

                        @if (m.converted) {
                          <span
                            class="converted-pill"
                            title="Pagó al menos una experiencia / envió comprobante"
                            >Pago OK</span
                          >
                        } @else {
                          <span
                            class="pending-conversion-pill"
                            title="Sin comprobante ni pago registrado"
                            >Sin pago</span
                          >
                        }
                      </div>
                    </td>

                    <!-- Fecha de Registro -->
                    <td>
                      <span class="member-date">{{ m.createdAt | fecha: 'corta' }}</span>
                    </td>

                    <!-- Acciones -->
                    <td class="text-right">
                      <div class="actions-row">
                        <a
                          [routerLink]="getDetailRoute(m)"
                          class="btn-view-fiche"
                          title="Ver ficha completa de este socio"
                        >
                          <span>VER FICHA</span>
                        </a>

                        <a
                          [routerLink]="getEditRoute(m)"
                          class="btn-edit-exp"
                          title="Editar información de este socio"
                        >
                          <span>EDITAR</span>
                        </a>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Acciones al pie de la tabla -->
          <div class="table-footer-actions">
            <button
              type="button"
              class="btn-footer-action"
              (click)="refresh()"
              [disabled]="store.isLoadingMembers()"
            >
              {{ store.isLoadingMembers() ? 'Actualizando...' : 'Refrescar Datos' }}
            </button>

            <button type="button" class="btn-footer-action" (click)="downloadRoster()">
              Descargar Planilla
            </button>
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

      .members-container {
        display: flex;
        flex-direction: column;
        gap: 1.15rem;
        margin-top: 0;
        padding-top: 0;
      }

      .toast-banner {
        padding: 0.85rem 1.25rem;
        background: rgba(255, 95, 0, 0.15);
        border: 1px solid rgba(255, 95, 0, 0.45);
        border-radius: 4px;
        color: #ff9955;
        font-size: 0.9rem;
        font-weight: 700;
        text-align: center;
      }

      .empty-state-card {
        padding: 3rem 1.5rem;
        text-align: center;
        background: rgba(20, 10, 5, 0.85);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 4px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }

      .empty-icon-lg {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: rgba(255, 95, 0, 0.5);
        margin-bottom: 0.75rem;
      }

      .members-header {
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

      .title-row {
        display: flex;
        align-items: center;
        gap: 1.25rem;
        margin: 0 0 0.5rem;
        flex-wrap: wrap;
      }

      .card-heading {
        font-size: 1.75rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0;
        letter-spacing: -0.02em;
        line-height: 1.15;
      }

      .card-subheading {
        font-size: 0.88rem;
        color: rgba(255, 255, 255, 0.75);
        margin: 0;
        max-width: 700px;
        line-height: 1.45;
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

      /* Summary Strip */
      .summary-strip {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 1rem;
      }

      @media (max-width: 900px) {
        .summary-strip {
          grid-template-columns: repeat(2, 1fr) !important;
          gap: 0.65rem;
        }
      }

      @media (max-width: 480px) {
        .summary-strip {
          grid-template-columns: 1fr !important;
        }
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
        font-size: 0.72rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.65);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .sum-value {
        font-size: 1.85rem;
        font-weight: 800;
        color: #ffffff;
        line-height: 1.1;
      }

      .sum-sub {
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.5);
      }

      .text-orange {
        color: #ff5f00 !important;
      }
      .text-blue {
        color: #60a5fa !important;
      }
      .text-green {
        color: #34d399 !important;
      }
      .text-white {
        color: #ffffff !important;
      }
      .text-muted {
        color: rgba(255, 255, 255, 0.5) !important;
      }
      .text-sm {
        font-size: 0.75rem !important;
      }

      /* Filters & Search */
      .filters-bar {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        background: rgba(22, 12, 6, 0.85);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 2px;
        padding: 1rem;
      }

      .search-box {
        position: relative;
        display: flex;
        align-items: center;
      }

      .search-icon {
        position: absolute;
        left: 0.85rem;
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #ff5f00;
      }

      .search-input {
        width: 100%;
        background: rgba(12, 6, 3, 0.9);
        border: 1px solid rgba(255, 95, 0, 0.35);
        color: #ffffff;
        font-size: 0.88rem;
        padding: 0.65rem 2.5rem 0.65rem 2.5rem;
        border-radius: 2px;
        outline: none;
        transition: border-color 0.2s;
        box-sizing: border-box;
      }

      .search-input:focus {
        border-color: #ff5f00;
        box-shadow: 0 0 10px rgba(255, 95, 0, 0.25);
      }

      .clear-search-btn {
        position: absolute;
        right: 0.85rem;
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        font-size: 1.25rem;
        cursor: pointer;
      }

      .filter-tabs {
        display: flex;
        gap: 0.45rem;
        flex-wrap: wrap;
      }

      .filter-tab {
        padding: 0.45rem 0.85rem;
        background: rgba(30, 16, 9, 0.6);
        border: 1px solid rgba(255, 95, 0, 0.25);
        color: rgba(255, 255, 255, 0.75);
        font-size: 0.78rem;
        font-weight: 700;
        border-radius: 2px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .filter-tab:hover {
        background: rgba(255, 95, 0, 0.15);
        color: #ffffff;
      }

      .filter-tab.is-active {
        background: #ff5f00;
        color: #0b0704;
        border-color: #ff5f00;
      }

      /* Members Table */
      .table-wrapper {
        background: rgba(20, 10, 5, 0.82);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 2px;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        width: 100%;
        max-width: 100%;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
      }

      .members-table {
        width: 100%;
        min-width: 880px;
        border-collapse: collapse;
        text-align: left;
        font-size: 0.82rem;
      }

      .members-table th {
        background: rgba(35, 18, 10, 0.95);
        padding: 0.85rem 1rem;
        font-size: 0.7rem;
        font-weight: 800;
        color: #ff8533;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        border-bottom: 1px solid rgba(255, 95, 0, 0.3);
        white-space: nowrap;
      }

      .members-table td {
        padding: 0.85rem 1rem;
        border-bottom: 1px solid rgba(255, 95, 0, 0.15);
        color: rgba(255, 255, 255, 0.85);
        vertical-align: middle;
      }

      .members-table tbody tr:hover {
        background: rgba(255, 95, 0, 0.08);
      }

      .members-table tbody tr.is-waitlist {
        background: rgba(0, 0, 0, 0.15);
      }

      .members-table th.text-right,
      .members-table td.text-right {
        text-align: right;
        position: sticky;
        right: 0;
        z-index: 5;
        background: #140b06;
        box-shadow: -6px 0 16px rgba(0, 0, 0, 0.45);
        white-space: nowrap;
      }

      .members-table th.text-right {
        background: #23120a;
      }

      .members-table tbody tr:hover td.text-right {
        background: #241309;
      }

      .socio-number-badge {
        display: inline-flex;
        align-items: baseline;
        gap: 0.15rem;
        padding: 0.25rem 0.55rem;
        background: rgba(255, 95, 0, 0.18);
        border: 1px solid rgba(255, 95, 0, 0.45);
        color: #ffffff;
        font-family: var(--font-mono, monospace);
        font-size: 0.85rem;
        border-radius: 2px;
        white-space: nowrap;
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .socio-number-badge:hover {
        background: rgba(255, 95, 0, 0.3);
        border-color: #ff5f00;
        color: #ffffff;
      }

      .socio-hash {
        color: #ff5f00;
        font-weight: 800;
      }

      .waitlist-pill {
        display: inline-block;
        padding: 0.2rem 0.5rem;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: rgba(255, 255, 255, 0.75);
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        border-radius: 2px;
        white-space: nowrap;
      }

      .member-identity {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }

      .member-name-link {
        text-decoration: none;
        color: inherit;
        display: inline-block;
      }

      .member-name-link:hover .member-name {
        color: #ff8533;
        text-decoration: underline;
      }

      .member-name {
        color: #ffffff;
        font-size: 0.88rem;
        transition: color 0.2s ease;
      }

      .member-name.is-unassigned {
        color: rgba(255, 255, 255, 0.4);
        font-family: var(--font-mono, monospace);
      }

      .member-sub-hint {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.5);
      }

      .member-contact {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .contact-email {
        color: #ffffff;
        font-family: var(--font-mono, monospace);
        font-size: 0.78rem;
        white-space: nowrap;
      }

      .contact-whatsapp {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        color: rgba(255, 255, 255, 0.5);
        text-decoration: none;
        font-size: 0.75rem;
        font-family: var(--font-mono, monospace);
        white-space: nowrap;
        transition: color 0.2s ease;
      }

      .contact-whatsapp:hover {
        color: #34d399;
        text-decoration: underline;
      }

      .font-mono {
        font-family: var(--font-mono, monospace);
      }

      .member-dni {
        white-space: nowrap;
      }

      .tier-badge {
        display: inline-block;
        padding: 0.2rem 0.55rem;
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        border-radius: 2px;
        letter-spacing: 0.05em;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.25);
        color: #ffffff;
        white-space: nowrap;
      }

      .tier-badge[data-tier='fundador'] {
        background: rgba(128, 179, 255, 0.14);
        border: 1px solid rgba(128, 179, 255, 0.4);
        color: #80b3ff;
      }

      .status-tags-row {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        white-space: nowrap;
      }

      .google-linked-pill,
      .pending-conversion-pill {
        display: inline-flex;
        align-items: center;
        padding: 0.15rem 0.45rem;
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.25);
        color: #ffffff;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        border-radius: 2px;
        width: fit-content;
        white-space: nowrap;
      }

      .google-linked-pill.is-provider-google {
        background: #80b3ff;
        border-color: #80b3ff;
        color: #ffffff;
        font-weight: 800;
        box-shadow: 0 0 10px rgba(128, 179, 255, 0.45);
      }

      .converted-pill {
        display: inline-flex;
        align-items: center;
        padding: 0.15rem 0.45rem;
        background: rgba(16, 185, 129, 0.2);
        border: 1px solid rgba(52, 211, 153, 0.45);
        color: #34d399;
        font-size: 0.68rem;
        font-weight: 800;
        border-radius: 2px;
        width: fit-content;
        white-space: nowrap;
      }

      .member-date {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.6);
        white-space: nowrap;
      }

      .actions-row {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.35rem;
      }

      .btn-view-fiche,
      .btn-edit-exp {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 28px;
        padding: 0 0.65rem;
        border-radius: 2px;
        font-size: 0.72rem;
        font-weight: 700;
        cursor: pointer;
        text-decoration: none;
        white-space: nowrap;
        box-sizing: border-box;
        line-height: 1;
        transition: all 0.2s ease;
      }

      .btn-view-fiche {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #ffffff;
      }

      .btn-view-fiche:hover {
        background: rgba(255, 255, 255, 0.16);
        border-color: #ffffff;
      }

      .btn-edit-exp {
        background: rgba(255, 95, 0, 0.15);
        border: 1px solid rgba(255, 95, 0, 0.4);
        color: #ffaa73;
      }

      .btn-edit-exp:hover {
        background: #ff5f00;
        color: #0b0704;
      }

      .table-footer-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        margin-top: -0.35rem;
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

      .empty-box {
        padding: 4rem 2rem;
        text-align: center;
        background: rgba(20, 10, 5, 0.85);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 2px;
      }

      .empty-box mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: rgba(255, 95, 0, 0.5);
        margin-bottom: 0.5rem;
      }

      .empty-box h3 {
        color: #ffffff;
        margin: 0 0 0.5rem;
      }

      .empty-box p {
        color: rgba(255, 255, 255, 0.6);
        margin: 0;
      }

      /* ============================================================
         FICHE DETAIL MODE STYLING
         ============================================================ */
      .fiche-view-container {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .fiche-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .topbar-left {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .fiche-topbar-breadcrumb {
        font-size: 0.82rem;
        color: rgba(255, 255, 255, 0.6);
        font-family: var(--font-mono, monospace);
      }

      .fiche-topbar-breadcrumb strong {
        color: #ff8533;
      }

      .btn-topbar-edit {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.5rem 1rem;
        background: rgba(255, 95, 0, 0.18);
        border: 1px solid #ff5f00;
        color: #ffffff;
        font-size: 0.8rem;
        font-weight: 700;
        border-radius: 4px;
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .btn-topbar-edit:hover {
        background: #ff5f00;
        color: #0b0704;
      }

      .btn-icon-sm {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      .fiche-section-card {
        background: rgba(20, 10, 5, 0.85);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 4px;
        padding: 1.5rem;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
      }

      .hero-member-card {
        padding: 2rem 1.75rem;
      }

      .member-hero-content {
        display: flex;
        align-items: center;
        gap: 1.5rem;
      }

      .member-hero-avatar {
        flex-shrink: 0;
      }

      .member-pos-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 68px;
        height: 68px;
        border-radius: 50%;
        background: rgba(255, 95, 0, 0.2);
        border: 2px solid #ff5f00;
        color: #ffffff;
        font-family: var(--font-mono, monospace);
        font-size: 1.35rem;
        font-weight: 900;
        box-shadow: 0 0 20px rgba(255, 95, 0, 0.3);
      }

      .member-avatar-initial {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 68px;
        height: 68px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        border: 2px solid rgba(255, 255, 255, 0.3);
        color: #ffffff;
        font-size: 1.75rem;
        font-weight: 800;
      }

      .member-hero-text {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        flex: 1;
      }

      .hero-kicker-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .hero-kicker {
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        color: #ff5f00;
        text-transform: uppercase;
      }

      .hero-badges-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .btn-hero-edit {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 28px;
        padding: 0 0.75rem;
        background: #ff5f00;
        border: 1px solid #ff5f00;
        border-radius: 3px;
        color: #0b0704;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.03em;
        text-decoration: none;
        box-sizing: border-box;
        line-height: 1;
        transition: all 0.2s ease;
      }

      .btn-hero-edit:hover {
        background: #ff7728;
        border-color: #ff7728;
      }

      .socio-pill-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 28px;
        padding: 0 0.65rem;
        background: rgba(255, 95, 0, 0.2);
        border: 1px solid rgba(255, 95, 0, 0.5);
        color: #ffaa73;
        font-family: var(--font-mono, monospace);
        font-size: 0.78rem;
        font-weight: 800;
        border-radius: 3px;
        box-sizing: border-box;
        line-height: 1;
      }

      .member-hero-title {
        font-size: 1.85rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0.2rem 0;
        letter-spacing: -0.02em;
        line-height: 1.15;
      }

      .member-hero-subtitle {
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.65);
        margin: 0;
      }

      .fiche-grid-details {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1.25rem;
      }

      @media (max-width: 850px) {
        .fiche-grid-details {
          grid-template-columns: 1fr !important;
        }
      }

      .fiche-section-card.full-width {
        grid-column: 1 / -1;
      }

      .fiche-card-title {
        font-size: 0.95rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0 0 1rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid rgba(255, 95, 0, 0.25);
        letter-spacing: 0.02em;
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
      }

      .info-label {
        color: rgba(255, 255, 255, 0.6);
        font-weight: 600;
      }

      .info-val {
        color: #ffffff;
        text-align: right;
      }

      .info-link {
        color: #ffaa73;
        text-decoration: none;
      }

      .info-link:hover {
        text-decoration: underline;
      }

      .badge-special-role {
        font-weight: 700;
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 28px;
        padding: 0 0.65rem;
        border-radius: 3px;
        font-size: 0.74rem;
        font-weight: 800;
        box-sizing: border-box;
        line-height: 1;
      }

      .status-pill.is-published {
        background: rgba(16, 185, 129, 0.2);
        border: 1px solid rgba(52, 211, 153, 0.45);
        color: #34d399;
      }

      .status-pill.is-draft {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: rgba(255, 255, 255, 0.7);
      }

      .status-pill[data-status='aprobado'] {
        background: rgba(16, 185, 129, 0.2);
        border: 1px solid rgba(52, 211, 153, 0.45);
        color: #34d399;
      }

      .status-pill[data-status='pendiente'] {
        background: rgba(255, 95, 0, 0.2);
        border: 1px solid rgba(255, 95, 0, 0.45);
        color: #ff8533;
      }

      .status-pill[data-status='rechazado'] {
        background: rgba(239, 68, 68, 0.2);
        border: 1px solid rgba(239, 68, 68, 0.45);
        color: #fca5a5;
      }

      .wishlist-container {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }

      .wishlist-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .wishlist-chip {
        padding: 0.35rem 0.75rem;
        background: rgba(255, 95, 0, 0.15);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 3px;
        color: #ffffff;
        font-size: 0.8rem;
        font-weight: 600;
      }

      .experiences-other-box {
        margin-top: 0.5rem;
        padding: 0.75rem 1rem;
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 3px;
      }

      .other-text {
        margin: 0.35rem 0 0;
        color: #ffffff;
        font-size: 0.85rem;
        line-height: 1.4;
      }

      .table-responsive {
        overflow-x: auto;
        width: 100%;
      }

      .sub-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.82rem;
        text-align: left;
      }

      .sub-table th {
        background: rgba(35, 18, 10, 0.95);
        padding: 0.65rem 0.85rem;
        font-size: 0.68rem;
        font-weight: 800;
        color: #ff8533;
        text-transform: uppercase;
        border-bottom: 1px solid rgba(255, 95, 0, 0.3);
      }

      .sub-table td {
        padding: 0.75rem 0.85rem;
        border-bottom: 1px solid rgba(255, 95, 0, 0.12);
        color: rgba(255, 255, 255, 0.85);
      }

      /* ============================================================
         EDIT FORM MODE STYLING
         ============================================================ */
      .edit-page-card {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .edit-form-card {
        background: rgba(20, 10, 5, 0.85);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 4px;
        padding: 2rem;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
      }

      .edit-header {
        margin-bottom: 2rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid rgba(255, 95, 0, 0.25);
      }

      .member-edit-form {
        display: flex;
        flex-direction: column;
        gap: 2rem;
      }

      .form-section {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .form-section-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1rem;
        font-weight: 800;
        color: #ff8533;
        margin: 0;
        letter-spacing: 0.02em;
      }

      .form-section-title mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #ff5f00;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1.25rem;
      }

      @media (max-width: 768px) {
        .form-grid {
          grid-template-columns: 1fr !important;
        }
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .form-group.full-width {
        grid-column: 1 / -1;
      }

      .form-group label {
        font-size: 0.8rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.8);
      }

      .form-input,
      .form-textarea {
        background: rgba(12, 6, 3, 0.9);
        border: 1px solid rgba(255, 95, 0, 0.35);
        color: #ffffff;
        font-size: 0.88rem;
        padding: 0.65rem 0.85rem;
        border-radius: 3px;
        outline: none;
        transition: border-color 0.2s, box-shadow 0.2s;
        box-sizing: border-box;
        font-family: inherit;
      }

      .form-input:focus,
      .form-textarea:focus {
        border-color: #ff5f00;
        box-shadow: 0 0 10px rgba(255, 95, 0, 0.25);
      }

      select.form-input {
        cursor: pointer;
      }

      select.form-input option {
        background: #140b06;
        color: #ffffff;
      }

      .field-hint {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.5);
      }

      .form-actions-bar {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 1rem;
        margin-top: 1rem;
        padding-top: 1.5rem;
        border-top: 1px solid rgba(255, 95, 0, 0.25);
      }

      .btn-cancel-edit {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.65rem 1.25rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #ffffff;
        border-radius: 4px;
        font-size: 0.85rem;
        font-weight: 700;
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .btn-cancel-edit:hover {
        background: rgba(255, 255, 255, 0.16);
        border-color: #ffffff;
      }

      .btn-save-orange {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.65rem 1.5rem;
        background: #ff5f00;
        border: 1px solid #ff5f00;
        color: #0b0704;
        border-radius: 4px;
        font-size: 0.85rem;
        font-weight: 800;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-save-orange:hover:not(:disabled) {
        background: #ff7728;
        border-color: #ff7728;
        box-shadow: 0 4px 15px rgba(255, 95, 0, 0.35);
      }

      .btn-save-orange:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `,
  ],
})
export class AdminMembersComponent implements OnInit {
  readonly store = inject(AdminStoreService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly searchQuery = signal<string>('');
  readonly activeTab = signal<MemberFilterTab>('todos');

  // Modos de ruta
  readonly isRouteEditMode = signal<boolean>(false);
  readonly isRouteDetailMode = signal<boolean>(false);
  readonly notFound = signal<boolean>(false);
  readonly selectedMember = signal<AdminMember | null>(null);
  readonly currentUrl = signal<string>(this.router.url);

  // Formulario de edición
  readonly editFullName = signal<string>('');
  readonly editEmail = signal<string>('');
  readonly editDni = signal<string>('');
  readonly editPhone = signal<string>('');
  readonly editPosition = signal<number | null>(null);
  readonly editMembershipTier = signal<'emergente' | 'activo' | 'fundador' | 'waitlist'>('emergente');
  readonly editType = signal<'socio' | 'waitlist'>('socio');
  readonly editConverted = signal<boolean>(false);
  readonly editExperiencesOther = signal<string>('');
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

    // Re-resolver automáticamente cuando termine de cargar la lista de miembros
    effect(() => {
      const members = this.store.members();
      if (members.length > 0) {
        this.resolveRouteState();
      }
    });
  }

  ngOnInit(): void {
    this.currentUrl.set(this.router.url);
    this.resolveRouteState();
  }

  private readonly isAdminRoute = computed(() => {
    const rawPath = this.currentUrl().split('?')[0].split('#')[0];
    const segments = rawPath.split('/').filter(Boolean);
    return segments[0] === 'admin';
  });

  readonly backToListLink = computed(() => {
    return this.isAdminRoute() ? '/admin/socios' : '/socios';
  });

  getDetailRoute(m: AdminMember): string {
    const base = this.isAdminRoute() ? '/admin/socios' : '/socios';
    const idOrPos = m.position !== undefined ? String(m.position) : m.id;
    return `${base}/${encodeURIComponent(idOrPos)}`;
  }

  getEditRoute(m: AdminMember): string {
    const base = this.isAdminRoute() ? '/admin/socios' : '/socios';
    const idOrPos = m.position !== undefined ? String(m.position) : m.id;
    return `${base}/${encodeURIComponent(idOrPos)}/editar`;
  }

  readonly memberPayments = computed(() => {
    const m = this.selectedMember();
    if (!m || !m.email) return [];
    const emailClean = m.email.toLowerCase().trim();
    return this.store
      .submissions()
      .filter((s) => s.email && s.email.toLowerCase().trim() === emailClean);
  });

  private resolveRouteState(): void {
    const rawPath = this.currentUrl().split('?')[0].split('#')[0];
    const segments = rawPath.split('/').filter(Boolean);
    const socioIdx = segments.indexOf('socios');

    if (socioIdx === -1 || socioIdx === segments.length - 1) {
      // Ruta lista: /socios o /admin/socios
      this.isRouteEditMode.set(false);
      this.isRouteDetailMode.set(false);
      this.notFound.set(false);
      this.selectedMember.set(null);
      return;
    }

    const identifier = decodeURIComponent(segments[socioIdx + 1]);
    const isEdit = segments.includes('editar');

    const member = this.store.getMemberById(identifier);
    if (!member) {
      // Si todavía se está cargando de Supabase, no marcar error todavía
      if (this.store.isLoadingMembers()) {
        return;
      }
      this.notFound.set(true);
      this.isRouteEditMode.set(false);
      this.isRouteDetailMode.set(false);
      this.selectedMember.set(null);
      return;
    }

    this.notFound.set(false);
    this.selectedMember.set(member);

    if (isEdit) {
      this.isRouteEditMode.set(true);
      this.isRouteDetailMode.set(false);
      this.populateEditForm(member);
    } else {
      this.isRouteEditMode.set(false);
      this.isRouteDetailMode.set(true);
    }
  }

  private populateEditForm(m: AdminMember): void {
    this.editFullName.set(m.fullName && m.fullName !== 'Lista de Espera (Email)' ? m.fullName : '');
    this.editEmail.set(m.email || '');
    this.editDni.set(m.dni && m.dni !== '—' ? m.dni : '');
    this.editPhone.set(m.phone && m.phone !== '—' ? m.phone : '');
    this.editPosition.set(m.position !== undefined ? m.position : null);
    this.editMembershipTier.set(m.membershipTier || 'emergente');
    this.editType.set(m.type || 'socio');
    this.editConverted.set(Boolean(m.converted));
    this.editExperiencesOther.set(m.experiencesOther || '');
  }

  async saveMemberChanges(): Promise<void> {
    const current = this.selectedMember();
    if (!current) return;

    this.saving.set(true);
    try {
      const posVal = this.editPosition();
      const res = await this.store.updateMemberProfile(current.id, {
        fullName: this.editFullName().trim(),
        email: this.editEmail().trim().toLowerCase(),
        dni: this.editDni().trim(),
        phone: this.editPhone().trim(),
        position: posVal && Number(posVal) > 0 ? Number(posVal) : undefined,
        membershipTier: this.editMembershipTier(),
        type: this.editType(),
        converted: this.editConverted(),
        experiencesOther: this.editExperiencesOther().trim() || undefined,
      });

      if (res.success) {
        this.feedbackToast.set('Perfil del socio actualizado correctamente.');
        setTimeout(() => this.feedbackToast.set(null), 4000);
        const updated = this.store.getMemberById(current.id);
        if (updated) {
          this.selectedMember.set(updated);
        }
        void this.router.navigate([this.getDetailRoute(updated || current)]);
      } else {
        alert('Error al guardar los cambios: ' + (res.error || 'Ocurrió un error inesperado'));
      }
    } finally {
      this.saving.set(false);
    }
  }

  readonly filteredMembers = computed(() => {
    let list = this.store.members();
    const query = this.searchQuery().trim().toLowerCase();
    const tab = this.activeTab();

    // Filtro por pestaña
    if (tab === 'socios') {
      list = list.filter((m) => m.type === 'socio');
    } else if (tab === 'waitlist') {
      list = list.filter((m) => m.type === 'waitlist' && !m.googleLinked);
    } else if (tab === 'google') {
      list = list.filter((m) => Boolean(m.googleLinked));
    } else if (tab === 'convertidos') {
      list = list.filter((m) => m.converted);
    }

    // Filtro por búsqueda
    if (query) {
      list = list.filter((m) => {
        const nameMatch =
          m.fullName && m.fullName !== 'Lista de Espera (Email)'
            ? m.fullName.toLowerCase().includes(query)
            : false;
        const emailMatch = m.email.toLowerCase().includes(query);
        const dniMatch = m.dni?.includes(query) ?? false;
        const phoneMatch = m.phone?.includes(query) ?? false;
        const posMatch = m.position ? String(m.position).includes(query) : false;
        return nameMatch || emailMatch || dniMatch || phoneMatch || posMatch;
      });
    }

    return list;
  });

  refresh(): void {
    void this.store.loadAllMembers();
  }

  downloadRoster(): void {
    const list = this.store.members();
    const headers = [
      'Nro Socio',
      'Tipo',
      'Nombre y Apellido',
      'DNI',
      'Email',
      'Teléfono',
      'Nivel',
      'Google Vinculado',
      'Convertido',
      'Fecha Alta',
    ];
    const escapeCsv = (val: any) => {
      let str = val != null ? String(val) : '';
      if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };
    const rows = [
      headers.map(escapeCsv).join(','),
      ...list.map((m) =>
        [
          escapeCsv(m.position ? `#${m.position}` : 'Waitlist'),
          escapeCsv(m.type === 'socio' ? 'Oficial' : 'Lista Espera'),
          escapeCsv(
            m.fullName && m.fullName !== 'Lista de Espera (Email)' ? m.fullName : '',
          ),
          escapeCsv(m.dni || ''),
          escapeCsv(m.email || ''),
          escapeCsv(m.phone || ''),
          escapeCsv(m.membershipTier.toUpperCase()),
          escapeCsv(m.googleLinked ? 'SÍ' : 'NO'),
          escapeCsv(m.converted ? 'SÍ' : 'NO'),
          escapeCsv(new Date(m.createdAt).toLocaleDateString('es-AR')),
        ].join(','),
      ),
    ];
    const blob = new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nomina_socios_experiencias_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  getWhatsappLink(phone?: string, name?: string): string {
    const cleanDigits = (phone || '').replace(/\D/g, '');
    const cleanName = encodeURIComponent(name || 'Socio');
    return `https://wa.me/${cleanDigits}?text=Hola%20${cleanName},%20nos%20comunicamos%20desde%20la%20administraci%C3%B3n%20de%20EXPERIENCIAS.CLUB`;
  }

  formatTier(tier: string): string {
    switch (tier) {
      case 'fundador':
        return 'Socio Fundador';
      case 'activo':
        return 'Socio Activo';
      case 'emergente':
        return 'Socio Emergente';
      default:
        return 'Lista de Espera';
    }
  }

  isProvider(member: AdminMember): boolean {
    if (member.isProvider) return true;
    return this.store.isProviderEmail(member.email);
  }
}
