import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [provideRouter([{ path: 'ingresar', component: ProfileComponent }])]
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should display the green registration success notification replacing breadcrumb', () => {
    const notification = fixture.nativeElement.querySelector('.registration-success-bar');
    expect(notification).toBeTruthy();
    expect(notification.textContent).toContain('¡REGISTRO EXITOSO!');
    expect(notification.textContent).toContain('Socio Emergente');
  });

  it('should display the membership info box with activation link', () => {
    const card = fixture.nativeElement.querySelector('.profile-completion-card');
    expect(card).toBeTruthy();
    expect(card.textContent).toContain('DATOS DE MEMBRESÍA');
    expect(card.textContent).toContain('Socio Emergente');
    const link = card.querySelector('.upgrade-membership-link');
    expect(link).toBeTruthy();
    expect(link.getAttribute('routerLink')).toBe('/socios/activos');
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

  it('should have a logout button that resets current subscription', async () => {
    await component.newsletter.joinWaitlist({ email: 'perfil@test.com' });
    fixture.detectChanges();

    const logoutBtn = fixture.nativeElement.querySelector('.logout-btn') as HTMLElement;
    expect(logoutBtn).toBeTruthy();
    expect(logoutBtn.textContent).toContain('Cerrar Sesión');

    logoutBtn.click();
    fixture.detectChanges();

    expect(component.newsletter.isSubscribed()).toBe(false);
  });
});
