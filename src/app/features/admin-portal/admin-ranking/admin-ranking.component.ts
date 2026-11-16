import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AdminStoreService } from '../../../core/services/admin-store.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { ProviderRatingService, ProviderRatingData } from '../../../core/services/provider-rating.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { ProviderUser } from '../../../core/models/bank-transfer.model';
import { Experience } from '../../../core/models/experience.model';
import { ArsPipe } from '../../../shared/pipes/format.pipes';

export type RankingTab = 'all' | 'prestadores' | 'experiencias';

export interface ProviderRankingRow {
  rank: number;
  provider: ProviderUser;
  name: string;
  agency: string;
  slug: string;
  rating: ProviderRatingData;
  activeExperiencesCount: number;
}

export interface ExperienceRankingRow {
  rank: number;
  experience: Experience;
  title: string;
  slug: string;
  coverImage: string;
  region: string;
  difficulty: string;
  providerName: string;
  priceArs: number;
  favoritesCount: number;
}

@Component({
  selector: 'app-admin-ranking',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatIconModule, ArsPipe],
  template: `
    <div class="ranking-page-container">
      <!-- Encabezado Principal -->
      <header class="ranking-header">
        <div>
          <span class="ranking-kicker">MÉTRICAS & REPUTACIÓN</span>
          <h1 class="ranking-title">Ranking de Prestadores & Favoritos</h1>
          <p class="ranking-sub">
            Puntuaciones otorgadas por socios a prestadores oficiales y popularidad de experiencias guardadas en favoritos.
          </p>
        </div>

        <div class="ranking-header-actions">
          <div class="tab-pill-group">
            <button
              type="button"
              class="tab-pill"
              [class.is-active]="activeTab() === 'all'"
              (click)="activeTab.set('all')"
            >
              Vista Consolidada
            </button>
            <button
              type="button"
              class="tab-pill"
              [class.is-active]="activeTab() === 'prestadores'"
              (click)="activeTab.set('prestadores')"
            >
              Prestadores ({{ providerRanking().length }})
            </button>
            <button
              type="button"
              class="tab-pill"
              [class.is-active]="activeTab() === 'experiencias'"
              (click)="activeTab.set('experiencias')"
            >
              Experiencias Favoritas ({{ experienceRanking().length }})
            </button>
          </div>
        </div>
      </header>

      <!-- Franja de Métricas Resumen -->
      <section class="summary-strip">
        <div class="summary-card">
          <span class="sum-label">Prestadores Evaluados</span>
          <strong class="sum-value text-amber">{{ providerRanking().length }}</strong>
          <span class="sum-sub">Promedio red: {{ networkAverageScore() }} ★</span>
        </div>

        <div class="summary-card">
          <span class="sum-label">Prestador Mejor Valorado</span>
          <strong class="sum-value text-gold">
            {{ topProvider() ? topProvider()?.name : '—' }}
          </strong>
          <span class="sum-sub">
            @if (topProvider()) {
              Score líder: {{ topProvider()?.rating?.score?.toFixed(1) }} ★ ({{ topProvider()?.rating?.count }} votos)
            } @else {
              Sin datos de votos
            }
          </span>
        </div>

        <div class="summary-card">
          <span class="sum-label">Experiencia Más Deseada</span>
          <strong class="sum-value text-orange">
            {{ topExperience() ? topExperience()?.title : '—' }}
          </strong>
          <span class="sum-sub">
            @if (topExperience()) {
              Guardada por {{ topExperience()?.favoritesCount }} socios
            } @else {
              Sin favoritos registrados
            }
          </span>
        </div>

        <div class="summary-card">
          <span class="sum-label">Total Favoritos en la Red</span>
          <strong class="sum-value text-blue">{{ totalFavoritesCount() }}</strong>
          <span class="sum-sub">Acumulado de toda la comunidad</span>
        </div>
      </section>

      <!-- SECCIÓN 1: RANKING DE PRESTADORES -->
      @if (activeTab() === 'all' || activeTab() === 'prestadores') {
        <section class="ranking-section-block">
          <div class="section-block-head">
            <div class="head-title-wrap">
              <span class="block-kicker">TABLA DE REPUTACIÓN</span>
              <h2 class="block-title">Puntuación de Prestadores Oficiales</h2>
            </div>
            <span class="badge-total">{{ providerRanking().length }} prestadores</span>
          </div>

          <!-- Podio Top 3 Prestadores -->
          @if (top3Providers().length > 0) {
            <div class="podium-grid">
              @for (item of top3Providers(); track item.rank) {
                <div class="podium-card" [class.is-gold]="item.rank === 1" [class.is-silver]="item.rank === 2" [class.is-bronze]="item.rank === 3">
                  <div class="podium-medal">
                    @if (item.rank === 1) { 🥇 #1 }
                    @else if (item.rank === 2) { 🥈 #2 }
                    @else { 🥉 #3 }
                  </div>
                  <div class="podium-info">
                    <strong class="podium-name">{{ item.name }}</strong>
                    <span class="podium-agency">{{ item.agency }}</span>
                    <div class="podium-score-row">
                      <span class="podium-score">{{ item.rating.score.toFixed(1) }} ★</span>
                      <span class="podium-votes">({{ item.rating.count }} votos)</span>
                    </div>
                  </div>
                  <a [routerLink]="['/prestadores', item.slug]" target="_blank" class="btn-podium-view">
                    <span>Ver Perfil</span>
                    <mat-icon>open_in_new</mat-icon>
                  </a>
                </div>
              }
            </div>
          }

          <!-- Tabla Completa de Prestadores -->
          <div class="table-card">
            <div class="table-scroll">
              <table class="ranking-table">
                <thead>
                  <tr>
                    <th style="width: 70px;">PUESTO</th>
                    <th>PRESTADOR & AGENCIA</th>
                    <th>CALIFICACIÓN PROMEDIO</th>
                    <th>TOTAL DE VOTOS</th>
                    <th>EXP. ACTIVAS</th>
                    <th>ESTADO</th>
                    <th class="text-right">ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of providerRanking(); track row.provider.id || row.slug) {
                    <tr [class.is-top-three]="row.rank <= 3">
                      <td>
                        <span class="rank-badge" [class.rank-gold]="row.rank === 1" [class.rank-silver]="row.rank === 2" [class.rank-bronze]="row.rank === 3">
                          #{{ row.rank }}
                        </span>
                      </td>
                      <td>
                        <div class="provider-cell">
                          <strong class="cell-primary-title">{{ row.name }}</strong>
                          @if (row.agency && row.agency !== row.name) {
                            <span class="cell-sub-text">{{ row.agency }}</span>
                          }
                        </div>
                      </td>
                      <td>
                        <div class="stars-cell">
                          <span class="score-number">{{ row.rating.score.toFixed(1) }}</span>
                          <span class="score-star">★</span>
                          <div class="score-progress-bar">
                            <div class="score-progress-fill" [style.width.%]="(row.rating.score / 5) * 100"></div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span class="votes-pill">{{ row.rating.count }} valoraciones</span>
                      </td>
                      <td>
                        <span class="exp-count-tag">{{ row.activeExperiencesCount }} experiencias</span>
                      </td>
                      <td>
                        <span class="verified-pill">Verificado</span>
                      </td>
                      <td class="text-right">
                        <a [routerLink]="['/prestadores', row.slug]" target="_blank" class="btn-action-outline">
                          <span>Perfil Público</span>
                          <mat-icon>open_in_new</mat-icon>
                        </a>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </section>
      }

      <!-- SECCIÓN 2: RANKING DE EXPERIENCIAS FAVORITAS -->
      @if (activeTab() === 'all' || activeTab() === 'experiencias') {
        <section class="ranking-section-block">
          <div class="section-block-head">
            <div class="head-title-wrap">
              <span class="block-kicker">DEMANDA & FAVORITOS</span>
              <h2 class="block-title">Experiencias más Guardadas por Socios</h2>
            </div>
            <span class="badge-total">{{ experienceRanking().length }} experiencias</span>
          </div>

          <!-- Podio Top 3 Experiencias -->
          @if (top3Experiences().length > 0) {
            <div class="podium-grid">
              @for (item of top3Experiences(); track item.rank) {
                <div class="podium-card exp-podium-card" [class.is-gold]="item.rank === 1" [class.is-silver]="item.rank === 2" [class.is-bronze]="item.rank === 3">
                  <div class="podium-medal">
                    @if (item.rank === 1) { 🥇 #1 }
                    @else if (item.rank === 2) { 🥈 #2 }
                    @else { 🥉 #3 }
                  </div>
                  <div class="podium-info">
                    <strong class="podium-name">{{ item.title }}</strong>
                    <span class="podium-agency">{{ item.providerName }} · {{ item.region }}</span>
                    <div class="podium-score-row">
                      <span class="podium-fav-count">❤️ {{ item.favoritesCount }} socios la guardaron</span>
                    </div>
                  </div>
                  <a [routerLink]="['/experiencias', item.slug]" target="_blank" class="btn-podium-view">
                    <span>Ver Experiencia</span>
                    <mat-icon>open_in_new</mat-icon>
                  </a>
                </div>
              }
            </div>
          }

          <!-- Tabla Completa de Experiencias -->
          <div class="table-card">
            <div class="table-scroll">
              <table class="ranking-table">
                <thead>
                  <tr>
                    <th style="width: 70px;">PUESTO</th>
                    <th>EXPERIENCIA</th>
                    <th>PRESTADOR RESPONSABLE</th>
                    <th>SOCIOS CON ESTA FAVORITA</th>
                    <th>TARIFA ARS</th>
                    <th>DIFICULTAD</th>
                    <th class="text-right">ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of experienceRanking(); track row.experience.id || row.slug) {
                    <tr [class.is-top-three]="row.rank <= 3">
                      <td>
                        <span class="rank-badge" [class.rank-gold]="row.rank === 1" [class.rank-silver]="row.rank === 2" [class.rank-bronze]="row.rank === 3">
                          #{{ row.rank }}
                        </span>
                      </td>
                      <td>
                        <div class="exp-cell-row">
                          @if (row.coverImage) {
                            <img [src]="row.coverImage" [alt]="row.title" class="exp-cell-thumb" />
                          }
                          <div class="exp-cell-info">
                            <strong class="cell-primary-title">{{ row.title }}</strong>
                            <span class="cell-sub-text">{{ row.region }}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span class="provider-pill">{{ row.providerName }}</span>
                      </td>
                      <td>
                        <div class="fav-badge-cell">
                          <span class="heart-icon">❤️</span>
                          <strong class="fav-count-num">{{ row.favoritesCount }}</strong>
                          <span class="fav-count-lbl">{{ row.favoritesCount === 1 ? 'socio' : 'socios' }}</span>
                        </div>
                      </td>
                      <td>
                        <strong class="price-text">{{ row.priceArs | ars }}</strong>
                      </td>
                      <td>
                        <span class="diff-badge">{{ row.difficulty }}</span>
                      </td>
                      <td class="text-right">
                        <div class="action-btn-group">
                          <a [routerLink]="['/admin/experiencias', row.slug]" class="btn-action-outline">
                            <span>Ficha Admin</span>
                          </a>
                          <a [routerLink]="['/experiencias', row.slug]" target="_blank" class="btn-action-outline btn-web-link">
                            <mat-icon>open_in_new</mat-icon>
                          </a>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </section>
      }
    </div>
  `,
  styles: [`
    .ranking-page-container {
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
      padding: 1.5rem;
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
      box-sizing: border-box;
    }

    .ranking-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 1.25rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .ranking-kicker {
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      color: #ff5f00;
      text-transform: uppercase;
      display: block;
      margin-bottom: 0.25rem;
    }

    .ranking-title {
      font-size: 1.85rem;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 0.4rem 0;
      line-height: 1.2;
    }

    .ranking-sub {
      font-size: 0.88rem;
      color: rgba(255, 255, 255, 0.65);
      margin: 0;
      max-width: 650px;
      line-height: 1.45;
    }

    .tab-pill-group {
      display: flex;
      background: rgba(14, 22, 42, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 6px;
      padding: 0.25rem;
      gap: 0.25rem;
    }

    .tab-pill {
      background: transparent;
      border: none;
      padding: 0.45rem 0.95rem;
      border-radius: 4px;
      color: rgba(255, 255, 255, 0.75);
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.18s ease;
      white-space: nowrap;
    }

    .tab-pill:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.06);
    }

    .tab-pill.is-active {
      background: #ff5f00;
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(255, 95, 0, 0.4);
    }

    /* Franja de Métricas Resumen */
    .summary-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
    }

    .summary-card {
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(128, 179, 255, 0.2);
      border-radius: 6px;
      padding: 1.1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      backdrop-filter: blur(8px);
    }

    .sum-label {
      font-size: 0.74rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: rgba(255, 255, 255, 0.6);
    }

    .sum-value {
      font-size: 1.55rem;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.2;
    }

    .text-amber { color: #f59e0b; }
    .text-gold { color: #ffcc00; }
    .text-orange { color: #ff5f00; }
    .text-blue { color: #80b3ff; }

    .sum-sub {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.5);
    }

    /* Secciones de Bloque de Ranking */
    .ranking-section-block {
      display: flex;
      flex-direction: column;
      gap: 1.15rem;
    }

    .section-block-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .block-kicker {
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      color: #80b3ff;
      text-transform: uppercase;
      display: block;
    }

    .block-title {
      font-size: 1.25rem;
      font-weight: 800;
      color: #ffffff;
      margin: 0;
    }

    .badge-total {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.25rem 0.65rem;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 999px;
      color: rgba(255, 255, 255, 0.8);
    }

    /* Podio Top 3 */
    .podium-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }

    .podium-card {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 8px;
      padding: 1.25rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      position: relative;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    }

    .podium-card.is-gold {
      border-color: rgba(255, 204, 0, 0.5);
      background: linear-gradient(135deg, rgba(255, 204, 0, 0.12) 0%, rgba(15, 23, 42, 0.9) 100%);
    }

    .podium-card.is-silver {
      border-color: rgba(226, 232, 240, 0.45);
      background: linear-gradient(135deg, rgba(226, 232, 240, 0.08) 0%, rgba(15, 23, 42, 0.9) 100%);
    }

    .podium-card.is-bronze {
      border-color: rgba(205, 127, 50, 0.45);
      background: linear-gradient(135deg, rgba(205, 127, 50, 0.08) 0%, rgba(15, 23, 42, 0.9) 100%);
    }

    .podium-medal {
      font-size: 1.35rem;
      font-weight: 900;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.35);
      flex-shrink: 0;
    }

    .podium-info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      flex: 1;
      min-width: 0;
    }

    .podium-name {
      font-size: 1rem;
      font-weight: 800;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .podium-agency {
      font-size: 0.78rem;
      color: rgba(255, 255, 255, 0.6);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .podium-score-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin-top: 0.35rem;
    }

    .podium-score {
      font-size: 0.95rem;
      font-weight: 900;
      color: #ffcc00;
    }

    .podium-votes, .podium-fav-count {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.7);
    }

    .btn-podium-view {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.45rem 0.8rem;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 4px;
      color: #ffffff !important;
      font-size: 0.74rem;
      font-weight: 700;
      text-decoration: none;
      white-space: nowrap;
      transition: all 0.18s ease;
      flex-shrink: 0;
    }

    .btn-podium-view:hover {
      background: #ff5f00;
      border-color: #ff5f00;
    }

    .btn-podium-view mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    /* Tabla */
    .table-card {
      background: #0b1222;
      border: 1px solid rgba(128, 179, 255, 0.18);
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }

    .table-scroll {
      width: 100%;
      overflow-x: auto;
    }

    .ranking-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.82rem;
    }

    .ranking-table th {
      padding: 0.85rem 1rem;
      background: rgba(14, 22, 42, 0.9);
      color: rgba(255, 255, 255, 0.65);
      font-weight: 800;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      white-space: nowrap;
    }

    .ranking-table td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      color: rgba(255, 255, 255, 0.85);
      vertical-align: middle;
    }

    .ranking-table tr:hover {
      background: rgba(255, 255, 255, 0.025);
    }

    .rank-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 4px;
      font-weight: 800;
      font-size: 0.82rem;
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.7);
    }

    .rank-gold {
      background: rgba(255, 204, 0, 0.2);
      color: #ffcc00;
      border: 1px solid rgba(255, 204, 0, 0.45);
    }

    .rank-silver {
      background: rgba(226, 232, 240, 0.15);
      color: #f1f5f9;
      border: 1px solid rgba(226, 232, 240, 0.35);
    }

    .rank-bronze {
      background: rgba(205, 127, 50, 0.15);
      color: #fca5a5;
      border: 1px solid rgba(205, 127, 50, 0.35);
    }

    .provider-cell, .exp-cell-info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .cell-primary-title {
      color: #ffffff;
      font-size: 0.88rem;
    }

    .cell-sub-text {
      font-size: 0.74rem;
      color: rgba(255, 255, 255, 0.5);
    }

    .stars-cell {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }

    .score-number {
      font-size: 0.95rem;
      font-weight: 800;
      color: #ffcc00;
    }

    .score-star {
      color: #ffcc00;
      font-size: 0.95rem;
    }

    .score-progress-bar {
      width: 70px;
      height: 6px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.1);
      overflow: hidden;
    }

    .score-progress-fill {
      height: 100%;
      background: #ffcc00;
      border-radius: 999px;
    }

    .votes-pill {
      display: inline-block;
      padding: 0.25rem 0.55rem;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      font-size: 0.74rem;
      color: rgba(255, 255, 255, 0.7);
    }

    .exp-count-tag {
      font-size: 0.75rem;
      color: #80b3ff;
      font-weight: 700;
    }

    .verified-pill {
      font-size: 0.7rem;
      font-weight: 800;
      padding: 0.2rem 0.55rem;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #34d399;
      text-transform: uppercase;
    }

    .exp-cell-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .exp-cell-thumb {
      width: 44px;
      height: 44px;
      border-radius: 4px;
      object-fit: cover;
      flex-shrink: 0;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }

    .provider-pill {
      display: inline-block;
      padding: 0.25rem 0.55rem;
      background: rgba(128, 179, 255, 0.1);
      border: 1px solid rgba(128, 179, 255, 0.25);
      border-radius: 4px;
      color: #80b3ff;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .fav-badge-cell {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.65rem;
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 4px;
    }

    .heart-icon { font-size: 0.85rem; }
    .fav-count-num { color: #fca5a5; font-size: 0.85rem; }
    .fav-count-lbl { color: rgba(255, 255, 255, 0.55); font-size: 0.72rem; }

    .price-text {
      color: #ffffff;
      font-size: 0.85rem;
    }

    .diff-badge {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      border-radius: 3px;
      font-size: 0.72rem;
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.75);
    }

    .action-btn-group {
      display: flex;
      justify-content: flex-end;
      gap: 0.45rem;
    }

    .btn-action-outline {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.35rem 0.75rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 3px;
      color: #ffffff !important;
      font-size: 0.74rem;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .btn-action-outline:hover {
      background: #ff5f00;
      border-color: #ff5f00;
    }

    .btn-action-outline mat-icon {
      font-size: 13px;
      width: 13px;
      height: 13px;
    }

    .btn-web-link {
      padding: 0.35rem 0.5rem;
    }

    .text-right { text-align: right; }

    @media (max-width: 768px) {
      .ranking-page-container {
        padding: 1rem;
      }
      .tab-pill-group {
        width: 100%;
        overflow-x: auto;
      }
    }
  `],
})
export class AdminRankingComponent {
  private readonly adminStore = inject(AdminStoreService);
  private readonly experienceService = inject(ExperienceService);
  private readonly ratingService = inject(ProviderRatingService);
  private readonly favoritesService = inject(FavoritesService);

