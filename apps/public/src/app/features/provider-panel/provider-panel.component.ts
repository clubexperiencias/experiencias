import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../../shared/components/breadcrumb/breadcrumb.component';
import { ProviderStoreService } from '../../core/services/provider-store.service';

@Component({
  selector: 'app-provider-panel',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FooterComponent, HeaderComponent, BreadcrumbComponent],
  template: `
    <div class="kayak-page-container">
      <app-header [(mobileMenuOpen)]="mobileMenuOpen"></app-header>
      <app-breadcrumb [items]="breadcrumbs"></app-breadcrumb>

      <div class="kayak-wallpaper-body app-wallpaper-body">
        <main class="kayak-main-content">
          <div class="panel-wrapper">
            <header class="panel-head">
              <div>
                <span class="section-kicker">PANEL DE PRESTADORES</span>
                <h1 class="card-heading">Tus experiencias y pagos</h1>
              </div>
              <a routerLink="experiencias/nueva" class="cta-primary-btn panel-new-btn">Nueva experiencia</a>
            </header>

            <nav class="panel-tabs" aria-label="Secciones del panel">
              <a routerLink="experiencias" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }"
                class="panel-tab">Experiencias</a>
              <a routerLink="comprobantes" routerLinkActive="is-active" class="panel-tab">
                Comprobantes
                @if (store.pendingCount() > 0) {
                  <span class="panel-tab-badge" [attr.aria-label]="store.pendingCount() + ' pendientes'">{{ store.pendingCount() }}</span>
                }
              </a>
            </nav>

            <router-outlet />
          </div>
        </main>
      </div>

      <app-footer />
    </div>
  `,
  styleUrl: './provider-panel.component.css',
})
export class ProviderPanelComponent {
  readonly store = inject(ProviderStoreService);
  readonly mobileMenuOpen = signal(false);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Panel de prestadores' },
  ];
}
