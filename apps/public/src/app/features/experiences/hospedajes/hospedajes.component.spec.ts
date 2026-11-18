import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HospedajesComponent } from './hospedajes.component';
import { Hospedaje } from '../../../core/models/hospedaje.model';

const MOCK_HOSPEDAJE: Hospedaje = {
  id: 'hosp-test-1',
  slug: 'hosteria-el-penon',
  title: 'Hostería El Peñón',
  tagline: 'Base para Campo de Piedra Pómez',
  description: 'Alojamiento de montaña en la Puna catamarqueña.',
  type: 'Hostería de Altura',
  region: 'Puna de Atacama',
  locality: 'El Peñón',
  altitudeMeters: 3400,
  coverImage: '/assets/images/catamarca_pomez.jpg',
  galleryImages: ['/assets/images/catamarca_pomez.jpg'],
  priceArsPerNight: 85000,
  priceUsdPerNight: 60,
  capacityPerRoom: 3,
  totalRooms: 12,
  amenities: ['WiFi Satelital Starlink', 'Calefacción tiro balanceado'],
  hostName: 'Patricio Díaz',
  hostAgency: 'Comunidad Puneña',
  hostPhone: '+54 9 3834 11-2233',
  isFeatured: true,
  isVerified: true,
  isLocked: false,
  highlights: ['Ubicación clave'],
  includedServices: ['Desayuno regional'],
};

describe('HospedajesComponent (/experiencias/hospedajes)', () => {
  let component: HospedajesComponent;
  let fixture: ComponentFixture<HospedajesComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HospedajesComponent],
      providers: [provideRouter([{ path: '**', children: [] }])],
    }).compileComponents();

    fixture = TestBed.createComponent(HospedajesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create the component and render hero section with Catamarca lodging title', () => {
    expect(component).toBeTruthy();
    const heading = fixture.nativeElement.querySelector('.section-main-title');
    expect(heading).toBeTruthy();
    expect(heading.textContent).toContain('Hosterías, Cabañas & Refugios');
  });

  it('should render the subroute navigation tabs linking to /experiencias and /experiencias/hospedajes', () => {
    const tabs = fixture.nativeElement.querySelectorAll('.subroute-tab');
    expect(tabs.length).toBeGreaterThanOrEqual(2);
    const activeTab = fixture.nativeElement.querySelector('.subroute-tab.is-active');
    expect(activeTab).toBeTruthy();
    expect(activeTab.textContent).toContain('Hospedajes & Refugios');
  });

  it('should display coming soon lodgings (Nueva experiencia en Catamarca) in the carousel when no active items', () => {
    const carouselCards = fixture.nativeElement.querySelectorAll('.hosp-carousel-card');
    expect(carouselCards.length).toBeGreaterThan(0);
    expect(carouselCards[0].textContent).toContain('Nueva experiencia en Catamarca');
  });

  it('should render coming soon cards when no active filters and catalog has no DB items', () => {
    const list = fixture.nativeElement.querySelector('.experiences-horizontal-list');
    expect(list).toBeTruthy();
    const cards = list.querySelectorAll('.exp-catalog-item');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].textContent).toContain('Nueva experiencia en Catamarca');
  });

  it('should filter lodgings by region when lodgings are loaded', () => {
    component.hospedajesService.setHospedajes([
      MOCK_HOSPEDAJE,
      {
        ...MOCK_HOSPEDAJE,
        id: 'hosp-test-2',
        slug: 'cabanas-valle',
        title: 'Cabañas del Valle',
        region: 'Valle Central',
        type: 'Eco-Lodge & Cabaña',
      },
    ]);
    fixture.detectChanges();

    component.filterRegion.set('Puna de Atacama');
    fixture.detectChanges();

    const filtered = component.filteredHospedajes();
    expect(filtered.length).toBe(1);
    expect(filtered[0].region).toBe('Puna de Atacama');

    // Matches with surrounding whitespace
    component.filterRegion.set('  Puna de Atacama  ');
    expect(component.filteredHospedajes().length).toBe(1);
  });

  it('should filter lodgings by type', () => {
    component.hospedajesService.setHospedajes([
      MOCK_HOSPEDAJE,
      {
        ...MOCK_HOSPEDAJE,
        id: 'hosp-test-2',
        slug: 'cabanas-valle',
        title: 'Cabañas del Valle',
        type: 'Eco-Lodge & Cabaña',
      },
    ]);
    fixture.detectChanges();

    component.filterType.set('Hostería de Altura');
    fixture.detectChanges();

    const filtered = component.filteredHospedajes();
    expect(filtered.length).toBe(1);
    expect(filtered[0].type).toBe('Hostería de Altura');
  });

  it('should filter lodgings by search term', () => {
    component.hospedajesService.setHospedajes([MOCK_HOSPEDAJE]);
    fixture.detectChanges();

    component.searchTerm.set('Peñón');
    fixture.detectChanges();

    const filtered = component.filteredHospedajes();
    expect(filtered.length).toBe(1);
    expect(filtered[0].title).toContain('Peñón');
  });

  it('should toggle favorites and persist to localStorage', () => {
    const sampleHosp = MOCK_HOSPEDAJE;
    expect(component.isFavorite(sampleHosp)).toBe(false);

    component.toggleFavorite(sampleHosp);
    expect(component.isFavorite(sampleHosp)).toBe(true);

    const stored = JSON.parse(localStorage.getItem('experiencias_favorite_hospedajes') || '[]');
    expect(stored).toContain(sampleHosp.id);

    component.toggleFavorite(sampleHosp);
    expect(component.isFavorite(sampleHosp)).toBe(false);
  });

  it('should generate a valid WhatsApp inquiry URL with lodging info', () => {
    const sampleHosp = MOCK_HOSPEDAJE;
    const url = component.getWhatsAppUrl(sampleHosp);
    expect(url).toContain('https://wa.me/');
    expect(url).toContain(encodeURIComponent(sampleHosp.title));
  });

  it('should reset filters when clicking reset button', () => {
    component.searchTerm.set('test');
    component.filterRegion.set('Puna de Atacama');
    component.filterType.set('Refugio Puneño');
    component.filterAmenity.set('WiFi Satelital Starlink');

    expect(component.hasActiveFilters()).toBe(true);

    component.resetFilters();

    expect(component.searchTerm()).toBe('');
    expect(component.filterRegion()).toBe('todas');
    expect(component.filterType()).toBe('todos');
    expect(component.filterAmenity()).toBe('todas');
    expect(component.hasActiveFilters()).toBe(false);
  });
});
