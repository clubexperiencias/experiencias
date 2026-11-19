import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AdminStoreService, AdminApplication, ApplicationStatus } from '../../../core/services/admin-store.service';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { TransferSubmission } from '../../../core/models/bank-transfer.model';
import { ArsPipe, FechaPipe } from '../../../shared/pipes/format.pipes';

export type FundadorFilterSegment = 'todos' | 'socios' | 'prestadores';
export type FundadorFilterStatus = 'todos' | 'vitalicios' | 'evaluacion' | 'rechazados';

export interface FundadorRow {
  id: string;
  sourceType: 'postulacion_fundador' | 'socio_fundador' | 'prestador_fundador';
  name: string;
  email: string;
  phone: string;
  agency?: string;
  avatar?: string;
  tier: 'socio_fundador' | 'prestador_fundador';
  tierLabel: string;
  endowmentAmount: number; // 5.000.000 o 10.000.000
  status: 'vitalicio' | 'en_evaluacion' | 'rechazado' | 'baja';
  statusLabel: string;
  motivationLetter?: string;
  date: string;
  notes?: string;
}

@Component({
  selector: 'app-admin-fundadores',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, ArsPipe, FechaPipe],
  template: `
    <div class="fundadores-page-container">
      <!-- Toast de feedback -->
      @if (feedbackToast()) {
        <div class="toast-banner">
          <mat-icon class="toast-icon">verified</mat-icon>
          <span>{{ feedbackToast() }}</span>
        </div>
      }

      <!-- Header Principal -->
      <header class="fundadores-header">
        <div>
          <h1 class="header-title">Círculo de Fundadores: Socios & Prestadores Vitalicios</h1>
          <p class="header-sub">
            Gestión de membresías vitalicias de honor, evaluación de cartas de motivación y cartas de intención por el
            Comité Directivo, y seguimiento del Fondo Patrimonial ($5.000.000 socios / $10.000.000 prestadores).
          </p>
        </div>
      </header>

      <!-- Métricas Resumen (2 por fila en mobile) -->
      <section class="summary-strip">
        <div class="summary-card">
          <span class="sum-label">Fundadores Vitalicios</span>
          <strong class="sum-value">{{ stats().activeCount }}</strong>
          <span class="sum-sub">{{ stats().activeSocios }} Socios • {{ stats().activePrestadores }} Prestadores</span>
        </div>

        <div class="summary-card">
          <span class="sum-label">Cartas en Evaluación</span>
          <strong class="sum-value">{{ stats().pendingCount }}</strong>
          <span class="sum-sub">Pendientes de dictamen del Comité</span>
        </div>

        <div class="summary-card">
          <span class="sum-label">Rechazadas / Archivadas</span>
          <strong class="sum-value">{{ stats().rejectedCount }}</strong>
          <span class="sum-sub">No admitidas en el cuadro</span>
        </div>

        <div class="summary-card highlight-endowment">
          <span class="sum-label">Fondo Patrimonial Recaudado</span>
          <strong class="sum-value text-gold">{{ stats().totalEndowment | ars }}</strong>
          <span class="sum-sub">Fondo patrimonial acumulado vitalicio</span>
        </div>
      </section>

      <!-- Barra de Filtros y Búsqueda -->
      <section class="toolbar-section">
        <div class="search-box">
          <mat-icon class="search-icon">search</mat-icon>
          <input
            type="text"
            class="search-input"
            placeholder="Buscar por nombre, email, agencia o palabras clave de la carta..."
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
                Socios Fundadores ($5M)
              </button>
              <button
                type="button"
                class="pill-tab"
                [class.is-active]="segmentFilter() === 'prestadores'"
                (click)="segmentFilter.set('prestadores')"
              >
                Prestadores Fundadores ($10M)
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Tabla de Socios y Prestadores Fundadores -->
      <section class="table-section">
        <div class="table-card">
          <div class="card-head">
            <div class="card-head-title-wrap">
              <span class="block-kicker text-gold">REGISTRO DE ASPIRANTES & FUNDADORES VITALICIOS</span>
              <h2 class="card-title">Cuadro de Fundadores ({{ filteredRows().length }})</h2>
            </div>
            <span class="badge-total">{{ filteredRows().length }} postulaciones</span>
          </div>

          @if (filteredRows().length === 0) {
            <div class="empty-state">
              <h3 class="empty-title">No se encontraron aspirantes ni fundadores</h3>
              <p class="empty-sub">Modificá los filtros o ingresá otro término de búsqueda.</p>
            </div>
          } @else {
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Aspirante / Fundador</th>
                    <th>Categoría</th>
                    <th>Aporte Patrimonial</th>
                    <th>Estado</th>
                    <th>Carta de Motivación</th>
                    <th>Fecha</th>
                    <th class="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of filteredRows(); track row.id) {
                    <tr [class.row-vitalicio]="row.status === 'vitalicio'" [class.row-rejected]="row.status === 'rechazado'">
                      <!-- Aspirante / Fundador -->
                      <td>
                        <div class="member-info-cell">
                          <div class="avatar-circle" [class.avatar-gold]="row.status === 'vitalicio'">
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
                        @if (row.tier === 'socio_fundador') {
                          <span class="tier-badge badge-socio-fundador">SOCIO FUNDADOR</span>
                        } @else {
                          <span class="tier-badge badge-prestador-fundador">PRESTADOR FUNDADOR</span>
                        }
                      </td>

                      <!-- Aporte Patrimonial -->
                      <td>
                        <div class="fee-cell">
                          <strong class="fee-amount text-white">{{ row.endowmentAmount | ars }}</strong>
                          <span class="fee-sub">aporte único</span>
                        </div>
                      </td>

                      <!-- Estado -->
                      <td>
                        <span class="status-badge" [attr.data-status]="row.status">
                          @switch (row.status) {
                            @case ('vitalicio') { VITALICIO CONFIRMADO }
                            @case ('en_evaluacion') { EN EVALUACIÓN }
                            @case ('rechazado') { RECHAZADO }
                            @case ('baja') { DADO DE BAJA }
                          }
                        </span>
                      </td>

                      <!-- Carta de Motivación -->
                      <td>
                        <div class="letter-snippet-cell">
                          @if (row.motivationLetter) {
                            <span class="letter-snippet-text" [title]="row.motivationLetter">
                              "{{ getSnippet(row.motivationLetter) }}"
                            </span>
                          } @else {
                            <span class="no-letter">Sin carta adjunta</span>
                          }
                        </div>
                      </td>

                      <!-- Fecha -->
                      <td>
                        <span class="date-text">{{ row.date | fecha: 'corta' }}</span>
                      </td>

                      <!-- Acciones -->
                      <td class="text-right">
                        <div class="row-actions">
                          <button
                            type="button"
                            class="btn-action-eval"
                            (click)="openLetterModal(row)"
                            title="Revisar Carta y Evaluar Postulación"
                          >
                            <span>EVALUAR</span>
                          </button>
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

      <!-- Modal de Lectura de Carta de Motivación & Dictamen del Comité -->
      @if (selectedRow(); as row) {
        <div class="modal-backdrop" (click)="closeModal()">
          <div class="modal-dialog letter-dialog" (click)="$event.stopPropagation()">
            <header class="modal-header">
              <div>
                <span class="modal-kicker text-gold">CÍRCULO DE FUNDADORES — COMITÉ DIRECTIVO</span>
                <h3 class="modal-title">{{ row.name }}</h3>
                <span class="modal-sub">{{ row.email }} &bull; {{ row.phone }}</span>
              </div>
              <button type="button" class="modal-close-btn" (click)="closeModal()" aria-label="Cerrar modal">
                ✕
              </button>
            </header>

            <div class="modal-body">
              <!-- Meta Strip del Postulante -->
              <div class="letter-meta-strip">
                <div class="meta-item">
                  <span class="m-label">Categoría Solicitada</span>
                  <strong class="m-val">{{ row.tierLabel }}</strong>
                </div>
                <div class="meta-item">
                  <span class="m-label">Aporte Patrimonial Comprometido</span>
                  <strong class="m-val text-gold">{{ row.endowmentAmount | ars }}</strong>
                </div>
                <div class="meta-item">
                  <span class="m-label">Estado de Evaluación</span>
                  <span class="status-badge" [attr.data-status]="row.status">
                    @switch (row.status) {
                      @case ('vitalicio') { VITALICIO CONFIRMADO }
                      @case ('en_evaluacion') { EN EVALUACIÓN }
                      @case ('rechazado') { RECHAZADO }
                      @case ('baja') { DADO DE BAJA }
                      @default { {{ row.statusLabel || row.status }} }
                    }
                  </span>
                </div>
                <div class="meta-item">
                  <span class="m-label">Fecha de Postulación</span>
                  <strong class="m-val">{{ row.date | fecha: 'larga' }}</strong>
                </div>
              </div>

              <!-- Bloque de la Carta de Motivación -->
              <div class="motivation-letter-box">
                <div class="letter-box-head">
                  <mat-icon class="quote-icon">format_quote</mat-icon>
                  <h4 class="letter-box-title">Carta de Motivación & Propósito</h4>
                </div>

                @if (row.motivationLetter) {
                  <div class="letter-content-text">
                    {{ row.motivationLetter }}
                  </div>
                } @else {
                  <div class="letter-content-text empty-letter">
                    El postulante manifestó adhesión a los estatutos fundacionales del Club de Experiencias y su compromiso
                    con el aporte patrimonial vitalicio correspondiente.
                  </div>
                }
              </div>

              <!-- Protocolo de Compromiso -->
              <div class="protocol-box">
                <div class="protocol-text">
                  <strong>Protocolo de Compromiso Fundacional:</strong>
                  <span>
                    La membresía vitalicia otorga voz y voto en la asamblea fundacional, acceso preferencial e ilimitado a todas
                    las experiencias de la red y exención de cuotas mensuales de mantenimiento de por vida.
                  </span>
                </div>
              </div>
            </div>

            <footer class="modal-footer">
              <button type="button" class="btn-modal-cancel" (click)="closeModal()">Cerrar</button>

              <div class="modal-footer-actions">
                @if (row.status !== 'rechazado') {
                  <button
                    type="button"
                    class="btn-modal-danger"
                    (click)="updateStatus(row, 'rechazado'); closeModal()"
                  >
                    Rechazar Postulación
                  </button>
                }

                @if (row.status !== 'en_evaluacion') {
                  <button
                    type="button"
                    class="btn-modal-pending"
                    (click)="updateStatus(row, 'en_evaluacion'); closeModal()"
                  >
                    Poner en Evaluación
                  </button>
                }

                @if (row.status !== 'vitalicio') {
                  <button
                    type="button"
                    class="btn-modal-gold"
                    (click)="updateStatus(row, 'vitalicio'); closeModal()"
                  >
                    Aprobar Membresía Vitalicia
                  </button>
                }
              </div>
            </footer>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .fundadores-page-container {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        padding-bottom: 3rem;
      }

      .text-gold {
        color: #ffcc00 !important;
      }

      .text-white {
        color: #ffffff !important;
      }

      .toast-banner {
        position: fixed;
        bottom: 1.5rem;
        right: 1.5rem;
        background: #18130e;
        border: 1px solid #ffcc00;
        color: #ffffff;
        padding: 0.85rem 1.25rem;
        border-radius: 6px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        gap: 0.6rem;
        z-index: 10000;
        font-weight: 600;
        animation: fadeIn 0.3s ease;
      }

      .toast-icon {
        color: #ffcc00;
        font-size: 1.25rem;
        width: 1.25rem;
        height: 1.25rem;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* Header */
      .fundadores-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding-top: 1.25rem;
      }

      .header-kicker {
        font-size: 0.72rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.1em;
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
        max-width: 840px;
        line-height: 1.45;
        margin: 0;
      }

      /* Strip Resumen Métrico */
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

      .highlight-endowment {
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
        border: 1px solid rgba(255, 204, 0, 0.25);
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
        border-color: #ffcc00;
      }

      .clear-search-btn {
        position: absolute;
        right: 0.75rem;
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.6);
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
        background: #ffcc00;
        border-color: #ffcc00;
        color: #000000;
        font-weight: 800;
      }

      /* Tabla Card */
      .table-card {
        background: rgba(22, 12, 6, 0.85);
        border: 1px solid rgba(255, 204, 0, 0.25);
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
        background: rgba(255, 255, 255, 0.08);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }

      .empty-state {
        text-align: center;
        padding: 3rem 1.5rem;
      }

      .empty-icon {
        font-size: 3rem;
        width: 3rem;
        height: 3rem;
        color: rgba(255, 204, 0, 0.3);
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

      .row-vitalicio {
        background: rgba(255, 204, 0, 0.03);
      }

      .row-rejected {
        opacity: 0.55;
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
        background: #334155;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 0.85rem;
        flex-shrink: 0;
        overflow: hidden;
      }

      .avatar-circle.avatar-gold {
        background: #ffcc00;
        color: #000000;
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
        color: #ffcc00;
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

      .badge-socio-fundador {
        background: rgba(128, 179, 255, 0.15);
        color: #80b3ff;
        border: 1px solid rgba(128, 179, 255, 0.4);
      }

      .badge-prestador-fundador {
        background: rgba(251, 146, 60, 0.15);
        color: #fb923c;
        border: 1px solid rgba(251, 146, 60, 0.4);
      }

      .fee-cell {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
      }

      .fee-amount {
        font-weight: 800;
        font-size: 0.95rem;
        color: #ffffff;
      }

      .fee-sub {
        font-size: 0.68rem;
        color: rgba(255, 255, 255, 0.5);
        text-transform: uppercase;
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

      .status-badge[data-status='vitalicio'] {
        background: rgba(255, 204, 0, 0.15);
        color: #ffcc00;
        border: 1px solid rgba(255, 204, 0, 0.4);
      }

      .status-badge[data-status='en_evaluacion'] {
        background: rgba(255, 95, 0, 0.15);
        color: #ff5f00;
        border: 1px solid rgba(255, 95, 0, 0.4);
      }

      .status-badge[data-status='rechazado'],
      .status-badge[data-status='baja'] {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
        border: 1px solid rgba(239, 68, 68, 0.4);
      }

      .letter-snippet-cell {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        max-width: 280px;
      }

      .letter-snippet-text {
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.75);
        font-style: italic;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .btn-read-letter {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        background: transparent;
        border: none;
        color: #ffcc00;
        font-size: 0.72rem;
        font-weight: 700;
        cursor: pointer;
        padding: 0;
        text-align: left;
      }

      .btn-read-letter:hover {
        text-decoration: underline;
      }

      .no-letter {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.35);
      }

      .icon-xs {
        font-size: 0.85rem;
        width: 0.85rem;
        height: 0.85rem;
      }

      .date-text {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.75);
      }

      .text-right {
        text-align: right;
      }

      .row-actions {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }

      .btn-action-eval {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.25);
        color: #ffffff;
        padding: 0.35rem 0.85rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        cursor: pointer;
        transition: background 0.15s ease, border-color 0.15s ease;
      }

      .btn-action-eval:hover {
        background: rgba(255, 255, 255, 0.18);
        border-color: #ffffff;
        color: #ffffff;
      }

      .icon-sm {
        font-size: 1rem;
        width: 1rem;
        height: 1rem;
      }

      .btn-quick-approve {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
        border: 1px solid rgba(16, 185, 129, 0.3);
        padding: 0.35rem 0.7rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
      }

      .btn-quick-approve:hover {
        background: rgba(16, 185, 129, 0.3);
      }

      .btn-quick-reject {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
        border: 1px solid rgba(239, 68, 68, 0.3);
        padding: 0.35rem 0.7rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
      }

      .btn-quick-reject:hover {
        background: rgba(239, 68, 68, 0.3);
      }

      /* Modal Carta de Motivación */
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(6px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 1rem;
      }

      .modal-dialog.letter-dialog {
        background: #18130e;
        border: 1px solid rgba(255, 204, 0, 0.4);
        border-radius: 10px;
        width: 100%;
        max-width: 680px;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.7);
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
        display: block;
        margin-bottom: 0.2rem;
      }

      .modal-title {
        font-size: 1.35rem;
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
        color: rgba(255, 255, 255, 0.6);
        font-size: 1.25rem;
        cursor: pointer;
      }

      .modal-body {
        padding: 1.5rem;
        max-height: 70vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .letter-meta-strip {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.85rem;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 6px;
        padding: 0.85rem 1rem;
      }

      .meta-item {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .m-label {
        font-size: 0.68rem;
        font-weight: 700;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.5);
      }

      .m-val {
        font-size: 0.9rem;
        color: #ffffff;
      }

      .motivation-letter-box {
        background: rgba(255, 204, 0, 0.04);
        border: 1px solid rgba(255, 204, 0, 0.25);
        border-radius: 6px;
        padding: 1.25rem;
      }

      .letter-box-head {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        margin-bottom: 0.75rem;
      }

      .quote-icon {
        color: #ffcc00;
        font-size: 1.3rem;
        width: 1.3rem;
        height: 1.3rem;
      }

      .letter-box-title {
        font-size: 0.88rem;
        font-weight: 800;
        color: #ffcc00;
        margin: 0;
      }

      .letter-content-text {
        font-size: 0.92rem;
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.9);
        white-space: pre-wrap;
        font-style: italic;
      }

      .empty-letter {
        color: rgba(255, 255, 255, 0.6);
        font-style: normal;
      }

      .protocol-box {
        display: flex;
        gap: 0.75rem;
        align-items: flex-start;
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 6px;
        padding: 0.85rem 1rem;
      }

      .protocol-text {
        font-size: 0.8rem;
        line-height: 1.45;
        color: rgba(255, 255, 255, 0.75);
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .modal-footer {
        padding: 1rem 1.5rem;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.65rem;
        background: rgba(0, 0, 0, 0.2);
        flex-wrap: wrap;
      }

      .modal-footer-actions {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        flex-wrap: wrap;
      }

      .btn-modal-cancel {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #ffffff;
        padding: 0.55rem 0.95rem;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 600;
        font-size: 0.82rem;
      }

      .btn-modal-gold {
        background: #ffcc00;
        border: none;
        color: #ffffff;
        padding: 0.55rem 1.25rem;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 800;
        font-size: 0.82rem;
      }

      .btn-modal-gold:hover {
        background: #ffd633;
      }

      .btn-modal-danger {
        background: #ef4444;
        border: none;
        color: #ffffff;
        padding: 0.55rem 1.1rem;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 700;
        font-size: 0.82rem;
      }

      .btn-modal-pending {
        background: rgba(56, 189, 248, 0.2);
        border: 1px solid rgba(56, 189, 248, 0.4);
        color: #38bdf8;
        padding: 0.55rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 700;
        font-size: 0.82rem;
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

        .letter-meta-strip {
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
export class AdminFundadoresComponent {
  private readonly store = inject(AdminStoreService);
  private readonly providerStore = inject(ProviderStoreService);

  readonly searchQuery = signal<string>('');
  readonly segmentFilter = signal<FundadorFilterSegment>('todos');
  readonly statusFilter = signal<FundadorFilterStatus>('todos');
  readonly selectedRow = signal<FundadorRow | null>(null);
  readonly feedbackToast = signal<string | null>(null);

  // Unifica Socios Fundadores ($5M) y Prestadores Fundadores ($10M)
  readonly rows = computed<FundadorRow[]>(() => {
    const list: FundadorRow[] = [];
    const members = this.store.members();
    const providers = this.providerStore.providers();
    const applications = this.store.applications();

    // 1. Postulaciones directas a fundadores registradas en applications
    for (const a of applications) {
      if (a.type === 'fundador') {
        const emailNorm = (a.email || '').trim().toLowerCase();
        // Evitar duplicaciones en la tabla si existen múltiples postulaciones con el mismo email
        if (emailNorm && list.some((item) => (item.email || '').trim().toLowerCase() === emailNorm)) {
          continue;
        }

        const isPrestador = !!a.agency || (a.category && a.category !== 'socio');
        const status: 'vitalicio' | 'en_evaluacion' | 'rechazado' | 'baja' =
          a.status === 'aprobado'
            ? 'vitalicio'
            : a.status === 'rechazado'
              ? 'rechazado'
              : a.status === 'dado_de_baja'
                ? 'baja'
                : 'en_evaluacion';

        list.push({
          id: `app-fundador-${a.id}`,
          sourceType: 'postulacion_fundador',
          name: a.fullName,
          email: a.email,
          phone: a.phone || '—',
          agency: a.agency,
          tier: isPrestador ? 'prestador_fundador' : 'socio_fundador',
          tierLabel: isPrestador ? 'Prestador Fundador' : 'Socio Fundador',
          endowmentAmount: isPrestador ? 10000000 : 5000000,
          status,
          statusLabel:
            status === 'vitalicio'
              ? 'Vitalicio Confirmado'
              : status === 'rechazado'
                ? 'Rechazado'
                : status === 'baja'
                  ? 'Dado de baja'
                  : 'En Evaluación',
          motivationLetter: a.motivationLetter || '',
          date: a.createdAt,
        });
      }
    }

    // 2. Socios registrados formalmente con tier 'fundador'
    for (const m of members) {
      if (m.membershipTier === 'fundador') {
        const emailNorm = (m.email || '').trim().toLowerCase();
        // Evitar duplicar si ya vino por application o socio previo
        if (emailNorm && list.some((item) => (item.email || '').trim().toLowerCase() === emailNorm)) {
          continue;
        }

        list.push({
          id: `socio-fundador-${m.id}`,
          sourceType: 'socio_fundador',
          name: m.fullName || (m.email ? m.email.split('@')[0] : 'Socio Fundador'),
          email: m.email,
          phone: m.phone || '—',
          avatar: m.avatarUrl,
          tier: 'socio_fundador',
          tierLabel: 'Socio Fundador',
          endowmentAmount: 5000000,
          status: 'vitalicio',
          statusLabel: 'Vitalicio Confirmado',
          motivationLetter: 'Socio fundador registrado y validado en el cuadro patrimonial del Club de Experiencias.',
          date: m.createdAt,
        });
      }
    }

    // 3. Prestadores registrados con tier 'fundador'
    for (const p of providers) {
      if (p.tier === 'fundador') {
        const emailNorm = (p.email || '').trim().toLowerCase();
        if (emailNorm && list.some((item) => (item.email || '').trim().toLowerCase() === emailNorm)) {
          continue;
        }

        list.push({
          id: `prestador-fundador-${p.id}`,
          sourceType: 'prestador_fundador',
          name: p.name,
          email: p.email,
          phone: p.phone || '—',
          agency: p.agency,
          avatar: p.avatar,
          tier: 'prestador_fundador',
          tierLabel: 'Prestador Fundador',
          endowmentAmount: 10000000,
          status:
            p.status === 'rechazado'
              ? 'rechazado'
              : p.status === 'dado_de_baja'
                ? 'baja'
                : p.status === 'pendiente'
                  ? 'en_evaluacion'
                  : 'vitalicio',
          statusLabel:
            p.status === 'rechazado'
              ? 'Rechazado'
              : p.status === 'dado_de_baja'
                ? 'Dado de baja'
                : p.status === 'pendiente'
                  ? 'En Evaluación'
                  : 'Vitalicio Confirmado',
          motivationLetter: p.bio || 'Prestador fundador integrante del cuadro de honor patrimonial.',
          date: p.joinedAt || new Date().toISOString(),
        });
      }
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  // Estadísticas del Fondo Patrimonial y Cuadro Vitalicio
  readonly stats = computed(() => {
    const all = this.rows();
    const vitalicios = all.filter((r) => r.status === 'vitalicio');
    const pending = all.filter((r) => r.status === 'en_evaluacion');
    const rejected = all.filter((r) => r.status === 'rechazado' || r.status === 'baja');

    const activeSocios = vitalicios.filter((r) => r.tier === 'socio_fundador').length;
    const activePrestadores = vitalicios.filter((r) => r.tier === 'prestador_fundador').length;

    // Fondo Patrimonial Recaudado = ($5.000.000 * socios vitalicios) + ($10.000.000 * prestadores vitalicios)
    const totalEndowment = activeSocios * 5000000 + activePrestadores * 10000000;

    return {
      activeCount: vitalicios.length,
      activeSocios,
      activePrestadores,
      pendingCount: pending.length,
      rejectedCount: rejected.length,
      totalEndowment,
    };
  });

  // Filtro reactivo
  readonly filteredRows = computed(() => {
    let result = this.rows();
    const query = this.searchQuery().trim().toLowerCase();
    const seg = this.segmentFilter();
    const stat = this.statusFilter();

    if (seg === 'socios') {
      result = result.filter((r) => r.tier === 'socio_fundador');
    } else if (seg === 'prestadores') {
      result = result.filter((r) => r.tier === 'prestador_fundador');
    }

    if (stat === 'vitalicios') {
      result = result.filter((r) => r.status === 'vitalicio');
    } else if (stat === 'evaluacion') {
      result = result.filter((r) => r.status === 'en_evaluacion');
    } else if (stat === 'rechazados') {
      result = result.filter((r) => r.status === 'rechazado' || r.status === 'baja');
    }

    if (query) {
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.email.toLowerCase().includes(query) ||
          (r.agency && r.agency.toLowerCase().includes(query)) ||
          (r.phone && r.phone.toLowerCase().includes(query)) ||
          (r.motivationLetter && r.motivationLetter.toLowerCase().includes(query)),
      );
    }

    return result;
  });

  openLetterModal(row: FundadorRow): void {
    this.selectedRow.set(row);
  }

  closeModal(): void {
    this.selectedRow.set(null);
  }

  getSnippet(text?: string): string {
    if (!text) return '';
    return text.length > 90 ? text.substring(0, 90) + '...' : text;
  }

  getInitials(name: string): string {
    if (!name) return 'FV';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  async updateStatus(
    row: FundadorRow,
    newStatus: 'vitalicio' | 'en_evaluacion' | 'rechazado' | 'baja',
  ): Promise<void> {
    try {
      if (row.sourceType === 'postulacion_fundador') {
        const rawId = row.id.replace('app-fundador-', '');
        const appStatus: ApplicationStatus =
          newStatus === 'vitalicio'
            ? 'aprobado'
            : newStatus === 'rechazado'
              ? 'rechazado'
              : newStatus === 'baja'
                ? 'dado_de_baja'
                : 'pendiente';

        const ok = await this.store.updateApplicationStatus(rawId, 'fundador', appStatus);
        if (!ok) {
          throw new Error('No fue posible actualizar el estado de la postulación.');
        }

        if (newStatus === 'vitalicio') {
          const rowEmailNorm = (row.email || '').trim().toLowerCase();
          const member = rowEmailNorm
            ? this.store
                .members()
                .find((m) => (m.email || '').trim().toLowerCase() === rowEmailNorm)
            : null;
          if (member) {
            void this.store.updateMemberProfile(member.id, { membershipTier: 'fundador' });
          }
        }
      } else if (row.sourceType === 'socio_fundador') {
        const memberId = row.id.replace('socio-fundador-', '');
        const targetTier =
          newStatus === 'vitalicio'
            ? 'fundador'
            : newStatus === 'rechazado' || newStatus === 'baja'
              ? 'dado_de_baja'
              : 'waitlist';
        const result = await this.store.updateMemberProfile(memberId, { membershipTier: targetTier });
        if (!result?.success) {
          throw new Error(result?.error || 'No fue posible actualizar el perfil del socio.');
        }

        const appStatus: ApplicationStatus =
          newStatus === 'vitalicio'
            ? 'aprobado'
            : newStatus === 'rechazado'
              ? 'rechazado'
              : newStatus === 'baja'
                ? 'dado_de_baja'
                : 'pendiente';

        const ok = await this.store.recordFounderApplication({
          fullName: row.name,
          email: row.email,
          phone: row.phone,
          status: appStatus,
          motivationLetter: row.motivationLetter || 'Socio fundador en proceso de evaluación.',
        });
        if (!ok) {
          throw new Error('No fue posible actualizar el estado de la postulación de fundador.');
        }
      } else if (row.sourceType === 'prestador_fundador') {
        const provId = row.id.replace('prestador-fundador-', '');
        const provStatus: ApplicationStatus =
          newStatus === 'vitalicio'
            ? 'aprobado'
            : newStatus === 'rechazado'
              ? 'rechazado'
              : newStatus === 'baja'
                ? 'dado_de_baja'
                : 'pendiente';
        const ok = await this.store.updateApplicationStatus(provId, 'prestador', provStatus);
        if (!ok) {
          throw new Error('No fue posible actualizar el estado del prestador.');
        }
      }

      const statusLabels: Record<string, string> = {
        vitalicio: 'aprobado como Miembro Vitalicio',
        en_evaluacion: 'marcado en evaluación',
        rechazado: 'rechazado',
        baja: 'dado de baja',
      };

      this.showToast(`Estado de ${row.name} actualizado: ${statusLabels[newStatus] || newStatus}.`);
    } catch (err: any) {
      console.error('[AdminFundadores] Error actualizando estado:', err);
      const msg =
        err?.message ||
        (typeof err === 'string' ? err : 'Ocurrió un error al actualizar el estado de la postulación.');
      this.showToast(msg);
    }
  }

  private showToast(msg: string): void {
    this.feedbackToast.set(msg);
    setTimeout(() => {
      this.feedbackToast.set(null);
    }, 4500);
  }
}
