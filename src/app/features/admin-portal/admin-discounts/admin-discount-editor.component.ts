import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, ActivatedRouteSnapshot, Router } from '@angular/router';
import { DiscountService } from '../../../core/services/discount.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import {
  Discount,
  DiscountType,
  DiscountScope,
  CreateDiscountDto,
} from '../../../core/models/discount.model';
import { ArsPipe } from '../../../shared/pipes/format.pipes';

type PromotionCategory = 'group' | 'percentage' | 'fixed_amount';

@Component({
  selector: 'app-admin-discount-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, ArsPipe],
  template: `
    <div class="editor-page-container">
      <!-- Barra Superior / Breadcrumb & Volver -->
      <div class="editor-top-bar">
        <button type="button" class="btn-back" (click)="goBack()">
          <mat-icon>arrow_back</mat-icon>
          <span>Volver a Descuentos</span>
        </button>
        @if (!isEditing() || discountLoaded()) {
          <div class="status-badge" [class.badge-active]="active()" [class.badge-paused]="!active()">
            <span class="status-dot"></span>
            <span>{{ active() ? 'Estado: Activo' : 'Estado: Pausado' }}</span>
          </div>
        }
      </div>

      <!-- Encabezado Principal -->
      <header class="editor-header">
        <span class="editor-kicker">GESTIÓN DE PROMOCIONES</span>
        <h1 class="editor-title">
          {{ isEditing() ? 'Editar Descuento o Promoción' : 'Nuevo Descuento & Promoción' }}
        </h1>
        <p class="editor-sub">
          Configurá promociones por grupo (2x1, 3x2, etc.), descuentos porcentuales o montos fijos con reglas claras e intuitivas.
        </p>
      </header>

      @if (isEditing() && isLoadingDiscount()) {
        <div class="state-card state-loading">
          <mat-icon class="state-icon">autorenew</mat-icon>
          <h3>Cargando promoción...</h3>
          <p>Obteniendo los datos del descuento desde la plataforma.</p>
        </div>
      } @else if (isEditing() && discountNotFound()) {
        <div class="state-card state-not-found">
          <mat-icon class="state-icon">search_off</mat-icon>
          <h3>Descuento no encontrado</h3>
          <p>No se encontró ninguna promoción o descuento registrado con el identificador solicitado.</p>
          <div class="state-actions">
            <button type="button" class="btn-back" (click)="goBack()">
              <mat-icon>arrow_back</mat-icon>
              <span>Volver a Descuentos</span>
            </button>
          </div>
        </div>
      } @else if (isEditing() && loadError()) {
        <div class="state-card state-error">
          <mat-icon class="state-icon">error_outline</mat-icon>
          <h3>Error al cargar el descuento</h3>
          <p>{{ loadError() }}</p>
          <div class="state-actions">
            <button type="button" class="btn-retry" (click)="retryLoadDiscount()">
              <mat-icon>refresh</mat-icon>
              <span>Reintentar</span>
            </button>
            <button type="button" class="btn-back" (click)="goBack()">
              <mat-icon>arrow_back</mat-icon>
              <span>Volver a Descuentos</span>
            </button>
          </div>
        </div>
      } @else {
      <form (ngSubmit)="savePromotion()" class="editor-layout">
        <!-- Columna Principal: Formulario Paso a Paso -->
        <main class="editor-main-col">
          <!-- PASO 1: Modalidad de la Promoción -->
          <section class="form-card">
            <div class="card-header-row">
              <div class="step-num">1</div>
              <div>
                <h2 class="card-title">Modalidad de la Promoción</h2>
                <p class="card-desc">Elegí cómo se aplicará el beneficio para los socios.</p>
              </div>
            </div>

            <div class="category-grid">
              <!-- Tarjeta 2x1 / Grupo -->
              <button
                type="button"
                class="category-card"
                [class.selected]="category() === 'group'"
                (click)="setCategory('group')"
              >
                <div class="cat-icon-badge text-gold">
                  <mat-icon>groups</mat-icon>
                </div>
                <div class="cat-content">
                  <div class="cat-title-row">
                    <strong class="cat-title">Promoción por Grupo (2x1, 3x2, etc.)</strong>
                    <span class="cat-pill-popular">MÁS POPULAR</span>
                  </div>
                  <p class="cat-desc">
                    Viajan N personas y pagan M. Ideal para reservas en pareja, familias o amigos (2x1, 3x2, 4x3).
                  </p>
                </div>
              </button>

              <!-- Tarjeta Porcentaje -->
              <button
                type="button"
                class="category-card"
                [class.selected]="category() === 'percentage'"
                (click)="setCategory('percentage')"
              >
                <div class="cat-icon-badge text-blue">
                  <mat-icon>percent</mat-icon>
                </div>
                <div class="cat-content">
                  <strong class="cat-title">Porcentaje de Descuento (% OFF)</strong>
                  <p class="cat-desc">
                    Rebaja porcentual directa sobre el total de la reserva (ej: 15% OFF para miembros).
                  </p>
                </div>
              </button>

              <!-- Tarjeta Monto Fijo -->
              <button
                type="button"
                class="category-card"
                [class.selected]="category() === 'fixed_amount'"
                (click)="setCategory('fixed_amount')"
              >
                <div class="cat-icon-badge text-emerald">
                  <mat-icon>payments</mat-icon>
                </div>
                <div class="cat-content">
                  <strong class="cat-title">Monto Fijo en Dinero ($ ARS OFF)</strong>
                  <p class="cat-desc">
                    Monto fijo deducible del pago final (ej: $10.000 ARS de descuento directo).
                  </p>
                </div>
              </button>
            </div>

            <!-- DETALLES SEGÚN MODALIDAD -->

            <!-- Configuración Modo Grupo (2x1, 3x2, NxM) -->
            @if (category() === 'group') {
              <div class="subpanel group-subpanel">
                <div class="subpanel-title-row">
                  <mat-icon class="subpanel-icon text-gold">auto_awesome</mat-icon>
                  <div>
                    <h3 class="subpanel-title">Configuración de Grupo (2x1, 3x2, 4x3)</h3>
                    <p class="subpanel-subtitle">Seleccioná un formato rápido o personalizá la cantidad de cupos:</p>
                  </div>
                </div>

                <!-- Botones rápidos de grupos -->
                <div class="preset-buttons-row">
                  <button
                    type="button"
                    class="preset-btn"
                    [class.active]="groupTravelers() === 2 && groupPayers() === 1"
                    (click)="applyGroupPreset(2, 1)"
                  >
                    <strong>2x1</strong>
                    <span>Viajan 2, paga 1 (50% OFF)</span>
                  </button>

                  <button
                    type="button"
                    class="preset-btn"
                    [class.active]="groupTravelers() === 3 && groupPayers() === 2"
                    (click)="applyGroupPreset(3, 2)"
                  >
                    <strong>3x2</strong>
                    <span>Viajan 3, pagan 2 (33% OFF)</span>
                  </button>

                  <button
                    type="button"
                    class="preset-btn"
                    [class.active]="groupTravelers() === 4 && groupPayers() === 3"
                    (click)="applyGroupPreset(4, 3)"
                  >
                    <strong>4x3</strong>
                    <span>Viajan 4, pagan 3 (25% OFF)</span>
                  </button>

                  <button
                    type="button"
                    class="preset-btn"
                    [class.active]="groupTravelers() === 4 && groupPayers() === 2"
                    (click)="applyGroupPreset(4, 2)"
                  >
                    <strong>4x2</strong>
                    <span>Viajan 4, pagan 2 (50% OFF)</span>
                  </button>
                </div>

                <!-- Inputs explícitos NxM -->
                <div class="group-inputs-grid">
                  <div class="field-item">
                    <label class="field-label" for="discount-group-travelers">
                      <span>Cantidad de personas que reservan / viajan</span>
                      <mat-icon class="hint-icon" title="Cantidad total de personas que harán la actividad">help_outline</mat-icon>
                    </label>
                    <div class="stepper-input">
                      <button type="button" class="btn-step" (click)="adjustTravelers(-1)">-</button>
                      <input
                        id="discount-group-travelers"
                        type="number"
                        [(ngModel)]="groupTravelers"
                        [ngModelOptions]="{standalone: true}"
                        min="2"
                        max="50"
                        class="step-val"
                      />
                      <button type="button" class="btn-step" (click)="adjustTravelers(1)">+</button>
                    </div>
                    <span class="field-hint">Mínimo 2 personas.</span>
                  </div>

                  <div class="field-item">
                    <label class="field-label" for="discount-group-payers">
                      <span>Cantidad de personas que abonan / pagan</span>
                      <mat-icon class="hint-icon" title="Cantidad de cupos que se cobrarán">help_outline</mat-icon>
                    </label>
                    <div class="stepper-input">
                      <button type="button" class="btn-step" (click)="adjustPayers(-1)">-</button>
                      <input
                        id="discount-group-payers"
                        type="number"
                        [(ngModel)]="groupPayers"
                        [ngModelOptions]="{standalone: true}"
                        min="1"
                        [max]="groupTravelers() - 1"
                        class="step-val"
                      />
                      <button type="button" class="btn-step" (click)="adjustPayers(1)">+</button>
                    </div>
                    <span class="field-hint">Debe ser menor a los que viajan.</span>
                  </div>
                </div>

                <!-- Callout Explicativo en Vivo -->
                <div class="simulation-callout">
                  <div class="sim-badge">
                    <mat-icon>verified</mat-icon>
                    <span>EQUIVALE AL {{ calculatedGroupPercentage() }}% DE DESCUENTO</span>
                  </div>
                  <p class="sim-desc">
                    💡 <strong>Cómo funciona:</strong> Por cada grupo de <strong>{{ groupTravelers() }} personas</strong>, el socio abona únicamente <strong>{{ groupPayers() }} cupo(s)</strong>.
                    El sistema bonifica automáticamente <strong>{{ groupTravelers() - groupPayers() }} cupo(s)</strong> completo(s).
                  </p>
                  <div class="sim-example">
                    <span class="example-title">Ejemplo ilustrativo:</span>
                    <span>
                      En una experiencia de $50.000 por persona, para {{ groupTravelers() }} personas el total sería de
                      <strong>\${{ (50000 * groupTravelers()).toLocaleString('es-AR') }}</strong>.
                      Con este {{ groupTravelers() }}x{{ groupPayers() }}, los socios abonarán únicamente
                      <strong class="text-emerald">\${{ (50000 * groupPayers()).toLocaleString('es-AR') }}</strong>
                      (Ahorro total de \${{ (50000 * (groupTravelers() - groupPayers())).toLocaleString('es-AR') }}).
                    </span>
                  </div>
                </div>
              </div>
            }

            <!-- Configuración Modo Porcentaje -->
            @if (category() === 'percentage') {
              <div class="subpanel">
                <label class="field-label" for="discount-percent-value">Porcentaje de Descuento (%) *</label>
                <div class="preset-pills-row">
                  @for (pct of [10, 15, 20, 25, 30, 50]; track pct) {
                    <button
                      type="button"
                      class="preset-pill"
                      [class.active]="percentValue() === pct"
                      (click)="setPercentValue(pct)"
                    >
                      {{ pct }}% OFF
                    </button>
                  }
                </div>
                <div class="input-with-suffix">
                  <input
                    id="discount-percent-value"
                    type="number"
                    [(ngModel)]="percentValue"
                    [ngModelOptions]="{standalone: true}"
                    placeholder="Ej. 15"
                    min="1"
                    max="100"
                    class="text-input"
                  />
                  <span class="input-suffix">%</span>
                </div>
                <span class="field-hint">Se descontará este porcentaje sobre el valor total de la reserva.</span>
              </div>
            }

            <!-- Configuración Modo Monto Fijo -->
            @if (category() === 'fixed_amount') {
              <div class="subpanel">
                <label class="field-label" for="discount-fixed-value">Monto en Pesos ($ ARS) *</label>
                <div class="preset-pills-row">
                  @for (fix of [5000, 10000, 15000, 20000, 30000, 50000]; track fix) {
                    <button
                      type="button"
                      class="preset-pill"
                      [class.active]="fixedValue() === fix"
                      (click)="setFixedValue(fix)"
                    >
                      \${{ fix.toLocaleString('es-AR') }}
                    </button>
                  }
                </div>
                <div class="input-with-suffix">
                  <span class="input-prefix">$</span>
                  <input
                    id="discount-fixed-value"
                    type="number"
                    [(ngModel)]="fixedValue"
                    [ngModelOptions]="{standalone: true}"
                    placeholder="Ej. 10000"
                    min="500"
                    class="text-input"
                  />
                </div>
                <span class="field-hint">Se restará este importe exacto del precio final a pagar.</span>
              </div>
            }
          </section>

          <!-- PASO 2: Identificación y Cupón -->
          <section class="form-card">
            <div class="card-header-row">
              <div class="step-num">2</div>
              <div>
                <h2 class="card-title">Datos del Cupón & Identificación</h2>
                <p class="card-desc">Definí el código que usarán los socios y el título visible de la campaña.</p>
              </div>
            </div>

            <div class="form-grid-2">
              <div class="field-item">
                <div class="label-with-action">
                  <label class="field-label" for="discount-code">Código de Cupón *</label>
                  <button type="button" class="btn-text-action" (click)="suggestCode()">
                    <mat-icon class="icon-xs">magic_button</mat-icon>
                    <span>Sugerir Código</span>
                  </button>
                </div>
                <input
                  id="discount-code"
                  type="text"
                  [(ngModel)]="code"
                  [ngModelOptions]="{standalone: true}"
                  (ngModelChange)="onCodeChange($event)"
                  placeholder="Ej. PROMO2X1, VERANO2026"
                  required
                  class="text-input code-input"
                />
                <span class="field-hint">Se guardará automáticamente en mayúsculas sin espacios.</span>
              </div>

              <div class="field-item">
                <label class="field-label" for="discount-name">Nombre de la Promoción *</label>
                <input
                  id="discount-name"
                  type="text"
                  [(ngModel)]="name"
                  [ngModelOptions]="{standalone: true}"
                  (ngModelChange)="onNameChange($event)"
                  placeholder="Ej. Promoción 2x1 en Kayak"
                  required
                  class="text-input"
                />
                <span class="field-hint">Nombre que se muestra en el resumen de compra y en el portal.</span>
              </div>
            </div>

            <!-- Aplicación Automática vs Cupón Manual -->
            <div class="application-mode-box">
              <span class="app-mode-label">Forma de Aplicación en la Web:</span>
              <div class="app-mode-radios">
                <label class="radio-option" [class.selected]="!isAutomatic()">
                  <input
                    type="radio"
                    name="appMode"
                    [value]="false"
                    [checked]="!isAutomatic()"
                    (change)="isAutomatic.set(false)"
                  />
                  <div class="radio-text">
                    <strong>Requiere Código Manual</strong>
                    <span>El socio debe ingresar el código en el paso de pago para aplicarlo.</span>
                  </div>
                </label>

                <label class="radio-option" [class.selected]="isAutomatic()">
                  <input
                    type="radio"
                    name="appMode"
                    [value]="true"
                    [checked]="isAutomatic()"
                    (change)="isAutomatic.set(true)"
                  />
                  <div class="radio-text">
                    <strong class="text-gold">Descuento Automático Directo</strong>
                    <span>Se aplica solo en la pantalla de reserva sin necesidad de tipear ningún cupón.</span>
                  </div>
                </label>
              </div>
            </div>

            <!-- Descripción Pública -->
            <div class="field-item full-width mt-3">
              <label class="field-label" for="discount-description">Descripción o Letra Chica (Opcional)</label>
              <textarea
                id="discount-description"
                [(ngModel)]="description"
                [ngModelOptions]="{standalone: true}"
                (ngModelChange)="onDescriptionChange($event)"
                rows="2"
                placeholder="Ej. Válido reservando para 2 personas en salidas de lunes a jueves..."
                class="text-input textarea"
              ></textarea>
            </div>
          </section>

          <!-- PASO 3: Alcance & Destino -->
          <section class="form-card">
            <div class="card-header-row">
              <div class="step-num">3</div>
              <div>
                <h2 class="card-title">Alcance de la Promoción</h2>
                <p class="card-desc">Indicá en qué experiencias o para qué socios estará disponible.</p>
              </div>
            </div>

            <div class="scope-options-grid">
              <label class="scope-box" [class.selected]="scope() === 'general'">
                <input
                  type="radio"
                  name="scope"
                  value="general"
                  [checked]="scope() === 'general'"
                  (change)="scope.set('general')"
                />
                <div class="scope-icon text-gold">
                  <mat-icon>public</mat-icon>
                </div>
                <div class="scope-info">
                  <strong>Toda la Red (General)</strong>
                  <span>Aplica a cualquier experiencia del catálogo del Club.</span>
                </div>
              </label>

              <label class="scope-box" [class.selected]="scope() === 'experience'">
                <input
                  type="radio"
                  name="scope"
                  value="experience"
                  [checked]="scope() === 'experience'"
                  (change)="scope.set('experience')"
                />
                <div class="scope-icon text-blue">
                  <mat-icon>explore</mat-icon>
                </div>
                <div class="scope-info">
                  <strong>Experiencia Específica</strong>
                  <span>Válido únicamente para una salida seleccionada.</span>
                </div>
              </label>

              <label class="scope-box" [class.selected]="scope() === 'provider'">
                <input
                  type="radio"
                  name="scope"
                  value="provider"
                  [checked]="scope() === 'provider'"
                  (change)="scope.set('provider')"
                />
                <div class="scope-icon text-purple">
                  <mat-icon>storefront</mat-icon>
                </div>
                <div class="scope-info">
                  <strong>Prestador Específico</strong>
                  <span>Válido para salidas de un prestador determinado.</span>
                </div>
              </label>

              <label class="scope-box" [class.selected]="scope() === 'membership'">
                <input
                  type="radio"
                  name="scope"
                  value="membership"
                  [checked]="scope() === 'membership'"
                  (change)="scope.set('membership')"
                />
                <div class="scope-icon text-emerald">
                  <mat-icon>card_membership</mat-icon>
                </div>
                <div class="scope-info">
                  <strong>Exclusivo Socio Pleno</strong>
                  <span>Beneficio reservado para miembros con suscripción activa.</span>
                </div>
              </label>
            </div>

            <!-- Selector de experiencia si scope === 'experience' -->
            @if (scope() === 'experience') {
              <div class="experience-picker-box">
                <label class="field-label" for="discount-experience-id">Seleccionar Experiencia *</label>
                <select
                  id="discount-experience-id"
                  [(ngModel)]="experienceId"
                  [ngModelOptions]="{standalone: true}"
                  (ngModelChange)="onExperienceChange($event)"
                  required
                  class="text-input select-input"
                >
                  @if (!experienceId() && experienceSlug()) {
                    <option [value]="''" disabled selected>
                      Experiencia vinculada: {{ experienceSlug() }}
                    </option>
                  } @else {
                    <option value="" disabled>Seleccioná una experiencia del catálogo...</option>
                  }
                  @for (exp of experiences(); track exp.id) {
                    <option [value]="exp.id">
                      {{ exp.title }} — {{ exp.providerAgency || exp.providerName || 'Oficial' }} (\${{ exp.priceArs | ars }})
                    </option>
                  }
                </select>
                <span class="field-hint">El descuento solo podrá canjearse al reservar esta salida.</span>
              </div>
            }

            <!-- Selector de prestador si scope === 'provider' -->
            @if (scope() === 'provider') {
              <div class="experience-picker-box">
                <label class="field-label" for="discount-provider-id">Seleccionar Prestador *</label>
                <select
                  id="discount-provider-id"
                  [(ngModel)]="providerId"
                  [ngModelOptions]="{standalone: true}"
                  required
                  class="text-input select-input"
                >
                  <option value="" disabled>Seleccioná un prestador de la red...</option>
                  @for (p of providers(); track p.id) {
                    <option [value]="p.id">
                      {{ p.agency || p.name }} ({{ p.name || p.id }})
                    </option>
                  }
                </select>
                <span class="field-hint">El descuento se aplicará a todas las salidas organizadas por este prestador.</span>
              </div>
            }
          </section>

          <!-- PASO 4: Condiciones y Vigencia (Opcional) -->
          <section class="form-card">
            <div class="card-header-row">
              <div class="step-num">4</div>
              <div>
                <h2 class="card-title">Condiciones Opcionales & Vigencia</h2>
                <p class="card-desc">Límites de uso, montos mínimos o período de fechas.</p>
              </div>
            </div>

            <div class="form-grid-2">
              <div class="field-item">
                <label class="field-label" for="discount-starts-at">Fecha de Inicio (Opcional)</label>
                <input
                  id="discount-starts-at"
                  type="date"
                  [(ngModel)]="startsAt"
                  [ngModelOptions]="{standalone: true}"
                  class="text-input"
                />
                <span class="field-hint">Vacío = disponible desde hoy.</span>
              </div>

              <div class="field-item">
                <label class="field-label" for="discount-ends-at">Fecha de Expiración (Opcional)</label>
                <input
                  id="discount-ends-at"
                  type="date"
                  [(ngModel)]="endsAt"
                  [ngModelOptions]="{standalone: true}"
                  class="text-input"
                />
                <span class="field-hint">Vacío = vigencia permanente sin vencimiento.</span>
              </div>

              <div class="field-item">
                <label class="field-label" for="discount-min-amount">Monto Mínimo de Compra ($ ARS)</label>
                <input
                  id="discount-min-amount"
                  type="number"
                  [(ngModel)]="minAmountArs"
                  [ngModelOptions]="{standalone: true}"
                  placeholder="0 = Sin mínimo"
                  min="0"
                  class="text-input"
                />
                <span class="field-hint">El carrito debe superar este monto para activar el cupón.</span>
              </div>

              <div class="field-item">
                <label class="field-label" for="discount-max-uses">Límite Máximo de Canjes Totales</label>
                <input
                  id="discount-max-uses"
                  type="number"
                  [(ngModel)]="maxUses"
                  [ngModelOptions]="{standalone: true}"
                  placeholder="Dejar vacío para ilimitado"
                  min="1"
                  class="text-input"
                />
                <span class="field-hint">Se pausará automáticamente al alcanzar este número.</span>
              </div>

              @if (category() !== 'fixed_amount') {
                <div class="field-item full-width">
                  <label class="field-label" for="discount-max-discount">Tope Máximo de Descuento ($ ARS Opcional)</label>
                  <input
                    id="discount-max-discount"
                    type="number"
                    [(ngModel)]="maxDiscountArs"
                    [ngModelOptions]="{standalone: true}"
                    placeholder="Dejar vacío para sin tope"
                    min="1"
                    class="text-input"
                  />
                  <span class="field-hint">Límite máximo en pesos que puede bonificar la promoción.</span>
                </div>
              }
            </div>
          </section>

          <!-- Error Alert si hubiese -->
          @if (formError()) {
            <div class="form-error-banner">
              <mat-icon>error_outline</mat-icon>
              <span>{{ formError() }}</span>
            </div>
          }

          <!-- Botones de Acción Móvil/Inferior -->
          <div class="footer-actions-bar">
            <button type="button" class="btn-cancel" (click)="goBack()">
              Cancelar
            </button>
            <button type="submit" class="btn-save-primary" [disabled]="isSaveDisabled()">
              @if (saving()) {
                <span class="spinner-inline"></span>
                <span>Guardando...</span>
              } @else {
                <mat-icon class="icon-btn">check</mat-icon>
                <span>{{ isEditing() ? 'Guardar Cambios' : 'Crear Promoción' }}</span>
              }
            </button>
          </div>
        </main>

        <!-- Columna Lateral: Resumen en Vivo / Preview de la Promoción -->
        <aside class="editor-side-col">
          <div class="preview-card-sticky">
            <div class="preview-badge-kicker">VISTA PREVIA DEL SOCIO</div>
            <h3 class="preview-heading">Cómo se verá en la web</h3>

            <!-- Tarjeta simulación cupón -->
            <div class="live-coupon-box">
              <div class="coupon-top">
                <span class="coupon-tag">PROMOCIÓN</span>
                <span class="coupon-benefit-highlight">
                  @if (category() === 'group') {
                    {{ groupTravelers() }}x{{ groupPayers() }} ({{ calculatedGroupPercentage() }}% OFF)
                  } @else if (category() === 'percentage') {
                    {{ percentValue() || 0 }}% OFF
                  } @else {
                    \${{ (fixedValue() || 0) | ars }} OFF
                  }
                </span>
              </div>

              <div class="coupon-code-display">
                <span class="code-label">CÓDIGO DE CUPÓN</span>
                <strong class="code-text">{{ code() || 'CÓDIGO' }}</strong>
              </div>

              <p class="coupon-title-display">{{ name() || 'Nombre de la Promoción' }}</p>

              <div class="coupon-meta-list">
                <div class="meta-row">
                  <span class="meta-k">Aplicación:</span>
                  <span class="meta-v">{{ isAutomatic() ? 'Automática directa' : 'Con código manual' }}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-k">Alcance:</span>
                  <span class="meta-v">
                    @if (scope() === 'general') {
                      Toda la red
                    } @else if (scope() === 'experience') {
                      {{ getSelectedExperienceName() }}
                    } @else if (scope() === 'provider') {
                      {{ getSelectedProviderName() }}
                    } @else if (scope() === 'membership') {
                      Socios Plenos
                    } @else {
                      Toda la red
                    }
                  </span>
                </div>
                <div class="meta-row">
                  <span class="meta-k">Vigencia:</span>
                  <span class="meta-v">{{ getVigenciaText() }}</span>
                </div>
              </div>
            </div>

            <!-- Botones de Acción en Sidebar -->
            <div class="side-actions-box">
              <button type="submit" class="btn-save-primary w-100" [disabled]="isSaveDisabled()">
                @if (saving()) {
                  <span>Guardando...</span>
                } @else {
                  <mat-icon class="icon-btn">check</mat-icon>
                  <span>{{ isEditing() ? 'Guardar Cambios' : 'Crear Promoción' }}</span>
                }
              </button>
              <button type="button" class="btn-cancel w-100" (click)="goBack()">
                Cancelar
              </button>
            </div>
          </div>
        </aside>
      </form>
      }
    </div>
  `,
  styles: [`
    .editor-page-container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 1.5rem 1.75rem 4rem;
      color: #ffffff;
      font-family: var(--font-sans);
    }

    .editor-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .btn-back {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #ffffff;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-back:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.25);
    }

    .state-card {
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 3.5rem 2rem;
      text-align: center;
      max-width: 580px;
      margin: 3rem auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .state-card .state-icon {
      font-size: 3.2rem;
      width: 3.2rem;
      height: 3.2rem;
    }

    .state-loading .state-icon {
      color: #f59e0b;
      animation: spin 1.2s linear infinite;
    }

    .state-not-found .state-icon {
      color: #9ca3af;
    }

    .state-error .state-icon {
      color: #ef4444;
    }

    .state-card h3 {
      font-size: 1.3rem;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
    }

    .state-card p {
      font-size: 0.95rem;
      color: #9ca3af;
      margin: 0;
      max-width: 440px;
      line-height: 1.5;
    }

    .state-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.75rem;
    }

    .btn-retry {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: #f59e0b;
      color: #111827;
      border: none;
      padding: 0.55rem 1.25rem;
      border-radius: 6px;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-retry:hover {
      background: #d97706;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.8rem;
      font-weight: 700;
      padding: 0.35rem 0.8rem;
      border-radius: 20px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
    }

    .status-badge.badge-paused {
      background: rgba(239, 68, 68, 0.12);
      border-color: rgba(239, 68, 68, 0.3);
      color: #f87171;
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
    }

    .editor-header {
      margin-bottom: 2rem;
    }

    .editor-kicker {
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      color: #ffd42a;
      text-transform: uppercase;
      display: block;
      margin-bottom: 0.35rem;
    }

    .editor-title {
      font-size: 1.85rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 0.5rem;
      color: #ffffff;
    }

    .editor-sub {
      font-size: 0.95rem;
      color: rgba(255, 255, 255, 0.72);
      margin: 0;
      max-width: 720px;
      line-height: 1.5;
    }

    /* Layout en dos columnas */
    .editor-layout {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: 1.75rem;
      align-items: start;
    }

    @media (max-width: 980px) {
      .editor-layout {
        grid-template-columns: 1fr;
      }
    }

    .editor-main-col {
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }

    /* Tarjetas de formulario */
    .form-card {
      background: rgba(14, 21, 33, 0.72);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 1.6rem 1.8rem;
      backdrop-filter: blur(12px);
    }

    .card-header-row {
      display: flex;
      align-items: flex-start;
      gap: 0.85rem;
      margin-bottom: 1.4rem;
    }

    .step-num {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #ffd42a;
      color: #0c121d;
      font-weight: 800;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .card-title {
      font-size: 1.15rem;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 0.2rem;
    }

    .card-desc {
      font-size: 0.84rem;
      color: rgba(255, 255, 255, 0.6);
      margin: 0;
    }

    /* Selector de modalidad (Paso 1) */
    .category-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.85rem;
      margin-bottom: 1.25rem;
    }

    .category-card {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1.5px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 1rem 1.2rem;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s ease;
      color: #ffffff;
      width: 100%;
    }

    .category-card:hover {
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .category-card.selected {
      background: rgba(255, 212, 42, 0.06);
      border-color: #ffd42a;
      box-shadow: 0 0 0 1px #ffd42a;
    }

    .cat-icon-badge {
      width: 38px;
      height: 38px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .text-gold { color: #ffd42a !important; }
    .text-blue { color: #60a5fa !important; }
    .text-emerald { color: #34d399 !important; }
    .text-purple { color: #c084fc !important; }

    .cat-content {
      flex: 1;
    }

    .cat-title-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
      margin-bottom: 0.25rem;
    }

    .cat-title {
      font-size: 0.98rem;
      font-weight: 700;
      color: #ffffff;
    }

    .cat-pill-popular {
      font-size: 0.65rem;
      font-weight: 800;
      background: rgba(255, 212, 42, 0.18);
      color: #ffd42a;
      border: 1px solid rgba(255, 212, 42, 0.35);
      border-radius: 4px;
      padding: 0.15rem 0.45rem;
      letter-spacing: 0.06em;
    }

    .cat-desc {
      font-size: 0.82rem;
      color: #ffffff;
      margin: 0;
      line-height: 1.4;
    }

    /* Subpanel de grupo */
    .subpanel {
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 1.25rem 1.4rem;
      margin-top: 1rem;
    }

    .group-subpanel {
      border-color: rgba(255, 212, 42, 0.25);
    }

    .subpanel-title-row {
      display: flex;
      align-items: flex-start;
      gap: 0.65rem;
      margin-bottom: 1.15rem;
    }

    .subpanel-icon {
      margin-top: 2px;
    }

    .subpanel-title {
      font-size: 0.95rem;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 0.15rem;
    }

    .subpanel-subtitle {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.6);
      margin: 0;
    }

    .preset-buttons-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 0.65rem;
      margin-bottom: 1.25rem;
    }

    .preset-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.2rem;
      padding: 0.75rem 0.5rem;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      cursor: pointer;
      color: #ffffff;
      transition: all 0.2s ease;
      text-align: center;
    }

    .preset-btn strong {
      font-size: 1.1rem;
      font-weight: 800;
      color: #ffffff;
    }

    .preset-btn span {
      font-size: 0.7rem;
      color: #ffffff;
    }

    .preset-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.25);
    }

    .preset-btn.active {
      background: rgba(255, 212, 42, 0.12);
      border-color: #ffd42a;
    }

    .preset-btn.active strong {
      color: #ffffff;
    }

    .preset-btn.active span {
      color: #ffffff;
    }

    .group-inputs-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
      margin-bottom: 1.25rem;
    }

    @media (max-width: 600px) {
      .group-inputs-grid {
        grid-template-columns: 1fr;
      }
    }

    .stepper-input {
      display: flex;
      align-items: center;
      background: rgba(14, 21, 33, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      overflow: hidden;
      margin-top: 0.4rem;
    }

    .btn-step {
      width: 44px;
      height: 44px;
      background: rgba(255, 255, 255, 0.06);
      border: none;
      color: #ffffff;
      font-size: 1.3rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s ease;
    }

    .btn-step:hover {
      background: rgba(255, 255, 255, 0.12);
    }

    .step-val {
      flex: 1;
      text-align: center;
      background: transparent;
      border: none;
      color: #ffd42a;
      font-size: 1.25rem;
      font-weight: 800;
      outline: none;
      padding: 0.4rem;
    }

    /* Callout de Simulación */
    .simulation-callout {
      background: rgba(255, 212, 42, 0.06);
      border: 1px solid rgba(255, 212, 42, 0.25);
      border-radius: 8px;
      padding: 1rem 1.15rem;
    }

    .sim-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: #ffd42a;
      color: #0c121d;
      font-size: 0.76rem;
      font-weight: 800;
      padding: 0.25rem 0.65rem;
      border-radius: 4px;
      margin-bottom: 0.65rem;
      letter-spacing: 0.04em;
    }

    .sim-desc {
      font-size: 0.88rem;
      color: #ffffff;
      margin: 0 0 0.65rem;
      line-height: 1.5;
    }

    .sim-example {
      font-size: 0.82rem;
      color: rgba(255, 255, 255, 0.7);
      background: rgba(0, 0, 0, 0.25);
      padding: 0.6rem 0.8rem;
      border-radius: 6px;
      line-height: 1.45;
    }

    .example-title {
      display: block;
      font-weight: 700;
      color: #ffd42a;
      margin-bottom: 0.2rem;
    }

    /* Preset pills para % y monto fijo */
    .preset-pills-row {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-bottom: 0.85rem;
    }

    .preset-pill {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #ffffff;
      padding: 0.35rem 0.85rem;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .preset-pill:hover {
      background: rgba(255, 255, 255, 0.12);
    }

    .preset-pill.active {
      background: #ffd42a;
      color: #ffffff;
      border-color: #ffd42a;
    }

    .input-with-suffix {
      display: flex;
      align-items: center;
      background: rgba(14, 21, 33, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      padding: 0 0.85rem;
      max-width: 280px;
    }

    .input-prefix, .input-suffix {
      font-size: 1.1rem;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.5);
    }

    .input-with-suffix .text-input {
      border: none;
      background: transparent;
      padding-left: 0.4rem;
      padding-right: 0.4rem;
      font-size: 1.15rem;
      font-weight: 700;
    }

    /* Campos generales */
    .form-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }

    @media (max-width: 700px) {
      .form-grid-2 {
        grid-template-columns: 1fr;
      }
    }

    .field-item {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .field-item.full-width {
      grid-column: 1 / -1;
    }

    .field-label {
      font-size: 0.85rem;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.9);
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .hint-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
      color: rgba(255, 255, 255, 0.4);
      cursor: help;
    }

    .label-with-action {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .btn-text-action {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      background: transparent;
      border: none;
      color: #ffffff;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      padding: 0;
    }

    .btn-text-action:hover {
      text-decoration: underline;
    }

    .icon-xs {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .text-input {
      width: 100%;
      box-sizing: border-box;
      padding: 0.75rem 0.95rem;
      background: rgba(14, 21, 33, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      color: #ffffff;
      font-size: 0.92rem;
      outline: none;
      transition: border-color 0.2s ease;
    }

    .text-input:focus {
      border-color: #ffd42a;
    }

    .code-input {
      font-family: monospace;
      font-size: 1.05rem;
      letter-spacing: 0.05em;
      font-weight: 800;
      color: #ffd42a;
      text-transform: uppercase;
    }

    .textarea {
      resize: vertical;
      line-height: 1.45;
    }

    .field-hint {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.5);
      line-height: 1.35;
    }

    /* Selector de modo de aplicación */
    .application-mode-box {
      margin-top: 1.25rem;
      padding: 1.15rem;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
    }

    .app-mode-label {
      font-size: 0.82rem;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.85);
      display: block;
      margin-bottom: 0.75rem;
    }

    .app-mode-radios {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.85rem;
    }

    @media (max-width: 600px) {
      .app-mode-radios {
        grid-template-columns: 1fr;
      }
    }

    .radio-option {
      display: flex;
      align-items: flex-start;
      gap: 0.65rem;
      padding: 0.75rem 0.9rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .radio-option.selected {
      background: rgba(255, 212, 42, 0.06);
      border-color: #ffd42a;
    }

    .radio-text strong {
      font-size: 0.88rem;
      color: #ffffff;
      display: block;
      margin-bottom: 0.15rem;
    }

    .radio-text span {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.35;
    }

    /* Opciones de alcance (Paso 3) */
    .scope-options-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.85rem;
    }

    .scope-box {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem 1.1rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1.5px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .scope-box:hover {
      background: rgba(255, 255, 255, 0.06);
    }

    .scope-box.selected {
      background: rgba(255, 212, 42, 0.06);
      border-color: #ffd42a;
    }

    .scope-info strong {
      font-size: 0.9rem;
      color: #ffffff;
      display: block;
      margin-bottom: 0.2rem;
    }

    .scope-info span {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.35;
    }

    .experience-picker-box {
      margin-top: 1.25rem;
      padding: 1rem 1.15rem;
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(96, 165, 250, 0.3);
      border-radius: 8px;
    }

    .select-input option {
      background: #0f172a;
      color: #ffffff;
    }

    /* Barra de Error */
    .form-error-banner {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #fca5a5;
      padding: 0.85rem 1.1rem;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 600;
    }

    /* Footer acciones */
    .footer-actions-bar {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 1rem;
      padding-top: 1rem;
    }

    .btn-cancel {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #ffffff;
      padding: 0.75rem 1.4rem;
      border-radius: 6px;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-cancel:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.35);
    }

    .btn-save-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: #ffd42a;
      border: none;
      color: #ffffff;
      padding: 0.8rem 1.8rem;
      border-radius: 6px;
      font-size: 0.95rem;
      font-weight: 800;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-save-primary:hover:not(:disabled) {
      background: #ffdb4d;
      transform: translateY(-1px);
      box-shadow: 0 4px 14px rgba(255, 212, 42, 0.35);
    }

    .btn-save-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .icon-btn {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .w-100 {
      width: 100%;
    }

    /* Columna lateral / Live Preview */
    .preview-card-sticky {
      position: sticky;
      top: 1.5rem;
      background: rgba(14, 21, 33, 0.72);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 1.4rem;
      backdrop-filter: blur(12px);
    }

    .preview-badge-kicker {
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      color: #ffd42a;
      margin-bottom: 0.2rem;
    }

    .preview-heading {
      font-size: 1.05rem;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 1.15rem;
    }

    .live-coupon-box {
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%);
      border: 1.5px dashed rgba(255, 212, 42, 0.45);
      border-radius: 10px;
      padding: 1.15rem;
      margin-bottom: 1.25rem;
    }

    .coupon-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.85rem;
    }

    .coupon-tag {
      font-size: 0.68rem;
      font-weight: 800;
      background: rgba(255, 255, 255, 0.1);
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      letter-spacing: 0.05em;
    }

    .coupon-benefit-highlight {
      font-size: 0.9rem;
      font-weight: 800;
      color: #ffd42a;
    }

    .coupon-code-display {
      background: rgba(0, 0, 0, 0.4);
      border-radius: 6px;
      padding: 0.65rem 0.8rem;
      margin-bottom: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .code-label {
      font-size: 0.65rem;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.5);
      letter-spacing: 0.05em;
    }

    .code-text {
      font-family: monospace;
      font-size: 1.2rem;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: 0.08em;
    }

    .coupon-title-display {
      font-size: 0.92rem;
      font-weight: 700;
      color: #ffffff;
      margin: 0 0 0.85rem;
      line-height: 1.35;
    }

    .coupon-meta-list {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      padding-top: 0.75rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 0.76rem;
    }

    .meta-row {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .meta-k {
      color: rgba(255, 255, 255, 0.5);
    }

    .meta-v {
      color: #ffffff;
      font-weight: 600;
      text-align: right;
    }

    .side-actions-box {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .spinner-inline {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(0, 0, 0, 0.3);
      border-top-color: #000000;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class AdminDiscountEditorComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly discountService = inject(DiscountService);
  private readonly experienceService = inject(ExperienceService);
  private readonly providerStore = inject(ProviderStoreService, { optional: true });

  private isDestroyed = false;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.isDestroyed = true;
    });
  }

  readonly experiences = computed(() => this.experienceService.experiences());

  readonly providers = computed(() => {
    const list = this.providerStore?.allProviders?.() || this.providerStore?.providers?.() || [];
    if (list.length > 0) {
      return list;
    }
    const map = new Map<string, { id: string; name: string; agency?: string }>();
    for (const exp of this.experiences()) {
      const pId = exp.providerId || exp.providerSlug;
      if (pId && !map.has(pId)) {
        map.set(pId, {
          id: pId,
          name: exp.providerAgency || exp.providerName || 'Prestador',
          agency: exp.providerAgency,
        });
      }
    }
    return Array.from(map.values());
  });

  // Estado de edición
  readonly isEditing = signal<boolean>(false);
  readonly editingId = signal<string | null>(null);

  // Form State
  readonly category = signal<PromotionCategory>('group');
  readonly groupTravelers = signal<number>(2);
  readonly groupPayers = signal<number>(1);
  readonly percentValue = signal<number>(15);
  readonly fixedValue = signal<number>(10000);

  readonly code = signal<string>('PROMO2X1');
  readonly name = signal<string>('Promoción 2x1 en Reservas');
  readonly description = signal<string>('Viajan 2 personas y abonan únicamente 1 cupo.');

  readonly codeManuallyEdited = signal<boolean>(false);
  readonly nameManuallyEdited = signal<boolean>(false);
  readonly descriptionManuallyEdited = signal<boolean>(false);

  private lastSuggestedCode = 'PROMO2X1';
  private lastSuggestedName = 'Promoción 2x1 en Reservas';
  private lastSuggestedDescription = 'Viajan 2 personas y abonan únicamente 1 cupo.';

  isCodeEdited(): boolean {
    if (this.codeManuallyEdited()) return true;
    const current = this.code();
    return current !== this.lastSuggestedCode && current !== 'PROMO2X1';
  }

  isNameEdited(): boolean {
    if (this.nameManuallyEdited()) return true;
    const current = this.name();
    return current !== this.lastSuggestedName && current !== 'Promoción 2x1 en Reservas';
  }

  isDescriptionEdited(): boolean {
    if (this.descriptionManuallyEdited()) return true;
    const current = this.description();
    return (
      current !== this.lastSuggestedDescription &&
      current !== 'Viajan 2 personas y abonan únicamente 1 cupo.' &&
      current !== 'Viajan 2 personas y abonan únicamente 1 cupo(s) (50% OFF).'
    );
  }

  readonly isAutomatic = signal<boolean>(false);
  readonly scope = signal<DiscountScope>('general');
  readonly experienceId = signal<string>('');
  readonly experienceSlug = signal<string>('');
  readonly providerId = signal<string>('');

  readonly minAmountArs = signal<number | null>(null);
  readonly maxDiscountArs = signal<number | null>(null);
  readonly startsAt = signal<string>('');
  readonly endsAt = signal<string>('');
  readonly maxUses = signal<number | null>(null);
  readonly active = signal<boolean>(true);

  readonly saving = signal<boolean>(false);
  readonly formError = signal<string | null>(null);

  readonly isLoadingDiscount = signal<boolean>(false);
  readonly discountNotFound = signal<boolean>(false);
  readonly loadError = signal<string | null>(null);
  readonly discountLoaded = signal<boolean>(false);

  readonly isSaveDisabled = computed(() => {
    return (
      this.saving() ||
      (this.isEditing() &&
        (this.discountNotFound() || !!this.loadError() || this.isLoadingDiscount()))
    );
  });

  // Cálculo del porcentaje en modo grupo
  readonly calculatedGroupPercentage = computed(() => {
    const t = Math.max(2, Number(this.groupTravelers()) || 2);
    const p = Math.max(1, Math.min(t - 1, Number(this.groupPayers()) || 1));
    const pct = ((t - p) / t) * 100;
    return Math.round(pct * 10) / 10;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditing.set(true);
      this.editingId.set(id);
      void this.loadExistingDiscount(id);
    }
  }

  async loadExistingDiscount(id: string): Promise<void> {
    this.discountNotFound.set(false);
    this.loadError.set(null);
    this.isLoadingDiscount.set(true);

    try {
      const found = this.discountService.getDiscountById(id);
      if (found) {
        this.populateFromDiscount(found);
        this.isLoadingDiscount.set(false);
        return;
      }

      const all = await this.discountService.loadDiscounts();

      let serviceError: string | null = null;
      if (typeof (this.discountService as any).error === 'function') {
        serviceError = (this.discountService as any).error();
      } else if (typeof (this.discountService as any).error === 'string') {
        serviceError = (this.discountService as any).error;
      }

      if (serviceError && (!all || all.length === 0)) {
        this.loadError.set(serviceError || 'Error al cargar los datos del descuento.');
        return;
      }

      const d = all?.find((item) => item.id === id);
      if (d) {
        this.populateFromDiscount(d);
      } else if (serviceError) {
        this.loadError.set(serviceError);
      } else {
        this.discountNotFound.set(true);
      }
    } catch (err: any) {
      this.loadError.set(err?.message || 'Error al cargar los datos del descuento.');
    } finally {
      this.isLoadingDiscount.set(false);
    }
  }

  retryLoadDiscount(): void {
    const id = this.editingId() || this.route.snapshot.paramMap.get('id');
    if (id) {
      void this.loadExistingDiscount(id);
    }
  }

  private populateFromDiscount(disc: Discount): void {
    this.discountLoaded.set(true);
    this.discountNotFound.set(false);
    this.loadError.set(null);
    this.code.set(disc.code);
    this.name.set(disc.name);
    this.description.set(disc.description || '');
    this.lastSuggestedCode = disc.code;
    this.lastSuggestedName = disc.name;
    this.lastSuggestedDescription = disc.description || '';
    this.codeManuallyEdited.set(true);
    this.nameManuallyEdited.set(true);
    this.descriptionManuallyEdited.set(true);
    this.scope.set(disc.scope);
    this.experienceId.set(disc.experienceId || '');
    this.experienceSlug.set(disc.experienceSlug || '');
    this.providerId.set(disc.providerId || '');

    // Si experienceId es nulo pero experienceSlug existe, intentar resolverlo contra el catálogo
    if (!disc.experienceId && disc.experienceSlug) {
      const match = this.experiences().find(
        (e) => (e.slug || '').toLowerCase() === disc.experienceSlug!.toLowerCase(),
      );
      if (match) {
        this.experienceId.set(match.id);
        if (match.slug) {
          this.experienceSlug.set(match.slug);
        }
      }
    }
    this.isAutomatic.set(disc.isAutomatic);
    this.minAmountArs.set(disc.minAmountArs || null);
    this.maxDiscountArs.set(disc.maxDiscountArs || null);
    this.startsAt.set(disc.startsAt ? disc.startsAt.split('T')[0] : '');
    this.endsAt.set(disc.endsAt ? disc.endsAt.split('T')[0] : '');
    this.maxUses.set(disc.maxUses || null);
    this.active.set(disc.active);

    // Detectar si fue grupo o porcentaje o monto fijo
    if (disc.discountType === 'fixed_amount') {
      this.category.set('fixed_amount');
      this.fixedValue.set(disc.discountValue);
    } else if (
      disc.discountValue === 50 &&
      (disc.code.includes('2X1') || (disc.name && disc.name.toLowerCase().includes('2x1')))
    ) {
      this.category.set('group');
      this.groupTravelers.set(2);
      this.groupPayers.set(1);
    } else if (
      Math.abs(disc.discountValue - 33.3) < 1 &&
      (disc.code.includes('3X2') || (disc.name && disc.name.toLowerCase().includes('3x2')))
    ) {
      this.category.set('group');
      this.groupTravelers.set(3);
      this.groupPayers.set(2);
    } else if (
      disc.discountValue === 25 &&
      (disc.code.includes('4X3') || (disc.name && disc.name.toLowerCase().includes('4x3')))
    ) {
      this.category.set('group');
      this.groupTravelers.set(4);
      this.groupPayers.set(3);
    } else {
      this.category.set('percentage');
      this.percentValue.set(disc.discountValue);
    }
  }

  setCategory(cat: PromotionCategory): void {
    this.category.set(cat);
    this.formError.set(null);

    // Auto sugerir textos si es nuevo y no se editaron manualmente
    if (!this.isEditing()) {
      if (cat === 'group') {
        this.applyGroupPreset(this.groupTravelers() || 2, this.groupPayers() || 1);
      } else if (cat === 'percentage') {
        this.setPercentValue(this.percentValue() || 15);
      } else {
        this.setFixedValue(this.fixedValue() || 10000);
      }
    }
  }

  applyGroupPreset(travelers: number, payers: number): void {
    this.groupTravelers.set(travelers);
    this.groupPayers.set(payers);

    if (!this.isEditing()) {
      const codeKey = `${travelers}X${payers}`;
      if (!this.isCodeEdited()) {
        const c = `PROMO${codeKey}`;
        this.code.set(c);
        this.lastSuggestedCode = c;
      }
      if (!this.isNameEdited()) {
        const n = `Promoción ${codeKey} en Reservas`;
        this.name.set(n);
        this.lastSuggestedName = n;
      }
      if (!this.isDescriptionEdited()) {
        const d = `Viajan ${travelers} personas y abonan únicamente ${payers} cupo(s) (${this.calculatedGroupPercentage()}% OFF).`;
        this.description.set(d);
        this.lastSuggestedDescription = d;
      }
    }
  }

  adjustTravelers(delta: number): void {
    const next = Math.max(2, this.groupTravelers() + delta);
    this.groupTravelers.set(next);
    if (this.groupPayers() >= next) {
      this.groupPayers.set(next - 1);
    }
    this.updateGroupTexts();
  }

  adjustPayers(delta: number): void {
    const maxAllowed = this.groupTravelers() - 1;
    const next = Math.max(1, Math.min(maxAllowed, this.groupPayers() + delta));
    this.groupPayers.set(next);
    this.updateGroupTexts();
  }

  private updateGroupTexts(): void {
    if (!this.isEditing()) {
      const t = this.groupTravelers();
      const p = this.groupPayers();
      if (!this.isCodeEdited()) {
        const c = `PROMO${t}X${p}`;
        this.code.set(c);
        this.lastSuggestedCode = c;
      }
      if (!this.isNameEdited()) {
        const n = `Promoción ${t}x${p} en Reservas`;
        this.name.set(n);
        this.lastSuggestedName = n;
      }
      if (!this.isDescriptionEdited()) {
        const d = `Viajan ${t} personas y abonan únicamente ${p} cupo(s) (${this.calculatedGroupPercentage()}% OFF).`;
        this.description.set(d);
        this.lastSuggestedDescription = d;
      }
    }
  }

  setPercentValue(val: number): void {
    this.percentValue.set(val);
    if (!this.isEditing()) {
      if (!this.isCodeEdited()) {
        const c = `DESCUENTO${val}`;
        this.code.set(c);
        this.lastSuggestedCode = c;
      }
      if (!this.isNameEdited()) {
        const n = `${val}% OFF en Experiencias`;
        this.name.set(n);
        this.lastSuggestedName = n;
      }
      if (!this.isDescriptionEdited()) {
        const d = `Aplica un ${val}% de descuento sobre el total de la reserva.`;
        this.description.set(d);
        this.lastSuggestedDescription = d;
      }
    }
  }

  setFixedValue(val: number): void {
    this.fixedValue.set(val);
    if (!this.isEditing()) {
      const k = Math.round(val / 1000);
      if (!this.isCodeEdited()) {
        const c = `PROMO${k}K`;
        this.code.set(c);
        this.lastSuggestedCode = c;
      }
      if (!this.isNameEdited()) {
        const n = `$${val.toLocaleString('es-AR')} ARS OFF en tu Reserva`;
        this.name.set(n);
        this.lastSuggestedName = n;
      }
      if (!this.isDescriptionEdited()) {
        const d = `Descuento directo de $${val.toLocaleString('es-AR')} ARS en el total.`;
        this.description.set(d);
        this.lastSuggestedDescription = d;
      }
    }
  }

  suggestCode(): void {
    let suggested = '';
    if (this.category() === 'group') {
      suggested = `PROMO${this.groupTravelers()}X${this.groupPayers()}`;
    } else if (this.category() === 'percentage') {
      suggested = `DESCUENTO${this.percentValue() || 15}`;
    } else {
      const k = Math.round((this.fixedValue() || 10000) / 1000);
      suggested = `PROMO${k}K`;
    }
    this.code.set(suggested);
    this.lastSuggestedCode = suggested;
    this.codeManuallyEdited.set(false);
  }

  onCodeChange(val: string): void {
    this.codeManuallyEdited.set(true);
    if (val) {
      this.code.set(val.toUpperCase().replace(/\s+/g, ''));
    } else {
      this.code.set('');
    }
  }

  onNameChange(val: string): void {
    this.nameManuallyEdited.set(true);
    this.name.set(val || '');
  }

  onDescriptionChange(val: string): void {
    this.descriptionManuallyEdited.set(true);
    this.description.set(val || '');
  }

  onExperienceChange(expId: string): void {
    this.experienceId.set(expId);
    const exp = this.experiences().find((e) => e.id === expId);
    if (exp) {
      this.experienceSlug.set(exp.slug || '');
    } else if (!expId) {
      this.experienceSlug.set('');
    }
  }

  getSelectedExperienceName(): string {
    const exp = this.experiences().find(
      (e) =>
        (this.experienceId() && e.id === this.experienceId()) ||
        (this.experienceSlug() && (e.slug || '').toLowerCase() === this.experienceSlug().toLowerCase()),
    );
    if (exp) {
      return exp.shortTitle || exp.title;
    }
    if (this.experienceSlug()) {
      return this.experienceSlug();
    }
    return 'Salida seleccionada';
  }

  getSelectedProviderName(): string {
    const pId = this.providerId();
    if (!pId) return 'Prestador específico';
    const found = this.providers().find((p: any) => p.id === pId || p.slug === pId);
    if (found) {
      return found.agency || found.name || pId;
    }
    return `Prestador (${pId})`;
  }

  getVigenciaText(): string {
    if (!this.startsAt() && !this.endsAt()) return 'Permanente';
    if (this.startsAt() && this.endsAt()) return `${this.startsAt()} al ${this.endsAt()}`;
    if (this.endsAt()) return `Hasta ${this.endsAt()}`;
    return `Desde ${this.startsAt()}`;
  }

  private ownsActiveRoute(): boolean {
    if (this.isDestroyed) {
      return false;
    }

    try {
      let current: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
      while (current) {
        if (current === this.route.snapshot || current.component === AdminDiscountEditorComponent) {
          return true;
        }
        current = current.firstChild;
      }
    } catch {
      // Ignorar si routerState snapshot no está disponible
    }

    const rawPath = (this.router.url || '').split('?')[0].split('#')[0];
    return (
      rawPath.includes('/descuentos/nuevo') ||
      (rawPath.includes('/descuentos/') && rawPath.endsWith('/editar'))
    );
  }

  goBack(): void {
    const rawPath = this.router.url.split('?')[0].split('#')[0];
    const segments = rawPath.split('/').filter(Boolean);
    const isUnderAdmin = segments[0] === 'admin';
    const target = isUnderAdmin ? '/admin/descuentos' : '/descuentos';
    this.router.navigateByUrl(target);
  }

  async savePromotion(): Promise<void> {
    if (this.isSaveDisabled()) {
      return;
    }
    this.formError.set(null);

    const cleanCode = (this.code() || '').trim().toUpperCase();
    if (!cleanCode) {
      this.formError.set('Ingresá un código para el cupón (ej. PROMO2X1).');
      return;
    }
    if (!this.name().trim()) {
      this.formError.set('Ingresá un nombre identificatorio para la promoción.');
      return;
    }

    let discountType: DiscountType = 'percentage';
    let discountValue = 0;

    if (this.category() === 'group') {
      discountType = 'percentage';
      discountValue = this.calculatedGroupPercentage();
      if (discountValue <= 0 || discountValue > 100) {
        this.formError.set('La cantidad de personas que pagan debe ser menor a las que viajan.');
        return;
      }
    } else if (this.category() === 'percentage') {
      discountType = 'percentage';
      discountValue = Number(this.percentValue()) || 0;
      if (discountValue <= 0 || discountValue > 100) {
        this.formError.set('El porcentaje de descuento debe estar entre 1% y 100%.');
        return;
      }
    } else {
      discountType = 'fixed_amount';
      discountValue = Number(this.fixedValue()) || 0;
      if (discountValue <= 0) {
        this.formError.set('El monto de descuento debe ser mayor a $0.');
        return;
      }
    }

    if (this.scope() === 'experience') {
      // Si experienceId no está definido pero experienceSlug sí, intentar resolverlo al catálogo
      if (!this.experienceId() && this.experienceSlug()) {
        const matched = this.experiences().find(
          (e) => (e.slug || '').toLowerCase() === this.experienceSlug().toLowerCase(),
        );
        if (matched) {
          this.experienceId.set(matched.id);
          if (matched.slug) {
            this.experienceSlug.set(matched.slug);
          }
        }
      }

      // Debe existir al menos un target válido (catalog ID resuelto o slug preservado)
      if (!this.experienceId() && !this.experienceSlug()) {
        this.formError.set('Seleccioná la experiencia a la que aplica esta promoción.');
        return;
      }
    }

    if (this.scope() === 'provider' && !this.providerId()) {
      this.formError.set('Seleccioná el prestador al que aplica esta promoción.');
      return;
    }

    if (this.startsAt() && this.endsAt() && this.endsAt().trim() < this.startsAt().trim()) {
      this.formError.set('La fecha de finalización no puede ser anterior a la fecha de inicio.');
      return;
    }

    this.saving.set(true);
    try {
      const payload: CreateDiscountDto = {
        code: cleanCode,
        name: this.name().trim(),
        description: this.description().trim(),
        discountType,
        discountValue,
        scope: this.scope(),
        experienceId: this.scope() === 'experience' ? (this.experienceId() || null) : null,
        experienceSlug: this.scope() === 'experience' ? (this.experienceSlug() || null) : null,
        providerId: this.scope() === 'provider' ? (this.providerId() || null) : null,
        isAutomatic: this.isAutomatic(),
        minAmountArs: Number(this.minAmountArs()) || 0,
        maxDiscountArs: this.maxDiscountArs() ? Number(this.maxDiscountArs()) : null,
        startsAt: this.startsAt() ? new Date(this.startsAt()).toISOString() : null,
        endsAt: this.endsAt() ? new Date(this.endsAt() + 'T23:59:59Z').toISOString() : null,
        maxUses: this.maxUses() ? Number(this.maxUses()) : null,
        active: this.active(),
      };

      const saved =
        this.isEditing() && this.editingId()
          ? await this.discountService.updateDiscount(this.editingId()!, payload)
          : await this.discountService.createDiscount(payload);

      if (!saved) {
        let serviceError: string | null = null;
        if (typeof (this.discountService as any).error === 'function') {
          serviceError = (this.discountService as any).error();
        } else if (typeof (this.discountService as any).error === 'string') {
          serviceError = (this.discountService as any).error;
        }
        this.formError.set(
          serviceError || 'Error al guardar la promoción. Verificá los campos.',
        );
        return;
      }

      if (this.ownsActiveRoute()) {
        this.goBack();
      }
    } catch (err: any) {
      console.error('[DiscountEditor] Error guardando descuento:', err);
      this.formError.set(err?.message || 'Error al guardar la promoción. Verificá los campos.');
    } finally {
      this.saving.set(false);
    }
  }
}

