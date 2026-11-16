import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ProviderRatingService } from './provider-rating.service';
import { NewsletterService } from './newsletter.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';

describe('ProviderRatingService', () => {
  let service: ProviderRatingService;
  let mockSupabase: any;
  let mockNewsletter: any;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('CATAMARCA_SUPABASE_URL', 'https://prod-project.supabase.co');
    localStorage.setItem(
      'CATAMARCA_SUPABASE_ANON_KEY',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid_anon_key_for_tests_123456789',
    );

    mockSupabase = {
      from: vi.fn(),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockNewsletter = {
      currentMember: signal({
        email: 'socio@experiencias.club',
        fullName: 'Socio Test',
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        ProviderRatingService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
        { provide: NewsletterService, useValue: mockNewsletter },
      ],
    });

    service = TestBed.inject(ProviderRatingService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should pass database UUID directly when provider.id is a UUID', async () => {
    const validUuid = '12345678-1234-1234-1234-123456789abc';
    await service.rateProvider(
      {
        id: validUuid,
        email: 'prestador@experiencias.club',
        slug: 'prestador-valle',
      },
      5,
    );

    expect(mockSupabase.rpc).toHaveBeenCalledWith('submit_prestador_rating', {
      p_provider_id: validUuid,
      p_score: 5,
      p_comentario: '',
    });
  });

  it('should resolve database UUID by email or slug when provider.id is not a UUID', async () => {
    const resolvedUuid = '98765432-4321-4321-4321-cba987654321';
    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: resolvedUuid },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValue(queryBuilder);

    await service.rateProvider(
      {
        id: 'prov-prestador-legacy',
        email: 'legacy@experiencias.club',
        slug: 'prestador-legacy',
      },
      4,
    );

    expect(mockSupabase.from).toHaveBeenCalledWith('prestadores');
    expect(mockSupabase.rpc).toHaveBeenCalledWith('submit_prestador_rating', {
      p_provider_id: resolvedUuid,
      p_score: 4,
      p_comentario: '',
    });
  });

  it('should prioritize refreshed aggregates in ratingsMap over retained snapshot values in provider', () => {
    // Populate ratingsMap as if loadRemoteRatings had refreshed this provider
    (service as any).ratingsMap.set({
      'prestador-valle': {
        baseScore: 4.8,
        baseCount: 15,
        userVotes: {},
      },
    });

    const providerSnapshot = {
      id: 'prov-1',
      slug: 'prestador-valle',
      ratingScore: 3.5, // stale snapshot
      ratingCount: 2,   // stale snapshot
    };

    const rating = service.getRating(providerSnapshot);
    expect(rating.score).toBe(4.8);
    expect(rating.count).toBe(15);
  });

  it('should fall back to provider snapshot values when no refreshed aggregate is in ratingsMap', () => {
    (service as any).ratingsMap.set({});

    const providerSnapshot = {
      id: 'prov-sin-stored',
      slug: 'prestador-sin-stored',
      ratingScore: 4.2,
      ratingCount: 8,
    };

    const rating = service.getRating(providerSnapshot);
    expect(rating.score).toBe(4.2);
    expect(rating.count).toBe(8);
  });

  it('should not double count committed or restored votes and should include uncommitted pending votes', () => {
    // Escenario 1: Prestador con 10 votos remotos y un voto restaurado/confirmado del socio activo
    (service as any).ratingsMap.set({
      'prestador-test': {
        baseScore: 4.5,
        baseCount: 10,
        userVotes: { 'user:socio@experiencias.club': 5 },
        committedVotes: { 'user:socio@experiencias.club': 5 },
        pendingVotes: {},
      },
    });

    const ratingCommitted = service.getRating({ slug: 'prestador-test' });
    // No debe sumar el voto confirmado dos veces (debe dar exactamente 10)
    expect(ratingCommitted.count).toBe(10);
    expect(ratingCommitted.userVote).toBe(5);

    // Escenario 2: Socio emite actualización pendiente (modifica a 4 estrellas)
    (service as any).ratingsMap.set({
      'prestador-test': {
        baseScore: 4.5,
        baseCount: 10,
        userVotes: { 'user:socio@experiencias.club': 4 },
        committedVotes: { 'user:socio@experiencias.club': 5 },
        pendingVotes: { 'user:socio@experiencias.club': 4 },
      },
    });

    const ratingUpdated = service.getRating({ slug: 'prestador-test' });
    // Al ser un votante que ya estaba en committedVotes, no incrementa el conteo
    expect(ratingUpdated.count).toBe(10);
    expect(ratingUpdated.userVote).toBe(4);

    // Escenario 3: Votante nuevo con voto pendiente aún no incluido en baseCount
    (service as any).ratingsMap.set({
      'prestador-test': {
        baseScore: 4.5,
        baseCount: 10,
        userVotes: { 'user:socio@experiencias.club': 5 },
        committedVotes: {},
        pendingVotes: { 'user:socio@experiencias.club': 5 },
      },
    });

    const ratingPending = service.getRating({ slug: 'prestador-test' });
    // Debe incluir el voto pendiente no reflejado en baseCount
    expect(ratingPending.count).toBe(11);
    expect(ratingPending.userVote).toBe(5);
  });

  it('should restore remote votes to canonical record and apply them to slug lookups', async () => {
    const providerUuid = '11111111-2222-3333-4444-555555555555';
    const providerSlug = 'valle-aventura';

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [
          {
            id: providerUuid,
            slug: providerSlug,
            email: 'valle@aventura.com',
            rating_score: 4.8,
            rating_count: 12,
          },
        ],
        error: null,
      }),
    });

    mockSupabase.rpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'get_my_provider_ratings') {
        return Promise.resolve({
          data: [{ prestador_id: providerUuid, score: 5 }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    await service.loadRemoteRatings();

    // getRating consultado por slug (lo habitual en la UI)
    const ratingBySlug = service.getRating({ slug: providerSlug });
    expect(ratingBySlug.score).toBe(4.8);
    expect(ratingBySlug.count).toBe(12);
    expect(ratingBySlug.userVote).toBe(5);

    // getRating consultado por UUID
    const ratingById = service.getRating({ id: providerUuid });
    expect(ratingById.userVote).toBe(5);
  });

  describe('getProviderVotes', () => {
    const validUuid = '12345678-1234-1234-1234-123456789abc';

    it('should return complete status with votes on successful remote fetch', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'vote-1',
              socio_email: 'socio1@test.com',
              score: 5,
              comentario: 'Excelente servicio',
              created_at: '2026-03-01T10:00:00Z',
            },
          ],
          error: null,
        }),
      });

      const res = await service.getProviderVotes({ id: validUuid });
      expect(res.status).toBe('complete');
      expect(res.votes.length).toBe(1);
      expect(res.votes[0].socioEmail).toBe('socio1@test.com');
      expect(res.votes[0].score).toBe(5);
      expect(res.votes[0].comment).toBe('Excelente servicio');
    });

    it('should return unavailable status when remote fetch fails and local cache is empty', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Network connection error' },
        }),
      });

      const res = await service.getProviderVotes({ id: validUuid });
      expect(res.status).toBe('unavailable');
      expect(res.votes.length).toBe(0);
      expect(res.error).toBe('Network connection error');
    });

    it('should return partial status when remote fetch fails and local cache has votes', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database unreachable' },
        }),
      });

      // Simular voto local en almacenamiento
      const ratingsKey = 'catamarca_provider_ratings_v2';
      const map = {
        [validUuid.toLowerCase()]: {
          baseScore: 5,
          baseCount: 1,
          userVotes: { 'user:local.socio@test.com': 4 },
        },
      };
      localStorage.setItem(ratingsKey, JSON.stringify(map));
      (service as any).ratingsMap.set(map);

      const res = await service.getProviderVotes({ id: validUuid });
      expect(res.status).toBe('partial');
      expect(res.votes.length).toBe(1);
      expect(res.votes[0].socioEmail).toBe('local.socio@test.com');
      expect(res.votes[0].score).toBe(4);
      expect(res.votes[0].createdAt).toBeUndefined();
    });

    it('should preserve original vote timestamp when available in voteTimestamps', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database unreachable' },
        }),
      });

      const originalIso = '2026-02-15T14:30:00.000Z';
      const map = {
        [validUuid.toLowerCase()]: {
          baseScore: 5,
          baseCount: 1,
          userVotes: { 'user:local.socio@test.com': 5 },
          voteTimestamps: { 'user:local.socio@test.com': originalIso },
        },
      };
      (service as any).ratingsMap.set(map);

      const res = await service.getProviderVotes({ id: validUuid });
      expect(res.votes.length).toBe(1);
      expect(res.votes[0].createdAt).toBe(originalIso);
    });
  });
});

