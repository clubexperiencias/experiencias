import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ExperienceDetailComponent } from './experience-detail.component';
import { KAYAK_DEFAULT_EXPERIENCE, STORAGE_KEY } from '../../../core/services/experience.service';

describe('ExperienceDetailComponent (/experiencias/:slug)', () => {
  let component: ExperienceDetailComponent;
  let fixture: ComponentFixture<ExperienceDetailComponent>;

  beforeEach(async () => {
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
            snapshot: { paramMap: { get: () => 'kayak' } },
            paramMap: of({ get: () => 'kayak' }),
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
  });

  it('should render VER ÁLBUM COMPLETO button before the photo count in the overlay', () => {
    const overlay = fixture.nativeElement.querySelector('.album-preview-overlay');
    expect(overlay).toBeTruthy();
    const children = overlay.children;
    expect(children.length).toBe(2);
    expect(children[0].classList.contains('album-preview-cta')).toBe(true);
    expect(children[0].textContent).toContain('VER ÁLBUM COMPLETO');
    expect(children[1].classList.contains('album-preview-count')).toBe(true);
    expect(children[1].textContent).toContain('fotos en el álbum');
  });
});
