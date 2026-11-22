import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ExperiencePricingPack,
  PRICING_WEEKDAY_OPTIONS,
} from '../../../core/models/experience.model';
import { ArsPipe } from '../../pipes/format.pipes';

@Component({
  selector: 'app-experience-pricing-packs-editor',
  standalone: true,
  imports: [CommonModule, ArsPipe],
  template: `
    <div class="packs-editor" [class.is-disabled]="disabled()">
      <div class="packs-editor-head">
        <div class="packs-editor-titles">
          <span class="packs-kicker">PACKS &amp; PROMOCIONES GRUPALES</span>
          <p class="packs-sub">
            Creá tarifas especiales por grupo o promociones (ej: 2x1 donde van 2 personas y pagan 1, 3x2 o precio grupal).
            Indicá cuántas personas incluye el pack y el precio total final. Podés limitarlas a días de la
            semana o fechas puntuales; si no elegís ninguno, aplican a todas las salidas.
          </p>
        </div>
        <div class="packs-presets">
          <button
            type="button"
            class="preset-btn"
            (click)="addPreset('Promo 2x1', 2, 1)"
          >
            + 2x1
          </button>
          <button
            type="button"
            class="preset-btn"
            (click)="addPreset('Promo 3x2', 3, 2)"
          >
            + 3x2
          </button>
          <button
            type="button"
            class="preset-btn"
            (click)="addPreset('Pack Grupo 4x3', 4, 3)"
          >
            + 4x3
          </button>
          <button
            type="button"
            class="preset-btn"
            (click)="addPreset('Pack Grupal', 2, 2)"
          >
            + Personalizado
          </button>
        </div>
      </div>

      @if (packs().length === 0) {
        <div class="packs-empty">
          Sin packs promocionales configurados. Se usará únicamente la tarifa individual por
          persona.
        </div>
      } @else {
        <div class="packs-list">
          @for (pack of packs(); track pack.id) {
            <div class="pack-card">
              <div class="pack-top-row">
                <div class="pack-field pack-field-label">
                  <label class="field-caption">NOMBRE DEL PACK</label>
                  <input
                    type="text"
                    class="pack-input"
                    [value]="pack.label"
                    (input)="updatePackField(pack.id, 'label', $any($event.target).value)"
                    placeholder="Ej: Promo 2x1, Pack Amigos"
                  />
                </div>

                <div class="pack-field pack-field-seats">
                  <label class="field-caption">PERSONAS INCLUIDAS</label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    class="pack-input"
                    [value]="pack.seats"
                    (input)="updatePackNumber(pack.id, 'seats', $any($event.target).value, 1)"
                    title="Cantidad de personas o lugares cubiertos por este pack (ej: 2 en un 2x1)"
                  />
                </div>

                <div class="pack-field pack-field-price">
                  <label class="field-caption">PRECIO TOTAL (ARS)</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    class="pack-input"
                    [value]="pack.totalPriceArs"
                    (input)="updatePackNumber(pack.id, 'totalPriceArs', $any($event.target).value, 0)"
                  />
                </div>

                <div class="pack-actions">
                  <button
                    type="button"
                    class="pack-remove-btn"
                    (click)="removePack(pack.id)"
                    title="Eliminar este pack"
                  >
                    Quitar
                  </button>
                </div>
              </div>

              <!-- Savings preview badge -->
              @if (getSavingsArs(pack) > 0) {
                <div class="pack-savings-row">
                  <span class="pack-savings-pill">
                    Válido para <strong>{{ pack.seats }} {{ pack.seats === 1 ? 'persona' : 'personas' }}</strong> · Ahorro de
                    <strong>{{ getSavingsArs(pack) | ars }}</strong>
                    ({{ getSavingsPercent(pack) }}% OFF sobre la tarifa individual)
                  </span>
                </div>
              }

              <!-- Schedule restrictions -->
              <div class="pack-schedule-row">
                <div class="schedule-block">
                  <span class="schedule-label">Días habilitados (opcional)</span>
                  <div class="day-chips">
                    @for (day of weekdayOptions; track day.value) {
                      <button
                        type="button"
                        class="day-chip"
                        [class.is-selected]="isWeekdaySelected(pack, day.value)"
                        (click)="toggleWeekday(pack.id, day.value)"
                        [title]="day.label"
                      >
                        {{ day.short }}
                      </button>
                    }
                  </div>
                </div>

                <div class="schedule-block">
                  <span class="schedule-label">Fechas puntuales (opcional)</span>
                  <div class="date-controls">
                    <input
                      type="date"
                      class="pack-date-input"
                      (change)="onAddSpecificDate(pack.id, $event)"
                    />
                    @if (sanitizedAvailableDates().length > 0) {
                      <div class="quick-exp-dates">
                        @for (d of sanitizedAvailableDates(); track d) {
                          <button
                            type="button"
                            class="date-chip"
                            [class.is-selected]="isDateSelected(pack, d)"
                            (click)="toggleSpecificDate(pack.id, d)"
                          >
                            {{ formatShortDate(d) }}
                          </button>
                        }
                      </div>
                    }
                  </div>
                  @if (pack.validDates && pack.validDates.length > 0) {
                    <div class="selected-dates-pills">
                      @for (d of pack.validDates; track d) {
                        <span class="selected-date-pill">
                          {{ formatShortDate(d) }}
                          <button
                            type="button"
                            class="pill-x"
                            (click)="toggleSpecificDate(pack.id, d)"
                            aria-label="Quitar fecha"
                          >
                            ×
                          </button>
                        </span>
                      }
                    </div>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .packs-editor {
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
        padding: 1rem 1.15rem;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 3px;
      }

      .packs-editor-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .packs-kicker {
        display: block;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        color: #80b3ff;
        margin-bottom: 0.2rem;
      }

      .packs-sub {
        margin: 0;
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.65);
        max-width: 540px;
        line-height: 1.4;
      }

      .packs-presets {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex-wrap: wrap;
      }

      .preset-btn {
        padding: 0.4rem 0.75rem;
        font-size: 0.75rem;
        font-weight: 800;
        border-radius: 2px;
        border: 1px solid rgba(255, 255, 255, 0.22);
        background: rgba(255, 255, 255, 0.06);
        color: #ffffff;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .preset-btn:hover {
        background: rgba(255, 255, 255, 0.15);
        border-color: #ffffff;
      }

      .packs-empty {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.5);
        padding: 0.65rem 0.85rem;
        border: 1px dashed rgba(255, 255, 255, 0.14);
        border-radius: 2px;
      }

      .packs-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .pack-card {
        background: rgba(10, 18, 38, 0.7);
        border: 1px solid rgba(128, 179, 255, 0.28);
        border-radius: 3px;
        padding: 0.85rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.7rem;
      }

      .pack-top-row {
        display: grid;
        grid-template-columns: 2fr 150px 140px auto;
        gap: 0.65rem;
        align-items: flex-end;
      }

      .pack-field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .field-caption {
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.05em;
        color: rgba(255, 255, 255, 0.7);
      }

      .pack-input {
        padding: 0.45rem 0.6rem;
        font-size: 0.85rem;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.22);
        border-radius: 2px;
        color: #ffffff;
        font-family: inherit;
        outline: none;
        transition: border-color 0.15s ease;
      }

      .pack-input:focus {
        border-color: #80b3ff;
        background: rgba(255, 255, 255, 0.1);
      }

      .pack-remove-btn {
        padding: 0.45rem 0.75rem;
        font-size: 0.78rem;
        font-weight: 700;
        border-radius: 2px;
        border: 1px solid rgba(239, 68, 68, 0.4);
        background: rgba(239, 68, 68, 0.15);
        color: #ffffff;
        cursor: pointer;
        transition: all 0.15s ease;
        height: 34px;
      }

      .pack-remove-btn:hover {
        background: rgba(239, 68, 68, 0.35);
        border-color: #ef4444;
        color: #ffffff;
      }

      .pack-savings-row {
        display: flex;
        align-items: center;
      }

      .pack-savings-pill {
        display: inline-block;
        padding: 0.25rem 0.6rem;
        font-size: 0.74rem;
        background: rgba(16, 185, 129, 0.15);
        border: 1px solid rgba(16, 185, 129, 0.4);
        color: #6ee7b7;
        border-radius: 2px;
        width: 100%;
        box-sizing: border-box;
      }

      .pack-schedule-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.85rem;
        padding-top: 0.4rem;
        border-top: 1px dashed rgba(255, 255, 255, 0.1);
      }

      .schedule-block {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      .schedule-label {
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.65);
      }

      .day-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3rem;
      }

      .day-chip {
        height: 32px;
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 0.65rem;
        font-size: 0.75rem;
        font-weight: 700;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.18);
        color: #ffffff;
        border-radius: 2px;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .day-chip.is-selected,
      .date-chip.is-selected {
        background: rgba(128, 179, 255, 0.24);
        border-color: #80b3ff;
        color: #ffffff;
      }

      .date-controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.45rem;
      }

      .quick-exp-dates {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        flex-wrap: wrap;
      }

      .pack-date-input {
        height: 32px;
        box-sizing: border-box;
        padding: 0 0.5rem;
        font-size: 0.76rem;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 2px;
        color: #ffffff;
        color-scheme: dark;
        display: inline-flex;
        align-items: center;
      }

      .date-chip {
        height: 32px;
        box-sizing: border-box;
        padding: 0 0.6rem;
        font-size: 0.75rem;
        font-weight: 700;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.18);
        color: #ffffff;
        border-radius: 2px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
      }

      .selected-date-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.2rem 0.48rem;
        font-size: 0.72rem;
        font-weight: 700;
        background: rgba(255, 95, 0, 0.18);
        border: 1px solid rgba(255, 95, 0, 0.48);
        color: #ffd1b3;
        border-radius: 2px;
      }

      .pill-x {
        background: none;
        border: none;
        color: #ffffff;
        cursor: pointer;
        font-size: 0.85rem;
        line-height: 1;
        padding: 0;
      }

      .packs-editor.is-disabled {
        opacity: 0.65;
        pointer-events: none;
        cursor: not-allowed;
      }

      @media (max-width: 720px) {
        .pack-top-row {
          grid-template-columns: 1fr 1fr;
        }
        .pack-field-label {
          grid-column: 1 / -1;
        }
        .pack-schedule-row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ExperiencePricingPacksEditorComponent {
  readonly packs = input<ExperiencePricingPack[]>([]);
  readonly unitPriceArs = input<number>(0);
  readonly availableDates = input<string[]>([]);
  readonly disabled = input<boolean>(false);
  readonly packsChange = output<ExperiencePricingPack[]>();

  readonly weekdayOptions = PRICING_WEEKDAY_OPTIONS;

  readonly sanitizedAvailableDates = computed(() => {
    const raw = this.availableDates() || [];
    const result: string[] = [];
    for (const item of raw) {
      if (!item) continue;
      const matches = String(item).match(/\b\d{4}-\d{2}-\d{2}\b/g);
      if (matches) {
        for (const m of matches) {
          if (!result.includes(m)) {
            result.push(m);
          }
        }
      }
    }
    return result.sort();
  });

  addPreset(label: string, seats: number, payCount: number): void {
    const unit = Math.max(0, Number(this.unitPriceArs()) || 0);
    const nextPack: ExperiencePricingPack = {
      id: `pack-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label,
      seats,
      totalPriceArs: unit * payCount,
      validWeekdays: [],
      validDates: [],
      active: true,
    };
    this.packsChange.emit([...this.packs(), nextPack]);
  }

  removePack(id: string): void {
    this.packsChange.emit(this.packs().filter((p) => p.id !== id));
  }

  updatePackField(id: string, field: 'label', value: string): void {
    this.packsChange.emit(
      this.packs().map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  }

  updatePackNumber(
    id: string,
    field: 'seats' | 'totalPriceArs',
    rawValue: string,
    minVal: number,
  ): void {
    const parsed = Math.max(minVal, Math.round(Number(rawValue) || 0));
    this.packsChange.emit(
      this.packs().map((p) => (p.id === id ? { ...p, [field]: parsed } : p)),
    );
  }

  isWeekdaySelected(pack: ExperiencePricingPack, weekday: number): boolean {
    return Array.isArray(pack.validWeekdays) && pack.validWeekdays.includes(weekday);
  }

  toggleWeekday(id: string, weekday: number): void {
    this.packsChange.emit(
      this.packs().map((p) => {
        if (p.id !== id) return p;
        const current = p.validWeekdays || [];
        const next = current.includes(weekday)
          ? current.filter((d) => d !== weekday)
          : [...current, weekday];
        return { ...p, validWeekdays: next };
      }),
    );
  }

  isDateSelected(pack: ExperiencePricingPack, date: string): boolean {
    return Array.isArray(pack.validDates) && pack.validDates.includes(date);
  }

  toggleSpecificDate(id: string, date: string): void {
    this.packsChange.emit(
      this.packs().map((p) => {
        if (p.id !== id) return p;
        const current = p.validDates || [];
        const next = current.includes(date)
          ? current.filter((d) => d !== date)
          : [...current, date].sort();
        return { ...p, validDates: next };
      }),
    );
  }

  onAddSpecificDate(id: string, event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const val = (inputEl?.value || '').trim();
    if (!val || !/^\d{4}-\d{2}-\d{2}$/.test(val)) return;
    const pack = this.packs().find((p) => p.id === id);
    if (pack && !this.isDateSelected(pack, val)) {
      this.toggleSpecificDate(id, val);
    }
    inputEl.value = '';
  }

  getSavingsArs(pack: ExperiencePricingPack): number {
    const unit = Number(this.unitPriceArs()) || 0;
    if (unit <= 0 || pack.seats < 1) return 0;
    return Math.max(0, unit * pack.seats - pack.totalPriceArs);
  }

  getSavingsPercent(pack: ExperiencePricingPack): number {
    const unit = Number(this.unitPriceArs()) || 0;
    const regular = unit * pack.seats;
    if (regular <= 0) return 0;
    return Math.round((this.getSavingsArs(pack) / regular) * 100);
  }

  formatShortDate(iso: string): string {
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      return `${m[3]}/${m[2]}/${m[1].slice(2)}`;
    }
    return iso;
  }
}
