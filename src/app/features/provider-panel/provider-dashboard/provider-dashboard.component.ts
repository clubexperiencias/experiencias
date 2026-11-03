import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProviderStoreService, ExperienceProposalRequest } from '../../../core/services/provider-store.service';
import { TransferSubmission } from '../../../core/models/bank-transfer.model';
import { ArsPipe, FechaPipe } from '../../../shared/pipes/format.pipes';
import { ProviderExperienceProposalModalComponent } from '../provider-experience-proposal-modal/provider-experience-proposal-modal.component';

@Component({
  selector: 'app-provider-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    MatIconModule,
    ArsPipe,
    FechaPipe,
    ProviderExperienceProposalModalComponent,
  ],
  template: `
    <div class="dash-container">
      <!-- Welcome & Agency Header -->
      <section class="welcome-card">
        <div class="welcome-main">
          <div class="avatar-ring">
            <img
              [src]="provider()?.avatar || '/assets/aistudio/patricio.jpg'"
              [alt]="provider()?.name || 'Patricio Facundo'"
              class="provider-avatar"
              referrerpolicy="no-referrer"
            />
          </div>
          <div class="welcome-text">
            <div class="welcome-tag">
              <span>PRESTADOR OFICIAL</span>
            </div>
            <h1 class="welcome-name">Hola, {{ provider()?.name || 'Patricio Facundo' }}</h1>
            <p class="welcome-agency">
              {{ provider()?.agency }}
            </p>
          </div>
        </div>
      </section>

      <!-- KPI Metrics Grid - Boxes rectangulares sobrias sin iconos -->
      <section class="metrics-grid">
        <!-- 1. Experiencias Activas -->
        <div class="metric-card">
          <div class="metric-content">
            <span class="metric-label">Experiencias Activas</span>
            <strong class="metric-value">{{ activeExperiences().length }}</strong>
            <span class="metric-hint">Publicadas en el catálogo oficial</span>
          </div>
        </div>

        <!-- 2. Socios Anotados Totales -->
        <div class="metric-card">
          <div class="metric-content">
            <span class="metric-label">Socios Anotados Totales</span>
            <strong class="metric-value">{{ stats().totalEnrolled }}</strong>
            <span class="metric-hint">Inscriptos en el histórico de experiencias</span>
          </div>
        </div>

        <!-- 3. Recaudación Total -->
        <div class="metric-card">
          <div class="metric-content">
            <span class="metric-label">Recaudación Total</span>
            <strong class="metric-value">{{
              stats().confirmedRevenue + stats().pendingRevenue | ars
            }}</strong>
            <span class="metric-hint">Confirmados + pendientes</span>
          </div>
        </div>

        <!-- 4. Próxima Salida -->
        <div class="metric-card">
          <div class="metric-content">
            <span class="metric-label">Próxima Salida</span>
            <strong class="metric-value">
              @if (nearestSlot(); as slot) {
                {{ slot.date | fecha }}
              } @else {
                —
              }
            </strong>
            <span class="metric-hint">
              @if (nearestSlot(); as slot) {
                {{ slot.experienceTitle }}
              } @else {
                Sin salidas programadas
              }
            </span>
          </div>
        </div>
      </section>

      <!-- Experiencias Activas - Box de ancho completo que ocupa las dos columnas -->
      <section class="dash-card full-width-card active-experiences-section">
        <div class="card-head">
          <h2 class="card-title">Experiencias Activas</h2>
          <a routerLink="../experiencias" class="view-all-link" title="Ver todas tus experiencias">
            <span>Ver todas tus experiencias</span>
          </a>
        </div>

        @if (activeExperiences().length === 0) {
          <div class="empty-active-box">
            <p class="empty-text">No tenés experiencias activas publicadas actualmente.</p>
          </div>
        } @else {
          <div class="active-experiences-list">
            @for (exp of activeExperiences(); track exp.id) {
              <div class="active-exp-row">
                <div class="active-exp-cover-wrap">
                  <img
                    [src]="exp.coverImage || '/assets/images/kayak-club-de-experiencias.jpg'"
                    [alt]="exp.title"
                    class="active-exp-cover"
                    referrerpolicy="no-referrer"
                  />
                  <span class="exp-live-pill">Activa</span>
                </div>

                <div class="active-exp-main">
                  <div class="active-exp-top-row">
                    @if (exp.region) {
                      <span class="exp-cat-tag">{{ exp.region }}</span>
                    }
                    <span class="exp-duration-tag"
                      >{{ exp.difficulty }} · {{ exp.durationLabel }}</span
                    >
                  </div>

                  <h3 class="active-exp-name">{{ exp.title }}</h3>
                  <p class="active-exp-desc">{{ exp.tagline }}</p>

                  <div class="active-exp-kpis">
                    <div class="kpi-mini-col">
                      <span class="kpi-mini-lbl">Precio por Socio</span>
                      <strong class="kpi-mini-val text-blue">{{ exp.priceArs | ars }}</strong>
                    </div>

                    <div class="kpi-mini-col">
                      <span class="kpi-mini-lbl">Capacidad por Salida</span>
                      <strong class="kpi-mini-val">{{ exp.capacityPerDate }} cupos</strong>
                    </div>

                    <div class="kpi-mini-col kpi-col-dates">
                      <div class="kpi-dates-head">
                        <span class="kpi-mini-lbl">Próximas Salidas</span>
                        <button
                          type="button"
                          class="btn-quick-add-date"
                          (click)="toggleAddDate(exp.id); $event.stopPropagation()"
                          title="Agregar una nueva fecha de salida"
                        >
                          + Fecha
                        </button>
                      </div>

                      @if (activeDateExpId() === exp.id) {
                        <div class="quick-add-date-popover" (click)="$event.stopPropagation()">
                          <input
                            type="date"
                            class="quick-date-input"
                            [min]="todayIso"
                            [(ngModel)]="newDateValue"
                          />
                          <button
                            type="button"
                            class="quick-date-save-btn"
                            (click)="saveNewDate(exp.id)"
                            [disabled]="!newDateValue"
                          >
                            Agregar
                          </button>
                          <button
                            type="button"
                            class="quick-date-cancel-btn"
                            (click)="toggleAddDate(null)"
                          >
                            ✕
                          </button>
                        </div>
                      }

                      <div class="exp-mini-dates">
                        @for (d of exp.dates; track d) {
                          <span class="mini-date-badge">
                            {{ d | fecha }}
                            <span class="date-occupancy"
                              >({{ store.reservedSeats(exp.id, d) }}/{{
                                exp.capacityPerDate
                              }})</span
                            >
                            <button
                              type="button"
                              class="mini-date-remove-btn"
                              (click)="removeDate(exp.id, d); $event.stopPropagation()"
                              title="Eliminar esta fecha de salida"
                            >
                              ✕
                            </button>
                          </span>
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>
        }

        <!-- Box: Solicitar a los administradores que carguen una nueva experiencia -->
        <div class="request-new-exp-card" (click)="openRequestModal()">
          <div class="request-new-exp-content">
            <div class="request-new-exp-info">
              <span class="request-new-exp-kicker">NUEVA EXPERIENCIA</span>
              <h3 class="request-new-exp-title">
                Solicitá a los administradores que carguen una nueva experiencia
              </h3>
              <p class="request-new-exp-desc">
                ¿Tenés una nueva propuesta, salida o travesía para sumar al catálogo? Completá el
                formulario con los detalles técnicos, fechas y tarifas para que el equipo de
                administración la revise y publique.
              </p>
            </div>
          </div>

          <div class="request-new-exp-action">
            <button
              type="button"
              class="request-form-btn"
              (click)="openRequestModal(); $event.stopPropagation()"
            >
              <span>Completar formulario</span>
            </button>
          </div>
        </div>
      </section>

      <!-- Finanzas y Conciliación de Pagos - Expanded Full Width Section -->
      <section class="dash-card full-width-card finanzas-section">
        <div class="card-head">
          <h2 class="card-title">Últimos Pagos de Socios del Club</h2>
          <a routerLink="../socios" class="view-all-link" title="Ver todos los socios inscriptos">
            <span>Ver todos los socios inscriptos</span>
          </a>
        </div>

        <!-- Bank Details Info Strip -->
        <div class="fin-bank-banner">
          <div class="fin-bank-item">
            <span class="fin-bank-lbl">CBU</span>
            <strong class="fin-bank-val code-font">{{
              provider()?.cbuAlias || '3840200500000056402423'
            }}</strong>
          </div>
          <div class="fin-bank-item">
            <span class="fin-bank-lbl">Nombre</span>
            <strong class="fin-bank-val">{{
              provider()?.name || 'Patricio Facundo Diaz Tillar'
            }}</strong>
          </div>
          <div class="fin-bank-item">
            <span class="fin-bank-lbl">CUIT/CUIL</span>
            <strong class="fin-bank-val code-font">{{
              provider()?.cuitDni || '20-38628297-9'
            }}</strong>
          </div>
          <div class="fin-bank-item">
            <span class="fin-bank-lbl">Entidad</span>
            <strong class="fin-bank-val">{{ provider()?.bankName || 'Uala Bank S.A.U' }}</strong>
          </div>
        </div>

        @if (recentSubmissions().length === 0) {
          <p class="empty-text">Aún no hay comprobantes de pago registrados.</p>
        } @else {
          <div class="fin-table-wrap">
            <table class="fin-data-table">
              <thead>
                <tr>
                  <th class="col-th-socio">Socio</th>
                  <th class="col-th-exp">Experiencia</th>
                  <th class="col-th-date">Fecha</th>
                  <th class="col-th-seats">Cupos</th>
                  <th class="col-th-amount">Importe</th>
                  <th class="col-th-action">Acción</th>
                </tr>
              </thead>
              <tbody>
                @for (sub of recentSubmissions(); track sub.id) {
                  <tr [class.row-pending]="sub.status === 'pendiente'">
                    <td>
                      <div class="cell-stack">
                        <strong class="socio-name">{{ sub.fullName }}</strong>
                        <span class="cell-sub">DNI: {{ sub.dni }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="exp-title-text" [title]="sub.experienceTitle">{{
                        sub.experienceTitle
                      }}</span>
                    </td>
                    <td>
                      <span class="cell-date">{{ sub.date | fecha }}</span>
                    </td>
                    <td class="text-center">
                      <span class="seats-badge">{{ sub.participants }}</span>
                    </td>
                    <td class="text-right">
                      <strong class="amount-val">{{ sub.amountArs | ars }}</strong>
                    </td>
                    <td class="text-right">
                      <a
                        type="button"
                        (click)="openReceipt(sub)"
                        class="fin-review-btn"
                        title="Revisar comprobante de pago"
                      >
                        Revisar
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <!-- Sección 3: Postulaciones de Experiencias Más Recientes -->
      <section class="dash-card full-width-card">
        <div class="card-head">
          <h2 class="card-title">Postulaciones de Experiencias Más Recientes</h2>
          <a
            routerLink="../experiencias"
            [queryParams]="{ tab: 'solicitudes' }"
            class="view-all-link"
            title="Ver todas las postulaciones"
          >
            <span>Ver todas las postulaciones ({{ store.providerExperienceRequests().length }})</span>
          </a>
        </div>

        @if (store.providerExperienceRequests().length === 0) {
          <p class="empty-text">No tenés postulaciones de nuevas experiencias enviadas todavía.</p>
        } @else {
          <div class="fin-table-wrap">
            <table class="fin-data-table">
              <thead>
                <tr>
                  <th>Experiencia Propuesta</th>
                  <th>Región</th>
                  <th>Dificultad</th>
                  <th class="col-th-amount">Arancel</th>
                  <th>Fecha</th>
                  <th class="col-th-action">Estado</th>
                </tr>
              </thead>
              <tbody>
                @for (req of store.providerExperienceRequests().slice(0, 6); track req.id) {
                  <tr>
                    <td>
                      <div class="cell-stack">
                        <strong class="socio-name">{{ req.title }}</strong>
                        <span class="cell-sub">{{ req.kicker }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="exp-title-text">{{ req.region }}</span>
                    </td>
                    <td>
                      <span class="exp-title-text">{{ req.difficulty }}</span>
                    </td>
                    <td class="text-right">
                      <strong class="amount-val">{{ req.priceArs | ars }}</strong>
                    </td>
                    <td>
                      <span class="cell-date">{{ req.createdAt | fecha: 'corta' }}</span>
                    </td>
                    <td class="text-right">
                      <span
                        class="req-status-pill"
                        [class.pill-aprobada]="req.status === 'aprobada'"
                        [class.pill-pendiente]="req.status === 'pendiente'"
                        [class.pill-rechazada]="req.status === 'rechazada'"
                      >
                        {{
                          req.status === 'aprobada'
                            ? 'Aprobada'
                            : req.status === 'rechazada'
                              ? 'Rechazada'
                              : 'Pendiente'
                        }}
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      @if (selectedSubmission(); as sub) {
        <div class="dashboard-modal-backdrop" (click)="closeReceipt()">
          <div
            class="dashboard-receipt-modal"
            (click)="$event.stopPropagation()"
            role="dialog"
            aria-modal="true"
          >
            <div class="dashboard-receipt-preview">
              @if (sub.receipt?.url) {
                <img [src]="sub.receipt.url" [alt]="'Comprobante de ' + sub.fullName" />
              } @else {
                <div class="dashboard-no-receipt">Sin comprobante adjunto</div>
              }
            </div>
            <div class="dashboard-receipt-details">
              <div class="dashboard-modal-head">
                <div>
                  <span class="card-kicker">COMPROBANTE</span>
                  <h2 class="card-title">{{ sub.fullName }}</h2>
                </div>
                <button type="button" class="dashboard-modal-close" (click)="closeReceipt()">
                  ×
                </button>
              </div>
              <p><strong>Importe:</strong> {{ sub.amountArs | ars }}</p>
              <p><strong>Experiencia:</strong> {{ sub.experienceTitle }}</p>
              <p><strong>Fecha:</strong> {{ sub.date | fecha: 'larga' }}</p>
              <p><strong>Email:</strong> {{ sub.email }}</p>
              <p><strong>Celular:</strong> {{ sub.phone }}</p>
              <p><strong>DNI:</strong> {{ sub.dni }}</p>
              @if (sub.status !== 'pendiente') {
                <p class="dashboard-receipt-status">Pago {{ sub.status }}.</p>
              }
              @if (sub.receipt?.url) {
                <a
                  class="dashboard-receipt-download"
                  [href]="sub.receipt.url"
                  [download]="sub.receipt.fileName"
                  target="_blank"
                  rel="noopener"
                >
                  DESCARGAR COMPROBANTE
                </a>
              }
            </div>
          </div>
        </div>
      }

      <!-- Modal: Formulario para Solicitar Alta de Nueva Experiencia -->
      <app-provider-experience-proposal-modal
        [isOpen]="requestModalOpen()"
        (closeModal)="requestModalOpen.set(false)"
      />
    </div>
  `,
  styles: [
    `
      .dash-container {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }
      .welcome-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(22, 33, 85, 0.55);
        border: 1px solid rgba(128, 179, 255, 0.35);
        border-radius: 2px;
        padding: 1.75rem 2rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        gap: 1.5rem;
        flex-wrap: wrap;
      }
      .welcome-main {
        display: flex;
        align-items: center;
        gap: 1.5rem;
      }
      .avatar-ring {
        position: relative;
        flex-shrink: 0;
      }
      .provider-avatar {
        width: 96px;
        height: 96px;
        border-radius: 4px;
        border: 2px solid #80b3ff;
        box-shadow: 0 4px 16px rgba(0, 56, 143, 0.35);
        object-fit: cover;
        display: block;
      }
      .welcome-text {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .welcome-tag {
        display: inline-flex;
        align-items: center;
        font-size: 0.72rem;
        font-weight: 700;
        color: #80b3ff;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .welcome-name {
        font-size: 1.6rem;
        font-weight: 700;
        color: #ffffff;
        margin: 0;
        letter-spacing: -0.02em;
      }
      .welcome-agency {
        font-size: 0.88rem;
        color: rgba(255, 255, 255, 0.75);
        margin: 0;
      }
      .welcome-agency code {
        background: rgba(128, 179, 255, 0.12);
        border: 1px solid rgba(128, 179, 255, 0.25);
        padding: 0.15rem 0.45rem;
        border-radius: 2px;
        color: #80b3ff;
        font-size: 0.8rem;
      }
      .welcome-actions {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        flex-wrap: wrap;
      }
      .cta-blue-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.65rem 1.25rem;
        background: #80b3ff;
        color: #081124;
        font-weight: 700;
        font-size: 0.85rem;
        border-radius: 2px;
        transition: all 0.2s ease;
        text-decoration: none;
        letter-spacing: 0.02em;
      }
      .cta-blue-btn:hover {
        background: #a6c8ff;
      }
      .cta-secondary-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.65rem 1.15rem;
        background: rgba(22, 33, 85, 0.6);
        border: 1px solid rgba(128, 179, 255, 0.35);
        color: #ffffff;
        font-weight: 600;
        font-size: 0.85rem;
        border-radius: 2px;
        transition: all 0.2s ease;
        text-decoration: none;
      }
      .cta-secondary-btn:hover {
        border-color: #80b3ff;
        color: #80b3ff;
      }
      .btn-badge {
        background: #80b3ff;
        color: #081124;
        font-size: 0.7rem;
        font-weight: 800;
        padding: 0.1rem 0.4rem;
        border-radius: 2px;
        line-height: 1;
      }
      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
        gap: 1rem;
      }
      .metric-card {
        display: flex;
        flex-direction: column;
        justify-content: center;
        background: rgba(22, 33, 85, 0.55);
        border: 1px solid rgba(128, 179, 255, 0.25);
        border-radius: 2px;
        padding: 1.35rem 1.25rem;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
        backdrop-filter: blur(14px);
      }
      .metric-card.blue-highlight-border {
        border-color: rgba(128, 179, 255, 0.5);
        background: rgba(128, 179, 255, 0.08);
      }
      .metric-content {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .metric-label {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.65);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .metric-value {
        font-size: 1.55rem;
        font-weight: 700;
        color: #ffffff;
        line-height: 1.2;
      }
      .text-blue {
        color: #ffffff !important;
      }
      .metric-hint {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.5);
      }
      .moderation-alert-card {
        background: rgba(128, 179, 255, 0.06);
        border: 1px solid rgba(128, 179, 255, 0.35);
        border-radius: 2px;
        padding: 1.25rem 1.5rem;
      }
      .alert-body h3 {
        font-size: 0.95rem;
        font-weight: 700;
        color: #80b3ff;
        margin-bottom: 0.25rem;
      }
      .alert-body p {
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.75);
        margin-bottom: 0.75rem;
      }
      .moderation-items {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .mod-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(7, 13, 28, 0.6);
        border: 1px solid rgba(128, 179, 255, 0.2);
        border-radius: 2px;
        padding: 0.6rem 0.85rem;
        gap: 1rem;
      }
      .mod-item-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
      .mod-item-info strong {
        font-size: 0.88rem;
        color: #ffffff;
      }
      .mod-pill {
        font-size: 0.72rem;
        padding: 0.15rem 0.5rem;
        border-radius: 2px;
        background: rgba(128, 179, 255, 0.15);
        border: 1px solid rgba(128, 179, 255, 0.3);
        color: #80b3ff;
        font-weight: 600;
      }
      .sim-admin-btn {
        display: inline-flex;
        align-items: center;
        background: rgba(128, 179, 255, 0.15);
        border: 1px solid rgba(128, 179, 255, 0.45);
        color: #80b3ff;
        padding: 0.35rem 0.75rem;
        border-radius: 2px;
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .sim-admin-btn:hover {
        background: #80b3ff;
        color: #070d18;
      }
      .dash-card {
        background: rgba(22, 33, 85, 0.55);
        border: 1px solid rgba(128, 179, 255, 0.25);
        border-radius: 2px;
        padding: 1.5rem;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.25);
        backdrop-filter: blur(14px);
      }
      .card-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.25rem;
      }
      .card-kicker {
        font-size: 0.7rem;
        font-weight: 700;
        color: #80b3ff;
        letter-spacing: 0.08em;
      }
      .card-title {
        font-size: 1.15rem;
        font-weight: 700;
        color: #ffffff;
        margin: 0;
        line-height: 1.2;
      }
      .card-link {
        font-size: 0.8rem;
        color: #80b3ff;
        font-weight: 600;
        text-decoration: none;
      }
      .view-all-link {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        color: #80b3ff;
        text-decoration: none;
        font-size: 0.82rem;
        font-weight: 700;
        line-height: 1.2;
        transition: color 0.2s ease;
      }
      .view-all-link:hover {
        color: #b3d1ff;
        text-decoration: underline;
      }
      .card-action-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.42rem 0.9rem;
        background: rgba(128, 179, 255, 0.12);
        border: 1px solid rgba(128, 179, 255, 0.35);
        border-radius: 2px;
        color: #80b3ff;
        font-size: 0.78rem;
        font-weight: 700;
        text-decoration: none;
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      .card-action-btn:hover {
        background: #80b3ff;
        color: #070d18;
      }
      .metric-card-link {
        text-decoration: none;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .metric-card-link:hover {
        border-color: #80b3ff;
        transform: translateY(-2px);
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4);
      }
      .metric-header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
      }
      .metric-action-hint {
        font-size: 0.72rem;
        font-weight: 700;
        color: #80b3ff;
        letter-spacing: 0.04em;
      }
      .card-link:hover {
        text-decoration: underline;
      }
      .empty-text {
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.5);
        text-align: center;
        padding: 2rem 0;
      }

      /* Finanzas Section - Full Width */
      .finanzas-section {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .finanzas-section .card-head {
        margin-bottom: 0;
      }
      .badge-pending {
        background: rgba(128, 179, 255, 0.25) !important;
        border-color: #80b3ff !important;
        color: #ffffff !important;
      }

      /* Bank Details Info Strip */
      .fin-bank-banner {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1rem;
        padding: 1rem 1.25rem;
        background: rgba(7, 13, 28, 0.6);
        border: 1px solid rgba(128, 179, 255, 0.25);
        border-radius: 2px;
      }
      .fin-bank-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .fin-bank-lbl {
        font-size: 0.68rem;
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: rgba(255, 255, 255, 0.55);
      }
      .fin-bank-val {
        font-size: 0.88rem;
        color: #ffffff;
        word-break: break-all;
      }
      .code-font {
        font-family: monospace;
        color: #ffffff;
        letter-spacing: 0.04em;
      }

      /* Table Container & Semantic Table */
      .fin-table-wrap {
        width: 100%;
        overflow-x: auto;
        border: 1px solid rgba(128, 179, 255, 0.25);
        border-radius: 2px;
        background: rgba(7, 13, 28, 0.6);
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.25);
      }
      .fin-data-table {
        width: 100%;
        min-width: 860px;
        border-collapse: collapse;
        text-align: left;
      }
      .fin-data-table th {
        padding: 0.85rem 1rem;
        background: rgba(22, 33, 85, 0.85);
        border-bottom: 1px solid rgba(128, 179, 255, 0.3);
        font-size: 0.72rem;
        font-weight: 700;
        color: #80b3ff;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        white-space: nowrap;
      }
      .fin-data-table td {
        padding: 0.95rem 1rem;
        border-bottom: 1px solid rgba(128, 179, 255, 0.12);
        vertical-align: middle;
        font-size: 0.86rem;
        color: #ffffff;
      }
      .fin-data-table tbody tr:last-child td {
        border-bottom: none;
      }
      .fin-data-table tbody tr:hover {
        background: rgba(128, 179, 255, 0.05);
      }
      .fin-data-table tbody tr.row-pending {
        background: rgba(128, 179, 255, 0.09);
      }
      .fin-status-pill {
        display: inline-block;
        font-size: 0.65rem;
        font-weight: 800;
        letter-spacing: 0.05em;
        padding: 0.25rem 0.5rem;
        border-radius: 2px;
        text-align: center;
        white-space: nowrap;
      }
      .status-pendiente {
        background: rgba(128, 179, 255, 0.2);
        border: 1px solid #80b3ff;
        color: #80b3ff;
      }
      .status-aprobado {
        background: rgba(128, 179, 255, 0.1);
        border: 1px solid rgba(128, 179, 255, 0.35);
        color: #ffffff;
      }
      .status-rechazado {
        background: rgba(255, 95, 95, 0.15);
        border: 1px solid #ff5f5f;
        color: #ff8080;
      }
      .cell-stack {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }
      .socio-name {
        font-size: 0.88rem;
        color: #ffffff;
      }
      .cell-sub {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.55);
      }
      .exp-title-text {
        font-size: 0.85rem;
        color: #ffffff;
        max-width: 260px;
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cell-date {
        font-size: 0.82rem;
        color: #ffffff;
        white-space: nowrap;
      }
      .ref-code {
        font-family: monospace;
        font-size: 0.8rem;
        color: #80b3ff;
      }
      .seats-badge {
        display: inline-block;
        padding: 0.2rem 0.55rem;
        border-radius: 2px;
        background: rgba(128, 179, 255, 0.12);
        border: 1px solid rgba(128, 179, 255, 0.25);
        color: #ffffff;
        font-size: 0.8rem;
        font-weight: 700;
      }
      .amount-val {
        font-size: 0.95rem;
        font-weight: 700;
        color: #80b3ff;
        white-space: nowrap;
      }
      .text-center {
        text-align: center;
      }
      .text-right {
        text-align: right;
      }
      .fin-review-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.45rem 0.85rem;
        font-size: 0.75rem;
        font-weight: 700;
        border-radius: 2px;
        text-decoration: none;
        transition: all 0.2s ease;
        background: rgba(128, 179, 255, 0.15);
        border: 1px solid rgba(128, 179, 255, 0.35);
        color: #80b3ff;
        text-align: center;
        white-space: nowrap;
        cursor: pointer;
      }
      .fin-review-btn:hover {
        background: #80b3ff;
        color: #070d18;
      }
      .fin-review-btn.btn-pending {
        background: #80b3ff;
        color: #070d18;
        border-color: #80b3ff;
      }
      .fin-review-btn.btn-pending:hover {
        background: #a3c7ff;
      }

      /* Experiencias Activas - Full Width Box */
      .full-width-card {
        width: 100%;
        box-sizing: border-box;
      }
      .active-experiences-section {
        display: flex;
        flex-direction: column;
      }
      .card-head-actions {
        display: flex;
        align-items: center;
        gap: 0.85rem;
      }
      .active-count-badge {
        background: rgba(128, 179, 255, 0.15);
        border: 1px solid rgba(128, 179, 255, 0.35);
        color: #80b3ff;
        font-size: 0.72rem;
        font-weight: 700;
        padding: 0.2rem 0.55rem;
        border-radius: 2px;
        letter-spacing: 0.04em;
      }
      .empty-active-box {
        text-align: center;
        padding: 2rem 1rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
      }
      .active-experiences-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .active-exp-row {
        display: grid;
        grid-template-columns: 240px 1fr auto;
        gap: 0;
        background: rgba(7, 13, 28, 0.5);
        border: 1px solid rgba(128, 179, 255, 0.2);
        border-radius: 2px;
        padding: 0;
        align-items: stretch;
        overflow: hidden;
      }
      .active-exp-cover-wrap {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 165px;
        border-radius: 0;
        overflow: hidden;
        border-right: 1px solid rgba(128, 179, 255, 0.2);
        flex-shrink: 0;
      }
      .active-exp-cover {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .exp-live-pill {
        position: absolute;
        top: 8px;
        left: 8px;
        background: #80b3ff;
        color: #070d18;
        font-size: 0.65rem;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        padding: 0.2rem 0.55rem;
        border-radius: 2px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
      }
      .active-exp-main {
        padding: 1.25rem 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        min-width: 0;
      }
      .active-exp-top-row {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        font-size: 0.74rem;
        color: rgba(255, 255, 255, 0.6);
        flex-wrap: wrap;
      }
      .exp-cat-tag {
        color: #80b3ff;
        font-weight: 700;
        text-transform: uppercase;
        font-size: 0.7rem;
        letter-spacing: 0.05em;
      }
      .exp-sep {
        color: rgba(128, 179, 255, 0.4);
      }
      .exp-duration-tag {
        color: rgba(255, 255, 255, 0.75);
      }
      .active-exp-name {
        font-size: 1.05rem;
        font-weight: 700;
        color: #ffffff;
        margin: 0;
        line-height: 1.3;
      }
      .active-exp-desc {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.7);
        margin: 0;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .active-exp-kpis {
        display: flex;
        gap: 1.25rem;
        flex-wrap: wrap;
        margin-top: 0.35rem;
        padding-top: 0.45rem;
        border-top: 1px solid rgba(128, 179, 255, 0.12);
      }
      .kpi-mini-col {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }
      .kpi-mini-lbl {
        font-size: 0.68rem;
        color: rgba(255, 255, 255, 0.5);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .kpi-mini-val {
        font-size: 0.88rem;
        font-weight: 700;
        color: #ffffff;
      }
      .kpi-col-dates {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .kpi-dates-head {
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }
      .btn-quick-add-date {
        display: inline-flex;
        align-items: center;
        gap: 0.2rem;
        padding: 0.15rem 0.45rem;
        background: rgba(128, 179, 255, 0.15);
        border: 1px solid rgba(128, 179, 255, 0.4);
        border-radius: 2px;
        color: #80b3ff;
        font-size: 0.68rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .btn-quick-add-date:hover {
        background: #80b3ff;
        color: #070d18;
      }
      .quick-add-date-popover {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.45rem 0.6rem;
        background: rgba(14, 22, 54, 0.95);
        border: 1px solid rgba(128, 179, 255, 0.45);
        border-radius: 2px;
        margin: 0.35rem 0;
        flex-wrap: wrap;
      }
      .quick-date-input {
        padding: 0.3rem 0.5rem;
        font-size: 0.78rem;
        background: rgba(7, 13, 28, 0.9);
        border: 1px solid rgba(128, 179, 255, 0.3);
        border-radius: 2px;
        color: #ffffff;
        font-family: inherit;
        color-scheme: dark;
      }
      .quick-date-save-btn {
        padding: 0.32rem 0.7rem;
        background: #80b3ff;
        color: #070d18;
        border: none;
        border-radius: 2px;
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;
      }
      .quick-date-save-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .quick-date-cancel-btn {
        padding: 0.3rem 0.45rem;
        color: rgba(255, 255, 255, 0.6);
        background: transparent;
        border: none;
        font-size: 0.75rem;
        cursor: pointer;
      }
      .quick-date-cancel-btn:hover {
        color: #ffffff;
      }
      .mini-date-remove-btn {
        margin-left: 0.25rem;
        color: rgba(255, 255, 255, 0.45);
        font-size: 0.75rem;
        cursor: pointer;
        padding: 0 0.15rem;
        line-height: 1;
        background: transparent;
        border: none;
        transition: color 0.15s ease;
      }
      .mini-date-remove-btn:hover {
        color: #ff8080;
      }
      .exp-mini-dates {
        display: flex;
        gap: 0.35rem;
        flex-wrap: wrap;
      }
      .mini-date-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.72rem;
        background: rgba(128, 179, 255, 0.1);
        border: 1px solid rgba(128, 179, 255, 0.25);
        color: #ffffff;
        padding: 0.15rem 0.45rem;
        border-radius: 2px;
      }
      .date-occupancy {
        color: #ffffff;
        font-weight: 700;
      }
      .active-exp-btns {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0.5rem;
        min-width: 130px;
        padding: 1.25rem 1.5rem 1.25rem 0;
      }
      .active-action-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.55rem 0.95rem;
        font-size: 0.78rem;
        font-weight: 700;
        border-radius: 2px;
        text-decoration: none;
        transition: all 0.2s ease;
        text-align: center;
        white-space: nowrap;
      }
      .edit-action {
        background: rgba(128, 179, 255, 0.15);
        border: 1px solid rgba(128, 179, 255, 0.35);
        color: #80b3ff;
      }
      .edit-action:hover {
        background: #80b3ff;
        color: #070d18;
      }
      .socios-action {
        background: rgba(22, 33, 85, 0.55);
        border: 1px solid rgba(128, 179, 255, 0.25);
        color: #ffffff;
      }
      .socios-action:hover {
        background: rgba(128, 179, 255, 0.25);
        border-color: #80b3ff;
      }

      /* Box: Solicitar nueva experiencia a administradores */
      .request-new-exp-card {
        margin-top: 1.25rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.5rem;
        padding: 1.25rem 1.5rem;
        background: rgba(14, 22, 54, 0.75);
        border: 1px dashed rgba(128, 179, 255, 0.45);
        border-radius: 2px;
        transition:
          border-color 0.2s ease,
          background 0.2s ease;
        cursor: pointer;
      }
      .request-new-exp-card:hover {
        border-color: #80b3ff;
        background: rgba(18, 28, 68, 0.85);
      }
      .request-new-exp-content {
        display: flex;
        align-items: center;
        gap: 1.25rem;
        min-width: 0;
      }
      .request-new-exp-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        min-width: 0;
      }
      .request-new-exp-kicker {
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #80b3ff;
      }
      .request-new-exp-title {
        margin: 0;
        font-size: 1.02rem;
        font-weight: 700;
        color: #ffffff;
        line-height: 1.3;
      }
      .request-new-exp-desc {
        margin: 0;
        font-size: 0.84rem;
        color: rgba(255, 255, 255, 0.75);
        line-height: 1.45;
      }
      .request-new-exp-action {
        flex-shrink: 0;
      }
      .request-form-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.75rem 1.4rem;
        background: #80b3ff;
        border: 1px solid #80b3ff;
        color: #070d18;
        font-size: 0.88rem;
        font-weight: 700;
        border-radius: 2px;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
        letter-spacing: 0.02em;
        box-shadow: 0 4px 15px rgba(128, 179, 255, 0.25);
      }
      .request-form-btn:hover {
        background: #a6c8ff;
        border-color: #a6c8ff;
        box-shadow: 0 6px 20px rgba(128, 179, 255, 0.4);
        transform: translateY(-1px);
      }

      /* Postulation Status Pills */
      .req-status-pill {
        display: inline-block;
        padding: 0.18rem 0.55rem;
        border-radius: 2px;
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .pill-pendiente {
        background: rgba(255, 170, 0, 0.15);
        border: 1px solid rgba(255, 170, 0, 0.45);
        color: #ffaa00;
      }
      .pill-aprobada {
        background: rgba(40, 200, 120, 0.15);
        border: 1px solid rgba(40, 200, 120, 0.45);
        color: #28c878;
      }
      .pill-rechazada {
        background: rgba(255, 60, 60, 0.12);
        border: 1px solid rgba(255, 60, 60, 0.35);
        color: #ff5f5f;
      }

      /* Mobile Responsiveness */
      @media (max-width: 768px) {
        .dash-card {
          padding: 1rem;
        }
        .welcome-card {
          flex-direction: column;
          align-items: stretch;
          padding: 1.25rem;
          gap: 1rem;
        }
        .welcome-main {
          flex-direction: row;
          align-items: center;
          gap: 1rem;
        }
        .avatar-ring {
          flex-shrink: 0;
        }
        .provider-avatar {
          width: 74px;
          height: 74px;
        }
        .welcome-text {
          min-width: 0;
          flex: 1;
        }
        .welcome-name {
          font-size: 1.25rem;
          line-height: 1.25;
          word-break: break-word;
        }
        .welcome-agency {
          font-size: 0.85rem;
        }
        .welcome-card .new-proposal-btn {
          width: 100%;
          justify-content: center;
        }
        .metrics-grid {
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }
        .metric-card {
          padding: 1rem;
        }
        .metric-value {
          font-size: 1.25rem;
        }
        .card-head {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.5rem;
        }
        .head-actions {
          width: 100%;
          justify-content: flex-start;
        }
        .active-exp-row {
          display: flex;
          flex-direction: column;
        }
        .active-exp-cover-wrap {
          width: 100%;
          height: 195px;
          min-height: 195px;
          border-right: none;
          border-bottom: 1px solid rgba(128, 179, 255, 0.2);
        }
        .active-exp-main {
          padding: 1.15rem 1rem 1.25rem;
          gap: 0.5rem;
        }
        .active-exp-name {
          font-size: 1.15rem;
          line-height: 1.3;
        }
        .active-exp-desc {
          font-size: 0.85rem;
          line-height: 1.45;
          -webkit-line-clamp: 3;
        }
        .active-exp-kpis {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.85rem;
          margin-top: 0.5rem;
          padding-top: 0.75rem;
        }
        .active-exp-kpis .kpi-mini-col:last-child {
          grid-column: 1 / -1;
        }
        .exp-mini-dates {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }
        .mini-date-badge {
          padding: 0.25rem 0.55rem;
          font-size: 0.75rem;
        }
        .request-new-exp-card {
          flex-direction: column;
          align-items: stretch;
          padding: 1.15rem 1rem;
          gap: 1rem;
        }
        .request-new-exp-content {
          width: 100%;
        }
        .request-new-exp-info {
          width: 100%;
        }
        .request-new-exp-action {
          width: 100%;
        }
        .request-form-btn {
          width: 100%;
        }
      }

      @media (max-width: 480px) {
        .dash-card {
          padding: 0.85rem;
        }
        .provider-avatar {
          width: 64px;
          height: 64px;
        }
        .welcome-name {
          font-size: 1.1rem;
        }
        .metrics-grid {
          grid-template-columns: 1fr;
        }
        .fin-bank-banner {
          grid-template-columns: 1fr;
          gap: 0.65rem;
          padding: 0.85rem;
        }
        .active-exp-cover-wrap {
          height: 175px;
          min-height: 175px;
        }
        .active-exp-main {
          padding: 1rem 0.85rem;
        }
        .active-exp-kpis {
          grid-template-columns: 1fr;
          gap: 0.75rem;
        }
      }

      /* ── Dashboard Receipt Modal ── */
      .dashboard-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(4, 8, 30, 0.72);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        z-index: 1000;
      }

      .dashboard-receipt-modal {
        display: grid;
        grid-template-columns: minmax(240px, 0.85fr) minmax(320px, 1.15fr);
        width: min(860px, 100%);
        max-height: min(680px, 90vh);
        background: rgba(10, 18, 50, 0.88);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(128, 179, 255, 0.35);
        border-radius: 3px;
        overflow: hidden;
      }

      .dashboard-receipt-preview {
        background: rgba(5, 10, 30, 0.6);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 1rem;
        overflow-y: auto;
        max-height: 100%;
      }

      .dashboard-receipt-preview img {
        width: 100%;
        height: auto;
        max-width: 100%;
        object-fit: contain;
        display: block;
      }

      .dashboard-no-receipt {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-height: 200px;
        color: rgba(255, 255, 255, 0.4);
        font-size: 0.85rem;
      }

      .dashboard-receipt-details {
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        overflow-y: auto;
        min-height: 0;
      }

      .dashboard-receipt-details p {
        margin: 0;
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.9);
      }

      .dashboard-receipt-details p strong {
        color: rgba(128, 179, 255, 0.85);
        margin-right: 0.25rem;
      }

      .dashboard-modal-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 0.5rem;
      }

      .dashboard-modal-close {
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.7);
        font-size: 1.5rem;
        cursor: pointer;
        line-height: 1;
        padding: 0;
        transition: color 0.15s ease;
      }

      .dashboard-modal-close:hover {
        color: #ffffff;
      }

      .dashboard-receipt-status {
        color: #80b3ff !important;
        font-weight: 600;
        text-transform: capitalize;
      }

      .dashboard-receipt-download {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-top: auto;
        padding: 0.65rem 1rem;
        background: rgba(128, 179, 255, 0.12);
        border: 1px solid rgba(128, 179, 255, 0.4);
        border-radius: 2px;
        color: #80b3ff;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .dashboard-receipt-download:hover {
        background: rgba(128, 179, 255, 0.22);
        border-color: #80b3ff;
        color: #ffffff;
      }

      @media (max-width: 640px) {
        .dashboard-receipt-modal {
          grid-template-columns: 1fr;
          grid-template-rows: auto 1fr;
          max-height: 90vh;
          overflow-y: auto;
        }
      }
    `,
  ],
})
export class ProviderDashboardComponent implements OnInit {
  readonly store = inject(ProviderStoreService);
  private readonly route = inject(ActivatedRoute);
  readonly selectedSubmission = signal<TransferSubmission | null>(null);

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['solicitar'] === '1' || params['nueva'] === '1') {
        this.openRequestModal();
      }
    });
  }

  readonly provider = this.store.currentProvider;
  readonly stats = this.store.providerStats;

  readonly requestModalOpen = signal(false);

  openRequestModal(): void {
    this.requestModalOpen.set(true);
  }

  closeRequestModal(): void {
    this.requestModalOpen.set(false);
  }

  readonly activeExperiences = computed(() =>
    this.store.providerExperiences().filter((e) => e.status === 'publicada'),
  );

  readonly recentSubmissions = computed(() => this.store.providerSubmissions().slice(0, 8));

  readonly upcomingSlots = computed(() => {
    const list: Array<{
      experienceId: string;
      experienceTitle: string;
      date: string;
      reserved: number;
      capacity: number;
    }> = [];

    for (const exp of this.store.providerExperiences()) {
      for (const date of exp.dates.slice(0, 3)) {
        list.push({
          experienceId: exp.id,
          experienceTitle: exp.shortTitle || exp.title,
          date,
          reserved: this.store.reservedSeats(exp.id, date),
          capacity: exp.capacityPerDate,
        });
      }
    }

    return list.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  });

  readonly nearestSlot = computed(() => {
    const list = this.upcomingSlots();
    return list.length > 0 ? list[0] : null;
  });

  readonly nearestExperienceEnrolled = computed(() => {
    const slot = this.nearestSlot();
    return slot ? slot.reserved : 0;
  });

  getExperienceEnrolled(experienceId: string): number {
    return this.store
      .providerSubmissions()
      .filter((s) => s.experienceId === experienceId && s.status !== 'rechazado')
      .reduce((sum, s) => sum + s.participants, 0);
  }

  async openReceipt(submission: TransferSubmission): Promise<void> {
    this.selectedSubmission.set(submission);
    const key = submission.receipt.storageKey || submission.receipt.url;
    if (
      key &&
      !key.startsWith('http://') &&
      !key.startsWith('https://') &&
      !key.startsWith('data:') &&
      !key.startsWith('blob:')
    ) {
      const signed = await this.store.getSignedReceiptUrl(key);
      if (signed) {
        this.selectedSubmission.update((s) =>
          s && s.id === submission.id ? { ...s, receipt: { ...s.receipt, url: signed } } : s,
        );
      }
    }
  }

  closeReceipt(): void {
    this.selectedSubmission.set(null);
  }

  todayIso = this.getLocalTodayIso();
  readonly activeDateExpId = signal<string | null>(null);
  newDateValue = '';

  private getLocalTodayIso(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  toggleAddDate(expId: string | null): void {
    this.todayIso = this.getLocalTodayIso();
    if (this.activeDateExpId() === expId) {
      this.activeDateExpId.set(null);
      this.newDateValue = '';
    } else {
      this.activeDateExpId.set(expId);
      this.newDateValue = '';
    }
  }

  saveNewDate(expId: string): void {
    if (!this.newDateValue) return;
    const today = this.getLocalTodayIso();
    if (this.newDateValue < today) {
      alert('No se pueden programar fechas en el pasado.');
      return;
    }
    const ok = this.store.addDateToExperience(expId, this.newDateValue);
    if (ok) {
      this.activeDateExpId.set(null);
      this.newDateValue = '';
    } else {
      alert('La fecha ya existe o no pudo sincronizarse con el catálogo.');
    }
  }

  removeDate(expId: string, date: string): void {
    if (this.store.reservedSeats(expId, date) > 0) {
      alert('No se puede eliminar una fecha con reservas confirmadas.');
      return;
    }
    if (confirm(`¿Eliminar la fecha ${date} para esta experiencia?`)) {
      const ok = this.store.removeDateFromExperience(expId, date);
      if (!ok) {
        alert('No se pudo eliminar la fecha seleccionada.');
      }
    }
  }
}
