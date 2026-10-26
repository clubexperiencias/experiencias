import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MembersComponent } from './members.component';

describe('MembersComponent (/socios)', () => {
  let component: MembersComponent;
  let fixture: ComponentFixture<MembersComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [MembersComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(MembersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and display main title and 3 tiers', () => {
    expect(component).toBeTruthy();
    const heading = fixture.nativeElement.querySelector('.section-main-title');
    expect(heading).toBeTruthy();
    expect(heading.textContent).toContain('Niveles de Socio del Club');

    const tiers = fixture.nativeElement.querySelectorAll('.tier-card');
    expect(tiers.length).toBe(3);
  });

  it('should link to /socios/fundadores from the founder tier CTA button', () => {
    const founderBtn = fixture.nativeElement.querySelector('.founder-cta');
    expect(founderBtn).toBeTruthy();
    expect(founderBtn.getAttribute('routerlink') || founderBtn.getAttribute('href')).toBe('/socios/fundadores');
  });

  it('should link back to root / from the logo', () => {
    const brandLink = fixture.nativeElement.querySelector('.brand');
    expect(brandLink.getAttribute('routerlink') || brandLink.getAttribute('href')).toBe('/');
  });

  it('should link to /experiencias in the desktop nav and not include Prestadores', () => {
    const navLinks = fixture.nativeElement.querySelectorAll('.nav-actions a');
    const hrefs = Array.from(navLinks).map((a: any) => a.getAttribute('routerlink') || a.getAttribute('href'));
    expect(hrefs).toContain('/experiencias');
    expect(hrefs).not.toContain('/prestadores');
  });
});
