import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { filter } from 'rxjs';

const DEFAULT_PAGE_METADATA = {
  section: 'Expediciones privadas en Catamarca',
  description:
    'Expediciones andinas y travesías náuticas en Catamarca. Descubrí experiencias privadas y sumate.',
  image: '/assets/images/catamarca_hero.jpg',
  imageAlt: 'Experiencias y expediciones en Catamarca',
};

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('Portal Prestadores · Club de Experiencias');
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly pageTitle = inject(Title);

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
          document.body.scrollTop = 0;
          document.documentElement.scrollTop = 0;
        }
        this.updatePageMetadata(event.urlAfterRedirects);
      });

    this.updatePageMetadata(this.router.url);

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

  private updatePageMetadata(url: string): void {
    const metadata = this.getPageMetadata(url);
    const title = `Club de Experiencias | ${metadata.section}`;
    const absoluteUrl =
      typeof window !== 'undefined' ? new URL(url, window.location.origin).href : url;
    const absoluteImage =
      typeof window !== 'undefined'
        ? new URL(metadata.image, window.location.origin).href
        : metadata.image;

    this.pageTitle.setTitle(title);
    this.meta.updateTag({ name: 'description', content: metadata.description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: metadata.description });
    this.meta.updateTag({ property: 'og:image', content: absoluteImage });
    this.meta.updateTag({ property: 'og:image:alt', content: metadata.imageAlt });
    this.meta.updateTag({ property: 'og:url', content: absoluteUrl });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: metadata.description });
    this.meta.updateTag({ name: 'twitter:image', content: absoluteImage });
    this.meta.updateTag({ name: 'twitter:image:alt', content: metadata.imageAlt });
  }

  private getPageMetadata(url: string): typeof DEFAULT_PAGE_METADATA {
    const path = url.split('?')[0].split('#')[0];
    if (path === '/' || path === '') return DEFAULT_PAGE_METADATA;
    if (path.startsWith('/experiencias/kayak')) {
      return {
        section: 'Kayak & Sunset en el Dique El Jumeal',
        description:
          'Viví una travesía guiada en kayak al atardecer, con aguas calmas y paisaje catamarqueño.',
        image: '/assets/images/kayak-club-de-experiencias.jpg',
        imageAlt: 'Travesía en kayak en el Dique El Jumeal',
      };
    }
    if (path.startsWith('/experiencias')) {
      return {
        section: 'Experiencias en Catamarca',
        description:
          'Explorá experiencias privadas: kayak, expediciones andinas y travesías únicas en Catamarca.',
        image: '/assets/images/catamarca_hero.jpg',
        imageAlt: 'Experiencias de aventura en Catamarca',
      };
    }
    if (path.startsWith('/perfil')) {
      return {
        section: 'Mi perfil de socio',
        description:
          'Consultá tus datos, comprobantes y experiencias dentro del Club de Experiencias.',
        image: '/assets/images/logo-club-experiencias.png',
        imageAlt: 'Club de Experiencias',
      };
    }
    if (path.startsWith('/prestador')) {
      return {
        section: 'Portal de prestadores',
        description:
          'Gestioná tus experiencias, fechas, comprobantes e inscriptos desde el portal de prestadores.',
        image: '/assets/images/logo-club-experiencias.png',
        imageAlt: 'Portal de prestadores del Club de Experiencias',
      };
    }
    if (path.startsWith('/socios')) {
      return {
        section: 'Socios del Club',
        description:
          'Conocé los niveles de socio y accedé a experiencias privadas en Catamarca.',
        image: '/assets/images/catamarca_hero.jpg',
        imageAlt: 'Socios del Club de Experiencias',
      };
    }
    return DEFAULT_PAGE_METADATA;
  }
}
