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
      providers: [provideRouter([])]
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
    await component.newsletter.joinWaitlist({ email: 'socio@experiencias.club' });
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
});
