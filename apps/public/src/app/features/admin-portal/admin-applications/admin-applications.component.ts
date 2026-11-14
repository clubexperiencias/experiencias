import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AdminStoreService,
  AdminApplication,
  ApplicationType,
  ApplicationStatus,
} from '../../../core/services/admin-store.service';
import { ArsPipe, FechaPipe } from '../../../shared/pipes/format.pipes';
import { ExperienceService } from '../../../core/services/experience.service';
import { NotificationService } from '../../../core/services/notification.service';

type ApplicationFilterTab =
  'todas' | 'prestadores' | 'fundadores' | 'pendientes' | 'aprobadas' | 'bajas';

@Component({
  selector: 'app-admin-applications',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, FechaPipe],
  template: `
    <div class="applications-container">
      <div class="applications-header">
        <div>
          <span class="section-kicker">CONVOCATORIAS & PROPUESTAS</span>
          <h1 class="card-heading">Propuestas y Postulaciones</h1>
          <p class="card-subheading">
            Padrón consolidado de solicitudes recibidas para sumarse como prestadores de servicios
            turísticos, propuestas de nuevas experiencias para el catálogo y aspirantes al cuadro de
            Socios Fundadores.
          </p>
        </div>
      </div>

      <!-- Resumen Métrico de Postulaciones (5 Boxes sobrias) -->
      <div class="summary-strip">
        <div class="summary-item">
          <span class="sum-label">Total Postulaciones</span>
          <strong class="sum-value">{{ store.applicationStats().total }}</strong>
          <span class="sum-sub">Solicitudes registradas</span>
        </div>
        <div class="summary-item">
          <span class="sum-label">Prestadores</span>
          <strong class="sum-value">{{ store.applicationStats().prestadoresCount }}</strong>
          <span class="sum-sub">Guías, 4x4, Náutica y Servicios</span>
        </div>
        <div class="summary-item">
          <span class="sum-label">Socios Fundadores</span>
          <strong class="sum-value">{{ store.applicationStats().fundadoresCount }}</strong>
          <span class="sum-sub">Aspirantes al padrón vitalicio</span>
        </div>
        <div class="summary-item highlight-box" (click)="navigateToExperiencesProposals()" style="cursor: pointer;" title="Ir al catálogo de experiencias (Postulaciones)">
          <span class="sum-label">Nuevas Experiencias</span>
          <strong class="sum-value text-orange">{{ pendingExperienceCount() }}</strong>
          <span class="sum-sub"
            >{{ pendingExperienceCount() }} pendientes en catálogo &rarr;</span
          >
        </div>
        <div class="summary-item">
          <span class="sum-label">Pendientes Totales</span>
          <strong class="sum-value">{{
            store.applicationStats().pendientesCount + pendingExperienceCount()
          }}</strong>
          <span class="sum-sub">Requieren evaluación</span>
        </div>
      </div>

      <!-- Barra de Filtros y Búsqueda -->
      <div class="filters-bar">
        <div class="search-box">
          <mat-icon class="search-icon">search</mat-icon>
          <input
            type="text"
            class="search-input"
            placeholder="Buscar por postulante, email, teléfono, rubro o región..."
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
            [class.is-active]="activeTab() === 'todas'"
            (click)="activeTab.set('todas')"
          >
            Todas ({{ store.applicationStats().total }})
          </button>

          <button
            type="button"
            class="filter-tab"
            [class.is-active]="activeTab() === 'prestadores'"
            (click)="activeTab.set('prestadores')"
          >
            Prestadores ({{ store.applicationStats().prestadoresCount }})
          </button>

          <button
            type="button"
            class="filter-tab"
            [class.is-active]="activeTab() === 'fundadores'"
            (click)="activeTab.set('fundadores')"
          >
            Socios Fundadores ({{ store.applicationStats().fundadoresCount }})
          </button>

          <button
            type="button"
            class="filter-tab"
            [class.is-active]="activeTab() === 'pendientes'"
            (click)="activeTab.set('pendientes')"
          >
            Pendientes ({{ store.applicationStats().pendientesCount }})
          </button>

          <button
            type="button"
            class="filter-tab"
            [class.is-active]="activeTab() === 'aprobadas'"
            (click)="activeTab.set('aprobadas')"
          >
            Aprobadas ({{ store.applicationStats().aprobadasCount }})
          </button>

          <button
            type="button"
            class="filter-tab"
            [class.is-active]="activeTab() === 'bajas'"
            (click)="activeTab.set('bajas')"
          >
            Dadas de baja ({{ store.applicationStats().bajasCount }})
          </button>
        </div>
      </div>

      <!-- Postulaciones Generales -->
      @if (filteredApplications().length === 0) {
        <div class="empty-box">
          <mat-icon>assignment_late</mat-icon>
          <h3>No se encontraron postulaciones</h3>
          <p>Probá cambiando la búsqueda o seleccionando otra pestaña de filtro.</p>
        </div>
      } @else {
        <div class="table-wrapper">
          <table class="applications-table">
            <thead>
              <tr>
                <th class="col-type">Tipo</th>
                <th class="col-postulante">Postulante</th>
                <th class="col-rubro">Detalles</th>
                <th class="col-estado">Estado</th>
                <th class="col-fecha">Fecha</th>
                <th class="col-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (app of filteredApplications(); track app.id) {
                <tr
                  [class.is-prestador]="app.type === 'prestador'"
                  [class.is-fundador]="app.type === 'fundador'"
                >
                  <!-- Tipo -->
                  <td>
                    @if (app.type === 'prestador') {
                      <span class="badge-type badge-prestador">PRESTADOR</span>
                    } @else {
                      <span class="badge-type badge-fundador">SOCIO FUNDADOR</span>
                    }
                  </td>

                  <!-- Postulante -->
                  <td>
                    <div class="postulante-cell">
                      <strong class="postulante-name">{{ app.fullName }}</strong>
                      <span class="postulante-email">{{ app.email }}</span>
                      @if (app.phone && app.phone !== '—') {
                        <a
                          [href]="getWhatsappLink(app.phone, app.fullName)"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="contact-whatsapp"
                          title="Contactar vía WhatsApp"
                        >
                          <span>{{ app.phone }}</span>
                        </a>
                      }
                    </div>
                  </td>

                  <!-- Rubro / Detalle -->
                  <td>
                    <div class="detail-cell">
                      @if (app.type === 'prestador') {
                        <strong class="rubro-title">{{ formatCategory(app.category) }}</strong>
                        <span class="rubro-sub">{{ app.region || 'Catamarca' }}</span>
                        @if (app.website) {
                          <a
                            [href]="app.website"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="rubro-link"
                          >
                            {{ app.website }}
                          </a>
                        }
                      } @else {
                        <strong class="rubro-title">Cuadro Fundacional</strong>
                        <span class="rubro-snippet" [title]="app.motivationLetter">
                          {{ getSnippet(app.motivationLetter) }}
                        </span>
                      }
                    </div>
                  </td>

                  <!-- Estado -->
                  <td>
                    <span class="status-badge" [attr.data-status]="app.status">
                      @switch (app.status) {
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
                    <span class="date-text">{{ app.createdAt | fecha: 'corta' }}</span>
                  </td>

                  <!-- Acciones -->
                  <td class="col-actions">
                    <button
                      type="button"
                      class="btn-view"
                      (click)="openDetailModal(app)"
                      title="Ver postulación completa"
                    >
                      Ver Detalle
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Botones de Acción al Pie de la Tabla -->
        <div class="table-footer-actions">
          <button
            type="button"
            class="btn-footer-action"
            (click)="refresh()"
            [disabled]="store.isLoadingApplications()"
          >
            {{ store.isLoadingApplications() ? 'Actualizando...' : 'Refrescar' }}
          </button>

          <button type="button" class="btn-footer-action" (click)="downloadRoster()">
            Descargar
          </button>
        </div>
      }

      <!-- Modal de Detalle de Postulación General -->
      @if (selectedApp()) {
        <div class="modal-backdrop" (click)="closeDetailModal()">
          <div class="modal-dialog" (click)="$event.stopPropagation()">
            <div class="modal-head">
              <div>
                <span class="modal-kicker">DETALLE DE POSTULACIÓN</span>
                <h2 class="modal-title">{{ selectedApp()!.fullName }}</h2>
              </div>
              <button type="button" class="modal-close-btn" (click)="closeDetailModal()">×</button>
            </div>

            <div class="modal-body">
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="dt-label">Tipo de Postulación</span>
                  <strong class="dt-value">
                    {{
                      selectedApp()!.type === 'prestador'
                        ? 'Prestador de Servicios Turísticos'
                        : 'Socio Fundador'
                    }}
                  </strong>
                </div>

                <div class="detail-item">
                  <span class="dt-label">Estado Actual</span>
                  <span class="status-badge modal-badge" [attr.data-status]="selectedApp()!.status">
                    @switch (selectedApp()!.status) {
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
                </div>

                <div class="detail-item">
                  <span class="dt-label">Email de Contacto</span>
                  <a [href]="'mailto:' + selectedApp()!.email" class="dt-link">{{
                    selectedApp()!.email
                  }}</a>
                </div>

                <div class="detail-item">
                  <span class="dt-label">Teléfono</span>
                  @if (hasPhoneDigits(selectedApp()!.phone)) {
                    <a
                      [href]="getWhatsappLink(selectedApp()!.phone, selectedApp()!.fullName)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="dt-link"
                      title="Contactar por WhatsApp respecto a su postulación"
                    >
                      {{ selectedApp()!.phone }}
                    </a>
                  } @else {
                    <span class="dt-value">{{ selectedApp()!.phone || '—' }}</span>
                  }
                </div>

                @if (selectedApp()!.type === 'prestador') {
                  <div class="detail-item">
                    <span class="dt-label">Rubro / Categoría</span>
                    <strong class="dt-value">{{ formatCategory(selectedApp()!.category) }}</strong>
                  </div>

                  <div class="detail-item">
                    <span class="dt-label">Región Operativa</span>
                    <span class="dt-value">{{ selectedApp()!.region || 'Catamarca' }}</span>
                  </div>

                  @if (selectedApp()!.website) {
                    <div class="detail-item full-span">
                      <span class="dt-label">Sitio Web / Redes</span>
                      <a
                        [href]="selectedApp()!.website"
                        target="_blank"
                        rel="noopener"
                        class="dt-link"
                      >
                        {{ selectedApp()!.website }}
                      </a>
                    </div>
                  }

                  @if (selectedApp()!.description && selectedApp()!.description!.trim()) {
                    <div class="detail-item full-span">
                      <span class="dt-label">Descripción de Servicios y Logística</span>
                      <p class="dt-text-box">
                        {{ selectedApp()!.description }}
                      </p>
                    </div>
                  }

                  <!-- Datos Bancarios para Liquidación de Pagos (Solo si el prestador ya los tiene cargados) -->
                  @if (selectedApp()!.cbuAlias || selectedApp()!.cuitDni) {
                    <div class="provider-banking-card full-span">
                      <h4 class="banking-card-title">Datos Bancarios para Liquidación de Pagos</h4>
                      <div class="banking-display-grid">
                        <div class="banking-display-item">
                          <span class="banking-item-lbl">Titular</span>
                          <strong class="banking-item-val">{{ selectedApp()!.accountHolder || selectedApp()!.fullName }}</strong>
                        </div>
                        <div class="banking-display-item">
                          <span class="banking-item-lbl">CUIT / CUIL</span>
                          <strong class="banking-item-val">{{ selectedApp()!.cuitDni || '—' }}</strong>
                        </div>
                        <div class="banking-display-item">
                          <span class="banking-item-lbl">CBU / CVU o Alias</span>
                          <strong class="banking-item-val">{{ selectedApp()!.cbuAlias || '—' }}</strong>
                        </div>
                        <div class="banking-display-item">
                          <span class="banking-item-lbl">Entidad</span>
                          <strong class="banking-item-val">{{ selectedApp()!.bankName || '—' }}</strong>
                        </div>
                      </div>
                    </div>
                  }
                } @else {
                  <div class="detail-item full-span">
                    <span class="dt-label">Carta de Motivación para ser Socio Fundador</span>
                    <p class="dt-text-box">
                      {{ selectedApp()!.motivationLetter || 'Sin carta de motivación provista.' }}
                    </p>
                  </div>
                }

                <div class="detail-item full-span">
                  <span class="dt-label">Fecha de Postulación</span>
                  <span class="dt-sub">{{ selectedApp()!.createdAt | fecha: 'larga' }}</span>
                </div>
              </div>
            </div>

            <div class="modal-actions">
              <div class="state-buttons">
                @if (selectedApp()!.type === 'prestador') {
                  @if (selectedApp()!.status !== 'aprobado') {
                    <button
                      type="button"
                      class="btn-state btn-approve"
                      [disabled]="isSendingWelcomeEmail()"
                      (click)="approveProvider()"
                    >
                      Aprobar Prestador
                    </button>
                  }
                  @if (selectedApp()!.status === 'aprobado') {
                    <button
                      type="button"
                      class="btn-state btn-resend"
                      [disabled]="isSendingWelcomeEmail()"
                      (click)="resendWelcomeEmail()"
                      title="Enviar o reenviar correo de bienvenida con instrucciones de acceso al portal"
                    >
                      <mat-icon *ngIf="isSendingWelcomeEmail()" class="btn-spin">sync</mat-icon>
                      <span>{{ isSendingWelcomeEmail() ? 'Enviando email...' : 'Reenviar email de bienvenida' }}</span>
                    </button>
                  }
                  @if (selectedApp()!.status !== 'dado_de_baja') {
                    <button
                      type="button"
                      class="btn-state btn-reject"
                      (click)="darDeBajaProvider()"
                    >
                      Dar de baja
                    </button>
                  }
                } @else {
                  @if (selectedApp()!.status !== 'aprobado') {
                    <button
                      type="button"
                      class="btn-state btn-approve"
                      (click)="changeStatus('aprobado')"
                    >
                      Aprobar Postulación
                    </button>
                  }

                  @if (selectedApp()!.status !== 'dado_de_baja') {
                    <button
                      type="button"
                      class="btn-state btn-reject"
                      (click)="changeStatus('dado_de_baja')"
                    >
                      Dar de baja
                    </button>
                  }
                }
              </div>

              @if (welcomeEmailStatus(); as emailStatus) {
                <div
                  class="email-status-banner"
                  [class.is-success]="emailStatus.success"
                  [class.is-error]="!emailStatus.success"
                >
                  <mat-icon>{{ emailStatus.success ? 'check_circle' : 'error_outline' }}</mat-icon>
                  <span>{{ emailStatus.message }}</span>
                </div>
              }

              <button type="button" class="btn-close" (click)="closeDetailModal()">Cerrar</button>
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

      .applications-container {
        display: flex;
        flex-direction: column;
        gap: 1.15rem;
        margin-top: 0;
        padding-top: 0;
      }

      .applications-header {
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
        margin: 0 0 0.5rem;
        letter-spacing: -0.02em;
      }

      .card-subheading {
        font-size: 0.88rem;
        color: rgba(255, 255, 255, 0.65);
        max-width: 780px;
        margin: 0;
        line-height: 1.5;
      }

      /* Summary Strip */
      .summary-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1rem;
      }

      @media (max-width: 900px) {
        .summary-strip {
          grid-template-columns: repeat(2, 1fr) !important;
          gap: 0.65rem;
        }
        .summary-item {
          padding: 0.85rem 0.75rem;
        }
        .sum-label {
          font-size: 0.62rem;
        }
        .sum-value {
          font-size: 1.25rem;
        }
        .sum-sub {
          font-size: 0.62rem;
        }
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

      .summary-item.highlight-box {
        border-color: rgba(255, 95, 0, 0.55);
        background: rgba(36, 18, 10, 0.88);
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
        color: rgba(255, 255, 255, 0.4);
      }

      .search-input {
        width: 100%;
        background: rgba(12, 6, 3, 0.85);
        border: 1px solid rgba(255, 95, 0, 0.3);
        border-radius: 2px;
        padding: 0.65rem 2.5rem 0.65rem 2.5rem;
        color: #ffffff;
        font-size: 0.85rem;
        outline: none;
        transition: border-color 0.2s ease;
      }

      .search-input:focus {
        border-color: #ff5f00;
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
        position: relative;
        padding: 0.45rem 0.85rem;
        background: rgba(30, 16, 9, 0.6);
        border: 1px solid rgba(255, 95, 0, 0.25);
        color: rgba(255, 255, 255, 0.75);
        font-size: 0.78rem;
        font-weight: 700;
        border-radius: 2px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
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

      .tab-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #ff5f00;
        color: #0b0704;
        font-size: 0.65rem;
        font-weight: 800;
        padding: 0.1rem 0.35rem;
        border-radius: 2px;
      }

      .filter-tab.is-active .tab-badge {
        background: #0b0704;
        color: #ff5f00;
      }

      /* Applications Table */
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

      .applications-table {
        width: 100%;
        min-width: 780px;
        border-collapse: collapse;
        text-align: left;
        font-size: 0.82rem;
      }

      .applications-table th {
        background: rgba(35, 18, 10, 0.95);
        padding: 0.85rem 1rem;
        font-size: 0.7rem;
        font-weight: 800;
        color: rgba(255, 255, 255, 0.65);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        border-bottom: 1px solid rgba(255, 95, 0, 0.35);
        white-space: nowrap;
      }

      .applications-table th.col-actions,
      .applications-table td.col-actions {
        position: sticky;
        right: 0;
        z-index: 5;
        background: #140b06;
        box-shadow: -6px 0 16px rgba(0, 0, 0, 0.45);
        white-space: nowrap;
        text-align: right;
      }

      .applications-table th.col-actions {
        background: #23120a;
        text-align: center;
      }

      .applications-table td {
        padding: 0.85rem 1rem;
        border-bottom: 1px solid rgba(255, 95, 0, 0.12);
        vertical-align: middle;
      }

      .applications-table tr:hover td {
        background: rgba(255, 95, 0, 0.04);
      }

      .applications-table tr:hover td.col-actions {
        background: #241309;
      }

      .badge-type {
        display: inline-block;
        padding: 0.2rem 0.5rem;
        font-size: 0.66rem;
        font-weight: 800;
        letter-spacing: 0.05em;
        border-radius: 2px;
        white-space: nowrap;
      }

      .badge-prestador {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: rgba(255, 255, 255, 0.75);
      }

      .badge-fundador {
        background: rgba(128, 179, 255, 0.14);
        border: 1px solid rgba(128, 179, 255, 0.4);
        color: #80b3ff;
      }

      .postulante-cell {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .postulante-name {
        color: #ffffff;
        font-size: 0.88rem;
        font-weight: 700;
      }

      .postulante-email {
        color: rgba(255, 255, 255, 0.65);
        font-family: var(--font-mono, monospace);
        font-size: 0.78rem;
      }

      .contact-whatsapp,
      .contact-whatsapp:visited {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        color: rgba(255, 255, 255, 0.55);
        text-decoration: none;
        font-size: 0.75rem;
        font-family: var(--font-mono, monospace);
      }

      .contact-whatsapp:hover {
        color: rgba(255, 255, 255, 0.85);
        text-decoration: underline;
      }

      .detail-cell {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        max-width: 320px;
      }

      .rubro-title {
        color: #ffffff;
        font-size: 0.82rem;
      }

      .rubro-sub {
        color: rgba(255, 255, 255, 0.55);
        font-size: 0.75rem;
      }

      .rubro-link,
      .rubro-link:visited {
        color: rgba(255, 255, 255, 0.55);
        font-size: 0.72rem;
        text-decoration: none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .rubro-link:hover {
        color: rgba(255, 255, 255, 0.85);
        text-decoration: underline;
      }

      .rubro-snippet {
        color: rgba(255, 255, 255, 0.55);
        font-size: 0.74rem;
        line-height: 1.35;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .price-cell {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }

      .amount-val {
        color: #ffffff;
        font-size: 0.88rem;
        font-weight: 700;
      }

      .usd-val {
        color: rgba(255, 255, 255, 0.55);
        font-size: 0.74rem;
        font-weight: 600;
      }

      .status-badge {
        display: inline-block;
        padding: 0.2rem 0.55rem;
        font-size: 0.68rem;
        font-weight: 700;
        border-radius: 2px;
        white-space: nowrap;
      }

      .status-badge[data-status='pendiente'] {
        background: rgba(255, 95, 0, 0.15);
        border: 1px solid rgba(255, 95, 0, 0.45);
        color: #ff5f00;
      }

      .status-badge[data-status='aprobado'] {
        background: rgba(16, 185, 129, 0.2);
        border: 1px solid rgba(16, 185, 129, 0.45);
        color: #34d399;
      }

      .status-badge[data-status='rechazado'] {
        background: rgba(239, 68, 68, 0.2);
        border: 1px solid rgba(239, 68, 68, 0.45);
        color: #fca5a5;
      }

      .date-text {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.6);
        white-space: nowrap;
      }

      .btn-view {
        padding: 0.35rem 0.75rem;
        background: rgba(255, 95, 0, 0.15);
        border: 1px solid rgba(255, 95, 0, 0.4);
        color: #ffffff;
        font-size: 0.75rem;
        font-weight: 700;
        border-radius: 2px;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }

      .btn-view:hover {
        background: #ff5f00;
        color: #0b0704;
      }

      .exp-cell-wrap {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .exp-cell-thumb {
        width: 44px;
        height: 44px;
        border-radius: 2px;
        object-fit: cover;
        border: 1px solid rgba(255, 255, 255, 0.15);
        flex-shrink: 0;
      }

      .exp-cell-text {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }

      .exp-title-cell {
        color: #ffffff;
        font-size: 0.86rem;
        font-weight: 700;
      }

      .exp-kicker-sub {
        font-size: 0.68rem;
        color: rgba(255, 255, 255, 0.55);
        letter-spacing: 0.04em;
        text-transform: uppercase;
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

      /* Modal */
      .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(4, 2, 1, 0.65);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1.5rem;
      }

      .modal-dialog {
        background: rgba(18, 9, 4, 0.78);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 4px;
        width: 600px;
        max-width: 95vw;
        max-height: 90vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85);
      }

      .exp-req-modal-card {
        width: 800px;
        max-width: 95vw;
      }

      .modal-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 1.25rem 1.5rem 0.6rem;
        border-bottom: none;
        background: transparent;
      }

      .modal-kicker {
        font-size: 0.68rem;
        font-weight: 800;
        color: #ff5f00;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .modal-title {
        color: #ffffff;
        font-size: 1.35rem;
        margin: 0.2rem 0 0;
      }

      .modal-sub-author {
        font-size: 0.82rem;
        color: rgba(255, 255, 255, 0.7);
        margin: 0.3rem 0 0 0;
      }

      .modal-close-btn {
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.6);
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0 0.35rem;
      }

      .modal-close-btn:hover {
        color: #ffffff;
      }

      .modal-body {
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1.15rem;
      }

      .exp-req-media-banner {
        position: relative;
        width: 100%;
        height: 240px;
        border-radius: 3px;
        overflow: hidden;
        background: #080402;
        border: 1px solid rgba(255, 95, 0, 0.25);
        margin-bottom: 0.25rem;
      }

      .exp-req-cover-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .exp-req-media-tags {
        position: absolute;
        bottom: 0.75rem;
        left: 0.75rem;
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .exp-media-tag {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.25rem 0.65rem;
        background: rgba(10, 5, 2, 0.88);
        backdrop-filter: blur(6px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        color: #ffffff;
        font-size: 0.74rem;
        font-weight: 600;
      }

      .exp-media-tag mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: rgba(255, 255, 255, 0.65);
      }

      .exp-req-specs-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap: 0.75rem;
      }

      .spec-cell {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0.75rem 0.85rem;
        background: rgba(20, 10, 5, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 2px;
        font-size: 0.8rem;
      }

      .spec-lbl {
        font-size: 0.68rem;
        color: rgba(255, 255, 255, 0.55);
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 0.05em;
      }

      /* Tarifa Card Premium */
      .exp-tariff-card {
        background: rgba(24, 12, 6, 0.6);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 95, 0, 0.35);
        padding: 1.15rem 1.35rem;
        border-radius: 3px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1.5rem;
        flex-wrap: wrap;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
      }

      .tariff-main-col {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .tariff-kicker {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.55);
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 0.08em;
      }

      .tariff-figures {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        flex-wrap: wrap;
      }

      .tariff-ars {
        font-size: 1.95rem;
        color: #34d399;
        font-weight: 800;
        letter-spacing: -0.02em;
        line-height: 1;
      }

      .tariff-usd-pill {
        display: inline-flex;
        align-items: center;
        padding: 0.3rem 0.65rem;
        background: rgba(255, 255, 255, 0.07);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 999px;
        color: rgba(255, 255, 255, 0.8);
        font-size: 0.78rem;
        font-weight: 600;
        line-height: 1;
        font-family: var(--font-mono, monospace);
      }

      .tariff-capacity-col {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding-left: 1.5rem;
        border-left: 1px solid rgba(255, 95, 0, 0.25);
      }

      @media (max-width: 650px) {
        .tariff-capacity-col {
          padding-left: 0;
          border-left: none;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(255, 95, 0, 0.25);
          width: 100%;
        }
      }

      .tariff-cap-lbl {
        font-size: 0.68rem;
        color: rgba(255, 255, 255, 0.55);
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 0.08em;
      }

      .tariff-cap-val {
        color: #ffffff;
        font-size: 0.95rem;
        font-weight: 700;
      }

      .quote-accent {
        border-left: 3px solid #ff5f00;
      }

      .promo-accent {
        background: rgba(255, 95, 0, 0.08);
        border: 1px dashed rgba(255, 95, 0, 0.45);
      }

      .btn-whatsapp,
      .btn-contact-provider {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        background: #80b3ff;
        border: 1px solid #80b3ff;
        color: #070d18;
        font-weight: 800;
        font-size: 0.85rem;
        padding: 0.65rem 1.35rem;
        border-radius: 2px;
        text-decoration: none;
        cursor: pointer;
        transition:
          background 0.2s ease,
          transform 0.15s ease;
      }

      .btn-whatsapp:hover,
      .btn-contact-provider:hover {
        background: #99c2ff;
        border-color: #99c2ff;
        color: #070d18;
        transform: translateY(-1px);
      }

      .app-desc-box {
        padding: 0.85rem 1rem;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 2px;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .desc-heading {
        font-size: 0.72rem;
        text-transform: uppercase;
        font-weight: 800;
        letter-spacing: 0.08em;
        color: rgba(255, 255, 255, 0.5);
      }

      .desc-content {
        margin: 0;
        font-size: 0.82rem;
        color: rgba(255, 255, 255, 0.9);
        white-space: pre-wrap;
        line-height: 1.45;
      }

      .modal-dl {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.65rem;
        font-size: 0.78rem;
        margin: 0;
      }

      .modal-dl dt {
        color: rgba(255, 255, 255, 0.5);
      }
      .modal-dl dd {
        color: #ffffff;
        margin: 0;
      }

      .detail-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1.15rem;
      }

      @media (max-width: 600px) {
        .detail-grid {
          grid-template-columns: 1fr;
        }

        .modal-backdrop {
          padding: 0.5rem;
        }

        .modal-dialog,
        .exp-req-modal-card {
          width: 100%;
          max-width: 100%;
          max-height: 94vh;
        }

        .modal-head {
          padding: 1rem;
        }

        .modal-title {
          font-size: 1.15rem;
        }

        .modal-body {
          padding: 1rem;
          gap: 0.85rem;
        }

        .exp-req-specs-grid {
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
        }

        .exp-tariff-card {
          padding: 1rem;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.75rem;
        }

        .tariff-figures {
          gap: 0.5rem;
        }

        .tariff-ars {
          font-size: 1.55rem;
        }

        .modal-actions {
          padding: 0.85rem 1rem;
          flex-direction: column;
          gap: 0.5rem;
          align-items: stretch;
        }

        .modal-actions .state-buttons {
          width: 100%;
        }

        .modal-actions .btn-state,
        .modal-actions .btn-close {
          width: 100%;
          justify-content: center;
          text-align: center;
          box-sizing: border-box;
        }
      }

      .detail-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .detail-item.full-span {
        grid-column: 1 / -1;
      }

      .dt-label {
        font-size: 0.7rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.55);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .dt-value {
        color: #ffffff;
        font-size: 0.9rem;
      }

      .dt-sub {
        color: rgba(255, 255, 255, 0.6);
        font-size: 0.8rem;
      }

      .dt-link {
        color: #ff8533;
        font-size: 0.85rem;
        text-decoration: none;
        word-break: break-all;
      }

      .dt-link:hover {
        text-decoration: underline;
      }

      .dt-text-box {
        background: rgba(18, 10, 5, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 4px;
        padding: 0.85rem 1rem;
        color: rgba(255, 255, 255, 0.85);
        font-size: 0.84rem;
        line-height: 1.55;
        margin: 0;
        white-space: pre-wrap;
      }

      .modal-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.15rem 1.5rem;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(12, 6, 3, 0.65);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .state-buttons {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .btn-state {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 34px;
        padding: 0 1rem;
        font-size: 0.76rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        border-radius: 3px;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }

      .btn-approve {
        background: rgba(0, 204, 136, 0.16) !important;
        border: 1px solid rgba(0, 204, 136, 0.45) !important;
        color: #33ffaa !important;
        font-weight: 700 !important;
      }

      .btn-approve:hover:not(:disabled) {
        background: #00cc88 !important;
        border-color: #00cc88 !important;
        color: #0b0704 !important;
      }

      .btn-reject {
        background: rgba(255, 80, 80, 0.12) !important;
        border: 1px solid rgba(255, 80, 80, 0.38) !important;
        color: #ff8080 !important;
        font-weight: 700 !important;
      }

      .btn-reject:hover:not(:disabled) {
        background: rgba(255, 80, 80, 0.25) !important;
        border-color: #ff8080 !important;
        color: #ffffff !important;
      }

      .exp-album-review-box {
        padding: 0.85rem 1rem;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 2px;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .exp-album-thumbnails-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
        gap: 0.75rem;
      }

      .album-thumb-card {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        background: rgba(255, 255, 255, 0.04);
        padding: 0.35rem;
        border-radius: 2px;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .album-thumb-img {
        width: 100%;
        height: 75px;
        object-fit: cover;
        border-radius: 2px;
      }

      .album-thumb-caption {
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.7);
        line-height: 1.2;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .exp-provider-banking-card {
        padding: 0.85rem 1rem;
        background: rgba(22, 33, 85, 0.3);
        border: 1px solid rgba(128, 179, 255, 0.2);
        border-radius: 2px;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .provider-banking-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 0.75rem;
      }

      .banking-cell {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .banking-lbl {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #80b3ff;
      }

      .banking-cell strong {
        font-size: 0.85rem;
        color: #ffffff;
        word-break: break-all;
      }

      .exp-public-url-box {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        padding: 0.85rem 1rem;
        background: rgba(22, 33, 85, 0.4);
        border: 1px solid rgba(128, 179, 255, 0.25);
        border-radius: 2px;
        margin-top: 1rem;
      }
      .url-label {
        font-size: 0.76rem;
        font-weight: 700;
        color: #80b3ff;
      }
      .url-input {
        width: 100%;
        background: rgba(7, 13, 28, 0.7);
        border: 1px solid rgba(128, 179, 255, 0.35);
        border-radius: 2px;
        padding: 0.45rem 0.65rem;
        color: #ffffff;
        font-size: 0.82rem;
      }
      .url-input:focus {
        outline: none;
        border-color: #80b3ff;
      }

      .status-reviewed-tag {
        display: inline-flex;
        align-items: center;
        padding: 0.45rem 0.85rem;
        font-size: 0.78rem;
        font-weight: 700;
        border-radius: 2px;
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #fca5a5;
      }
      .status-reviewed-tag.is-approved {
        background: rgba(16, 185, 129, 0.15);
        border-color: rgba(16, 185, 129, 0.4);
        color: #34d399;
      }

      .btn-pending {
        background: rgba(245, 158, 11, 0.2);
        border: 1px solid rgba(245, 158, 11, 0.6);
        color: #fbbf24;
      }

      .btn-pending:hover:not(:disabled) {
        background: #f59e0b;
        color: #0b0704;
      }

      .btn-resend {
        background: rgba(128, 179, 255, 0.15);
        border: 1px solid rgba(128, 179, 255, 0.5);
        color: #80b3ff;
      }
      .btn-resend:hover:not(:disabled) {
        background: #80b3ff;
        color: #050a14;
      }

      .email-status-banner {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.65rem 0.95rem;
        border-radius: 4px;
        font-size: 0.82rem;
        font-weight: 600;
        width: 100%;
        box-sizing: border-box;
      }
      .email-status-banner mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
      .email-status-banner.is-success {
        background: rgba(16, 185, 129, 0.15);
        border: 1px solid rgba(16, 185, 129, 0.4);
        color: #6ee7b7;
      }
      .email-status-banner.is-error {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #fca5a5;
      }

      .btn-spin {
        animation: spin 1s linear infinite;
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .btn-state:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn-save-banking {
        background: rgba(128, 179, 255, 0.2);
        border: 1px solid rgba(128, 179, 255, 0.6);
        color: #80b3ff;
      }
      .btn-save-banking:hover:not(:disabled) {
        background: #80b3ff;
        color: #070d18;
      }

      .provider-banking-card {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1rem 1.15rem;
        background: rgba(18, 10, 5, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 4px;
        margin-top: 0.5rem;
      }

      .banking-card-title {
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #ff9955;
        margin: 0;
      }

      .banking-display-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.85rem;
        margin-top: 0.35rem;
      }

      @media (max-width: 600px) {
        .banking-display-grid {
          grid-template-columns: 1fr;
        }
      }

      .banking-display-item {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .banking-item-lbl {
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: rgba(255, 255, 255, 0.55);
        font-weight: 700;
      }

      .banking-item-val {
        font-size: 0.88rem;
        color: #ffffff;
        font-weight: 600;
        word-break: break-all;
      }



      .state-buttons .btn-state {
        height: 34px !important;
        box-sizing: border-box !important;
      }

      .btn-close {
        flex: 0 0 auto !important;
        align-self: center !important;
        height: 34px !important;
        max-height: 34px !important;
        padding: 0 1.25rem !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: rgba(255, 255, 255, 0.08) !important;
        border: 1px solid rgba(255, 255, 255, 0.25) !important;
        color: #ffffff !important;
        font-size: 0.82rem !important;
        font-weight: 700 !important;
        border-radius: 3px !important;
        cursor: pointer !important;
        white-space: nowrap !important;
        box-sizing: border-box !important;
      }

      .btn-close:hover {
        background: rgba(255, 255, 255, 0.16) !important;
        border-color: #ffffff !important;
      }
    `,
  ],
})
export class AdminApplicationsComponent implements OnInit {
  readonly store = inject(AdminStoreService);
  readonly experienceService = inject(ExperienceService);
  readonly notificationService = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly searchQuery = signal<string>('');
  readonly activeTab = signal<ApplicationFilterTab>('todas');
  readonly selectedApp = signal<AdminApplication | null>(null);
  readonly isSendingWelcomeEmail = signal<boolean>(false);
  readonly welcomeEmailStatus = signal<{ success: boolean; message: string } | null>(null);

