import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { LoginComponent } from './login.component';

describe('LoginComponent (/ingresar)', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create the component and display main heading', () => {
    expect(component).toBeTruthy();
    const heading = fixture.nativeElement.querySelector('.card-heading');
    expect(heading).toBeTruthy();
    expect(heading.textContent).toContain('Iniciar Sesión');
  });

  it('should render breadcrumb with yellow background linking to /', () => {
    const breadcrumb = fixture.nativeElement.querySelector('.breadcrumb-bar');
    expect(breadcrumb).toBeTruthy();

    const link = breadcrumb.querySelector('.bc-link');
    expect(link).toBeTruthy();
    expect(link.getAttribute('routerlink') || link.getAttribute('href')).toBe('/');

    const current = breadcrumb.querySelector('.bc-current');
    expect(current).toBeTruthy();
    expect(current.textContent).toContain('Iniciar Sesión');
  });

  it('should log in and navigate to /perfil when submitting valid email', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    component.email.set('socio.test@experiencias.club');

    await component.submitLogin();
    fixture.detectChanges();

    expect(component.newsletter.isSubscribed()).toBe(true);
    expect(navigateSpy).toHaveBeenCalledWith(['/perfil']);
  });
});
