import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProviderExperienceProposalModalComponent } from './provider-experience-proposal-modal.component';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { StorageService } from '../../../core/services/storage.service';

describe('ProviderExperienceProposalModalComponent Draft Persistence', () => {
  let component: ProviderExperienceProposalModalComponent;
  let fixture: ComponentFixture<ProviderExperienceProposalModalComponent>;
  let store: ProviderStoreService;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [ProviderExperienceProposalModalComponent],
      providers: [
        provideRouter([]),
        ProviderStoreService,
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
});