  readonly providerAccountHolder = signal<string>('');
  readonly providerCuitDni = signal<string>('');
  readonly providerCbuAlias = signal<string>('');
  readonly providerBankName = signal<string>('');

  readonly pendingExperienceCount = computed(
    () => this.experienceService.experiences().filter((e) => e.status === 'pendiente').length,
  );

  ngOnInit(): void {
    this.store.providerStore.reloadFromStorage();
    void this.store.providerStore.loadProposalsFromSupabase();
    void this.store.loadAllApplications();
    void this.experienceService.reloadFromSupabase();
    this.route.queryParams.subscribe((params) => {
      if (params['tab'] === 'experiencias') {
        void this.router.navigate(['experiencias'], {
          relativeTo: this.route.parent,
          queryParams: { tab: 'postulaciones' },
          replaceUrl: true,
        });
      }
    });
  }

  navigateToExperiencesProposals(): void {
    void this.router.navigate(['experiencias'], {
      relativeTo: this.route.parent,
      queryParams: { tab: 'postulaciones' },
    });
  }

  readonly filteredApplications = computed(() => {
    let list = this.store.applications();
    const query = this.searchQuery().trim().toLowerCase();
    const tab = this.activeTab();

    // Filtro por pestaña
    if (tab === 'prestadores') {
      list = list.filter((a) => a.type === 'prestador');
    } else if (tab === 'fundadores') {
      list = list.filter((a) => a.type === 'fundador');
    } else if (tab === 'pendientes') {
      list = list.filter((a) => a.status === 'pendiente');
    } else if (tab === 'aprobadas') {
      list = list.filter((a) => a.status === 'aprobado');
    } else if (tab === 'bajas') {
      list = list.filter((a) => a.status === 'dado_de_baja');
    }

    // Filtro por búsqueda
    if (query) {
      list = list.filter((a) => {
        const nameMatch = a.fullName.toLowerCase().includes(query);
        const emailMatch = a.email.toLowerCase().includes(query);
        const phoneMatch = a.phone.includes(query);
        const catMatch = a.category ? a.category.toLowerCase().includes(query) : false;
        const regMatch = a.region ? a.region.toLowerCase().includes(query) : false;
        return nameMatch || emailMatch || phoneMatch || catMatch || regMatch;
      });
    }

    return list;
  });

