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
});

