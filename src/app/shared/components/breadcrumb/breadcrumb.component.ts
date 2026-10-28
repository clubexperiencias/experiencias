import { Component, input, signal, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

export interface BreadcrumbNextStep {
  label: string;
  url: string;
}

export interface BreadcrumbFeaturedItem {
  kicker?: string;
  title: string;
  subtitle: string;
  url: string;
  imageUrl: string;
  badge?: string;
}

export interface BreadcrumbNextStepsData {
  kicker: string;
  steps: BreadcrumbNextStep[];
  secondaryCard?: BreadcrumbFeaturedItem;
  featured?: BreadcrumbFeaturedItem;
  viewAllLabel?: string;
  viewAllUrl?: string;
}

export interface BreadcrumbItem {
  label: string;
  url?: string;
  nextStepsData?: BreadcrumbNextStepsData;
}

// Variable a nivel de módulo para persistir la supresión de hover en transiciones de Angular SPA
let globalSuppressBreadcrumbHover = false;

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  templateUrl: './breadcrumb.component.html',
  styleUrl: './breadcrumb.component.css',
})
export class BreadcrumbComponent implements OnInit {
  private readonly router = inject(Router);

  readonly items = input<BreadcrumbItem[]>([]);
  readonly activeMobileIndex = signal<number | null>(null);
  readonly isHoverSuppressed = signal(false);
  private mobileTimer: ReturnType<typeof setTimeout> | null = null;
  private suppressionTimer: ReturnType<typeof setTimeout> | null = null;
  private initialMousePos: { x: number; y: number } | null = null;

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      const fromSession = sessionStorage.getItem('suppress_breadcrumb_hover');
      if (globalSuppressBreadcrumbHover || fromSession === 'true') {
        this.isHoverSuppressed.set(true);
        sessionStorage.removeItem('suppress_breadcrumb_hover');

        // Desactivar supresión automáticamente tras 2.5s por si el usuario no mueve el cursor
        this.suppressionTimer = setTimeout(() => {
          this.clearHoverSuppression();
        }, 2500);
      }
    }
  }

  clearHoverSuppression(): void {
    if (this.suppressionTimer) {
      clearTimeout(this.suppressionTimer);
      this.suppressionTimer = null;
    }
    this.isHoverSuppressed.set(false);
    globalSuppressBreadcrumbHover = false;
    this.initialMousePos = null;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('suppress_breadcrumb_hover');
    }
  }

  onBarMouseLeave(): void {
    this.clearHoverSuppression();
  }

  onBarMouseMove(event: MouseEvent): void {
    if (!this.isHoverSuppressed()) return;
    if (!this.initialMousePos) {
      this.initialMousePos = { x: event.clientX, y: event.clientY };
      return;
    }
    const dist = Math.hypot(
      event.clientX - this.initialMousePos.x,
      event.clientY - this.initialMousePos.y,
    );
    // Si el usuario mueve deliberadamente el cursor más de 20 píxeles, rehabilitamos el hover
    if (dist > 20) {
      this.clearHoverSuppression();
    }
  }

  canShowNextSteps(item: BreadcrumbItem, first: boolean, last: boolean): boolean {
    return true;
  }

  onItemClick(
    idx: number,
    item: BreadcrumbItem,
    first: boolean,
    last: boolean,
    event: MouseEvent,
  ): void {
    const currentPath = (this.router.url || '').split('?')[0].split('#')[0];
    const itemPath = item.url ? item.url.split('?')[0].split('#')[0] : null;
    const isCurrentPage = last || (itemPath !== null && itemPath === currentPath);

    // En mobile, si tiene menú y el menú NO está abierto todavía, lo mostramos durante 3 segundos:
    if (
      this.isMobileOrTouch() &&
      this.canShowNextSteps(item, first, last) &&
      this.activeMobileIndex() !== idx
    ) {
      event.preventDefault();
      event.stopPropagation();
      this.openMenuForDuration(idx, 3000);
      return;
    }

    // Suprimir hover para que al cargar la nueva página no se abra el mega menú sobre el cursor estático
    globalSuppressBreadcrumbHover = true;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('suppress_breadcrumb_hover', 'true');
    }

    // Si clickeas en un ítem donde ya estás, recargar la web:
    if (isCurrentPage) {
      event.preventDefault();
      this.closeMobileMenu();
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
      return;
    }

    this.closeMobileMenu();
  }

  onLinkClick(targetUrl: string, event: MouseEvent): void {
    this.closeMobileMenu();
    const currentPath = (this.router.url || '').split('?')[0].split('#')[0];
    const targetPath = (targetUrl || '').split('?')[0].split('#')[0];

    // Suprimir hover para evitar que se abra el menú en la nueva página
    globalSuppressBreadcrumbHover = true;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('suppress_breadcrumb_hover', 'true');
    }

    // Si se clickea un enlace a la página donde ya estás, recargar la web:
    if (currentPath === targetPath) {
      event.preventDefault();
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  }

  openMenuForDuration(idx: number, ms: number = 3000): void {
    if (this.mobileTimer) {
      clearTimeout(this.mobileTimer);
    }
    this.activeMobileIndex.set(idx);
    this.mobileTimer = setTimeout(() => {
      this.activeMobileIndex.set(null);
    }, ms);
  }

  closeMobileMenu(): void {
    if (this.mobileTimer) {
      clearTimeout(this.mobileTimer);
      this.mobileTimer = null;
    }
    this.activeMobileIndex.set(null);
  }

  isMobileOrTouch(): boolean {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 900 || 'ontouchstart' in window;
  }

  getNextStepsData(item: BreadcrumbItem): BreadcrumbNextStepsData {
    if (item.nextStepsData) {
      return item.nextStepsData;
    }

    const labelNorm = (item.label || '').toLowerCase().trim();
    const urlNorm = (item.url || '').toLowerCase().trim();

    // 1. INICIO
    if (labelNorm === 'inicio' || urlNorm === '/') {
      return {
        kicker: 'Explorar—',
        steps: [
          { label: 'Catálogo de Expediciones', url: '/experiencias' },
          { label: 'Membresías & Niveles de Socio', url: '/socios' },
          { label: 'Mi Perfil de Socio', url: '/perfil' },
          { label: 'Volver al Inicio', url: '/' },
        ],
        featured: {
          title: 'Travesía en Kayak & Sunset en Las Pirquitas',
          subtitle: 'Dique Las Pirquitas · 850 msnm · Calificación 4.95 ★',
          url: '/experiencias/kayak',
          imageUrl: '/assets/images/kayak-club-de-experiencias.jpg',
          badge: 'DESTACADA',
        },
        secondaryCard: {
          kicker: 'Membresía—',
          title: 'Sumate como Socio Fundador',
          subtitle: 'Membresía vitalicia con cupos y accesos exclusivos',
          url: '/socios/fundadores',
          imageUrl: '/assets/images/sumate.png',
          badge: 'FUNDADOR 2026',
        },
      };
    }

    // 2. EXPERIENCIAS / CATÁLOGO
    if (labelNorm.includes('experiencia') || urlNorm === '/experiencias') {
      return {
        kicker: 'Expediciones—',
        steps: [
          { label: 'Kayak & Sunset Las Pirquitas', url: '/experiencias/kayak' },
          { label: 'Fotos de Travesías', url: '/experiencias/fotos' },
          { label: 'Calificaciones Verificadas', url: '/experiencias/calificaciones' },
          { label: 'Volver al Inicio', url: '/' },
        ],
        featured: {
          title: 'Kayak & Sunset en Las Pirquitas',
          subtitle: 'Navegación silenciosa, cata y baqueano homologado',
          url: '/experiencias/kayak',
          imageUrl: '/assets/images/kayak-club-de-experiencias.jpg',
          badge: 'CUPO PRIORITARIO',
        },
        secondaryCard: {
          kicker: 'Membresía—',
          title: 'Sumate como Socio Fundador',
          subtitle: 'Membresía vitalicia 2026 · Cupos preferenciales en cada expedición',
          url: '/socios/fundadores',
          imageUrl: '/assets/images/sumate.png',
          badge: 'FUNDADOR 2026',
        },
      };
    }

    // 3. KAYAK & SUNSET (o subpáginas de kayak)
    if (labelNorm.includes('kayak') || urlNorm === '/experiencias/kayak') {
      return {
        kicker: 'Travesía en Kayak—',
        steps: [
          { label: 'Galería Fotográfica Oficial', url: '/experiencias/kayak/fotos' },
          { label: 'Reseñas & Calificaciones', url: '/experiencias/kayak/calificaciones' },
          { label: 'Catálogo de Expediciones', url: '/experiencias' },
          { label: 'Volver al Inicio', url: '/' },
        ],
        featured: {
          title: 'Postales de Socios',
          subtitle: 'Registro fotográfico oficial en aguas calmas',
          url: '/experiencias/kayak/fotos',
          imageUrl: '/assets/images/kayak-club-de-experiencias.jpg',
          badge: 'FOTOGRAFÍAS',
        },
        secondaryCard: {
          kicker: 'Membresía—',
          title: 'Sumate como Socio Fundador',
          subtitle: 'Membresía vitalicia con cupos y accesos exclusivos',
          url: '/socios/fundadores',
          imageUrl: '/assets/images/sumate.png',
          badge: 'FUNDADOR 2026',
        },
      };
    }

    // 4. FOTOS O CALIFICACIONES (General o Kayak)
    if (
      labelNorm.includes('foto') ||
      labelNorm.includes('galería') ||
      labelNorm.includes('calificaci') ||
      labelNorm.includes('reseña')
    ) {
      return {
        kicker: 'Comunidad & Archivos—',
        steps: [
          { label: 'Fotos de Travesías', url: '/experiencias/fotos' },
          { label: 'Calificaciones Verificadas', url: '/experiencias/calificaciones' },
          { label: 'Travesía en Kayak', url: '/experiencias/kayak' },
          { label: 'Volver al Inicio', url: '/' },
        ],
        featured: {
          title: 'Ficha Técnica & Requisitos',
          subtitle: 'Itinerario, equipo provisto y protocolo WFR',
          url: '/experiencias/kayak',
          imageUrl: '/assets/images/kayak-club-de-experiencias.jpg',
          badge: 'FICHA TÉCNICA',
        },
        secondaryCard: {
          kicker: 'Membresía—',
          title: 'Sumate como Socio Fundador',
          subtitle: 'Membresía vitalicia con cupos y accesos exclusivos',
          url: '/socios/fundadores',
          imageUrl: '/assets/images/sumate.png',
          badge: 'FUNDADOR 2026',
        },
      };
    }

    // 5. SOCIOS / MEMBRESÍAS
    if (labelNorm.includes('socio') || labelNorm.includes('membres') || urlNorm === '/socios') {
      return {
        kicker: 'Membresías—',
        steps: [
          { label: 'Socios Fundadores', url: '/socios/fundadores' },
          { label: 'Socios Plenos Mensuales', url: '/socios/plenos' },
          { label: 'Catálogo de Expediciones', url: '/experiencias' },
          { label: 'Volver al Inicio', url: '/' },
        ],
        featured: {
          title: 'Travesía en Kayak & Sunset en Las Pirquitas',
          subtitle: 'Dique Las Pirquitas · 850 msnm · Calificación 4.95 ★',
          url: '/experiencias/kayak',
          imageUrl: '/assets/images/kayak-club-de-experiencias.jpg',
          badge: 'DESTACADA',
        },
        secondaryCard: {
          kicker: 'Membresía—',
          title: 'Membresía de Socio Fundador',
          subtitle: 'Acceso vitalicio exclusivo con cupo preferencial',
          url: '/socios/fundadores',
          imageUrl: '/assets/images/sumate.png',
          badge: 'VITALICIO',
        },
      };
    }

    // 6. SOCIO FUNDADOR O PLENO
    if (
      labelNorm.includes('fundador') ||
      labelNorm.includes('activo') ||
      labelNorm.includes('emergente')
    ) {
      return {
        kicker: 'Niveles de Socio—',
        steps: [
          { label: 'Socios Fundadores', url: '/socios/fundadores' },
          { label: 'Socios Plenos Mensuales', url: '/socios/plenos' },
          { label: 'Catálogo de Expediciones', url: '/experiencias' },
          { label: 'Volver al Inicio', url: '/' },
        ],
        featured: {
          title: 'Travesía en Kayak & Sunset en Las Pirquitas',
          subtitle: 'Dique Las Pirquitas · 850 msnm · Calificación 4.95 ★',
          url: '/experiencias/kayak',
          imageUrl: '/assets/images/kayak-club-de-experiencias.jpg',
          badge: 'DESTACADA',
        },
        secondaryCard: {
          kicker: 'Membresía—',
          title: 'Comparativa de Beneficios',
          subtitle: 'Tarifas especiales, cupos y credencial oficial',
          url: '/socios',
          imageUrl: '/assets/images/sumate.png',
          badge: 'BENEFICIOS',
        },
      };
    }

    // 7. MI PERFIL O ACTIVIDADES
    if (
      labelNorm.includes('perfil') ||
      labelNorm.includes('actividad') ||
      urlNorm.includes('/perfil')
    ) {
      return {
        kicker: 'Socio—',
        steps: [
          { label: 'Mis Actividades & Reservas', url: '/perfil/actividades' },
          { label: 'Membresías & Niveles de Socio', url: '/socios' },
          { label: 'Catálogo de Expediciones', url: '/experiencias' },
          { label: 'Volver al Inicio', url: '/' },
        ],
        featured: {
          title: 'Travesía en Kayak & Sunset en Las Pirquitas',
          subtitle: 'Dique Las Pirquitas · 850 msnm · Calificación 4.95 ★',
          url: '/experiencias/kayak',
          imageUrl: '/assets/images/kayak-club-de-experiencias.jpg',
          badge: 'DESTACADA',
        },
        secondaryCard: {
          kicker: 'Membresía—',
          title: 'Sumate como Socio Fundador',
          subtitle: 'Membresía vitalicia con cupos y accesos exclusivos',
          url: '/socios/fundadores',
          imageUrl: '/assets/images/sumate.png',
          badge: 'SOCIOS FUNDADORES',
        },
      };
    }

    // Fallback general estilo Nat Geo
    return {
      kicker: 'Explorar—',
      steps: [
        { label: 'Catálogo de Expediciones', url: '/experiencias' },
        { label: 'Membresías & Niveles de Socio', url: '/socios' },
        { label: 'Mi Perfil de Socio', url: '/perfil' },
        { label: 'Volver al Inicio', url: '/' },
      ],
      featured: {
        title: 'Travesía en Kayak & Sunset en Las Pirquitas',
        subtitle: 'Dique Las Pirquitas · 850 msnm · 4.95 ★',
        url: '/experiencias/kayak',
        imageUrl: '/assets/images/kayak-club-de-experiencias.jpg',
        badge: 'DESTACADA',
      },
      secondaryCard: {
        kicker: 'Membresía—',
        title: 'Sumate como Socio Fundador',
        subtitle: 'Membresía vitalicia con cupos y accesos exclusivos',
        url: '/socios/fundadores',
        imageUrl: '/assets/images/sumate.png',
        badge: 'FUNDADOR 2026',
      },
    };
  }
}
