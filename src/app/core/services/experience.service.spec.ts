import { TestBed } from '@angular/core/testing';
import {
  ExperienceService,
  RESERVED_EXPERIENCE_SLUGS,
  STORAGE_KEY,
  PRIVILEGED_STORAGE_KEY,
  PRIVILEGED_OWNER_KEY,
  DEFAULT_EXPERIENCES,
  SEEDED_REMOVED_EXPERIENCE_ID,
  SEEDED_REMOVED_EXPERIENCE_SLUG,
} from './experience.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';
import { Experience } from '../models/experience.model';

describe('ExperienceService', () => {
  let service: ExperienceService;
  let mockSupabase: any;

  const baseExp: Experience = {
    id: 'test-123',
    slug: 'nueva-travesia',
    title: 'Nueva Travesía',
    tagline: 'Una aventura única',
    description: 'Descripción completa',
    region: 'Valle Central',
    difficulty: 'Moderada',
    durationDays: 1,
    durationLabel: '2 Horas',
    altitudeMeters: 800,
    priceArs: 10000,
    priceUsd: 10,
    maxSpotsPerGroup: 10,
    coverImage: '/img.jpg',
    galleryImages: [],
    highlights: [],
    included: [],
    detailRoute: '',
    publicUrl: '',
    status: 'publicada',
    isExclusiveClub: true,
    isLocked: false,
  };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('CATAMARCA_SUPABASE_URL', 'https://prod-project.supabase.co');
    localStorage.setItem(
      'CATAMARCA_SUPABASE_ANON_KEY',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid_anon_key_for_tests_123456789',
    );

    const selectQuery: any = {
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(selectQuery),
        insert: vi.fn().mockResolvedValue({ data: [], error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        ExperienceService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      ],
    });

    service = TestBed.inject(ExperienceService);
    (service as any)._experiences.set([{ ...baseExp, id: 'exp-kayak', slug: 'kayak', title: 'Kayak Inicial' }]);
  });

  describe('createExperience', () => {

    it('should reject empty slugs', async () => {
      await expect(
        service.createExperience({ ...baseExp, title: '', slug: '' }),
      ).rejects.toThrow('El slug de la experiencia no puede estar vacío.');
    });

    it('should sanitize reserved slugs with -exp suffix', async () => {
      for (const reserved of Array.from(RESERVED_EXPERIENCE_SLUGS)) {
        await service.createExperience({ ...baseExp, id: `test-${reserved}`, slug: reserved });
        const created = service.experiences().find((e) => e.id === `test-${reserved}`);
        expect(created?.slug).toBe(`${reserved}-exp`);
      }
    });

    it('should auto-deduplicate slugs already in use with suffix', async () => {
      const existingSlug = service.experiences()[0].slug;
      await service.createExperience({ ...baseExp, id: 'test-dup-1', slug: existingSlug });
      const created = service.experiences().find((e) => e.id === 'test-dup-1');
      expect(created?.slug).toBe(`${existingSlug}-2`);
    });

    it('should successfully create experience with a valid slug', async () => {
      const initialCount = service.experiences().length;
      await service.createExperience({ ...baseExp, slug: 'nueva-aventura-unica' });
      expect(service.experiences().length).toBe(initialCount + 1);
      expect(service.experiences()[0].slug).toBe('nueva-aventura-unica');
    });
  });

  describe('updateExperience', () => {
    it('should rollback and throw when remote update returns empty data', async () => {
      const initialExperiences = [...service.experiences()];
      const targetExp = initialExperiences[0];

      const updateBuilder: any = {
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue(updateBuilder),
      });

      await expect(
        service.updateExperience({ id: targetExp.id, title: 'Título Modificado' }),
      ).rejects.toThrow(`No se encontró la experiencia remota con id ${targetExp.id}`);

      // Verify list rolled back
      expect(service.experiences()[0].title).toBe(targetExp.title);
    });

    it('should throw unmatched-ID error for partial updates when experience ID does not exist', async () => {
      await expect(
        service.updateExperience({ id: 'non-existent-id', status: 'oculta' }),
      ).rejects.toThrow('Experiencia con ID non-existent-id no encontrada.');
    });

    it('should append merged to list when experience ID does not exist but payload is a complete Experience', async () => {
      const updateBuilder: any = {
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [{ id: 'complete-new-id' }], error: null }),
      };
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue(updateBuilder),
      });

      const completeExp: Experience = {
        id: 'complete-new-id',
        slug: 'complete-new-slug',
        title: 'Complete Title',
        tagline: 'Complete Tagline',
        description: 'Complete Description',
        region: 'Valle Central',
        difficulty: 'Baja',
        durationDays: 1,
        durationLabel: '2 Horas',
        altitudeMeters: 500,
        priceArs: 20000,
        priceUsd: 20,
        maxSpotsPerGroup: 8,
        coverImage: '/assets/images/kayak-club-de-experiencias.jpg',
        galleryImages: [],
        highlights: ['H1'],
        included: ['I1'],
        isExclusiveClub: true,
      };

      await service.updateExperience(completeExp);
      expect(service.experiences().some((e) => e.id === 'complete-new-id')).toBe(true);
    });
  });

  describe('deleteExperience', () => {
    it('should delete by slug or id and throw/rollback if remote delete returns empty result', async () => {
      const initialExperiences = [...service.experiences()];
      const targetExp = initialExperiences[0];

      const deleteBuilder: any = {
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockSupabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue(deleteBuilder),
      });

      // Calling deleteExperience with slug
      await expect(
        service.deleteExperience(targetExp.slug),
      ).rejects.toThrow(`No se encontró la experiencia remota con id ${targetExp.id}`);

      // Remote query should have been called with targetId (targetExp.id), not slug
      expect(deleteBuilder.eq).toHaveBeenCalledWith('id', targetExp.id);

      // Verify rollback
      expect(service.experiences().some((e) => e.id === targetExp.id)).toBe(true);
    });
  });

  describe('public catalog cache and privileged proposal separation', () => {
    it('should never persist pending/rejected proposals, notes, or banking details to shared catalog cache', () => {
      // simulate privileged session
      localStorage.setItem('catamarca_admin_session_v1', JSON.stringify({ email: 'admin@experiencias.club' }));

      const mixed: Experience[] = [
        {
          id: 'exp-pub',
          slug: 'exp-publicada',
          title: 'Exp Publicada',
          tagline: 'Tagline',
          description: 'Desc',
          region: 'Valle Central',
          difficulty: 'Baja',
          durationDays: 1,
          durationLabel: '2 Horas',
          altitudeMeters: 500,
          priceArs: 1000,
          priceUsd: 10,
          maxSpotsPerGroup: 10,
          coverImage: '/img.jpg',
          galleryImages: [],
          highlights: [],
          included: [],
          status: 'publicada',
          isExclusiveClub: false,
          isLocked: false,
          notes: 'Nota secreta interna',
          providerCbuAlias: 'PROVIDER.ALIAS.MP',
          providerCuitDni: '20-12345678-9',
          providerBankName: 'Banco Privado',
          detailRoute: '/experiencias/exp-publicada',
          publicUrl: 'https://experiencias.club/experiencias/exp-publicada',
        },
        {
          id: 'exp-pend',
          slug: 'exp-pendiente',
          title: 'Exp Pendiente',
          tagline: 'Tagline',
          description: 'Desc',
          region: 'Puna',
          difficulty: 'Exigente',
          durationDays: 1,
          durationLabel: '5 Horas',
          altitudeMeters: 3000,
          priceArs: 2000,
          priceUsd: 20,
          maxSpotsPerGroup: 5,
          coverImage: '/img.jpg',
          galleryImages: [],
          highlights: [],
          included: [],
          status: 'pendiente',
          isExclusiveClub: false,
          isLocked: false,
          notes: 'Revisión pendiente por admin',
          detailRoute: '/experiencias/exp-pendiente',
          publicUrl: 'https://experiencias.club/experiencias/exp-pendiente',
        },
      ];

      (service as any).persistToLocalStorage(mixed);

      const catalogRaw = localStorage.getItem(STORAGE_KEY);
      expect(catalogRaw).toBeTruthy();
      const catalogParsed: Experience[] = JSON.parse(catalogRaw!);

      // Only published experiences
      expect(catalogParsed.some((e) => e.status === 'pendiente')).toBe(false);
      expect(catalogParsed.some((e) => e.id === 'exp-pend')).toBe(false);
      const pubSaved = catalogParsed.find((e) => e.id === 'exp-pub');
      expect(pubSaved).toBeDefined();
      expect(pubSaved?.notes).toBeUndefined();
      expect(pubSaved?.providerCbuAlias).toBeUndefined();
      expect(pubSaved?.providerCuitDni).toBeUndefined();
      expect(pubSaved?.providerBankName).toBeUndefined();

      // Privileged items are in scoped storage key
      const privKey = service.getPrivilegedStorageKey();
      const privRaw = localStorage.getItem(privKey);
      expect(privRaw).toBeTruthy();
      const privParsed: Experience[] = JSON.parse(privRaw!);
      expect(privParsed.some((e) => e.id === 'exp-pend')).toBe(true);
    });

    it('should clear privileged proposal copies and reset state on clearPrivilegedCache', () => {
      localStorage.setItem('catamarca_admin_session_v1', JSON.stringify({ email: 'admin@experiencias.club' }));
      const privKey = service.getPrivilegedStorageKey();
      localStorage.setItem('catamarca_experience_requests_v1', JSON.stringify([{ id: 'req-1', status: 'pendiente' }]));
      localStorage.setItem('catamarca_provider_experiences_v5', JSON.stringify([{ id: 'prov-1', status: 'borrador' }]));
      localStorage.setItem(privKey, JSON.stringify([{ id: 'exp-pend', status: 'pendiente' }]));

      service.clearPrivilegedCache();

      expect(localStorage.getItem(privKey)).toBeNull();
      expect(localStorage.getItem(PRIVILEGED_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem('catamarca_experience_requests_v1')).toBeNull();
      expect(localStorage.getItem('catamarca_provider_experiences_v5')).toBeNull();
      expect(service.experiences().some((e) => e.status === 'pendiente')).toBe(false);
    });

    it('should scope privileged cache to user identifier and clear prior cache on account change without SIGNED_OUT', () => {
      // 1. Session for User A
      localStorage.setItem('catamarca_admin_session_v1', JSON.stringify({ email: 'adminA@experiencias.club' }));
      const keyA = service.getPrivilegedStorageKey();
      expect(keyA).toContain('admin_admina_experiencias_club');

      const privA: Experience[] = [
        {
          id: 'exp-priv-a',
          slug: 'exp-priv-a',
          title: 'Exp A',
          tagline: 'Tagline',
          description: 'Desc',
          region: 'Puna',
          difficulty: 'Exigente',
          durationDays: 1,
          durationLabel: '4 Horas',
          altitudeMeters: 2000,
          priceArs: 1000,
          priceUsd: 10,
          maxSpotsPerGroup: 5,
          coverImage: '/img.jpg',
          galleryImages: [],
          highlights: [],
          included: [],
          status: 'pendiente',
          isExclusiveClub: false,
          isLocked: false,
          detailRoute: '/experiencias/exp-priv-a',
          publicUrl: 'https://experiencias.club/experiencias/exp-priv-a',
        },
      ];
      (service as any).persistToLocalStorage(privA);
      expect(localStorage.getItem(keyA)).toBeTruthy();

      // 2. Switch session to User B without SIGNED_OUT
      localStorage.setItem('catamarca_admin_session_v1', JSON.stringify({ email: 'adminB@experiencias.club' }));
      const keyB = service.getPrivilegedStorageKey();
      expect(keyB).toContain('admin_adminb_experiencias_club');
      expect(keyB).not.toBe(keyA);

      // Trigger sync by checking privileged session or persisting B's items
      const privB: Experience[] = [
        {
          id: 'exp-priv-b',
          slug: 'exp-priv-b',
          title: 'Exp B',
          tagline: 'Tagline',
          description: 'Desc',
          region: 'Puna',
          difficulty: 'Exigente',
          durationDays: 1,
          durationLabel: '4 Horas',
          altitudeMeters: 2000,
          priceArs: 2000,
          priceUsd: 20,
          maxSpotsPerGroup: 5,
          coverImage: '/img.jpg',
          galleryImages: [],
          highlights: [],
          included: [],
          status: 'pendiente',
          isExclusiveClub: false,
          isLocked: false,
          detailRoute: '/experiencias/exp-priv-b',
          publicUrl: 'https://experiencias.club/experiencias/exp-priv-b',
        },
      ];
      (service as any).persistToLocalStorage(privB);

      // Prior account A's cache must be cleared
      expect(localStorage.getItem(keyA)).toBeNull();
      // New account B's cache is active
      expect(localStorage.getItem(keyB)).toBeTruthy();
      const bParsed: Experience[] = JSON.parse(localStorage.getItem(keyB)!);
      expect(bParsed.some((e) => e.id === 'exp-priv-b')).toBe(true);
      expect(bParsed.some((e) => e.id === 'exp-priv-a')).toBe(false);
    });

    it('should discard PRIVILEGED_STORAGE_KEY before merging if its recorded owner differs from current identity', () => {
      localStorage.setItem(
        PRIVILEGED_STORAGE_KEY,
        JSON.stringify([{ id: 'exp-stale', status: 'pendiente' }]),
      );
      localStorage.setItem(PRIVILEGED_OWNER_KEY, 'admin_old_admin@experiencias.club');

      localStorage.setItem(
        'catamarca_admin_session_v1',
        JSON.stringify({ email: 'new_admin@experiencias.club' }),
      );

      const loaded = (service as any).loadInitialExperiences();

      expect(loaded.some((e: Experience) => e.id === 'exp-stale')).toBe(false);
      expect(localStorage.getItem(PRIVILEGED_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem(PRIVILEGED_OWNER_KEY)).toBeNull();
    });

    it('should retain local experiences on remote merge only when pendingRemoteSync is true', async () => {
      const expSyncPending: Partial<Experience> = {
        id: 'exp-sync-1',
        slug: 'exp-sync-1',
        title: 'Sync Pending',
        status: 'pendiente',
        pendingRemoteSync: true,
      };
      const expNoSyncFlag: Partial<Experience> = {
        id: 'exp-no-sync-2',
        slug: 'exp-no-sync-2',
        title: 'No Sync Flag',
        status: 'pendiente',
        pendingRemoteSync: false,
      };

      (service as any)._experiences.set([expSyncPending, expNoSyncFlag]);

      // Mock remote experiences returning 1 remote experience
      const selectQuery: any = {
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'exp-remote-1',
              slug: 'exp-remote-1',
              title: 'Remote Exp',
              price_ars: 1000,
            },
          ],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue(selectQuery),
      });

      await service.reloadFromSupabase();

      const experiences = service.experiences();
      expect(experiences.some((e) => e.id === 'exp-sync-1')).toBe(true);
      expect(experiences.some((e) => e.id === 'exp-no-sync-2')).toBe(false);
    });

    it('should not contain the seeded sunset pending experience in DEFAULT_EXPERIENCES', () => {
      expect(
        DEFAULT_EXPERIENCES.some(
          (e) =>
            e.id === SEEDED_REMOVED_EXPERIENCE_ID ||
            e.slug === SEEDED_REMOVED_EXPERIENCE_SLUG,
        ),
      ).toBe(false);
      expect(
        DEFAULT_EXPERIENCES.some(
          (e) => (e as any).providerEmail === 'patriciofacundodiaztillar@gmail.com',
        ),
      ).toBe(false);
    });

    it('should clean up cached copies of the seeded sunset experience while preserving genuine proposals', () => {
      const genuinePublished: Partial<Experience> = {
        id: 'exp-genuine-1',
        slug: 'genuine-experience-slug',
        title: 'Experiencia Genuina de Prestador',
        status: 'publicada',
      };
      const seededSunsetExp: Partial<Experience> = {
        id: SEEDED_REMOVED_EXPERIENCE_ID,
        slug: SEEDED_REMOVED_EXPERIENCE_SLUG,
        title: 'Travesía en Kayak Nocturna & Luna Llena en El Jumeal',
        status: 'pendiente',
        providerEmail: 'patriciofacundodiaztillar@gmail.com',
      };

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([genuinePublished, seededSunsetExp]),
      );

      localStorage.setItem(
        'catamarca_experience_requests_v1',
        JSON.stringify([
          {
            id: 'req-genuine-proposal',
            title: 'Propuesta Genuina Pendiente',
            slug: 'propuesta-genuina-pendiente',
            status: 'pendiente',
          },
          {
            id: SEEDED_REMOVED_EXPERIENCE_ID,
            title: 'Travesía en Kayak Nocturna & Luna Llena en El Jumeal',
            slug: SEEDED_REMOVED_EXPERIENCE_SLUG,
            status: 'pendiente',
          },
        ]),
      );

      // Create new service instance to run loadInitialExperiences
      const newService = TestBed.inject(ExperienceService);
      const initial = (newService as any).loadInitialExperiences();

      expect(
        initial.some(
          (e: Experience) =>
            e.id === SEEDED_REMOVED_EXPERIENCE_ID ||
            e.slug === SEEDED_REMOVED_EXPERIENCE_SLUG,
        ),
      ).toBe(false);
      expect(
        initial.some((e: Experience) => e.id === 'exp-genuine-1'),
      ).toBe(true);
      expect(
        initial.some((e: Experience) => e.id === 'req-genuine-proposal'),
      ).toBe(true);

      const storedInLocalStorage = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || '[]',
      );
      expect(
        storedInLocalStorage.some(
          (e: any) =>
            e.id === SEEDED_REMOVED_EXPERIENCE_ID ||
            e.slug === SEEDED_REMOVED_EXPERIENCE_SLUG,
        ),
      ).toBe(false);
      expect(
        storedInLocalStorage.some(
          (e: any) => e.id === 'exp-genuine-1',
        ),
      ).toBe(true);
    });
  });
});
