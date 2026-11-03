import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ActivityDetailComponent } from './activity-detail.component';
import { ActivityHistoryService } from '../../../core/services/activity-history.service';
import { NewsletterService } from '../../../core/services/newsletter.service';

describe('ActivityDetailComponent (/perfil/actividades/:slug)', () => {
  let component: ActivityDetailComponent;
  let fixture: ComponentFixture<ActivityDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActivityDetailComponent],
      providers: [
        provideRouter([]),
        ActivityHistoryService,
        NewsletterService,
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({
              get: (key: string) => (key === 'slug' ? 'kayak-las-jumeal' : null),
            }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ActivityDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and load the requested activity', () => {
    expect(component).toBeTruthy();
    expect(component.activity()).toBeDefined();
    expect(component.activity()?.title).toContain('Travesía en Kayak');
  });

  it('should display the official payment receipt info', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Comprobante Oficial de Pago');
    expect(el.textContent).toContain('REC-2026-CAT-0104');
    expect(el.textContent).toContain('$65.000 ARS');
  });
});
