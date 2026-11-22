import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { ProviderExperienceFormComponent } from './provider-experience-form.component';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { StorageService } from '../../../core/services/storage.service';
import * as mediaDraftDb from '../../../shared/utils/media-draft-db.util';

describe('ProviderExperienceFormComponent Draft and Autosave Flow', () => {
  let component: ProviderExperienceFormComponent;
  let fixture: ComponentFixture<ProviderExperienceFormComponent>;
  let store: ProviderStoreService;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [ProviderExperienceFormComponent],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        ProviderStoreService,
        ExperienceService,
        {
          provide: StorageService,
          useValue: {
            uploadFile: () => Promise.resolve({ url: 'https://test.storage/img.jpg' }),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'id' ? null : null),
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProviderExperienceFormComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(ProviderStoreService);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should create the component with no draft initially', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(component.hasDraft()).toBe(false);
    expect(component.loadedExperience()).toBeNull();
  });

  it('should restore compatible fields and uploaded media from draft into loadedExperience on create page', async () => {
    const draftPayload = {
      formValue: {
        title: 'Travesía Cordillerana',
        slug: 'travesia-cordillerana',
        tagline: 'Aventura única',
        description: 'Una expedición increíble por los valles y montañas de Catamarca.',
        category: 'expediciones',
        region: 'Fiambalá y Tinogasta',
        difficulty: 'Exigente',
        durationLabel: '2 días',
        altitudeMeters: 3200,
        meetingPoint: 'Plaza principal',
        meetingPointUrl: 'https://maps.app.goo.gl/xyz',
        priceArs: 95000,
        capacityPerDate: 8,
      },
      dates: ['2026-12-01', '2026-12-15'],
      pricingPacks: [],
      coverImageUrl: 'https://test.storage/cover.jpg',
      videoUrl: 'https://test.storage/video.mp4',
      albumPhotos: [
        { id: 'photo_1', url: 'https://test.storage/photo1.jpg', title: 'Foto 1', order: 1 },
      ],
      includedRaw: 'Guía de montaña\nEquipo completo',
      requirementsRaw: 'Buen estado físico\nRopa de abrigo',
      highlightsRaw: 'Vistas panorámicas',
      itinerary: 'Día 1: Ascenso. Día 2: Descenso.',
      updatedAt: Date.now(),
    };

    localStorage.setItem(
      ProviderExperienceFormComponent.DRAFT_STORAGE_KEY,
      JSON.stringify(draftPayload),
    );

    await component.ngOnInit();
    fixture.detectChanges();

    expect(component.hasDraft()).toBe(true);
    const loaded = component.loadedExperience();
    expect(loaded).toBeTruthy();
    expect(loaded?.title).toBe('Travesía Cordillerana');
    expect(loaded?.tagline).toBe('Aventura única');
    expect(loaded?.coverImage).toBe('https://test.storage/cover.jpg');
    expect(loaded?.videoUrl).toBe('https://test.storage/video.mp4');
    expect(loaded?.albumPhotos?.length).toBe(1);
    expect(loaded?.dates).toEqual(['2026-12-01', '2026-12-15']);
    expect(loaded?.priceArs).toBe(95000);
  });

  it('should restore media from proposal draft if not present in form draft', async () => {
    const proposalDraft = {
      reqForm: {
        title: 'Cabalgata en la Puna',
        subheading: 'Recorrido a caballo por la Puna catamarqueña con vistas únicas.',
        category: 'expediciones',
        region: 'Puna Catamarqueña y Seismiles',
        difficulty: 'Moderada',
        duration: '1 día',
        altitude: '3500',
        capacity: 6,
        priceArs: 80000,
      },
      coverImageDataUrl: 'data:image/jpeg;base64,mockcover',
    };
    localStorage.setItem('experiencias_provider_proposal_draft', JSON.stringify(proposalDraft));

    await component.ngOnInit();
    fixture.detectChanges();

    expect(component.hasDraft()).toBe(true);
    const loaded = component.loadedExperience();
    expect(loaded).toBeTruthy();
    expect(loaded?.title).toBe('Cabalgata en la Puna');
    expect(loaded?.coverImage).toBe('data:image/jpeg;base64,mockcover');
  });

  it('should save draft to localStorage when saveDraft is called', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    component.expFormComponent?.form.patchValue({
      title: 'Kayak en Las Pirquitas',
      tagline: 'Paseo en kayak',
      description: 'Una experiencia relajante remando en el dique.',
      priceArs: 45000,
    });

    component.saveDraft();

    expect(component.hasDraft()).toBe(true);
    const stored = localStorage.getItem(ProviderExperienceFormComponent.DRAFT_STORAGE_KEY);
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.formValue.title).toBe('Kayak en Las Pirquitas');
    expect(parsed.formValue.priceArs).toBe(45000);
  });

  it('should clear draft and reset form when discardDraft is called', async () => {
    localStorage.setItem(
      ProviderExperienceFormComponent.DRAFT_STORAGE_KEY,
      JSON.stringify({ formValue: { title: 'Borrador a descartar' } }),
    );
    await component.ngOnInit();
    fixture.detectChanges();

    expect(component.hasDraft()).toBe(true);

    component.discardDraft();

    expect(component.hasDraft()).toBe(false);
    expect(component.loadedExperience()).toBeNull();
    expect(localStorage.getItem(ProviderExperienceFormComponent.DRAFT_STORAGE_KEY)).toBeNull();
  });

  it('should clear draft from localStorage when create submission succeeds', async () => {
    localStorage.setItem(
      ProviderExperienceFormComponent.DRAFT_STORAGE_KEY,
      JSON.stringify({ formValue: { title: 'Borrador para enviar' } }),
    );
    await component.ngOnInit();
    fixture.detectChanges();

    vi.spyOn(store, 'submitExperienceRequest').mockResolvedValue({ id: 'mock-1' } as any);
    vi.spyOn(store, 'createExperience').mockImplementation(() => ({} as any));

    await component.onSave({
      payload: {
        title: 'Travesía Final',
        shortTitle: 'Travesía Final',
        slug: 'travesia-final',
        tagline: 'Tagline',
        description: 'Descripción completa de más de treinta caracteres para pasar la validación.',
        category: 'expediciones',
        region: 'Valle Central y Ambato',
        meetingPoint: 'Punto de encuentro',
        meetingPointUrl: '',
        difficulty: 'Baja',
        durationLabel: '2 horas',
        altitudeMeters: 850,
        priceArs: 50000,
        capacityPerDate: 10,
        dates: ['2026-12-20'],
        pricingPacks: [],
        coverImage: 'https://test.storage/cover.jpg',
        videoUrl: '',
        albumPhotos: [],
        galleryImages: [],
        included: [],
        includedServices: '',
        highlights: [],
        participantRequirements: '',
        itinerary: '',
        providerName: 'Prestador',
        providerPhone: '',
        providerCbuAlias: '',
        providerCuitDni: '',
        providerBankName: '',
        status: 'borrador',
        displayLocation: 'destacada',
      },
      requestPublication: true,
    });

    expect(localStorage.getItem(ProviderExperienceFormComponent.DRAFT_STORAGE_KEY)).toBeNull();
    expect(component.hasDraft()).toBe(false);
  });

  it('should retain draft in localStorage when submission fails', async () => {
    localStorage.setItem(
      ProviderExperienceFormComponent.DRAFT_STORAGE_KEY,
      JSON.stringify({ formValue: { title: 'Borrador persistido' } }),
    );
    await component.ngOnInit();
    fixture.detectChanges();

    vi.spyOn(store, 'submitExperienceRequest').mockRejectedValue(new Error('Network error'));

    await component.onSave({
      payload: {
        title: 'Travesía Que Falla',
        shortTitle: 'Travesía Que Falla',
        slug: 'travesia-falla',
        tagline: 'Tagline',
        description: 'Descripción completa de más de treinta caracteres para pasar la validación.',
        category: 'expediciones',
        region: 'Valle Central y Ambato',
        meetingPoint: 'Punto',
        meetingPointUrl: '',
        difficulty: 'Baja',
        durationLabel: '2 horas',
        altitudeMeters: 850,
        priceArs: 50000,
        capacityPerDate: 10,
        dates: ['2026-12-20'],
        pricingPacks: [],
        coverImage: 'https://test.storage/cover.jpg',
        videoUrl: '',
        albumPhotos: [],
        galleryImages: [],
        included: [],
        includedServices: '',
        highlights: [],
        participantRequirements: '',
        itinerary: '',
        providerName: 'Prestador',
        providerPhone: '',
        providerCbuAlias: '',
        providerCuitDni: '',
        providerBankName: '',
        status: 'borrador',
        displayLocation: 'destacada',
      },
      requestPublication: true,
    });

    expect(localStorage.getItem(ProviderExperienceFormComponent.DRAFT_STORAGE_KEY)).toBeTruthy();
    expect(component.saveError()).toBeTruthy();
    expect(component.saving()).toBe(false);
  });

  it('should not include slug in loadedExperience in provider edit mode', async () => {
    const existingExp = {
      id: 'exp-123',
      slug: 'ruta-oficial-super-larga-que-supera-los-cuarenta-caracteres-en-el-catalogo',
      title: 'Cabalgata Catamarca',
      tagline: 'Una cabalgata',
      description: 'Hermosa experiencia a caballo.',
      priceArs: 60000,
      status: 'publicada' as const,
    };
    vi.spyOn(store, 'getExperienceById').mockReturnValue(existingExp as any);

    // Mock activated route paramMap with id
    const route = TestBed.inject(ActivatedRoute);
    route.snapshot.paramMap.get = vi.fn().mockImplementation((k: string) => (k === 'id' ? 'exp-123' : null));

    await component.ngOnInit();
    fixture.detectChanges();

    expect(component.isEditMode()).toBe(true);
    expect(component.editingExpSlug()).toBe('ruta-oficial-super-larga-que-supera-los-cuarenta-caracteres-en-el-catalogo');
    const loaded = component.loadedExperience();
    expect(loaded).toBeTruthy();
    expect((loaded as any).slug).toBeUndefined();
    // The slug does not invalidate provider form
    expect(component.expFormComponent?.form.controls.slug.valid).toBe(true);
  });

  it('should not include slug in saveExperienceChanges updates when provider edits', async () => {
    component.isEditMode.set(true);
    component.editingExpId.set('exp-123');
    component.loadedExperience.set({ id: 'exp-123' } as any);

    const saveSpy = vi.spyOn(store, 'saveExperienceChanges').mockResolvedValue({ id: 'exp-123' } as any);

    await component.onSave({
      payload: {
        title: 'Cabalgata Modificada',
        shortTitle: 'Cabalgata Modificada',
        slug: 'slug-ignorado-en-provider-edit',
        tagline: 'Tagline',
        description: 'Descripción completa de más de treinta caracteres para pasar la validación.',
        category: 'expediciones',
        region: 'Valle Central y Ambato',
        meetingPoint: 'Punto',
        meetingPointUrl: '',
        difficulty: 'Baja',
        durationLabel: '2 horas',
        altitudeMeters: 850,
        priceArs: 50000,
        capacityPerDate: 10,
        dates: ['2026-12-20'],
        pricingPacks: [],
        coverImage: 'https://test.storage/cover.jpg',
        videoUrl: '',
        albumPhotos: [],
        galleryImages: [],
        included: [],
        includedServices: '',
        highlights: [],
        participantRequirements: '',
        itinerary: '',
        providerName: 'Prestador',
        providerPhone: '',
        providerCbuAlias: '',
        providerCuitDni: '',
        providerBankName: '',
        status: 'borrador',
        displayLocation: 'destacada',
      },
      requestPublication: false,
    });

    expect(saveSpy).toHaveBeenCalled();
    const passedUpdates = saveSpy.mock.calls[0][1] as any;
    expect(passedUpdates.slug).toBeUndefined();
    expect(passedUpdates.title).toBe('Cabalgata Modificada');
  });

  it('should block publication submission when dates are empty and datesOnRequest is false', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    const formComp = component.expFormComponent;
    expect(formComp).toBeTruthy();
    if (!formComp) return;

    formComp.form.patchValue({
      title: 'Expedición sin fechas',
      tagline: 'Una expedición sin fechas',
      description: 'Esta es una descripción detallada que tiene más de treinta caracteres para ser válida.',
      category: 'expediciones',
      region: 'Valle Central y Ambato',
      durationLabel: '3 horas',
      meetingPoint: 'Plaza principal',
      priceArs: 80000,
      capacityPerDate: 10,
    });
    formComp.dates.set([]);
    formComp.datesOnRequest.set(false);

    let emitted = false;
    formComp.saveExperience.subscribe(() => {
      emitted = true;
    });

    formComp.onSubmit(true);

    expect(emitted).toBe(false);
    expect(formComp.datesError()).toBeTruthy();
  });

  it('should allow publication submission without returning early when dates are on request', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    const formComp = component.expFormComponent;
    expect(formComp).toBeTruthy();
    if (!formComp) return;

    formComp.form.patchValue({
      title: 'Expedición a Coordinar',
      tagline: 'Una expedición flexible',
      description: 'Esta es una descripción detallada que tiene más de treinta caracteres para ser válida.',
      category: 'expediciones',
      region: 'Valle Central y Ambato',
      durationLabel: '3 horas',
      meetingPoint: 'Plaza principal',
      priceArs: 80000,
      capacityPerDate: 10,
    });
    formComp.dates.set([]);
    formComp.datesOnRequest.set(true);

    let emittedEvent: any = null;
    formComp.saveExperience.subscribe((event) => {
      emittedEvent = event;
    });

    formComp.onSubmit(true);

    expect(emittedEvent).toBeTruthy();
    expect(emittedEvent.requestPublication).toBe(true);
    expect(emittedEvent.payload.dates).toEqual([]);
    expect(emittedEvent.payload.datesOnRequest).toBe(true);
    expect(formComp.datesError()).toBeNull();
  });

  it('should propagate dates on request as "A coordinar" to submitExperienceRequest without requiring fixed dates', async () => {
    const submitSpy = vi.spyOn(store, 'submitExperienceRequest').mockResolvedValue({ id: 'prop-1' } as any);
    const createSpy = vi.spyOn(store, 'createExperience').mockReturnValue({ id: 'exp-1' } as any);

    await component.onSave({
      payload: {
        title: 'Travesía a Coordinar',
        shortTitle: 'Travesía a Coordinar',
        slug: 'travesia-a-coordinar',
        tagline: 'Salida flexible',
        description: 'Descripción completa de más de treinta caracteres para pasar la validación.',
        category: 'expediciones',
        region: 'Valle Central y Ambato',
        meetingPoint: 'Punto de encuentro a coordinar',
        meetingPointUrl: '',
        difficulty: 'Baja',
        durationLabel: '2 horas',
        altitudeMeters: 850,
        priceArs: 50000,
        capacityPerDate: 10,
        dates: [],
        datesOnRequest: true,
        pricingPacks: [],
        coverImage: 'https://test.storage/cover.jpg',
        videoUrl: '',
        albumPhotos: [],
        galleryImages: [],
        included: [],
        includedServices: '',
        highlights: [],
        participantRequirements: '',
        itinerary: '',
        providerName: 'Prestador',
        providerPhone: '',
        providerCbuAlias: '',
        providerCuitDni: '',
        providerBankName: '',
        status: 'borrador',
        displayLocation: 'destacada',
      },
      requestPublication: true,
    });

    expect(submitSpy).toHaveBeenCalled();
    const reqPayload = submitSpy.mock.calls[0][0];
    expect(reqPayload.dates).toBe('A coordinar');
    expect(reqPayload.datesOnRequest).toBe(true);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Travesía a Coordinar',
        dates: [],
        datesOnRequest: true,
        status: 'pendiente_publicacion',
      }),
      true,
    );
  });

  it('should restore datesOnRequest from saved draft', async () => {
    const draftPayload = {
      formValue: {
        title: 'Experiencia Flexible Guardada',
        description: 'Descripción con longitud adecuada de más de treinta caracteres.',
      },
      dates: [],
      datesOnRequest: true,
      updatedAt: Date.now(),
    };

    localStorage.setItem(
      ProviderExperienceFormComponent.DRAFT_STORAGE_KEY,
      JSON.stringify(draftPayload),
    );

    await component.ngOnInit();
    fixture.detectChanges();

    expect(component.hasDraft()).toBe(true);
    const loaded = component.loadedExperience();
    expect(loaded).toBeTruthy();
    expect((loaded as any).datesOnRequest).toBe(true);
    expect(component.expFormComponent?.datesOnRequest()).toBe(true);
  });

  it('should not include slug in loadedExperience in provider edit mode', async () => {
    const existingExp = {
      id: 'exp-123',
      slug: 'ruta-oficial-super-larga-que-supera-los-cuarenta-caracteres-en-el-catalogo',
      title: 'Cabalgata Catamarca',
      tagline: 'Una cabalgata',
      description: 'Hermosa experiencia a caballo.',
      priceArs: 60000,
      status: 'publicada' as const,
    };
    vi.spyOn(store, 'getExperienceById').mockReturnValue(existingExp as any);

    // Mock activated route paramMap with id
    const route = TestBed.inject(ActivatedRoute);
    route.snapshot.paramMap.get = vi.fn().mockImplementation((k: string) => (k === 'id' ? 'exp-123' : null));

    await component.ngOnInit();
    fixture.detectChanges();

    expect(component.isEditMode()).toBe(true);
    expect(component.editingExpSlug()).toBe('ruta-oficial-super-larga-que-supera-los-cuarenta-caracteres-en-el-catalogo');
    const loaded = component.loadedExperience();
    expect(loaded).toBeTruthy();
    expect((loaded as any).slug).toBeUndefined();
    // The slug does not invalidate provider form
    expect(component.expFormComponent?.form.controls.slug.valid).toBe(true);
  });

  it('should not include slug in saveExperienceChanges updates when provider edits', async () => {
    component.isEditMode.set(true);
    component.editingExpId.set('exp-123');
    component.loadedExperience.set({ id: 'exp-123' } as any);

    const saveSpy = vi.spyOn(store, 'saveExperienceChanges').mockResolvedValue({ id: 'exp-123' } as any);

    await component.onSave({
      payload: {
        title: 'Cabalgata Modificada',
        shortTitle: 'Cabalgata Modificada',
        slug: 'slug-ignorado-en-provider-edit',
        tagline: 'Tagline',
        description: 'Descripción completa de más de treinta caracteres para pasar la validación.',
        category: 'expediciones',
        region: 'Valle Central y Ambato',
        meetingPoint: 'Punto',
        meetingPointUrl: '',
        difficulty: 'Baja',
        durationLabel: '2 horas',
        altitudeMeters: 850,
        priceArs: 50000,
        capacityPerDate: 10,
        dates: ['2026-12-20'],
        pricingPacks: [],
        coverImage: 'https://test.storage/cover.jpg',
        videoUrl: '',
        albumPhotos: [],
        galleryImages: [],
        included: [],
        includedServices: '',
        highlights: [],
        participantRequirements: '',
        itinerary: '',
        providerName: 'Prestador',
        providerPhone: '',
        providerCbuAlias: '',
        providerCuitDni: '',
        providerBankName: '',
        status: 'borrador',
        displayLocation: 'destacada',
      },
      requestPublication: false,
    });

    expect(saveSpy).toHaveBeenCalled();
    const passedUpdates = saveSpy.mock.calls[0][1] as any;
    expect(passedUpdates.slug).toBeUndefined();
    expect(passedUpdates.title).toBe('Cabalgata Modificada');
  });

  it('should block publication submission when dates are empty and datesOnRequest is false', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    const formComp = component.expFormComponent;
    expect(formComp).toBeTruthy();
    if (!formComp) return;

    formComp.form.patchValue({
      title: 'Expedición sin fechas',
      tagline: 'Una expedición sin fechas',
      description: 'Esta es una descripción detallada que tiene más de treinta caracteres para ser válida.',
      category: 'expediciones',
      region: 'Valle Central y Ambato',
      durationLabel: '3 horas',
      meetingPoint: 'Plaza principal',
      priceArs: 80000,
      capacityPerDate: 10,
    });
    formComp.dates.set([]);
    formComp.datesOnRequest.set(false);

    let emitted = false;
    formComp.saveExperience.subscribe(() => {
      emitted = true;
    });

    formComp.onSubmit(true);

    expect(emitted).toBe(false);
    expect(formComp.datesError()).toBeTruthy();
  });

  it('should allow publication submission without returning early when dates are on request', async () => {
    await component.ngOnInit();
    fixture.detectChanges();

    const formComp = component.expFormComponent;
    expect(formComp).toBeTruthy();
    if (!formComp) return;

    formComp.form.patchValue({
      title: 'Expedición a Coordinar',
      tagline: 'Una expedición flexible',
      description: 'Esta es una descripción detallada que tiene más de treinta caracteres para ser válida.',
      category: 'expediciones',
      region: 'Valle Central y Ambato',
      durationLabel: '3 horas',
      meetingPoint: 'Plaza principal',
      priceArs: 80000,
      capacityPerDate: 10,
    });
    formComp.dates.set([]);
    formComp.datesOnRequest.set(true);

    let emittedEvent: any = null;
    formComp.saveExperience.subscribe((event) => {
      emittedEvent = event;
    });

    formComp.onSubmit(true);

    expect(emittedEvent).toBeTruthy();
    expect(emittedEvent.requestPublication).toBe(true);
    expect(emittedEvent.payload.dates).toEqual([]);
    expect(emittedEvent.payload.datesOnRequest).toBe(true);
    expect(formComp.datesError()).toBeNull();
  });

  it('should propagate dates on request as "A coordinar" to submitExperienceRequest without requiring fixed dates', async () => {
    const submitSpy = vi.spyOn(store, 'submitExperienceRequest').mockResolvedValue({ id: 'prop-1' } as any);
    const createSpy = vi.spyOn(store, 'createExperience').mockReturnValue({ id: 'exp-1' } as any);

    await component.onSave({
      payload: {
        title: 'Travesía a Coordinar',
        shortTitle: 'Travesía a Coordinar',
        slug: 'travesia-a-coordinar',
        tagline: 'Salida flexible',
        description: 'Descripción completa de más de treinta caracteres para pasar la validación.',
        category: 'expediciones',
        region: 'Valle Central y Ambato',
        meetingPoint: 'Punto de encuentro a coordinar',
        meetingPointUrl: '',
        difficulty: 'Baja',
        durationLabel: '2 horas',
        altitudeMeters: 850,
        priceArs: 50000,
        capacityPerDate: 10,
        dates: [],
        datesOnRequest: true,
        pricingPacks: [],
        coverImage: 'https://test.storage/cover.jpg',
        videoUrl: '',
        albumPhotos: [],
        galleryImages: [],
        included: [],
        includedServices: '',
        highlights: [],
        participantRequirements: '',
        itinerary: '',
        providerName: 'Prestador',
        providerPhone: '',
        providerCbuAlias: '',
        providerCuitDni: '',
        providerBankName: '',
        status: 'borrador',
        displayLocation: 'destacada',
      },
      requestPublication: true,
    });

    expect(submitSpy).toHaveBeenCalled();
    const reqPayload = submitSpy.mock.calls[0][0];
    expect(reqPayload.dates).toBe('A coordinar');
    expect(reqPayload.datesOnRequest).toBe(true);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Travesía a Coordinar',
        dates: [],
        datesOnRequest: true,
        status: 'pendiente_publicacion',
      }),
      true,
    );
  });

  it('should restore datesOnRequest from saved draft', async () => {
    const draftPayload = {
      formValue: {
        title: 'Experiencia Flexible Guardada',
        description: 'Descripción con longitud adecuada de más de treinta caracteres.',
      },
      dates: [],
      datesOnRequest: true,
      updatedAt: Date.now(),
    };

    localStorage.setItem(
      ProviderExperienceFormComponent.DRAFT_STORAGE_KEY,
      JSON.stringify(draftPayload),
    );

    await component.ngOnInit();
    fixture.detectChanges();

    expect(component.hasDraft()).toBe(true);
    const loaded = component.loadedExperience();
    expect(loaded).toBeTruthy();
    expect((loaded as any).datesOnRequest).toBe(true);
    expect(component.expFormComponent?.datesOnRequest()).toBe(true);
  });
});
