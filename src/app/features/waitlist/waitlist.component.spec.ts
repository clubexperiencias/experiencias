import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WaitlistComponent } from './waitlist.component';

describe('WaitlistComponent All Desktop Modals & Navigation', () => {
  let component: WaitlistComponent;
  let fixture: ComponentFixture<WaitlistComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [WaitlistComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(WaitlistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should open tiers modal when clicking Niveles de Socio', () => {
    const navButtons = fixture.nativeElement.querySelectorAll('.nav-actions > .nav-pill-btn');
    navButtons[0].click(); // Niveles de Socio
    fixture.detectChanges();

    expect(component.activeModal()).toBe('tiers');
    expect(fixture.nativeElement.querySelector('.modal-backdrop')).toBeTruthy();
  });

  it('should open experiences modal when clicking Experiencias', () => {
    const navButtons = fixture.nativeElement.querySelectorAll('.nav-actions > .nav-pill-btn');
    navButtons[1].click(); // Experiencias
    fixture.detectChanges();

    expect(component.activeModal()).toBe('experiences');
    expect(fixture.nativeElement.querySelector('.modal-backdrop')).toBeTruthy();
  });

  it('should open providers modal when clicking Prestadores & Guías', () => {
    const navButtons = fixture.nativeElement.querySelectorAll('.nav-actions > .nav-pill-btn');
    navButtons[2].click(); // Prestadores & Guías
    fixture.detectChanges();

    expect(component.activeModal()).toBe('providers');
    expect(fixture.nativeElement.querySelector('.modal-backdrop')).toBeTruthy();
  });

  it('should show Iniciar Sesión button when not subscribed and open login modal', () => {
    const loginBtn = fixture.nativeElement.querySelector('.login-nav-btn');
    expect(loginBtn).toBeTruthy();
    expect(loginBtn.textContent).toContain('Iniciar Sesión');

    loginBtn.click();
    fixture.detectChanges();

    expect(component.activeModal()).toBe('login');
    expect(fixture.nativeElement.querySelector('.modal-backdrop')).toBeTruthy();
  });

  it('should show Perfil button when subscribed and link directly to /perfil without dropdown', async () => {
    await component.newsletter.joinWaitlist({ email: 'socio@experiencias.club' });
    fixture.detectChanges();

    const profileBtn = fixture.nativeElement.querySelector('.profile-btn');
    expect(profileBtn).toBeTruthy();
    expect(profileBtn.textContent).toContain('Perfil');
    expect(profileBtn.getAttribute('routerlink') || profileBtn.getAttribute('href')).toBe('/perfil');
    expect(fixture.nativeElement.querySelector('.profile-dropdown-menu')).toBeFalsy();
  });

  it('should allow user to logout from mobile menu', async () => {
    await component.newsletter.joinWaitlist({ email: 'socio@test.com' });
    fixture.detectChanges();

    component.mobileMenuOpen.set(true);
    fixture.detectChanges();

    const logoutBtn = fixture.nativeElement.querySelector('.logout-row') as HTMLElement;
    expect(logoutBtn).toBeTruthy();
    expect(logoutBtn.textContent).toContain('Cerrar Sesión');

    logoutBtn.click();
    fixture.detectChanges();

    expect(component.newsletter.isSubscribed()).toBe(false);
    expect(fixture.nativeElement.querySelector('.login-nav-btn')).toBeTruthy();
  });
});
