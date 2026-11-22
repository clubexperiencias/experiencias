import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { ProviderExperience } from '../../../core/models/bank-transfer.model';
import { ArsPipe, FechaPipe } from '../../../shared/pipes/format.pipes';
import { ProviderExperienceAlbumModalComponent } from '../provider-experience-album-modal/provider-experience-album-modal.component';

@Component({
  selector: 'app-provider-experience-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatIconModule,
    ArsPipe,
    FechaPipe,
    ProviderExperienceAlbumModalComponent,
  ],
  template: `
    <div class="fiche-page">
      @if (feedbackToast()) {
        <div class="fiche-toast" role="status">{{ feedbackToast() }}</div>
      }

      @if (isLoading()) {
        <div class="fiche-state-card">
          <p class="fiche-state-text">Cargando ficha de la experiencia...</p>
        </div>
      } @else if (!experience()) {
        <div class="fiche-state-card">
          <h2 class="fiche-state-title">Experiencia no encontrada</h2>
          <p class="fiche-state-text">
            No encontramos esta experiencia en tu catálogo de prestador.
          </p>
          <a [routerLink]="backLink()" class="btn-fiche btn-primary">
            ← Volver a Mis Experiencias
          </a>
        </div>
      } @else {
        @let exp = experience()!;

        <!-- Barra Superior -->
        <div class="fiche-top-bar">
          <a [routerLink]="backLink()" class="btn-back-link">
            ← Volver a Mis Experiencias
          </a>

          <div class="fiche-top-actions">
            <span class="status-pill" [attr.data-status]="exp.status">
              @switch (exp.status) {
                @case ('publicada') { Publicada }
                @case ('oculta') { Pausada }
                @case ('pendiente_publicacion') { En Revisión }
                @case ('pendiente_ocultar') { Pausa Pendiente }
                @case ('pendiente_eliminar') { Baja Pendiente }
                @case ('borrador') { Borrador }
                @default { {{ exp.status }} }
              }
            </span>

            @if (exp.status === 'publicada' || exp.status === 'oculta') {
              <button
                type="button"
                class="btn-fiche"
                [class.btn-pause]="exp.status === 'publicada'"
                [class.btn-resume]="exp.status === 'oculta'"
                [disabled]="isTogglingPause()"
                (click)="onTogglePause(exp)"
              >
                {{
                  isTogglingPause()
                    ? 'Actualizando...'
                    : exp.status === 'oculta'
                      ? 'Reactivar Experiencia'
                      : 'Pausar Experiencia'
                }}
              </button>
            }

            <a [routerLink]="editLink(exp)" class="btn-fiche btn-primary">
              Editar Experiencia
            </a>

            @if (exp.status === 'publicada') {
              <a
                [href]="getPublicUrl(exp)"
                target="_blank"
                rel="noopener noreferrer"
                class="btn-fiche btn-outline"
              >
                <mat-icon class="icon-sm">open_in_new</mat-icon>
                <span>Ver en la Web</span>
              </a>
            }
          </div>
        </div>

        <!-- 1. Cabecera y Portada -->
        <section class="fiche-card hero-card">
          <div class="hero-grid">
            <div class="hero-media">
              <img
                [src]="exp.coverImage || '/assets/images/catamarca_pomez.jpg'"
                [alt]="exp.title"
                class="hero-cover-img"
              />
            </div>

            <div class="hero-info">
              <span class="hero-kicker">
                {{ exp.category === 'hospedajes' ? 'HOSPEDAJE & REFUGIO' : 'EXPERIENCIA DE PRESTADOR' }}
                · {{ exp.region }}
              </span>
              <h1 class="hero-title">{{ exp.title }}</h1>
              @if (exp.tagline) {
                <p class="hero-tagline">{{ exp.tagline }}</p>
              }

              <div class="specs-grid">
                <div class="spec-box">
                  <span class="spec-lbl">{{ exp.category === 'hospedajes' ? 'TARIFA POR NOCHE' : 'ARANCEL POR PERSONA' }}</span>
                  <strong class="spec-val text-accent">{{ exp.priceArs | ars }}</strong>
                </div>
                <div class="spec-box">
                  <span class="spec-lbl">{{ exp.category === 'hospedajes' ? 'ACCESIBILIDAD / PERFIL' : 'DIFICULTAD' }}</span>
                  <strong class="spec-val">{{ exp.difficulty || '—' }}</strong>
                </div>
                <div class="spec-box">
                  <span class="spec-lbl">{{ exp.category === 'hospedajes' ? 'ESTADÍA MÍNIMA' : 'DURACIÓN' }}</span>
                  <strong class="spec-val">{{ exp.durationLabel || '—' }}</strong>
                </div>
                <div class="spec-box">
                  <span class="spec-lbl">ALTITUD</span>
                  <strong class="spec-val">
                    {{ exp.altitudeMeters ? exp.altitudeMeters + ' msnm' : '—' }}
                  </strong>
                </div>
                <div class="spec-box">
                  <span class="spec-lbl">{{ exp.category === 'hospedajes' ? 'CAPACIDAD MÁXIMA' : 'CUPO POR SALIDA' }}</span>
                  <strong class="spec-val">
                    {{ exp.capacityPerDate >= 999 ? 'Ilimitado' : (exp.category === 'hospedajes' ? exp.capacityPerDate + ' huéspedes' : exp.capacityPerDate + ' personas') }}
                  </strong>
                </div>
                <div class="spec-box">
                  <span class="spec-lbl">{{ exp.category === 'hospedajes' ? 'RESERVAS / INGRESOS' : 'INSCRIPTOS / INGRESOS' }}</span>
                  <strong class="spec-val">
                    {{ enrolledCount() }} {{ exp.category === 'hospedajes' ? (enrolledCount() === 1 ? 'huésped' : 'huéspedes') : (enrolledCount() === 1 ? 'socio' : 'socios') }} · {{ confirmedRevenue() | ars }}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 2. Descripción y Logística -->
        <section class="fiche-card">
          <h2 class="section-heading">{{ exp.category === 'hospedajes' ? 'Descripción y Ubicación' : 'Descripción y Punto de Encuentro' }}</h2>
          <p class="fiche-description">{{ exp.description || 'Sin descripción cargada.' }}</p>

          <div class="logistics-meta-row">
            <div class="logistics-item">
              <span class="spec-lbl">REGIÓN</span>
              <span class="logistics-val">{{ exp.region || 'Catamarca' }}</span>
            </div>
            <div class="logistics-item">
              <span class="spec-lbl">{{ exp.category === 'hospedajes' ? 'DIRECCIÓN / UBICACIÓN' : 'PUNTO DE ENCUENTRO' }}</span>
              <span class="logistics-val">{{ exp.meetingPoint || 'A coordinar con el prestador' }}</span>
            </div>
            <div class="logistics-item">
              <span class="spec-lbl">RUTA PÚBLICA</span>
              <span class="logistics-val mono">/experiencias/{{ exp.slug }}</span>
            </div>
          </div>
        </section>

        <!-- 3. Fechas Programadas y Cupos -->
        <section class="fiche-card">
          <div class="section-head-row">
            <div>
              <h2 class="section-heading">{{ exp.category === 'hospedajes' ? 'Disponibilidad & Noches Habilitadas' : 'Fechas de Salida Programadas' }}</h2>
              <p class="section-sub">
                {{ exp.category === 'hospedajes'
                  ? 'Elegí una fecha en el calendario para sumarla a la disponibilidad o pausá noches puntuales.'
                  : 'Elegí una fecha en el calendario para sumarla automáticamente o pausá salidas puntuales.' }}
              </p>
            </div>
            <div class="quick-date-picker">
              <input
                type="date"
                class="date-input"
                [min]="todayIso"
                [(ngModel)]="newDateValue"
                (change)="onQuickDatePicked($any($event.target).value, exp.id)"
                aria-label="Agregar nueva fecha de salida"
              />
            </div>
          </div>

          @if (dateRows().length > 0) {
            <div class="dates-list">
              @for (d of dateRows(); track d.date) {
                <div class="date-row" [class.is-closed]="d.isClosed" [class.is-past]="d.isPast">
                  <div class="date-main">
                    <strong class="date-label">{{ d.date | fecha }}</strong>
                    @if (d.isPast) {
                      <span class="mini-badge badge-past">Vencida</span>
                    } @else if (d.isClosed) {
                      <span class="mini-badge badge-paused">Pausada</span>
                    } @else {
                      <span class="mini-badge badge-active">Activa</span>
                    }
                  </div>
                  <div class="date-capacity">
                    @if (d.isUnlimited) {
                      <span>Cupo ilimitado ({{ d.reserved }} inscriptos)</span>
                    } @else {
                      <span>{{ d.reserved }} / {{ d.capacity }} cupos ocupados</span>
                    }
                  </div>
                  <div class="date-actions">
                    <button
                      type="button"
                      class="btn-mini"
                      (click)="toggleDatePause(exp.id, d.date)"
                    >
                      {{ d.isClosed ? 'Reanudar' : 'Pausar' }}
                    </button>
                    <button
                      type="button"
                      class="btn-mini btn-mini-danger"
                      (click)="removeDate(exp.id, d.date)"
                      title="Eliminar fecha"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              }
            </div>
          } @else {
            <p class="empty-hint">
              No hay fechas fijas cargadas todavía. Seleccioná una fecha en el calendario para agregarla.
            </p>
          }
        </section>

        <!-- 4. Álbum de Fotos -->
        <section class="fiche-card">
          <div class="section-head-row">
            <div>
              <h2 class="section-heading">Álbum de Fotos ({{ exp.albumPhotos?.length || 0 }}/12)</h2>
              <p class="section-sub">
                La foto de portada general se usa como portada del álbum y la primera destacada como vista previa.
              </p>
            </div>
            <button
              type="button"
              class="btn-fiche btn-outline"
              (click)="albumModalExp.set(exp)"
            >
              Gestionar Álbum
            </button>
          </div>

          @if (exp.albumPhotos && exp.albumPhotos.length > 0) {
            <div class="album-grid">
              @for (photo of exp.albumPhotos; track photo.id) {
                <div class="album-item">
                  <img [src]="photo.url" [alt]="photo.title || 'Foto del álbum'" class="album-img" />
                  <div class="album-badges">
                    @if (photo.isCover) {
                      <span class="album-tag tag-cover">Portada</span>
                    }
                    @if (photo.isFeatured) {
                      <span class="album-tag tag-featured">Destacada</span>
                    }
                  </div>
                </div>
              }
            </div>
          } @else {
            <p class="empty-hint">Todavía no hay fotos adicionales cargadas en el álbum.</p>
          }
        </section>

        <!-- Barra Inferior de Acciones -->
        <div class="fiche-bottom-bar">
          <a [routerLink]="backLink()" class="btn-fiche btn-outline">
            ← Volver al Catálogo
          </a>
          <div class="fiche-bottom-right">
            <a
              [routerLink]="sociosLink()"
              [queryParams]="{ experiencia: exp.id }"
              class="btn-fiche btn-outline"
            >
              Socios y Comprobantes ({{ enrolledCount() }})
            </a>
            @if (exp.status === 'publicada' || exp.status === 'oculta') {
              <button
                type="button"
                class="btn-fiche"
                [class.btn-pause]="exp.status === 'publicada'"
                [class.btn-resume]="exp.status === 'oculta'"
                [disabled]="isTogglingPause()"
                (click)="onTogglePause(exp)"
              >
                {{ exp.status === 'oculta' ? 'Reactivar' : 'Pausar' }}
              </button>
            }
            <a [routerLink]="editLink(exp)" class="btn-fiche btn-primary">
              Editar Experiencia
            </a>
          </div>
        </div>
      }

      @if (albumModalExp(); as modalExp) {
        <app-provider-experience-album-modal
          [isOpen]="true"
          [experience]="modalExp"
          (close)="albumModalExp.set(null)"
          (saved)="onAlbumSaved()"
        ></app-provider-experience-album-modal>
      }
    </div>
  `,
  styles: [
    `
      .fiche-page {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        max-width: 1120px;
        margin: 0 auto;
        padding: 0.5rem 0 3rem;
        color: #ffffff;
        font-family: var(--font-sans);
      }

      .fiche-toast {
        position: fixed;
        bottom: 1.5rem;
        right: 1.5rem;
        z-index: 9999;
        padding: 0.85rem 1.25rem;
        border-radius: 4px;
        background: #0d1b3e;
        border: 1px solid #80b3ff;
        color: #ffffff;
        font-size: 0.86rem;
        font-weight: 600;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
      }

      .fiche-state-card {
        background: rgba(11, 20, 42, 0.85);
        border: 1px solid rgba(128, 179, 255, 0.2);
        border-radius: 6px;
        padding: 2.5rem 1.5rem;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.85rem;
      }
      .fiche-state-title {
        margin: 0;
        font-size: 1.25rem;
      }
      .fiche-state-text {
        margin: 0;
        color: rgba(255, 255, 255, 0.7);
      }

      .fiche-top-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .btn-back-link {
        color: #80b3ff;
        text-decoration: none;
        font-size: 0.85rem;
        font-weight: 700;
      }
      .btn-back-link:hover {
        text-decoration: underline;
      }

      .fiche-top-actions {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.6rem;
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        padding: 0.3rem 0.7rem;
        border-radius: 4px;
        font-size: 0.72rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #ffffff;
      }
      .status-pill[data-status='publicada'] {
        background: rgba(34, 197, 94, 0.16);
        border-color: rgba(34, 197, 94, 0.45);
        color: #4ade80;
      }
      .status-pill[data-status='oculta'] {
        background: rgba(245, 158, 11, 0.16);
        border-color: rgba(245, 158, 11, 0.45);
        color: #fbbf24;
      }
      .status-pill[data-status='pendiente_publicacion'] {
        background: rgba(128, 179, 255, 0.16);
        border-color: rgba(128, 179, 255, 0.45);
        color: #80b3ff;
      }

      .btn-fiche {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        height: 36px;
        padding: 0 1rem;
        border-radius: 4px;
        font-size: 0.8rem;
        font-weight: 700;
        text-decoration: none;
        cursor: pointer;
        border: 1px solid transparent;
        transition: all 0.18s ease;
        white-space: nowrap;
        box-sizing: border-box;
      }
      .btn-fiche:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .btn-primary {
        background: #80b3ff;
        color: #07122b;
      }
      .btn-primary:hover {
        background: #a5c9ff;
      }
      .btn-outline {
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(255, 255, 255, 0.2);
        color: #ffffff;
      }
      .btn-outline:hover {
        background: rgba(255, 255, 255, 0.14);
        border-color: #80b3ff;
      }
      .btn-pause {
        background: rgba(245, 158, 11, 0.14);
        border-color: rgba(245, 158, 11, 0.45);
        color: #fbbf24;
      }
      .btn-pause:hover {
        background: rgba(245, 158, 11, 0.25);
      }
      .btn-resume {
        background: rgba(34, 197, 94, 0.16);
        border-color: rgba(34, 197, 94, 0.45);
        color: #4ade80;
      }
      .btn-resume:hover {
        background: rgba(34, 197, 94, 0.28);
      }

      .icon-sm {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      .fiche-card {
        background: rgba(11, 20, 42, 0.82);
        border: 1px solid rgba(128, 179, 255, 0.18);
        border-radius: 6px;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .hero-grid {
        display: grid;
        grid-template-columns: 320px minmax(0, 1fr);
        gap: 1.5rem;
        align-items: start;
      }
      .hero-media {
        width: 100%;
        aspect-ratio: 16 / 10;
        border-radius: 4px;
        overflow: hidden;
        background: #000;
        border: 1px solid rgba(255, 255, 255, 0.12);
      }
      .hero-cover-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .hero-info {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        min-width: 0;
      }
      .hero-kicker {
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        color: #80b3ff;
        text-transform: uppercase;
      }
      .hero-title {
        margin: 0;
        font-size: 1.55rem;
        font-weight: 800;
        color: #ffffff;
        line-height: 1.2;
      }
      .hero-tagline {
        margin: 0;
        font-size: 0.92rem;
        color: rgba(255, 255, 255, 0.78);
        line-height: 1.5;
      }

      .specs-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
        margin-top: 0.5rem;
      }
      .spec-box {
        background: rgba(5, 11, 24, 0.65);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 4px;
        padding: 0.65rem 0.8rem;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }
      .spec-lbl {
        font-size: 0.66rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: rgba(255, 255, 255, 0.55);
        text-transform: uppercase;
      }
      .spec-val {
        font-size: 0.9rem;
        font-weight: 700;
        color: #ffffff;
      }
      .text-accent {
        color: #80b3ff;
      }

      .section-head-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.75rem;
      }
      .section-heading {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 800;
        color: #ffffff;
      }
      .section-sub {
        margin: 0.2rem 0 0;
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.62);
      }

      .fiche-description {
        margin: 0;
        font-size: 0.9rem;
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.85);
        white-space: pre-line;
      }

      .logistics-meta-row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.85rem;
        padding-top: 0.75rem;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }
      .logistics-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .logistics-val {
        font-size: 0.85rem;
        color: #ffffff;
      }
      .mono {
        font-family: monospace;
        color: #80b3ff;
      }

      .date-input {
        background: rgba(5, 11, 24, 0.85);
        border: 1px solid rgba(128, 179, 255, 0.35);
        border-radius: 4px;
        color: #ffffff;
        padding: 0.45rem 0.75rem;
        font-size: 0.84rem;
      }

      .dates-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .date-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.75rem;
        padding: 0.65rem 0.9rem;
        border-radius: 4px;
        background: rgba(5, 11, 24, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .date-row.is-closed {
        opacity: 0.72;
      }
      .date-main {
        display: flex;
        align-items: center;
        gap: 0.55rem;
      }
      .date-label {
        font-size: 0.88rem;
      }
      .date-capacity {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.72);
      }
      .mini-badge {
        font-size: 0.66rem;
        font-weight: 800;
        text-transform: uppercase;
        padding: 0.15rem 0.45rem;
        border-radius: 3px;
      }
      .badge-active {
        background: rgba(34, 197, 94, 0.16);
        color: #4ade80;
      }
      .badge-paused {
        background: rgba(245, 158, 11, 0.16);
        color: #fbbf24;
      }
      .badge-past {
        background: rgba(148, 163, 184, 0.16);
        color: #cbd5e1;
      }
      .date-actions {
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }
      .btn-mini {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.18);
        color: #ffffff;
        border-radius: 3px;
        padding: 0.28rem 0.6rem;
        font-size: 0.74rem;
        font-weight: 700;
        cursor: pointer;
      }
      .btn-mini:hover {
        background: rgba(128, 179, 255, 0.2);
        border-color: #80b3ff;
      }
      .btn-mini-danger {
        color: #f87171;
        border-color: rgba(239, 68, 68, 0.35);
      }
      .btn-mini-danger:hover {
        background: #ef4444;
        color: #ffffff;
      }

      .album-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 0.75rem;
      }
      .album-item {
        position: relative;
        aspect-ratio: 4 / 3;
        border-radius: 4px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: #000;
      }
      .album-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .album-badges {
        position: absolute;
        top: 6px;
        left: 6px;
        display: flex;
        gap: 4px;
      }
      .album-tag {
        font-size: 0.62rem;
        font-weight: 800;
        text-transform: uppercase;
        padding: 0.15rem 0.45rem;
        border-radius: 3px;
      }
      .tag-cover {
        background: rgba(255, 204, 0, 0.9);
        color: #0b1020;
      }
      .tag-featured {
        background: rgba(128, 179, 255, 0.92);
        color: #07122b;
      }

      .empty-hint {
        margin: 0;
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.55);
      }

      .fiche-bottom-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.75rem;
        padding-top: 0.5rem;
      }
      .fiche-bottom-right {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.6rem;
      }

      @media (max-width: 820px) {
        .hero-grid {
          grid-template-columns: 1fr;
        }
        .specs-grid,
        .logistics-meta-row {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 520px) {
        .specs-grid,
        .logistics-meta-row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ProviderExperienceDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly store = inject(ProviderStoreService);
  private readonly expService = inject(ExperienceService);

  readonly slugParam = signal<string>('');
  readonly isLoading = signal<boolean>(false);
  readonly isTogglingPause = signal<boolean>(false);
  readonly feedbackToast = signal<string | null>(null);
  readonly albumModalExp = signal<ProviderExperience | null>(null);

  newDateValue = '';
  readonly todayIso = new Date().toISOString().slice(0, 10);

  private isPanelPrefix(): boolean {
    return typeof window !== 'undefined' && window.location.pathname.includes('/prestadores/panel');
  }

  readonly backLink = computed(() =>
    this.isPanelPrefix() ? '/prestadores/panel/experiencias' : '/experiencias',
  );

  readonly sociosLink = computed(() =>
    this.isPanelPrefix() ? '/prestadores/panel/socios' : '/socios',
  );

  readonly experience = computed<ProviderExperience | undefined>(() => {
    const key = this.slugParam();
    if (!key) return undefined;
    // Trigger reactive updates when provider experiences, proposals, or live experiences change
    this.store.providerExperiences();
    this.store.providerExperienceRequests();
    this.expService.experiences();
    return this.store.getExperienceBySlug(key) || this.store.getExperienceById(key);
  });

  readonly enrolledCount = computed(() => {
    const exp = this.experience();
    return exp ? this.store.totalEnrolledInExperience(exp.id) : 0;
  });

  readonly confirmedRevenue = computed(() => {
    const exp = this.experience();
    if (!exp) return 0;
    return this.store
      .submissionsFor(exp.id)
      .filter((s) => s.status === 'aprobado')
      .reduce((acc, s) => acc + s.amountArs, 0);
  });

  readonly dateRows = computed(() => {
    const exp = this.experience();
    if (!exp) return [];
    const today = this.todayIso;
    return (exp.dates || []).map((date) => {
      const reserved = this.store.reservedSeats(exp.id, date);
      const capacity = this.store.capacityForDate(exp, date);
      return {
        date,
        reserved,
        capacity,
        isClosed: this.store.isDateClosed(exp, date),
        isUnlimited: capacity >= 999,
        isPast: date < today,
      };
    });
  });

  async ngOnInit(): Promise<void> {
    const key = this.route.snapshot.paramMap.get('slug') || this.route.snapshot.paramMap.get('id') || '';
    this.slugParam.set(key);

    if (key && !this.experience()) {
      this.isLoading.set(true);
      try {
        await Promise.all([
          this.expService.reloadFromSupabase(),
          this.store.loadProposalsFromSupabase(),
        ]);
      } finally {
        this.isLoading.set(false);
      }
    }
  }

  editLink(exp: ProviderExperience): string {
    const base = this.isPanelPrefix() ? '/prestadores/panel/experiencias' : '/experiencias';
    return `${base}/${exp.slug || exp.id}/editar`;
  }

  getPublicUrl(exp: ProviderExperience): string {
    if (exp.publicUrl && exp.publicUrl.trim()) return exp.publicUrl.trim();
    return `https://experiencias.club/experiencias/${exp.slug}`;
  }

  async onTogglePause(exp: ProviderExperience): Promise<void> {
    if (this.isTogglingPause()) return;
    this.isTogglingPause.set(true);
    try {
      const updated = await this.store.toggleExperiencePause(exp.id);
      this.showToast(
        updated.status === 'oculta'
          ? 'Experiencia pausada. Ya no aparecerá en el catálogo público.'
          : 'Experiencia reactivada y visible nuevamente en el catálogo público.',
      );
    } catch (err: unknown) {
      this.showToast(
        err instanceof Error ? err.message : 'No se pudo actualizar el estado de la experiencia.',
      );
    } finally {
      this.isTogglingPause.set(false);
    }
  }

  onQuickDatePicked(val: string, expId: string): void {
    if (!val || !/^\d{4}-\d{2}-\d{2}$/.test(val)) return;
    if (val < this.todayIso) {
      this.showToast('No se pueden programar fechas en el pasado.');
      return;
    }
    const ok = this.store.addDateToExperience(expId, val);
    this.newDateValue = '';
    this.showToast(ok ? 'Fecha de salida agregada con éxito.' : 'Esa fecha ya existe en la experiencia.');
  }

  toggleDatePause(expId: string, date: string): void {
    this.store.toggleDateStatus(expId, date);
    const exp = this.store.getExperienceById(expId);
    const closed = exp ? this.store.isDateClosed(exp, date) : false;
    this.showToast(closed ? `Fecha ${date} pausada.` : `Fecha ${date} reanudada.`);
  }

  removeDate(expId: string, date: string): void {
    if (this.store.reservedSeats(expId, date) > 0) {
      this.showToast('No se puede eliminar una fecha con reservas confirmadas. Podés pausarla.');
      return;
    }
    if (confirm(`¿Eliminar la fecha de salida (${date})?`)) {
      const ok = this.store.removeDateFromExperience(expId, date);
      this.showToast(ok ? 'Fecha eliminada.' : 'No se pudo eliminar la fecha.');
    }
  }

  onAlbumSaved(): void {
    this.albumModalExp.set(null);
    this.showToast('Álbum de fotos actualizado con éxito.');
  }

  private showToast(msg: string): void {
    this.feedbackToast.set(msg);
    setTimeout(() => this.feedbackToast.set(null), 4000);
  }
}

