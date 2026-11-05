import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AdminStoreService, AdminApplication, ApplicationStatus } from '../../../core/services/admin-store.service';
import { ProviderUser } from '../../../core/services/provider-store.service';
import { FechaPipe } from '../../../shared/pipes/format.pipes';

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
  status: 'aprobado' | 'pendiente' | 'rechazado';
  createdAt: string;
  experiencesCount?: number;
  rawApp?: AdminApplication;
  rawProvider?: ProviderUser;
}

@Component({
  selector: 'app-admin-providers',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatIconModule, FechaPipe],
  template: `
    <div class="providers-view-container">
      <!-- Encabezado de la Sección -->
      <div class="view-header">
        <div>
          <span class="section-kicker">COMUNIDAD DE PRESTADORES Y GUÍAS LOCALES</span>
          <div class="title-row">
            <h1 class="card-heading">Prestadores y Nuevas Postulaciones</h1>
            <a routerLink="/dashboard" class="btn-back-panel">Volver al Panel</a>
          </div>
          <p class="card-subheading">
            Padrón consolidado de prestadores oficiales habilitados en la plataforma y postulaciones de nuevos guías pendientes de evaluación.
          </p>
        </div>
      </div>

      <!-- Tarjetas de Métricas Rápidas -->
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
          <strong class="sum-value">{{ totalExperiencesCount() }}</strong>
          <span class="sum-sub">En catálogo activo</span>
        </div>
        <div class="summary-item">
          <span class="sum-label">Padrón Total</span>
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
                  <th>Padrón</th>
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
                          {{ item.name.charAt(0).toUpperCase() }}
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

                    <!-- Contacto -->
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
                            <mat-icon class="inline-wa">chat</mat-icon>
                            <span>{{ item.phone }}</span>
                          </a>
                        } @else {
                          <span class="phone-muted">Sin teléfono</span>
                        }
                      </div>
                    </td>

                    <!-- Padrón / Rol -->
                    <td>
                      @if (item.origin === 'official') {
                        <span class="pill-badge pill-official">OFICIAL</span>
                      } @else {
                        <span class="pill-badge pill-applicant">POSTULACIÓN</span>
                      }
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
                        @if (item.origin === 'official' && item.slug) {
                          <a
                            [href]="'/prestadores/' + item.slug"
                            target="_blank"
                            class="btn-table-action btn-view-profile"
                            title="Abrir perfil público del prestador"
                          >
                            <mat-icon class="btn-icon">open_in_new</mat-icon>
                            <span>Ver perfil</span>
                          </a>
                        }

                        @if (item.origin === 'application' && item.rawApp) {
                          <button
                            type="button"
                            class="btn-table-action btn-review-app"
                            (click)="openApplication(item.rawApp)"
                          >
                            Revisar
                          </button>
                        }

                        @if (item.phone) {
                          <a
                            [href]="getWhatsappLink(item.phone, item.name)"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="btn-table-action btn-wa-contact"
                            title="Contactar por WhatsApp"
                          >
                            WhatsApp
                          </a>
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

                @if (app.phone) {
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

      .title-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1.5rem;
        flex-wrap: wrap;
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

      .btn-back-panel {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.45rem 0.95rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 2px;
        color: #ffffff;
        font-size: 0.78rem;
        font-weight: 700;
        text-decoration: none;
        transition: all 0.2s ease;
      }
      .btn-back-panel:hover {
        background: rgba(255, 255, 255, 0.15);
        border-color: #ff5f00;
        color: #ff5f00;
      }

      /* Summary Strip */
      .summary-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
      }

      .summary-item {
        background: #15110d;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        padding: 1.15rem 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .sum-label {
        font-size: 0.7rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(255, 255, 255, 0.55);
      }

      .sum-value {
        font-size: 1.65rem;
        font-weight: 800;
        color: #ffffff;
        font-family: var(--font-mono, monospace);
        letter-spacing: -0.02em;
        line-height: 1.2;
      }

      .sum-sub {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.4);
      }

      .text-orange {
        color: #ff5f00 !important;
      }

      /* Filters & Search */
      .filters-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        background: #15110d;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        padding: 0.75rem 1rem;
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
        color: rgba(255, 255, 255, 0.6);
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
        background: #15110d;
        border: 1px dashed rgba(255, 255, 255, 0.15);
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
        color: rgba(255, 255, 255, 0.3);
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
        background: #15110d;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        overflow: hidden;
      }

      .table-responsive {
        width: 100%;
        overflow-x: auto;
      }

      .providers-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.82rem;
      }

      .providers-table th {
        background: rgba(0, 0, 0, 0.4);
        padding: 0.85rem 1rem;
        text-align: left;
        font-size: 0.68rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(255, 255, 255, 0.55);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        white-space: nowrap;
      }

      .providers-table td {
        padding: 0.85rem 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.85);
        vertical-align: middle;
      }

      .providers-table tr:hover td {
        background: rgba(255, 255, 255, 0.02);
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
        background: rgba(128, 179, 255, 0.15);
        border: 1px solid #80b3ff;
        color: #80b3ff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 0.85rem;
        flex-shrink: 0;
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
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        color: #80b3ff;
        text-decoration: none;
        font-family: var(--font-mono, monospace);
        font-size: 0.78rem;
        font-weight: 600;
        transition: color 0.2s ease;
      }
      .contact-whatsapp:hover {
        color: #b3d1ff;
      }

      .inline-wa {
        font-size: 15px;
        width: 15px;
        height: 15px;
      }

      .phone-muted {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.35);
      }

      .pill-badge {
        display: inline-block;
        padding: 0.15rem 0.5rem;
        font-size: 0.65rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        border-radius: 2px;
      }

      .pill-official {
        background: rgba(128, 179, 255, 0.18);
        border: 1px solid #80b3ff;
        color: #80b3ff;
      }

      .pill-applicant {
        background: rgba(245, 158, 11, 0.18);
        border: 1px solid #f59e0b;
        color: #fbbf24;
      }

      .status-pill {
        display: inline-block;
        padding: 0.15rem 0.5rem;
        font-size: 0.68rem;
        font-weight: 700;
        border-radius: 2px;
      }
      .status-pill[data-status='aprobado'] {
        background: rgba(16, 185, 129, 0.18);
        border: 1px solid #34d399;
        color: #34d399;
      }
      .status-pill[data-status='rechazado'] {
        background: rgba(239, 68, 68, 0.18);
        border: 1px solid #ef4444;
        color: #fca5a5;
      }
      .status-pill[data-status='pendiente'] {
        background: rgba(245, 158, 11, 0.18);
        border: 1px solid #f59e0b;
        color: #fbbf24;
      }

      .date-cell {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.55);
      }

      .actions-row {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.45rem;
      }

      .btn-table-action {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.35rem 0.75rem;
        border-radius: 2px;
        font-size: 0.74rem;
        font-weight: 700;
        text-decoration: none;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid transparent;
      }

      .btn-view-profile {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.2);
        color: #ffffff;
      }
      .btn-view-profile:hover {
        background: rgba(255, 255, 255, 0.15);
        border-color: #80b3ff;
        color: #80b3ff;
      }
      .btn-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }

      .btn-review-app {
        background: #ff5f00;
        color: #ffffff;
        border-color: #ff5f00;
      }
      .btn-review-app:hover {
        background: #ff7728;
      }

      .btn-wa-contact {
        background: #80b3ff;
        border-color: #80b3ff;
        color: #ffffff;
      }
      .btn-wa-contact:hover {
        background: #a3c9ff;
      }

      /* Modal */
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 1.25rem;
      }

      .modal-dialog {
        background: #15110d;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 4px;
        max-width: 650px;
        width: 100%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
      }

      .modal-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 1.25rem 1.5rem;
        background: rgba(0, 0, 0, 0.35);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .modal-kicker {
        font-size: 0.68rem;
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
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.55);
        margin: 0;
      }

      .modal-close-btn {
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        font-size: 1.5rem;
        line-height: 1;
        cursor: pointer;
        padding: 0 0.4rem;
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
        letter-spacing: 0.08em;
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
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        gap: 1rem;
        flex-wrap: wrap;
      }

      .action-buttons-group {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        flex-wrap: wrap;
      }

      .btn-action-primary {
        background: #10b981;
        border: 1px solid #10b981;
        color: #ffffff;
        padding: 0.55rem 1.15rem;
        font-size: 0.82rem;
        font-weight: 800;
        border-radius: 2px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .btn-action-primary:hover {
        background: #059669;
      }

      .btn-action-reject {
        background: #ef4444;
        border: 1px solid #ef4444;
        color: #ffffff !important;
        padding: 0.55rem 1.15rem;
        font-size: 0.82rem;
        font-weight: 800;
        border-radius: 2px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .btn-action-reject:hover {
        background: #dc2626;
      }

      .btn-action-wa {
        background: #80b3ff;
        border: 1px solid #80b3ff;
        color: #ffffff;
        padding: 0.55rem 1.15rem;
        font-size: 0.82rem;
        font-weight: 800;
        border-radius: 2px;
        text-decoration: none;
        display: inline-block;
        transition: all 0.2s ease;
      }
      .btn-action-wa:hover {
        background: #a3c9ff;
      }

      .btn-action-close {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #ffffff;
        padding: 0.55rem 1.15rem;
        font-size: 0.82rem;
        font-weight: 700;
        border-radius: 2px;
        cursor: pointer;
      }
      .btn-action-close:hover {
        border-color: #ffffff;
      }

      .approved-tag {
        font-size: 0.78rem;
        font-weight: 800;
        color: #34d399;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .rejected-tag {
        font-size: 0.78rem;
        font-weight: 800;
        color: #fca5a5;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      @media (max-width: 768px) {
        .app-details-grid {
          grid-template-columns: 1fr;
        }
        .banking-grid {
          grid-template-columns: 1fr;
        }
        .modal-foot {
          flex-direction: column;
          align-items: stretch;
        }
        .action-buttons-group {
          flex-direction: column;
          align-items: stretch;
        }
        .btn-action-primary,
        .btn-action-reject,
        .btn-action-wa,
        .btn-action-close {
          width: 100%;
          text-align: center;
        }
      }
    `,
  ],
})
export class AdminProvidersComponent {
  readonly store = inject(AdminStoreService);

