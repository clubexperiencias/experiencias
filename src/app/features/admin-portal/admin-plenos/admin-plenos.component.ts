import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AdminStoreService, AdminMember, AdminApplication } from '../../../core/services/admin-store.service';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { ProviderUser, TransferSubmission } from '../../../core/models/bank-transfer.model';
import { ArsPipe, FechaPipe } from '../../../shared/pipes/format.pipes';

export type PlenoFilterSegment = 'todos' | 'socios' | 'prestadores';
export type PlenoFilterStatus = 'todas' | 'activas' | 'pendientes' | 'bajas';

export interface PlenoRow {
  id: string;
  sourceType: 'socio' | 'prestador' | 'postulacion';
  name: string;
  email: string;
  phone: string;
  agency?: string;
  dni?: string;
  avatar?: string;
  tier: 'socio_pleno' | 'prestador_pleno';
  tierLabel: string;
  monthlyFee: number;
  status: 'activa' | 'pendiente' | 'baja';
  statusLabel: string;
  date: string;
  cbuAlias?: string;
  bankName?: string;
  cuitDni?: string;
  notes?: string;
  paymentReference?: string;
  submissionsCount: number;
  totalPaid: number;
}

@Component({
  selector: 'app-admin-plenos',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, ArsPipe, FechaPipe],
  template: `
    <div class="plenos-page-container">
      <!-- Toast de feedback -->
      @if (feedbackToast()) {
        <div class="toast-banner">
          <mat-icon class="toast-icon">check_circle</mat-icon>
          <span>{{ feedbackToast() }}</span>
        </div>
      }

      <!-- Header Principal -->
      <header class="plenos-header">
        <div>
          <span class="header-kicker">MEMBRESÍAS NIVEL 2</span>
          <h1 class="header-title">Membresías Plenas: Socios & Prestadores</h1>
          <p class="header-sub">
            Revisión integral de suscripciones plenas activas, cuotas mensuales ($23.000 socios / $90.000 prestadores),
            postulaciones y registro histórico de bajas.
          </p>
        </div>
      </header>

      <!-- Métricas Resumen (2 por fila en mobile) -->
      <section class="summary-strip">
        <div class="summary-card">
          <span class="sum-label">Membresías Activas</span>
          <strong class="sum-value">{{ stats().activeCount }}</strong>
          <span class="sum-sub">{{ stats().activeSocios }} Socios • {{ stats().activePrestadores }} Prestadores</span>
        </div>

        <div class="summary-card">
          <span class="sum-label">Postulaciones / En Espera</span>
          <strong class="sum-value">{{ stats().pendingCount }}</strong>
          <span class="sum-sub">Pendientes de activación o código</span>
        </div>

        <div class="summary-card">
          <span class="sum-label">Membresías Pasadas / Bajas</span>
          <strong class="sum-value">{{ stats().bajasCount }}</strong>
          <span class="sum-sub">Historial de cancelaciones</span>
        </div>

        <div class="summary-card highlight-revenue">
          <span class="sum-label">Recaudación Mensual Estimada</span>
          <strong class="sum-value text-gold">{{ stats().monthlyRevenue | ars }}</strong>
          <span class="sum-sub">Ingresos recurrentes activos al mes</span>
        </div>
      </section>

      <!-- Filtros y Búsqueda -->
      <section class="toolbar-section">
        <div class="search-box">
          <mat-icon class="search-icon">search</mat-icon>
          <input
            type="text"
            class="search-input"
            placeholder="Buscar por nombre, email, agencia, teléfono o DNI..."
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
          />
          @if (searchQuery()) {
            <button type="button" class="clear-search-btn" (click)="searchQuery.set('')" aria-label="Limpiar búsqueda">
              ✕
            </button>
          }
        </div>

        <div class="filters-row">
          <!-- Segment Tabs -->
          <div class="filter-group">
            <span class="filter-label">Segmento:</span>
            <div class="pill-tabs">
              <button
                type="button"
                class="pill-tab"
                [class.is-active]="segmentFilter() === 'todos'"
                (click)="segmentFilter.set('todos')"
              >
                Todos ({{ rows().length }})
              </button>
              <button
                type="button"
                class="pill-tab"
                [class.is-active]="segmentFilter() === 'socios'"
                (click)="segmentFilter.set('socios')"
              >
                Socios Plenos ($23.000)
              </button>
              <button
                type="button"
                class="pill-tab"
                [class.is-active]="segmentFilter() === 'prestadores'"
                (click)="segmentFilter.set('prestadores')"
              >
                Prestadores Plenos ($90.000)
              </button>
            </div>
          </div>

          <!-- Status Tabs -->
          <div class="filter-group">
            <span class="filter-label">Estado:</span>
            <div class="pill-tabs">
              <button
                type="button"
                class="pill-tab"
                [class.is-active]="statusFilter() === 'todas'"
                (click)="statusFilter.set('todas')"
              >
                Todas
              </button>
              <button
                type="button"
                class="pill-tab"
                [class.is-active]="statusFilter() === 'activas'"
                (click)="statusFilter.set('activas')"
              >
                Activas ({{ stats().activeCount }})
              </button>
              <button
                type="button"
                class="pill-tab"
                [class.is-active]="statusFilter() === 'pendientes'"
                (click)="statusFilter.set('pendientes')"
              >
                Pendientes ({{ stats().pendingCount }})
              </button>
              <button
                type="button"
                class="pill-tab"
                [class.is-active]="statusFilter() === 'bajas'"
                (click)="statusFilter.set('bajas')"
              >
                Bajas ({{ stats().bajasCount }})
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Tabla de Membresías Plenas -->
      <section class="table-section">
        <div class="table-card">
          <div class="card-head">
            <div class="card-head-title-wrap">
              <span class="block-kicker">NÓMINA DE MEMBRESÍAS PLENAS</span>
              <h2 class="card-title">Registros Consolidados ({{ filteredRows().length }})</h2>
            </div>
            <span class="badge-total">{{ filteredRows().length }} encontrados</span>
          </div>

          @if (filteredRows().length === 0) {
            <div class="empty-state">
              <mat-icon class="empty-icon">search_off</mat-icon>
              <h3 class="empty-title">No se encontraron membresías plenas</h3>
              <p class="empty-sub">Probá modificando los filtros o el texto de búsqueda.</p>
            </div>
          } @else {
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Miembro / Prestador</th>
                    <th>Categoría</th>
                    <th>Cuota Mensual</th>
                    <th>Estado</th>
                    <th>Fecha Alta</th>
                    <th>Contacto</th>
                    <th class="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of filteredRows(); track row.id) {
                    <tr [class.row-baja]="row.status === 'baja'">
                      <!-- Miembro / Prestador -->
                      <td>
                        <div class="member-info-cell">
                          <div class="avatar-circle">
                            @if (row.avatar) {
                              <img [src]="row.avatar" [alt]="row.name" class="avatar-img" />
                            } @else {
                              <span>{{ getInitials(row.name) }}</span>
                            }
                          </div>
                          <div class="member-names">
                            <strong class="name-text">{{ row.name }}</strong>
                            <span class="email-text">{{ row.email }}</span>
                            @if (row.agency) {
                              <span class="agency-tag">{{ row.agency }}</span>
                            }
                          </div>
                        </div>
                      </td>

                      <!-- Categoría -->
                      <td>
                        @if (row.tier === 'socio_pleno') {
                          <span class="tier-badge badge-socio">SOCIO PLENO</span>
                        } @else {
                          <span class="tier-badge badge-prestador">PRESTADOR PLENO</span>
                        }
                      </td>

                      <!-- Cuota Mensual -->
                      <td>
                        <div class="fee-cell">
                          <strong class="fee-amount">{{ row.monthlyFee | ars }}</strong>
                          <span class="fee-sub">/ mes</span>
                        </div>
                      </td>

                      <!-- Estado -->
                      <td>
                        <span class="status-badge" [attr.data-status]="row.status">
                          @switch (row.status) {
                            @case ('activa') { ACTIVA }
                            @case ('pendiente') { PENDIENTE }
                            @case ('baja') { DADA DE BAJA }
                          }
                        </span>
                      </td>

                      <!-- Fecha Alta -->
                      <td>
                        <span class="date-text">{{ row.date | fecha: 'corta' }}</span>
                      </td>

                      <!-- Contacto -->
                      <td>
                        <div class="contact-actions">
                          @if (row.phone && row.phone !== '—') {
                            <a
                              [href]="getWhatsappUrl(row.phone, row.name)"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="btn-icon-wa"
                              title="Contactar por WhatsApp"
                            >
                              <span class="wa-text">{{ row.phone }}</span>
                            </a>
                          } @else {
                            <span class="contact-none">—</span>
                          }
                        </div>
                      </td>

                      <!-- Acciones -->
                      <td class="text-right">
                        <div class="row-actions">
                          <button
                            type="button"
                            class="btn-action-view"
                            (click)="openDetail(row, $event)"
                            title="Ver Ficha y Comprobantes"
                          >
                            <mat-icon class="icon-sm">visibility</mat-icon>
                            <span>Ficha</span>
                          </button>

                          @if (row.status === 'activa') {
                            <button
                              type="button"
                              class="btn-action-status btn-status-baja"
                              (click)="toggleStatus(row, 'baja')"
                              title="Dar de baja membresía"
                            >
                              Dar de baja
                            </button>
                          } @else {
                            <button
                              type="button"
                              class="btn-action-status btn-status-activa"
                              (click)="toggleStatus(row, 'activa')"
                              title="Activar o Reactivar membresía"
                            >
                              Activar
                            </button>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </section>

      <!-- Modal Detalle de Membresía Plena -->
      @if (selectedRow(); as row) {
        <div class="modal-backdrop" (click)="closeDetail()">
          <div
            class="modal-dialog"
            (click)="$event.stopPropagation()"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pleno-detail-title"
            tabindex="-1"
          >
            <header class="modal-header">
              <div>
                <span class="modal-kicker">DETALLE DE MEMBRESÍA PLENA (NIVEL 2)</span>
                <h3 class="modal-title" id="pleno-detail-title">{{ row.name }}</h3>
                <span class="modal-sub">{{ row.email }}</span>
              </div>
              <button type="button" class="modal-close-btn" (click)="closeDetail()" aria-label="Cerrar modal">
                ✕
              </button>
            </header>

            <div class="modal-body">
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="d-label">Tipo de Membresía</span>
                  <strong class="d-val">{{ row.tierLabel }}</strong>
                </div>

                <div class="detail-item">
                  <span class="d-label">Cuota Mensual</span>
                  <strong class="d-val text-gold">{{ row.monthlyFee | ars }} / mes</strong>
                </div>

                <div class="detail-item">
                  <span class="d-label">Estado Actual</span>
                  <span class="status-badge" [attr.data-status]="row.status">
                    {{ row.status.toUpperCase() }}
                  </span>
                </div>

                <div class="detail-item">
                  <span class="d-label">Fecha de Registro</span>
                  <strong class="d-val">{{ row.date | fecha: 'larga' }}</strong>
                </div>

                @if (row.agency) {
                  <div class="detail-item">
                    <span class="d-label">Nombre de Agencia / Fantasía</span>
                    <strong class="d-val">{{ row.agency }}</strong>
                  </div>
                }

                @if (row.dni || row.cuitDni) {
                  <div class="detail-item">
                    <span class="d-label">DNI / CUIT</span>
                    <strong class="d-val font-mono">{{ row.dni || row.cuitDni }}</strong>
                  </div>
                }

                @if (row.phone) {
                  <div class="detail-item">
                    <span class="d-label">Teléfono / WhatsApp</span>
                    <a
                      [href]="getWhatsappUrl(row.phone, row.name)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="contact-link"
                    >
                      {{ row.phone }} &nearr;
                    </a>
                  </div>
                }

                @if (row.cbuAlias) {
                  <div class="detail-item">
                    <span class="d-label">Alias / CBU</span>
                    <strong class="d-val font-mono">{{ row.cbuAlias }}</strong>
                  </div>
                }
              </div>

              <!-- Historial de comprobantes / recaudación -->
              <div class="modal-receipts-block">
                <h4 class="receipts-title">
                  <mat-icon class="icon-inline">receipt_long</mat-icon>
                  Historial de Pagos y Comprobantes
                </h4>
                @if (getReceiptsForSelected(row).length === 0) {
                  <p class="receipts-empty">
                    No hay transferencias ni comprobantes registrados específicamente para esta membresía.
                  </p>
                } @else {
                  <div class="receipts-list">
                    @for (r of getReceiptsForSelected(row); track r.id) {
                      <div class="receipt-row">
                        <div class="r-info">
                          <strong class="r-amount">{{ r.amountArs | ars }}</strong>
                          <span class="r-date">{{ r.submittedAt | fecha: 'corta' }}</span>
                        </div>
                        <span class="r-status" [attr.data-status]="r.status">{{ r.status }}</span>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>

            <footer class="modal-footer">
              <button type="button" class="btn-modal-cancel" (click)="closeDetail()">Cerrar</button>
              @if (row.status === 'activa') {
                <button
                  type="button"
                  class="btn-modal-danger"
                  (click)="toggleStatus(row, 'baja'); closeDetail()"
                >
                  Dar de baja membresía
                </button>
              } @else {
                <button
                  type="button"
                  class="btn-modal-primary"
                  (click)="toggleStatus(row, 'activa'); closeDetail()"
                >
                  Activar Membresía Plena
                </button>
              }
            </footer>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .plenos-page-container {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        padding-bottom: 3rem;
      }

      .toast-banner {
        position: fixed;
        bottom: 1.5rem;
        right: 1.5rem;
        background: #10b981;
        color: #ffffff;
        padding: 0.85rem 1.25rem;
        border-radius: 6px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        gap: 0.6rem;
        z-index: 10000;
        font-weight: 600;
        animation: fadeIn 0.3s ease;
      }

      .toast-icon {
        font-size: 1.25rem;
        width: 1.25rem;
        height: 1.25rem;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* Header */
      .plenos-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .header-kicker {
        font-size: 0.72rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #ff5f00;
        margin-bottom: 0.25rem;
        display: block;
      }

      .header-title {
        font-size: 1.75rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0 0 0.4rem 0;
        line-height: 1.2;
      }

      .header-sub {
        font-size: 0.88rem;
        color: rgba(255, 255, 255, 0.75);
        max-width: 800px;
        line-height: 1.45;
        margin: 0;
      }

      /* Resumen Métrico (Strip) */
      .summary-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
      }

      .summary-card {
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid rgba(128, 179, 255, 0.2);
        border-radius: 6px;
        padding: 1.1rem 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        backdrop-filter: blur(8px);
      }

      .highlight-revenue {
        border-color: rgba(255, 204, 0, 0.4);
      }

      .sum-label {
        font-size: 0.74rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #ffffff;
        opacity: 0.88;
      }

      .sum-value {
        font-size: 1.6rem;
        font-weight: 800;
        color: #ffffff !important;
        line-height: 1.2;
      }

      .text-gold {
        color: #ffcc00 !important;
      }

      .sum-sub {
        font-size: 0.75rem;
        color: #ffffff;
        opacity: 0.8;
        margin-top: auto;
        padding-top: 0.4rem;
      }

      /* Toolbar */
      .toolbar-section {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        background: rgba(22, 12, 6, 0.85);
        border: 1px solid rgba(255, 95, 0, 0.2);
        border-radius: 8px;
        padding: 1rem 1.25rem;
      }

      .search-box {
        position: relative;
        display: flex;
        align-items: center;
      }

      .search-icon {
        position: absolute;
        left: 0.85rem;
        color: rgba(255, 255, 255, 0.5);
      }

      .search-input {
        width: 100%;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 6px;
        padding: 0.75rem 2.5rem 0.75rem 2.6rem;
        color: #ffffff;
        font-size: 0.9rem;
        outline: none;
        transition: border-color 0.2s ease;
      }

      .search-input:focus {
        border-color: #ff5f00;
      }

      .clear-search-btn {
        position: absolute;
        right: 0.75rem;
        background: transparent;
        border: none;
        color: #ffffff;
        cursor: pointer;
        font-size: 1rem;
      }

      .filters-row {
        display: flex;
        flex-wrap: wrap;
        gap: 1.5rem;
      }

      .filter-group {
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }

      .filter-label {
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.65);
      }

      .pill-tabs {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
      }

      .pill-tab {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: rgba(255, 255, 255, 0.8);
        border-radius: 20px;
        padding: 0.35rem 0.85rem;
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .pill-tab:hover {
        background: rgba(255, 255, 255, 0.12);
        color: #ffffff;
      }

      .pill-tab.is-active {
        background: #ff5f00;
        border-color: #ff5f00;
        color: #ffffff;
      }

      /* Card de Tabla */
      .table-card {
        background: rgba(22, 12, 6, 0.85);
        border: 1px solid rgba(255, 95, 0, 0.2);
        border-radius: 8px;
        overflow: hidden;
      }

      .card-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start !important;
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .card-head-title-wrap {
        display: flex;
        flex-direction: column;
        align-items: flex-start !important;
        text-align: left !important;
      }

      .block-kicker {
        font-size: 0.7rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #ff5f00;
        margin-bottom: 0.2rem;
      }

      .card-title {
        font-size: 1.15rem;
        font-weight: 700;
        color: #ffffff;
        margin: 0;
      }

      .badge-total {
        font-size: 0.75rem;
        font-weight: 700;
        padding: 0.25rem 0.65rem;
        border-radius: 4px;
        background: rgba(255, 95, 0, 0.15);
        color: #ff8c42;
        border: 1px solid rgba(255, 95, 0, 0.3);
      }

      .empty-state {
        text-align: center;
        padding: 3rem 1.5rem;
      }

      .empty-icon {
        font-size: 3rem;
        width: 3rem;
        height: 3rem;
        color: rgba(255, 255, 255, 0.3);
        margin-bottom: 0.75rem;
      }

      .empty-title {
        font-size: 1.1rem;
        color: #ffffff;
        margin: 0 0 0.35rem 0;
      }

      .empty-sub {
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.6);
        margin: 0;
      }

      .table-wrapper {
        overflow-x: auto;
      }

      .data-table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
      }

      .data-table th {
        font-size: 0.72rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: rgba(255, 255, 255, 0.7);
        padding: 0.85rem 1.25rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(0, 0, 0, 0.2);
      }

      .data-table td {
        padding: 0.95rem 1.25rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        vertical-align: middle;
      }

      .data-table tr:hover {
        background: rgba(255, 255, 255, 0.02);
      }

      .row-baja {
        opacity: 0.6;
      }

      /* Celdas */
      .member-info-cell {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .avatar-circle {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: #ff5f00;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 0.85rem;
        flex-shrink: 0;
        overflow: hidden;
      }

      .avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .member-names {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
      }

      .name-text {
        font-size: 0.9rem;
        color: #ffffff;
      }

      .email-text {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.6);
      }

      .agency-tag {
        font-size: 0.7rem;
        color: #ff8c42;
        font-weight: 600;
      }

      .tier-badge {
        display: inline-block;
        padding: 0.25rem 0.55rem;
        border-radius: 4px;
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.04em;
      }

      .badge-socio {
        background: rgba(56, 189, 248, 0.15);
        color: #38bdf8;
        border: 1px solid rgba(56, 189, 248, 0.3);
      }

      .badge-prestador {
        background: rgba(251, 146, 60, 0.15);
        color: #fb923c;
        border: 1px solid rgba(251, 146, 60, 0.3);
      }

      .fee-cell {
        display: flex;
        align-items: baseline;
        gap: 0.25rem;
      }

      .fee-amount {
        color: #ffffff;
        font-weight: 700;
        font-size: 0.95rem;
      }

      .fee-sub {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.5);
      }

      .status-badge {
        display: inline-block;
        padding: 0.25rem 0.6rem;
        border-radius: 4px;
        font-size: 0.68rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .status-badge[data-status='activa'] {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
        border: 1px solid rgba(16, 185, 129, 0.3);
      }

      .status-badge[data-status='pendiente'] {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
        border: 1px solid rgba(245, 158, 11, 0.3);
      }

      .status-badge[data-status='baja'] {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
        border: 1px solid rgba(239, 68, 68, 0.3);
      }

      .date-text {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.75);
      }

      .btn-icon-wa {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        background: rgba(37, 211, 102, 0.1);
        border: 1px solid rgba(37, 211, 102, 0.25);
        color: #25d366;
        padding: 0.25rem 0.55rem;
        border-radius: 4px;
        text-decoration: none;
        font-size: 0.75rem;
        font-weight: 600;
      }

      .btn-icon-wa:hover {
        background: rgba(37, 211, 102, 0.2);
      }

      .contact-none {
        color: rgba(255, 255, 255, 0.3);
      }

      .text-right {
        text-align: right;
      }

      .row-actions {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }

      .btn-action-view {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #ffffff;
        padding: 0.35rem 0.7rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
      }

      .btn-action-view:hover {
        background: rgba(255, 255, 255, 0.15);
      }

      .icon-sm {
        font-size: 1rem;
        width: 1rem;
        height: 1rem;
      }

      .btn-action-status {
        padding: 0.35rem 0.7rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        border: none;
        color: #ffffff;
      }

      .btn-status-baja {
        background: rgba(239, 68, 68, 0.15);
        color: #ffffff;
        border: 1px solid rgba(239, 68, 68, 0.3);
      }

      .btn-status-baja:hover {
        background: rgba(239, 68, 68, 0.3);
      }

      .btn-status-activa {
        background: rgba(16, 185, 129, 0.15);
        color: #ffffff;
        border: 1px solid rgba(16, 185, 129, 0.3);
      }

      .btn-status-activa:hover {
        background: rgba(16, 185, 129, 0.3);
      }

      /* Modal */
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(5px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 1rem;
      }

      .modal-dialog {
        background: #18130e;
        border: 1px solid rgba(255, 95, 0, 0.3);
        border-radius: 10px;
        width: 100%;
        max-width: 620px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
        overflow: hidden;
      }

      .modal-header {
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .modal-kicker {
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        color: #ff5f00;
        display: block;
        margin-bottom: 0.2rem;
      }

      .modal-title {
        font-size: 1.3rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0;
      }

      .modal-sub {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.6);
      }

      .modal-close-btn {
        background: transparent;
        border: none;
        color: #ffffff;
        font-size: 1.25rem;
        cursor: pointer;
      }

      .modal-body {
        padding: 1.5rem;
        max-height: 70vh;
        overflow-y: auto;
      }

      .detail-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
        margin-bottom: 1.5rem;
      }

      .detail-item {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .d-label {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.5);
      }

      .d-val {
        font-size: 0.92rem;
        color: #ffffff;
      }

      .contact-link {
        color: #38bdf8;
        text-decoration: none;
        font-size: 0.88rem;
      }

      .modal-receipts-block {
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        padding-top: 1.25rem;
      }

      .receipts-title {
        font-size: 0.88rem;
        font-weight: 700;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 0.4rem;
        margin: 0 0 0.75rem 0;
      }

      .icon-inline {
        font-size: 1.1rem;
        width: 1.1rem;
        height: 1.1rem;
      }

      .receipts-empty {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.5);
        margin: 0;
      }

      .receipt-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.6rem 0.75rem;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        margin-bottom: 0.4rem;
      }

      .r-info {
        display: flex;
        gap: 0.75rem;
        align-items: baseline;
      }

      .r-amount {
        color: #34d399;
        font-size: 0.9rem;
      }

      .r-date {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.6);
      }

      .r-status {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.7);
      }

      .modal-footer {
        padding: 1rem 1.5rem;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        background: rgba(0, 0, 0, 0.2);
      }

      .btn-modal-cancel {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #ffffff;
        padding: 0.55rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 600;
        font-size: 0.85rem;
      }

      .btn-modal-primary {
        background: #10b981;
        border: none;
        color: #ffffff;
        padding: 0.55rem 1.25rem;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 700;
        font-size: 0.85rem;
      }

      .btn-modal-danger {
        background: #ef4444;
        border: none;
        color: #ffffff;
        padding: 0.55rem 1.25rem;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 700;
        font-size: 0.85rem;
      }

      /* Responsive Rules */
      @media (max-width: 640px) {
        .summary-strip {
          grid-template-columns: repeat(2, 1fr) !important;
          gap: 0.65rem !important;
        }

        .summary-card {
          padding: 0.85rem !important;
        }

        .sum-value {
          font-size: 1.3rem !important;
        }

        .filters-row {
          flex-direction: column;
          gap: 0.85rem;
        }

        .detail-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 480px) {
        .summary-strip {
          grid-template-columns: repeat(2, 1fr) !important;
          gap: 0.5rem !important;
        }
      }
    `,
  ],
})
export class AdminPlenosComponent {
  private readonly store = inject(AdminStoreService);
  private readonly providerStore = inject(ProviderStoreService);

