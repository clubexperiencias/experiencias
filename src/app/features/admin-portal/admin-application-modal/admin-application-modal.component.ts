import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  OnDestroy,
  Output,
  ViewChild,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FechaPipe } from '../../../shared/pipes/format.pipes';
import {
  AdminApplication,
  AdminStoreService,
  ApplicationStatus,
} from '../../../core/services/admin-store.service';

@Component({
  selector: 'app-admin-application-modal',
  standalone: true,
  imports: [CommonModule, FechaPipe],
  template: `
    @if (currentApp(); as app) {
      <div class="modal-backdrop" role="presentation" (click)="close()">
        <div
          #modalDialog
          class="quick-modal-card app-quick-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-app-modal-title"
          tabindex="-1"
          (click)="$event.stopPropagation()"
        >
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
                <h3 id="admin-app-modal-title" class="modal-sub-name">{{ app.fullName }}</h3>
              </div>
              <button
                type="button"
                class="modal-x"
                (click)="close()"
                aria-label="Cerrar"
                title="Cerrar"
              >×</button>
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
                <dd>
                  @if (hasPhoneDigits(app.phone)) {
                    <a
                      [href]="getWhatsappLink(app.phone, app.fullName)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="modal-link"
                      title="Contactar por WhatsApp respecto a su postulación"
                    >
                      {{ app.phone }}
                    </a>
                  } @else {
                    {{ app.phone || '—' }}
                  }
                </dd>
              </div>
              <div>
                <dt>Estado:</dt>
                <dd>
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

            @if (
              (app.type === 'prestador' && app.description?.trim()) ||
              (app.type !== 'prestador' && app.motivationLetter?.trim())
            ) {
              <div class="app-desc-box">
                <span class="desc-heading">{{
                  app.type === 'prestador'
                    ? 'Descripción de servicios y equipamiento:'
                    : 'Carta de motivación:'
                }}</span>
                <p class="desc-content">
                  {{ app.type === 'prestador' ? app.description : app.motivationLetter }}
                </p>
              </div>
            }

            @if (app.type === 'prestador' && (app.cbuAlias || app.cuitDni)) {
              <div class="provider-banking-card">
                <h4 class="banking-card-title">Datos Bancarios para Liquidación de Pagos</h4>
                <div class="banking-display-grid">
                  <div class="banking-display-item">
                    <span class="banking-item-lbl">Titular</span>
                    <strong class="banking-item-val">{{ app.accountHolder || app.fullName }}</strong>
                  </div>
                  <div class="banking-display-item">
                    <span class="banking-item-lbl">CUIT / CUIL</span>
                    <strong class="banking-item-val">{{ app.cuitDni || '—' }}</strong>
                  </div>
                  <div class="banking-display-item">
                    <span class="banking-item-lbl">CBU / CVU o Alias</span>
                    <strong class="banking-item-val">{{ app.cbuAlias || '—' }}</strong>
                  </div>
                  <div class="banking-display-item">
                    <span class="banking-item-lbl">Entidad</span>
                    <strong class="banking-item-val">{{ app.bankName || '—' }}</strong>
                  </div>
                </div>
              </div>
            }

            <div class="modal-actions-row">
              <div class="dash-modal-state-btns">
                @if (app.type === 'prestador') {
                  @if (app.status !== 'aprobado') {
                    <button
                      type="button"
                      class="btn-state btn-approve"
                      [disabled]="isUpdatingStatus()"
                      (click)="approveProvider()"
                    >
                      Aprobar Prestador
                    </button>
                  }
                  @if (app.status !== 'dado_de_baja') {
                    <button
                      type="button"
                      class="btn-state btn-reject"
                      [disabled]="isUpdatingStatus()"
                      (click)="darDeBajaProvider()"
                    >
                      Dar de baja
                    </button>
                  }
                } @else {
                  @if (app.status !== 'aprobado') {
                    <button
                      type="button"
                      class="btn-state btn-approve"
                      [disabled]="isUpdatingStatus()"
                      (click)="changeApplicationStatus('aprobado')"
                    >
                      Aprobar Postulación
                    </button>
                  }
                  @if (app.status !== 'dado_de_baja') {
                    <button
                      type="button"
                      class="btn-state btn-reject"
                      [disabled]="isUpdatingStatus()"
                      (click)="changeApplicationStatus('dado_de_baja')"
                    >
                      Dar de baja
                    </button>
                  }
                }
              </div>

              <button type="button" class="btn-close-dash" (click)="close()">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }

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
        background: rgba(20, 10, 5, 0.78);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 95, 0, 0.35);
        border-radius: 3px;
        overflow: hidden;
      }

      .app-quick-modal {
        display: block;
        max-width: 600px;
        width: 100%;
        max-height: min(750px, 92vh);
        overflow-y: auto;
        outline: none;
      }

      .app-quick-modal:focus-visible {
        outline: 1px solid rgba(255, 95, 0, 0.5);
      }

      .full-app-col {
        padding: 1.75rem;
      }

      .modal-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .card-kicker {
        display: inline-block;
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #ff5f00;
        margin-bottom: 0.25rem;
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
        line-height: 1;
      }

      .modal-dl {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;
        font-size: 0.78rem;
        margin: 1.15rem 0 0;
      }

      .modal-dl dt {
        color: rgba(255, 255, 255, 0.5);
      }

      .modal-dl dd {
        color: #ffffff;
        margin: 0;
      }

      .modal-link {
        color: #80b3ff;
        text-decoration: none;
      }

      .modal-link:hover {
        text-decoration: underline;
      }

      .status-badge {
        display: inline-block;
        padding: 0.15rem 0.5rem;
        border-radius: 2px;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: capitalize;
      }

      .status-badge[data-status='pendiente'] {
        background: rgba(251, 191, 36, 0.2);
        color: #fbbf24;
      }

      .status-badge[data-status='aprobado'] {
        background: rgba(52, 211, 153, 0.2);
        color: #34d399;
      }

      .status-badge[data-status='rechazado'] {
        background: rgba(239, 68, 68, 0.2);
        color: #fca5a5;
      }

      .status-badge[data-status='dado_de_baja'] {
        background: rgba(239, 68, 68, 0.2);
        color: #fca5a5;
      }

      .app-desc-box {
        margin-top: 1rem;
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

      .provider-banking-card {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1rem 1.15rem;
        background: rgba(18, 10, 5, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 4px;
        margin-top: 0.75rem;
      }

      .banking-card-title {
        margin: 0;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: #80b3ff;
      }

      .banking-display-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.65rem 1rem;
      }

      .banking-display-item {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }

      .banking-item-lbl {
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.5);
        text-transform: uppercase;
        font-weight: 700;
      }

      .banking-item-val {
        font-size: 0.85rem;
        color: #ffffff;
        font-weight: 600;
        word-break: break-all;
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

      .btn-state {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 34px !important;
        padding: 0 1rem;
        font-size: 0.76rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        border-radius: 3px;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
        box-sizing: border-box !important;
      }

      .btn-state:disabled {
        opacity: 0.5 !important;
        cursor: not-allowed !important;
        pointer-events: none !important;
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

      @media (max-width: 600px) {
        .modal-dl {
          grid-template-columns: 1fr;
        }

        .modal-actions-row {
          flex-direction: column;
          align-items: stretch;
        }

        .dash-modal-state-btns {
          width: 100%;
        }

        .dash-modal-state-btns .btn-state,
        .btn-close-dash {
          width: 100%;
        }
      }
    `,
  ],
})
export class AdminApplicationModalComponent implements OnDestroy {
  private readonly store = inject(AdminStoreService);

