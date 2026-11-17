import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DiscountService } from '../../../core/services/discount.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { AdminStoreService } from '../../../core/services/admin-store.service';
import {
  Discount,
  DiscountType,
  DiscountScope,
  CreateDiscountDto,
} from '../../../core/models/discount.model';
import { ArsPipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-admin-discounts',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, ArsPipe],
  template: `
    <div class="discounts-page-container">
      <!-- Encabezado Principal -->
      <header class="discounts-header">
        <div>
          <span class="discounts-kicker">VENTAS & CONVERSIÓN</span>
          <h1 class="discounts-title">Gestión de Descuentos & Promociones</h1>
          <p class="discounts-sub">
            Administrá códigos de cupón y ofertas directas para experiencias individuales o para toda la plataforma.
          </p>
        </div>
        <button class="btn-create-discount" (click)="openCreateModal()">
          <mat-icon>add</mat-icon>
          <span>Nuevo Descuento</span>
        </button>
      </header>

      <!-- Franja de Métricas Resumen -->
      <section class="summary-strip">
        <div class="summary-card">
          <span class="sum-label">Cupones Activos</span>
          <strong class="sum-value text-emerald">{{ activeCount() }}</strong>
          <span class="sum-sub">{{ totalCount() }} promociones registradas</span>
        </div>

        <div class="summary-card">
          <span class="sum-label">Por Experiencia</span>
          <strong class="sum-value text-amber">{{ experienceSpecificCount() }}</strong>
          <span class="sum-sub">{{ automaticCount() }} automáticas</span>
        </div>

        <div class="summary-card">
          <span class="sum-label">Canjes Confirmados</span>
          <strong class="sum-value text-blue">{{ totalUsesCount() }}</strong>
          <span class="sum-sub">En reservas y pagos</span>
        </div>

        <div class="summary-card">
          <span class="sum-label">Total Ahorrado</span>
          <strong class="sum-value text-purple">{{ totalSavingsArs() | ars }}</strong>
          <span class="sum-sub">Beneficio total a socios</span>
        </div>
      </section>

      <!-- Barra de Filtros y Búsqueda -->
      <div class="filters-bar">
        <div class="search-input-wrap">
          <mat-icon class="search-icon">search</mat-icon>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Buscar por código, nombre o experiencia..."
            class="search-input"
          />
        </div>

        <div class="filter-controls">
          <select [(ngModel)]="statusFilter" class="filter-select">
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="paused">Pausados</option>
            <option value="expired">Vencidos</option>
          </select>

          <select [(ngModel)]="scopeFilter" class="filter-select">
            <option value="all">Todos los alcances</option>
            <option value="general">Generales (Toda la red)</option>
            <option value="experience">Por Experiencia Específica</option>
          </select>
        </div>
      </div>

      <!-- Tabla Principal de Descuentos -->
      <div class="table-container">
        <table class="dash-table">
          <thead>
            <tr>
              <th>CÓDIGO</th>
              <th>PROMOCIÓN</th>
              <th>ALCANCE</th>
              <th>BENEFICIO</th>
              <th>VIGENCIA</th>
              <th>USOS</th>
              <th>ESTADO</th>
              <th class="text-right">ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            @for (disc of filteredDiscounts(); track disc.id) {
              <tr>
                <td>
                  <div class="code-badge-wrap">
                    <span class="discount-code-pill" [class.code-auto]="disc.isAutomatic">
                      {{ disc.code }}
                    </span>
                    <button
                      type="button"
                      class="btn-copy-code"
                      title="Copiar código"
                      (click)="copyCode(disc.code)"
                    >
                      <mat-icon class="icon-tiny">content_copy</mat-icon>
                    </button>
                  </div>
                </td>
                <td>
                  <div class="disc-info">
                    <strong class="disc-name">{{ disc.name }}</strong>
                    @if (disc.description) {
                      <span class="disc-desc">{{ disc.description }}</span>
                    }
                  </div>
                </td>
                <td>
                  @if (disc.scope === 'experience') {
                    <div class="scope-exp-cell">
                      <mat-icon class="scope-icon text-amber">explore</mat-icon>
                      <span class="scope-text" [title]="getExperienceTitle(disc)">
                        {{ getExperienceTitle(disc) }}
                      </span>
                    </div>
                  } @else {
                    <span class="scope-general-pill">
                      <mat-icon class="icon-tiny">public</mat-icon>
                      General
                    </span>
                  }
                </td>
                <td>
                  <span class="benefit-badge" [class.benefit-pct]="disc.discountType === 'percentage'">
                    @if (disc.discountType === 'percentage') {
                      {{ disc.discountValue }}% OFF
                    } @else {
                      {{ disc.discountValue | ars }} OFF
                    }
                  </span>
                  @if (disc.minAmountArs > 0) {
                    <span class="min-amount-hint">Mín: {{ disc.minAmountArs | ars }}</span>
                  }
                </td>
                <td>
                  <span class="validity-text">
                    {{ formatValidity(disc) }}
                  </span>
                </td>
                <td>
                  <div class="uses-info">
                    <strong class="uses-count">{{ disc.usesCount }}</strong>
                    <span class="uses-max">
                      {{ disc.maxUses ? '/ ' + disc.maxUses : '(ilimitado)' }}
                    </span>
                  </div>
                </td>
                <td>
                  <button
                    type="button"
                    class="status-toggle-btn"
                    [class.active]="disc.active"
                    (click)="toggleActive(disc)"
                  >
                    <span class="status-dot"></span>
                    {{ disc.active ? 'Activo' : 'Pausado' }}
                  </button>
                </td>
                <td class="text-right">
                  <div class="actions-group">
                    <button
                      type="button"
                      class="action-btn edit-btn"
                      title="Editar descuento"
                      (click)="openEditModal(disc)"
                    >
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button
                      type="button"
                      class="action-btn delete-btn"
                      title="Eliminar descuento"
                      (click)="deleteDiscount(disc)"
                    >
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  </div>
                </td>
              </tr>
            }
            @if (filteredDiscounts().length === 0) {
              <tr>
                <td colspan="8" class="empty-cell">
                  <div class="empty-state">
                    <mat-icon class="empty-icon">local_offer</mat-icon>
                    <p>No se encontraron descuentos con los filtros seleccionados.</p>
                    <button class="btn-create-inline" (click)="openCreateModal()">
                      Crear primer descuento
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Modal de Creación / Edición -->
      @if (modalOpen()) {
        <div class="modal-backdrop" (click)="closeModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div class="modal-title-wrap">
                <mat-icon class="modal-title-icon">local_offer</mat-icon>
                <h3 class="modal-title">
                  {{ isEditing() ? 'Editar Descuento' : 'Nuevo Descuento' }}
                </h3>
              </div>
              <button type="button" class="btn-close" (click)="closeModal()">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <form (ngSubmit)="saveDiscount()" class="modal-form">
              <div class="form-grid">
                <!-- Código -->
                <div class="form-group">
                  <label class="form-label">Código de Cupón *</label>
                  <input
                    type="text"
                    name="code"
                    [(ngModel)]="formData.code"
                    (ngModelChange)="onCodeInput($event)"
                    placeholder="Ej. VERANO2026"
                    required
                    class="form-control code-input"
                  />
                  <span class="field-hint">Se guarda automáticamente en mayúsculas.</span>
                </div>

                <!-- Nombre -->
                <div class="form-group">
                  <label class="form-label">Nombre de la Promoción *</label>
                  <input
                    type="text"
                    name="name"
                    [(ngModel)]="formData.name"
                    placeholder="Ej. 15% Descuento Socios Club"
                    required
                    class="form-control"
                  />
                </div>

                <!-- Tipo de Descuento -->
                <div class="form-group">
                  <label class="form-label">Tipo de Descuento *</label>
                  <select name="discountType" [(ngModel)]="formData.discountType" class="form-control">
                    <option value="percentage">Porcentaje (%)</option>
                    <option value="fixed_amount">Monto Fijo ($ ARS)</option>
                  </select>
                </div>

                <!-- Valor -->
                <div class="form-group">
                  <label class="form-label">
                    {{ formData.discountType === 'percentage' ? 'Porcentaje de Rebaja (%) *' : 'Monto en Pesos ($ ARS) *' }}
                  </label>
                  <input
                    type="number"
                    name="discountValue"
                    [(ngModel)]="formData.discountValue"
                    [placeholder]="formData.discountType === 'percentage' ? 'Ej. 15' : 'Ej. 5000'"
                    min="1"
                    required
                    class="form-control"
                  />
                </div>

                <!-- Alcance -->
                <div class="form-group full-width">
                  <label class="form-label">Alcance de la Promoción *</label>
                  <div class="scope-radio-group">
                    <label class="radio-label">
                      <input
                        type="radio"
                        name="scope"
                        value="general"
                        [(ngModel)]="formData.scope"
                      />
                      <span>Todas las Experiencias (General)</span>
                    </label>
                    <label class="radio-label">
                      <input
                        type="radio"
                        name="scope"
                        value="experience"
                        [(ngModel)]="formData.scope"
                      />
                      <span>Experiencia Específica</span>
                    </label>
                  </div>
                </div>

                <!-- Selector de Experiencia si scope = experience -->
                @if (formData.scope === 'experience') {
                  <div class="form-group full-width">
                    <label class="form-label">Seleccionar Experiencia *</label>
                    <select
                      name="experienceId"
                      [(ngModel)]="formData.experienceId"
                      (ngModelChange)="onExperienceSelect($event)"
                      required
                      class="form-control"
                    >
                      <option value="" disabled>Elegí una experiencia...</option>
                      @for (exp of experiences(); track exp.id) {
                        <option [value]="exp.id">
                          {{ exp.title }} ({{ exp.providerAgency || exp.providerName || 'Oficial' }})
                        </option>
                      }
                    </select>
                  </div>
                }

                <!-- Checkbox Descuento Automático -->
                <div class="form-group full-width">
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      name="isAutomatic"
                      [(ngModel)]="formData.isAutomatic"
                    />
                    <span>
                      <strong>Descuento Automático Directo</strong> (Se aplica automáticamente en la experiencia sin que el usuario tenga que ingresar un código)
                    </span>
                  </label>
                </div>

                <!-- Monto Mínimo de Compra -->
                <div class="form-group">
                  <label class="form-label">Monto Mínimo de Reserva ($ ARS)</label>
                  <input
                    type="number"
                    name="minAmountArs"
                    [(ngModel)]="formData.minAmountArs"
                    placeholder="0 = Sin mínimo"
                    min="0"
                    class="form-control"
                  />
                </div>

                <!-- Tope Máximo (si es porcentaje) -->
                <div class="form-group">
                  <label class="form-label">Tope Máximo en $ ARS (Opcional)</label>
                  <input
                    type="number"
                    name="maxDiscountArs"
                    [(ngModel)]="formData.maxDiscountArs"
                    placeholder="Dejar vacío para sin tope"
                    min="0"
                    class="form-control"
                  />
                </div>

                <!-- Fecha Inicio -->
                <div class="form-group">
                  <label class="form-label">Fecha de Inicio (Opcional)</label>
                  <input
                    type="date"
                    name="startsAt"
                    [(ngModel)]="formData.startsAt"
                    class="form-control"
                  />
                </div>

                <!-- Fecha Fin -->
                <div class="form-group">
                  <label class="form-label">Fecha de Expiración (Opcional)</label>
                  <input
                    type="date"
                    name="endsAt"
                    [(ngModel)]="formData.endsAt"
                    class="form-control"
                  />
                </div>

                <!-- Límite de Usos -->
                <div class="form-group">
                  <label class="form-label">Límite Máximo de Canjes (Opcional)</label>
                  <input
                    type="number"
                    name="maxUses"
                    [(ngModel)]="formData.maxUses"
                    placeholder="Dejar vacío para ilimitado"
                    min="1"
                    class="form-control"
                  />
                </div>

                <!-- Estado Activo -->
                <div class="form-group">
                  <label class="form-label">Estado Inicial</label>
                  <select name="active" [(ngModel)]="formData.active" class="form-control">
                    <option [ngValue]="true">Activo</option>
                    <option [ngValue]="false">Pausado</option>
                  </select>
                </div>

                <!-- Descripción -->
                <div class="form-group full-width">
                  <label class="form-label">Descripción (Pública)</label>
                  <textarea
                    name="description"
                    [(ngModel)]="formData.description"
                    rows="2"
                    placeholder="Detalles sobre la campaña o condiciones visibles para los usuarios..."
                    class="form-control textarea"
                  ></textarea>
                  <span class="field-hint">Esta descripción es de acceso público y visible al consultar la promoción.</span>
                </div>
              </div>

              <!-- Mensaje de error si hubiese -->
              @if (formError()) {
                <div class="form-error-alert">
                  <mat-icon>error_outline</mat-icon>
                  <span>{{ formError() }}</span>
                </div>
              }

              <!-- Botones del modal -->
              <div class="modal-footer">
                <button type="button" class="btn-cancel" (click)="closeModal()">
                  Cancelar
                </button>
                <button type="submit" class="btn-submit" [disabled]="saving()">
                  @if (saving()) {
                    <span>Guardando...</span>
                  } @else {
                    <span>{{ isEditing() ? 'Guardar Cambios' : 'Crear Descuento' }}</span>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .discounts-page-container {
      max-width: 1380px;
      margin: 0 auto;
      padding: 1.5rem 2rem 4rem;
      color: #ffffff;
      font-family: var(--font-sans);
    }

    .discounts-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1.5rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }

    .discounts-kicker {
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      color: #ffd42a;
      text-transform: uppercase;
      display: block;
      margin-bottom: 0.35rem;
    }

    .discounts-title {
      font-size: 1.85rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 0.45rem;
      color: #ffffff;
    }

    .discounts-sub {
      font-size: 0.92rem;
      color: rgba(255, 255, 255, 0.7);
      margin: 0;
      max-width: 650px;
      line-height: 1.5;
    }

    .btn-create-discount {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.7rem 1.4rem;
      background: #80b3ff;
      color: #ffffff;
      border: none;
      border-radius: 4px;
      font-weight: 700;
      font-size: 0.88rem;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 14px rgba(128, 179, 255, 0.25);
    }

    .btn-create-discount:hover {
      background: #a6c8ff;
      transform: translateY(-1px);
    }

    /* Franja de Métricas */
    .summary-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .summary-card {
      background: rgba(14, 21, 33, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      padding: 1.25rem 1.4rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      backdrop-filter: blur(10px);
    }

    .sum-label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(255, 255, 255, 0.65);
    }

    .sum-value {
      font-size: 1.85rem;
      font-weight: 800;
      line-height: 1.15;
    }

    .sum-sub {
      font-size: 0.78rem;
      color: rgba(255, 255, 255, 0.5);
    }

    .text-emerald { color: #34d399; }
    .text-amber { color: #f59e0b; }
    .text-blue { color: #80b3ff; }
    .text-purple { color: #c084fc; }

    /* Barra de filtros */
    .filters-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.25rem;
      flex-wrap: wrap;
    }

    .search-input-wrap {
      position: relative;
      flex: 1;
      min-width: 280px;
      max-width: 480px;
    }

    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: rgba(255, 255, 255, 0.4);
    }

    .search-input {
      width: 100%;
      box-sizing: border-box;
      padding: 0.65rem 0.85rem 0.65rem 2.4rem;
      background: rgba(14, 21, 33, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 4px;
      color: #ffffff;
      font-size: 0.86rem;
      outline: none;
      transition: border-color 0.2s ease;
    }

    .search-input:focus {
      border-color: #80b3ff;
    }

    .filter-controls {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .filter-select {
      background: rgba(14, 21, 33, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 4px;
      padding: 0.65rem 1rem;
      color: #ffffff;
      font-size: 0.84rem;
      outline: none;
      cursor: pointer;
    }

    /* Tabla */
    .table-container {
      background: rgba(14, 21, 33, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow-x: auto;
      backdrop-filter: blur(10px);
    }

    .dash-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.86rem;
    }

    .dash-table th {
      text-align: left;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.55);
      padding: 0.85rem 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.02);
      white-space: nowrap;
    }

    .dash-table td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      vertical-align: middle;
    }

    .dash-table tr:hover {
      background: rgba(255, 255, 255, 0.03);
    }

    .text-right {
      text-align: right;
    }

    .code-badge-wrap {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .discount-code-pill {
      display: inline-flex;
      align-items: center;
      font-family: monospace;
      font-weight: 800;
      font-size: 0.85rem;
      letter-spacing: 0.05em;
      padding: 0.25rem 0.6rem;
      border-radius: 3px;
      background: rgba(128, 179, 255, 0.15);
      color: #80b3ff;
      border: 1px solid rgba(128, 179, 255, 0.3);
    }

    .discount-code-pill.code-auto {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border-color: rgba(245, 158, 11, 0.35);
    }

    .btn-copy-code {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.45);
      cursor: pointer;
      padding: 2px;
      display: flex;
      align-items: center;
      transition: color 0.2s ease;
    }

    .btn-copy-code:hover {
      color: #ffffff;
    }

    .icon-tiny {
      font-size: 15px;
      width: 15px;
      height: 15px;
    }

    .disc-info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .disc-name {
      color: #ffffff;
      font-weight: 600;
    }

    .disc-desc {
      font-size: 0.76rem;
      color: rgba(255, 255, 255, 0.55);
    }

    .scope-exp-cell {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      max-width: 220px;
    }

    .scope-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .scope-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.82rem;
      color: rgba(255, 255, 255, 0.85);
    }

    .scope-general-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.55rem;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.75);
    }

    .benefit-badge {
      display: inline-block;
      font-weight: 800;
      font-size: 0.84rem;
      padding: 0.25rem 0.6rem;
      border-radius: 3px;
      background: rgba(52, 211, 153, 0.15);
      color: #34d399;
      border: 1px solid rgba(52, 211, 153, 0.3);
      white-space: nowrap;
    }

    .benefit-badge.benefit-pct {
      background: rgba(192, 132, 252, 0.15);
      color: #c084fc;
      border-color: rgba(192, 132, 252, 0.3);
    }

    .min-amount-hint {
      display: block;
      font-size: 0.72rem;
      color: rgba(255, 255, 255, 0.45);
      margin-top: 0.2rem;
    }

    .validity-text {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.75);
      white-space: nowrap;
    }

    .uses-info {
      display: flex;
      align-items: baseline;
      gap: 0.3rem;
    }

    .uses-count {
      color: #ffffff;
      font-weight: 700;
    }

    .uses-max {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.45);
    }

    .status-toggle-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.3rem 0.7rem;
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: rgba(255, 255, 255, 0.05);
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .status-toggle-btn.active {
      border-color: rgba(52, 211, 153, 0.4);
      background: rgba(52, 211, 153, 0.12);
      color: #34d399;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }

    .actions-group {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .action-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.7);
      border-radius: 3px;
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .action-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .action-btn.edit-btn:hover {
      background: rgba(128, 179, 255, 0.2);
      color: #80b3ff;
      border-color: #80b3ff;
    }

    .action-btn.delete-btn:hover {
      background: rgba(239, 68, 68, 0.2);
      color: #f87171;
      border-color: #f87171;
    }

    .empty-state {
      padding: 3rem 1rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }

    .empty-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: rgba(255, 255, 255, 0.3);
    }

    .btn-create-inline {
      margin-top: 0.5rem;
      padding: 0.5rem 1rem;
      background: #80b3ff;
      color: #ffffff;
      border: none;
      border-radius: 4px;
      font-weight: 700;
      cursor: pointer;
    }

    /* Modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1.5rem;
      backdrop-filter: blur(6px);
    }

    .modal-card {
      background: #0e1521;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      width: 100%;
      max-width: 680px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .modal-title-wrap {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .modal-title-icon {
      color: #80b3ff;
    }

    .modal-title {
      font-size: 1.2rem;
      font-weight: 800;
      margin: 0;
      color: #ffffff;
    }

    .btn-close {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.5);
      cursor: pointer;
      display: flex;
      align-items: center;
      transition: color 0.2s ease;
    }

    .btn-close:hover {
      color: #ffffff;
    }

    .modal-form {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .form-group.full-width {
      grid-column: span 2;
    }

    .form-label {
      font-size: 0.8rem;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.85);
    }

    .form-control {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 4px;
      padding: 0.65rem 0.85rem;
      color: #ffffff;
      font-size: 0.86rem;
      outline: none;
      transition: border-color 0.2s ease;
    }

    .form-control:focus {
      border-color: #80b3ff;
      background: rgba(255, 255, 255, 0.08);
    }

    .code-input {
      font-family: monospace;
      font-weight: 700;
      letter-spacing: 0.05em;
    }

    .field-hint {
      font-size: 0.72rem;
      color: rgba(255, 255, 255, 0.45);
    }

    .textarea {
      resize: vertical;
    }

    .scope-radio-group {
      display: flex;
      gap: 1.5rem;
      margin-top: 0.25rem;
    }

    .radio-label, .checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.84rem;
      cursor: pointer;
      color: rgba(255, 255, 255, 0.9);
    }

    .form-error-alert {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 4px;
      color: #f87171;
      font-size: 0.84rem;
    }

    .modal-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
      padding-top: 1rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }

    .btn-cancel {
      padding: 0.65rem 1.25rem;
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: rgba(255, 255, 255, 0.8);
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-submit {
      padding: 0.65rem 1.4rem;
      background: #80b3ff;
      border: none;
      color: #ffffff;
      border-radius: 4px;
      font-weight: 700;
      cursor: pointer;
    }

    .btn-submit:hover:not(:disabled) {
      background: #a6c8ff;
    }

    .btn-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    @media (max-width: 650px) {
      .form-grid {
        grid-template-columns: 1fr;
      }
      .form-group.full-width {
        grid-column: span 1;
      }
    }
  `],
})
export class AdminDiscountsComponent {
  private readonly discountService = inject(DiscountService);
  private readonly experienceService = inject(ExperienceService);
  private readonly store = inject(AdminStoreService);

