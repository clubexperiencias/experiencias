import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ExperienceCardComponent } from './experience-card.component';
import { Experience } from '../../../core/models/experience.model';

describe('ExperienceCardComponent', () => {
  let component: ExperienceCardComponent;
  let fixture: ComponentFixture<ExperienceCardComponent>;

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
    highlights: ['Equipo incluido', 'Guía certificado'],
    included: ['Kayaks', 'Chaleco salvavidas'],
    providerName: 'Guía Dique',
    providerSlug: 'guia-dique',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExperienceCardComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ExperienceCardComponent);
    component = fixture.componentInstance;
    component.experience = mockExperience;
    fixture.detectChanges();
  });

  it('should create the component and render title, price, and region tag', () => {
    expect(component).toBeTruthy();
    const titleEl = fixture.nativeElement.querySelector('.exp-title');
    expect(titleEl.textContent).toContain('Kayak en el Dique');

    const regionEl = fixture.nativeElement.querySelector('.exp-region-tag');
    expect(regionEl.textContent).toContain('Valle Central');

    const priceEl = fixture.nativeElement.querySelector('.price-val');
    expect(priceEl.textContent).toContain('15.000');
  });

  it('should emit toggleDetails when clicking Saber Más', () => {
    const spy = vi.fn();
    component.toggleDetails.subscribe(spy);

    const btn = fixture.nativeElement.querySelector('.exp-toggle-details-btn');
    btn.click();

    expect(spy).toHaveBeenCalledWith(mockExperience);
  });

  it('should show technical details panel when isExpanded is true', () => {
    fixture.componentRef.setInput('isExpanded', true);
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.exp-details-panel');
    expect(panel).toBeTruthy();
    expect(panel.textContent).toContain('FICHA TÉCNICA Y PROTOCOLO');
    expect(panel.textContent).toContain('Equipo incluido');
  });

  it('should render locked button when experience isLocked is true', () => {
    fixture.componentRef.setInput('experience', {
      ...mockExperience,
      isLocked: true,
    });
    fixture.detectChanges();

    const lockedBtn = fixture.nativeElement.querySelector('.exp-locked-btn');
    expect(lockedBtn).toBeTruthy();
    expect(lockedBtn.textContent).toContain('Próximamente');
  });
});
