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

  it('should render breadcrumb with links to / and /socios and active Socios Emergentes', () => {
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
    expect(current.textContent).toContain('Socios Emergentes');
  });

  it('should display ad banner linking to /socios/fundadores', () => {
    const adLink = fixture.nativeElement.querySelector('.ad-banner-link');
    expect(adLink).toBeTruthy();
    expect(adLink.getAttribute('routerlink') || adLink.getAttribute('href')).toBe(
      '/socios/fundadores',
    );
    const adImg = adLink.querySelector('img');
    expect(adImg).toBeTruthy();
    expect(adImg.getAttribute('src')).toContain('ad.png');
  });
});
