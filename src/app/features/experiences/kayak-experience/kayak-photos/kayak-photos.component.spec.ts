import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { KayakPhotosComponent } from './kayak-photos.component';

describe('KayakPhotosComponent (/experiencias/kayak/fotos)', () => {
  let component: KayakPhotosComponent;
  let fixture: ComponentFixture<KayakPhotosComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [KayakPhotosComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(KayakPhotosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and display main heading', () => {
    expect(component).toBeTruthy();
    const heading = fixture.nativeElement.querySelector('.card-heading');
    expect(heading).toBeTruthy();
    expect(heading.textContent).toContain('Galería de Travesías en Las Pirquitas');
  });

  it('should render breadcrumb with links to /, /experiencias, and /experiencias/kayak', () => {
    const breadcrumb = fixture.nativeElement.querySelector('.breadcrumb-bar');
    expect(breadcrumb).toBeTruthy();

    const links = breadcrumb.querySelectorAll('.bc-link');
    const hrefs = Array.from(links).map(
      (l: any) => l.getAttribute('routerlink') || l.getAttribute('href'),
    );
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/experiencias');
    expect(hrefs).toContain('/experiencias/kayak');

    const current = breadcrumb.querySelector('.bc-current');
    expect(current).toBeTruthy();
    expect(current.textContent).toContain('Galería de Fotos');
  });

  it('should open and close the photo lightbox modal', () => {
    const firstPhoto = component.photos[0];
    component.openPhotoModal(firstPhoto);
    fixture.detectChanges();

    expect(component.activePhotoModal()).toBe(firstPhoto);
    const lightbox = fixture.nativeElement.querySelector('.photo-lightbox-backdrop');
    expect(lightbox).toBeTruthy();

    component.closePhotoModal();
    fixture.detectChanges();
    expect(component.activePhotoModal()).toBeNull();
  });

  it('should display the ad banner linking to /socios/fundadores', () => {
    const adBanner = fixture.nativeElement.querySelector('.kayak-ad-wrapper');
    expect(adBanner).toBeTruthy();

    const link = fixture.nativeElement.querySelector('.ad-banner-link');
    expect(link).toBeTruthy();
    expect(link.getAttribute('routerlink') || link.getAttribute('href')).toBe('/socios/fundadores');

    const adImg = fixture.nativeElement.querySelector('.ad-banner-img');
    expect(adImg).toBeTruthy();
    expect(adImg.getAttribute('src')).toContain('ad.png');
  });

  it('should render exactly 2 featured boxes below portada with DESTACADA tag and photographer credit', () => {
    const photosGrid = fixture.nativeElement.querySelector('.photos-grid-2cols');
    expect(photosGrid).toBeTruthy();

    const items = fixture.nativeElement.querySelectorAll('.photo-card-item');
    expect(items.length).toBe(2);

    const portadaTag = fixture.nativeElement.querySelector('.media-tag');
    expect(portadaTag.textContent.trim()).toBe('DESTACADA');

    const kicker = fixture.nativeElement.querySelector('.media-caption-kicker');
    expect(kicker.textContent).toContain('Fotógrafo:');

    const credits = fixture.nativeElement.querySelectorAll('.photo-item-credit');
    expect(credits.length).toBe(2);
    expect(credits[0].textContent).toContain('Fotógrafo: Marcos T. · Guía & Fotografía');

    const tags = fixture.nativeElement.querySelectorAll('.photo-tag');
    expect(tags.length).toBe(2);
    tags.forEach((tag: HTMLElement) => {
      expect(tag.textContent.trim()).toBe(portadaTag.textContent.trim());
    });
  });

  it('should render community section with 3x3 grid (9 photos) all tagged DESTACADA POR EL EQUIPO and author above title', () => {
    const communitySection = fixture.nativeElement.querySelector('.community-photos-section');
    expect(communitySection).toBeTruthy();
    expect(communitySection.textContent).toContain('Fotos de la Comunidad');

    const communityItems = fixture.nativeElement.querySelectorAll('.community-card-item');
    expect(communityItems.length).toBe(9);

    const communityBadges = fixture.nativeElement.querySelectorAll('.community-badge');
    expect(communityBadges.length).toBe(9);
    communityBadges.forEach((badge: HTMLElement) => {
      expect(badge.textContent.trim()).toBe('DESTACADA POR EL EQUIPO');
    });

    const authors = fixture.nativeElement.querySelectorAll('.community-photo-author');
    expect(authors.length).toBe(9);
    expect(authors[0].textContent).toContain('Autor: Valentina M. · Socio Pleno');
  });

  it('should include bottom download button, side navigation arrows, and remove top download button', () => {
    const list = component.featuredGroup;
    const firstPhoto = list[0];
    component.openPhotoModal(firstPhoto, list);
    fixture.detectChanges();

    const downloadBtn = fixture.nativeElement.querySelector('.lightbox-download-action-btn');
    expect(downloadBtn).toBeTruthy();

    const topDownloadBtn = fixture.nativeElement.querySelector('.lightbox-icon-btn.download-btn');
    expect(topDownloadBtn).toBeNull();

    const nextBtn = fixture.nativeElement.querySelector('.lightbox-nav-btn.next-btn');
    const prevBtn = fixture.nativeElement.querySelector('.lightbox-nav-btn.prev-btn');
    expect(nextBtn).toBeTruthy();
    expect(prevBtn).toBeTruthy();

    // Verify next and prev photo navigation
    expect(component.currentPhotoIndex()).toBe(0);
    component.nextPhoto();
    expect(component.currentPhotoIndex()).toBe(1);
    expect(component.activePhotoModal()).toBe(list[1]);

    component.prevPhoto();
    expect(component.currentPhotoIndex()).toBe(0);
    expect(component.activePhotoModal()).toBe(list[0]);

    // Verify landscape class is applied
    const lightboxImg = fixture.nativeElement.querySelector('.lightbox-img');
    expect(lightboxImg.classList.contains('is-landscape')).toBe(true);

    // Spy on document.createElement to ensure downloadPhoto runs cleanly
    const createElementSpy = vi.spyOn(document, 'createElement');
    component.downloadPhoto(firstPhoto);
    expect(createElementSpy).toHaveBeenCalledWith('a');

    // Test community photo in modal: no tag, no description
    component.openPhotoModal(component.communityPhotos[0], component.communityPhotos);
    fixture.detectChanges();
    const modalTag = fixture.nativeElement.querySelector('.lightbox-tag');
    expect(modalTag).toBeNull();
    const modalDesc = fixture.nativeElement.querySelector('.lightbox-caption-text p');
    expect(modalDesc).toBeNull();
  });
});
