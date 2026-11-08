import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import {
  AdminStoreService,
  AdminMember,
  AdminApplication,
  ApplicationStatus,
  ExperienceProposalRequest,
} from '../../../core/services/admin-store.service';
import { TransferSubmission } from '../../../core/models/bank-transfer.model';
import { ArsPipe, FechaPipe } from '../../../shared/pipes/format.pipes';
import { slugify } from '../../../core/services/provider-store.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { ProviderListItem } from '../admin-providers/admin-providers.component';
import { isClubExperience } from '../../../core/models/club-profile.model';
import { Experience } from '../../../core/models/experience.model';
import {
  exportExperiencesToCsv,
  getPublicExperienceUrl,
} from '../../../shared/utils/csv.util';
import { AdminApplicationModalComponent } from '../admin-application-modal/admin-application-modal.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatIconModule,
    ArsPipe,
    FechaPipe,
    AdminApplicationModalComponent,
  ],
  template: `
    <div class="dash-container">
      <!-- Welcome Header Sobrio y Minimalista -->
      <section class="welcome-card">
        <div class="welcome-main">
          <div class="avatar-ring">
            <img
              [src]="admin()?.avatar || '/assets/images/gonza.jpg'"
              [alt]="admin()?.name || 'Gonzalo Gramaglia'"
              class="admin-avatar"
              referrerpolicy="no-referrer"
            />
          </div>
          <div class="welcome-text">
            <div class="welcome-tag">
              <span>ADMINISTRACIÓN CENTRAL</span>
            </div>
            <h1 class="welcome-name">Hola, {{ admin()?.name || 'Gonzalo Gramaglia' }}</h1>
            <p class="welcome-agency">
              {{ admin()?.email || 'gonzagramaglia@gmail.com' }}
            </p>
          </div>
        </div>
      </section>

      <!-- KPI Metrics Grid - 4 Boxes rectangulares sobrias como prestadores -->
      <section class="metrics-grid">
        <!-- 1. Lista de Espera -->
        <div class="metric-card">
          <div class="metric-content">
            <span class="metric-label">Lista de Espera</span>
            <strong class="metric-value">{{ stats().totalWaitlist }}</strong>
            <span class="metric-hint">Prospectos registrados</span>
          </div>
        </div>

        <!-- 2. Socios (con cuenta vinculada a Google) -->
        <div class="metric-card">
          <div class="metric-content">
            <span class="metric-label">Socios</span>
            <strong class="metric-value">{{ stats().totalGoogleLinked }}</strong>
            <span class="metric-hint">Con cuenta vinculada a Google</span>
          </div>
        </div>

        <!-- 3. Clientes (Socios que ya pagaron) -->
        <div class="metric-card">
          <div class="metric-content">
            <span class="metric-label">Clientes</span>
            <strong class="metric-value">{{ stats().totalConverted }}</strong>
            <span class="metric-hint">Socios que ya pagaron</span>
          </div>
        </div>

        <!-- 4. Total Recaudado -->
        <div class="metric-card">
          <div class="metric-content">
            <span class="metric-label">Total Recaudado</span>
            <strong class="metric-value">{{ stats().confirmedRevenue | ars }}</strong>
            <span class="metric-hint">{{ stats().approvedReceiptsCount }} pagos acreditados</span>
          </div>
        </div>
      </section>

      <!-- Sección 1: Nómina Reciente de Socios y Waitlist -->
      <section class="dash-card">
        <div class="card-head">
          <h2 class="card-title">Últimos Socios Registrados</h2>
          <a routerLink="/socios" class="view-all-link">
            <span>Ver nómina completa ({{ stats().totalRecords }})</span>
          </a>
        </div>

        @if (recentMembers().length === 0) {
          <p class="empty-text">No hay miembros registrados todavía.</p>
        } @else {
          <div class="table-wrap">
            <table class="dash-data-table">
              <thead>
                <tr>
                  <th># Socio</th>
                  <th>Titular</th>
                  <th>Email</th>
                  <th>Membresía</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                @for (m of recentMembers(); track m.id) {
                  <tr>
                    <td>
                      @if (m.type === 'socio') {
                        <span class="badge-socio-num">#{{ m.position }}</span>
                      } @else {
                        <span class="badge-waitlist">Waitlist</span>
                      }
                    </td>
                    <td>
                      <strong class="row-name">{{
                        m.fullName && m.fullName !== 'Lista de Espera (Email)'
                          ? m.fullName
                          : '—'
                      }}</strong>
                    </td>
                    <td>
                      <span class="email-link">{{ m.email }}</span>
                    </td>
                    <td>
                      <span class="tier-pill" [attr.data-tier]="m.membershipTier">
                        {{ m.membershipTier | uppercase }}
                      </span>
                    </td>
                    <td>
                      <div class="tags-row">
                        @if (m.googleLinked) {
                          <span
                            class="pill-google"
                            [class.is-provider-google]="isProvider(m)"
                            title="Google Vinculado"
                            >GOOGLE</span
                          >
                        }
                        @if (m.converted) {
                          <span class="pill-converted" title="Pagó al menos una experiencia"
                            >Pago OK</span
                          >
                        } @else {
                          <span class="pill-sin-pago" title="Sin pago registrado">Sin pago</span>
                        }
                      </div>
                    </td>
                    <td>
                      <span class="row-date">{{ m.createdAt | fecha: 'corta' }}</span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <!-- Sección 2: Conciliación de Pagos y Comprobantes Recientes -->
      <section class="dash-card">
        <div class="card-head">
          <h2 class="card-title">Últimos Comprobantes Recibidos</h2>
          <a routerLink="/comprobantes" class="view-all-link">
            <span>Ver todos los comprobantes ({{ stats().totalSubmissions }})</span>
          </a>
        </div>

        @if (recentSubmissions().length === 0) {
          <p class="empty-text">No hay comprobantes enviados recientemente.</p>
        } @else {
          <div class="table-wrap">
            <table class="dash-data-table">
              <thead>
                <tr>
                  <th>Referencia</th>
                  <th>Socio</th>
                  <th>Experiencia</th>
                  <th>Fecha Salida</th>
                  <th>Cupos</th>
                  <th>Importe</th>
                  <th class="text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                @for (sub of recentSubmissions(); track sub.id) {
                  <tr [class.row-pending]="sub.status === 'pendiente'">
                    <td>
                      <span class="ref-tag">{{ sub.reference }}</span>
                    </td>
                    <td>
                      <div class="cell-stack">
                        <strong class="row-name">{{ sub.fullName }}</strong>
                        <span class="row-sub">DNI: {{ sub.dni }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="exp-title-cell">{{ sub.experienceTitle }}</span>
                    </td>
                    <td>
                      <span class="row-date">{{ sub.date | fecha: 'corta' }}</span>
                    </td>
                    <td>
                      <span class="seats-badge">{{ sub.participants }} pers.</span>
                    </td>
                    <td>
                      <strong class="amount-cell">{{ sub.amountArs | ars }}</strong>
                    </td>
                    <td class="text-right">
                      <button type="button" class="btn-review" (click)="openReceipt(sub)">
                        Revisar
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <!-- Sección 3: Prestadores Oficiales y Nuevas Postulaciones -->
      <section class="dash-card">
        <div class="card-head">
          <h2 class="card-title">Prestadores y Nuevas Postulaciones</h2>
          <a routerLink="/prestadores" class="view-all-link">
            <span>Ver todos los prestadores ({{ totalDashboardProvidersCount() }})</span>
          </a>
        </div>

        @if (recentDashboardProviders().length === 0) {
          <p class="empty-text">No hay prestadores ni postulaciones registradas todavía.</p>
        } @else {
          <div class="table-wrap">
            <table class="dash-data-table">
              <thead>
                <tr>
                  <th>Prestador / Guía</th>
                  <th>Agencia / Emprendimiento</th>
                  <th>Contacto</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th class="text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                @for (item of recentDashboardProviders(); track item.id) {
                  <tr>
                    <td>
                      <div class="cell-stack">
                        <strong class="row-name">{{ item.name }}</strong>
                        <span class="row-email">{{ item.email }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="exp-title-cell">{{ item.agency }}</span>
                    </td>
                    <td>
                      @if (item.phone && item.phone !== '—') {
                        <a
                          [href]="getWaLink(item.phone, item.name)"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="contact-whatsapp"
                          [class.is-applicant]="item.origin !== 'official'"
                          title="Contactar vía WhatsApp"
                        >
                          <span>{{ item.phone }}</span>
                        </a>
                      } @else {
                        <span class="row-sub">—</span>
                      }
                    </td>
                    <td>
                      <span class="status-badge" [attr.data-status]="item.status">
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
                    <td>
                      <span class="row-date">{{ item.createdAt | fecha: 'corta' }}</span>
                    </td>
                    <td class="text-right">
                      @if (item.origin === 'official' || item.status === 'aprobado') {
                        <a
                          [routerLink]="getProviderFicheRoute(item)"
                          class="btn-review"
                          title="Ver ficha del prestador"
                        >
                          <span>Ver Ficha</span>
                        </a>
                      } @else if (item.rawApp) {
                        <button type="button" class="btn-review" (click)="openApplication(item.rawApp)">
                          Revisar
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <!-- Sección 4: Solicitudes de Nuevas Experiencias (Prestadores) -->
      <section class="dash-card">
        <div class="card-head">
          <h2 class="card-title">Solicitudes de Nuevas Experiencias</h2>
          <div class="head-actions">
            @if (store.pendingExperienceRequestsCount() > 0) {
              <span class="pending-pill has-pending">
                {{ store.pendingExperienceRequestsCount() }} pendientes de revisión
              </span>
            } @else {
              <span class="pending-pill">0 pendientes</span>
            }
            <a
              routerLink="/experiencias"
              [queryParams]="{ tab: 'postulaciones' }"
              class="view-all-link"
            >
              <span>Ver propuestas ({{ store.experienceRequests().length }})</span>
            </a>
          </div>
        </div>

        @if (pendingExperienceRequests().length === 0) {
          <p class="empty-text">No hay solicitudes de experiencias pendientes de revisión.</p>
        } @else {
          <div class="table-wrap">
            <table class="dash-data-table">
              <thead>
                <tr>
                  <th>Prestador</th>
                  <th>Experiencia Propuesta</th>
                  <th>Región & Dificultad</th>
                  <th>Arancel</th>
                  <th>Fecha</th>
                  <th class="text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                @for (req of pendingExperienceRequests(); track req.id) {
                  <tr [class.row-pending]="req.status === 'pendiente'">
                    <td>
                      <div class="cell-stack">
                        <strong class="row-name">{{ req.providerName }}</strong>
                        <span class="row-sub">{{ req.providerAgency }}</span>
                      </div>
                    </td>
                    <td>
                      <div class="exp-cell-wrap">
                        <img
                          [src]="getProposalCover(req.coverImage)"
                          (error)="onImgError($event)"
                          alt="Portada"
                          class="exp-cell-thumb"
                        />
                        <div class="exp-cell-text">
                          <strong class="exp-title-cell">{{ req.title }}</strong>
                          <span class="exp-kicker-sub">{{ req.kicker }}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div class="cell-stack">
                        <span class="row-region">{{ req.region }}</span>
                        <span class="diff-tag">{{ req.difficulty }}</span>
                      </div>
                    </td>
                    <td>
                      <div class="cell-stack">
                        <strong class="amount-cell">{{ req.priceArs | ars }}</strong>
                        @if (req.priceUsd) {
                          <span class="row-usd">USD {{ req.priceUsd }}</span>
                        }
                      </div>
                    </td>
                    <td>
                      <span class="row-date">{{ req.createdAt | fecha: 'corta' }}</span>
                    </td>
                    <td class="text-right">
                      <button type="button" class="btn-review" (click)="openExperienceRequest(req)">
                        Revisar
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <!-- Sección 5: Experiencias de la Web (Siguiente estadio de las propuestas) -->
      <section class="dash-card">
        <div class="card-head">
          <div>
            <h2 class="card-title">Experiencias de la Web</h2>
          </div>
          <div class="head-actions">
            <span class="pending-pill">{{ webExperiences().length }} publicadas</span>
            <a routerLink="/experiencias" class="view-all-link">
              <span>Ver catálogo completo ({{ webExperiences().length }})</span>
            </a>
          </div>
        </div>

        @if (webExperiences().length === 0) {
          <p class="empty-text">No hay experiencias cargadas en el catálogo.</p>
        } @else {
          <div class="table-wrap">
            <table class="dash-data-table exp-web-table">
              <thead>
                <tr>
                  <th>Experiencia</th>
                  <th>Ruta Web Oficial</th>
                  <th>Región & Dificultad</th>
                  <th>Arancel</th>
                  <th>Cupo Máx.</th>
                  <th>Estado</th>
                  <th class="text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                @for (exp of webExperiences(); track exp.id) {
                  <tr>
                    <td>
                      <div class="exp-cell-wrap">
                        <img
                          [src]="exp.coverImage || '/assets/images/kayak-club-de-experiencias.jpg'"
                          [alt]="exp.title"
                          class="exp-cell-thumb"
                        />
                        <div class="exp-cell-text">
                          <div class="exp-title-row">
                            <strong class="exp-title-cell">{{ exp.title }}</strong>
                            @if (isClub(exp)) {
                              <span class="club-chip" title="Experiencia Oficial del Club de Experiencias">
                                Club
                              </span>
                            } @else if (exp.providerName) {
                              <span class="provider-chip" title="Prestador oficial de la experiencia">
                                {{ exp.providerName }}
                              </span>
                            }
                          </div>
                          <span class="exp-kicker-sub">{{ exp.kicker || 'EXPEDICIÓN' }}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <a
                        [href]="getPublicExperienceUrl(exp)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="route-link-cell"
                        title="Abrir ruta pública"
                      >
                        <code>/.../{{ exp.slug }}</code>
                      </a>
                    </td>
                    <td>
                      <div class="cell-stack">
                        <span class="row-region">{{ exp.region }}</span>
                        <span class="diff-tag">{{ exp.difficulty }}</span>
                      </div>
                    </td>
                    <td>
                      <div class="cell-stack">
                        <strong class="amount-cell">{{ exp.priceArs | ars }}</strong>
                        @if (exp.priceUsd) {
                          <span class="row-usd">USD {{ exp.priceUsd }}</span>
                        }
                      </div>
                    </td>
                    <td>
                      <span class="cupo-tag">{{ exp.maxSpotsPerGroup }} pers.</span>
                    </td>
                    <td>
                      <span
                        class="status-badge"
                        [attr.data-status]="exp.status === 'publicada' ? 'aprobado' : exp.status === 'oculta' ? 'dado_de_baja' : exp.status === 'rechazada' ? 'rechazado' : 'pendiente'"
                      >
                        {{
                          exp.status === 'publicada'
                            ? 'Publicada'
                            : exp.status === 'pendiente'
                              ? 'Postulación'
                              : exp.status === 'oculta'
                                ? 'Pausada'
                                : exp.status === 'rechazada'
                                  ? 'Rechazada'
                                  : 'Borrador'
                        }}
                      </span>
                    </td>
                    <td class="text-right">
                      <a [routerLink]="getExperienceFicheRoute(exp.slug)" class="btn-review">
                        Ver Ficha
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <!-- Modal de Revisión y Validación de Comprobante (Idéntico a /comprobantes) -->
      @if (selectedSubmission(); as sub) {
        <div class="modal-backdrop" (click)="closeReceipt()">
          <div
            class="receipt-modal-card"
            (click)="$event.stopPropagation()"
            role="dialog"
            aria-modal="true"
          >
            <!-- Columna Izquierda: Vista Previa del Archivo -->
            <div class="receipt-modal-preview">
              @if (isPdf(sub.receipt.mimeType)) {
                <div class="pdf-preview-box">
                  <mat-icon class="pdf-icon-big">picture_as_pdf</mat-icon>
                  <strong>{{ sub.receipt.fileName }}</strong>
                  <a [href]="sub.receipt.url" target="_blank" rel="noopener" class="open-pdf-btn">
                    <mat-icon>open_in_new</mat-icon>
                    <span>Abrir PDF en pestaña nueva</span>
                  </a>
                </div>
              } @else {
                <div class="img-preview-box">
                  <img
                    [src]="sub.receipt.url"
                    [alt]="'Comprobante de ' + sub.fullName"
                    class="preview-img"
                  />
                </div>
              }
            </div>

            <!-- Columna Derecha: Detalle y Acciones -->
            <div class="receipt-modal-details">
              <div class="modal-head">
                <div>
                  <span class="section-kicker">DETALLE DE COMPROBANTE</span>
                  <h2 class="modal-title font-mono">{{ sub.reference }}</h2>
                </div>
                <button
                  type="button"
                  class="modal-close-btn"
                  (click)="closeReceipt()"
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>

              <!-- Cuadro de Monto Esperado -->
              <div class="expected-amount-card">
                <span class="exp-lbl">Importe Transferido</span>
                <strong class="exp-val text-green">{{ sub.amountArs | ars }}</strong>
                <span class="exp-hint"
                  >Verificá que el comprobante adjunto coincida con este importe.</span
                >
              </div>

              <!-- Lista de Datos -->
              <dl class="meta-data-list">
                <div>
                  <dt>Titular:</dt>
                  <dd>
                    <strong>{{ sub.fullName }}</strong>
                  </dd>
                </div>
                <div>
                  <dt>DNI:</dt>
                  <dd class="font-mono">{{ sub.dni }}</dd>
                </div>
                <div>
                  <dt>Email:</dt>
                  <dd>{{ sub.email }}</dd>
                </div>
                <div>
                  <dt>Teléfono:</dt>
                  <dd class="phone-data-row">
                    <span>{{ sub.phone || '—' }}</span>
                    @if (getReservationWhatsappLink(sub); as waLink) {
                      <a
                        [href]="waLink"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="contact-whatsapp-link"
                        title="Contactar por WhatsApp sobre esta reserva"
                      >
                        <mat-icon class="arrow-up-right-icon">north_east</mat-icon>
                        <span>Contactar</span>
                      </a>
                    }
                  </dd>
                </div>
                <div>
                  <dt>Experiencia:</dt>
                  <dd>{{ sub.experienceTitle }}</dd>
                </div>
                <div>
                  <dt>Fecha Salida:</dt>
                  <dd>{{ sub.date | fecha: 'larga' }}</dd>
                </div>
                <div>
                  <dt>Cupos:</dt>
                  <dd>{{ sub.participants }} personas</dd>
                </div>
                <div>
                  <dt>Enviado el:</dt>
                  <dd>{{ sub.submittedAt | fecha: 'corta' }}</dd>
                </div>
                @if (sub.discountCode) {
                  <div>
                    <dt>Descuento:</dt>
                    <dd>{{ sub.discountCode }} (-{{ sub.discountArs | ars }})</dd>
                  </div>
                }
              </dl>

              <!-- Estado del Comprobante -->
              <div
                class="status-summary-box"
                [attr.data-status]="sub.status"
              >
                <mat-icon>{{
                  sub.status === 'aprobado'
                    ? 'verified'
                    : sub.status === 'rechazado'
                      ? 'cancel'
                      : 'schedule'
                }}</mat-icon>
                <div>
                  <strong>
                    @if (sub.status === 'aprobado') {
                      Pago APROBADO
                    } @else if (sub.status === 'rechazado') {
                      Pago RECHAZADO
                    } @else {
                      Pago PENDIENTE DE REVISIÓN
                    }
                  </strong>
                  @if (sub.reviewedAt) {
                    <span> · {{ sub.reviewedAt | fecha: 'corta' }}</span>
                  }
                  @if (sub.status === 'rechazado' && sub.rejectionReason) {
                    <p class="rej-text">{{ sub.rejectionReason }}</p>
                  }
                </div>
              </div>

              <!-- Acciones de Validación / Descarga -->
              @if (!rejecting()) {
                <div class="modal-actions-row">
                  @if (sub.status === 'pendiente') {
                    <button type="button" class="btn-approve" (click)="quickApprove(sub.id)">
                      Aprobar Pago
                    </button>
                  }
                  @if (sub.status !== 'rechazado') {
                    <button type="button" class="btn-reject" (click)="rejecting.set(true)">
                      Rechazar Pago
                    </button>
                  }
                  <a
                    [href]="sub.receipt.url"
                    [download]="sub.receipt.fileName"
                    target="_blank"
                    rel="noopener"
                    class="btn-download-action"
                    title="Descargar comprobante"
                  >
                    <span>Descargar comprobante</span>
                  </a>
                </div>
              } @else {
                <div class="reject-box">
                  <label class="reject-label" for="rej-reason-input">Motivo del Rechazo:</label>
                  <div class="quick-reasons-row">
                    <button type="button" class="quick-reason-chip" (click)="rejectionReason.set('Comprobante ilegible o borroso.')">Ilegible</button>
                    <button type="button" class="quick-reason-chip" (click)="rejectionReason.set('El monto transferido no coincide con el total de la reserva.')">Monto incorrecto</button>
                    <button type="button" class="quick-reason-chip" (click)="rejectionReason.set('La transferencia no impactó en la cuenta bancaria.')">No acreditado</button>
                    <button type="button" class="quick-reason-chip" (click)="rejectionReason.set('Comprobante duplicado o ya utilizado.')">Duplicado</button>
                  </div>
                  <textarea
                    id="rej-reason-input"
                    class="reject-textarea"
                    rows="2"
                    placeholder="Ej: El importe no coincide con el total..."
                    [value]="rejectionReason()"
                    (input)="rejectionReason.set($any($event.target).value)"
                  ></textarea>
                  <div class="reject-actions">
                    <button type="button" class="cancel-btn" (click)="rejecting.set(false)">
                      Cancelar
                    </button>
                    <button
                      type="button"
                      class="confirm-reject-btn"
                      [disabled]="rejectionReason().trim().length < 4"
                      (click)="confirmReject(sub.id)"
                    >
                      Confirmar Rechazo
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- Modal Rápido de Revisión de Postulación (Componente Compartido) -->
      @if (selectedApplication(); as app) {
        <app-admin-application-modal
          [application]="app"
          (closed)="closeApplication()"
          (statusChanged)="onApplicationStatusChanged($event)"
        />
      }

      <!-- Modal de Revisión de Ficha de Nueva Experiencia -->
      @if (selectedExperienceRequest(); as expReq) {
        <div class="modal-backdrop" (click)="closeExperienceRequest()">
          <div class="modal-dialog exp-req-modal-card" (click)="$event.stopPropagation()">
            <!-- Cabecera -->
            <div class="modal-head">
              <div class="modal-head-info">
                <span class="modal-kicker">{{ expReq.kicker }}</span>
                <h2 class="modal-title">{{ expReq.title }}</h2>
                <p class="modal-sub-author">
                  Propuesta de <strong>{{ expReq.providerName }}</strong> ({{
                    expReq.providerAgency
                  }})
                </p>
              </div>
              <button
                type="button"
                class="modal-close-btn"
                (click)="closeExperienceRequest()"
                aria-label="Cerrar modal"
              >
                ×
              </button>
            </div>

            <!-- Cuerpo Scrolleable -->
            <div class="modal-body">
              <!-- Banner Multimedia -->
              @if (expReq.coverImage || expReq.coverImageName || expReq.coverVideoName) {
                <div class="exp-req-media-banner">
                  <img
                    [src]="getProposalCover(expReq.coverImage)"
                    (error)="onImgError($event)"
                    alt="Portada de la propuesta"
                    class="exp-req-cover-img"
                  />
                  <div class="exp-req-media-tags">
                    @if (expReq.coverImageName) {
                      <span class="exp-media-tag"
                        ><mat-icon>image</mat-icon> {{ expReq.coverImageName }}</span
                      >
                    }
                    @if (expReq.coverVideoName) {
                      <span class="exp-media-tag"
                        ><mat-icon>videocam</mat-icon> Video: {{ expReq.coverVideoName }}</span
                      >
                    }
                  </div>
                </div>
              }

              <!-- 1. Síntesis descriptiva -->
              <div class="app-desc-box quote-accent">
                <span class="desc-heading">Síntesis descriptiva</span>
                <p class="desc-content">{{ expReq.subheading }}</p>
              </div>

              <!-- 2. Ficha Técnica en Grid -->
              <div class="exp-req-specs-grid">
                <div class="spec-cell">
                  <span class="spec-lbl">Región</span>
                  <strong>{{ expReq.region }}</strong>
                </div>
                <div class="spec-cell">
                  <span class="spec-lbl">Dificultad</span>
                  <strong>{{ expReq.difficulty }}</strong>
                </div>
                <div class="spec-cell">
                  <span class="spec-lbl">Duración</span>
                  <strong>{{ expReq.duration }}</strong>
                </div>
                <div class="spec-cell">
                  <span class="spec-lbl">Altitud</span>
                  <strong>{{ expReq.altitude || '—' }}</strong>
                </div>
                <div class="spec-cell">
                  <span class="spec-lbl">Cupo Máx.</span>
                  <strong>{{ expReq.capacity }} personas</strong>
                </div>
                <div class="spec-cell">
                  <span class="spec-lbl">Temporada</span>
                  <strong>{{ expReq.season }}</strong>
                </div>
              </div>

              <!-- 3. Arancel & Promociones Card Premium -->
              <div class="exp-tariff-card">
                <div class="tariff-main-col">
                  <span class="tariff-kicker">Arancel por Persona</span>
                  <div class="tariff-figures">
                    <span class="tariff-ars">{{ expReq.priceArs | ars }}</span>
                    @if (expReq.priceUsd) {
                      <span class="tariff-usd-pill">Referencia: USD {{ expReq.priceUsd }}</span>
                    }
                  </div>
                </div>

                @if (expReq.capacity) {
                  <div class="tariff-capacity-col">
                    <span class="tariff-cap-lbl">Cupo Máximo</span>
                    <strong class="tariff-cap-val">{{ expReq.capacity }} participantes</strong>
                  </div>
                }
              </div>

              @if (expReq.promosAndPricing) {
                <div class="app-desc-box promo-accent">
                  <span class="desc-heading"
                    >Promociones, descuentos y consideraciones tarifarias</span
                  >
                  <p class="desc-content">{{ expReq.promosAndPricing }}</p>
                </div>
              }

              <!-- 4. Cronograma & Itinerario -->
              <div class="app-desc-box">
                <span class="desc-heading">Cronograma e itinerario propuesto</span>
                <p class="desc-content" style="white-space: pre-line;">{{ expReq.itinerary }}</p>
              </div>

              <!-- 5. Logística, Seguridad & Requisitos -->
              <dl class="modal-dl">
                <div>
                  <dt>Punto de Encuentro:</dt>
                  <dd>{{ expReq.meetingPoint }}</dd>
                </div>
                @if (expReq.meetingPointUrl) {
                  <div>
                    <dt>Ubicación (Google Maps):</dt>
                    <dd>
                      <a [href]="expReq.meetingPointUrl" target="_blank" rel="noopener noreferrer">{{
                        expReq.meetingPointUrl
                      }}</a>
                    </dd>
                  </div>
                }
                <div>
                  <dt>Fechas / Frecuencia:</dt>
                  <dd>{{ expReq.dates }}</dd>
                </div>
                <div>
                  <dt>Provisto por el Prestador:</dt>
                  <dd>{{ expReq.includedServices }}</dd>
                </div>
                <div>
                  <dt>Requisitos del usuario:</dt>
                  <dd>{{ expReq.participantRequirements }}</dd>
                </div>
                @if (expReq.notes) {
                  <div>
                    <dt>Notas / Enlaces:</dt>
                    <dd>
                      <a [href]="expReq.notes" target="_blank" rel="noopener" class="dt-link">{{
                        expReq.notes
                      }}</a>
                    </dd>
                  </div>
                }
                <div>
                  <dt>Contacto prestador:</dt>
                  <dd>
                    <a [href]="'mailto:' + expReq.providerEmail" class="dt-link">{{
                      expReq.providerEmail
                    }}</a>
                  </dd>
                </div>
              </dl>

              @if (expReq.albumPhotos && expReq.albumPhotos.length > 0) {
                <div class="exp-album-review-box">
                  <span class="desc-heading">Álbum de fotos de la experiencia ({{ expReq.albumPhotos.length }})</span>
                  <div class="exp-album-thumbnails-grid">
                    @for (photo of expReq.albumPhotos; track $index) {
                      <div class="album-thumb-card">
                        <img [src]="photo.url" (error)="onImgError($event)" [alt]="photo.caption || 'Foto de propuesta'" class="album-thumb-img" />
                        @if (photo.caption) {
                          <span class="album-thumb-caption">{{ photo.caption }}</span>
                        }
                      </div>
                    }
                  </div>
                </div>
              }

              <div class="exp-provider-banking-card">
                <span class="desc-heading">Información del Prestador y Datos Bancarios</span>
                <div class="provider-banking-grid">
                  <div class="banking-cell">
                    <span class="banking-lbl">Prestador</span>
                    <strong>{{ expReq.providerName }}</strong>
                  </div>
                  <div class="banking-cell">
                    <span class="banking-lbl">Emprendimiento / Agencia</span>
                    <strong>{{ expReq.providerAgency || 'Particular' }}</strong>
                  </div>
                  <div class="banking-cell">
                    <span class="banking-lbl">Email</span>
                    <strong>{{ expReq.providerEmail }}</strong>
                  </div>
                  @if (expReq.providerPhone) {
                    <div class="banking-cell">
                      <span class="banking-lbl">Teléfono / WhatsApp</span>
                      <strong>{{ expReq.providerPhone }}</strong>
                    </div>
                  }
                  @if (expReq.providerCuitDni) {
                    <div class="banking-cell">
                      <span class="banking-lbl">CUIT / DNI</span>
                      <strong>{{ expReq.providerCuitDni }}</strong>
                    </div>
                  }
                  @if (expReq.providerCbuAlias) {
                    <div class="banking-cell">
                      <span class="banking-lbl">CBU / Alias</span>
                      <strong>{{ expReq.providerCbuAlias }}</strong>
                    </div>
                  }
                  @if (expReq.providerBankName) {
                    <div class="banking-cell">
                      <span class="banking-lbl">Banco / Entidad</span>
                      <strong>{{ expReq.providerBankName }}</strong>
                    </div>
                  }
                </div>
              </div>
            </div>

            <!-- Acciones al Pie -->
            <div class="modal-actions">
              <div class="state-buttons">
                @if (expReq.status === 'pendiente') {
                  <button
                    type="button"
                    class="btn-state btn-approve"
                    (click)="approveExperience(expReq.id)"
                  >
                    Aprobar y publicar
                  </button>
                  <button
                    type="button"
                    class="btn-state btn-reject"
                    (click)="rejectExperience(expReq.id)"
                  >
                    Rechazar
                  </button>
                } @else {
                  <span
                    class="status-reviewed-tag"
                    [class.is-approved]="expReq.status === 'aprobada'"
                  >
                    {{
                      expReq.status === 'aprobada'
                        ? '✓ Propuesta Aprobada'
                        : '✕ Propuesta Rechazada'
                    }}
                  </span>
                }

                @if (expReq.providerPhone) {
                  <a
                    [href]="getWhatsappLink(expReq.providerPhone, expReq.providerName)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-state btn-whatsapp btn-contact-provider"
                  >
                    <span>Contactar prestador</span>
                  </a>
                }
              </div>

              <button type="button" class="btn-close" (click)="closeExperienceRequest()">
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
      .dash-container {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        padding-top: 1.5rem;
      }

      /* Welcome Card */
      .welcome-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(26, 14, 8, 0.78);
        border: 1px solid rgba(255, 95, 0, 0.4);
        border-radius: 2px;
        padding: 1.75rem 2rem;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(14px);
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

      .admin-avatar {
        width: 96px;
        height: 96px;
        border-radius: 4px;
        border: 2px solid #ff5f00;
        box-shadow: 0 4px 16px rgba(255, 95, 0, 0.35);
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
        color: #ff5f00;
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

      /* KPI Metrics Grid - 4 Boxes sobrias rectangulares */
      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 1rem;
      }

      @media (max-width: 992px) {
        .metrics-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 768px) {
        .welcome-card {
          padding: 1.25rem 1rem;
        }
        .welcome-main {
          gap: 1rem;
        }
        .admin-avatar {
          width: 76px;
          height: 76px;
        }
        .metrics-grid {
          grid-template-columns: repeat(2, 1fr) !important;
          gap: 0.65rem;
        }
        .metric-card {
          padding: 0.85rem 0.75rem;
          min-height: auto;
        }
        .metric-label {
          font-size: 0.62rem;
        }
        .metric-value {
          font-size: 1.25rem;
          margin: 0.1rem 0;
        }
        .metric-hint {
          font-size: 0.62rem;
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
      }

      @media (max-width: 480px) {
        .welcome-main {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.75rem;
        }
        .welcome-name {
          font-size: 1.35rem;
        }
        .metrics-grid {
          grid-template-columns: 1fr !important;
        }
      }

      .metric-card {
        display: flex;
        flex-direction: column;
        justify-content: center;
        background: rgba(22, 12, 6, 0.85);
        border: 1px solid rgba(255, 95, 0, 0.32);
        border-radius: 2px;
        padding: 1.35rem 1.25rem;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
        backdrop-filter: blur(14px);
        min-height: 110px;
        box-sizing: border-box;
      }

      .metric-content {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      .metric-label {
        display: block;
        font-size: 0.72rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.65);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        line-height: 1.2;
      }

      .metric-value {
        display: block;
        font-size: 1.75rem;
        font-weight: 800;
        color: #ffffff;
        line-height: 1.15;
        margin: 0.15rem 0;
        letter-spacing: -0.02em;
      }

      .metric-hint {
        display: block;
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.5);
        line-height: 1.2;
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

      /* Section Cards */
      .dash-card {
        background: rgba(22, 12, 6, 0.85);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 2px;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .card-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .card-kicker {
        display: block;
        font-size: 0.68rem;
        font-weight: 800;
        color: #ff5f00;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        margin-bottom: 0.2rem;
      }

      .card-title {
        font-size: 1.25rem;
        font-weight: 700;
        color: #ffffff;
        margin: 0;
      }

      .card-sub-info {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.7);
        display: block;
        margin-top: 0.35rem;
      }

      .route-link-cell {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        color: #ffaa73;
        text-decoration: none;
        font-size: 0.82rem;
        font-family: inherit;
        background: rgba(255, 95, 0, 0.1);
        padding: 0.25rem 0.55rem;
        border-radius: 3px;
        border: 1px solid rgba(255, 95, 0, 0.25);
        transition: all 0.2s ease;
      }

      .route-link-cell code {
        font-family: inherit;
      }

      .route-link-cell:hover {
        background: rgba(255, 95, 0, 0.2);
        color: #ffffff;
        border-color: #ff5f00;
      }

      .link-icon-mini {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }

      .cupo-tag {
        display: inline-block;
        padding: 0.25rem 0.55rem;
        border-radius: 3px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #ffffff;
        font-size: 0.78rem;
        font-weight: 600;
      }

      .view-all-link {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        color: #ff8533;
        text-decoration: none;
        font-size: 0.82rem;
        font-weight: 700;
      }

      .view-all-link:hover {
        color: #ffaa73;
        text-decoration: underline;
      }

      .view-all-link mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      .empty-text {
        color: rgba(255, 255, 255, 0.6);
        font-size: 0.85rem;
        margin: 0;
      }

      /* Data Tables */
      .table-wrap {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        width: 100%;
        max-width: 100%;
      }

      .table-wrap::-webkit-scrollbar {
        height: 6px;
      }

      .table-wrap::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.25);
        border-radius: 3px;
      }

      .table-wrap::-webkit-scrollbar-thumb {
        background: rgba(255, 95, 0, 0.4);
        border-radius: 3px;
      }

      .table-wrap::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 95, 0, 0.7);
      }

      .dash-data-table {
        width: 100%;
        min-width: 720px;
        border-collapse: collapse;
        font-size: 0.82rem;
        text-align: left;
      }

      .dash-data-table.exp-web-table {
        min-width: 1080px;
      }

      .exp-web-table .cupo-tag,
      .exp-web-table .status-badge,
      .exp-web-table .btn-review {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 28px;
        box-sizing: border-box;
        line-height: 1;
      }

      .exp-web-table .status-badge {
        padding: 0 0.65rem;
        font-size: 0.74rem;
        font-weight: 800;
        border-radius: 3px;
        border: 1px solid transparent;
      }

      .exp-web-table .status-badge[data-status='aprobado'] {
        background: rgba(16, 185, 129, 0.2);
        border-color: rgba(52, 211, 153, 0.45);
        color: #34d399;
      }

      .exp-web-table .status-badge[data-status='pendiente'] {
        background: rgba(255, 95, 0, 0.2);
        border-color: rgba(255, 95, 0, 0.45);
        color: #ff8533;
      }

      .exp-web-table .status-badge[data-status='rechazado'],
      .exp-web-table .status-badge[data-status='dado_de_baja'] {
        background: rgba(239, 68, 68, 0.2);
        border-color: rgba(239, 68, 68, 0.45);
        color: #fca5a5;
      }

      .exp-web-table .cupo-tag {
        padding: 0 0.55rem;
      }

      .exp-web-table .btn-review {
        padding: 0 0.75rem;
      }

      .dash-data-table th {
        background: rgba(35, 18, 10, 0.8);
        padding: 0.75rem 0.85rem;
        font-size: 0.68rem;
        font-weight: 800;
        color: #ff8533;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        border-bottom: 1px solid rgba(255, 95, 0, 0.25);
        white-space: nowrap;
      }

      .dash-data-table td {
        padding: 0.75rem 0.85rem;
        border-bottom: 1px solid rgba(255, 95, 0, 0.12);
        color: rgba(255, 255, 255, 0.85);
        vertical-align: middle;
      }

      .dash-data-table tbody tr:hover {
        background: rgba(255, 95, 0, 0.06);
      }

      .dash-data-table tbody tr.row-pending {
        background: rgba(255, 95, 0, 0.04);
      }

      .badge-socio-num {
        display: inline-block;
        padding: 0.2rem 0.45rem;
        background: rgba(255, 95, 0, 0.18);
        border: 1px solid rgba(255, 95, 0, 0.45);
        color: #ffaa73;
        font-family: inherit;
        font-weight: 700;
        font-size: 0.75rem;
        border-radius: 2px;
        white-space: nowrap;
      }

      .badge-waitlist {
        display: inline-block;
        padding: 0.15rem 0.45rem;
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.75);
        font-size: 0.68rem;
        font-weight: 700;
        border-radius: 2px;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .ref-tag {
        display: inline-block;
        padding: 0.2rem 0.5rem;
        background: rgba(255, 95, 0, 0.15);
        border: 1px solid rgba(255, 95, 0, 0.35);
        color: #ffaa73;
        font-family: inherit;
        font-weight: 700;
        font-size: 0.75rem;
        border-radius: 2px;
        white-space: nowrap;
      }

      .cell-stack {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
      }

      .row-name {
        color: #ffffff;
      }

      .row-sub {
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.5);
      }

      .email-link {
        color: #ffffff !important;
        font-family: inherit;
        font-size: 0.75rem;
        white-space: nowrap;
      }

      .row-email {
        color: rgba(255, 255, 255, 0.65);
        font-family: inherit;
        font-size: 0.75rem;
        white-space: nowrap;
      }

      .exp-title-cell {
        color: #ffffff;
        font-weight: 500;
      }

      .exp-title-row {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex-wrap: wrap;
      }

      .club-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.2rem;
        background: rgba(255, 95, 0, 0.2);
        border: 1px solid rgba(255, 95, 0, 0.45);
        color: #ff9500;
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 0.1rem 0.4rem;
        border-radius: 3px;
        line-height: 1;
      }

      .club-chip mat-icon {
        font-size: 12px;
        width: 12px;
        height: 12px;
      }

      .provider-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.2rem;
        background: rgba(14, 165, 233, 0.16);
        border: 1px solid rgba(56, 189, 248, 0.45);
        color: #38bdf8;
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 0.1rem 0.4rem;
        border-radius: 3px;
        line-height: 1;
      }

      .provider-chip mat-icon {
        font-size: 12px;
        width: 12px;
        height: 12px;
      }

      .seats-badge {
        display: inline-block;
        padding: 0.15rem 0.45rem;
        background: rgba(255, 255, 255, 0.08);
        border-radius: 2px;
        font-size: 0.75rem;
        font-weight: 700;
        white-space: nowrap;
      }

      .amount-cell {
        color: #ffffff;
        white-space: nowrap;
      }

      .font-mono {
        font-family: inherit;
      }

      .tier-pill {
        display: inline-block;
        padding: 0.18rem 0.5rem;
        font-size: 0.65rem;
        font-weight: 700;
        border-radius: 2px;
        background: rgba(255, 255, 255, 0.08);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.25);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .tier-pill[data-tier='fundador'] {
        background: rgba(128, 179, 255, 0.14);
        border: 1px solid rgba(128, 179, 255, 0.4);
        color: #80b3ff;
      }

      .tags-row {
        display: flex;
        gap: 0.25rem;
        align-items: center;
        flex-wrap: nowrap;
        white-space: nowrap;
      }

      .pill-google,
      .pill-sin-pago {
        display: inline-flex;
        align-items: center;
        padding: 0.1rem 0.35rem;
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.25);
        color: #ffffff;
        font-size: 0.65rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        border-radius: 2px;
        white-space: nowrap;
      }

      .pill-google.is-provider-google {
        background: #80b3ff;
        border-color: #80b3ff;
        color: #ffffff;
        font-weight: 800;
        box-shadow: 0 0 10px rgba(128, 179, 255, 0.45);
      }

      .pill-converted {
        display: inline-flex;
        align-items: center;
        padding: 0.1rem 0.35rem;
        background: rgba(16, 185, 129, 0.2);
        border: 1px solid rgba(52, 211, 153, 0.45);
        color: #34d399;
        font-size: 0.65rem;
        font-weight: 800;
        border-radius: 2px;
        white-space: nowrap;
      }

      .status-badge {
        display: inline-block;
        padding: 0.2rem 0.5rem;
        font-size: 0.68rem;
        font-weight: 800;
        border-radius: 2px;
        white-space: nowrap;
      }

      .status-badge[data-status='aprobado'] {
        background: rgba(16, 185, 129, 0.2);
        color: #34d399;
      }
      .status-badge[data-status='pendiente'] {
        background: rgba(255, 95, 0, 0.2);
        color: #ff8533;
      }
      .status-badge[data-status='rechazado'] {
        background: rgba(239, 68, 68, 0.2);
        color: #fca5a5;
      }
      .status-badge[data-status='dado_de_baja'] {
        background: rgba(239, 68, 68, 0.2);
        color: #fca5a5;
      }

      .dash-modal-state-btns {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
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

      .btn-review {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.35rem 0.75rem;
        background: rgba(255, 95, 0, 0.18);
        border: 1px solid #ff5f00;
        color: #ffffff;
        font-size: 0.75rem;
        font-weight: 700;
        border-radius: 2px;
        cursor: pointer;
        white-space: nowrap;
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .btn-review:hover {
        background: #ff5f00;
        color: #0b0704;
      }

      .row-date {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.6);
        white-space: nowrap;
      }

      .text-right {
        text-align: right;
      }

      .dash-data-table th.text-right,
      .dash-data-table td.text-right {
        text-align: right;
        position: sticky;
        right: 0;
        z-index: 5;
        background: #140b06;
        box-shadow: -6px 0 16px rgba(0, 0, 0, 0.45);
        white-space: nowrap;
      }

      .dash-data-table th.text-right {
        background: #23120a;
      }

      .dash-data-table tbody tr:hover td.text-right {
        background: #241309;
      }

      /* Modal Rápido */
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(4, 2, 1, 0.65);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        z-index: 1000;
      }

      .quick-modal-card {
        display: grid;
        grid-template-columns: minmax(280px, 0.9fr) minmax(320px, 1.1fr);
        width: min(850px, 100%);
        max-height: min(650px, 90vh);
        background: rgba(20, 10, 5, 0.78);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 3px;
        overflow: hidden;
      }

      /* Modal de Revisión y Validación de Comprobante (Idéntico a admin-receipts) */
      .receipt-modal-card {
        display: grid;
        grid-template-columns: minmax(320px, 1fr) minmax(360px, 1.2fr);
        width: min(960px, 100%);
        max-height: min(720px, 92vh);
        background: rgba(20, 10, 5, 0.78);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 3px;
        box-shadow: 0 25px 70px rgba(0, 0, 0, 0.7);
        overflow: hidden;
      }

      .receipt-modal-preview {
        background: rgba(8, 4, 2, 0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        overflow: auto;
      }

      .preview-img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }

      .pdf-preview-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        text-align: center;
        color: #ffffff;
      }

      .pdf-icon-big {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #ef4444;
      }

      .open-pdf-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem 1rem;
        background: #ff5f00;
        color: #0b0704;
        text-decoration: none;
        font-weight: 700;
        font-size: 0.8rem;
        border-radius: 2px;
      }

      .receipt-modal-details {
        display: flex;
        flex-direction: column;
        padding: 1.75rem;
        overflow-y: auto;
        gap: 1.25rem;
      }

      .modal-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .modal-title {
        color: #ffffff;
        font-size: 1.4rem;
        margin: 0;
      }

      .modal-close-btn {
        background: transparent;
        border: none;
        color: #ffffff;
        font-size: 1.75rem;
        cursor: pointer;
        line-height: 1;
      }

      .expected-amount-card {
        background: rgba(30, 16, 9, 0.85);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 2px;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .exp-lbl {
        font-size: 0.72rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.65);
        text-transform: uppercase;
      }

      .exp-val {
        font-size: 1.75rem;
        font-weight: 800;
      }

      .exp-hint {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.55);
      }

      .meta-data-list {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.65rem 1rem;
        font-size: 0.82rem;
        margin: 0;
      }

      .meta-data-list dt {
        color: rgba(255, 255, 255, 0.5);
      }

      .meta-data-list dd {
        margin: 0;
        color: #ffffff;
      }

      .phone-data-row {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .contact-whatsapp-link {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.15rem 0.55rem;
        font-size: 0.76rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #25d366;
        background: rgba(37, 211, 102, 0.12);
        border: 1px solid rgba(37, 211, 102, 0.35);
        border-radius: 9999px;
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .contact-whatsapp-link:hover {
        background: rgba(37, 211, 102, 0.25);
        border-color: #25d366;
        color: #ffffff;
        transform: translateY(-1px);
      }

      .arrow-up-right-icon {
        font-size: 0.85rem !important;
        width: 0.85rem !important;
        height: 0.85rem !important;
        line-height: 0.85rem !important;
      }

      .status-summary-box {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.85rem 1rem;
        border-radius: 2px;
      }

      .status-summary-box[data-status='aprobado'] {
        background: rgba(16, 185, 129, 0.15);
        border: 1px solid rgba(16, 185, 129, 0.4);
        color: #34d399;
      }

      .status-summary-box[data-status='rechazado'] {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #fca5a5;
      }

      .rej-text {
        font-size: 0.75rem;
        margin: 0.25rem 0 0;
      }

      .modal-actions-row {
        display: flex;
        gap: 0.75rem;
      }

      .btn-reject {
        flex: 1;
        padding: 0.75rem 1rem;
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.6);
        color: #fca5a5;
        font-weight: 700;
        font-size: 0.88rem;
        border-radius: 2px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-reject:hover {
        background: rgba(239, 68, 68, 0.3);
        border-color: #ef4444;
      }

      .btn-download-action {
        flex: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.75rem 1rem;
        background: rgba(0, 220, 130, 0.18);
        border: 1px solid rgba(0, 220, 130, 0.45);
        color: #00dc82;
        font-weight: 700;
        font-size: 0.88rem;
        border-radius: 2px;
        text-decoration: none;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-download-action:hover {
        background: rgba(0, 220, 130, 0.32);
        border-color: #00dc82;
        color: #ffffff;
      }

      .reject-box {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        background: rgba(30, 10, 8, 0.7);
        border: 1px solid rgba(239, 68, 68, 0.4);
        padding: 1rem;
        border-radius: 2px;
      }

      .reject-label {
        font-size: 0.78rem;
        font-weight: 700;
        color: #fca5a5;
      }

      .quick-reasons-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin-bottom: 0.25rem;
      }

      .quick-reason-chip {
        padding: 0.25rem 0.55rem;
        font-size: 0.72rem;
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.35);
        color: #fca5a5;
        border-radius: 2px;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .quick-reason-chip:hover {
        background: rgba(239, 68, 68, 0.28);
        border-color: #ef4444;
        color: #ffffff;
      }

      .reject-textarea {
        background: #0d0604;
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #ffffff;
        font-size: 0.82rem;
        padding: 0.5rem;
        border-radius: 2px;
        outline: none;
      }

      .reject-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }

      .cancel-btn {
        padding: 0.5rem 0.85rem;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: #ffffff;
        font-size: 0.78rem;
        cursor: pointer;
        border-radius: 2px;
      }

      .confirm-reject-btn {
        padding: 0.5rem 0.85rem;
        background: #ef4444;
        border: none;
        color: #ffffff;
        font-size: 0.78rem;
        font-weight: 700;
        cursor: pointer;
        border-radius: 2px;
      }

      .receipt-modal-box {
        display: grid;
        grid-template-columns: minmax(280px, 0.88fr) minmax(380px, 1.12fr);
        width: min(880px, 100%);
        max-height: min(680px, 90vh);
        background: rgba(20, 10, 5, 0.78);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 3px;
        overflow: hidden;
      }

      .modal-img-col {
        background: rgba(8, 4, 2, 0.55);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 1rem;
        overflow-y: auto;
        max-height: 100%;
      }

      .receipt-img-view {
        width: 100%;
        height: auto;
        max-width: 100%;
        object-fit: contain;
        display: block;
      }

      .modal-info-col {
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
        overflow-y: auto;
        min-height: 0;
      }

      .modal-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .modal-sub-name {
        color: #ffffff;
        margin: 0;
        font-size: 1.25rem;
      }

      .modal-x {
        background: transparent;
        border: none;
        color: #ffffff;
        font-size: 1.5rem;
        cursor: pointer;
      }

      .amount-banner {
        background: rgba(28, 14, 7, 0.55);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 95, 0, 0.3);
        padding: 0.75rem 1rem;
        border-radius: 2px;
        display: flex;
        flex-direction: column;
      }

      .amount-banner-lbl {
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.6);
        text-transform: uppercase;
      }

      .amount-banner-val {
        font-size: 1.5rem;
        color: #ffffff;
        font-weight: 800;
      }

      .modal-dl {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;
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

      .receipt-box-actions {
        margin-top: auto;
        padding-top: 1rem;
        padding-bottom: 1.25rem;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        align-items: stretch;
        gap: 0.75rem;
        width: 100%;
        box-sizing: border-box;
      }

      .receipt-box-actions .btn-download-clean,
      .receipt-box-actions .btn-whatsapp {
        flex: 1 1 0;
        width: 50%;
        min-width: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 0.65rem 0.5rem;
        font-size: 0.78rem;
        font-weight: 700;
        border-radius: 2px;
        box-sizing: border-box;
        white-space: nowrap;
      }

      .btn-download-clean {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.25);
        color: #ffffff;
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .btn-download-clean:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.5);
        color: #ffffff;
      }

      .badge-post-prestador {
        display: inline-block;
        padding: 0.15rem 0.45rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: rgba(255, 255, 255, 0.75);
        font-size: 0.65rem;
        font-weight: 800;
        border-radius: 2px;
      }

      .badge-post-fundador {
        display: inline-block;
        padding: 0.15rem 0.45rem;
        background: rgba(128, 179, 255, 0.14);
        border: 1px solid rgba(128, 179, 255, 0.4);
        color: #80b3ff;
        font-size: 0.65rem;
        font-weight: 800;
        border-radius: 2px;
      }

      .badge-prov-official {
        display: inline-block;
        padding: 0.18rem 0.5rem;
        background: rgba(128, 179, 255, 0.15);
        border: 1px solid rgba(128, 179, 255, 0.4);
        color: #80b3ff;
        font-size: 0.65rem;
        font-weight: 800;
        letter-spacing: 0.05em;
        border-radius: 2px;
      }

      .badge-prov-applicant {
        display: inline-block;
        padding: 0.18rem 0.5rem;
        background: rgba(255, 95, 0, 0.15);
        border: 1px solid rgba(255, 95, 0, 0.4);
        color: #ff5f00;
        font-size: 0.65rem;
        font-weight: 800;
        letter-spacing: 0.05em;
        border-radius: 2px;
      }

      .contact-whatsapp,
      .contact-whatsapp:visited {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        color: rgba(255, 255, 255, 0.55);
        text-decoration: none;
        font-size: 0.75rem;
        font-family: inherit;
      }

      .contact-whatsapp:hover {
        color: rgba(255, 255, 255, 0.85);
        text-decoration: underline;
      }

      .contact-whatsapp.is-applicant,
      .contact-whatsapp.is-applicant:visited {
        color: #ff5f00;
      }

      .contact-whatsapp.is-applicant:hover {
        color: #ff8533;
        text-decoration: underline;
      }

      .app-quick-modal {
        display: block;
        max-width: 600px;
        width: 100%;
      }

      .full-app-col {
        padding: 1.75rem;
      }

      .modal-link {
        color: rgba(255, 255, 255, 0.75);
        text-decoration: underline;
      }

      .modal-link:hover {
        text-decoration: underline;
      }

      .app-desc-box {
        margin-top: 0.5rem;
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

      .modal-actions-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        margin-top: 1.25rem;
      }

      .dash-modal-state-btns {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        flex-wrap: wrap;
      }

      .dash-modal-state-btns .btn-state {
        height: 34px !important;
        box-sizing: border-box !important;
      }

      .btn-close-dash {
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
        font-weight: 700 !important;
        font-size: 0.82rem !important;
        border-radius: 3px !important;
        cursor: pointer !important;
        white-space: nowrap !important;
        box-sizing: border-box !important;
      }

      .btn-close-dash:hover {
        background: rgba(255, 255, 255, 0.16) !important;
      }

      .status-pill {
        display: inline-block;
        padding: 0.15rem 0.45rem;
        border-radius: 2px;
        font-size: 0.68rem;
        font-weight: 700;
      }

      .status-pill[data-status='pendiente'] {
        color: #fbbf24;
        background: rgba(245, 158, 11, 0.15);
      }

      .status-pill[data-status='aprobado'] {
        color: #34d399;
        background: rgba(16, 185, 129, 0.15);
      }

      .status-pill[data-status='rechazado'] {
        color: #fca5a5;
        background: rgba(239, 68, 68, 0.15);
      }

      .head-actions {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .pending-pill {
        display: inline-block;
        padding: 0.25rem 0.65rem;
        border-radius: 2px;
        font-size: 0.72rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.6);
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.15);
      }

      .pending-pill.has-pending {
        color: #ff5f00;
        background: rgba(255, 95, 0, 0.12);
        border-color: rgba(255, 95, 0, 0.35);
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

      .exp-kicker-sub {
        font-size: 0.68rem;
        color: rgba(255, 255, 255, 0.55);
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .row-region {
        font-size: 0.82rem;
        color: #ffffff;
      }

      .diff-tag {
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.6);
      }

      .row-usd {
        font-size: 0.74rem;
        color: rgba(255, 255, 255, 0.6);
        font-weight: 600;
      }

      .status-pill.status-pending {
        color: #ff5f00;
        background: rgba(255, 95, 0, 0.12);
        border: 1px solid rgba(255, 95, 0, 0.32);
      }

      .status-pill.status-approved {
        color: #34d399;
        background: rgba(16, 185, 129, 0.12);
        border: 1px solid rgba(16, 185, 129, 0.32);
      }

      .status-pill.status-rejected {
        color: #fca5a5;
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.32);
      }

      .modal-sub-author {
        font-size: 0.82rem;
        color: rgba(255, 255, 255, 0.7);
        margin: 0.3rem 0 0 0;
      }

      /* Modal de Ficha Técnica / Propuestas */
      .modal-dialog {
        background: rgba(18, 9, 4, 0.78);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 4px;
        width: 820px;
        max-width: 95vw;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85);
      }

      .exp-req-modal-card {
        width: 820px;
        max-width: 95vw;
      }

      .modal-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 1.25rem 1.5rem 0.6rem;
        border-bottom: none;
        background: transparent;
        flex-shrink: 0;
      }

      .modal-head-info {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .modal-kicker {
        font-size: 0.68rem;
        font-weight: 800;
        color: #ff5f00;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        display: block;
      }

      .modal-title {
        color: #ffffff;
        font-size: 1.35rem;
        margin: 0;
        line-height: 1.25;
      }

      .modal-sub-author {
        font-size: 0.82rem;
        color: rgba(255, 255, 255, 0.65);
        margin: 0.15rem 0 0 0;
      }

      .modal-close-btn {
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.6);
        font-size: 1.6rem;
        cursor: pointer;
        padding: 0 0.35rem;
        line-height: 1;
      }

      .modal-close-btn:hover {
        color: #ffffff;
      }

      .modal-body {
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1.15rem;
        overflow-y: auto;
        flex: 1;
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
        flex-shrink: 0;
      }

      .state-buttons {
        display: flex;
        gap: 0.65rem;
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

      .btn-whatsapp,
      .btn-contact-provider {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
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
      }

      .btn-whatsapp:hover,
      .btn-contact-provider:hover {
        background: rgba(255, 255, 255, 0.16);
        border-color: rgba(255, 255, 255, 0.45);
        color: #ffffff;
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

      .btn-close {
        height: 34px !important;
        max-height: 34px !important;
        padding: 0 1.25rem !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: #ffffff;
        font-size: 0.8rem;
        font-weight: 700;
        border-radius: 3px;
        cursor: pointer;
        box-sizing: border-box !important;
      }

      .btn-close:hover {
        border-color: #ffffff;
        background: rgba(255, 255, 255, 0.08);
      }

      .btn-state:disabled {
        opacity: 0.5;
        cursor: not-allowed;
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

      .exp-req-media-banner {
        position: relative;
        width: 100%;
        height: 240px;
        border-radius: 3px;
        overflow: hidden;
        background: #080402;
        margin-bottom: 0.25rem;
        border: 1px solid rgba(255, 95, 0, 0.25);
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
        font-family: inherit;
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

      /* Reglas responsivas en mobile para modales y componentes (al final de los estilos para prioridad) */
      @media (max-width: 768px) {
        .modal-backdrop {
          padding: 0.5rem !important;
        }

        .receipt-modal-card {
          grid-template-columns: 1fr !important;
          max-height: 94vh !important;
          width: 100% !important;
          max-width: 100% !important;
          overflow-y: auto !important;
        }

        .receipt-modal-preview {
          max-height: 260px !important;
          padding: 0.75rem !important;
          background: rgba(8, 4, 2, 0.7) !important;
          overflow-y: auto !important;
          border-bottom: 1px solid rgba(255, 95, 0, 0.25) !important;
        }

        .receipt-modal-details {
          padding: 1rem 1rem 1.25rem !important;
          gap: 0.75rem !important;
          overflow-y: visible !important;
        }

        .meta-data-list {
          grid-template-columns: 1fr !important;
          gap: 0.4rem !important;
        }

        .modal-actions-row {
          flex-direction: column !important;
          width: 100% !important;
          gap: 0.5rem !important;
        }

        .receipt-modal-box,
        .quick-modal-card {
          grid-template-columns: 1fr !important;
          width: 100% !important;
          max-width: 100% !important;
          max-height: 94vh !important;
          overflow-y: auto !important;
        }

        .modal-img-col {
          max-height: 260px !important;
          padding: 0.75rem !important;
          background: rgba(8, 4, 2, 0.7) !important;
          overflow-y: auto !important;
          border-bottom: 1px solid rgba(255, 95, 0, 0.25) !important;
        }

        .receipt-img-view {
          max-height: 240px !important;
          width: auto !important;
          max-width: 100% !important;
          margin: 0 auto !important;
          display: block !important;
        }

        .modal-info-col {
          padding: 1rem 1rem 1.25rem !important;
          gap: 0.75rem !important;
          overflow-y: visible !important;
        }

        .modal-sub-name {
          font-size: 1.15rem !important;
        }

        .amount-banner-val {
          font-size: 1.35rem !important;
        }

        .modal-dl {
          grid-template-columns: 1fr !important;
          gap: 0.4rem !important;
        }

        .receipt-box-actions {
          flex-direction: column !important;
          width: 100% !important;
          gap: 0.5rem !important;
          padding-top: 0.85rem !important;
          padding-bottom: 0.5rem !important;
          margin-top: 0.85rem !important;
        }

        .receipt-box-actions .btn-download-clean,
        .receipt-box-actions .btn-whatsapp {
          flex: none !important;
          width: 100% !important;
          justify-content: center !important;
          box-sizing: border-box !important;
          padding: 0.65rem 1rem !important;
          text-align: center !important;
        }

        /* Modal Ficha Experiencia en Mobile */
        .modal-dialog,
        .exp-req-modal-card {
          width: 100% !important;
          max-width: 100% !important;
          max-height: 94vh !important;
        }

        .modal-head {
          padding: 1rem !important;
        }

        .modal-title {
          font-size: 1.15rem !important;
        }

        .modal-body {
          padding: 1rem !important;
          gap: 0.85rem !important;
        }

        .exp-req-specs-grid {
          grid-template-columns: repeat(2, 1fr) !important;
          gap: 0.5rem !important;
        }

        .exp-tariff-card {
          padding: 1rem !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          gap: 0.75rem !important;
        }

        .tariff-figures {
          gap: 0.5rem !important;
        }

        .tariff-ars {
          font-size: 1.55rem !important;
        }

        .tariff-capacity-col {
          padding-left: 0 !important;
          border-left: none !important;
          padding-top: 0.75rem !important;
          border-top: 1px solid rgba(255, 95, 0, 0.25) !important;
          width: 100% !important;
        }

        .modal-actions {
          padding: 0.85rem 1rem !important;
          flex-direction: column !important;
          gap: 0.5rem !important;
          align-items: stretch !important;
        }

        .modal-actions .state-buttons {
          width: 100% !important;
        }

        .modal-actions .btn-state,
        .modal-actions .btn-close {
          width: 100% !important;
          justify-content: center !important;
          text-align: center !important;
          box-sizing: border-box !important;
        }
      }
    `,
  ],
})
export class AdminDashboardComponent {
  readonly store = inject(AdminStoreService);
  private readonly experienceService = inject(ExperienceService);
  private readonly router = inject(Router);
  readonly webExperiences = this.experienceService.experiences;

