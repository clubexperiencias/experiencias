import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('experiencias');
  private readonly router = inject(Router);

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
          document.body.scrollTop = 0;
          document.documentElement.scrollTop = 0;
        }
      });

    if (typeof document !== 'undefined') {
      const updateSpanishValidity = (event: Event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
          return;
        }
        target.setCustomValidity('');
        const val = target.value.trim();

        if (target.validity.valueMissing) {
          target.setCustomValidity('Por favor, completá este campo.');
          return;
        }

        if (target instanceof HTMLInputElement && target.type === 'email' && val) {
          if (!val.includes('@')) {
            target.setCustomValidity(
              `Por favor, incluí un '@' en la dirección de correo electrónico. A '${val}' le falta un '@'.`,
            );
            return;
          }
          const [localPart, domainPart] = val.split('@');
          if (!localPart) {
            target.setCustomValidity(
              `Por favor, ingresá texto antes de '@'. '${val}' está incompleto.`,
            );
            return;
          }
          if (!domainPart) {
            target.setCustomValidity(
              `Por favor, ingresá la parte que sigue a '@'. '${val}' está incompleto.`,
            );
            return;
          }
          if (target.validity.typeMismatch || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) {
            target.setCustomValidity(
              'Por favor, ingresá una dirección de correo electrónico válida.',
            );
          }
        }
      };

      document.addEventListener('input', updateSpanishValidity, true);
      document.addEventListener('invalid', updateSpanishValidity, true);
    }
  }
}
