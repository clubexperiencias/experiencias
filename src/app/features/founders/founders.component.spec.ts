import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FoundersComponent } from './founders.component';

describe('FoundersComponent (/fundadores)', () => {
  let component: FoundersComponent;
  let fixture: ComponentFixture<FoundersComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [FoundersComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(FoundersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and display main heading', () => {
    expect(component).toBeTruthy();
    const heading = fixture.nativeElement.querySelector('.card-heading');
    expect(heading).toBeTruthy();
    expect(heading.textContent).toContain('Carta de Postulación · Socio Fundador');
  });

  it('should display the 11 vacantes badge and circle tag', () => {
    const spots = fixture.nativeElement.querySelector('.founder-spots-pill');
    expect(spots).toBeTruthy();
    expect(spots.textContent).toContain('11 VACANTES 2026');

    const circleTag = fixture.nativeElement.querySelector('.founder-exclusive-tag');
    expect(circleTag).toBeTruthy();
    expect(circleTag.textContent).toContain('CÍRCULO VITALICIO EXCLUSIVO');
  });

  it('should submit founder application when valid form is provided', () => {
    component.founderName.set('Ignacio Balcarce');
    component.founderEmail.set('ignacio@fundador.com');
    component.founderLetter.set('Mi carta de motivación para el círculo vitalicio...');
    component.founderAgreedToPrice.set(true);

    component.submitFounder();
    fixture.detectChanges();

    expect(component.founderSuccess()).toBe(true);
    const successCard = fixture.nativeElement.querySelector('.founder-success-card');
    expect(successCard).toBeTruthy();
    expect(successCard.textContent).toContain('¡Carta de Admisión en Evaluación!');
  });

  it('should render breadcrumb with links to / and /socios and active Socio Fundador', () => {
    const breadcrumb = fixture.nativeElement.querySelector('.breadcrumb-bar');
    expect(breadcrumb).toBeTruthy();

    const links = breadcrumb.querySelectorAll('.bc-link');
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('routerlink') || links[0].getAttribute('href')).toBe('/');
    expect(links[1].getAttribute('routerlink') || links[1].getAttribute('href')).toBe('/socios');

    const current = breadcrumb.querySelector('.bc-current');
    expect(current).toBeTruthy();
    expect(current.textContent).toContain('Socio Fundador');
  });
});