  isClub(exp?: Partial<Experience> | null): boolean {
    return isClubExperience(exp);
  }

  readonly admin = this.store.currentAdmin;
  readonly stats = this.store.stats;
  readonly selectedSubmission = signal<TransferSubmission | null>(null);
  readonly rejecting = signal<boolean>(false);
  readonly rejectionReason = signal<string>('');
  readonly selectedApplication = signal<AdminApplication | null>(null);
  readonly selectedExperienceRequest = signal<ExperienceProposalRequest | null>(null);
  readonly expPublicUrlInput = signal<string>('');

  readonly providerAccountHolder = signal<string>('');
  readonly providerCuitDni = signal<string>('');
  readonly providerCbuAlias = signal<string>('');
  readonly providerBankName = signal<string>('');

  readonly recentMembers = computed(() => this.store.members().slice(0, 7));
  readonly recentSubmissions = computed(() => this.store.submissions().slice(0, 7));
  readonly recentApplications = computed(() => this.store.applications().slice(0, 5));
  readonly pendingExperienceRequests = computed(() =>
    this.store.experienceRequests().filter((r) => r.status === 'pendiente'),
  );

  // Padrón consolidado de Prestadores Oficiales + Postulaciones de Nuevos Prestadores
  readonly dashboardProviders = computed<ProviderListItem[]>(() => {
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
        continue; // Ya figura como prestador oficial aprobado
      }
      list.push({
        id: app.id,
        origin: 'application',
        name: app.fullName || 'Postulante',
        agency: app.category ? this.formatCategory(app.category) : 'Postulación de Prestador',
        email: app.email,
        phone: app.phone || '—',
        categoryOrBio: app.description || app.motivationLetter,
        slug: app.id,
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

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });

  readonly totalDashboardProvidersCount = computed(() => this.dashboardProviders().length);
  readonly recentDashboardProviders = computed(() => this.dashboardProviders().slice(0, 5));

  getWaLink(phone: string, name: string): string {
    const clean = (phone || '').replace(/\D/g, '');
    const num = clean.startsWith('54') ? clean : '54' + clean;
    return `https://wa.me/${num}?text=${encodeURIComponent(`Hola ${name}, te contacto desde el equipo de Club de Experiencias.`)}`;
  }

  constructor() {
    this.refreshAll();
  }

  refreshAll(): void {
    this.store.providerStore.reloadFromStorage();
    void this.store.providerStore.loadProposalsFromSupabase();
    void this.store.loadAllMembers();
    void this.store.loadAllSubmissions();
    void this.store.loadAllApplications();
    void this.experienceService.reloadFromSupabase();
  }

  async openReceipt(sub: TransferSubmission): Promise<void> {
    this.selectedSubmission.set(sub);
    this.rejecting.set(false);
    this.rejectionReason.set('');
    const key = sub.receipt.storageKey || sub.receipt.url;
    if (
      key &&
      !key.startsWith('http://') &&
      !key.startsWith('https://') &&
      !key.startsWith('data:') &&
      !key.startsWith('blob:')
    ) {
      const signed = await this.store.getSignedReceiptUrl(key);
      if (signed && signed !== key) {
        this.selectedSubmission.update((s) =>
          s ? { ...s, receipt: { ...s.receipt, url: signed } } : null,
        );
      }
    }
  }

  closeReceipt(): void {
    this.selectedSubmission.set(null);
    this.rejecting.set(false);
    this.rejectionReason.set('');
  }

  async confirmReject(id: string): Promise<void> {
    const reason = this.rejectionReason().trim();
    if (reason.length < 4) return;
    await this.store.reviewSubmission(id, 'rechazado', reason);
    this.closeReceipt();
  }

  isPdf(mimeType?: string): boolean {
    return (mimeType || '').toLowerCase().includes('pdf');
  }

  getReservationWhatsappLink(sub: TransferSubmission): string {
    const raw = (sub.phone || '').replace(/\D/g, '');
    if (!raw) return '';

    let num = raw;
    if (num.startsWith('549')) {
      // standard Argentina format
    } else if (num.startsWith('54')) {
      num = '549' + num.slice(2);
    } else if (num.startsWith('0')) {
      num = '549' + num.replace(/^0+/, '');
    } else if (num.length === 10) {
      num = '549' + num;
    } else if (!num.startsWith('549')) {
      num = '549' + num;
    }

    const name = sub.fullName?.trim() ? ` ${sub.fullName.trim()}` : '';
    const ref = sub.reference ? `#${sub.reference}` : '';
    const exp = sub.experienceTitle ? `"${sub.experienceTitle}"` : 'tu reserva';
    const msg = `Hola${name}, te contactamos desde el equipo de Club de Experiencias sobre tu reserva ${ref} para ${exp}.`.trim();

    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  }

  openApplication(app: AdminApplication): void {
    this.selectedApplication.set(app);
    this.providerAccountHolder.set(app.accountHolder || app.fullName || '');
    this.providerCuitDni.set(app.cuitDni || '');
    this.providerCbuAlias.set(app.cbuAlias || '');
    this.providerBankName.set(app.bankName || '');
  }

  closeApplication(): void {
    this.selectedApplication.set(null);
  }

  onApplicationStatusChanged(event: { application: AdminApplication; status: ApplicationStatus }): void {
    this.selectedApplication.set(event.application);
  }

  async approveProvider(): Promise<void> {
    const current = this.selectedApplication();
    if (!current) return;
    const ok = await this.store.updateApplicationStatus(
      current.id,
      current.type,
      'aprobado',
    );
    if (ok) {
      this.selectedApplication.update((a) => (a ? { ...a, status: 'aprobado' } : null));
    }
  }

  async darDeBajaProvider(): Promise<void> {
    const current = this.selectedApplication();
    if (!current) return;
    const ok = await this.store.updateApplicationStatus(
      current.id,
      current.type,
      'dado_de_baja',
    );
    if (ok) {
      this.selectedApplication.update((a) => (a ? { ...a, status: 'dado_de_baja' } : null));
    }
  }

  async saveProviderBankingData(): Promise<void> {
    const current = this.selectedApplication();
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
      this.selectedApplication.update((a) => (a ? { ...a, ...banking } : null));
    }
  }

