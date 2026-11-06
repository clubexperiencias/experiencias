import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ExperiencePhotosComponent } from './experience-photos.component';
import { ExperienceAlbumPhoto } from '../../../core/models/experience.model';

describe('ExperiencePhotosComponent (/experiencias/:slug/fotos)', () => {
  let component: ExperiencePhotosComponent;
  let fixture: ComponentFixture<ExperiencePhotosComponent>;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    await TestBed.configureTestingModule({
      imports: [ExperiencePhotosComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => 'kayak' }, data: { slug: 'kayak' } },
            paramMap: of({ get: () => 'kayak' }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExperiencePhotosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and resolve kayak experience', () => {
    expect(component).toBeTruthy();
    expect(component.exp()).toBeTruthy();
    const heading = fixture.nativeElement.querySelector('.card-heading');
    expect(heading).toBeTruthy();
    expect(heading.textContent).toContain('Galería de Travesía en Kayak');
  });

  it('should resolve album photos capped at maximum 12 photos', () => {
    const photos = component.albumPhotos();
    expect(photos.length).toBeGreaterThan(0);
    expect(photos.length).toBeLessThanOrEqual(12);
  });

  it('should identify exactly 1 cover photo and display it prominently', () => {
    const cover = component.coverPhoto();
    expect(cover).toBeTruthy();
    expect(cover?.isCover).toBe(true);

    const coverTag = fixture.nativeElement.querySelector('.tag-portada');
    expect(coverTag).toBeTruthy();
    expect(coverTag.textContent).toContain('PORTADA OFICIAL');
  });

  it('should identify exactly 2 featured photos in the 2-column grid', () => {
    const featured = component.featuredPhotos();
    expect(featured.length).toBe(2);

    const featuredTags = fixture.nativeElement.querySelectorAll('.tag-destacada');
    expect(featuredTags.length).toBe(2);
  });

  it('should open and close the lightbox modal on click and keyboard events', () => {
    const cover = component.coverPhoto();
    expect(cover).toBeTruthy();

    component.openLightbox(cover!);
    fixture.detectChanges();
    expect(component.activePhotoIndex()).toBe(0);
    expect(component.activeModalPhoto()?.id).toBe(cover!.id);

    // Navigate to next
    component.nextPhoto();
    fixture.detectChanges();
    expect(component.activePhotoIndex()).toBe(1);

    // Navigate to prev
    component.prevPhoto();
    fixture.detectChanges();
    expect(component.activePhotoIndex()).toBe(0);

    // Close on escape
    component.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(component.activePhotoIndex()).toBeNull();
  });

  it('should correctly detect HTTP and HTTPS URLs with isUrl', () => {
    expect(component.isUrl('https://maps.google.com/?q=Catamarca')).toBe(true);
    expect(component.isUrl('http://maps.google.com/?q=Catamarca')).toBe(true);
    expect(component.isUrl('   https://maps.google.com/?q=Catamarca   ')).toBe(true);
    expect(component.isUrl('Dique El Jumeal')).toBe(false);
    expect(component.isUrl('')).toBe(false);
    expect(component.isUrl(undefined)).toBe(false);
  });
});
