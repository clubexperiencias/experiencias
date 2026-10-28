import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { KayakExperienceComponent } from './kayak-experience.component';

describe('KayakExperienceComponent (/experiencias/kayak)', () => {
  let component: KayakExperienceComponent;
  let fixture: ComponentFixture<KayakExperienceComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [KayakExperienceComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(KayakExperienceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and display main heading', () => {
    expect(component).toBeTruthy();
    const heading = fixture.nativeElement.querySelector('.card-heading');
    expect(heading).toBeTruthy();
    expect(heading.textContent).toContain('Travesía en Kayak & Sunset en Las Pirquitas');
  });

  it('should render breadcrumb with links to / and /experiencias', () => {
    const breadcrumb = fixture.nativeElement.querySelector('.breadcrumb-bar');
    expect(breadcrumb).toBeTruthy();

    const links = breadcrumb.querySelectorAll('.bc-link');
    const hrefs = Array.from(links).map((l: any) => l.getAttribute('routerlink') || l.getAttribute('href'));
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/experiencias');

    const current = breadcrumb.querySelector('.bc-current');
    expect(current).toBeTruthy();
    expect(current.textContent).toContain('Travesía en Kayak');
  });

  it('should display the pricing and blocked CTA to pay experience', () => {
    const primaryCta = fixture.nativeElement.querySelector('.cta-primary-btn');
    expect(primaryCta).toBeTruthy();
    expect(primaryCta.textContent).toContain('Pagar Experiencia');
    expect(primaryCta.hasAttribute('disabled')).toBe(true);

    const arsPrice = fixture.nativeElement.querySelector('.ars-price');
    expect(arsPrice).toBeTruthy();
    expect(arsPrice.textContent).toContain('$65.000 ARS');
  });

  it('should display buttons for Google Maps and photos gallery in location section', () => {
    const mapsBtn = fixture.nativeElement.querySelector('.maps-btn');
    expect(mapsBtn).toBeTruthy();
    expect(mapsBtn.getAttribute('href')).toContain('maps.google.com');

    const galleryBtn = fixture.nativeElement.querySelector('.gallery-btn');
    expect(galleryBtn).toBeTruthy();
    expect(galleryBtn.getAttribute('routerlink') || galleryBtn.getAttribute('href')).toBe('/experiencias/kayak/fotos');
  });
});
