import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

export type SubrouteTab = 'expediciones' | 'hospedajes';

@Component({
  selector: 'app-experiences-subroute-switch',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './experiences-subroute-switch.component.html',
  styleUrl: './experiences-subroute-switch.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExperiencesSubrouteSwitchComponent {
  private readonly router = inject(Router);

  /**
   * Permite fijar la pestaña activa explícitamente ('expediciones' | 'hospedajes').
   * Si no se provee, se detecta automáticamente de la URL actual.
   */
  readonly active = input<SubrouteTab>();

  /**
   * Señal interna para cambio instantáneo (0ms) en mousedown/click,
   * eliminando cualquier delay mientras la navegación asíncrona de Angular se completa.
   */
  readonly selectedTab = signal<SubrouteTab | null>(null);

  readonly currentTab = computed<SubrouteTab>(() => {
    const selected = this.selectedTab();
    if (selected) return selected;
    const forced = this.active();
    if (forced) return forced;
    const url = this.router.url.split('?')[0].split('#')[0];
    if (url.includes('/experiencias/hospedajes')) {
      return 'hospedajes';
    }
    return 'expediciones';
  });

  onSelect(tab: SubrouteTab): void {
    this.selectedTab.set(tab);
  }
}

