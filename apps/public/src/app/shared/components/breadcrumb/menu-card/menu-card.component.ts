import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface MenuCard {
  kicker: string;
  title: string;
  subtitle: string;
  url: string;
  imageUrl: string;
  badge?: string;
}

export const RECOMMENDED_CARD: MenuCard = {
  kicker: 'Recomendada',
  title: 'Travesía en Kayak & Sunset en Las Pirquitas',
  subtitle: 'Dique El Jumeal · 850 msnm · Calificación 4.95 ★',
  url: '/experiencias/kayak',
  imageUrl: '/assets/images/kayak-club-de-experiencias.jpg',
  badge: 'DESTACADA',
};

export const MEMBERSHIP_CARD: MenuCard = {
  kicker: 'Membresía',
  title: 'Sumate como Socio Fundador',
  subtitle: 'Membresía vitalicia con cupos y accesos exclusivos',
  url: '/socios/fundadores',
  imageUrl: '/assets/images/sumate.png',
  badge: 'FUNDADOR 2026',
};

@Component({
  selector: 'app-menu-card',
  standalone: true,
  imports: [RouterLink],
  template: `
    @let c = card();
    <span class="menu-card-kicker">{{ c.kicker }}</span>
    <a
      [routerLink]="c.url"
      class="menu-card"
      (click)="navigate.emit({ url: c.url, event: $event })"
    >
      <div class="menu-card-img-wrap">
        <img [src]="c.imageUrl" [alt]="c.title" class="menu-card-img" />
        @if (c.badge) {
          <span class="menu-card-badge">{{ c.badge }}</span>
        }
      </div>
      <h4 class="menu-card-title">{{ c.title }}</h4>
      <p class="menu-card-sub">{{ c.subtitle }}</p>
    </a>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      width: 350px;
      flex-shrink: 0;
    }
    .menu-card-kicker {
      font-family: var(--font-sans);
      font-size: 0.72rem;
      font-weight: 700;
      color: #767676;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 1.25rem;
      display: block;
    }
    .menu-card {
      display: flex;
      flex-direction: column;
      text-decoration: none !important;
      color: inherit;
    }
    .menu-card-img-wrap {
      position: relative;
      width: 100%;
      height: 175px;
      overflow: hidden;
      background: #000000;
    }
    .menu-card-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: transform 0.35s ease;
    }
    .menu-card:hover .menu-card-img {
      transform: scale(1.03);
    }
    .menu-card-badge {
      position: absolute;
      top: 10px;
      left: 10px;
      background: #ffcc00;
      color: #000000;
      font-family: var(--font-sans);
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      padding: 0.2rem 0.5rem;
    }
    .menu-card-title {
      font-family: var(--font-sans);
      font-size: 1.05rem;
      font-weight: 800;
      color: #000000;
      margin: 0.75rem 0 0.25rem;
      line-height: 1.3;
      letter-spacing: -0.01em;
      white-space: normal;
      transition: color 0.15s ease;
    }
    .menu-card:hover .menu-card-title {
      color: #666666;
    }
    .menu-card-sub {
      font-family: var(--font-sans);
      font-size: 0.82rem;
      color: #666666;
      margin: 0;
      line-height: 1.4;
      white-space: normal;
    }
    @media (max-width: 900px) {
      :host {
        width: 100%;
      }
      .menu-card-img-wrap {
        height: 150px;
      }
    }
  `,
})
export class MenuCardComponent {
  readonly card = input.required<MenuCard>();
  readonly navigate = output<{ url: string; event: MouseEvent }>();
}
