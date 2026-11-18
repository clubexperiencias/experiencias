import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { DiscountService } from '../../../core/services/discount.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { AdminStoreService } from '../../../core/services/admin-store.service';
import { Discount } from '../../../core/models/discount.model';
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
          <h1 class="discounts-title">Gestión de Descuentos & Promociones</h1>
          <p class="discounts-sub">
            Administrá códigos de cupón y ofertas directas para experiencias individuales o para toda la plataforma.
          </p>
        </div>
        <button class="btn-create-discount" (click)="goToCreate()">
          <span>Nuevo Descuento</span>
        </button>
      </header>

      <!-- Franja de Métricas Resumen -->
      <section class="summary-strip">
        <div class="summary-card">
          <span class="sum-label">Cupones Activos</span>
          <strong class="sum-value">{{ activeCount() }}</strong>
          <span class="sum-sub">{{ totalCount() }} promociones registradas</span>
        </div>

        <div class="summary-card">
          <span class="sum-label">Por Experiencia</span>
          <strong class="sum-value">{{ experienceSpecificCount() }}</strong>
          <span class="sum-sub">{{ automaticCount() }} automáticas</span>
        </div>

        <div class="summary-card">
          <span class="sum-label">Canjes Confirmados</span>
          <strong class="sum-value">{{ totalUsesCount() }}</strong>
          <span class="sum-sub">En reservas y pagos</span>
        </div>

        <div class="summary-card">
          <span class="sum-label">Total Ahorrado</span>
          <strong class="sum-value text-gold">{{ totalSavingsArs() | ars }}</strong>
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
            <option value="membership">Membresía Socio Pleno</option>
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
                  } @else if (disc.scope === 'membership') {
                    <span class="scope-membership-pill">
                      <mat-icon class="icon-tiny">card_membership</mat-icon>
                      Socio Pleno
                    </span>
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
                      (click)="goToEdit(disc)"
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
                    <button class="btn-create-inline" (click)="goToCreate()">
                      Crear primer descuento
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .discounts-page-container {
      max-width: 1240px;
      margin: 0 auto;
      padding: 1.5rem 1.5rem 4rem;
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
      background: #80b3ff;
      border: none;
      color: #ffffff;
      padding: 0.65rem 1.25rem;
      border-radius: 4px;
      font-weight: 700;
      font-size: 0.88rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-create-discount:hover {
      background: #99c2ff;
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
      background: rgba(14, 21, 33, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      padding: 1.15rem 1.35rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .sum-label {
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #ffffff;
      opacity: 0.9;
    }

    .sum-value {
      font-size: 2.35rem;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.02em;
      line-height: 1.15;
    }

    .sum-sub {
      font-size: 0.78rem;
      color: #ffffff;
      opacity: 0.8;
    }

    .text-emerald { color: #ffffff !important; }
    .text-amber { color: #ffffff !important; }
    .text-blue { color: #ffffff !important; }
    .text-purple { color: #ffcc00 !important; }
    .text-gold { color: #ffcc00 !important; }

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
      flex: 1 1 320px;
      min-width: 260px;
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
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .filter-select {
      background: rgba(14, 21, 33, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 4px;
      color: #ffffff;
      padding: 0.65rem 1rem;
      font-size: 0.86rem;
      outline: none;
      cursor: pointer;
    }

    .filter-select option {
      background: #0e1521;
      color: #ffffff;
    }

    /* Tabla */
    .table-container {
      background: rgba(14, 21, 33, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      overflow-x: auto;
    }

    .dash-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.86rem;
      text-align: left;
    }

    .dash-table th {
      padding: 0.85rem 1rem;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #ffffff;
      opacity: 0.9;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.02);
      white-space: nowrap;
    }

    .dash-table td {
      padding: 0.95rem 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      vertical-align: middle;
      color: rgba(255, 255, 255, 0.88);
    }

    .dash-table tr:last-child td {
      border-bottom: none;
    }

    .dash-table tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    .code-badge-wrap {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .discount-code-pill {
      font-family: monospace;
      font-size: 0.88rem;
      font-weight: 700;
      background: rgba(128, 179, 255, 0.15);
      color: #80b3ff;
      border: 1px solid rgba(128, 179, 255, 0.3);
      padding: 0.2rem 0.55rem;
      border-radius: 4px;
      letter-spacing: 0.05em;
    }

    .discount-code-pill.code-auto {
      background: rgba(255, 212, 42, 0.15);
      color: #ffd42a;
      border-color: rgba(255, 212, 42, 0.35);
    }

    .btn-copy-code {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.4);
      cursor: pointer;
      padding: 2px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 3px;
      transition: all 0.2s ease;
    }

    .btn-copy-code:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.1);
    }

    .icon-tiny {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .disc-info {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .disc-name {
      color: #ffffff;
      font-weight: 700;
    }

    .disc-desc {
      font-size: 0.78rem;
      color: rgba(255, 255, 255, 0.5);
    }

    .scope-exp-cell {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .scope-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .scope-text {
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }

    .scope-membership-pill, .scope-general-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.78rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }

    .scope-membership-pill {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .scope-general-pill {
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .benefit-badge {
      font-weight: 800;
      color: #ffd42a;
      display: block;
    }

    .benefit-badge.benefit-pct {
      color: #60a5fa;
    }

    .min-amount-hint {
      font-size: 0.72rem;
      color: rgba(255, 255, 255, 0.45);
      display: block;
      margin-top: 0.15rem;
    }

    .validity-text {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.75);
    }

    .uses-info {
      display: flex;
      align-items: baseline;
      gap: 0.3rem;
    }

    .uses-count {
      color: #ffffff;
      font-weight: 800;
    }

    .uses-max {
      font-size: 0.76rem;
      color: rgba(255, 255, 255, 0.45);
    }

    .status-toggle-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      font-size: 0.76rem;
      font-weight: 700;
      padding: 0.25rem 0.55rem;
      border-radius: 20px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .status-toggle-btn.active {
      background: rgba(16, 185, 129, 0.15);
      border-color: rgba(16, 185, 129, 0.3);
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
  `],
})
export class AdminDiscountsComponent {
  private readonly router = inject(Router);
  private readonly discountService = inject(DiscountService);
  private readonly experienceService = inject(ExperienceService);
  private readonly store = inject(AdminStoreService);

  readonly discounts = this.discountService.discounts;
  readonly experiences = this.experienceService.publishedExperiences;

  searchQuery = signal<string>('');
  statusFilter = signal<string>('all');
  scopeFilter = signal<string>('all');

  // Métricas
  readonly activeCount = computed(() => this.discounts().filter((d) => d.active).length);
  readonly totalCount = computed(() => this.discounts().length);
  readonly experienceSpecificCount = computed(() => this.discounts().filter((d) => d.scope === 'experience').length);
  readonly automaticCount = computed(() => this.discounts().filter((d) => d.isAutomatic).length);
  readonly totalUsesCount = computed(() => this.discounts().reduce((sum, d) => sum + (d.usesCount || 0), 0));

  readonly totalSavingsArs = computed(() => {
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
      if (scope === 'membership' && d.scope !== 'membership') return false;

      return true;
    });
  });

  goToCreate(): void {
    const rawPath = this.router.url.split('?')[0].split('#')[0];
    const segments = rawPath.split('/').filter(Boolean);
    const isUnderAdmin = segments[0] === 'admin';
    const target = isUnderAdmin ? '/admin/descuentos/nuevo' : '/descuentos/nuevo';
    this.router.navigateByUrl(target);
  }

  goToEdit(disc: Discount): void {
    const rawPath = this.router.url.split('?')[0].split('#')[0];
    const segments = rawPath.split('/').filter(Boolean);
    const isUnderAdmin = segments[0] === 'admin';
    const target = isUnderAdmin ? `/admin/descuentos/${disc.id}/editar` : `/descuentos/${disc.id}/editar`;
    this.router.navigateByUrl(target);
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
}
