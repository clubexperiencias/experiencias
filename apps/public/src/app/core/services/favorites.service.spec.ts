import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { FavoritesService } from './favorites.service';
import { NewsletterService } from './newsletter.service';
import { ExperienceService } from './experience.service';
import { Experience } from '../models/experience.model';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let mockNewsletter: any;
  let mockExperienceService: any;
  let mockSupabase: any;
  let currentMemberSignal: any;

  const mockExp: Experience = {
    id: 'exp-kayak-1',
    slug: 'kayak-las-jumeal',
    title: 'Kayak en Las Jumeal',
    tagline: 'Aventura acuática',
    description: 'Paseo en kayak',
    region: 'Valle Central',
    difficulty: 'Baja',
    durationDays: 1,
    durationLabel: '2 Horas',
    altitudeMeters: 500,
    priceArs: 15000,
    priceUsd: 15,
    maxSpotsPerGroup: 10,
    coverImage: '/img.jpg',
    galleryImages: [],
    highlights: [],
    included: [],
    status: 'publicada',
    isExclusiveClub: true,
  };

  beforeEach(() => {
    localStorage.clear();

    currentMemberSignal = signal<any>({
      email: 'socio@experiencias.club',
      fullName: 'Socio Test',
      experiencesWishlist: ['kayak-las-jumeal', 'trekking-antofagasta'],
    });

    mockNewsletter = {
      currentMember: currentMemberSignal,
      isSubscribed: () => true,
      persistCurrentMember: vi.fn(),
      updateCurrentMemberWishlist: vi.fn().mockImplementation((wishlist: string[]) => {
        const cur = currentMemberSignal();
        if (cur) {
          currentMemberSignal.set({ ...cur, experiencesWishlist: [...wishlist] });
        }
      }),
      updateMemberProfile: vi.fn().mockResolvedValue({ success: true }),
    };

    mockExperienceService = {
      experiences: () => [mockExp],
      updateFavoritesCount: vi.fn(),
    };

    mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: { is_favorite: true, favorites_count: 5 },
        error: null,
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        FavoritesService,
        { provide: NewsletterService, useValue: mockNewsletter },
        { provide: ExperienceService, useValue: mockExperienceService },
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      ],
    });

    service = TestBed.inject(FavoritesService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should initialize favorites from member wishlist', () => {
    TestBed.flushEffects();
    expect(service.isFavorite(mockExp)).toBe(true);
    expect(service.isFavorite('trekking-antofagasta')).toBe(true);
  });

  it('should ignore generic registration survey keys when merging member wishlist', () => {
    currentMemberSignal.set({
      email: 'survey-socio@experiencias.club',
      fullName: 'Socio Survey',
      experiencesWishlist: ['kayak', 'galan', 'seismiles', 'pissis', 'termas', 'astroturismo', 'otros', 'kayak-las-jumeal'],
    });
    TestBed.flushEffects();

    expect(service.isFavorite('kayak')).toBe(false);
    expect(service.isFavorite('galan')).toBe(false);
    expect(service.isFavorite('seismiles')).toBe(false);
    expect(service.isFavorite('pissis')).toBe(false);
    expect(service.isFavorite('termas')).toBe(false);
    expect(service.isFavorite('astroturismo')).toBe(false);
    expect(service.isFavorite('otros')).toBe(false);
    expect(service.isFavorite('kayak-las-jumeal')).toBe(true);
  });

  it('should ignore survey interest keys even if they share name with experiences when merging registration wishlist', () => {
    const kayakExp: Experience = {
      ...mockExp,
      id: 'exp-kayak',
      slug: 'kayak',
      title: 'Kayak Travesía',
    };
    mockExperienceService.experiences = () => [mockExp, kayakExp];

    // Simula caché local vacía y wishlist entrante con opciones de encuesta de registro
    currentMemberSignal.set({
      email: 'empty-cache@experiencias.club',
      fullName: 'Socio Empty Cache',
      experiencesWishlist: ['galan', 'kayak', 'astroturismo'],
    });
    TestBed.flushEffects();

    // Las respuestas de encuesta nunca deben auto-convertirse en favoritos
    expect(service.isFavorite('kayak')).toBe(false);
    expect(service.isFavorite('galan')).toBe(false);
    expect(service.isFavorite('astroturismo')).toBe(false);
    expect(service.favoriteSlugs()).toEqual([]);
  });

  it('should remove previously persisted survey-derived favorites on loadStoredFavorites while preserving genuine experiences', () => {
    const kayakExp: Experience = {
      ...mockExp,
      id: 'exp-kayak',
      slug: 'kayak',
      title: 'Kayak Travesía',
    };
    mockExperienceService.experiences = () => [mockExp, kayakExp];

    const storageKey = 'catamarca_user_favorites_v1_socio-persisted@experiencias.club';
    localStorage.setItem(
      storageKey,
      JSON.stringify(['galan', 'astroturismo', 'kayak', 'kayak-las-jumeal']),
    );

    currentMemberSignal.set({
      email: 'socio-persisted@experiencias.club',
      fullName: 'Socio Persisted',
      experiencesWishlist: [],
    });
    TestBed.flushEffects();

    expect(service.favoriteSlugs()).toEqual(['kayak', 'kayak-las-jumeal']);
    expect(service.isFavorite('kayak')).toBe(true);
    expect(service.isFavorite('kayak-las-jumeal')).toBe(true);
    expect(service.isFavorite('galan')).toBe(false);
    expect(service.isFavorite('astroturismo')).toBe(false);

    // Verifica que se haya guardado la lista depurada en localStorage
    const savedInStorage = JSON.parse(localStorage.getItem(storageKey) || '[]');
    expect(savedInStorage).toEqual(['kayak', 'kayak-las-jumeal']);
  });

  it('should not re-add a removed favorite when receiving a stale member refresh', () => {
    TestBed.flushEffects();
    expect(service.isFavorite(mockExp)).toBe(true);

    // Remove the favorite
    service.removeFavorite(mockExp);
    expect(service.isFavorite(mockExp)).toBe(false);

    // Simulate stale member refresh still containing the old wishlist
    currentMemberSignal.set({
      email: 'socio@experiencias.club',
      fullName: 'Socio Test',
      experiencesWishlist: ['kayak-las-jumeal', 'trekking-antofagasta'],
    });
    TestBed.flushEffects();

    // The removed favorite must NOT be re-added
    expect(service.isFavorite(mockExp)).toBe(false);
    expect(service.isFavorite('trekking-antofagasta')).toBe(true);
  });

  it('should allow re-adding an experience after it was removed', () => {
    TestBed.flushEffects();

    // 1. Remove
    service.removeFavorite(mockExp);
    expect(service.isFavorite(mockExp)).toBe(false);

    // 2. Explicitly re-add
    const added = service.toggleFavorite(mockExp);
    expect(added).toBe(true);
    expect(service.isFavorite(mockExp)).toBe(true);

    // 3. Stale member refresh
    currentMemberSignal.set({
      email: 'socio@experiencias.club',
      fullName: 'Socio Test',
      experiencesWishlist: ['kayak-las-jumeal'],
    });
    TestBed.flushEffects();

    expect(service.isFavorite(mockExp)).toBe(true);
  });

  it('should update member wishlist synchronously upon removal and merge only once per member identity', () => {
    TestBed.flushEffects();
    expect(service.isFavorite(mockExp)).toBe(true);

    service.removeFavorite(mockExp);
    expect(mockNewsletter.updateCurrentMemberWishlist).toHaveBeenCalledWith(['trekking-antofagasta']);
    expect(currentMemberSignal().experiencesWishlist).toEqual(['trekking-antofagasta']);

    // Flushing effects should not re-add kayak-las-jumeal
    TestBed.flushEffects();
    expect(service.isFavorite(mockExp)).toBe(false);
  });

  it('should scope stored favorites in localStorage using the member email', () => {
    TestBed.flushEffects();
    expect(service.isFavorite(mockExp)).toBe(true);

    const scopedKey = 'catamarca_user_favorites_v1_socio@experiencias.club';
    const raw = localStorage.getItem(scopedKey);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw || '[]')).toContain('kayak-las-jumeal');
  });

  it('should reset favorites when member changes and prevent syncing previous member favorites to new member', () => {
    TestBed.flushEffects();
    expect(service.isFavorite(mockExp)).toBe(true);

    mockNewsletter.updateCurrentMemberWishlist.mockClear();

    // Switch to another member with different/empty wishlist
    currentMemberSignal.set({
      email: 'otro@experiencias.club',
      fullName: 'Otro Socio',
      experiencesWishlist: ['cabalgata-ambato'],
    });
    TestBed.flushEffects();

    // Previous member's favorites must not persist
    expect(service.isFavorite(mockExp)).toBe(false);
    expect(service.isFavorite('cabalgata-ambato')).toBe(true);

    // updateCurrentMemberWishlist should NOT have been called with previous member's favorites
    expect(mockNewsletter.updateCurrentMemberWishlist).not.toHaveBeenCalledWith(
      expect.arrayContaining(['kayak-las-jumeal'])
    );
  });

  it('should reset favorites to guest storage when member logs out', () => {
    TestBed.flushEffects();
    expect(service.isFavorite(mockExp)).toBe(true);

    currentMemberSignal.set(null);
    TestBed.flushEffects();

    expect(service.isFavorite(mockExp)).toBe(false);
    expect(service.favoriteSlugs()).toEqual([]);
  });

  it('should resolve experience id and call toggle_experiencia_favorita RPC updating maintained count', async () => {
    TestBed.flushEffects();

    service.toggleFavorite(mockExp);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('toggle_experiencia_favorita', {
      p_experience_id: 'exp-kayak-1',
      p_socio_email: 'socio@experiencias.club',
      p_is_favorite: false,
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(mockExperienceService.updateFavoritesCount).toHaveBeenCalledWith('exp-kayak-1', 5);
  });

  it('should show removed toast notification when untoggling or removing a favorite', () => {
    TestBed.flushEffects();
    expect(service.isFavorite(mockExp)).toBe(true);

    service.toggleFavorite(mockExp);
    expect(service.isFavorite(mockExp)).toBe(false);

    const toast = service.lastFavoritedToast();
    expect(toast).toBeTruthy();
    expect(toast?.action).toBe('removed');
    expect(toast?.title).toBe(mockExp.title);

    // Test explicit removeFavorite
    service.removeFavorite(mockExp);
    expect(service.lastFavoritedToast()?.action).toBe('removed');
  });

  describe('syncRemoteFavoritesFromSupabase', () => {
    it('should restrict remote favorites import query to active member email and ignore rows for other members', async () => {
      const eqSpy = vi.fn().mockResolvedValue({
        data: [
          { experience_id: 'exp-active-user', socio_email: 'socio@experiencias.club' },
          { experience_id: 'exp-other-user', socio_email: 'other@experiencias.club' },
        ],
        error: null,
      });
      const selectSpy = vi.fn().mockReturnValue({ eq: eqSpy });
      const fromSpy = vi.fn().mockReturnValue({ select: selectSpy });
      mockSupabase.from = fromSpy;

      await service.syncRemoteFavoritesFromSupabase('socio@experiencias.club');

      expect(fromSpy).toHaveBeenCalledWith('experiencias_favoritas');
      expect(selectSpy).toHaveBeenCalledWith('experience_id, socio_email');
      expect(eqSpy).toHaveBeenCalledWith('socio_email', 'socio@experiencias.club');

      // exp-active-user should be added
      expect(service.isFavorite('exp-active-user')).toBe(true);
      // exp-other-user must NOT be added
      expect(service.isFavorite('exp-other-user')).toBe(false);
    });

    it('should not query remote favorites if no active member email is resolved', async () => {
      const fromSpy = vi.fn();
      mockSupabase.from = fromSpy;

      currentMemberSignal.set(null);
      (service as any).activeMemberIdentity = null;

      await service.syncRemoteFavoritesFromSupabase(null);

      expect(fromSpy).not.toHaveBeenCalled();
    });

    it('should preserve imported IDs when the catalog has not loaded', async () => {
      mockExperienceService.experiences = () => []; // Catalog not loaded

      const eqSpy = vi.fn().mockResolvedValue({
        data: [
          { experience_id: 'exp-remote-raw-id', socio_email: 'socio@experiencias.club' },
        ],
        error: null,
      });
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: eqSpy }),
      });

      await service.syncRemoteFavoritesFromSupabase('socio@experiencias.club');

      expect(service.favoriteSlugs()).toContain('exp-remote-raw-id');
    });

    it('should map imported remote IDs to canonical slug when catalog has loaded', async () => {
      mockExperienceService.experiences = () => [mockExp]; // mockExp has id: 'exp-kayak-1', slug: 'kayak-las-jumeal'

      const eqSpy = vi.fn().mockResolvedValue({
        data: [
          { experience_id: 'exp-kayak-1', socio_email: 'socio@experiencias.club' },
        ],
        error: null,
      });
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: eqSpy }),
      });

      await service.syncRemoteFavoritesFromSupabase('socio@experiencias.club');

      expect(service.favoriteSlugs()).toContain('kayak-las-jumeal');
    });

    it('should match imported remote ID when checked by Experience object or by slug', () => {
      // Simulate raw ID in stored favorites
      (service as any)._favoriteSlugs.set(['exp-kayak-1']);

      // Check by Experience object (whose id is exp-kayak-1, slug is kayak-las-jumeal)
      expect(service.isFavorite(mockExp)).toBe(true);

      // Check by slug string
      expect(service.isFavorite('kayak-las-jumeal')).toBe(true);

      // Check by ID string
      expect(service.isFavorite('exp-kayak-1')).toBe(true);
    });

    it('should ensure existing favorite stored as ID is recognized by toggleFavorite and chooses removal branch', () => {
      (service as any)._favoriteSlugs.set(['exp-kayak-1']);

      // Before toggle: it is favorite
      expect(service.isFavorite(mockExp)).toBe(true);

      // Toggle should recognize it is already favorite and remove it (returning false)
      const result = service.toggleFavorite(mockExp);
      expect(result).toBe(false);

      expect(service.isFavorite(mockExp)).toBe(false);
      expect(service.favoriteSlugs()).not.toContain('exp-kayak-1');
      expect(service.favoriteSlugs()).not.toContain('kayak-las-jumeal');
    });

    it('should check keys against removal records and not restore explicitly removed favorites while importing others', async () => {
      // User explicitly removed mockExp ('kayak-las-jumeal' / 'exp-kayak-1')
      service.removeFavorite(mockExp);
      expect((service as any)._removedSlugs().has('kayak-las-jumeal')).toBe(true);

      // Remote response arrives containing both the removed item and a new genuine item
      const eqSpy = vi.fn().mockResolvedValue({
        data: [
          { experience_id: 'exp-kayak-1', socio_email: 'socio@experiencias.club' },
          { experience_id: 'exp-other-new', socio_email: 'socio@experiencias.club' },
        ],
        error: null,
      });
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: eqSpy }),
      });

      await service.syncRemoteFavoritesFromSupabase('socio@experiencias.club');

      // The explicitly removed favorite must NOT be restored
      expect(service.isFavorite(mockExp)).toBe(false);
      expect(service.favoriteSlugs()).not.toContain('exp-kayak-1');
      expect(service.favoriteSlugs()).not.toContain('kayak-las-jumeal');

      // The new favorite without removal record MUST be imported
      expect(service.favoriteSlugs()).toContain('exp-other-new');
    });

    it('should ignore stale remote responses when session generation advances during A -> B -> A transitions', async () => {
      let callCount = 0;
      let resolveFirstQuery!: (value: any) => void;
      const firstQueryPromise = new Promise((resolve) => {
        resolveFirstQuery = resolve;
      });

      mockSupabase.from = vi.fn().mockImplementation(() => {
        callCount++;
        const promiseToReturn =
          callCount === 1 ? firstQueryPromise : Promise.resolve({ data: [], error: null });
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(promiseToReturn),
          }),
        };
      });

      // User A starts remote sync
      const firstSyncPromise = service.syncRemoteFavoritesFromSupabase('socio@experiencias.club');

      // Member changes from A to B
      currentMemberSignal.set({
        email: 'otro@experiencias.club',
        fullName: 'Otro Socio',
        experiencesWishlist: [],
      });
      TestBed.flushEffects();

      // Member changes from B back to A
      currentMemberSignal.set({
        email: 'socio@experiencias.club',
        fullName: 'Socio Test',
        experiencesWishlist: [],
      });
      TestBed.flushEffects();

      // Clear favorites of A so we can observe whether first query writes anything
      (service as any)._favoriteSlugs.set([]);

      // Now the first query from session 1 of A finally resolves
      resolveFirstQuery({
        data: [{ experience_id: 'stale-favorite-a', socio_email: 'socio@experiencias.club' }],
        error: null,
      });

      await firstSyncPromise;

      // Stale favorite must NOT be merged because session generation advanced
      expect(service.favoriteSlugs()).not.toContain('stale-favorite-a');
    });

    it('should ignore in-flight remote responses when member logs out', async () => {
      let resolveQuery!: (value: any) => void;
      const queryPromise = new Promise((resolve) => {
        resolveQuery = resolve;
      });

      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue(queryPromise),
        }),
      });

      const syncPromise = service.syncRemoteFavoritesFromSupabase('socio@experiencias.club');

      // Member logs out
      currentMemberSignal.set(null);
      TestBed.flushEffects();

      // Query resolves after logout
      resolveQuery({
        data: [{ experience_id: 'post-logout-fav', socio_email: 'socio@experiencias.club' }],
        error: null,
      });

      await syncPromise;

      expect(service.favoriteSlugs()).toEqual([]);
    });

    it('should check keys against removal records and not restore explicitly removed favorites while importing others', async () => {
      // User explicitly removed mockExp ('kayak-las-jumeal' / 'exp-kayak-1')
      service.removeFavorite(mockExp);
      expect((service as any)._removedSlugs().has('kayak-las-jumeal')).toBe(true);

      // Remote response arrives containing both the removed item and a new genuine item
      const eqSpy = vi.fn().mockResolvedValue({
        data: [
          { experience_id: 'exp-kayak-1', socio_email: 'socio@experiencias.club' },
          { experience_id: 'exp-other-new', socio_email: 'socio@experiencias.club' },
        ],
        error: null,
      });
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: eqSpy }),
      });

      await service.syncRemoteFavoritesFromSupabase('socio@experiencias.club');

      // The explicitly removed favorite must NOT be restored
      expect(service.isFavorite(mockExp)).toBe(false);
      expect(service.favoriteSlugs()).not.toContain('exp-kayak-1');
      expect(service.favoriteSlugs()).not.toContain('kayak-las-jumeal');

      // The new favorite without removal record MUST be imported
      expect(service.favoriteSlugs()).toContain('exp-other-new');
    });

    it('should ignore stale remote responses when session generation advances during A -> B -> A transitions', async () => {
      let callCount = 0;
      let resolveFirstQuery!: (value: any) => void;
      const firstQueryPromise = new Promise((resolve) => {
        resolveFirstQuery = resolve;
      });

      mockSupabase.from = vi.fn().mockImplementation(() => {
        callCount++;
        const promiseToReturn =
          callCount === 1 ? firstQueryPromise : Promise.resolve({ data: [], error: null });
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(promiseToReturn),
          }),
        };
      });

      // User A starts remote sync
      const firstSyncPromise = service.syncRemoteFavoritesFromSupabase('socio@experiencias.club');

      // Member changes from A to B
      currentMemberSignal.set({
        email: 'otro@experiencias.club',
        fullName: 'Otro Socio',
        experiencesWishlist: [],
      });
      TestBed.flushEffects();

      // Member changes from B back to A
      currentMemberSignal.set({
        email: 'socio@experiencias.club',
        fullName: 'Socio Test',
        experiencesWishlist: [],
      });
      TestBed.flushEffects();

      // Clear favorites of A so we can observe whether first query writes anything
      (service as any)._favoriteSlugs.set([]);

      // Now the first query from session 1 of A finally resolves
      resolveFirstQuery({
        data: [{ experience_id: 'stale-favorite-a', socio_email: 'socio@experiencias.club' }],
        error: null,
      });

      await firstSyncPromise;

      // Stale favorite must NOT be merged because session generation advanced
      expect(service.favoriteSlugs()).not.toContain('stale-favorite-a');
    });

    it('should ignore in-flight remote responses when member logs out', async () => {
      let resolveQuery!: (value: any) => void;
      const queryPromise = new Promise((resolve) => {
        resolveQuery = resolve;
      });

      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue(queryPromise),
        }),
      });

      const syncPromise = service.syncRemoteFavoritesFromSupabase('socio@experiencias.club');

      // Member logs out
      currentMemberSignal.set(null);
      TestBed.flushEffects();

      // Query resolves after logout
      resolveQuery({
        data: [{ experience_id: 'post-logout-fav', socio_email: 'socio@experiencias.club' }],
        error: null,
      });

      await syncPromise;

      expect(service.favoriteSlugs()).toEqual([]);
    });
  });
});