  readonly discounts = this.discountService.discounts;
  readonly experiences = this.experienceService.publishedExperiences;

  searchQuery = signal<string>('');
  statusFilter = signal<string>('all');
  scopeFilter = signal<string>('all');

  modalOpen = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  editingId = signal<string | null>(null);
  saving = signal<boolean>(false);
  formError = signal<string | null>(null);
  private modalSessionId = 0;

  formData: {
    code: string;
    name: string;
    description: string;
    discountType: DiscountType;
    discountValue: number | null;
    scope: DiscountScope;
    experienceId: string;
    experienceSlug: string;
    isAutomatic: boolean;
    minAmountArs: number | null;
    maxDiscountArs: number | null;
    startsAt: string;
    endsAt: string;
    maxUses: number | null;
    active: boolean;
  } = this.initialFormData();

  // Métricas
  readonly activeCount = computed(() => this.discounts().filter((d) => d.active).length);
  readonly totalCount = computed(() => this.discounts().length);
  readonly experienceSpecificCount = computed(() => this.discounts().filter((d) => d.scope === 'experience').length);
  readonly automaticCount = computed(() => this.discounts().filter((d) => d.isAutomatic).length);
  readonly totalUsesCount = computed(() => this.discounts().reduce((sum, d) => sum + (d.usesCount || 0), 0));
  
