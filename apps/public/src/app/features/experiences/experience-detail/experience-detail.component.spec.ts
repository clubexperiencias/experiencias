import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router, convertToParamMap, ParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { ExperienceDetailComponent } from './experience-detail.component';
import { KAYAK_DEFAULT_EXPERIENCE, STORAGE_KEY } from '../../../core/services/experience.service';

describe('ExperienceDetailComponent (/experiencias/:slug)', () => {
  let component: ExperienceDetailComponent;
  let fixture: ComponentFixture<ExperienceDetailComponent>;
  const paramMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({ slug: 'kayak' }));

  beforeEach(async () => {
    paramMap$.next(convertToParamMap({ slug: 'kayak' }));
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([KAYAK_DEFAULT_EXPERIENCE]),
      );
    }
    await TestBed.configureTestingModule({
      imports: [ExperienceDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ slug: 'kayak' }) },
            paramMap: paramMap$.asObservable(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExperienceDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and display experience heading', () => {
    expect(component).toBeTruthy();
    expect(component.exp()).toBeTruthy();
    const heading = fixture.nativeElement.querySelector('.card-heading');
    expect(heading).toBeTruthy();
    expect(heading.textContent).toContain('Travesía en Kayak');
  });

  it('should generate breadcrumb items for the experience', () => {
    const crumbs = component.breadcrumbs();
    expect(crumbs.length).toBe(3);
    expect(crumbs[0].url).toBe('/');
    expect(crumbs[1].url).toBe('/experiencias');
    expect(crumbs[2].label).toContain('Kayak');
  });

  it('should link to payment route for this experience', () => {
    expect(component.paymentRoute()).toBe('/experiencias/kayak/pago');
    const payBtns = fixture.nativeElement.querySelectorAll('.cta-blue-btn');
    expect(payBtns.length).toBeGreaterThan(0);
  });

  it('should count album photos including cover image', () => {
    // KAYAK_DEFAULT_EXPERIENCE has coverImage + 5 photos in KAYAK_ALBUM_PHOTOS (one of which has isCover: true)
    expect(component.albumPhotosCount()).toBe(5);

    // If experience has 2 album photos without cover, albumPhotosCount should be 2 + 1 = 3
    const customExp: any = {
      ...KAYAK_DEFAULT_EXPERIENCE,
      coverImage: '/assets/images/cover.jpg',
      albumPhotos: [
        { id: '1', url: '/assets/images/foto1.jpg', isCover: false },
        { id: '2', url: '/assets/images/foto2.jpg', isCover: false },
      ],
    };
    (component.experienceService as any)._experiences.set([customExp]);
    fixture.detectChanges();
    expect(component.albumPhotosCount()).toBe(3);

    // Cap at 12 when album has more than 12 photos
    const largeAlbumExp: any = {
      ...KAYAK_DEFAULT_EXPERIENCE,
      coverImage: '/assets/images/cover.jpg',
      albumPhotos: Array.from({ length: 15 }, (_, i) => ({
        id: `p-${i}`,
        url: `/assets/images/p-${i}.jpg`,
        isCover: i === 0,
      })),
    };
    (component.experienceService as any)._experiences.set([largeAlbumExp]);
    fixture.detectChanges();
    expect(component.albumPhotosCount()).toBe(12);
  });

  it('should render photo count on the left of overlay and Ver Álbum Completo button below image inside box', () => {
    const overlay = fixture.nativeElement.querySelector('.album-preview-overlay');
    expect(overlay).toBeTruthy();
    const count = overlay.querySelector('.album-preview-count');
    expect(count).toBeTruthy();
    expect(count.textContent).toContain('fotos en el álbum');

    const ctaBtn = fixture.nativeElement.querySelector('.album-preview-actions .album-preview-cta');
    expect(ctaBtn).toBeTruthy();
    expect(ctaBtn.textContent).toContain('Ver Álbum Completo');
  });

  it('should redirect to canonical clean slug if navigated via initial slug', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const testExp = {
      ...KAYAK_DEFAULT_EXPERIENCE,
      id: 'exp-different-id',
      slug: 'kayak-clean',
      initialSlug: 'kayak-prop-12345678',
      slugAliases: ['kayak-alias'],
    };
    (component.experienceService as any)._experiences.set([testExp]);

    paramMap$.next(convertToParamMap({ slug: 'kayak-prop-12345678' }));
    fixture.detectChanges();
    TestBed.flushEffects();

    expect(navigateSpy).toHaveBeenCalledWith(
      ['/experiencias', 'kayak-clean'],
      expect.objectContaining({ replaceUrl: true }),
    );
  });

  it('should redirect to canonical clean slug if navigated via alias', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const testExp = {
      ...KAYAK_DEFAULT_EXPERIENCE,
      id: 'exp-different-id',
      slug: 'kayak-clean',
      initialSlug: 'kayak-prop-12345678',
      slugAliases: ['kayak-alias'],
    };
    (component.experienceService as any)._experiences.set([testExp]);

    paramMap$.next(convertToParamMap({ slug: 'kayak-alias' }));
    fixture.detectChanges();
    TestBed.flushEffects();

    expect(navigateSpy).toHaveBeenCalledWith(
      ['/experiencias', 'kayak-clean'],
      expect.objectContaining({ replaceUrl: true }),
    );
  });
});