  readonly application = input.required<AdminApplication>();
  @Output() closed = new EventEmitter<void>();
  @Output() statusChanged = new EventEmitter<{
    application: AdminApplication;
    status: ApplicationStatus;
  }>();

  readonly currentApp = signal<AdminApplication | null>(null);
  readonly isUpdatingStatus = signal(false);

  @ViewChild('modalDialog') modalDialog?: ElementRef<HTMLElement>;
  private previousActiveElement: HTMLElement | null = null;

  constructor() {
    effect(
      () => {
        const app = this.application();
        this.currentApp.set(app);
        if (app) {
          if (typeof document !== 'undefined' && !this.previousActiveElement) {
            this.previousActiveElement = document.activeElement as HTMLElement | null;
          }
          setTimeout(() => {
            this.focusInitialElement();
          }, 0);
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnDestroy(): void {
    this.restoreFocus();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.currentApp()) {
      this.close();
    }
  }

  close(): void {
    this.restoreFocus();
    this.closed.emit();
  }

  private focusInitialElement(): void {
    if (this.modalDialog?.nativeElement) {
      this.modalDialog.nativeElement.focus();
    }
  }

  private restoreFocus(): void {
    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
      this.previousActiveElement = null;
    }
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

  formatCategory(category?: string): string {
    const map: Record<string, string> = {
      alojamiento: 'Alojamiento',
      gastronomia: 'Gastronomía',
      guias_actividades: 'Guías & Excursiones',
      transporte: 'Transporte & Transfers',
      bienestar: 'Bienestar',
      experiencias_culturales: 'Cultura & Talleres',
      guia_montaña: 'Guía de Montaña',
      kayak_nautica: 'Kayak & Náutica',
      transporte_4x4: 'Transporte & Travesías 4x4',
    };
    return category ? (map[category] ?? category) : 'General';
  }

  approveProvider(): Promise<void> {
    return this.changeApplicationStatus('aprobado');
  }

  darDeBajaProvider(): Promise<void> {
    return this.changeApplicationStatus('dado_de_baja');
  }

  async changeApplicationStatus(status: ApplicationStatus): Promise<void> {
    if (this.isUpdatingStatus()) return;
    const current = this.currentApp();
    if (!current) return;

    this.isUpdatingStatus.set(true);
    try {
      const ok = await this.store.updateApplicationStatus(current.id, current.type, status);
      if (ok) {
        const updated: AdminApplication = { ...current, status };
        this.currentApp.set(updated);
        this.statusChanged.emit({ application: updated, status });
      }
    } finally {
      this.isUpdatingStatus.set(false);
    }
  }
}

