import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EmergingMemberComponent } from './emerging-member.component';

describe('EmergingMemberComponent (/socios/emergentes)', () => {
  let component: EmergingMemberComponent;
  let fixture: ComponentFixture<EmergingMemberComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [EmergingMemberComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(EmergingMemberComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and display main title and benefits', () => {
    expect(component).toBeTruthy();
    const heading = fixture.nativeElement.querySelector('.card-heading');
    expect(heading).toBeTruthy();
    expect(heading.textContent).toContain('Membresía Socio Emergente');

    const benefitCards = fixture.nativeElement.querySelectorAll('.benefit-card');
    expect(benefitCards.length).toBe(4);
  });

  it('should render breadcrumb with links to / and /socios and active Nivel 1: Emergentes', () => {
    const breadcrumb = fixture.nativeElement.querySelector('.breadcrumb-bar');
    expect(breadcrumb).toBeTruthy();

    const links = breadcrumb.querySelectorAll('.bc-link');
    const hrefs = Array.from(links).map(
      (l: any) => l.getAttribute('routerlink') || l.getAttribute('href'),
    );
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/socios');

    const current = breadcrumb.querySelector('.bc-current');
    expect(current).toBeTruthy();
    expect(current.textContent).toContain('Nivel 1: Emergentes');
  });

  it('should display ad banner linking to /experiencias/kayak', () => {
    const adLink = fixture.nativeElement.querySelector('.founder-ad-link');
    expect(adLink).toBeTruthy();
    expect(adLink.getAttribute('routerlink') || adLink.getAttribute('href')).toBe(
      '/experiencias/kayak',
    );
    const adImg = adLink.querySelector('img');
    expect(adImg).toBeTruthy();
    expect(adImg.getAttribute('src')).toContain('ad-kayak.png');
  });

  it('should not show google-link-gate when member is already confirmed', () => {
    // Simulate confirmed member
    component.fullName.set('Martín Rodríguez');
    component.email.set('martin@ejemplo.com');
    component.documentNumber.set('30123456');
    component.phone.set('+5493834123456');
    vi.spyOn(component.newsletter, 'isSubscribed').mockReturnValue(true);
    vi.spyOn(component.newsletter, 'currentMember').mockReturnValue({
      id: 'm-1',
      fullName: 'Martín Rodríguez',
      email: 'martin@ejemplo.com',
      dni: '30123456',
      phone: '+5493834123456',
      membershipTier: 'emergente',
      position: 100,
      active: true,
      createdAt: '2026-01-01',
    } as any);

    fixture.detectChanges();

    const confirmedBox = fixture.nativeElement.querySelector('.emerging-confirmed-box');
    expect(confirmedBox).toBeTruthy();

    const googleGate = fixture.nativeElement.querySelector('.google-link-gate');
    expect(googleGate).toBeNull();
  });
});
