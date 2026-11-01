import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProviderExperienceAlbumModalComponent } from './provider-experience-album-modal.component';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { ProviderExperience } from '../../../core/models/bank-transfer.model';

describe('ProviderExperienceAlbumModalComponent', () => {
  let component: ProviderExperienceAlbumModalComponent;
  let fixture: ComponentFixture<ProviderExperienceAlbumModalComponent>;
  let store: ProviderStoreService;

  const mockExperience: ProviderExperience = {
    id: 'exp-test',
    slug: 'exp-test',
    title: 'Experiencia de Prueba',
    tagline: 'Una bajada de prueba',
    description: 'Descripción completa',
    region: 'Valle Central',
    meetingPoint: 'Punto de encuentro',
    difficulty: 'Baja',
    durationLabel: '3 horas',
    priceArs: 50000,
    capacityPerDate: 10,
    dates: ['2026-11-20'],
    status: 'publicada',
    providerId: 'prov-1',
    providerName: 'Guía de Catamarca',
    coverImage: '/assets/images/kayak-club-de-experiencias.jpg',
    createdAt: '2026-10-01T00:00:00.000Z',
    albumPhotos: [
      {
        id: 'p1',
        url: '/assets/images/kayak-club-de-experiencias.jpg',
        title: 'Foto 1',
        caption: 'Portada',
        isCover: true,
        isFeatured: false,
        order: 1,
      },
      {
        id: 'p2',
        url: '/assets/images/dron.jpg',
        title: 'Foto 2',
        caption: 'Destacada 1',
        isCover: false,
        isFeatured: true,
        order: 2,
      },
      {
        id: 'p3',
        url: '/assets/images/amigos.jpg',
        title: 'Foto 3',
        caption: 'Destacada 2',
        isCover: false,
        isFeatured: true,
        order: 3,
      },
    ],
  };

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    await TestBed.configureTestingModule({
      imports: [ProviderExperienceAlbumModalComponent],
      providers: [provideRouter([]), ProviderStoreService],
    }).compileComponents();

    store = TestBed.inject(ProviderStoreService);
    fixture = TestBed.createComponent(ProviderExperienceAlbumModalComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('experience', mockExperience);
    fixture.detectChanges();
  });

  it('should initialize with the experience photos', () => {
    expect(component).toBeTruthy();
    expect(component.totalCount()).toBe(3);
    expect(component.coverCount()).toBe(1);
    expect(component.featuredCount()).toBe(2);
    expect(component.isFormValid()).toBe(true);
  });

  it('should allow setting a new cover photo and keep exactly 1 cover', () => {
    component.setCover('p2');
    fixture.detectChanges();

    expect(component.coverCount()).toBe(1);
    const p2 = component.photos().find((p) => p.id === 'p2');
    expect(p2?.isCover).toBe(true);
    expect(p2?.isFeatured).toBe(false);

    const p1 = component.photos().find((p) => p.id === 'p1');
    expect(p1?.isCover).toBe(false);
  });

  it('should restrict featured photos to a maximum of 2', () => {
    // Add a 4th photo
    component.newPhotoUrl.set('/assets/images/dique.jpg');
    component.addPhotoByUrl();
    fixture.detectChanges();

    const p4 = component.photos()[3];
    expect(component.featuredCount()).toBe(2);

    // Attempting to feature a 3rd photo should set validation error
    component.toggleFeatured(p4.id);
    fixture.detectChanges();

    expect(component.featuredCount()).toBe(2);
    expect(component.validationError()).toContain('2 fotos seleccionadas como destacadas');
  });

  it('should not allow exceeding the 12 photos limit', () => {
    // Fill up to 12
    while (component.photos().length < 12) {
      component.newPhotoUrl.set(`/assets/images/extra-${component.photos().length}.jpg`);
      component.addPhotoByUrl();
    }
    expect(component.totalCount()).toBe(12);
    expect(component.canAddMore()).toBe(false);

    // Attempt to add 13th
    component.newPhotoUrl.set('/assets/images/extra-13.jpg');
    component.addPhotoByUrl();
    expect(component.totalCount()).toBe(12);
    expect(component.validationError()).toContain('límite máximo de 12 fotos');
  });

  it('should call store.updateExperienceAlbum on valid save', () => {
    const updateSpy = vi.spyOn(store, 'updateExperienceAlbum');
    let emitted = false;
    component.saved.subscribe(() => {
      emitted = true;
    });

    component.saveAlbum();
    expect(updateSpy).toHaveBeenCalledWith(mockExperience.id, expect.any(Array));
    expect(emitted).toBe(true);
  });
});
