import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AdminStoreService } from '../../../core/services/admin-store.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { ProviderRatingService, ProviderRatingData } from '../../../core/services/provider-rating.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { ProviderUser } from '../../../core/models/bank-transfer.model';
import { Experience } from '../../../core/models/experience.model';
import { SURVEY_INTEREST_KEYS } from '../../../core/models/waitlist.model';
import { ArsPipe } from '../../../shared/pipes/format.pipes';
import { getPublicExperienceUrl } from '../../../shared/utils/csv.util';
import { slugify } from '../../../core/services/provider-store.service';

export interface ProviderVoteDetail {
  socioEmail: string;
  socioName: string;
  socioTier: string;
  socioPosition?: number | null;
  socioAvatar?: string;
  score: number;
  comment?: string;
  createdAt?: string;
}

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
          <h1 class="ranking-title">Ranking de Prestadores & Favoritos</h1>
          <p class="ranking-sub">
            Puntuaciones otorgadas por socios a prestadores oficiales y popularidad de experiencias guardadas en favoritos con datos reales.
          </p>
        </div>
      </header>

      <!-- Franja de Métricas Resumen -->
      <section class="summary-strip">
        <div class="summary-card">
          <span class="sum-label">Prestadores Evaluados</span>
          <strong class="sum-value num-lg">{{ providerRanking().length }}</strong>
          <span class="sum-sub">Promedio red: {{ networkAverageScore() }} ★</span>
        </div>

        <div class="summary-card">
          <span class="sum-label">Prestador Mejor Valorado</span>
          <strong class="sum-value text-truncate-val" [title]="topProvider() ? topProvider()?.name : ''">
            {{ topProvider() ? topProvider()?.name : '—' }}
          </strong>
          <span class="sum-sub">
            @if (topProvider()) {
              Score líder: {{ topProvider()?.rating?.score?.toFixed(1) }} ★ ({{ topProvider()?.rating?.count }} votos)
            } @else {
              Sin prestadores activos
            }
          </span>
        </div>

        <div class="summary-card">
          <span class="sum-label">Total Favoritos en la Red</span>
          <strong class="sum-value num-lg">{{ totalFavoritesCount() }}</strong>
          <span class="sum-sub">Acumulado de toda la comunidad</span>
        </div>

        <div class="summary-card">
          <span class="sum-label">Experiencia Más Deseada</span>
          <strong class="sum-value text-truncate-val" [title]="topExperience() ? topExperience()?.title : ''">
            {{ topExperience() ? topExperience()?.title : '—' }}
          </strong>
          <span class="sum-sub">
            @if (topExperience()) {
              Guardada por {{ topExperience()?.favoritesCount }} {{ topExperience()?.favoritesCount === 1 ? 'socio' : 'socios' }}
            } @else {
              Sin favoritos registrados
            }
          </span>
        </div>
      </section>

      <!-- SECCIÓN 1: RANKING DE PRESTADORES -->
      <section class="ranking-section-block">
        <div class="section-block-head">
          <div class="head-title-wrap">
            <span class="block-kicker">TABLA DE REPUTACIÓN</span>
            <h2 class="block-title">Puntuación de Prestadores Oficiales</h2>
          </div>
          <span class="badge-total">{{ providerRanking().length }} prestadores</span>
        </div>

        <!-- Tabla Estilizada con el Estándar del Portal Admin -->
        <div class="table-container">
          <table class="dash-table">
            <thead>
              <tr>
                <th style="width: 75px;">PUESTO</th>
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
                    <span
                      class="rank-badge"
                      [class.rank-gold]="row.rank === 1"
                      [class.rank-silver]="row.rank === 2"
                      [class.rank-bronze]="row.rank === 3"
                    >
                      #{{ row.rank }}
                    </span>
                  </td>
                  <td>
                    <div class="cell-main-info">
                      <strong class="cell-title">{{ row.name }}</strong>
                      @if (row.agency && row.agency !== row.name) {
                        <span class="cell-sub">{{ row.agency }}</span>
                      }
                    </div>
                  </td>
                  <td>
                    <div class="stars-cell">
                      <span class="score-number">{{ row.rating.score.toFixed(1) }}</span>
                      <span class="score-star">★</span>
                      <div class="score-progress-bar">
                        <div
                          class="score-progress-fill"
                          [style.width.%]="(row.rating.score / 5) * 100"
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      class="votes-pill-btn"
                      (click)="openProviderVotesModal(row.provider)"
                      title="Ver qué socios valoraron a este prestador"
                    >
                      <span class="star-icon">★</span>
                      <span>{{ row.rating.count }} valoraciones</span>
                    </button>
                  </td>
                  <td>
                    <span class="exp-count-tag">{{ row.activeExperiencesCount }} experiencias</span>
                  </td>
                  <td>
                    @if (row.provider.verified) {
                      <span class="verified-pill">VERIFICADO</span>
                    } @else {
                      <span class="approved-pill">APROBADO</span>
                    }
                  </td>
                  <td class="text-right">
                    <div class="action-btn-group">
                      <a
                        [routerLink]="getProviderFicheRoute(row)"
                        class="btn-action-outline btn-fiche-action"
                        title="Ver ficha técnica y calificaciones del prestador"
                      >
                        <mat-icon class="icon-tiny">badge</mat-icon>
                        <span>VER FICHA</span>
                      </a>
                      @if (row.slug) {
                        <a
                          [href]="getPublicProviderUrl(row.slug)"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="btn-action-outline btn-web-link"
                          title="Ver perfil público"
                        >
                          <mat-icon class="icon-tiny">open_in_new</mat-icon>
                          <span>IR AL PERFIL PÚBLICO</span>
                        </a>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="empty-table-cell">
                    No hay prestadores oficiales activos registrados en el sistema.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- SECCIÓN 2: RANKING DE EXPERIENCIAS FAVORITAS -->
      <section class="ranking-section-block">
        <div class="section-block-head">
          <div class="head-title-wrap">
            <span class="block-kicker">DEMANDA & FAVORITOS</span>
            <h2 class="block-title">Experiencias más Guardadas por Socios</h2>
          </div>
          <span class="badge-total">{{ experienceRanking().length }} experiencias</span>
        </div>

        <!-- Tabla Estilizada con el Estándar del Portal Admin -->
        <div class="table-container">
          <table class="dash-table">
            <thead>
              <tr>
                <th style="width: 75px;">PUESTO</th>
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
                    <span
                      class="rank-badge"
                      [class.rank-gold]="row.rank === 1"
                      [class.rank-silver]="row.rank === 2"
                      [class.rank-bronze]="row.rank === 3"
                    >
                      #{{ row.rank }}
                    </span>
                  </td>
                  <td>
                    <div class="exp-cell-row">
                      @if (row.coverImage) {
                        <img [src]="row.coverImage" [alt]="row.title" class="exp-cell-thumb" />
                      }
                      <div class="cell-main-info">
                        <strong class="cell-title">{{ row.title }}</strong>
                        <span class="cell-sub">{{ row.region }}</span>
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
                      <span class="fav-count-lbl">{{
                        row.favoritesCount === 1 ? 'socio' : 'socios'
                      }}</span>
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
                      <a [routerLink]="getExperienceFicheRoute(row.slug)" class="btn-action-outline">
                        <span>VER FICHA</span>
                      </a>
                      <a
                        [href]="getPublicUrl(row.experience || { slug: row.slug })"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="btn-action-outline btn-web-link"
                        title="Ver en la web pública"
                      >
                        <mat-icon class="icon-tiny">open_in_new</mat-icon>
                        <span>VER EN LA WEB</span>
                      </a>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="empty-table-cell">
                    No hay experiencias publicadas activas registradas en el catálogo.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- MODAL DE CALIFICACIONES DE SOCIOS -->
      @if (selectedRankingProviderForVotes(); as prov) {
        <div class="modal-backdrop" (click)="closeProviderVotesModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div class="modal-header-titles">
                <span class="modal-kicker">CALIFICACIONES Y RESEÑAS</span>
                <h3 class="modal-title">{{ prov.name || prov.agency || 'Prestador' }}</h3>
                <span class="modal-subtitle">{{ prov.agency || 'Agencia de Turismo / Operador' }}</span>
              </div>
              <button type="button" class="btn-close-modal" (click)="closeProviderVotesModal()" title="Cerrar">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <div class="modal-body">
              <div class="modal-stats-summary">
                <div class="stats-score-badge">
                  <span class="star-gold">★</span>
                  <strong class="stats-score-num">{{ ratingService.getRating(prov).score.toFixed(1) }}</strong>
                  <span class="stats-count-label">({{ rankingProviderVotes().length }} {{ rankingProviderVotes().length === 1 ? 'valoración registrada' : 'valoraciones registradas' }})</span>
                </div>
              </div>

              @if (isLoadingRankingVotes()) {
                <div class="modal-loading-box">
                  <p class="empty-text">Cargando valoraciones de socios...</p>
                </div>
              } @else if (rankingVotesError()) {
                <div class="modal-error-box">
                  <p class="error-text">{{ rankingVotesError() }}</p>
                  <button type="button" class="btn-retry" (click)="openProviderVotesModal(prov)">Reintentar</button>
                </div>
              } @else if (rankingProviderVotes().length === 0) {
                <div class="modal-empty-box">
                  <mat-icon class="empty-icon">star_border</mat-icon>
                  <strong class="empty-title">Aún no hay votos registrados</strong>
                  <p class="empty-desc">Ningún socio ha calificado a este prestador todavía en el sistema.</p>
                </div>
              } @else {
                @if (rankingVotesPartialWarning()) {
                  <div class="modal-warning-box">
                    <mat-icon class="icon-tiny">warning</mat-icon>
                    <span>{{ rankingVotesPartialWarning() }}</span>
                  </div>
                }
                <div class="modal-table-wrap">
                  <table class="modal-votes-table">
                    <thead>
                      <tr>
                        <th>Socio</th>
                        <th>Nivel / Categoría</th>
                        <th>Calificación</th>
                        <th>Comentario / Reseña</th>
                        <th class="text-right">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (v of rankingProviderVotes(); track v.socioEmail + (v.createdAt || '')) {
                        <tr>
                          <!-- Socio -->
                          <td>
                            <div class="socio-identity-cell">
                              <div class="socio-avatar">
                                @if (v.socioAvatar) {
                                  <img [src]="v.socioAvatar" [alt]="v.socioName" class="socio-avatar-img" />
                                } @else {
                                  <span>{{ (v.socioName || v.socioEmail).charAt(0).toUpperCase() }}</span>
                                }
                              </div>
                              <div class="socio-names">
                                <strong class="socio-name">{{ v.socioName }}</strong>
                                <span class="socio-email">{{ v.socioEmail }}</span>
                              </div>
                            </div>
                          </td>

                          <!-- Nivel -->
                          <td>
                            <div class="tier-badge-cell">
                              <span class="socio-tier-pill" [class]="'tier-' + v.socioTier.toLowerCase()">
                                {{ v.socioTier | uppercase }}
                              </span>
                              @if (v.socioPosition) {
                                <span class="socio-number-tag">#{{ v.socioPosition }}</span>
                              }
                            </div>
                          </td>

                          <!-- Calificación -->
                          <td>
                            <div class="vote-stars-pill">
                              <span class="vote-stars-display">{{ getStarsDisplay(v.score) }}</span>
                              <strong class="vote-score-num">{{ v.score }} ★</strong>
                            </div>
                          </td>

                          <!-- Comentario -->
                          <td>
                            <span class="vote-comment-text">{{ v.comment || '—' }}</span>
                          </td>

                          <!-- Fecha -->
                          <td class="text-right">
                            <span class="vote-date-cell">{{ v.createdAt ? (v.createdAt | date: 'dd/MM/yyyy HH:mm') : '—' }}</span>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>

            <div class="modal-footer">
              <a
                [routerLink]="getProviderFicheRoute({ provider: prov })"
                class="btn-footer-fiche"
                (click)="closeProviderVotesModal()"
              >
                <mat-icon class="icon-tiny">badge</mat-icon>
                <span>IR A FICHA TÉCNICA COMPLETA</span>
              </a>
              <button type="button" class="btn-footer-close" (click)="closeProviderVotesModal()">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .ranking-page-container {
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
      padding: 1.5rem 1.5rem 3rem;
      max-width: 1240px;
      margin: 0 auto;
      width: 100%;
      box-sizing: border-box;
      color: #ffffff;
      font-family: var(--font-sans);
    }

    .ranking-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 1.25rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .ranking-title {
      font-size: 1.85rem;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 0.4rem 0;
      letter-spacing: -0.02em;
      line-height: 1.2;
    }

    .ranking-sub {
      font-size: 0.9rem;
      color: rgba(255, 255, 255, 0.68);
      margin: 0;
      max-width: 680px;
      line-height: 1.5;
    }

    /* Franja de Métricas Resumen */
    .summary-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
    }

    .summary-card {
      background: rgba(14, 21, 33, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      padding: 1.15rem 1.35rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    }

    .sum-label {
      font-size: 0.72rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #ffffff;
      opacity: 0.9;
    }

    .sum-value {
      font-size: 1.25rem;
      font-weight: 800;
      color: #ffffff !important;
      line-height: 1.2;
    }

    .sum-value.num-lg {
      font-size: 1.65rem;
      letter-spacing: -0.01em;
    }

    .text-truncate-val {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: block;
    }

    .sum-sub {
      font-size: 0.76rem;
      color: rgba(255, 255, 255, 0.75);
      margin-top: auto;
      padding-top: 0.4rem;
    }

    /* Secciones de Bloque de Ranking */
    .ranking-section-block {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
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
      margin-bottom: 0.2rem;
    }

    .block-title {
      font-size: 1.25rem;
      font-weight: 800;
      color: #ffffff;
      margin: 0;
      letter-spacing: -0.01em;
    }

    .badge-total {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.25rem 0.65rem;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 4px;
      color: rgba(255, 255, 255, 0.85);
    }

    /* Tabla Estándar del Portal Admin */
    .table-container {
      background: rgba(14, 21, 33, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      overflow-x: auto;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
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

    .dash-table tr.is-top-three td {
      background: rgba(255, 255, 255, 0.015);
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
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .rank-gold {
      background: rgba(255, 204, 0, 0.18);
      color: #ffcc00;
      border-color: rgba(255, 204, 0, 0.45);
    }

    .rank-silver {
      background: rgba(226, 232, 240, 0.15);
      color: #e2e8f0;
      border-color: rgba(226, 232, 240, 0.35);
    }

    .rank-bronze {
      background: rgba(205, 127, 50, 0.18);
      color: #f6ad55;
      border-color: rgba(205, 127, 50, 0.35);
    }

    .cell-main-info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .cell-title {
      color: #ffffff;
      font-weight: 700;
      font-size: 0.88rem;
    }

    .cell-sub {
      font-size: 0.74rem;
      color: rgba(255, 255, 255, 0.55);
    }

    .stars-cell {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .score-number {
      font-size: 0.88rem;
      font-weight: 800;
      color: #ffffff;
    }

    .score-star {
      color: #ffcc00;
      font-size: 0.95rem;
      line-height: 1;
    }

    .score-progress-bar {
      width: 60px;
      height: 5px;
      background: rgba(255, 255, 255, 0.12);
      border-radius: 999px;
      overflow: hidden;
      margin-left: 0.25rem;
    }

    .score-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #ffcc00, #ff8a4c);
      border-radius: 999px;
    }

    .votes-pill {
      display: inline-block;
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.65);
      background: rgba(255, 255, 255, 0.04);
      padding: 0.2rem 0.55rem;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      white-space: nowrap;
    }

    .exp-count-tag {
      font-size: 0.78rem;
      font-weight: 600;
      color: #80b3ff;
      background: rgba(128, 179, 255, 0.12);
      border: 1px solid rgba(128, 179, 255, 0.25);
      padding: 0.2rem 0.55rem;
      border-radius: 4px;
      white-space: nowrap;
    }

    .verified-pill {
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: #48bb78;
      background: rgba(72, 187, 120, 0.12);
      border: 1px solid rgba(72, 187, 120, 0.28);
      padding: 0.2rem 0.55rem;
      border-radius: 4px;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .approved-pill {
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.28);
      padding: 0.2rem 0.55rem;
      border-radius: 4px;
      text-transform: uppercase;
      white-space: nowrap;
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
      border: 1px solid rgba(255, 255, 255, 0.1);
      flex-shrink: 0;
      background: rgba(255, 255, 255, 0.05);
    }

    .provider-pill {
      display: inline-block;
      font-size: 0.78rem;
      color: rgba(255, 255, 255, 0.85);
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 0.25rem 0.6rem;
      border-radius: 4px;
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .fav-badge-cell {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      background: rgba(255, 95, 0, 0.1);
      border: 1px solid rgba(255, 95, 0, 0.25);
      padding: 0.25rem 0.65rem;
      border-radius: 4px;
      white-space: nowrap;
    }

    .heart-icon {
      font-size: 0.82rem;
      line-height: 1;
    }

    .fav-count-num {
      color: #ffffff;
      font-size: 0.85rem;
      font-weight: 800;
    }

    .fav-count-lbl {
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.74rem;
    }

    .price-text {
      color: #ffffff;
      font-weight: 700;
      font-size: 0.88rem;
    }

    .diff-badge {
      font-size: 0.74rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.05);
      color: rgba(255, 255, 255, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.1);
      white-space: nowrap;
    }

    .action-btn-group {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .btn-action-outline {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      padding: 0 0.75rem;
      height: 32px;
      line-height: 30px;
      box-sizing: border-box;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 4px;
      color: #ffffff !important;
      font-size: 0.78rem;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.2s ease;
      white-space: nowrap;
    }

    .btn-action-outline:hover {
      background: #ff5f00;
      border-color: #ff5f00;
      color: #ffffff;
    }

    .btn-web-link {
      padding: 0 0.75rem;
      height: 32px;
      box-sizing: border-box;
    }

    .icon-tiny {
      font-size: 14px;
      width: 14px;
      height: 14px;
      line-height: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .empty-table-cell {
      text-align: center;
      padding: 2.5rem 1rem !important;
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.88rem;
    }

    .text-right {
      text-align: right;
    }

    .votes-pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.75rem;
      color: #ffffff;
      background: rgba(255, 255, 255, 0.05);
      padding: 0.25rem 0.6rem;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .votes-pill-btn:hover {
      background: rgba(255, 149, 0, 0.15);
      border-color: rgba(255, 149, 0, 0.35);
      color: #ffffff;
    }

    .votes-pill-btn .star-icon {
      color: #ffb703;
      font-size: 0.82rem;
    }

    /* Modal de Valoraciones */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.78);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1050;
      padding: 1rem;
    }

    .modal-card {
      background: #190f0a;
      border: 1px solid rgba(255, 149, 0, 0.3);
      border-radius: 8px;
      width: 100%;
      max-width: 780px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
      overflow: hidden;
    }

    .modal-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(0, 0, 0, 0.25);
    }

    .modal-kicker {
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      color: #ff9500;
      text-transform: uppercase;
      display: block;
      margin-bottom: 0.2rem;
    }

    .modal-title {
      font-size: 1.2rem;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
    }

    .modal-subtitle {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.55);
    }

    .btn-close-modal {
      background: none;
      border: none;
      color: #ffffff;
      cursor: pointer;
      padding: 0.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s ease;
    }

    .btn-close-modal:hover {
      color: #ffffff;
    }

    .modal-body {
      padding: 1.25rem 1.5rem;
      overflow-y: auto;
      flex: 1;
    }

    .modal-stats-summary {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    .stats-score-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      background: rgba(255, 183, 3, 0.12);
      border: 1px solid rgba(255, 183, 3, 0.3);
      padding: 0.4rem 0.85rem;
      border-radius: 6px;
    }

    .star-gold {
      color: #ffb703;
      font-size: 1.1rem;
    }

    .stats-score-num {
      font-size: 1.1rem;
      font-weight: 800;
      color: #ffb703;
    }

    .stats-count-label {
      font-size: 0.82rem;
      color: rgba(255, 255, 255, 0.7);
    }

    .modal-loading-box,
    .modal-error-box,
    .modal-empty-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2.5rem 1rem;
      text-align: center;
      gap: 0.5rem;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.2);
    }

    .modal-warning-box {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.65rem 0.9rem;
      margin-bottom: 1rem;
      border-radius: 6px;
      background: rgba(255, 149, 0, 0.12);
      border: 1px solid rgba(255, 149, 0, 0.35);
      color: #ffb703;
      font-size: 0.8rem;
      line-height: 1.3;
    }

    .modal-warning-box mat-icon {
      color: #ff9500;
      flex-shrink: 0;
    }

    .empty-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: rgba(255, 255, 255, 0.3);
    }

    .empty-title {
      color: rgba(255, 255, 255, 0.85);
      font-size: 0.95rem;
    }

    .empty-desc {
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.82rem;
      margin: 0;
    }

    .btn-retry {
      background: #ff5f00;
      color: #ffffff;
      border: none;
      border-radius: 4px;
      padding: 0.4rem 0.8rem;
      font-size: 0.8rem;
      cursor: pointer;
      font-weight: 700;
    }

    .modal-table-wrap {
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      overflow-x: auto;
    }

    .modal-votes-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.82rem;
    }

    .modal-votes-table th {
      background: rgba(0, 0, 0, 0.4);
      padding: 0.75rem 0.85rem;
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .modal-votes-table td {
      padding: 0.75rem 0.85rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      vertical-align: middle;
    }

    .socio-identity-cell {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .socio-avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: #2a1b14;
      border: 1px solid rgba(255, 149, 0, 0.3);
      color: #ff9500;
      font-weight: 700;
      font-size: 0.8rem;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }

    .socio-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .socio-names {
      display: flex;
      flex-direction: column;
    }

    .socio-name {
      font-size: 0.84rem;
      color: #ffffff;
      font-weight: 600;
    }

    .socio-email {
      font-size: 0.72rem;
      color: rgba(255, 255, 255, 0.45);
    }

    .tier-badge-cell {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .socio-tier-pill {
      font-size: 0.65rem;
      font-weight: 800;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.7);
    }

    .socio-tier-pill.tier-fundador,
    .socio-tier-pill.tier-vip {
      background: rgba(255, 149, 0, 0.15);
      color: #ffa726;
      border: 1px solid rgba(255, 149, 0, 0.3);
    }

    .socio-tier-pill.tier-activo,
    .socio-tier-pill.tier-socio {
      background: rgba(0, 204, 136, 0.15);
      color: #00cc88;
      border: 1px solid rgba(0, 204, 136, 0.3);
    }

    .socio-number-tag {
      font-size: 0.7rem;
      color: rgba(255, 255, 255, 0.4);
      font-family: monospace;
    }

    .vote-stars-pill {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .vote-stars-display {
      color: #ffb703;
      letter-spacing: 0.1em;
      font-size: 0.85rem;
    }

    .vote-score-num {
      color: #ffb703;
      font-size: 0.78rem;
    }

    .vote-comment-text {
      color: rgba(255, 255, 255, 0.8);
      font-size: 0.78rem;
      line-height: 1.4;
      display: inline-block;
      max-width: 250px;
    }

    .vote-date-cell {
      font-size: 0.72rem;
      color: rgba(255, 255, 255, 0.5);
    }

    .modal-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(0, 0, 0, 0.35);
    }

    .btn-footer-fiche {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 700;
      color: #ffffff;
      background: #ff5f00;
      border: 1px solid #ff5f00;
      text-decoration: none;
      transition: background 0.15s ease;
    }

    .btn-footer-fiche:hover {
      background: #e05300;
    }

    .btn-footer-close {
      padding: 0.5rem 1rem;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #ffffff;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .btn-footer-close:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
    }

    @media (max-width: 768px) {
      .ranking-page-container {
        padding: 1rem 1rem 2.5rem;
      }
    }
  `],
})
export class AdminRankingComponent {
  private readonly router = inject(Router);
  private readonly adminStore = inject(AdminStoreService);
  private readonly experienceService = inject(ExperienceService);
  readonly ratingService = inject(ProviderRatingService);
  private readonly favoritesService = inject(FavoritesService);

  getExperienceFicheRoute(expOrSlug?: string | { id?: string; slug?: string }): string {
    let slug = '';
    if (typeof expOrSlug === 'string') {
      const latest = this.experienceService.getExperienceBySlug?.(expOrSlug) ||
                     this.experienceService.getExperienceById?.(expOrSlug);
      slug = latest?.slug || expOrSlug;
    } else if (expOrSlug) {
      const latest = (expOrSlug.id ? this.experienceService.getExperienceById?.(expOrSlug.id) : null) ||
                     (expOrSlug.slug ? this.experienceService.getExperienceBySlug?.(expOrSlug.slug) : null);
      slug = latest?.slug || expOrSlug.slug || expOrSlug.id || '';
    }
    const rawPath = this.router.url.split('?')[0].split('#')[0];
    const segments = rawPath.split('/').filter(Boolean);
    const base = segments[0] === 'admin' ? '/admin/experiencias' : '/experiencias';
    return `${base}/${slug || ''}`;
  }

  getPublicUrl(exp: { publicUrl?: string; slug?: string; detailRoute?: string }): string {
    return getPublicExperienceUrl(exp);
  }

  getPublicProviderUrl(slug?: string | null): string {
    const cleanSlug = encodeURIComponent((slug || '').trim());
    if (typeof window !== 'undefined' && window.location) {
      const origin = window.location.origin;
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return `${origin}/prestadores/${cleanSlug}?portal=public`;
      }
    }
    return `https://experiencias.club/prestadores/${cleanSlug}`;
  }

  readonly selectedRankingProviderForVotes = signal<ProviderUser | null>(null);
  readonly rankingProviderVotes = signal<ProviderVoteDetail[]>([]);
  readonly isLoadingRankingVotes = signal<boolean>(false);
  readonly rankingVotesError = signal<string | null>(null);
  readonly rankingVotesPartialWarning = signal<string | null>(null);
  private providerVotesRequestToken = 0;

  getProviderFicheRoute(row: { slug?: string; provider?: ProviderUser; name?: string; agency?: string; id?: string }): string {
    const p = row.provider || (row as any);
    const slug =
      row.slug ||
      p?.slug ||
      ('origin' in p && p.origin === 'application'
        ? p.id
        : slugify(p?.agency || p?.name || row.agency || row.name || p?.id || (row as any).id || 'prestador'));
    const rawPath = this.router.url.split('?')[0].split('#')[0];
    const segments = rawPath.split('/').filter(Boolean);
    const base = segments[0] === 'admin' ? '/admin/prestadores' : '/prestadores';
    return `${base}/${slug || ''}`;
  }

  async openProviderVotesModal(provider: ProviderUser): Promise<void> {
    const token = ++this.providerVotesRequestToken;
    this.selectedRankingProviderForVotes.set(provider);
    this.isLoadingRankingVotes.set(true);
    this.rankingVotesError.set(null);
    this.rankingVotesPartialWarning.set(null);
    this.rankingProviderVotes.set([]);

    try {
      if (typeof this.adminStore.loadAllMembers === 'function' && this.adminStore.members().length === 0) {
        await this.adminStore.loadAllMembers();
      }
      if (token !== this.providerVotesRequestToken) return;

      const res = await this.ratingService.getProviderVotes(provider);
      if (token !== this.providerVotesRequestToken) return;

      if (!res || res.status === 'unavailable' || (!res.votes?.length && res.error)) {
        this.rankingVotesError.set(res?.error || 'No se pudieron obtener las valoraciones del servidor.');
        return;
      }

      if (res.status === 'partial') {
        this.rankingVotesPartialWarning.set(
          res.error || 'Mostrando valoraciones locales; no se pudo sincronizar completamente con el servidor.',
        );
      } else {
        this.rankingVotesPartialWarning.set(null);
      }

      const members = this.adminStore.members();
      const enriched: ProviderVoteDetail[] = (res.votes || []).map((v) => {
        const cleanEmail = v.socioEmail.toLowerCase().trim();
        const member = members.find((m) => m.email.toLowerCase().trim() === cleanEmail);
        return {
          socioEmail: v.socioEmail,
          socioName: member?.fullName || cleanEmail.split('@')[0],
          socioTier: member?.membershipTier || 'socio',
          socioPosition: member?.position,
          socioAvatar: member?.avatarUrl,
          score: v.score,
          comment: v.comment,
          createdAt: v.createdAt,
        };
      });
      if (token !== this.providerVotesRequestToken) return;
      this.rankingProviderVotes.set(enriched);
    } catch (err: any) {
      if (token !== this.providerVotesRequestToken) return;
      this.rankingVotesError.set(err?.message || 'No se pudieron cargar las calificaciones.');
    } finally {
      if (token === this.providerVotesRequestToken) {
        this.isLoadingRankingVotes.set(false);
      }
    }
  }

  closeProviderVotesModal(): void {
    this.providerVotesRequestToken++;
    this.selectedRankingProviderForVotes.set(null);
    this.rankingProviderVotes.set([]);
    this.rankingVotesError.set(null);
    this.rankingVotesPartialWarning.set(null);
    this.isLoadingRankingVotes.set(false);
  }

  getStarsDisplay(score: number): string {
    const full = Math.min(5, Math.max(0, Math.round(score)));
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  // Ranking ordenado de prestadores activos aprobados por puntaje y cantidad de votos
  readonly providerRanking = computed<ProviderRankingRow[]>(() => {
    const officialProviders = this.adminStore.providerStore.allProviders() || [];
    const applications = this.adminStore.applications().filter((a) => a.type === 'prestador');
    const publishedExperiences = this.experienceService.experiences().filter(
      (e) => e.status === 'publicada' && !e.deletedAt && !(e as any).isSoftDeleted,
    );

    const approvedProviders: ProviderUser[] = [];
    const seenEmails = new Set<string>();
    const seenSlugs = new Set<string>();
    const seenIds = new Set<string>();
    const bajaEmails = new Set<string>();
    const bajaSlugs = new Set<string>();
    const bajaIds = new Set<string>();

    for (const p of officialProviders) {
      const email = (p.email || '').toLowerCase().trim();
      const slug = (p.slug || '').toLowerCase().trim();
      const id = (p.id || '').toLowerCase().trim();

      // Excluir dados de baja, rechazados o pendientes
      const isBaja =
        p.status === 'dado_de_baja' ||
        (p as any).status === 'baja' ||
        (p as any).isDeleted ||
        Boolean((p as any).deleted_at);
      const isRechazado = p.status === 'rechazado';
      const isPendiente = p.status === 'pendiente';

      if (isBaja) {
        if (id) bajaIds.add(id);
        if (email) bajaEmails.add(email);
        if (slug) bajaSlugs.add(slug);
        continue;
      }

      if (isRechazado || isPendiente) {
        continue;
      }

      // Solo prestadores aprobados o verificados activos
      if (p.status !== 'aprobado' && !p.verified) {
        continue;
      }

      if (id) seenIds.add(id);
      if (email) seenEmails.add(email);
      if (slug) seenSlugs.add(slug);

      approvedProviders.push(p);
    }

    // Agregar prestadores aprobados desde solicitudes si no están ya en la lista ni pertenecen a prestadores dados de baja
    for (const app of applications) {
      if (app.status !== 'aprobado' || (app as any).status === 'dado_de_baja') continue;
      const cleanEmail = (app.email || '').toLowerCase().trim();
      const appSlug = ((app as any).slug || '').toLowerCase().trim();
      const appId = (app.id || '').toLowerCase().trim();

      if (cleanEmail && (seenEmails.has(cleanEmail) || bajaEmails.has(cleanEmail))) continue;
      if (appSlug && (seenSlugs.has(appSlug) || bajaSlugs.has(appSlug))) continue;
      if (appId && (seenIds.has(appId) || bajaIds.has(appId))) continue;

      const matchingProvider = officialProviders.find((p) => {
        const pEmail = (p.email || '').toLowerCase().trim();
        const pSlug = (p.slug || '').toLowerCase().trim();
        const pId = (p.id || '').toLowerCase().trim();
        return (
          (cleanEmail && pEmail && pEmail === cleanEmail) ||
          (appSlug && pSlug && pSlug === appSlug) ||
          (appId && pId && pId === appId)
        );
      });

      if (matchingProvider) {
        const isBaja =
          matchingProvider.status === 'dado_de_baja' ||
          (matchingProvider as any).status === 'baja' ||
          (matchingProvider as any).isDeleted ||
          Boolean((matchingProvider as any).deleted_at);
        if (isBaja) continue;
      }

      if (cleanEmail) seenEmails.add(cleanEmail);
      if (appSlug) seenSlugs.add(appSlug);
      if (appId) seenIds.add(appId);

      approvedProviders.push({
        id: app.id,
        name: app.fullName || app.email || 'Prestador Oficial',
        agency: app.agency || app.description || 'Club de Experiencias',
        email: app.email,
        phone: app.phone,
        bio: app.description || '',
        slug: (app as any).slug || '',
        verified: true,
        status: 'aprobado',
      } as ProviderUser);
    }

    const rows = approvedProviders.map((p) => {
      const rating = this.ratingService.getRating(p);
      const activeCount = publishedExperiences.filter((e) => {
        const matchId = Boolean(p.id && e.providerId && e.providerId === p.id);
        const matchSlug = Boolean(p.slug && e.providerSlug && e.providerSlug === p.slug);
        const matchEmail = Boolean(
          p.email &&
            e.providerEmail &&
            e.providerEmail.toLowerCase().trim() === p.email.toLowerCase().trim(),
        );
        return matchId || matchSlug || matchEmail;
      }).length;

      return {
        rank: 0,
        provider: p,
        name: p.name || p.agency || 'Prestador',
        agency: p.agency || p.name || 'Agencia',
        slug: p.slug || '',
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

  // Ranking ordenado de experiencias publicadas por favoritos reales de socios
  readonly experienceRanking = computed<ExperienceRankingRow[]>(() => {
    // Filtrar estrictamente solo experiencias publicadas (no pendientes de evaluación, no borradores, no eliminadas)
    const publishedExperiences = this.experienceService.experiences().filter(
      (exp) => exp.status === 'publicada' && !exp.deletedAt && !(exp as any).isSoftDeleted,
    );
    const members = typeof this.adminStore.members === 'function' ? this.adminStore.members() : [];
    const localFavs = typeof this.favoritesService?.favoriteSlugs === 'function'
      ? this.favoritesService.favoriteSlugs().map((s) => s.toLowerCase().trim())
      : [];

    const publishedSlugSet = new Set<string>();
    for (const exp of publishedExperiences) {
      if (exp.slug) publishedSlugSet.add(exp.slug.toLowerCase().trim());
      if (exp.id) publishedSlugSet.add(exp.id.toLowerCase().trim());
      if (exp.initialSlug) publishedSlugSet.add(exp.initialSlug.toLowerCase().trim());
      if (Array.isArray(exp.slugAliases)) {
        for (const a of exp.slugAliases) {
          if (a) publishedSlugSet.add(a.toLowerCase().trim());
        }
      }
    }
    const isExcludedSurveyKey = (key: string) => SURVEY_INTEREST_KEYS.has(key);

    // Contar cuántos socios reales tienen cada experiencia en su wishlist
    const countsMap = new Map<string, number>();

    for (const m of members) {
      if (
        m.membershipTier === 'waitlist' ||
        m.membershipTier === 'dado_de_baja' ||
        (m as any).type === 'waitlist'
      ) {
        continue;
      }
      if (Array.isArray(m.experiencesWishlist)) {
        for (const fav of m.experiencesWishlist) {
          const k = fav.trim().toLowerCase();
          if (k && !isExcludedSurveyKey(k)) {
            countsMap.set(k, (countsMap.get(k) || 0) + 1);
          }
        }
      }
    }

    // Agregar favoritos locales si no están en members
    for (const fav of localFavs) {
      if (fav && !isExcludedSurveyKey(fav) && !countsMap.has(fav)) {
        countsMap.set(fav, 1);
      }
    }

    const rows = publishedExperiences.map((exp) => {
      const slugKey = (exp.slug || '').toLowerCase().trim();
      const idKey = (exp.id || '').toLowerCase().trim();
      const initialKey = (exp.initialSlug || '').toLowerCase().trim();

      const countFromSlug = slugKey ? (countsMap.get(slugKey) || 0) : 0;
      const countFromId = idKey ? (countsMap.get(idKey) || 0) : 0;
      const countFromInitial = initialKey ? (countsMap.get(initialKey) || 0) : 0;
      let maxAliasCount = 0;
      if (Array.isArray(exp.slugAliases)) {
        for (const alias of exp.slugAliases) {
          const aKey = (alias || '').toLowerCase().trim();
          if (aKey && countsMap.has(aKey)) {
            maxAliasCount = Math.max(maxAliasCount, countsMap.get(aKey) || 0);
          }
        }
      }

      // DATOS REALES: Conteo derivado exclusivamente de socios elegibles (excluye waitlist y dados de baja) y favoritos locales
      const realFavCount = Math.max(countFromSlug, countFromId, countFromInitial, maxAliasCount);

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
        favoritesCount: realFavCount,
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
