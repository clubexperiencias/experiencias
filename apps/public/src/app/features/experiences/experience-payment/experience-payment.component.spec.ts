import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ExperiencePaymentComponent } from './experience-payment.component';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { NewsletterService } from '../../../core/services/newsletter.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AdminStoreService } from '../../../core/services/admin-store.service';
import { DiscountService } from '../../../core/services/discount.service';
import { Experience } from '../../../core/models/experience.model';

const MOCK_LODGING_EXP: Experience = {
  id: 'exp-hosp-1',
  slug: 'cabana-del-valle',
  title: 'Cabaña del Valle',
  shortTitle: 'Cabaña del Valle',
  tagline: 'Descanso en la montaña',
  description: 'Hermosa cabaña equipada para disfrutar de la tranquilidad.',
  category: 'hospedajes',
  region: 'Valle Central y Ambato',
  meetingPoint: 'Ruta 4 km 18',
  difficulty: 'Baja',
  durationDays: 1,
  durationLabel: 'Noches',
  priceArs: 45000,
  priceUsd: 35,
  maxSpotsPerGroup: 4,
  altitudeMeters: 850,
  isExclusiveClub: false,
  dates: [],
  status: 'publicada',
  coverImage: '/assets/images/kayak.jpg',
  galleryImages: [],
  highlights: ['Tranquilidad'],
  included: ['Ropa blanca', 'Desayuno'],
  providerName: 'Hostería Catamarca',
  providerId: 'prov-1',
  mpConnected: true,
};

