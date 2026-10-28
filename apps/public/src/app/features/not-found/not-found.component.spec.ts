import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NotFoundComponent } from './not-found.component';

describe('NotFoundComponent (404)', () => {
  let component: NotFoundComponent;
  let fixture: ComponentFixture<NotFoundComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [NotFoundComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(NotFoundComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and display 404 visual number and heading', () => {
    expect(component).toBeTruthy();
    const visualNum = fixture.nativeElement.querySelector('.error-visual-number');
    expect(visualNum).toBeTruthy();
    expect(visualNum.textContent).toContain('404');

    const heading = fixture.nativeElement.querySelector('.card-heading');
    expect(heading).toBeTruthy();
    expect(heading.textContent).toContain('Esta senda no conduce a ninguna expedición');
  });

  it('should render breadcrumb with links to root /', () => {
    const breadcrumb = fixture.nativeElement.querySelector('.breadcrumb-bar');
    expect(breadcrumb).toBeTruthy();

    const link = breadcrumb.querySelector('.bc-link');
    expect(link).toBeTruthy();
    expect(link.getAttribute('routerlink') || link.getAttribute('href')).toBe('/');

    const current = breadcrumb.querySelector('.bc-current');
    expect(current).toBeTruthy();
    expect(current.textContent).toContain('Página no encontrada');
  });

  it('should link back to root / from primary CTA button with text Volver al inicio', () => {
    const primaryCta = fixture.nativeElement.querySelector('.cta-primary-btn');
    expect(primaryCta).toBeTruthy();
    expect(primaryCta.textContent).toContain('Volver al inicio');
    expect(primaryCta.getAttribute('routerlink') || primaryCta.getAttribute('href')).toBe('/');
  });

  it('should not render alternative route pills', () => {
    const pills = fixture.nativeElement.querySelectorAll('.route-pill-btn');
    expect(pills.length).toBe(0);
  });
});
