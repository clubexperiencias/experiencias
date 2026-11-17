import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [provideRouter([{ path: 'perfil', component: HeaderComponent }])],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and render brand link', () => {
    expect(component).toBeTruthy();
    const brandLink = fixture.nativeElement.querySelector('.brand');
    expect(brandLink).toBeTruthy();
    expect(brandLink.getAttribute('routerlink') || brandLink.getAttribute('href')).toBe('/');
  });

  it('should display Iniciar Sesión button linking to /ingresar when user is not subscribed', () => {
    const loginBtn = fixture.nativeElement.querySelector('.login-nav-btn');
    expect(loginBtn).toBeTruthy();
    expect(loginBtn.textContent).toContain('Iniciar Sesión');
    expect(loginBtn.getAttribute('routerlink') || loginBtn.getAttribute('href')).toBe('/ingresar');
  });

  it('should display Mi Perfil button when user is subscribed', async () => {
    (component.newsletter as any)._currentMember.set({
      id: 'socio-1',
      email: 'socio@experiencias.club',
      fullName: 'Socio Test',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    });
    fixture.detectChanges();

    const profileBtn = fixture.nativeElement.querySelector('.profile-btn');
    expect(profileBtn).toBeTruthy();
    expect(profileBtn.textContent).toContain('Mi Perfil');
  });

  it('should toggle mobile menu', () => {
    expect(component.mobileMenuOpen()).toBe(false);
    component.toggleMobileMenu();
    expect(component.mobileMenuOpen()).toBe(true);
    component.closeMobileMenu();
    expect(component.mobileMenuOpen()).toBe(false);
  });

  it('should render toast notification with yellow Ver Favoritos button when an experience is removed from favorites', () => {
    component.favoritesService.showToast({
      title: 'Trekking Laguna Blanca',
      slug: 'trekking-laguna-blanca',
      action: 'removed',
    });
    fixture.detectChanges();

    const toast = fixture.nativeElement.querySelector('.fav-toast-banner');
    expect(toast).toBeTruthy();
    expect(toast.classList.contains('is-removed-toast')).toBe(true);

    const heading = toast.querySelector('.fav-toast-heading');
    expect(heading.textContent).toContain('¡Quitada de tus favoritos!');

    const text = toast.querySelector('.fav-toast-text');
    expect(text.textContent).toContain('Quitaste "Trekking Laguna Blanca" de tus actividades preferidas.');

    const btn = toast.querySelector('.fav-toast-btn');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Ver Favoritos');

    btn.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.fav-toast-banner')).toBeFalsy();
  });
});
