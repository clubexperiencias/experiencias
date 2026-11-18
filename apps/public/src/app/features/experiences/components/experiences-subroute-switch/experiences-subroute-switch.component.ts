import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
  private readonly destroyRef = inject(DestroyRef);

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

  private isNavigating = false;
  private navigationTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.router.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          this.isNavigating = true;
          if (this.navigationTimeout) {
            clearTimeout(this.navigationTimeout);
            this.navigationTimeout = null;
          }
        } else if (event instanceof NavigationEnd) {
          this.isNavigating = false;
          if (this.navigationTimeout) {
            clearTimeout(this.navigationTimeout);
            this.navigationTimeout = null;
          }
        } else if (event instanceof NavigationCancel || event instanceof NavigationError) {
          this.isNavigating = false;
          if (this.navigationTimeout) {
            clearTimeout(this.navigationTimeout);
            this.navigationTimeout = null;
          }
          this.selectedTab.set(null);
        }
      });
  }

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

  onSelect(tab: SubrouteTab, event?: Event): void {
    if (this.currentTab() === tab) {
      return;
    }

    if (event instanceof MouseEvent) {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
    } else if (event instanceof KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
    }

    this.selectedTab.set(tab);

    if (this.navigationTimeout) {
      clearTimeout(this.navigationTimeout);
    }
    this.navigationTimeout = setTimeout(() => {
      if (!this.isNavigating) {
        this.selectedTab.set(null);
      }
      this.navigationTimeout = null;
    }, 1500);
  }

  clearProvisional(): void {
    if (!this.isNavigating) {
      if (this.navigationTimeout) {
        clearTimeout(this.navigationTimeout);
        this.navigationTimeout = null;
      }
      this.selectedTab.set(null);
    }
  }
}