  readonly totalSavingsArs = computed(() => {
    // Calculado a partir de comprobantes aprobados que tuvieron discount_ars
    const submissions = this.store.submissions();
    return submissions
      .filter((s) => s.status === 'aprobado' && (s.discountArs || 0) > 0)
      .reduce((sum, s) => sum + (s.discountArs || 0), 0);
  });

  readonly filteredDiscounts = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    const scope = this.scopeFilter();
    const now = new Date();

    return this.discounts().filter((d) => {
      // Búsqueda
      if (q) {
        const codeMatch = d.code.toLowerCase().includes(q);
        const nameMatch = d.name.toLowerCase().includes(q);
        const expMatch = d.experienceSlug?.toLowerCase().includes(q) || false;
        if (!codeMatch && !nameMatch && !expMatch) return false;
      }

      // Filtro de estado
      if (status === 'active' && !d.active) return false;
      if (status === 'paused' && d.active) return false;
      if (status === 'expired') {
        if (!d.endsAt || new Date(d.endsAt) >= now) return false;
      }

      // Filtro de alcance
      if (scope === 'general' && d.scope !== 'general') return false;
      if (scope === 'experience' && d.scope !== 'experience') return false;

      return true;
    });
  });

  private initialFormData() {
    return {
      code: '',
      name: '',
      description: '',
      discountType: 'percentage' as DiscountType,
      discountValue: null,
      scope: 'general' as DiscountScope,
      experienceId: '',
      experienceSlug: '',
      isAutomatic: false,
      minAmountArs: null,
      maxDiscountArs: null,
      startsAt: '',
      endsAt: '',
      maxUses: null,
      active: true,
    };
  }

  openCreateModal(): void {
    this.modalSessionId++;
    this.formData = this.initialFormData();
    this.isEditing.set(false);
    this.editingId.set(null);
    this.formError.set(null);
    this.modalOpen.set(true);
  }

  openEditModal(disc: Discount): void {
    this.modalSessionId++;
    this.formData = {
      code: disc.code,
      name: disc.name,
      description: disc.description || '',
      discountType: disc.discountType,
      discountValue: disc.discountValue,
      scope: disc.scope,
      experienceId: disc.experienceId || '',
      experienceSlug: disc.experienceSlug || '',
      isAutomatic: disc.isAutomatic,
      minAmountArs: disc.minAmountArs || null,
      maxDiscountArs: disc.maxDiscountArs || null,
      startsAt: disc.startsAt ? disc.startsAt.split('T')[0] : '',
      endsAt: disc.endsAt ? disc.endsAt.split('T')[0] : '',
      maxUses: disc.maxUses || null,
      active: disc.active,
    };
    this.isEditing.set(true);
    this.editingId.set(disc.id);
    this.formError.set(null);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalSessionId++;
    this.modalOpen.set(false);
  }

  onCodeInput(value: string): void {
    if (value) {
      this.formData.code = value.toUpperCase().trim();
    }
  }

  onExperienceSelect(expId: string): void {
    const exp = this.experiences().find((e) => e.id === expId);
    if (exp) {
      this.formData.experienceSlug = exp.slug || '';
    }
  }

  getExperienceTitle(disc: Discount): string {
    if (disc.experienceId) {
      const exp = this.experiences().find((e) => e.id === disc.experienceId);
      if (exp) return exp.title;
    }
    return disc.experienceSlug || 'Experiencia específica';
  }

  formatValidity(disc: Discount): string {
    if (!disc.startsAt && !disc.endsAt) return 'Permanente';
    if (disc.startsAt && disc.endsAt) {
      return `${disc.startsAt.split('T')[0]} al ${disc.endsAt.split('T')[0]}`;
    }
    if (disc.endsAt) {
      return `Hasta ${disc.endsAt.split('T')[0]}`;
    }
    return `Desde ${disc.startsAt!.split('T')[0]}`;
  }

  copyCode(code: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
  }

  async toggleActive(disc: Discount): Promise<void> {
    try {
      await this.discountService.toggleDiscountActive(disc.id, !disc.active);
    } catch (err: any) {
      alert(`Error al actualizar estado: ${err?.message || err}`);
    }
  }

  async deleteDiscount(disc: Discount): Promise<void> {
    if (!confirm(`¿Eliminar definitivamente el descuento "${disc.code}"?`)) return;
    try {
      await this.discountService.deleteDiscount(disc.id);
    } catch (err: any) {
      alert(`Error al eliminar descuento: ${err?.message || err}`);
    }
  }

  async saveDiscount(): Promise<void> {
    this.formError.set(null);

    const code = (this.formData.code || '').trim().toUpperCase();
    if (!code) {
      this.formError.set('Ingresá un código para el cupón.');
      return;
    }
    if (!this.formData.name.trim()) {
      this.formError.set('Ingresá un nombre para la promoción.');
      return;
    }
    const val = Number(this.formData.discountValue);
    if (!val || val <= 0) {
      this.formError.set('El valor del descuento debe ser mayor a 0.');
      return;
    }
    if (this.formData.discountType === 'percentage' && val > 100) {
      this.formError.set('El porcentaje no puede ser mayor a 100%.');
      return;
    }
    if (this.formData.scope === 'experience' && !this.formData.experienceId) {
      this.formError.set('Seleccioná la experiencia a la que aplica este descuento.');
      return;
    }

    const currentSessionId = this.modalSessionId;
    this.saving.set(true);
    try {
      const payload: CreateDiscountDto = {
        code,
        name: this.formData.name.trim(),
        description: this.formData.description.trim(),
        discountType: this.formData.discountType,
        discountValue: val,
        scope: this.formData.scope,
        experienceId: this.formData.scope === 'experience' ? this.formData.experienceId : null,
        experienceSlug: this.formData.scope === 'experience' ? this.formData.experienceSlug : null,
        isAutomatic: this.formData.isAutomatic,
        minAmountArs: Number(this.formData.minAmountArs) || 0,
        maxDiscountArs: this.formData.maxDiscountArs ? Number(this.formData.maxDiscountArs) : null,
        startsAt: this.formData.startsAt ? new Date(this.formData.startsAt).toISOString() : null,
        endsAt: this.formData.endsAt ? new Date(this.formData.endsAt + 'T23:59:59Z').toISOString() : null,
        maxUses: this.formData.maxUses ? Number(this.formData.maxUses) : null,
        active: this.formData.active,
      };

      if (this.isEditing() && this.editingId()) {
        await this.discountService.updateDiscount(this.editingId()!, payload);
      } else {
        await this.discountService.createDiscount(payload);
      }

      if (this.modalSessionId !== currentSessionId) return;
      this.closeModal();
    } catch (err: any) {
      if (this.modalSessionId !== currentSessionId) return;
      this.formError.set(err?.message || 'Error al guardar el descuento.');
    } finally {
      if (this.modalSessionId === currentSessionId) {
        this.saving.set(false);
      }
    }
  }
}