  refresh(): void {
    this.store.providerStore.reloadFromStorage();
    void this.store.providerStore.loadProposalsFromSupabase();
    void this.store.loadAllApplications();
    void this.experienceService.reloadFromSupabase();
  }

  openDetailModal(app: AdminApplication): void {
    this.selectedApp.set(app);
    this.welcomeEmailStatus.set(null);
    this.providerAccountHolder.set(app.accountHolder || app.fullName || '');
    this.providerCuitDni.set(app.cuitDni || '');
    this.providerCbuAlias.set(app.cbuAlias || '');
    this.providerBankName.set(app.bankName || '');
  }

  closeDetailModal(): void {
    this.selectedApp.set(null);
    this.welcomeEmailStatus.set(null);
  }

  async resendWelcomeEmail(): Promise<void> {
    const current = this.selectedApp();
    if (!current?.email) return;
    this.isSendingWelcomeEmail.set(true);
    this.welcomeEmailStatus.set(null);
    try {
      const res = await this.notificationService.notifyProviderApproved({
        fullName: current.fullName || '',
        email: current.email,
      });
      if (res.success) {
        this.welcomeEmailStatus.set({
          success: true,
          message: `¡Correo de bienvenida enviado exitosamente a ${current.email}!`,
        });
      } else {
        this.welcomeEmailStatus.set({
          success: false,
          message: `No se pudo enviar el correo: ${res.error || 'Verifique la conexión o configuración de Resend en el servidor.'}`,
        });
      }
    } catch (err: any) {
      this.welcomeEmailStatus.set({
        success: false,
        message: `Error al enviar correo: ${err?.message || err}`,
      });
    } finally {
      this.isSendingWelcomeEmail.set(false);
    }
  }

