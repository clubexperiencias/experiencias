import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { vi } from 'vitest';
import { ProviderExperienceProposalModalComponent } from './provider-experience-proposal-modal.component';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { StorageService } from '../../../core/services/storage.service';
import { AdminStoreService } from '../../../core/services/admin-store.service';

describe('ProviderExperienceProposalModalComponent Draft Persistence', () => {
  let component: ProviderExperienceProposalModalComponent;
  let fixture: ComponentFixture<ProviderExperienceProposalModalComponent>;
  let store: ProviderStoreService;
  let rateSignal: WritableSignal<number>;

  beforeEach(async () => {
    localStorage.clear();
    rateSignal = signal(1400);

    await TestBed.configureTestingModule({
      imports: [ProviderExperienceProposalModalComponent],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        ProviderStoreService,
        {
          provide: AdminStoreService,
          useValue: {
            usdExchangeRate: rateSignal,
          },
        },
        {
          provide: StorageService,
          useValue: {
            uploadFile: () => Promise.resolve({ url: 'https://test.storage/img.jpg' }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProviderExperienceProposalModalComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(ProviderStoreService);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create the proposal modal component', () => {
    expect(component).toBeTruthy();
    expect(component.hasDraft()).toBe(false);
  });

  it('should save proposal draft into localStorage when content is typed', () => {
    component.reqForm.title = 'Travesía Seismiles';
    component.reqForm.region = 'Fiambalá';
    component.saveDraft();

    expect(component.hasDraft()).toBe(true);
    const stored = localStorage.getItem(ProviderExperienceProposalModalComponent.DRAFT_STORAGE_KEY);
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.reqForm.title).toBe('Travesía Seismiles');
    expect(parsed.reqForm.region).toBe('Fiambalá');
  });

  it('should restore draft from localStorage on loadDraft', () => {
    const draftPayload = {
      reqForm: {
        title: 'Expedición Volcanes',
        subheading: 'Recorrido de altura',
        region: 'Antofagasta',
        priceArs: 120000,
      },
      updatedAt: Date.now(),
    };
    localStorage.setItem(
      ProviderExperienceProposalModalComponent.DRAFT_STORAGE_KEY,
      JSON.stringify(draftPayload),
    );

    component.loadDraft();

    expect(component.hasDraft()).toBe(true);
    expect(component.reqForm.title).toBe('Expedición Volcanes');
    expect(component.reqForm.subheading).toBe('Recorrido de altura');
    expect(component.reqForm.region).toBe('Antofagasta');
    expect(component.reqForm.priceArs).toBe(120000);
  });

  it('should clear draft and reset form when discardDraft is called', () => {
    component.reqForm.title = 'Cabalgata Ambato';
    component.saveDraft();
    expect(component.hasDraft()).toBe(true);

    component.discardDraft();

    expect(component.hasDraft()).toBe(false);
    expect(localStorage.getItem(ProviderExperienceProposalModalComponent.DRAFT_STORAGE_KEY)).toBeNull();
    expect(component.reqForm.title).toBe('');
  });

  it('should clear draft from localStorage when proposal is submitted successfully', async () => {
    vi.spyOn(store, 'submitExperienceRequest').mockResolvedValue({ id: 'mock-1' } as any);
    component.reqForm.title = 'Kayak Sunset';
    component.reqForm.region = 'Valle Central';
    component.reqForm.subheading = 'Sunset en kayak en el dique';
    component.reqForm.itinerary = '16:00 Recepción, 17:00 Salida, 19:00 Regreso';
    component.reqForm.meetingPoint = 'Club Náutico';
    component.reqForm.meetingPointUrl = 'https://maps.app.goo.gl/abc123';
    component.reqForm.priceArs = 55000;
    component.coverImageDataUrl.set('data:image/jpeg;base64,mock');
    component.coverImagePreview.set('data:image/jpeg;base64,mock');
    component.saveDraft();
    expect(localStorage.getItem(ProviderExperienceProposalModalComponent.DRAFT_STORAGE_KEY)).toBeTruthy();

    await component.submitRequestForm();

    expect(localStorage.getItem(ProviderExperienceProposalModalComponent.DRAFT_STORAGE_KEY)).toBeNull();
    expect(component.hasDraft()).toBe(false);
  });

  it('should preserve draft in localStorage if user closes modal without submitting', () => {
    component.reqForm.title = 'Aventura Puna';
    component.reqForm.region = 'Belén';
    component.saveDraft();
    expect(localStorage.getItem(ProviderExperienceProposalModalComponent.DRAFT_STORAGE_KEY)).toBeTruthy();

    component.onClose();

    expect(localStorage.getItem(ProviderExperienceProposalModalComponent.DRAFT_STORAGE_KEY)).toBeTruthy();
  });

  it('should update automatic USD amount on exchange rate change without reloading draft', () => {
    component.reqForm.priceArs = 280000;
    component.onPriceArsChange(280000);
    component.isUsdAutoCalc.set(true);
    fixture.detectChanges();

    expect(component.reqForm.priceUsd).toBe(200);

    const loadDraftSpy = vi.spyOn(component, 'loadDraft');
    rateSignal.set(1000);
    fixture.detectChanges();

    expect(component.reqForm.priceUsd).toBe(280);
    expect(loadDraftSpy).not.toHaveBeenCalled();
  });

  it('should not track exchange rate in modal-open effect when loadDraft is invoked', () => {
    const focusSpy = vi.spyOn(component as any, 'focusInitialElement');
    const loadDraftSpy = vi.spyOn(component, 'loadDraft');

    rateSignal.set(1200);
    fixture.detectChanges();

    expect(loadDraftSpy).not.toHaveBeenCalled();
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('should use a single snapshot of ARS and exchange rate for displayed and saved priceUsd on submit', async () => {
    component.reqForm.title = 'Trekking Seismiles';
    component.reqForm.region = 'Catamarca';
    component.reqForm.subheading = 'Alta montaña';
    component.reqForm.itinerary = 'Día 1: Salida';
    component.reqForm.meetingPoint = 'Plaza';
    component.reqForm.meetingPointUrl = 'https://maps.app.goo.gl/xyz';
    component.reqForm.priceArs = 150000;
    component.isUsdAutoCalc.set(true);
    component.coverImageDataUrl.set('data:image/jpeg;base64,mock');
    component.coverImagePreview.set('data:image/jpeg;base64,mock');

    rateSignal.set(1500);
    fixture.detectChanges();

    const submitSpy = vi.spyOn(store, 'submitExperienceRequest').mockResolvedValue({ id: 'mock-1' } as any);

    await component.submitRequestForm();

    expect(component.reqForm.priceUsd).toBe(100);
    expect(submitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        priceArs: 150000,
        priceUsd: 100,
      }),
    );
  });

  it('should use live data URL when coverImageFile() is the captured coverFile and storage fails', async () => {
    component.reqForm.title = 'Cabalgata';
    component.reqForm.region = 'Catamarca';
    component.reqForm.subheading = 'Paseo';
    component.reqForm.itinerary = 'Todo el día';
    component.reqForm.meetingPoint = 'Punto';
    component.reqForm.meetingPointUrl = 'https://maps.app.goo.gl/xyz';
    component.reqForm.priceArs = 50000;

    const file = new File(['mock content'], 'cabalgata.jpg', { type: 'image/jpeg' });
    component.coverImageFile.set(file);
    component.coverImageDataUrl.set('data:image/jpeg;base64,liveDataUrl');
    component.coverImagePreview.set('blob:http://localhost/cabalgata');

    const storage = TestBed.inject(StorageService);
    vi.spyOn(storage, 'uploadFile').mockRejectedValue(new Error('Upload failed'));
    const submitSpy = vi.spyOn(store, 'submitExperienceRequest').mockResolvedValue({ id: 'mock-1' } as any);

    await component.submitRequestForm();

    expect(submitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        coverImage: 'data:image/jpeg;base64,liveDataUrl',
        coverImageName: 'cabalgata.jpg',
      }),
    );
  });

  it('should skip outer data URL and convert captured file when coverImageFile changed', async () => {
    component.reqForm.title = 'Cabalgata 2';
    component.reqForm.region = 'Catamarca';
    component.reqForm.subheading = 'Paseo';
    component.reqForm.itinerary = 'Todo el día';
    component.reqForm.meetingPoint = 'Punto';
    component.reqForm.meetingPointUrl = 'https://maps.app.goo.gl/xyz';
    component.reqForm.priceArs = 50000;

    const file1 = new File(['file1 content'], 'captured.jpg', { type: 'image/jpeg' });
    const file2 = new File(['file2 content'], 'other.jpg', { type: 'image/jpeg' });

    component.coverImageFile.set(file1);
    component.coverImageDataUrl.set('data:image/jpeg;base64,otherDataUrl');
    component.coverImagePreview.set('blob:http://localhost/captured');

    const storage = TestBed.inject(StorageService);
    vi.spyOn(storage, 'uploadFile').mockImplementation(async () => {
      component.coverImageFile.set(file2);
      throw new Error('Upload failed');
    });
    const submitSpy = vi.spyOn(store, 'submitExperienceRequest').mockResolvedValue({ id: 'mock-1' } as any);

    await component.submitRequestForm();

    expect(submitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        coverImageName: 'captured.jpg',
      }),
    );
    const callArgs = submitSpy.mock.calls[submitSpy.mock.calls.length - 1][0];
    expect(callArgs.coverImage).not.toBe('data:image/jpeg;base64,otherDataUrl');
    expect(callArgs.coverImage).toContain('data:image/jpeg;base64,');
  });

  describe('durationOptions handling and normalization', () => {
    it('should normalize legacy "1 a 2 horas (Paseo express)" to "1 a 2 horas" on loadDraft', () => {
      localStorage.setItem(
        ProviderExperienceProposalModalComponent.DRAFT_STORAGE_KEY,
        JSON.stringify({
          reqForm: {
            title: 'Kayak Paseo',
            duration: '1 a 2 horas (Paseo express)',
          },
        }),
      );

      component.loadDraft();

      expect(component.reqForm.duration).toBe('1 a 2 horas');
      expect(component.isCustomDuration(component.reqForm.duration)).toBe(false);
    });

    it('should preserve unoffered custom duration on loadDraft and render it as option in select', () => {
      const customDuration = '5 horas (Travesía personalizada)';
      localStorage.setItem(
        ProviderExperienceProposalModalComponent.DRAFT_STORAGE_KEY,
        JSON.stringify({
          reqForm: {
            title: 'Travesía Especial',
            duration: customDuration,
          },
        }),
      );

      component.loadDraft();
      fixture.detectChanges();

      expect(component.reqForm.duration).toBe(customDuration);
      expect(component.isCustomDuration(customDuration)).toBe(true);

      const selectEl: HTMLSelectElement = fixture.nativeElement.querySelector('#req-duration');
      expect(selectEl).toBeTruthy();
      const optionTexts = Array.from(selectEl.options).map((opt) => opt.value);
      expect(optionTexts).toContain(customDuration);
    });
  });
});