  readonly searchQuery = signal<string>('');
  readonly segmentFilter = signal<PlenoFilterSegment>('todos');
  readonly statusFilter = signal<PlenoFilterStatus>('todas');
  readonly selectedRow = signal<PlenoRow | null>(null);
  readonly feedbackToast = signal<string | null>(null);

  // Unifica Socios Plenos ($23.000) y Prestadores Plenos ($90.000)
  readonly rows = computed<PlenoRow[]>(() => {
    const list: PlenoRow[] = [];
    const members = this.store.members();
    const providers = this.providerStore.providers();
    const applications = this.store.applications();
    const submissions = this.store.submissions();

    // 1. Socios con perfil activo / dado_de_baja / waitlist
    for (const m of members) {
      if (m.membershipTier === 'waitlist' && m.converted) {
        list.push({
          id: `socio-${m.id}`,
          sourceType: 'socio',
          name: m.fullName || m.email.split('@')[0],
          email: m.email,
          phone: m.phone || '—',
          dni: m.dni,
          avatar: m.avatarUrl,
          tier: 'socio_pleno',
          tierLabel: 'Socio Pleno',
          monthlyFee: 23000,
          status: 'pendiente',
          statusLabel: 'Pendiente',
          date: m.createdAt,
          submissionsCount: 0,
          totalPaid: 0,
        });
      } else if (
        m.membershipTier === 'activo' ||
        m.membershipTier === 'dado_de_baja' ||
        (m.type === 'socio' && m.converted)
      ) {
        const memberRef = (
          (m as any).paymentReference ||
          (m as any).payment_reference ||
          (m as any).reference
        )?.trim();
        const memberSubmissions = memberRef
          ? submissions.filter(
              (s) =>
                s.email?.toLowerCase() === m.email.toLowerCase() &&
                (s.reference?.toLowerCase() === memberRef.toLowerCase() ||
                  s.displayReference?.toLowerCase() === memberRef.toLowerCase()),
            )
          : [];
        const totalPaid = memberSubmissions.reduce((acc, curr) => acc + (curr.amountArs || 0), 0);
        const status: 'activa' | 'pendiente' | 'baja' =
          m.membershipTier === 'dado_de_baja' ? 'baja' : 'activa';

        list.push({
          id: `socio-${m.id}`,
          sourceType: 'socio',
          name: m.fullName || m.email.split('@')[0],
          email: m.email,
          phone: m.phone || '—',
          dni: m.dni,
          avatar: m.avatarUrl,
          tier: 'socio_pleno',
          tierLabel: 'Socio Pleno',
          monthlyFee: 23000,
          status,
          statusLabel: status === 'activa' ? 'Activa' : 'Dada de baja',
          date: m.createdAt,
          paymentReference: memberRef,
          submissionsCount: memberSubmissions.length,
          totalPaid,
        });
      }
    }

    // 2. Prestadores Plenos oficiales
    for (const p of providers) {
      // Requisito independiente: únicamente prestadores con tier pleno
      if (p.tier === 'pleno') {
        const provRef = (
          (p as any).paymentReference ||
          (p as any).payment_reference ||
          (p as any).reference
        )?.trim();
        const provSubmissions = provRef
          ? submissions.filter(
              (s) =>
                s.email?.toLowerCase() === p.email.toLowerCase() &&
                (s.reference?.toLowerCase() === provRef.toLowerCase() ||
                  s.displayReference?.toLowerCase() === provRef.toLowerCase()),
            )
          : [];
        const totalPaid = provSubmissions.reduce((acc, curr) => acc + (curr.amountArs || 0), 0);
        // Evaluar estado de aprobación independientemente
        const status: 'activa' | 'pendiente' | 'baja' =
          p.status === 'dado_de_baja' || p.status === 'rechazado'
            ? 'baja'
            : p.status === 'pendiente'
              ? 'pendiente'
              : 'activa';

        list.push({
          id: `prestador-${p.id}`,
          sourceType: 'prestador',
          name: p.name,
          email: p.email,
          phone: p.phone || '—',
          agency: p.agency,
          cuitDni: p.cuitDni,
          cbuAlias: p.cbuAlias,
          bankName: p.bankName,
          avatar: p.avatar,
          tier: 'prestador_pleno',
          tierLabel: 'Prestador Pleno',
          monthlyFee: 90000,
          status,
          statusLabel: status === 'activa' ? 'Activa' : status === 'pendiente' ? 'Pendiente' : 'Dada de baja',
          date: p.joinedAt || new Date().toISOString(),
          paymentReference: provRef,
          submissionsCount: provSubmissions.length,
          totalPaid,
        });
      }
    }

    // 3. Postulaciones pendientes de prestadores específicamente al tier pleno
    for (const a of applications) {
      if (a.type === 'prestador' && a.status === 'pendiente' && a.tier === 'pleno') {
        // Evitar duplicar si ya figura como provider
        if (!list.some((item) => item.email.toLowerCase() === a.email.toLowerCase())) {
          const appRef = (
            (a as any).paymentReference ||
            (a as any).payment_reference ||
            (a as any).reference
          )?.trim();
          list.push({
            id: `postulacion-${a.id}`,
            sourceType: 'postulacion',
            name: a.fullName,
            email: a.email,
            phone: a.phone || '—',
            agency: a.agency,
            cuitDni: a.cuitDni,
            cbuAlias: a.cbuAlias,
            bankName: a.bankName,
            tier: 'prestador_pleno',
            tierLabel: 'Prestador Pleno',
            monthlyFee: 90000,
            status: 'pendiente',
            statusLabel: 'En Evaluación',
            date: a.createdAt,
            paymentReference: appRef,
            submissionsCount: 0,
            totalPaid: 0,
          });
        }
      }
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  // Estadísticas consolidadas
  readonly stats = computed(() => {
    const all = this.rows();
    const active = all.filter((r) => r.status === 'activa');
    const pending = all.filter((r) => r.status === 'pendiente');
    const bajas = all.filter((r) => r.status === 'baja');

    const activeSocios = active.filter((r) => r.tier === 'socio_pleno').length;
    const activePrestadores = active.filter((r) => r.tier === 'prestador_pleno').length;

    // $ Recaudación mensual recurrente: socios plenos ($23.000) + prestadores plenos ($90.000)
    const monthlyRevenue = activeSocios * 23000 + activePrestadores * 90000;

    return {
      activeCount: active.length,
      activeSocios,
      activePrestadores,
      pendingCount: pending.length,
      bajasCount: bajas.length,
      monthlyRevenue,
    };
  });

  // Filtro reactivo
  readonly filteredRows = computed(() => {
    let result = this.rows();
    const query = this.searchQuery().trim().toLowerCase();
    const seg = this.segmentFilter();
    const stat = this.statusFilter();

    if (seg === 'socios') {
      result = result.filter((r) => r.tier === 'socio_pleno');
    } else if (seg === 'prestadores') {
      result = result.filter((r) => r.tier === 'prestador_pleno');
    }

    if (stat === 'activas') {
      result = result.filter((r) => r.status === 'activa');
    } else if (stat === 'pendientes') {
      result = result.filter((r) => r.status === 'pendiente');
    } else if (stat === 'bajas') {
      result = result.filter((r) => r.status === 'baja');
    }

    if (query) {
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.email.toLowerCase().includes(query) ||
          (r.agency && r.agency.toLowerCase().includes(query)) ||
          (r.phone && r.phone.toLowerCase().includes(query)) ||
          (r.dni && r.dni.toLowerCase().includes(query)) ||
          (r.cuitDni && r.cuitDni.toLowerCase().includes(query)),
      );
    }

    return result;
  });

  private triggerElement: HTMLElement | null = null;

  openDetail(row: PlenoRow, event?: Event): void {
    this.triggerElement =
      (event?.currentTarget as HTMLElement) ||
      (typeof document !== 'undefined' ? (document.activeElement as HTMLElement) : null);
    this.selectedRow.set(row);

    setTimeout(() => {
      if (typeof document === 'undefined') return;
      const dialog = document.querySelector<HTMLElement>('.modal-dialog');
      if (!dialog) return;

      const firstFocusable = dialog.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        dialog.focus();
      }
    }, 0);
  }

  closeDetail(): void {
    this.selectedRow.set(null);
    if (this.triggerElement && typeof this.triggerElement.focus === 'function') {
      const el = this.triggerElement;
      setTimeout(() => {
        if (el.isConnected) {
          el.focus();
        }
      }, 0);
    }
    this.triggerElement = null;
  }

  @HostListener('window:keydown', ['$event'])
  handleWindowKeydown(event: KeyboardEvent): void {
    if (!this.selectedRow()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeDetail();
      return;
    }

    if (event.key === 'Tab') {
      if (typeof document === 'undefined') return;
      const dialog = document.querySelector<HTMLElement>('.modal-dialog');
      if (!dialog) return;

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0);

      if (focusables.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first || !dialog.contains(document.activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !dialog.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        }
      }
    }
  }

