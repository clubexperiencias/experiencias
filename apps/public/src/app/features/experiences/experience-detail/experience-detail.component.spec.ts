import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ExperienceDetailComponent } from './experience-detail.component';

describe('ExperienceDetailComponent (/experiencias/:slug)', () => {
  let component: ExperienceDetailComponent;
  let fixture: ComponentFixture<ExperienceDetailComponent>;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    await TestBed.configureTestingModule({
      imports: [ExperienceDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => 'kayak' } },
            paramMap: of({ get: () => 'kayak' }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExperienceDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and display experience heading', () => {
    expect(component).toBeTruthy();
    expect(component.exp()).toBeTruthy();
    const heading = fixture.nativeElement.querySelector('.card-heading');
    expect(heading).toBeTruthy();
    expect(heading.textContent).toContain('Travesía en Kayak');
  });

  it('should generate breadcrumb items for the experience', () => {
    const crumbs = component.breadcrumbs();
    expect(crumbs.length).toBe(3);
    expect(crumbs[0].url).toBe('/');
    expect(crumbs[1].url).toBe('/experiencias');
    expect(crumbs[2].label).toContain('Kayak');
  });

  it('should link to payment route for this experience', () => {
    expect(component.paymentRoute()).toBe('/experiencias/kayak/pago');
    const payBtns = fixture.nativeElement.querySelectorAll('.cta-blue-btn');
    expect(payBtns.length).toBeGreaterThan(0);
  });
});