  readonly searchQuery = signal<string>('');
  readonly activeTab = signal<ProviderTab>('todos');
  readonly selectedApplication = signal<AdminApplication | null>(null);
  readonly isUpdating = signal<boolean>(false);

  // Prestadores combinados: Oficiales de providerStore + Postulantes de applications
  readonly allProviders = computed<ProviderListItem[]>(() => {
    const list: ProviderListItem[] = [];
    const officialProviders = this.store.providerStore.providers();
    const providerEmails = new Set<string>();

    for (const p of officialProviders) {
      const cleanEmail = p.email?.toLowerCase().trim() || '';
      if (cleanEmail) providerEmails.add(cleanEmail);
      list.push({
        id: p.id || `prov-${cleanEmail}`,
        origin: 'official',
        name: p.name || 'Prestador Oficial',
        agency: p.agency || 'Prestador Independiente',
        email: p.email,
        phone: p.phone || '—',
        categoryOrBio: p.bio,
        slug: p.slug,
        status: 'aprobado',
        createdAt: p.joinedAt || '2024-01-01T00:00:00Z',
        rawProvider: p,
      });
    }

    const applications = this.store.applications().filter((a) => a.type === 'prestador');
    for (const app of applications) {
      const cleanEmail = app.email?.toLowerCase().trim() || '';
      if (cleanEmail && providerEmails.has(cleanEmail)) {
        continue; // Ya está listado como prestador oficial
      }
      list.push({
        id: app.id,
        origin: 'application',
        name: app.fullName || 'Postulante',
        agency: app.category ? this.formatCategory(app.category) : 'Postulación de Prestador',
        email: app.email,
        phone: app.phone || '—',
        categoryOrBio: app.description || app.motivationLetter,
        status: app.status === 'aprobado' ? 'aprobado' : app.status === 'rechazado' ? 'rechazado' : 'pendiente',
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