  async approveProvider(): Promise<void> {
    const current = this.selectedApp();
    if (!current) return;
    const ok = await this.store.updateApplicationStatus(
      current.id,
      current.type,
      'aprobado',
    );
    if (ok) {
      this.selectedApp.update((a) => (a ? { ...a, status: 'aprobado' } : null));
      void this.resendWelcomeEmail();
    }
  }

  async darDeBajaProvider(): Promise<void> {
    const current = this.selectedApp();
    if (!current) return;
    const ok = await this.store.updateApplicationStatus(
      current.id,
      current.type,
      'dado_de_baja',
    );
    if (ok) {
      this.selectedApp.update((a) => (a ? { ...a, status: 'dado_de_baja' } : null));
    }
  }

  async saveProviderBankingData(): Promise<void> {
    const current = this.selectedApp();
    if (!current) return;
    const banking = {
      accountHolder: this.providerAccountHolder().trim() || current.fullName,
      cuitDni: this.providerCuitDni().trim(),
      cbuAlias: this.providerCbuAlias().trim(),
      bankName: this.providerBankName().trim(),
    };
    const ok = await this.store.updateApplicationStatus(
      current.id,
      current.type,
      current.status,
      banking,
    );
    if (ok) {
      this.selectedApp.update((a) => (a ? { ...a, ...banking } : null));
    }
  }

