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
      providers: [provideRouter([{ path: 'ingresar', component: WaitlistComponent }])],
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

  it('should have a Convertirme en Prestador link in the footer pointing to /prestadores/emergentes', () => {
    const becomeProviderLink = fixture.nativeElement.querySelector('.footer-become-provider-btn') as HTMLElement;
    expect(becomeProviderLink).toBeTruthy();
    expect(
      becomeProviderLink.getAttribute('routerlink') || becomeProviderLink.getAttribute('href'),
    ).toBe('/prestadores/emergentes');
  });

  it('should show Iniciar Sesión button when not subscribed and link to /ingresar', () => {
    const loginBtn = fixture.nativeElement.querySelector('.login-nav-btn');
    expect(loginBtn).toBeTruthy();
    expect(loginBtn.textContent).toContain('Iniciar Sesión');
    expect(loginBtn.getAttribute('routerlink') || loginBtn.getAttribute('href')).toBe('/ingresar');
  });

  it('should show Mi Perfil in header and Cerrar Sesión in footer when subscribed', () => {
    (component.newsletter as any)._currentMember.set({
      email: 'socio@experiencias.club',
      fullName: 'Socio Test',
      dni: '30123456',
      phone: '3834123456',
      tier: 'emergente',
    });
    fixture.detectChanges();

    const profileBtn = fixture.nativeElement.querySelector('.profile-btn') as HTMLElement;
    expect(profileBtn).toBeTruthy();
    expect(profileBtn.textContent).toContain('Mi Perfil');

    const logoutBtn = fixture.nativeElement.querySelector('.footer-session-bar .logout-btn') as HTMLElement;
    expect(logoutBtn).toBeTruthy();
    expect(logoutBtn.textContent).toContain('Cerrar Sesión');

    logoutBtn.click();
    fixture.detectChanges();

    expect(component.newsletter.isSubscribed()).toBe(false);
  });

  it('should show Mi Perfil in mobile menu when subscribed', () => {
    (component.newsletter as any)._currentMember.set({
      email: 'socio@test.com',
      fullName: 'Socio Test',
      dni: '30123456',
      phone: '3834123456',
      tier: 'emergente',
    });
    fixture.detectChanges();

    component.mobileMenuOpen.set(true);
    fixture.detectChanges();

    const mobileProfileBtn = fixture.nativeElement.querySelector('.mobile-nav-panel .profile-cta-row') as HTMLElement;
    expect(mobileProfileBtn).toBeTruthy();
    expect(mobileProfileBtn.textContent).toContain('Mi Perfil');
  });
});