describe('ExperiencePaymentComponent - Lodging Stay Date Handling and Submission', () => {
  let component: ExperiencePaymentComponent;
  let fixture: ComponentFixture<ExperiencePaymentComponent>;
  let expService: ExperienceService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ExperiencePaymentComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => 'cabana-del-valle' },
              queryParamMap: { get: () => null },
            },
            paramMap: of({ get: () => 'cabana-del-valle' }),
            queryParamMap: of({ get: () => null }),
          },
        },
        ProviderStoreService,
        ExperienceService,
        NewsletterService,
        NotificationService,
        AdminStoreService,
        DiscountService,
      ],
    }).compileComponents();

    expService = TestBed.inject(ExperienceService);
    vi.spyOn(expService, 'getExperienceBySlug').mockReturnValue(MOCK_LODGING_EXP);
    vi.spyOn(expService, 'getPublishedExperienceBySlug').mockReturnValue(MOCK_LODGING_EXP);

    fixture = TestBed.createComponent(ExperiencePaymentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should initialize a default valid stay for lodging', () => {
    expect(component.isLodging()).toBe(true);
    expect(component.checkInDate()).toBeTruthy();
    expect(component.checkOutDate()).toBeTruthy();
    expect(component.form.controls.date.value).toContain('al');
    expect(component.form.controls.date.valid).toBe(true);
  });

  it('should clear and invalidate form.controls.date when check-in is cleared', () => {
    component.onCheckInInput('');

    expect(component.checkInDate()).toBe('');
    expect(component.form.controls.date.value).toBe('');
    expect(component.form.controls.date.invalid).toBe(true);
    expect(component.form.controls.date.errors?.['required']).toBe(true);
    expect(component.canSubmit()).toBe(false);
  });

  it('should clear and invalidate form.controls.date when check-out is cleared', () => {
    component.onCheckOutInput('');

    expect(component.checkOutDate()).toBe('');
    expect(component.form.controls.date.value).toBe('');
    expect(component.form.controls.date.invalid).toBe(true);
    expect(component.form.controls.date.errors?.['required']).toBe(true);
    expect(component.canSubmit()).toBe(false);
  });

  it('should clear and invalidate form.controls.date when check-out is before or equal to check-in', () => {
    component.checkInDate.set('2026-12-10');
    component.onCheckOutInput('2026-12-05');

    expect(component.isCheckOutValid()).toBe(false);
    expect(component.selectedNights()).toBe(0);
    expect(component.form.controls.date.value).toBe('');
    expect(component.form.controls.date.invalid).toBe(true);
    expect(component.form.controls.date.errors?.['invalidCheckOut']).toBe(true);
    expect(component.canSubmit()).toBe(false);

    component.onCheckOutInput('2026-12-10');
    expect(component.isCheckOutValid()).toBe(false);
    expect(component.selectedNights()).toBe(0);
    expect(component.form.controls.date.value).toBe('');
    expect(component.form.controls.date.invalid).toBe(true);
    expect(component.form.controls.date.errors?.['invalidCheckOut']).toBe(true);
  });

  it('should format and validate form.controls.date when both endpoints form a valid stay', () => {
    component.checkInDate.set('2026-12-10');
    component.checkOutDate.set('2026-12-13');
    (component as any).syncLodgingDateForm();

    expect(component.isCheckOutValid()).toBe(true);
    expect(component.selectedNights()).toBe(3);
    expect(component.form.controls.date.value).toBe('2026-12-10 al 2026-12-13 (3 noches)');
    expect(component.form.controls.date.valid).toBe(true);
  });

  it('should block submit() and set submitError when stay dates are incomplete or invalid', async () => {
    component.checkInDate.set('');
    component.checkOutDate.set('2026-12-13');
    (component as any).syncLodgingDateForm();

    await component.submit();

    expect(component.submitError()).toBe(
      'Por favor seleccioná las fechas de check-in y check-out de la estadía.',
    );
    expect(component.submitting()).toBe(false);
  });

  it('should block submit() and set checkout error when checkout is before or equal to check-in', async () => {
    component.checkInDate.set('2026-12-10');
    component.checkOutDate.set('2026-12-08');
    (component as any).syncLodgingDateForm();

    await component.submit();

    expect(component.submitError()).toBe(
      'La fecha de check-out debe ser posterior a la fecha de check-in.',
    );
    expect(component.submitting()).toBe(false);
  });

  it('should block submitMercadoPago() and set submitError when stay dates are incomplete', async () => {
    component.checkInDate.set('2026-12-10');
    component.checkOutDate.set('');
    (component as any).syncLodgingDateForm();

    await component.submitMercadoPago();

    expect(component.submitError()).toBe(
      'Por favor seleccioná las fechas de check-in y check-out de la estadía.',
    );
    expect(component.submitting()).toBe(false);
  });

  it('should block submitMercadoPago() and set checkout error when checkout is before or equal to check-in', async () => {
    component.checkInDate.set('2026-12-10');
    component.checkOutDate.set('2026-12-10');
    (component as any).syncLodgingDateForm();

    await component.submitMercadoPago();

    expect(component.submitError()).toBe(
      'La fecha de check-out debe ser posterior a la fecha de check-in.',
    );
    expect(component.submitting()).toBe(false);
  });

  it('should pass stayLength and calculate lodging subtotal based on stay length when submitting transfer', async () => {
    component.checkInDate.set('2026-12-10');
    component.checkOutDate.set('2026-12-13');
    (component as any).syncLodgingDateForm();

    expect(component.selectedNights()).toBe(3);
    expect(component.subtotal()).toBe(45000 * 3);

    const newsletter = TestBed.inject(NewsletterService);
    vi.spyOn(newsletter, 'getAuthenticatedMember').mockResolvedValue({
      email: 'test@example.com',
      fullName: 'Test User',
      tier: 'emergente',
    } as any);
    vi.spyOn(newsletter, 'updateMemberProfile').mockResolvedValue({ success: true } as any);

    const store = TestBed.inject(ProviderStoreService);
    const submitTransferSpy = vi.spyOn(store, 'submitTransfer').mockResolvedValue({
      id: 'sub-123',
      experienceId: 'exp-hosp-1',
      experienceTitle: 'Cabaña del Valle',
      date: '2026-12-10 al 2026-12-13 (3 noches)',
      participants: 2,
      stayLength: 3,
      amountArs: 135000,
      fullName: 'Test User',
      email: 'test@example.com',
      dni: '12345678',
      phone: '12345678',
      status: 'pending',
      receiptUrl: 'https://example.com/receipt.png',
      createdAt: '2026-12-01',
    } as any);

    component.form.patchValue({
      fullName: 'Test User',
      email: 'test@example.com',
      dni: '12345678',
      phone: '12345678',
      participants: 2,
    });
    component.receiptFile.set(new File(['dummy'], 'receipt.png', { type: 'image/png' }));

    await component.submit();

    expect(submitTransferSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        experienceId: 'exp-hosp-1',
        stayLength: 3,
        participants: 2,
      }),
    );
  });

  it('should validate checkInDate against exp.dates for lodging in submitMercadoPago', async () => {
    const expWithDates: Experience = {
      ...MOCK_LODGING_EXP,
      dates: ['2026-12-10', '2026-12-20'],
    };
    vi.spyOn(expService, 'getExperienceBySlug').mockReturnValue(expWithDates);
    vi.spyOn(expService, 'getPublishedExperienceBySlug').mockReturnValue(expWithDates);

    const testFixture = TestBed.createComponent(ExperiencePaymentComponent);
    const testComponent = testFixture.componentInstance;
    testFixture.detectChanges();

    testComponent.form.patchValue({
      fullName: 'Test User',
      email: 'test@example.com',
      dni: '12345678',
      phone: '12345678',
      participants: 2,
    });
    testComponent.checkInDate.set('2026-12-11');
    testComponent.checkOutDate.set('2026-12-14');
    (testComponent as any).syncLodgingDateForm();

    await testComponent.submitMercadoPago();

    expect(testComponent.submitError()).toBe('La fecha elegida no está disponible.');
    expect(testComponent.submitting()).toBe(false);
  });

  it('should reject submitMercadoPago when checkInDate is closed for lodging', async () => {
    const expWithDates: Experience = {
      ...MOCK_LODGING_EXP,
      dates: ['2026-12-10', '2026-12-20'],
    };
    vi.spyOn(expService, 'getExperienceBySlug').mockReturnValue(expWithDates);
    vi.spyOn(expService, 'getPublishedExperienceBySlug').mockReturnValue(expWithDates);

    const store = TestBed.inject(ProviderStoreService);
    vi.spyOn(store, 'isDateClosed').mockImplementation((_, date) => date === '2026-12-10');

    const testFixture = TestBed.createComponent(ExperiencePaymentComponent);
    const testComponent = testFixture.componentInstance;
    testFixture.detectChanges();

    testComponent.form.patchValue({
      fullName: 'Test User',
      email: 'test@example.com',
      dni: '12345678',
      phone: '12345678',
      participants: 2,
    });
    testComponent.checkInDate.set('2026-12-10');
    testComponent.checkOutDate.set('2026-12-13');
    (testComponent as any).syncLodgingDateForm();

    await testComponent.submitMercadoPago();

    expect(testComponent.submitError()).toBe(
      'La fecha elegida se encuentra cerrada para nuevas reservas.',
    );
    expect(testComponent.submitting()).toBe(false);
  });

  it('should validate checkInDate against exp.dates and closed state in submit() for lodging', async () => {
    const expWithDates: Experience = {
      ...MOCK_LODGING_EXP,
      dates: ['2026-12-10', '2026-12-20'],
    };
    vi.spyOn(expService, 'getExperienceBySlug').mockReturnValue(expWithDates);
    vi.spyOn(expService, 'getPublishedExperienceBySlug').mockReturnValue(expWithDates);

    const testFixture = TestBed.createComponent(ExperiencePaymentComponent);
    const testComponent = testFixture.componentInstance;
    testFixture.detectChanges();

    testComponent.checkInDate.set('2026-12-11');
    testComponent.checkOutDate.set('2026-12-14');
    (testComponent as any).syncLodgingDateForm();
    testComponent.form.patchValue({
      fullName: 'Test User',
      email: 'test@example.com',
      dni: '12345678',
      phone: '12345678',
      participants: 2,
    });
    testComponent.receiptFile.set(new File(['dummy'], 'receipt.png', { type: 'image/png' }));

    await testComponent.submit();

    expect(testComponent.submitError()).toBe('La fecha elegida no está disponible.');
    expect(testComponent.submitting()).toBe(false);
  });

  it('should fallback to storeExp.category when liveExp.category is absent in experience construction', () => {
    const expWithoutCategory: Experience = {
      ...MOCK_LODGING_EXP,
      category: undefined as any,
    };
    vi.spyOn(expService, 'getExperienceBySlug').mockReturnValue(expWithoutCategory);
    vi.spyOn(expService, 'getPublishedExperienceBySlug').mockReturnValue(expWithoutCategory);

    const store = TestBed.inject(ProviderStoreService);
    vi.spyOn(store, 'getExperienceBySlug').mockReturnValue({
      id: 'exp-hosp-1',
      slug: 'cabana-del-valle',
      title: 'Cabaña del Valle',
      category: 'hospedajes',
      priceArs: 45000,
      capacityPerDate: 4,
      dates: [],
      status: 'publicada',
    } as any);

    const testFixture = TestBed.createComponent(ExperiencePaymentComponent);
    const testComponent = testFixture.componentInstance;
    testFixture.detectChanges();

    expect(testComponent.experience()?.category).toBe('hospedajes');
    expect(testComponent.isLodging()).toBe(true);
  });

  it('should validate checkInDate against exp.dates for lodging in submitMercadoPago', async () => {
    const expWithDates: Experience = {
      ...MOCK_LODGING_EXP,
      dates: ['2026-12-10', '2026-12-20'],
    };
    vi.spyOn(expService, 'getExperienceBySlug').mockReturnValue(expWithDates);
    vi.spyOn(expService, 'getPublishedExperienceBySlug').mockReturnValue(expWithDates);

    const testFixture = TestBed.createComponent(ExperiencePaymentComponent);
    const testComponent = testFixture.componentInstance;
    testFixture.detectChanges();

    testComponent.form.patchValue({
      fullName: 'Test User',
      email: 'test@example.com',
      dni: '12345678',
      phone: '12345678',
      participants: 2,
    });
    testComponent.checkInDate.set('2026-12-11');
    testComponent.checkOutDate.set('2026-12-14');
    (testComponent as any).syncLodgingDateForm();

    await testComponent.submitMercadoPago();

    expect(testComponent.submitError()).toBe('La fecha elegida no está disponible.');
    expect(testComponent.submitting()).toBe(false);
  });

  it('should reject submitMercadoPago when checkInDate is closed for lodging', async () => {
    const expWithDates: Experience = {
      ...MOCK_LODGING_EXP,
      dates: ['2026-12-10', '2026-12-20'],
    };
    vi.spyOn(expService, 'getExperienceBySlug').mockReturnValue(expWithDates);
    vi.spyOn(expService, 'getPublishedExperienceBySlug').mockReturnValue(expWithDates);

    const store = TestBed.inject(ProviderStoreService);
    vi.spyOn(store, 'isDateClosed').mockImplementation((_, date) => date === '2026-12-10');

    const testFixture = TestBed.createComponent(ExperiencePaymentComponent);
    const testComponent = testFixture.componentInstance;
    testFixture.detectChanges();

    testComponent.form.patchValue({
      fullName: 'Test User',
      email: 'test@example.com',
      dni: '12345678',
      phone: '12345678',
      participants: 2,
    });
    testComponent.checkInDate.set('2026-12-10');
    testComponent.checkOutDate.set('2026-12-13');
    (testComponent as any).syncLodgingDateForm();

    await testComponent.submitMercadoPago();

    expect(testComponent.submitError()).toBe(
      'La fecha elegida se encuentra cerrada para nuevas reservas.',
    );
    expect(testComponent.submitting()).toBe(false);
  });

  it('should validate checkInDate against exp.dates and closed state in submit() for lodging', async () => {
    const expWithDates: Experience = {
      ...MOCK_LODGING_EXP,
      dates: ['2026-12-10', '2026-12-20'],
    };
    vi.spyOn(expService, 'getExperienceBySlug').mockReturnValue(expWithDates);
    vi.spyOn(expService, 'getPublishedExperienceBySlug').mockReturnValue(expWithDates);

    const testFixture = TestBed.createComponent(ExperiencePaymentComponent);
    const testComponent = testFixture.componentInstance;
    testFixture.detectChanges();

    testComponent.checkInDate.set('2026-12-11');
    testComponent.checkOutDate.set('2026-12-14');
    (testComponent as any).syncLodgingDateForm();
    testComponent.form.patchValue({
      fullName: 'Test User',
      email: 'test@example.com',
      dni: '12345678',
      phone: '12345678',
      participants: 2,
    });
    testComponent.receiptFile.set(new File(['dummy'], 'receipt.png', { type: 'image/png' }));

    await testComponent.submit();

    expect(testComponent.submitError()).toBe('La fecha elegida no está disponible.');
    expect(testComponent.submitting()).toBe(false);
  });

  it('should fallback to storeExp.category when liveExp.category is absent in experience construction', () => {
    const expWithoutCategory: Experience = {
      ...MOCK_LODGING_EXP,
      category: undefined as any,
    };
    vi.spyOn(expService, 'getExperienceBySlug').mockReturnValue(expWithoutCategory);
    vi.spyOn(expService, 'getPublishedExperienceBySlug').mockReturnValue(expWithoutCategory);

    const store = TestBed.inject(ProviderStoreService);
    vi.spyOn(store, 'getExperienceBySlug').mockReturnValue({
      id: 'exp-hosp-1',
      slug: 'cabana-del-valle',
      title: 'Cabaña del Valle',
      category: 'hospedajes',
      priceArs: 45000,
      capacityPerDate: 4,
      dates: [],
      status: 'publicada',
    } as any);

    const testFixture = TestBed.createComponent(ExperiencePaymentComponent);
    const testComponent = testFixture.componentInstance;
    testFixture.detectChanges();

    expect(testComponent.experience()?.category).toBe('hospedajes');
    expect(testComponent.isLodging()).toBe(true);
  });

  it('should compute and render USD equivalent for transfer and total', () => {
    // Ensure auth is marked ready so checkout shell renders
    component.authReady.set(true);
    fixture.detectChanges();

    // Total is calculated from stay dates or base price (e.g., 45000 * 2 nights = 90000)
    expect(component.total()).toBeGreaterThan(0);
    const expectedUsd = Math.round(component.total() / (component.usdExchangeRate() || 1400));
    expect(component.totalUsd()).toBe(expectedUsd);

    const compiled = fixture.nativeElement as HTMLElement;
    const usdEquivalentEl = compiled.querySelector('.pay-usd-equivalent');
    expect(usdEquivalentEl).toBeTruthy();
    expect(usdEquivalentEl?.textContent).toContain(`o ~\$${expectedUsd} USD`);

    const usdSubEl = compiled.querySelector('.pay-usd-sub');
    expect(usdSubEl).toBeTruthy();
    expect(usdSubEl?.textContent).toContain(`o ~\$${expectedUsd} USD`);
  });
});