  async changeStatus(status: ApplicationStatus): Promise<void> {
    const current = this.selectedApp();
    if (!current) return;
    const banking =
      current.type === 'prestador'
        ? {
            accountHolder: this.providerAccountHolder().trim() || current.fullName,
            cuitDni: this.providerCuitDni().trim(),
            cbuAlias: this.providerCbuAlias().trim(),
            bankName: this.providerBankName().trim(),
          }
        : undefined;
    const ok = await this.store.updateApplicationStatus(current.id, current.type, status, banking);
    if (ok) {
      this.selectedApp.update((a) => (a ? { ...a, status, ...(banking || {}) } : null));
    }
  }

  hasPhoneDigits(phone?: string | null): boolean {
    return Boolean(phone && phone.replace(/\D/g, '').length > 0);
  }

  getWhatsappLink(phone?: string, name?: string): string {
    const cleanDigits = (phone || '').replace(/\D/g, '');
    const cleanName = encodeURIComponent(name || 'Postulante');
    return `https://wa.me/${cleanDigits}?text=Hola%20${cleanName},%20nos%20comunicamos%20desde%20la%20administraci%C3%B3n%20de%20EXPERIENCIAS.CLUB%20respecto%20a%20tu%20propuesta`;
  }

  formatCategory(category?: string): string {
    switch (category) {
      case 'guia_montaña':
        return 'Guía de Montaña';
      case 'kayak_nautica':
        return 'Kayak & Náutica';
      case 'transporte_4x4':
        return 'Transporte & Travesías 4x4';
      case 'alojamiento':
        return 'Alojamiento & Hostería';
      case 'gastronomia':
        return 'Gastronomía Regional';
      case 'fotografia':
        return 'Fotografía & Expedición';
      case 'cabalgatas':
        return 'Cabalgatas';
      case 'arqueologia':
        return 'Arqueología & Patrimonio';
      case 'artesanias':
        return 'Artesanías & Cultura';
      default:
        return category ? category.replace(/_/g, ' ') : 'Servicios Turísticos';
    }
  }

  getSnippet(text?: string): string {
    if (!text) return 'Sin detalle';
    return text.length > 90 ? text.slice(0, 90) + '...' : text;
  }

  downloadRoster(): void {
    const list = this.store.applications();
    const headers = [
      'Tipo',
      'Nombre y Apellido',
      'Email',
      'Teléfono',
      'Rubro / Categoría',
      'Región',
      'Sitio Web',
      'Estado',
      'Fecha Postulación',
      'Detalle / Carta',
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
      ...list.map((a) =>
        [
          escapeCsv(a.type === 'prestador' ? 'Prestador' : 'Socio Fundador'),
          escapeCsv(a.fullName),
          escapeCsv(a.email),
          escapeCsv(a.phone),
          escapeCsv(
            a.type === 'prestador' ? this.formatCategory(a.category) : 'Cuadro Fundacional',
          ),
          escapeCsv(a.region || 'Catamarca'),
          escapeCsv(a.website || ''),
          escapeCsv(a.status.toUpperCase()),
          escapeCsv(new Date(a.createdAt).toLocaleDateString('es-AR')),
          escapeCsv(a.type === 'prestador' ? a.description || '' : a.motivationLetter || ''),
        ].join(','),
      ),
    ];
    const blob = new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `postulaciones_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
