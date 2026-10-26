import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SubscriptionComponent } from './subscription.component';

describe('SubscriptionComponent (/socios/activos)', () => {
  let component: SubscriptionComponent;
  let fixture: ComponentFixture<SubscriptionComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [SubscriptionComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(SubscriptionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render breadcrumb with links to / and /socios and active Socio Activo', () => {
    const breadcrumb = fixture.nativeElement.querySelector('.breadcrumb-bar');
    expect(breadcrumb).toBeTruthy();

    const links = breadcrumb.querySelectorAll('.bc-link');
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('routerlink') || links[0].getAttribute('href')).toBe('/');
    expect(links[1].getAttribute('routerlink') || links[1].getAttribute('href')).toBe('/socios');

    const current = breadcrumb.querySelector('.bc-current');
    expect(current).toBeTruthy();
    expect(current.textContent).toContain('Socio Activo');
  });

  it('should create the component and display activation title when not active', () => {
    expect(component).toBeTruthy();
    const heading = fixture.nativeElement.querySelector('.section-main-title');
    expect(heading).toBeTruthy();
    expect(heading.textContent).toContain('Activar Suscripción Mensual');
  });

  it('should have Inicio button as the first item in the header nav', () => {
    const navLinks = fixture.nativeElement.querySelectorAll('.nav-actions > *');
    expect(navLinks.length).toBeGreaterThanOrEqual(1);
    const firstNav = navLinks[0];
    expect(firstNav.textContent).toContain('Inicio');
    expect(firstNav.getAttribute('routerlink') || firstNav.getAttribute('href')).toBe('/');
  });

  it('should activate monthly subscription and show management view', async () => {
    component.subscriberEmail.set('activo@experiencias.club');
    component.subscriberName.set('Constanza Gómez');
    component.setPaymentMethod('mercadopago');

    await component.submitSubscription();
    fixture.detectChanges();

    expect(component.newsletter.isMonthlyActive()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Gestión de Membresía Mensual');
  });

  it('should allow pausing and cancelling active subscription', async () => {
    await component.newsletter.activateMonthlySubscription({
      email: 'socio.activo@test.com',
      fullName: 'Lucas Puna'
    });
    fixture.detectChanges();

    expect(component.newsletter.isMonthlyActive()).toBe(true);

    component.pauseSubscription();
    fixture.detectChanges();
    expect(component.newsletter.activeSubscription()?.status).toBe('paused');

    component.cancelSubscription();
    fixture.detectChanges();
    expect(component.newsletter.activeSubscription()?.status).toBe('cancelled');
    expect(component.newsletter.isMonthlyActive()).toBe(false);
  });
});
