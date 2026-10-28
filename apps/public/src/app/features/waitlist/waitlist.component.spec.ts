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

  it('should link to /socios when clicking Niveles de Socio', () => {
    const sociosBtn = fixture.nativeElement.querySelector('.socios-nav-btn');
    expect(sociosBtn).toBeTruthy();
    expect(sociosBtn.getAttribute('routerlink') || sociosBtn.getAttribute('href')).toBe('/socios');
  });

  it('should link to /experiencias when clicking Experiencias', () => {
    const expBtn = fixture.nativeElement.querySelector('.exp-nav-btn');
    expect(expBtn).toBeTruthy();
    expect(expBtn.getAttribute('routerlink') || expBtn.getAttribute('href')).toBe('/experiencias');
  });

  it('should have a Convertirme en Prestador link in the footer pointing to /experiencias/prestadores', () => {
    const providerLink = fixture.nativeElement.querySelector('.footer-provider-link');
    expect(providerLink).toBeTruthy();
    expect(providerLink.textContent).toContain('Convertirme en Prestador');
    expect(providerLink.getAttribute('routerlink') || providerLink.getAttribute('href')).toBe('/experiencias/prestadores');
  });

  it('should show Iniciar Sesión button when not subscribed and link to /ingresar', () => {
    const loginBtn = fixture.nativeElement.querySelector('.login-nav-btn');
    expect(loginBtn).toBeTruthy();
    expect(loginBtn.textContent).toContain('Iniciar Sesión');
    expect(loginBtn.getAttribute('routerlink') || loginBtn.getAttribute('href')).toBe('/ingresar');
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
