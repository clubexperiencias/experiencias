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
      providers: [provideRouter([])]
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
    const hrefs = Array.from(links).map((l: any) => l.getAttribute('routerlink') || l.getAttribute('href'));
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

  it('should render 3 photos in the same row below the portada replicating the image', () => {
    const photosGrid = fixture.nativeElement.querySelector('.photos-grid');
    expect(photosGrid).toBeTruthy();

    const items = fixture.nativeElement.querySelectorAll('.photo-card-item');
    expect(items.length).toBe(3);

    const thumbImgs = fixture.nativeElement.querySelectorAll('.gallery-thumb-img');
    expect(thumbImgs.length).toBe(3);
    thumbImgs.forEach((img: HTMLImageElement) => {
      expect(img.getAttribute('src')).toBe('/assets/images/kayak-club-de-experiencias.jpg');
    });
  });
});
