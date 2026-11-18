import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminDiscountEditorComponent } from './admin-discount-editor.component';
import { DiscountService } from '../../../core/services/discount.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { signal } from '@angular/core';

describe('AdminDiscountEditorComponent', () => {
  let component: AdminDiscountEditorComponent;
  let fixture: ComponentFixture<AdminDiscountEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDiscountEditorComponent],
      providers: [
        provideRouter([]),
        {
          provide: DiscountService,
          useValue: {
            discounts: signal([]),
            getDiscountById: () => undefined,
            loadDiscounts: async () => [],
            createDiscount: async () => null,
            updateDiscount: async () => null,
          },
        },
        {
          provide: ExperienceService,
          useValue: {
            experiences: signal([]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDiscountEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the editor component', () => {
    expect(component).toBeTruthy();
  });

  it('should calculate 50% discount for 2x1 preset', () => {
    component.applyGroupPreset(2, 1);
    expect(component.groupTravelers()).toBe(2);
    expect(component.groupPayers()).toBe(1);
    expect(component.calculatedGroupPercentage()).toBe(50);
  });

  it('should calculate 33.3% discount for 3x2 preset', () => {
    component.applyGroupPreset(3, 2);
    expect(component.groupTravelers()).toBe(3);
    expect(component.groupPayers()).toBe(2);
    expect(component.calculatedGroupPercentage()).toBe(33.3);
  });

  it('should calculate 25% discount for 4x3 preset', () => {
    component.applyGroupPreset(4, 3);
    expect(component.groupTravelers()).toBe(4);
    expect(component.groupPayers()).toBe(3);
    expect(component.calculatedGroupPercentage()).toBe(25);
  });

  it('should calculate custom NxM percentages accurately', () => {
    component.groupTravelers.set(5);
    component.groupPayers.set(4);
    // (5 - 4) / 5 = 20%
    expect(component.calculatedGroupPercentage()).toBe(20);
  });
});

