import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, ArsPipe, FechaPipe],
  template: `
    <div class="dash-container">
      <!-- Welcome Header Sobrio y Minimalista -->
      <section class="welcome-card">
        <div class="welcome-main">
          <div class="avatar-ring">
            <img
              src="/assets/images/gonza.jpg"
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
                      <strong class="row-name">{{ m.fullName || '—' }}</strong>
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
                          <span class="pill-google" title="Google Vinculado">GOOGLE</span>
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
                      <span class="ref-tag font-mono">{{ sub.reference }}</span>
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

      <!-- Sección 3: Postulaciones Recientes (Prestadores & Socios Fundadores) -->
      <section class="dash-card">
        <div class="card-head">
          <h2 class="card-title">Últimas Postulaciones Recibidas</h2>
          <a routerLink="/postulaciones" class="view-all-link">
            <span>Ver todas las postulaciones ({{ store.applicationStats().total }})</span>
          </a>
        </div>

        @if (recentApplications().length === 0) {
          <p class="empty-text">No hay postulaciones registradas todavía.</p>
        } @else {
          <div class="table-wrap">
            <table class="dash-data-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Postulante</th>
                  <th>Detalles</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th class="text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                @for (app of recentApplications(); track app.id) {
                  <tr>
                    <td>
                      @if (app.type === 'prestador') {
                        <span class="badge-post-prestador">PRESTADOR</span>
                      } @else {
                        <span class="badge-post-fundador">SOCIO FUNDADOR</span>
                      }
                    </td>
                    <td>
                      <div class="cell-stack">
                        <strong class="row-name">{{ app.fullName }}</strong>
                        <span class="row-email font-mono">{{ app.email }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="exp-title-cell">
                        {{
                          app.type === 'prestador'
                            ? formatCategory(app.category)
                            : 'Cuadro Fundacional'
                        }}
                      </span>
                    </td>
                    <td>
                      <span class="status-badge" [attr.data-status]="app.status">
                        @switch (app.status) {
                          @case ('aprobado') {
                            Aprobado
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
                    <td>
                      <span class="row-date">{{ app.createdAt | fecha: 'corta' }}</span>
                    </td>
                    <td class="text-right">
                      <button type="button" class="btn-review" (click)="openApplication(app)">
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
              routerLink="/postulaciones"
              [queryParams]="{ tab: 'experiencias' }"
              class="view-all-link"
            >
              <span>Ver propuestas ({{ store.experienceRequests().length }})</span>
            </a>
            <a routerLink="/experiencias" class="view-all-link">
              <span>Ver Experiencias de la Web →</span>
            </a>
          </div>
        </div>

        @if (store.experienceRequests().length === 0) {
          <p class="empty-text">No hay solicitudes de experiencias cargadas todavía.</p>
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
                @for (req of store.experienceRequests(); track req.id) {
                  <tr [class.row-pending]="req.status === 'pendiente'">
                    <td>
                      <div class="cell-stack">
                        <strong class="row-name">{{ req.providerName }}</strong>
                        <span class="row-sub">{{ req.providerAgency }}</span>
                      </div>
                    </td>
                    <td>
                      <div class="exp-cell-wrap">
                        @if (req.coverImage) {
                          <img [src]="req.coverImage" alt="Portada" class="exp-cell-thumb" />
                        }
                        <div class="exp-cell-text">
                          <strong class="exp-title-cell">{{ req.title }}</strong>
                          <span class="exp-kicker-sub font-mono">{{ req.kicker }}</span>
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

      <!-- Modal Rápido de Revisión de Comprobante -->
      @if (selectedSubmission(); as sub) {
        <div class="modal-backdrop" (click)="closeReceipt()">
          <div class="quick-modal-card receipt-modal-box" (click)="$event.stopPropagation()">
            <div class="modal-img-col">
              <img
                [src]="sub.receipt.url"
                [alt]="'Comprobante de ' + sub.fullName"
                class="receipt-img-view"
              />
            </div>
            <div class="modal-info-col">
              <div class="modal-top">
                <div>
                  <span class="card-kicker">COMPROBANTE · {{ sub.reference }}</span>
                  <h3 class="modal-sub-name">{{ sub.fullName }}</h3>
                </div>
                <button type="button" class="modal-x" (click)="closeReceipt()">×</button>
              </div>

              <div class="amount-banner">
                <span class="amount-banner-lbl">Monto Transferido</span>
                <strong class="amount-banner-val">{{ sub.amountArs | ars }}</strong>
              </div>

              <dl class="modal-dl">
                <div>
                  <dt>DNI:</dt>
                  <dd>{{ sub.dni }}</dd>
                </div>
                <div>
                  <dt>Email:</dt>
                  <dd>{{ sub.email }}</dd>
                </div>
                <div>
                  <dt>Teléfono:</dt>
                  <dd>{{ sub.phone }}</dd>
                </div>
                <div>
                  <dt>Experiencia:</dt>
                  <dd>{{ sub.experienceTitle }}</dd>
                </div>
                <div>
                  <dt>Fecha:</dt>
                  <dd>{{ sub.date | fecha: 'larga' }}</dd>
                </div>
                <div>
                  <dt>Cupos:</dt>
                  <dd>{{ sub.participants }}</dd>
                </div>
                @if (sub.discountCode) {
                  <div>
                    <dt>Descuento:</dt>
                    <dd>{{ sub.discountCode }}</dd>
                  </div>
                }
              </dl>

              <div class="receipt-box-actions">
                <a
                  [href]="sub.receipt.url"
                  [download]="sub.receipt.fileName"
                  target="_blank"
                  rel="noopener"
                  class="btn-state btn-download-clean"
                >
                  <span>Descargar Comprobante</span>
                </a>

                @if (sub.phone) {
                  <a
                    [href]="getReceiptWhatsappLink(sub)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-state btn-whatsapp"
                  >
                    <span>Contactar por WhatsApp</span>
                  </a>
                }
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Modal Rápido de Revisión de Postulación -->
      @if (selectedApplication(); as app) {
        <div class="modal-backdrop" (click)="closeApplication()">
          <div class="quick-modal-card app-quick-modal" (click)="$event.stopPropagation()">
            <div class="modal-info-col full-app-col">
              <div class="modal-top">
                <div>
                  <span class="card-kicker">
                    {{
                      app.type === 'prestador'
                        ? 'POSTULACIÓN PRESTADOR'
                        : 'POSTULACIÓN SOCIO FUNDADOR'
                    }}
                  </span>
                  <h3 class="modal-sub-name">{{ app.fullName }}</h3>
                </div>
                <button type="button" class="modal-x" (click)="closeApplication()">×</button>
              </div>

              <dl class="modal-dl">
                <div>
                  <dt>Email:</dt>
                  <dd>
                    <a [href]="'mailto:' + app.email" class="modal-link">{{ app.email }}</a>
                  </dd>
                </div>
                <div>
                  <dt>Teléfono:</dt>
                  <dd>{{ app.phone || '—' }}</dd>
                </div>
                <div>
                  <dt>Estado:</dt>
                  <dd>
                    <span class="status-badge" [attr.data-status]="app.status">
                      @switch (app.status) {
                        @case ('aprobado') {
                          Aprobado
                        }
                        @case ('dado_de_baja') {
                          Dado de baja
                        }
                        @default {
                          Pendiente
                        }
                      }
                    </span>
                  </dd>
                </div>
                @if (app.type === 'prestador') {
                  <div>
                    <dt>Rubro:</dt>
                    <dd>{{ formatCategory(app.category) }}</dd>
                  </div>
                  <div>
                    <dt>Región:</dt>
                    <dd>{{ app.region || 'Catamarca' }}</dd>
                  </div>
                  @if (app.website) {
                    <div>
                      <dt>Web:</dt>
                      <dd>
                        <a [href]="app.website" target="_blank" rel="noopener" class="modal-link">{{
                          app.website
                        }}</a>
                      </dd>
                    </div>
                  }
                } @else {
                  <div>
                    <dt>Categoría:</dt>
                    <dd>Padrón de Socios Fundadores</dd>
                  </div>
                }
                <div>
                  <dt>Fecha:</dt>
                  <dd>{{ app.createdAt | fecha: 'larga' }}</dd>
                </div>
              </dl>

              <div class="app-desc-box">
                <span class="desc-heading">{{
                  app.type === 'prestador'
                    ? 'Descripción de servicios y equipamiento:'
                    : 'Carta de motivación:'
                }}</span>
                <p class="desc-content">
                  {{
                    app.type === 'prestador'
                      ? app.description || 'Sin descripción adicional.'
                      : app.motivationLetter || 'Sin carta de motivación.'
                  }}
                </p>
              </div>

              @if (app.type === 'prestador') {
                <div class="provider-banking-box">
                  <div class="banking-box-header">
                    <mat-icon class="banking-icon">account_balance</mat-icon>
                    <div>
                      <h4 class="banking-box-title">Datos Bancarios para Liquidación de Pagos</h4>
                      <p class="banking-box-sub">
                        Configuración de cuenta para liquidar cobros de experiencias.
                      </p>
                    </div>
                  </div>

                  <div class="banking-form-grid">
                    <div class="banking-input-group">
                      <label class="banking-input-label">Nombre / Titular</label>
                      <input
                        type="text"
                        class="banking-form-input"
                        placeholder="Titular de la cuenta"
                        [ngModel]="providerAccountHolder()"
                        (ngModelChange)="providerAccountHolder.set($event)"
                      />
                    </div>
                    <div class="banking-input-group">
                      <label class="banking-input-label">CUIT / CUIL</label>
                      <input
                        type="text"
                        class="banking-form-input"
                        placeholder="CUIT o CUIL"
                        [ngModel]="providerCuitDni()"
                        (ngModelChange)="providerCuitDni.set($event)"
                      />
                    </div>
                    <div class="banking-input-group">
                      <label class="banking-input-label">CBU / CVU o Alias</label>
                      <input
                        type="text"
                        class="banking-form-input"
                        placeholder="CBU, CVU o Alias"
                        [ngModel]="providerCbuAlias()"
                        (ngModelChange)="providerCbuAlias.set($event)"
                      />
                    </div>
                    <div class="banking-input-group">
                      <label class="banking-input-label">Entidad (Banco / Billetera)</label>
                      <input
                        type="text"
                        class="banking-form-input"
                        placeholder="Banco Nación, Galicia, Mercado Pago..."
                        [ngModel]="providerBankName()"
                        (ngModelChange)="providerBankName.set($event)"
                      />
                    </div>
                  </div>
                </div>
              }

              <div class="modal-actions-row">
                <div class="dash-modal-state-btns">
                  @if (app.type === 'prestador') {
                    @if (app.status === 'aprobado') {
                      <button
                        type="button"
                        class="btn-state btn-save-banking"
                        (click)="saveProviderBankingData()"
                      >
                        Guardar Datos Bancarios
                      </button>
                      <button
                        type="button"
                        class="btn-state btn-reject"
                        (click)="darDeBajaProvider()"
                      >
                        Dar de baja
                      </button>
                    } @else {
                      <button
                        type="button"
                        class="btn-state btn-approve"
                        (click)="approveProvider()"
                      >
                        Aprobar Prestador
                      </button>
                      @if (app.status !== 'dado_de_baja') {
                        <button
                          type="button"
                          class="btn-state btn-reject"
                          (click)="darDeBajaProvider()"
                        >
                          Dar de baja
                        </button>
                      }
                    }
                    @if (app.status !== 'pendiente') {
                      <button
                        type="button"
                        class="btn-state btn-pending"
                        (click)="changeApplicationStatus('pendiente')"
                      >
                        Marcar Pendiente
                      </button>
                    }
                  } @else {
                    @if (app.status !== 'aprobado') {
                      <button
                        type="button"
                        class="btn-state btn-approve"
                        (click)="changeApplicationStatus('aprobado')"
                      >
                        Aprobar Postulación
                      </button>
                    }
                    @if (app.status !== 'dado_de_baja') {
                      <button
                        type="button"
                        class="btn-state btn-reject"
                        (click)="changeApplicationStatus('dado_de_baja')"
                      >
                        Dar de baja
                      </button>
                    }
                    @if (app.status !== 'pendiente') {
                      <button
                        type="button"
                        class="btn-state btn-pending"
                        (click)="changeApplicationStatus('pendiente')"
                      >
                        Marcar Pendiente
                      </button>
                    }
                  }
                </div>

                <button type="button" class="btn-close-dash" (click)="closeApplication()">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
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
                  @if (expReq.coverImage) {
                    <img
                      [src]="expReq.coverImage"
                      alt="Portada de la propuesta"
                      class="exp-req-cover-img"
                    />
                  }
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

              @if (expReq.status === 'pendiente') {
                <div class="exp-public-url-box">
                  <label class="url-label" for="exp-public-url-dash"
                    >URL oficial vinculada en la web pública (experiencias.club):</label
                  >
                  <input
                    id="exp-public-url-dash"
                    type="text"
                    class="url-input"
                    [value]="expPublicUrlInput()"
                    (input)="expPublicUrlInput.set($any($event.target).value)"
                    placeholder="https://experiencias.club/experiencias/..."
                  />
                </div>
              }
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
                    Aprobar y Publicar
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
                    class="btn-state btn-whatsapp"
                  >
                    <span>Contactar prestador por Whatsapp</span>
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

      .dash-data-table {
        width: 100%;
        min-width: 720px;
        border-collapse: collapse;
        font-size: 0.82rem;
        text-align: left;
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
        font-family: var(--font-mono, monospace);
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
        font-weight: 700;
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
        font-family: var(--font-mono, monospace);
        font-size: 0.75rem;
        white-space: nowrap;
      }

      .exp-title-cell {
        color: #ffffff;
        font-weight: 500;
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
        font-family: var(--font-mono, monospace);
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
        padding: 0.35rem 0.75rem;
        background: rgba(255, 95, 0, 0.18);
        border: 1px solid #ff5f00;
        color: #ffffff;
        font-size: 0.75rem;
        font-weight: 700;
        border-radius: 2px;
        cursor: pointer;
        white-space: nowrap;
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
        gap: 0.75rem;
        margin-top: 0.75rem;
      }

      .btn-wa-action {
        flex: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.6rem 1rem;
        background: #25d366;
        color: #0b0704;
        font-weight: 800;
        font-size: 0.78rem;
        text-decoration: none;
        border-radius: 2px;
      }

      .btn-close-dash {
        padding: 0.6rem 1.25rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #ffffff;
        font-weight: 700;
        font-size: 0.78rem;
        border-radius: 2px;
        cursor: pointer;
      }

      .btn-close-dash:hover {
        background: rgba(255, 255, 255, 0.15);
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
        padding: 0.6rem 1.15rem;
        font-size: 0.8rem;
        font-weight: 700;
        border-radius: 2px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-whatsapp {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        background: #25d366;
        border: 1px solid #25d366;
        color: #0b0704;
        font-weight: 800;
        text-decoration: none;
      }

      .btn-whatsapp:hover {
        background: #1eb956;
        border-color: #1eb956;
      }

      .btn-reject {
        background: rgba(239, 68, 68, 0.2);
        border: 1px solid rgba(239, 68, 68, 0.6);
        color: #fca5a5;
      }

      .btn-reject:hover:not(:disabled) {
        background: #ef4444;
        color: #ffffff;
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
        padding: 0.6rem 1.25rem;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: #ffffff;
        font-size: 0.8rem;
        font-weight: 700;
        border-radius: 2px;
        cursor: pointer;
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

      /* Reglas responsivas en mobile para modales y componentes (al final de los estilos para prioridad) */
      @media (max-width: 768px) {
        .modal-backdrop {
          padding: 0.5rem !important;
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

  readonly admin = this.store.currentAdmin;
  readonly stats = this.store.stats;
  readonly selectedSubmission = signal<TransferSubmission | null>(null);
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

  refreshAll(): void {
    void this.store.loadAllMembers();
    void this.store.loadAllSubmissions();
    void this.store.loadAllApplications();
  }

  openReceipt(sub: TransferSubmission): void {
    this.selectedSubmission.set(sub);
  }

  closeReceipt(): void {
    this.selectedSubmission.set(null);
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

  approveProvider(): void {
    const current = this.selectedApplication();
    if (!current) return;
    const banking = {
      accountHolder: this.providerAccountHolder().trim() || current.fullName,
      cuitDni: this.providerCuitDni().trim(),
      cbuAlias: this.providerCbuAlias().trim(),
      bankName: this.providerBankName().trim(),
    };
    void this.store.updateApplicationStatus(current.id, current.type, 'aprobado', banking);
    this.selectedApplication.update((a) => (a ? { ...a, status: 'aprobado', ...banking } : null));
  }

  darDeBajaProvider(): void {
    const current = this.selectedApplication();
    if (!current) return;
    const banking = {
      accountHolder: this.providerAccountHolder().trim() || current.fullName,
      cuitDni: this.providerCuitDni().trim(),
      cbuAlias: this.providerCbuAlias().trim(),
      bankName: this.providerBankName().trim(),
    };
    void this.store.updateApplicationStatus(current.id, current.type, 'dado_de_baja', banking);
    this.selectedApplication.update((a) =>
      a ? { ...a, status: 'dado_de_baja', ...banking } : null,
    );
  }

  saveProviderBankingData(): void {
    const current = this.selectedApplication();
    if (!current) return;
    const banking = {
      accountHolder: this.providerAccountHolder().trim() || current.fullName,
      cuitDni: this.providerCuitDni().trim(),
      cbuAlias: this.providerCbuAlias().trim(),
      bankName: this.providerBankName().trim(),
    };
    void this.store.updateApplicationStatus(current.id, current.type, current.status, banking);
    this.selectedApplication.update((a) => (a ? { ...a, ...banking } : null));
  }

  changeApplicationStatus(status: ApplicationStatus): void {
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
    void this.store.updateApplicationStatus(current.id, current.type, status, banking);
    this.selectedApplication.update((a) => (a ? { ...a, status, ...(banking || {}) } : null));
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

  approveExperience(id: string): void {
    this.store.approveExperienceRequest(id, this.expPublicUrlInput());
    const current = this.selectedExperienceRequest();
    if (current && current.id === id) {
      this.selectedExperienceRequest.set({
        ...current,
        status: 'aprobada',
        reviewedAt: new Date().toISOString(),
      });
    }
  }

  rejectExperience(id: string): void {
    this.store.rejectExperienceRequest(id);
    const current = this.selectedExperienceRequest();
    if (current && current.id === id) {
      this.selectedExperienceRequest.set({
        ...current,
        status: 'rechazada',
        reviewedAt: new Date().toISOString(),
      });
    }
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
}
