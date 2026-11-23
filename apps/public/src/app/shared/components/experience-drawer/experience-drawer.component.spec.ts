import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ExperienceDrawerComponent } from './experience-drawer.component';
import { Experience } from '../../../core/models/experience.model';

describe('ExperienceDrawerComponent', () => {
  let component: ExperienceDrawerComponent;
  let fixture: ComponentFixture<ExperienceDrawerComponent>;

  const mockExperience: Experience = {
    id: 'exp-test-1',
    title: 'Kayak en el Dique',
    slug: 'kayak-en-el-dique',
    tagline: 'Aventura acuática increíble',
    description: 'Remando en aguas calmas rodeado de cerros.',
    region: 'Valle Central',
    coverImage: '/assets/images/kayak.jpg',
    durationLabel: 'Medio día',
    durationDays: 1,
    altitudeMeters: 800,
    maxSpotsPerGroup: 10,
    galleryImages: [],
    isExclusiveClub: false,
    difficulty: 'Baja',
    priceArs: 15000,
    priceUsd: 20,
    status: 'publicada',
    itinerary: 'Punto de encuentro: Club Náutico. Remada hasta la isla.',
    highlights: ['Equipo incluido', 'Guía certificado'],
    included: ['Kayaks', 'Chaleco salvavidas'],
    providerName: 'Guía Dique',
    providerSlug: 'guia-dique',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExperienceDrawerComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ExperienceDrawerComponent);
    component = fixture.componentInstance;
    component.experience = mockExperience;
    fixture.detectChanges();
  });

  it('should create the component and render title, description, and highlights', () => {
    expect(component).toBeTruthy();
    const titleEl = fixture.nativeElement.querySelector('.lateral-title');
    expect(titleEl.textContent).toContain('Kayak en el Dique');

    const descEl = fixture.nativeElement.querySelector('.details-desc');
    expect(descEl.textContent).toContain('Remando en aguas calmas');

    const highlights = fixture.nativeElement.querySelectorAll('.highlights-list li');
    expect(highlights.length).toBe(2);
    expect(highlights[0].textContent).toContain('Equipo incluido');
  });

  it('should render correct kicker text based on direction', () => {
    component.direction = 'right';
    expect(component.kickerText).toContain('FICHA TÉCNICA Y RECORRIDO →');

    component.direction = 'left';
    expect(component.kickerText).toContain('← FICHA TÉCNICA Y RECORRIDO');
  });

  it('should switch between details and itinerary tabs', () => {
    const tabButtons = fixture.nativeElement.querySelectorAll('.drawer-tab-btn');
    expect(tabButtons.length).toBe(2);

    // Click itinerary tab
    tabButtons[1].click();
    fixture.detectChanges();

    expect(component.activeTab()).toBe('itinerary');
    const itineraryText = fixture.nativeElement.querySelector('.itinerary-text');
    expect(itineraryText.textContent).toContain('Club Náutico');

    // Click details tab
    tabButtons[0].click();
    fixture.detectChanges();

    expect(component.activeTab()).toBe('details');
  });

  it('should emit close event when clicking close button', () => {
    const spy = vi.fn();
    component.close.subscribe(spy);

    const closeBtn = fixture.nativeElement.querySelector('.close-details-pill');
    closeBtn.click();

    expect(spy).toHaveBeenCalled();
  });

  it('should render link to full fiche if showFullFicheLink is true', () => {
    const ficheLink = fixture.nativeElement.querySelector('.drawer-fiche-link');
    expect(ficheLink).toBeTruthy();
    expect(ficheLink.getAttribute('href')).toContain('/experiencias/kayak-en-el-dique');
  });
});