  readonly activeTab = signal<RankingTab>('all');

  // Ranking ordenado de prestadores por puntaje y cantidad de votos
  readonly providerRanking = computed<ProviderRankingRow[]>(() => {
    const providers = this.adminStore.providerStore.providers();
    const experiences = this.experienceService.experiences();

    const rows = providers.map((p) => {
      const rating = this.ratingService.getRating(p);
      const activeCount = experiences.filter(
        (e) => (e.providerId === p.id || e.providerSlug === p.slug) && e.status === 'publicada',
      ).length;

      return {
        rank: 0,
        provider: p,
        name: p.name || p.agency || 'Prestador',
        agency: p.agency || p.name || 'Agencia',
        slug: p.slug || p.id,
        rating,
        activeExperiencesCount: activeCount,
      };
    });

    // Ordenar por score desc, luego por votos desc
    rows.sort((a, b) => {
      if (b.rating.score !== a.rating.score) {
        return b.rating.score - a.rating.score;
      }
      return b.rating.count - a.rating.count;
    });

    return rows.map((r, idx) => ({ ...r, rank: idx + 1 }));
  });

  readonly top3Providers = computed(() => this.providerRanking().slice(0, 3));
  readonly topProvider = computed(() => this.providerRanking()[0] || null);

  readonly networkAverageScore = computed(() => {
    const list = this.providerRanking();
    if (list.length === 0) return '5.0';
    const sum = list.reduce((acc, p) => acc + p.rating.score, 0);
    return (sum / list.length).toFixed(1);
  });

