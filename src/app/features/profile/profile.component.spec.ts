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

  it('should display the green registration success notification replacing breadcrumb when logging in', () => {
    component.newsletter.setLoginSuccessFlag();
    component.ngOnInit();
    fixture.detectChanges();

    const notification = fixture.nativeElement.querySelector('.registration-success-bar');
    expect(notification).toBeTruthy();
    expect(notification.textContent).toContain('¡PERFIL DE SOCIO REGISTRADO CON ÉXITO!');
    expect(notification.textContent).toContain('Socio Emergente');
    expect(component.newsletter.profileSuccessHighlight()).toBe(true);
  });

  it('should NOT display the green registration success notification when navigating normally via breadcrumb', () => {
    // Normal navigation: login flag was not set
    const notification = fixture.nativeElement.querySelector('.registration-success-bar');
    expect(notification).toBeFalsy();
    const breadcrumb = fixture.nativeElement.querySelector('.breadcrumb-bar');
    expect(breadcrumb).toBeTruthy();
  });

  it('should only show the last 2 activities in profile preview and link to full history', () => {
    const cards = fixture.nativeElement.querySelectorAll('.activities-list .activity-card');
    expect(cards.length).toBeLessThanOrEqual(2);

    const viewAllBtn = fixture.nativeElement.querySelector('.btn-view-all-activities');
    expect(viewAllBtn).toBeTruthy();
    expect(viewAllBtn.getAttribute('routerlink')).toBe('/perfil/actividades');
  });

  it('should display the membership info box with updated cupo text', () => {
    const card = fixture.nativeElement.querySelector('.profile-completion-card');
    expect(card).toBeTruthy();
    expect(card.textContent).toContain('DATOS DE MEMBRESÍA');
    expect(card.textContent).toContain('Socio Emergente');
    expect(card.textContent).toContain('Priorizaremos tu cupo según qué expediciones realices y qué tan completo tengas tu perfil.');
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
