import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProvidersComponent } from './providers.component';

describe('ProvidersComponent', () => {
  let component: ProvidersComponent;
  let fixture: ComponentFixture<ProvidersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProvidersComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ProvidersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and display main heading', () => {
    expect(component).toBeTruthy();
    const heading = fixture.nativeElement.querySelector('.section-main-title');
    expect(heading).toBeTruthy();
    expect(heading.textContent).toContain('Sé Parte del Club de Experiencias');
  });

  it('should not contain Panel de Gestión in the benefits', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('Panel de Gestión');
  });

  it('should link back to root / from the header logo', () => {
    const brandLink = fixture.nativeElement.querySelector('.brand');
    expect(brandLink.getAttribute('routerlink') || brandLink.getAttribute('href')).toBe('/');
  });

  it('should allow submitting provider registration', () => {
    component.providerName.set('Carlos Guía');
    component.providerEmail.set('carlos@catamarca.com');
    component.submitProvider();
    fixture.detectChanges();

    expect(component.providerSuccess()).toBe(true);
    const successBanner = fixture.nativeElement.querySelector('.provider-success-banner');
    expect(successBanner).toBeTruthy();
  });

  it('should open the exact tiers modal from waitlist when clicking Niveles de Socio', () => {
    component.openModal('tiers');
    fixture.detectChanges();

    const tiersGrid = fixture.nativeElement.querySelector('.tiers-grid');
    expect(tiersGrid).toBeTruthy();
    expect(tiersGrid.textContent).toContain('Socio Emergente');
    expect(tiersGrid.textContent).toContain('Socio Pleno');
    expect(tiersGrid.textContent).toContain('Socio Fundador');
  });

  it('should render website or social media field in provider form', () => {
    const websiteInput = fixture.nativeElement.querySelector('#p-page-website');
    expect(websiteInput).toBeTruthy();
  });

  it('should render breadcrumb linking to / and /experiencias and active Prestadores & Guías', () => {
    const breadcrumb = fixture.nativeElement.querySelector('.breadcrumb-bar');
    expect(breadcrumb).toBeTruthy();

    const links = breadcrumb.querySelectorAll('.bc-link');
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('routerlink') || links[0].getAttribute('href')).toBe('/');
    expect(links[1].getAttribute('routerlink') || links[1].getAttribute('href')).toBe(
      '/experiencias',
    );

    const current = breadcrumb.querySelector('.bc-current');
    expect(current).toBeTruthy();
    expect(current.textContent).toContain('Prestadores & Guías');
  });
});
