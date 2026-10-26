import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should display the current member status banner', () => {
    const banner = fixture.nativeElement.querySelector('.current-status-banner');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('ESTADO ACTUAL');
    expect(banner.textContent).toContain('Socio Emergente');
  });

  it('should link back to root / from the header logo', () => {
    const brandLink = fixture.nativeElement.querySelector('.brand');
    expect(brandLink.getAttribute('routerlink') || brandLink.getAttribute('href')).toBe('/');
  });

  it('should have an Inicio button in the header pointing to root /', () => {
    const homeBtn = fixture.nativeElement.querySelector('.home-header-btn');
    expect(homeBtn).toBeTruthy();
    expect(homeBtn.textContent).toContain('Inicio');
    expect(homeBtn.getAttribute('routerlink') || homeBtn.getAttribute('href')).toBe('/');
  });

  it('should have a logout button that resets current subscription', () => {
    component.newsletter.joinWaitlist({ email: 'perfil@test.com' });
    fixture.detectChanges();

    const profileBtn = fixture.nativeElement.querySelector('.profile-btn') as HTMLElement;
    if (profileBtn) {
      profileBtn.click();
      fixture.detectChanges();
    }

    const logoutBtn = fixture.nativeElement.querySelector('.logout-btn') as HTMLElement;
    expect(logoutBtn).toBeTruthy();
    expect(logoutBtn.textContent).toContain('Cerrar Sesión');

    logoutBtn.click();
    fixture.detectChanges();

    expect(component.newsletter.isSubscribed()).toBe(false);
  });
});