  getReceiptsForSelected(row: PlenoRow): TransferSubmission[] {
    const paymentRef = (row.paymentReference || (row as any).reference)?.trim().toLowerCase();
    if (!paymentRef) {
      return [];
    }
    return this.store
      .submissions()
      .filter(
        (s) =>
          s.email?.toLowerCase() === row.email.toLowerCase() &&
          Boolean(
            (s.reference && s.reference.trim().toLowerCase() === paymentRef) ||
              (s.displayReference && s.displayReference.trim().toLowerCase() === paymentRef),
          ),
      );
  }

  getInitials(name: string): string {
    if (!name) return 'MP';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  getWhatsappUrl(phone: string, name: string): string {
    const clean = phone.replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(
      `Hola ${name}, te contactamos desde la administración del Club de Experiencias sobre tu Membresía Plena.`,
    );
    return `https://wa.me/${clean}?text=${msg}`;
  }

  async toggleStatus(row: PlenoRow, targetStatus: 'activa' | 'baja'): Promise<void> {
    try {
      if (row.sourceType === 'socio') {
        const memberId = row.id.replace('socio-', '');
        const newTier = targetStatus === 'activa' ? 'activo' : 'dado_de_baja';
        const result = await this.store.updateMemberProfile(memberId, { membershipTier: newTier });
        if (!result?.success) {
          throw new Error(result?.error || 'No fue posible actualizar el socio.');
        }
        this.showToast(
          targetStatus === 'activa'
            ? `Membresía Plena de ${row.name} activada con éxito.`
            : `Membresía de ${row.name} pasada a baja.`,
        );
      } else if (row.sourceType === 'prestador' || row.sourceType === 'postulacion') {
        const appStatus = targetStatus === 'activa' ? 'aprobado' : 'dado_de_baja';
        const rawId = row.id.replace('prestador-', '').replace('postulacion-', '');
        const ok = await this.store.updateApplicationStatus(rawId, 'prestador', appStatus);
        if (!ok) {
          throw new Error('No fue posible actualizar el estado del prestador.');
        }
        this.showToast(
          targetStatus === 'activa'
            ? `Prestador Pleno ${row.name} activado con éxito.`
            : `Prestador Pleno ${row.name} dado de baja.`,
        );
      }
    } catch (err: any) {
      console.error('[AdminPlenos] Error actualizando estado:', err);
      const msg = err?.message || (typeof err === 'string' ? err : 'Ocurrió un error al actualizar el estado.');
      this.showToast(msg);
    }
  }

  private showToast(msg: string): void {
    this.feedbackToast.set(msg);
    setTimeout(() => {
      this.feedbackToast.set(null);
    }, 4000);
  }
}
