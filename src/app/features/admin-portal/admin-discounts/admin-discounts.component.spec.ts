import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AdminDiscountsComponent } from './admin-discounts.component';
import { DiscountService } from '../../../core/services/discount.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { AdminStoreService } from '../../../core/services/admin-store.service';
import { signal } from '@angular/core';

describe('AdminDiscountsComponent', () => {
  let component: AdminDiscountsComponent;
  let fixture: ComponentFixture<AdminDiscountsComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDiscountsComponent],
      providers: [
        provideRouter([]),
        {
          provide: DiscountService,
          useValue: {
            discounts: signal([]),
            toggleDiscountActive: async () => true,
            deleteDiscount: async () => true,
          },
        },
        {
          provide: ExperienceService,
          useValue: {
            publishedExperiences: signal([]),
          },
        },
        {
          provide: AdminStoreService,
          useValue: {
            submissions: signal([]),
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl');

    fixture = TestBed.createComponent(AdminDiscountsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render the "Nuevo Descuento" button without a plus icon', () => {
    const btn = fixture.nativeElement.querySelector('.btn-create-discount');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Nuevo Descuento');
    const icon = btn.querySelector('mat-icon');
    expect(icon).toBeNull();
  });

  it('should navigate to /descuentos/nuevo on click', () => {
    const btn = fixture.nativeElement.querySelector('.btn-create-discount');
    btn.click();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/descuentos/nuevo');
  });
});

