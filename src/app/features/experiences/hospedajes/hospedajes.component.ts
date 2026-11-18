import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { HospedajesService } from '../../../core/services/hospedajes.service';
import { Hospedaje, HospedajeType } from '../../../core/models/hospedaje.model';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { FounderAdComponent } from '../../../shared/components/founder-ad/founder-ad.component';
import { ArsPipe } from '../../../shared/pipes/format.pipes';
import { ExperiencesSubrouteSwitchComponent } from '../components/experiences-subroute-switch/experiences-subroute-switch.component';

export interface CarouselHospedajeItem {
  key: string;
  cycleIndex: number;
  hospedaje: Hospedaje;
}

@Component({
  selector: 'app-hospedajes',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    HeaderComponent,
    FooterComponent,
    BreadcrumbComponent,
    FounderAdComponent,
    ArsPipe,
    ExperiencesSubrouteSwitchComponent,
  ],
  templateUrl: './hospedajes.component.html',
  styleUrls: ['../experiences.component.css', './hospedajes.component.css'],
})
export class HospedajesComponent implements AfterViewInit, OnDestroy {
  readonly hospedajesService = inject(HospedajesService);
  readonly router = inject(Router);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Experiencias', url: '/experiencias' },
    { label: 'Hospedajes' },
  ];

  mobileMenuOpen = signal(false);
  readonly selectedHospedaje = signal<Hospedaje | null>(null);

  // Favoritos locales
  private readonly _favoriteIds = signal<Set<string>>(this.loadFavoriteIds());
  readonly favoriteIds = this._favoriteIds.asReadonly();

  // Filtros del catálogo
  readonly searchTerm = signal('');
  readonly filterRegion = signal('todas');
  readonly filterType = signal('todos');
  readonly filterAltitude = signal('todas');
  readonly filterAmenity = signal('todas');

  // Carrusel
  @ViewChild('carouselRef') carouselRef?: ElementRef<HTMLDivElement>;
  private autoplayTimer: ReturnType<typeof setInterval> | null = null;
  readonly isPaused = signal(false);
  private readonly cycleRepetitions = 5;

  // Lista de tipos de hospedaje para el filtro
  readonly lodgingTypes: HospedajeType[] = [
    'Hostería de Altura',
    'Refugio Puneño',
    'Eco-Lodge & Cabaña',
    'Hotel Termal',
    'Glamping Andino',
  ];

  // Comodidades frecuentes para filtro
  readonly topAmenities = [
    'WiFi Satelital Starlink',
    'Calefacción tiro balanceado',
    'Piscina al aire libre',
    'Desayuno puneño casero',
    'Cochera para camionetas 4x4',
    'Deck privado con hidromasaje',
  ];

  // Hospedajes en preparación (Nueva experiencia en Catamarca)
  readonly comingSoonHospedajes: Hospedaje[] = [
    {
      id: 'hosp-coming-soon-1',
      slug: 'proximamente-hospedaje-puna',
      title: 'Nueva experiencia en Catamarca',
      tagline: 'Estamos preparando una nueva opción de hospedaje y refugio para compartir con el Club.',
      description:
        'Muy pronto vas a poder conocer todos los detalles de este alojamiento para tu descanso y aclimatación.',
      type: 'Refugio Puneño',
      region: 'Puna y Seismiles',
      locality: 'Catamarca',
      altitudeMeters: 3400,
      priceArsPerNight: 0,
      priceUsdPerNight: 0,
      capacityPerRoom: 0,
      totalRooms: 0,
      amenities: [],
      hostName: 'Club de Experiencias',
      coverImage: '/assets/images/catamarca_hero.jpg',
      galleryImages: ['/assets/images/catamarca_hero.jpg'],
      highlights: [
        'Alojamiento exclusivo en fase final de curaduría y relevamiento técnico',
        'Protocolo estricto de confort andino y hospitalidad regional',
      ],
      includedServices: [],
      isFeatured: true,
      isVerified: true,
      isLocked: true,
    },
    {
      id: 'hosp-coming-soon-2',
      slug: 'proximamente-hospedaje-valle',
      title: 'Nueva experiencia en Catamarca',
      tagline: 'Estamos preparando una nueva opción de hospedaje y refugio para compartir con el Club.',
      description:
        'Muy pronto vas a poder conocer todos los detalles de esta estancia andina para socios del Club.',
      type: 'Eco-Lodge & Cabaña',
      region: 'Valle Central y Ambato',
      locality: 'Catamarca',
      altitudeMeters: 1200,
      priceArsPerNight: 0,
      priceUsdPerNight: 0,
      capacityPerRoom: 0,
      totalRooms: 0,
      amenities: [],
      hostName: 'Club de Experiencias',
      coverImage: '/assets/images/laguna_blanca.jpg',
      galleryImages: ['/assets/images/laguna_blanca.jpg'],
      highlights: [
        'Espacio seleccionado para descanso previo y posterior a travesías',
        'Entorno natural con diseño sustentable y térmico',
      ],
      includedServices: [],
      isFeatured: true,
      isVerified: true,
      isLocked: true,
    },
    {
      id: 'hosp-coming-soon-3',
      slug: 'proximamente-hospedaje-belen',
      title: 'Nueva experiencia en Catamarca',
      tagline: 'Estamos preparando una nueva opción de hospedaje y refugio para compartir con el Club.',
      description:
        'Hostería de altura en proceso de relevamiento y homologación.',
      type: 'Hostería de Altura',
      region: 'Belén y Ruta 40',
      locality: 'Catamarca',
      altitudeMeters: 2000,
      priceArsPerNight: 0,
      priceUsdPerNight: 0,
      capacityPerRoom: 0,
      totalRooms: 0,
      amenities: [],
      hostName: 'Club de Experiencias',
      coverImage: '/assets/images/catamarca_pomez.jpg',
      galleryImages: ['/assets/images/catamarca_pomez.jpg'],
      highlights: [
        'Ubicación estratégica sobre los corredores turísticos de la provincia',
        'Atención personalizada con anfitriones y baqueanos locales',
      ],
      includedServices: [],
      isFeatured: true,
      isVerified: true,
      isLocked: true,
    },
  ];

  // Hospedajes disponibles para el catálogo (o en preparación si aún no hay en BD)
  readonly allAvailableHospedajes = computed<Hospedaje[]>(() => {
    const list = this.hospedajesService.hospedajes();
    return list.length > 0 ? list : this.comingSoonHospedajes;
  });

  // Regiones disponibles dinámicamente
  readonly availableRegions = computed(() => {
    const set = new Set<string>();
    for (const h of this.allAvailableHospedajes()) {
      if (h.region?.trim()) set.add(h.region.trim());
    }
    return Array.from(set).sort();
  });

  // Catálogo filtrado
  readonly filteredHospedajes = computed(() => {
    const list = this.allAvailableHospedajes();
    const query = this.normalizeText(this.searchTerm());
    const reg = this.filterRegion();
    const type = this.filterType();
    const alt = this.filterAltitude();
    const amenity = this.filterAmenity();

    return list.filter((h) => {
      // 1. Texto libre
      if (query) {
        const titleMatch = this.normalizeText(h.title).includes(query);
        const tagMatch = this.normalizeText(h.tagline).includes(query);
        const locMatch = this.normalizeText(h.locality).includes(query);
        const hostMatch = this.normalizeText(h.hostName || '').includes(query);
        const descMatch = this.normalizeText(h.description).includes(query);
        const amenitiesMatch = (h.amenities || []).some((a) => this.normalizeText(a).includes(query));
        const regMatch = this.normalizeText(h.region).includes(query);

        if (!titleMatch && !tagMatch && !locMatch && !hostMatch && !descMatch && !amenitiesMatch && !regMatch) {
          return false;
        }
      }

      // 2. Región
      if (reg !== 'todas') {
        if (h.region.toLowerCase() !== reg.toLowerCase()) {
          return false;
        }
      }

      // 3. Tipo
      if (type !== 'todos') {
        if (h.type.toLowerCase() !== type.toLowerCase()) {
          return false;
        }
      }

      // 4. Altitud
      if (alt !== 'todas') {
        if (alt === 'baja' && h.altitudeMeters > 1500) return false;
        if (alt === 'media' && (h.altitudeMeters <= 1500 || h.altitudeMeters > 3000)) return false;
        if (alt === 'alta' && h.altitudeMeters <= 3000) return false;
      }

      // 5. Comodidad
      if (amenity !== 'todas') {
        const hasAmenity = (h.amenities || []).some(
          (a) => a.toLowerCase().includes(amenity.toLowerCase())
        );
        if (!hasAmenity) return false;
      }

      return true;
    });
  });

  readonly hasActiveFilters = computed(() => {
    return (
      Boolean(this.searchTerm().trim()) ||
      this.filterRegion() !== 'todas' ||
      this.filterType() !== 'todos' ||
      this.filterAltitude() !== 'todas' ||
      this.filterAmenity() !== 'todas'
    );
  });

  resetFilters(): void {
    this.searchTerm.set('');
    this.filterRegion.set('todas');
    this.filterType.set('todos');
    this.filterAltitude.set('todas');
    this.filterAmenity.set('todas');
  }

  // Lista destacada para carrusel
  readonly featuredHospedajes = computed<Hospedaje[]>(() => {
    const list = this.hospedajesService.featuredHospedajes();
    if (list.length > 0) {
      return [...list, this.comingSoonHospedajes[0]];
    }
    return this.comingSoonHospedajes;
  });

  // Carrusel infinito con items destacados
  readonly infiniteFeaturedHospedajes = computed<CarouselHospedajeItem[]>(() => {
    const featured = this.featuredHospedajes();
    if (featured.length === 0) return [];
    const items: CarouselHospedajeItem[] = [];
    for (let cycle = 0; cycle < this.cycleRepetitions; cycle++) {
      for (let i = 0; i < featured.length; i++) {
        items.push({
          key: `cycle_${cycle}_h_${featured[i].id}_${i}`,
          cycleIndex: cycle,
          hospedaje: featured[i],
        });
      }
    }
    return items;
  });

  /** Alias para compatibilidad con tests unitarios existentes */
  readonly carouselItems = computed<CarouselHospedajeItem[]>(() => {
    return this.infiniteFeaturedHospedajes();
  });

  ngAfterViewInit(): void {
    this.startAutoplay();
  }

  ngOnDestroy(): void {
    this.stopAutoplay();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.selectedHospedaje()) {
      this.selectedHospedaje.set(null);
    }
  }

  scrollCarousel(direction: 'next' | 'prev'): void {
    const el = this.carouselRef?.nativeElement;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('.carousel-item');
    const step = (card?.offsetWidth || 340) + 20;
    el.scrollBy({
      left: direction === 'next' ? step : -step,
      behavior: 'smooth',
    });
  }

  onCarouselScroll(): void {
    // Scroll libre del usuario
  }

  onCarouselMouseEnter(): void {
    this.isPaused.set(true);
    this.stopAutoplay();
  }

  onCarouselMouseLeave(): void {
    this.isPaused.set(false);
    this.startAutoplay();
  }

  private startAutoplay(): void {
    if (this.autoplayTimer) return;
    this.autoplayTimer = setInterval(() => {
      if (!this.isPaused() && !this.selectedHospedaje()) {
        const el = this.carouselRef?.nativeElement;
        if (el) {
          if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 20) {
            el.scrollTo({ left: 0, behavior: 'smooth' });
          } else {
            this.scrollCarousel('next');
          }
        }
      }
    }, 4500);
  }

  private stopAutoplay(): void {
    if (this.autoplayTimer) {
      clearInterval(this.autoplayTimer);
      this.autoplayTimer = null;
    }
  }

  // Toggle de ficha técnica expandible
  toggleHospedajeDetails(hosp: Hospedaje): void {
    if (this.selectedHospedaje()?.id === hosp.id) {
      this.selectedHospedaje.set(null);
    } else {
      this.selectedHospedaje.set(hosp);
    }
  }

  closeHospedajeDetails(): void {
    this.selectedHospedaje.set(null);
  }

  /** Alias para compatibilidad de tests */
  openDetails(h: Hospedaje, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.selectedHospedaje.set(h);
  }

  closeDetails(): void {
    this.selectedHospedaje.set(null);
  }

  // Favoritos
  isFavorite(h: Hospedaje): boolean {
    return this._favoriteIds().has(h.id);
  }

  toggleFavorite(h: Hospedaje, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const current = new Set(this._favoriteIds());
    if (current.has(h.id)) {
      current.delete(h.id);
    } else {
      current.add(h.id);
    }
    this._favoriteIds.set(current);
    try {
      localStorage.setItem('experiencias_favorite_hospedajes', JSON.stringify(Array.from(current)));
    } catch {
      // Ignorar quota o storage error
    }
  }

  private loadFavoriteIds(): Set<string> {
    try {
      const raw = localStorage.getItem('experiencias_favorite_hospedajes');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch {
      // Fallback
    }
    return new Set<string>();
  }

  getWhatsAppUrl(hosp: Hospedaje): string {
    const raw = hosp.contactWhatsapp || hosp.hostPhone || '5493834112233';
    const phone = raw.replace(/[^0-9]/g, '');
    const text = encodeURIComponent(
      `¡Hola! Estoy interesado en consultar disponibilidad para hospedarme en *${hosp.title}* (${hosp.locality}) a través de Experiencias Club Catamarca.`
    );
    return `https://wa.me/${phone}?text=${text}`;
  }

  private normalizeText(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}
