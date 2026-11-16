import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { ProvidersCatalogComponent } from './providers-catalog.component';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { ProviderRatingService } from '../../../core/services/provider-rating.service';
import { NewsletterService } from '../../../core/services/newsletter.service';
import { ProviderUser } from '../../../core/models/bank-transfer.model';

describe('ProvidersCatalogComponent - Rating Sorting', () => {
  let component: ProvidersCatalogComponent;
  let fixture: ComponentFixture<ProvidersCatalogComponent>;

  const providerWithVotesA: ProviderUser = {
    id: 'prov-a',
    slug: 'prov-a',
    name: 'Prestador A (Calificado)',
    agency: 'Agencia A',
    active: true,
  } as ProviderUser;

  const providerWithVotesC: ProviderUser = {
    id: 'prov-c',
    slug: 'prov-c',
    name: 'Prestador C (Calificado Menor)',
    agency: 'Agencia C',
    active: true,
  } as ProviderUser;

  const providerZeroVotesB: ProviderUser = {
    id: 'prov-b',
    slug: 'prov-b',
    name: 'Prestador B (Sin Votos)',
    agency: 'Agencia B',
    active: true,
  } as ProviderUser;

  const mockProviders = signal<ProviderUser[]>([
    providerZeroVotesB,
    providerWithVotesC,
    providerWithVotesA,
  ]);

  const mockProviderStore = {
    providers: mockProviders,
    loadPublicProviders: vi.fn().mockResolvedValue([]),
  };

  const mockExperiences = signal<any[]>([]);
  const mockExpService = {
    remoteLoadPromise: Promise.resolve(),
    experiences: mockExperiences,
    publishedExperiences: signal<any[]>([]),
    getExperiencesByProvider: vi.fn().mockReturnValue([]),
  };

  const mockRatingService = {
    ratingToast: signal(null),
    getRating: vi.fn().mockImplementation((p: ProviderUser) => {
      if (p.id === 'prov-a') {
        return { score: 4.8, count: 10 };
      }
      if (p.id === 'prov-c') {
        return { score: 4.2, count: 5 };
      }
      // Sin votos: baseScore por defecto 5.0 pero count 0
      return { score: 5.0, count: 0 };
    }),
  };

  const mockNewsletter = {
    currentMember: signal(null),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProvidersCatalogComponent],
      providers: [
        provideRouter([]),
        { provide: ProviderStoreService, useValue: mockProviderStore },
        { provide: ExperienceService, useValue: mockExpService },
        { provide: ProviderRatingService, useValue: mockRatingService },
        { provide: NewsletterService, useValue: mockNewsletter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProvidersCatalogComponent);
    component = fixture.componentInstance;
  });

  it('should rank providers with zero votes below providers with real ratings when sorting by rating', () => {
    component.selectedSort.set('rating');
    const sorted = component.filteredAllProviders();

    // Provider A (4.8, 10 votes) should be first
    expect(sorted[0].id).toBe('prov-a');
    // Provider C (4.2, 5 votes) should be second
    expect(sorted[1].id).toBe('prov-c');
    // Provider B (5.0 default score, but 0 votes) should be last
    expect(sorted[2].id).toBe('prov-b');
  });

  it('should use experience count as tie-breaker for providers with equal votes status', () => {
    const unvoted1: ProviderUser = {
      id: 'unvoted-1',
      slug: 'unvoted-1',
      name: 'Unvoted 1 Exp',
      active: true,
    } as ProviderUser;

    const unvoted2: ProviderUser = {
      id: 'unvoted-2',
      slug: 'unvoted-2',
      name: 'Unvoted 3 Exps',
      active: true,
    } as ProviderUser;

    mockProviders.set([unvoted1, unvoted2]);
    mockExpService.experiences.set([
      { id: 'exp-1', providerId: 'unvoted-1', status: 'publicada' },
      { id: 'exp-2', providerId: 'unvoted-2', status: 'publicada' },
      { id: 'exp-3', providerId: 'unvoted-2', status: 'publicada' },
      { id: 'exp-4', providerId: 'unvoted-2', status: 'publicada' },
    ]);

    component.selectedSort.set('rating');
    const sorted = component.filteredAllProviders();

    // Both have 0 votes, so tie-breaker is experience count: unvoted2 has 3 experiences vs unvoted1 with 1
    expect(sorted[0].id).toBe('unvoted-2');
    expect(sorted[1].id).toBe('unvoted-1');
  });

  it('should cancel delayed carousel callbacks and avoid starting autoplay or attaching listeners after destruction', () => {
    vi.useFakeTimers();

    const startAutoplaySpy = vi.spyOn(component, 'startAutoplay');

    // Trigger ngAfterViewInit with loading = false
    component.loading.set(false);
    component.ngAfterViewInit();

    // Verify timer was scheduled
    expect((component as any).carouselInitTimer).not.toBeNull();

    // Destroy component before timeout fires
    component.ngOnDestroy();
    expect((component as any).isDestroyed).toBe(true);
    expect((component as any).carouselInitTimer).toBeNull();

    // Fast forward time past 60ms and 80ms
    vi.advanceTimersByTime(200);

    // Autoplay should NOT have been started after destruction
    expect(startAutoplaySpy).not.toHaveBeenCalled();

    // Calling startAutoplay directly while destroyed should be a no-op
    component.startAutoplay();
    expect((component as any).autoplayTimer).toBeNull();

    vi.useRealTimers();
  });

  describe('getProviderTier and getProviderRubro', () => {
    it('should keep identity checks first for Club de Experiencias', () => {
      const clubProvider: ProviderUser = {
        id: 'prov-club-oficial',
        slug: 'club-de-experiencias',
        tier: 'emergente', // Even if tier says emergente, identity check gives fundador
      } as ProviderUser;

      expect(component.getProviderTier(clubProvider)).toBe('fundador');
    });

    it('should return p.tier when it is one of the supported tiers before applying fallback rules', () => {
      // Provider with experiences count > 0, but explicitly set as emergente
      const emergenteProvider: ProviderUser = {
        id: 'prov-explicit-emergente',
        slug: 'explicit-emergente',
        tier: 'emergente',
        verified: true,
      } as ProviderUser;
      mockExpService.getExperiencesByProvider.mockReturnValue([{ id: 'exp-1' }]);

      // Should return 'emergente' rather than falling back to 'pleno' due to count/verified
      expect(component.getProviderTier(emergenteProvider)).toBe('emergente');

      const plenoProvider: ProviderUser = {
        id: 'prov-explicit-pleno',
        slug: 'explicit-pleno',
        tier: 'pleno',
      } as ProviderUser;
      expect(component.getProviderTier(plenoProvider)).toBe('pleno');

      const fundadorProvider: ProviderUser = {
        id: 'prov-explicit-fundador',
        slug: 'explicit-fundador',
        tier: 'fundador',
      } as ProviderUser;
      expect(component.getProviderTier(fundadorProvider)).toBe('fundador');
    });

    it('should apply fallback rules when p.tier is undefined', () => {
      mockExpService.getExperiencesByProvider.mockReturnValue([]);
      const fallbackProvider: ProviderUser = {
        id: 'prov-fallback',
        notes: 'socio fundador de la red',
      } as ProviderUser;
      expect(component.getProviderTier(fallbackProvider)).toBe('fundador');

      const plenoFallback: ProviderUser = {
        id: 'prov-pleno-fallback',
        verified: true,
      } as ProviderUser;
      expect(component.getProviderTier(plenoFallback)).toBe('pleno');
    });

    it('should return non-empty p.rubro before keyword matching', () => {
      const providerWithCustomRubro: ProviderUser = {
        id: 'prov-custom-rubro',
        rubro: 'Gastronomía & Viñedos',
        bio: 'Hacemos trekking y alta montaña', // Keywords that would match 'Alta Montaña & Trekking'
      } as ProviderUser;

      expect(component.getProviderRubro(providerWithCustomRubro)).toBe('Gastronomía & Viñedos');
    });

    it('should fall back to keyword matching when p.rubro is empty or whitespace', () => {
      const providerKeywordMatching: ProviderUser = {
        id: 'prov-keyword',
        rubro: '   ',
        bio: 'Hacemos travesías en kayak por el dique',
      } as ProviderUser;

      expect(component.getProviderRubro(providerKeywordMatching)).toBe('Kayak & Náutica');
    });
  });
});

