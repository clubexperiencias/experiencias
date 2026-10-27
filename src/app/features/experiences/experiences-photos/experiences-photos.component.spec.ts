import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ExperiencesPhotosComponent } from './experiences-photos.component';

describe('ExperiencesPhotosComponent (/experiencias/fotos)', () => {
  let component: ExperiencesPhotosComponent;
  let fixture: ComponentFixture<ExperiencesPhotosComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ExperiencesPhotosComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ExperiencesPhotosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and display main heading and breadcrumbs', () => {
    expect(component).toBeTruthy();
    const title = fixture.nativeElement.querySelector('.editorial-title');
    expect(title).toBeTruthy();
    expect(title.textContent).toContain('Fotos Destacadas de Nuestras Travesías');

    const breadcrumb = fixture.nativeElement.querySelector('.breadcrumb-bar');
    expect(breadcrumb).toBeTruthy();
    expect(breadcrumb.textContent).toContain('Fotos Destacadas');
  });

  it('should render collage photo cards with admin curated badges', () => {
    const cards = fixture.nativeElement.querySelectorAll('.collage-card');
    expect(cards.length).toBeGreaterThanOrEqual(4);

    const badges = fixture.nativeElement.querySelectorAll('.admin-curated-badge');
    expect(badges.length).toBeGreaterThan(0);
    expect(badges[0].textContent).toContain('DESTACADA');
  });

  it('should filter photos by experience', () => {
    component.setFilter('kayak');
    fixture.detectChanges();
    const kayakPhotos = component.filteredPhotos();
    expect(kayakPhotos.every((p) => p.experienceSlug === 'kayak')).toBe(true);

    component.setFilter('pomez');
    fixture.detectChanges();
    const pomezPhotos = component.filteredPhotos();
    expect(pomezPhotos.every((p) => p.experienceSlug === 'pomez')).toBe(true);
  });

  it('should open and close the lightbox modal', () => {
    const firstPhoto = component.featuredPhotos[0];
    component.openPhotoModal(firstPhoto);
    fixture.detectChanges();

    expect(component.activeModalPhoto()).toBe(firstPhoto);
    const modal = fixture.nativeElement.querySelector('.lightbox-modal-card');
    expect(modal).toBeTruthy();
    expect(modal.textContent).toContain(firstPhoto.title);

    component.closePhotoModal();
    fixture.detectChanges();
    expect(component.activeModalPhoto()).toBeNull();
  });
});
