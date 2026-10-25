import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WaitlistComponent } from './waitlist.component';

describe('WaitlistComponent All Desktop Modals', () => {
  let component: WaitlistComponent;
  let fixture: ComponentFixture<WaitlistComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WaitlistComponent],
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

  it('should open history modal when clicking Historial & Recibos in Profile dropdown', () => {
    const profileBtn = fixture.nativeElement.querySelector('.profile-btn');
    profileBtn.click();
    fixture.detectChanges();

    const historyBtn = fixture.nativeElement.querySelectorAll('.dropdown-item')[0];
    historyBtn.click();
    fixture.detectChanges();

    expect(component.activeModal()).toBe('history');
    expect(fixture.nativeElement.querySelector('.modal-backdrop')).toBeTruthy();
  });

  it('should open payments modal when clicking Pasarelas de Pago in Profile dropdown', () => {
    const profileBtn = fixture.nativeElement.querySelector('.profile-btn');
    profileBtn.click();
    fixture.detectChanges();

    const paymentsBtn = fixture.nativeElement.querySelectorAll('.dropdown-item')[1];
    paymentsBtn.click();
    fixture.detectChanges();

    expect(component.activeModal()).toBe('payments');
    expect(fixture.nativeElement.querySelector('.modal-backdrop')).toBeTruthy();
  });
});