  // Ranking ordenado de experiencias por favoritos de socios
  readonly experienceRanking = computed<ExperienceRankingRow[]>(() => {
    const experiences = this.experienceService.experiences();
    const members = this.adminStore.members();
    const localFavs = this.favoritesService.favoriteSlugs().map((s) => s.toLowerCase());

    // Contar cuántos socios tienen cada experiencia en su wishlist
    const countsMap = new Map<string, number>();

    for (const m of members) {
      if (Array.isArray(m.experiencesWishlist)) {
        for (const fav of m.experiencesWishlist) {
          const k = fav.trim().toLowerCase();
          countsMap.set(k, (countsMap.get(k) || 0) + 1);
        }
      }
    }

    // Agregar favoritos locales si no están en members
    for (const fav of localFavs) {
      if (!countsMap.has(fav)) {
        countsMap.set(fav, 1);
      }
    }

    const rows = experiences.map((exp) => {
      const slugKey = (exp.slug || '').toLowerCase();
      const idKey = (exp.id || '').toLowerCase();

      const countFromSlug = countsMap.get(slugKey) || 0;
      const countFromId = countsMap.get(idKey) || 0;
      const favCount = Math.max(countFromSlug, countFromId);

      return {
        rank: 0,
        experience: exp,
        title: exp.title,
        slug: exp.slug,
        coverImage: exp.coverImage,
        region: exp.region || 'Catamarca',
        difficulty: exp.difficulty || 'Moderada',
        providerName: exp.providerAgency || exp.providerName || 'Club de Experiencias',
        priceArs: exp.priceArs,
        favoritesCount: favCount,
      };
    });

    // Ordenar por cantidad de favoritos desc, luego por precio o título
    rows.sort((a, b) => {
      if (b.favoritesCount !== a.favoritesCount) {
        return b.favoritesCount - a.favoritesCount;
      }
      return b.priceArs - a.priceArs;
    });

    return rows.map((r, idx) => ({ ...r, rank: idx + 1 }));
  });

  readonly top3Experiences = computed(() => this.experienceRanking().slice(0, 3));
  readonly topExperience = computed(() => this.experienceRanking()[0] || null);

  readonly totalFavoritesCount = computed(() => {
    return this.experienceRanking().reduce((acc, e) => acc + e.favoritesCount, 0);
  });
}

