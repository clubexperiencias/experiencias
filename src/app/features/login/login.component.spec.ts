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

  it('should redirect to /socios/emergentes when email was already in waitlist', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    await component.newsletter.recordWaitlistProspect('waitlist.test@experiencias.club');
    component.email.set('waitlist.test@experiencias.club');

    await component.submitLogin();
    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith(['/socios/emergentes'], {
      queryParams: { email: 'waitlist.test@experiencias.club', from: 'waitlist' },
    });
  });

  it('should inform user to sign in via Google if they already completed the Socio form', async () => {
    await component.newsletter.registerSocio({
      fullName: 'Socio Existente',
      email: 'socio.test@experiencias.club',
      dni: '30123456',
      phone: '3834123456',
    });
    component.newsletter.resetCurrentSubscription();

    component.email.set('socio.test@experiencias.club');
    await component.submitLogin();
    fixture.detectChanges();

    expect(component.error()).toContain('Google');
  });
});