  async changeApplicationStatus(status: ApplicationStatus): Promise<void> {
    const current = this.selectedApplication();
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
      this.selectedApplication.update((a) =>
        a ? { ...a, status, ...(banking || {}) } : null,
      );
    }
  }

  formatCategory(category?: string): string {
    const map: Record<string, string> = {
      alojamiento: 'Alojamiento',
      gastronomia: 'Gastronomía',
      guias_actividades: 'Guías & Excursiones',
      transporte: 'Transporte & Transfers',
      bienestar: 'Bienestar',
      experiencias_culturales: 'Cultura & Talleres',
    };
    return category ? (map[category] ?? category) : 'General';
  }

  hasPhoneDigits(phone?: string | null): boolean {
    return Boolean(phone && phone.replace(/\D/g, '').length > 0);
  }

  getWhatsappLink(phone?: string, name?: string): string {
    if (!phone) return '#';
    const cleanDigits = phone.replace(/\D/g, '');
    const text = encodeURIComponent(
      `Hola ${name || ''}, te contactamos desde el equipo de Experiencias Club respecto a tu postulación.`,
    );
    return `https://wa.me/${cleanDigits}?text=${text}`;
  }

  getReceiptWhatsappLink(sub: TransferSubmission): string {
    if (!sub.phone) return '#';
    const cleanDigits = sub.phone.replace(/\D/g, '');
    const text = encodeURIComponent(
      `Hola ${sub.fullName}, te contactamos desde Experiencias Club respecto a tu comprobante de reserva para "${sub.experienceTitle}".`,
    );
    return `https://wa.me/${cleanDigits}?text=${text}`;
  }

  openExperienceRequest(req: ExperienceProposalRequest): void {
    this.selectedExperienceRequest.set(req);
    const slug = slugify(req.title);
    this.expPublicUrlInput.set(`https://experiencias.club/experiencias/${slug}`);
  }

  closeExperienceRequest(): void {
    this.selectedExperienceRequest.set(null);
  }

  getProposalCover(url?: string | null): string {
    if (!url || typeof url !== 'string' || url.startsWith('blob:')) {
      return '/assets/images/kayak-club-de-experiencias.jpg';
    }
    return url;
  }

  onImgError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target && !target.src.includes('kayak-club-de-experiencias.jpg')) {
      target.src = '/assets/images/kayak-club-de-experiencias.jpg';
    }
  }

  isProvider(member: AdminMember): boolean {
    if (member.isProvider) return true;
    return this.store.isProviderEmail(member.email);
  }

  async approveExperience(id: string): Promise<void> {
    try {
      const ok = await this.store.approveExperienceRequest(id);
      if (ok) {
        const current = this.selectedExperienceRequest();
        if (current && current.id === id) {
          this.selectedExperienceRequest.set({
            ...current,
            status: 'aprobada',
            reviewedAt: new Date().toISOString(),
          });
        }
        this.refreshAll();
        this.closeExperienceRequest();
      }
    } catch (err) {
      console.error('[AdminDashboard] Error al aprobar propuesta de experiencia:', err);
    }
  }

  getExperienceFicheRoute(slug?: string): string {
    const rawPath = this.router.url.split('?')[0].split('#')[0];
    const segments = rawPath.split('/').filter(Boolean);
    const base = segments[0] === 'admin' ? '/admin/experiencias' : '/experiencias';
    return `${base}/${slug || ''}`;
  }

  getProviderFicheRoute(item: ProviderListItem): string {
    const rawPath = this.router.url.split('?')[0].split('#')[0];
    const segments = rawPath.split('/').filter(Boolean);
    const base = segments[0] === 'admin' ? '/admin/prestadores' : '/prestadores';
    const slug =
      item.slug ||
      (item.origin === 'application' ? item.id : slugify(item.agency || item.name || item.id));
    return `${base}/${slug}`;
  }

  async rejectExperience(id: string): Promise<void> {
    const success = await this.store.rejectExperienceRequest(id);
    if (!success) {
      alert('No se pudo rechazar la propuesta en el servidor. Por favor, reintentá.');
      return;
    }
    const current = this.selectedExperienceRequest();
    if (current && current.id === id) {
      this.selectedExperienceRequest.set({
        ...current,
        status: 'rechazada',
        reviewedAt: new Date().toISOString(),
      });
    }
    this.refreshAll();
    this.closeExperienceRequest();
  }

  async quickApprove(id: string): Promise<void> {
    await this.store.reviewSubmission(id, 'aprobado');
    this.closeReceipt();
  }

  async quickReject(id: string): Promise<void> {
    await this.store.reviewSubmission(
      id,
      'rechazado',
      'Comprobante observado por el administrador.',
    );
    this.closeReceipt();
  }

  readonly isRefreshingExperiences = signal(false);

  async refreshExperiences(): Promise<void> {
    this.isRefreshingExperiences.set(true);
    try {
      await this.experienceService.reloadFromSupabase();
    } finally {
      this.isRefreshingExperiences.set(false);
    }
  }

  downloadExperiencesCsv(): void {
    exportExperiencesToCsv(
      this.webExperiences(),
      (exp) => this.isClub(exp),
      this.store.clubProfile().email || 'admin@experiencias.club',
    );
  }

  getPublicExperienceUrl(exp: { publicUrl?: string; slug?: string; detailRoute?: string }): string {
    return getPublicExperienceUrl(exp);
  }
}
