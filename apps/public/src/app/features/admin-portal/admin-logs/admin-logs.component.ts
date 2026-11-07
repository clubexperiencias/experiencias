import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AdminStoreService } from '../../../core/services/admin-store.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { FechaPipe } from '../../../shared/pipes/format.pipes';

export type LogFilterTab = 'todos' | 'admins' | 'prestadores';

export interface AdminAuditLog {
  id: string;
  actorType: 'admin' | 'prestador' | 'socio';
  actorName: string;
  actorEmail?: string;
  actionTitle: string;
  actionDescription: string;
  targetType: 'experiencia' | 'propuesta' | 'postulacion' | 'comprobante' | 'prestador';
  targetLabel?: string;
  targetLink?: string;
  badgeType: 'aprobado' | 'pendiente' | 'rechazado' | 'info' | 'edicion';
  timestamp: string;
}

@Component({
  selector: 'app-admin-logs',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatIconModule, FechaPipe],
  template: `
    <div class="logs-container">
      <!-- Encabezado -->
      <div class="view-header">
        <div>
          <span class="section-kicker">AUDITORÍA & HISTORIAL DEL SISTEMA</span>
          <h1 class="card-heading">Registro de Actividad y Logs</h1>
          <p class="card-subheading">
            Trazabilidad consolidada de las operaciones y movimientos más relevantes realizados por el equipo de administración y los prestadores oficiales.
          </p>
        </div>
      </div>

      <!-- Tarjetas de Métricas -->
      <div class="summary-strip">
        <div class="summary-item">
          <span class="sum-label">Total Operaciones</span>
          <strong class="sum-value">{{ allLogs().length }}</strong>
          <span class="sum-sub">Registros indexados</span>
        </div>
        <div class="summary-item">
          <span class="sum-label">Acciones de Admin</span>
          <strong class="sum-value text-orange">{{ adminLogsCount() }}</strong>
          <span class="sum-sub">Aprobaciones y cambios</span>
        </div>
        <div class="summary-item">
          <span class="sum-label">Actividad Prestadores</span>
          <strong class="sum-value text-blue">{{ providerLogsCount() }}</strong>
          <span class="sum-sub">Propuestas y solicitudes</span>
        </div>
        <div class="summary-item">
          <span class="sum-label">Propuestas y Rutas</span>
          <strong class="sum-value">{{ proposalsCount() }}</strong>
          <span class="sum-sub">Nuevas experiencias</span>
        </div>
        <div class="summary-item">
          <span class="sum-label">Comprobantes & Pagos</span>
          <strong class="sum-value">{{ receiptsCount() }}</strong>
          <span class="sum-sub">Auditoría de ingresos</span>
        </div>
      </div>

      <!-- Barra de Filtros & Búsqueda -->
      <div class="filters-bar">
        <div class="search-box">
          <mat-icon class="search-icon">search</mat-icon>
          <input
            type="text"
            class="search-input"
            placeholder="Buscar por usuario, acción, detalle o experiencia..."
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
            (click)="selectTab('todos')"
          >
            Todas las Acciones ({{ allLogs().length }})
          </button>
          <button
            type="button"
            class="filter-tab"
            [class.is-active]="activeTab() === 'admins'"
            (click)="selectTab('admins')"
          >
            Solo Administradores ({{ adminLogsCount() }})
          </button>
          <button
            type="button"
            class="filter-tab"
            [class.is-active]="activeTab() === 'prestadores'"
            (click)="selectTab('prestadores')"
          >
            Solo Prestadores ({{ providerLogsCount() }})
          </button>
        </div>
      </div>

      <!-- Tabla de Logs de Auditoría -->
      @if (filteredLogs().length === 0) {
        <div class="empty-box">
          <mat-icon>manage_search</mat-icon>
          <h3>No se registraron movimientos</h3>
          <p>Probá cambiando la búsqueda o seleccionando otra categoría.</p>
        </div>
      } @else {
        <div class="table-card">
          <div class="table-responsive">
            <table class="logs-table">
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Operador / Rol</th>
                  <th>Acción Realizada</th>
                  <th>Detalle & Objeto</th>
                  <th>Tipo / Categoría</th>
                  <th class="text-right">Enlace Directo</th>
                </tr>
              </thead>
              <tbody>
                @for (log of filteredLogs(); track log.id) {
                  <tr>
                    <!-- Fecha y Hora -->
                    <td class="font-mono time-cell">
                      <span class="log-date">{{ (log.timestamp | fecha: 'hora') || '—' }}</span>
                    </td>

                    <!-- Operador / Rol -->
                    <td>
                      <div class="actor-cell">
                        <span
                          class="actor-badge"
                          [class.is-admin]="log.actorType === 'admin'"
                          [class.is-provider]="log.actorType === 'prestador'"
                          [class.is-member]="log.actorType === 'socio'"
                        >
                          {{ log.actorType === 'admin' ? 'ADMIN' : log.actorType === 'prestador' ? 'PRESTADOR' : 'SOCIO' }}
                        </span>
                        <div class="actor-info">
                          <strong class="actor-name">{{ log.actorName }}</strong>
                          @if (log.actorEmail) {
                            <span class="actor-email font-mono">{{ log.actorEmail }}</span>
                          }
                        </div>
                      </div>
                    </td>

                    <!-- Acción -->
                    <td>
                      <div class="action-cell">
                        <strong class="action-title">{{ log.actionTitle }}</strong>
                        <span class="badge-status-pill" [attr.data-badge]="log.badgeType">
                          {{ formatBadge(log.badgeType) }}
                        </span>
                      </div>
                    </td>

                    <!-- Detalle -->
                    <td>
                      <div class="detail-cell">
                        <span class="detail-desc">{{ log.actionDescription }}</span>
                        @if (log.targetLabel) {
                          <span class="detail-target">Ref: {{ log.targetLabel }}</span>
                        }
                      </div>
                    </td>

                    <!-- Categoría -->
                    <td>
                      <span class="target-type-chip" [attr.data-type]="log.targetType">
                        {{ formatTargetType(log.targetType) }}
                      </span>
                    </td>

                    <!-- Enlace directo -->
                    <td class="text-right">
                      @if (log.targetLink) {
                        <a [routerLink]="resolveAdminLink(log.targetLink)" class="btn-goto-link" title="Ir al registro">
                          <span>Ver</span>
                          <mat-icon class="link-icon">arrow_forward</mat-icon>
                        </a>
                      } @else {
                        <span class="text-muted">—</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
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

      .logs-container {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .view-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1.5rem;
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

      .filter-tabs {
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

      .logs-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.82rem;
      }

      .logs-table th {
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

      .logs-table td {
        padding: 0.85rem 1rem;
        border-bottom: 1px solid rgba(255, 95, 0, 0.15);
        color: rgba(255, 255, 255, 0.85);
        vertical-align: middle;
      }

      .logs-table tr:hover td {
        background: rgba(255, 95, 0, 0.04);
      }

      .text-right {
        text-align: right !important;
      }

      .logs-table th.text-right,
      .logs-table td.text-right {
        position: sticky;
        right: 0;
        z-index: 5;
        background: #140b06;
        box-shadow: -6px 0 16px rgba(0, 0, 0, 0.45);
        white-space: nowrap;
        text-align: right !important;
      }

      .logs-table th.text-right {
        background: #23120a;
      }

      .logs-table tr:hover td.text-right {
        background: #241309;
      }

      .time-cell {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }

      .log-date {
        color: #ffffff;
        font-size: 0.78rem;
        font-weight: 700;
      }

      .log-hour {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.5);
      }

      .actor-cell {
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }

      .actor-badge {
        font-size: 0.62rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        padding: 0.2rem 0.45rem;
        border-radius: 2px;
        text-transform: uppercase;
      }

      .actor-badge.is-admin {
        background: rgba(255, 95, 0, 0.2);
        color: #ff9955;
        border: 1px solid rgba(255, 95, 0, 0.4);
      }

      .actor-badge.is-provider {
        background: rgba(56, 189, 248, 0.15);
        color: #38bdf8;
        border: 1px solid rgba(56, 189, 248, 0.35);
      }

      .actor-badge.is-member {
        background: rgba(148, 163, 184, 0.15);
        color: #cbd5e1;
        border: 1px solid rgba(148, 163, 184, 0.35);
      }

      .actor-info {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }

      .actor-name {
        color: #ffffff;
        font-size: 0.85rem;
      }

      .actor-email {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.5);
      }

      .action-cell {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }

      .action-title {
        color: #ffffff;
        font-size: 0.85rem;
      }

      .badge-status-pill {
        display: inline-flex;
        align-self: flex-start;
        font-size: 0.62rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 0.15rem 0.4rem;
        border-radius: 2px;
      }

      .badge-status-pill[data-badge='aprobado'] {
        background: rgba(52, 211, 153, 0.15);
        color: #34d399;
        border: 1px solid rgba(52, 211, 153, 0.35);
      }

      .badge-status-pill[data-badge='pendiente'] {
        background: rgba(251, 191, 36, 0.15);
        color: #fbbf24;
        border: 1px solid rgba(251, 191, 36, 0.35);
      }

      .badge-status-pill[data-badge='rechazado'] {
        background: rgba(248, 113, 113, 0.15);
        color: #f87171;
        border: 1px solid rgba(248, 113, 113, 0.35);
      }

      .badge-status-pill[data-badge='edicion'] {
        background: rgba(129, 140, 248, 0.15);
        color: #a5b4fc;
        border: 1px solid rgba(129, 140, 248, 0.35);
      }

      .badge-status-pill[data-badge='info'] {
        background: rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.75);
        border: 1px solid rgba(255, 255, 255, 0.15);
      }

      .detail-cell {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        max-width: 320px;
      }

      .detail-desc {
        color: rgba(255, 255, 255, 0.85);
        font-size: 0.8rem;
        line-height: 1.4;
      }

      .detail-target {
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.45);
      }

      .target-type-chip {
        display: inline-block;
        font-size: 0.68rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.7);
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.12);
        padding: 0.2rem 0.5rem;
        border-radius: 2px;
        text-transform: uppercase;
      }

      .btn-goto-link {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.35rem 0.65rem;
        background: rgba(255, 95, 0, 0.12);
        border: 1px solid rgba(255, 95, 0, 0.35);
        color: #ff9955;
        font-size: 0.74rem;
        font-weight: 700;
        text-decoration: none;
        border-radius: 2px;
        transition: all 0.2s ease;
      }
      .btn-goto-link:hover {
        background: #ff5f00;
        color: #ffffff;
        border-color: #ff5f00;
      }

      .link-icon {
        font-size: 13px;
        width: 13px;
        height: 13px;
      }

      .text-muted {
        color: rgba(255, 255, 255, 0.3);
      }

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
    `,
  ],
})
export class AdminLogsComponent {
  private readonly adminStore = inject(AdminStoreService);
  private readonly experienceService = inject(ExperienceService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly searchQuery = signal<string>('');
  readonly activeTab = signal<LogFilterTab>('todos');

  constructor() {
    const path = this.router.url.toLowerCase();
    if (path.includes('/logs/admins')) {
      this.activeTab.set('admins');
    } else if (path.includes('/logs/prestadores')) {
      this.activeTab.set('prestadores');
    }
  }

  selectTab(tab: LogFilterTab): void {
    this.activeTab.set(tab);
    const rawPath = this.router.url.split('?')[0].split('#')[0];
    const isSubdomainAdmin = rawPath.startsWith('/dashboard') || rawPath.startsWith('/logs');
    const base = isSubdomainAdmin ? '' : '/admin';

    if (tab === 'todos') {
      void this.router.navigateByUrl(`${base}/logs`);
    } else if (tab === 'admins') {
      void this.router.navigateByUrl(`${base}/logs/admins`);
    } else if (tab === 'prestadores') {
      void this.router.navigateByUrl(`${base}/logs/prestadores`);
    }
  }

  resolveAdminLink(path: string): string {
    const rawPath = this.router.url.split('?')[0].split('#')[0];
    const isSubdomainAdmin = rawPath.startsWith('/dashboard') || rawPath.startsWith('/logs');
    if (isSubdomainAdmin) {
      return path.startsWith('/admin/') ? path.replace('/admin', '') : path;
    }
    return path.startsWith('/admin') ? path : `/admin${path}`;
  }

  // Agrega todos los eventos relevantes de propuestas, postulaciones, comprobantes y experiencias
  readonly allLogs = computed<AdminAuditLog[]>(() => {
    const logs: AdminAuditLog[] = [];

    // 1. Propuestas de experiencias (en tabla experiencias)
    const requests = this.adminStore.experienceRequests();
    for (const r of requests) {
      // Evento de creación por parte del prestador
      logs.push({
        id: `prop-created-${r.id}`,
        actorType: 'prestador',
        actorName: r.providerName || r.providerAgency || 'Prestador',
        actorEmail: r.providerEmail,
        actionTitle: 'Propuesta de Experiencia Enviada',
        actionDescription: `Nueva propuesta "${r.title}" cargada para evaluación técnica.`,
        targetType: 'propuesta',
        targetLabel: r.title,
        targetLink: '/experiencias',
        badgeType: 'pendiente',
        timestamp: r.createdAt || '',
      });

      // Evento de moderación por parte de admin
      if (r.status === 'aprobada' && r.reviewedAt) {
        logs.push({
          id: `prop-approved-${r.id}`,
          actorType: 'admin',
          actorName: 'Administración Club',
          actionTitle: 'Propuesta Aprobada e Incorporada',
          actionDescription: `Se aprobó la propuesta "${r.title}" y se publicó en el catálogo.`,
          targetType: 'propuesta',
          targetLabel: r.title,
          targetLink: '/experiencias',
          badgeType: 'aprobado',
          timestamp: r.reviewedAt,
        });
      } else if (r.status === 'rechazada' && r.reviewedAt) {
        logs.push({
          id: `prop-rejected-${r.id}`,
          actorType: 'admin',
          actorName: 'Administración Club',
          actionTitle: 'Propuesta Rechazada',
          actionDescription: `Se desestimó la propuesta "${r.title}".`,
          targetType: 'propuesta',
          targetLabel: r.title,
          targetLink: '/experiencias',
          badgeType: 'rechazado',
          timestamp: r.reviewedAt,
        });
      }
    }

    // 2. Postulaciones de prestadores y socios fundadores
    const apps = this.adminStore.applications();
    for (const a of apps) {
      const isProviderApp = a.type === 'prestador';
      logs.push({
        id: `app-submitted-${a.id}`,
        actorType: isProviderApp ? 'prestador' : 'socio',
        actorName: a.fullName || (isProviderApp ? 'Postulante a Prestador' : 'Aspirante a Fundador'),
        actorEmail: a.email,
        actionTitle: isProviderApp ? 'Postulación a Prestador Oficial' : 'Postulación a Socio Fundador',
        actionDescription: isProviderApp
          ? `Solicitud de ingreso enviada en categoría ${a.category || 'Guía'}.`
          : 'Solicitud de membresía vitalicia enviada para evaluación.',
        targetType: isProviderApp ? 'prestador' : 'postulacion',
        targetLabel: a.fullName,
        targetLink: isProviderApp ? '/prestadores' : '/socios',
        badgeType: 'pendiente',
        timestamp: a.createdAt || '',
      });

      const appReviewedAt = (a as any).reviewedAt;
      if (a.status === 'aprobado' && appReviewedAt) {
        logs.push({
          id: `app-approved-${a.id}`,
          actorType: 'admin',
          actorName: 'Administración Club',
          actionTitle: isProviderApp ? 'Prestador Oficial Aprobado' : 'Socio Fundador Aprobado',
          actionDescription: isProviderApp
            ? `Se habilitó a ${a.fullName} como prestador oficial en la plataforma.`
            : `Se aprobó la membresía fundadora de ${a.fullName}.`,
          targetType: isProviderApp ? 'prestador' : 'postulacion',
          targetLabel: a.fullName,
          targetLink: isProviderApp ? '/prestadores' : '/socios',
          badgeType: 'aprobado',
          timestamp: appReviewedAt,
        });
      } else if (a.status === 'rechazado' && appReviewedAt) {
        logs.push({
          id: `app-rejected-${a.id}`,
          actorType: 'admin',
          actorName: 'Administración Club',
          actionTitle: isProviderApp ? 'Postulación de Prestador Rechazada' : 'Postulación Fundadora Rechazada',
          actionDescription: `Se desestimó la postulación de ${a.fullName}.`,
          targetType: isProviderApp ? 'prestador' : 'postulacion',
          targetLabel: a.fullName,
          targetLink: isProviderApp ? '/prestadores' : '/socios',
          badgeType: 'rechazado',
          timestamp: appReviewedAt,
        });
      }
    }

    // 3. Comprobantes de transferencia
    const submissions = this.adminStore.submissions();
    for (const s of submissions) {
      logs.push({
        id: `sub-sent-${s.id}`,
        actorType: 'socio',
        actorName: s.fullName || 'Comprador/Socio',
        actorEmail: s.email,
        actionTitle: 'Comprobante de Pago Subido',
        actionDescription: `Reserva por ${s.amountArs ? '$' + s.amountArs.toLocaleString('es-AR') : 'monto'} para "${s.experienceTitle}".`,
        targetType: 'comprobante',
        targetLabel: s.reference || s.id,
        targetLink: '/comprobantes',
        badgeType: 'pendiente',
        timestamp: s.submittedAt || '',
      });

      if (s.status === 'aprobado' && s.reviewedAt) {
        logs.push({
          id: `sub-approved-${s.id}`,
          actorType: 'admin',
          actorName: 'Administración Club',
          actionTitle: 'Transferencia Bancaria Aprobada',
          actionDescription: `Comprobante ${s.reference || s.id} verificado y conciliado.`,
          targetType: 'comprobante',
          targetLabel: s.reference || s.id,
          targetLink: '/comprobantes',
          badgeType: 'aprobado',
          timestamp: s.reviewedAt,
        });
      } else if (s.status === 'rechazado' && s.reviewedAt) {
        logs.push({
          id: `sub-rejected-${s.id}`,
          actorType: 'admin',
          actorName: 'Administración Club',
          actionTitle: 'Comprobante de Pago Rechazado',
          actionDescription: `No se pudo verificar la transferencia ${s.reference || s.id}.`,
          targetType: 'comprobante',
          targetLabel: s.reference || s.id,
          targetLink: '/comprobantes',
          badgeType: 'rechazado',
          timestamp: s.reviewedAt,
        });
      }
    }

    // 4. Experiencias en catálogo (edición / estado)
    const exps = this.experienceService.experiences();
    for (const e of exps) {
      if (e.status === 'publicada') {
        const time = (e as any).updatedAt || (e as any).createdAt || '';
        logs.push({
          id: `exp-pub-${e.id}`,
          actorType: 'admin',
          actorName: 'Administración Club',
          actionTitle: 'Experiencia Publicada en la Web',
          actionDescription: `Ruta "${e.title}" activa y disponible para reservas.`,
          targetType: 'experiencia',
          targetLabel: e.slug,
          targetLink: `/experiencias/${e.slug}`,
          badgeType: 'aprobado',
          timestamp: time,
        });
      }
    }

    // Ordenar de más reciente a más antiguo evaluando marcas de tiempo parsed
    return logs.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      const validA = isNaN(timeA) ? 0 : timeA;
      const validB = isNaN(timeB) ? 0 : timeB;
      return validB - validA;
    });
  });

  readonly adminLogsCount = computed(() => this.allLogs().filter((l) => l.actorType === 'admin').length);
  readonly providerLogsCount = computed(() => this.allLogs().filter((l) => l.actorType === 'prestador').length);
  readonly proposalsCount = computed(() => this.allLogs().filter((l) => l.targetType === 'propuesta').length);
  readonly receiptsCount = computed(() => this.allLogs().filter((l) => l.targetType === 'comprobante').length);

  readonly filteredLogs = computed(() => {
    let list = this.allLogs();
    const tab = this.activeTab();
    const query = this.searchQuery().trim().toLowerCase();

    if (tab === 'admins') {
      list = list.filter((l) => l.actorType === 'admin');
    } else if (tab === 'prestadores') {
      list = list.filter((l) => l.actorType === 'prestador');
    }

    if (query) {
      list = list.filter((l) => {
        return (
          l.actorName.toLowerCase().includes(query) ||
          (l.actorEmail && l.actorEmail.toLowerCase().includes(query)) ||
          l.actionTitle.toLowerCase().includes(query) ||
          l.actionDescription.toLowerCase().includes(query) ||
          (l.targetLabel && l.targetLabel.toLowerCase().includes(query))
        );
      });
    }

    return list;
  });

  formatHour(isoString: string): string {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '—';
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} hs`;
    } catch {
      return '—';
    }
  }

  formatBadge(type: string): string {
    switch (type) {
      case 'aprobado':
        return 'Completado';
      case 'pendiente':
        return 'Pendiente';
      case 'rechazado':
        return 'Rechazado';
      case 'edicion':
        return 'Modificado';
      default:
        return 'Info';
    }
  }

  formatTargetType(type: string): string {
    switch (type) {
      case 'experiencia':
        return 'Experiencia';
      case 'propuesta':
        return 'Propuesta';
      case 'postulacion':
        return 'Postulación';
      case 'comprobante':
        return 'Comprobante';
      case 'prestador':
        return 'Prestador';
      default:
        return type;
    }
  }
}

