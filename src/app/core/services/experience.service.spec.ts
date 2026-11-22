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

    it('should serialize mpConnected and mpCollectorId into notes upon creation', async () => {
      let insertedPayload: any = null;
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'experiencias') {
          return {
            insert: vi.fn().mockImplementation((payload) => {
              insertedPayload = payload;
              return Promise.resolve({ data: [payload], error: null });
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      });

      await service.createExperience({
        ...baseExp,
        slug: 'exp-with-mp',
        mpConnected: true,
        mpCollectorId: '987654321',
      });

      const created = service.experiences().find((e) => e.slug === 'exp-with-mp');
      expect(created).toBeDefined();
      expect(created?.notes).toBeDefined();
      const parsedNotes = JSON.parse(created!.notes!);
      expect(parsedNotes.mp_connected).toBe(true);
      expect(parsedNotes.mp_collector_id).toBe('987654321');
      expect(insertedPayload?.notes).toBe(created!.notes);
    });

    it('should preserve existing notes text while serializing mpConnected and mpCollectorId in createExperience', async () => {
      let insertedPayload: any = null;
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'experiencias') {
          return {
            insert: vi.fn().mockImplementation((payload: any) => {
              insertedPayload = payload;
              return Promise.resolve({ error: null });
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      });

      await service.createExperience({
        ...baseExp,
        slug: 'exp-with-notes-and-mp',
        notes: 'Nota importante del prestador',
        mpConnected: true,
        mpCollectorId: '123456789',
      });

      const created = service.experiences().find((e) => e.slug === 'exp-with-notes-and-mp');
      expect(created).toBeDefined();
      expect(created?.notes).toBeDefined();
      const parsedNotes = JSON.parse(created!.notes!);
      expect(parsedNotes.text).toBe('Nota importante del prestador');
      expect(parsedNotes.mp_connected).toBe(true);
      expect(parsedNotes.mp_collector_id).toBe('123456789');
      expect(insertedPayload?.notes).toBe(created!.notes);
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

    it('should preserve stored record id when lookup matches by slug or alternate id', async () => {
      const initialExperiences = [...service.experiences()];
      const targetExp = initialExperiences[0];

      const updateBuilder: any = {
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [{ id: targetExp.id }], error: null }),
      };
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue(updateBuilder),
      });

      await service.updateExperience({
        id: 'different-temporary-id',
        slug: targetExp.slug,
        title: 'Updated Kayak Title',
      });

      const updatedExp = service.experiences().find((e) => e.slug === targetExp.slug);
      expect(updatedExp?.id).toBe(targetExp.id);
      expect(updatedExp?.title).toBe('Updated Kayak Title');
      expect(updateBuilder.eq).toHaveBeenCalledWith('id', targetExp.id);
    });

    it('should preserve existing plain-text notes when adding payment fields', async () => {
      const initialExperiences = [...service.experiences()];
      const targetExp = initialExperiences[0];

      let capturedPayload: any = null;
      const updateBuilder: any = {
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [{ id: targetExp.id }], error: null }),
      };
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockImplementation((payload) => {
          capturedPayload = payload;
          return updateBuilder;
        }),
      });

      // Update experience with plain-text notes and payment fields
      await service.updateExperience({
        id: targetExp.id,
        notes: 'Llevar documentación',
        mpCollectorId: 'mp-col-12345',
        mpConnected: true,
      });

      expect(capturedPayload).toBeDefined();
      expect(capturedPayload.notes).toBeDefined();
      const parsed = JSON.parse(capturedPayload.notes);
      expect(parsed.text).toBe('Llevar documentación');
      expect(parsed.mp_collector_id).toBe('mp-col-12345');
      expect(parsed.mp_connected).toBe(true);
    });

    it('should parse JSON notes with leading whitespace and preserve existing properties when adding payment fields', async () => {
      const initialExperiences = [...service.experiences()];
      const targetExp = initialExperiences[0];
      (service as any)._experiences.set([
        {
          ...targetExp,
          notes: '   \n\t  {"legacy_field": "val123", "text": "Nota previa"}   ',
        },
      ]);

      let capturedPayload: any = null;
      const updateBuilder: any = {
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [{ id: targetExp.id }], error: null }),
      };
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockImplementation((payload) => {
          capturedPayload = payload;
          return updateBuilder;
        }),
      });

      await service.updateExperience({
        id: targetExp.id,
        mpCollectorId: 'mp-col-999',
        mpConnected: true,
      });

      expect(capturedPayload).toBeDefined();
      const parsed = JSON.parse(capturedPayload.notes);
      expect(parsed.legacy_field).toBe('val123');
      expect(parsed.text).toBe('Nota previa');
      expect(parsed.mp_collector_id).toBe('mp-col-999');
      expect(parsed.mp_connected).toBe(true);
    });

    it('should preserve non-JSON plain text with leading whitespace in text property when adding payment fields', async () => {
      const initialExperiences = [...service.experiences()];
      const targetExp = initialExperiences[0];
      (service as any)._experiences.set([
        {
          ...targetExp,
          notes: '   Texto plano con espacios   ',
        },
      ]);

      let capturedPayload: any = null;
      const updateBuilder: any = {
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [{ id: targetExp.id }], error: null }),
      };
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockImplementation((payload) => {
          capturedPayload = payload;
          return updateBuilder;
        }),
      });

      await service.updateExperience({
        id: targetExp.id,
        mpCollectorId: 'mp-col-888',
        mpConnected: false,
      });

      expect(capturedPayload).toBeDefined();
      const parsed = JSON.parse(capturedPayload.notes);
      expect(parsed.text).toBe('Texto plano con espacios');
      expect(parsed.mp_collector_id).toBe('mp-col-888');
      expect(parsed.mp_connected).toBe(false);
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
        update: vi.fn().mockReturnValue(deleteBuilder),
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

    it('should exclude soft-deleted remote rows and not resurrect them from local pendingRemoteSync', async () => {
      const deletedLocal: Partial<Experience> = {
        id: 'exp-soft-deleted-1',
        slug: 'exp-soft-deleted-1',
        title: 'Soft Deleted Local',
        pendingRemoteSync: true,
      };

      (service as any)._experiences.set([deletedLocal]);

      const selectQuery: any = {
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'exp-soft-deleted-1',
              slug: 'exp-soft-deleted-1',
              title: 'Soft Deleted Remote',
              price_ars: 1000,
              notes: JSON.stringify({ deleted: true, deleted_by: 'admin_portal' }),
            },
            {
              id: 'exp-active-remote',
              slug: 'exp-active-remote',
              title: 'Active Remote Exp',
              price_ars: 2000,
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
      expect(experiences.some((e) => e.id === 'exp-soft-deleted-1')).toBe(false);
      expect(experiences.some((e) => e.slug === 'exp-soft-deleted-1')).toBe(false);
      expect(experiences.some((e) => e.id === 'exp-active-remote')).toBe(true);
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

  describe('updateExperienceAlbum and gallery synchronization', () => {
    it('should synchronize galleryImages with replacement album photos and remove omitted photos', async () => {
      const expInitial: Experience = {
        ...baseExp,
        id: 'exp-album-test',
        slug: 'exp-album-test',
        albumPhotos: [
          { id: 'p1', url: '/img1.jpg', title: 'Foto 1', isCover: true, order: 1 },
          { id: 'p2', url: '/img2.jpg', title: 'Foto 2', isCover: false, order: 2 },
          { id: 'p3', url: '/img3.jpg', title: 'Foto 3 (a eliminar)', isCover: false, order: 3 },
        ],
        galleryImages: ['/img1.jpg', '/img2.jpg', '/img3.jpg'],
      };

      (service as any)._experiences.set([expInitial]);

      const updateQuery = {
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [{ id: 'exp-album-test' }], error: null }),
      };
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue(updateQuery),
      });

      // Nuevo álbum que excluye /img3.jpg y añade /img4.jpg
      const newAlbum = [
        { id: 'p1', url: '/img1.jpg', title: 'Foto 1', isCover: true, order: 1 },
        { id: 'p2', url: '/img2.jpg', title: 'Foto 2', isCover: false, order: 2 },
        { id: 'p4', url: '/img4.jpg', title: 'Foto 4', isCover: false, order: 3 },
      ];

      await service.updateExperienceAlbum('exp-album-test', newAlbum);

      // Verificar que el payload a Supabase contenga el reemplazo exacto
      const updateCall = mockSupabase.from('experiencias').update;
      expect(updateCall).toHaveBeenCalledWith(
        expect.objectContaining({
          gallery_images: ['/img1.jpg', '/img2.jpg', '/img4.jpg'],
          album_photos: newAlbum,
        }),
      );

      // Verificar que la señal en vivo experiences() tenga galleryImages sincronizado sin la foto omitida
      const updatedLive = service.experiences().find((e) => e.id === 'exp-album-test');
      expect(updatedLive?.galleryImages).toEqual(['/img1.jpg', '/img2.jpg', '/img4.jpg']);
      expect(updatedLive?.albumPhotos).toEqual(newAlbum);

      // Verificar que la persistencia en localStorage contenga el reemplazo exacto
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const storedExp = stored.find((e: any) => e.id === 'exp-album-test');
      expect(storedExp?.galleryImages).toEqual(['/img1.jpg', '/img2.jpg', '/img4.jpg']);
    });

    it('should update galleryImages in updateExperience when albumPhotos is explicitly provided', async () => {
      const expInitial: Experience = {
        ...baseExp,
        id: 'exp-update-album',
        slug: 'exp-update-album',
        albumPhotos: [
          { id: 'old-1', url: '/old1.jpg', title: 'Vieja 1', isCover: true, order: 1 },
          { id: 'old-2', url: '/old2.jpg', title: 'Vieja 2', isCover: false, order: 2 },
        ],
        galleryImages: ['/old1.jpg', '/old2.jpg'],
      };

      (service as any)._experiences.set([expInitial]);

      const updateQuery = {
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [{ id: 'exp-update-album' }], error: null }),
      };
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue(updateQuery),
      });

      const replacementAlbum = [
        { id: 'new-1', url: '/nueva1.jpg', title: 'Nueva 1', isCover: true, order: 1 },
      ];

      await service.updateExperience({
        id: 'exp-update-album',
        albumPhotos: replacementAlbum,
      });

      const updatedLive = service.experiences().find((e) => e.id === 'exp-update-album');
      expect(updatedLive?.galleryImages).toEqual(['/nueva1.jpg']);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const storedExp = stored.find((e: any) => e.id === 'exp-update-album');
      expect(storedExp?.galleryImages).toEqual(['/nueva1.jpg']);
    });
  });

  describe('provider experience gallery selection and blob filtering', () => {
    it('should filter unusable blob URLs from galleryImages preserving remaining valid entries', () => {
      localStorage.setItem(
        'catamarca_provider_experiences_v1',
        JSON.stringify([
          {
            id: 'prov-exp-blob-gallery',
            slug: 'prov-exp-blob-gallery',
            title: 'Exp Con Blobs En Galeria',
            status: 'publicada',
            coverImage: '/assets/images/cover.jpg',
            galleryImages: [
              'blob:http://localhost:4200/expired-uuid-1',
              '/assets/images/valid-gallery-1.jpg',
              'blob:http://localhost:4200/expired-uuid-2',
              '/assets/images/valid-gallery-2.jpg',
            ],
            albumPhotos: [
              { url: '/assets/images/album-1.jpg' },
            ],
          },
        ]),
      );

      const initial = (service as any).loadInitialExperiences();
      const loaded = initial.find((e: Experience) => e.id === 'prov-exp-blob-gallery');

      expect(loaded).toBeDefined();
      expect(loaded.galleryImages).toEqual([
        '/assets/images/valid-gallery-1.jpg',
        '/assets/images/valid-gallery-2.jpg',
      ]);
    });

    it('should fall back to usable albumPhotos when all galleryImages are expired blob URLs', () => {
      localStorage.setItem(
        'catamarca_provider_experiences_v1',
        JSON.stringify([
          {
            id: 'prov-exp-album-fallback',
            slug: 'prov-exp-album-fallback',
            title: 'Exp Fallback A Album',
            status: 'publicada',
            coverImage: '/assets/images/cover.jpg',
            galleryImages: [
              'blob:http://localhost:4200/expired-uuid-1',
            ],
            albumPhotos: [
              { url: 'blob:http://localhost:4200/expired-album-uuid' },
              { url: '/assets/images/valid-album-photo.jpg' },
            ],
          },
        ]),
      );

      const initial = (service as any).loadInitialExperiences();
      const loaded = initial.find((e: Experience) => e.id === 'prov-exp-album-fallback');

      expect(loaded).toBeDefined();
      expect(loaded.galleryImages).toEqual(['/assets/images/valid-album-photo.jpg']);
    });

    it('should fall back to coverImage when neither galleryImages nor albumPhotos has usable entries', () => {
      localStorage.setItem(
        'catamarca_provider_experiences_v1',
        JSON.stringify([
          {
            id: 'prov-exp-cover-fallback',
            slug: 'prov-exp-cover-fallback',
            title: 'Exp Fallback A Cover',
            status: 'publicada',
            coverImage: '/assets/images/custom-cover.jpg',
            galleryImages: [
              'blob:http://localhost:4200/expired-uuid-1',
              'blob:http://localhost:4200/expired-uuid-2',
            ],
            albumPhotos: [
              { url: 'blob:http://localhost:4200/expired-album-uuid' },
            ],
          },
        ]),
      );

      const initial = (service as any).loadInitialExperiences();
      const loaded = initial.find((e: Experience) => e.id === 'prov-exp-cover-fallback');

      expect(loaded).toBeDefined();
      expect(loaded.galleryImages).toEqual(['/assets/images/custom-cover.jpg']);
    });
  });

  describe('updateExperienceAlbum and gallery synchronization', () => {
    it('should synchronize galleryImages with replacement album photos and remove omitted photos', async () => {
      const expInitial: Experience = {
        ...baseExp,
        id: 'exp-album-test',
        slug: 'exp-album-test',
        albumPhotos: [
          { id: 'p1', url: '/img1.jpg', title: 'Foto 1', isCover: true, order: 1 },
          { id: 'p2', url: '/img2.jpg', title: 'Foto 2', isCover: false, order: 2 },
          { id: 'p3', url: '/img3.jpg', title: 'Foto 3 (a eliminar)', isCover: false, order: 3 },
        ],
        galleryImages: ['/img1.jpg', '/img2.jpg', '/img3.jpg'],
      };

      (service as any)._experiences.set([expInitial]);

      const updateQuery = {
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [{ id: 'exp-album-test' }], error: null }),
      };
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue(updateQuery),
      });

      // Nuevo álbum que excluye /img3.jpg y añade /img4.jpg
      const newAlbum = [
        { id: 'p1', url: '/img1.jpg', title: 'Foto 1', isCover: true, order: 1 },
        { id: 'p2', url: '/img2.jpg', title: 'Foto 2', isCover: false, order: 2 },
        { id: 'p4', url: '/img4.jpg', title: 'Foto 4', isCover: false, order: 3 },
      ];

      await service.updateExperienceAlbum('exp-album-test', newAlbum);

      // Verificar que el payload a Supabase contenga el reemplazo exacto
      const updateCall = mockSupabase.from('experiencias').update;
      expect(updateCall).toHaveBeenCalledWith(
        expect.objectContaining({
          gallery_images: ['/img1.jpg', '/img2.jpg', '/img4.jpg'],
          album_photos: newAlbum,
        }),
      );

      // Verificar que la señal en vivo experiences() tenga galleryImages sincronizado sin la foto omitida
      const updatedLive = service.experiences().find((e) => e.id === 'exp-album-test');
      expect(updatedLive?.galleryImages).toEqual(['/img1.jpg', '/img2.jpg', '/img4.jpg']);
      expect(updatedLive?.albumPhotos).toEqual(newAlbum);

      // Verificar que la persistencia en localStorage contenga el reemplazo exacto
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const storedExp = stored.find((e: any) => e.id === 'exp-album-test');
      expect(storedExp?.galleryImages).toEqual(['/img1.jpg', '/img2.jpg', '/img4.jpg']);
    });

    it('should update galleryImages in updateExperience when albumPhotos is explicitly provided', async () => {
      const expInitial: Experience = {
        ...baseExp,
        id: 'exp-update-album',
        slug: 'exp-update-album',
        albumPhotos: [
          { id: 'old-1', url: '/old1.jpg', title: 'Vieja 1', isCover: true, order: 1 },
          { id: 'old-2', url: '/old2.jpg', title: 'Vieja 2', isCover: false, order: 2 },
        ],
        galleryImages: ['/old1.jpg', '/old2.jpg'],
      };

      (service as any)._experiences.set([expInitial]);

      const updateQuery = {
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [{ id: 'exp-update-album' }], error: null }),
      };
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue(updateQuery),
      });

      const replacementAlbum = [
        { id: 'new-1', url: '/nueva1.jpg', title: 'Nueva 1', isCover: true, order: 1 },
      ];

      await service.updateExperience({
        id: 'exp-update-album',
        albumPhotos: replacementAlbum,
      });

      const updatedLive = service.experiences().find((e) => e.id === 'exp-update-album');
      expect(updatedLive?.galleryImages).toEqual(['/nueva1.jpg']);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const storedExp = stored.find((e: any) => e.id === 'exp-update-album');
      expect(storedExp?.galleryImages).toEqual(['/nueva1.jpg']);
    });
  });

  describe('provider experience gallery selection and blob filtering', () => {
    it('should filter unusable blob URLs from galleryImages preserving remaining valid entries', () => {
      localStorage.setItem(
        'catamarca_provider_experiences_v1',
        JSON.stringify([
          {
            id: 'prov-exp-blob-gallery',
            slug: 'prov-exp-blob-gallery',
            title: 'Exp Con Blobs En Galeria',
            status: 'publicada',
            coverImage: '/assets/images/cover.jpg',
            galleryImages: [
              'blob:http://localhost:4200/expired-uuid-1',
              '/assets/images/valid-gallery-1.jpg',
              'blob:http://localhost:4200/expired-uuid-2',
              '/assets/images/valid-gallery-2.jpg',
            ],
            albumPhotos: [
              { url: '/assets/images/album-1.jpg' },
            ],
          },
        ]),
      );

      const initial = (service as any).loadInitialExperiences();
      const loaded = initial.find((e: Experience) => e.id === 'prov-exp-blob-gallery');

      expect(loaded).toBeDefined();
      expect(loaded.galleryImages).toEqual([
        '/assets/images/valid-gallery-1.jpg',
        '/assets/images/valid-gallery-2.jpg',
      ]);
    });

    it('should fall back to usable albumPhotos when all galleryImages are expired blob URLs', () => {
      localStorage.setItem(
        'catamarca_provider_experiences_v1',
        JSON.stringify([
          {
            id: 'prov-exp-album-fallback',
            slug: 'prov-exp-album-fallback',
            title: 'Exp Fallback A Album',
            status: 'publicada',
            coverImage: '/assets/images/cover.jpg',
            galleryImages: [
              'blob:http://localhost:4200/expired-uuid-1',
            ],
            albumPhotos: [
              { url: 'blob:http://localhost:4200/expired-album-uuid' },
              { url: '/assets/images/valid-album-photo.jpg' },
            ],
          },
        ]),
      );

      const initial = (service as any).loadInitialExperiences();
      const loaded = initial.find((e: Experience) => e.id === 'prov-exp-album-fallback');

      expect(loaded).toBeDefined();
      expect(loaded.galleryImages).toEqual(['/assets/images/valid-album-photo.jpg']);
    });

    it('should fall back to coverImage when neither galleryImages nor albumPhotos has usable entries', () => {
      localStorage.setItem(
        'catamarca_provider_experiences_v1',
        JSON.stringify([
          {
            id: 'prov-exp-cover-fallback',
            slug: 'prov-exp-cover-fallback',
            title: 'Exp Fallback A Cover',
            status: 'publicada',
            coverImage: '/assets/images/custom-cover.jpg',
            galleryImages: [
              'blob:http://localhost:4200/expired-uuid-1',
              'blob:http://localhost:4200/expired-uuid-2',
            ],
            albumPhotos: [
              { url: 'blob:http://localhost:4200/expired-album-uuid' },
            ],
          },
        ]),
      );

      const initial = (service as any).loadInitialExperiences();
      const loaded = initial.find((e: Experience) => e.id === 'prov-exp-cover-fallback');

      expect(loaded).toBeDefined();
      expect(loaded.galleryImages).toEqual(['/assets/images/custom-cover.jpg']);
    });
  });

  describe('remote experience mapping and isCover matching', () => {
    it('should set isCover true for the gallery photo matching cover_image rather than assuming index 0', async () => {
      const remoteData = [
        {
          id: 'exp-cover-match',
          slug: 'exp-cover-match',
          title: 'Exp Con Cover en Posicion 1',
          cover_image: '/assets/images/photo-cover.jpg',
          gallery_images: [
            '/assets/images/photo-0.jpg',
            '/assets/images/photo-cover.jpg',
            '/assets/images/photo-2.jpg',
          ],
          album_photos: null, // Sin álbum explícito para activar el mapper desde gallery_images
          status: 'publicada',
        },
      ];

      const selectQuery = {
        order: vi.fn().mockResolvedValue({ data: remoteData, error: null }),
      };
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'experiencias') {
          return {
            select: vi.fn().mockReturnValue(selectQuery),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      });

      await (service as any).loadFromSupabase();

      const exp = service.experiences().find((e) => e.id === 'exp-cover-match');
      expect(exp).toBeDefined();
      expect(exp?.albumPhotos).toBeDefined();
      expect(exp?.albumPhotos?.length).toBe(3);

      // Foto 0 no es la portada
      expect(exp?.albumPhotos?.[0].url).toBe('/assets/images/photo-0.jpg');
      expect(exp?.albumPhotos?.[0].isCover).toBe(false);

      // Foto 1 coincide exactamente con cover_image -> isCover: true
      expect(exp?.albumPhotos?.[1].url).toBe('/assets/images/photo-cover.jpg');
      expect(exp?.albumPhotos?.[1].isCover).toBe(true);

      // Foto 2 no es la portada
      expect(exp?.albumPhotos?.[2].url).toBe('/assets/images/photo-2.jpg');
      expect(exp?.albumPhotos?.[2].isCover).toBe(false);
    });

    it('should leave every photo unmarked as cover when no gallery photo matches cover_image', async () => {
      const remoteData = [
        {
          id: 'exp-cover-no-match',
          slug: 'exp-cover-no-match',
          title: 'Exp Sin Match En Galeria',
          cover_image: '/assets/images/external-hero-cover.jpg',
          gallery_images: [
            '/assets/images/gallery-a.jpg',
            '/assets/images/gallery-b.jpg',
          ],
          album_photos: null,
          status: 'publicada',
        },
      ];

      const selectQuery = {
        order: vi.fn().mockResolvedValue({ data: remoteData, error: null }),
      };
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'experiencias') {
          return {
            select: vi.fn().mockReturnValue(selectQuery),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      });

      await (service as any).loadFromSupabase();

      const exp = service.experiences().find((e) => e.id === 'exp-cover-no-match');
      expect(exp).toBeDefined();
      expect(exp?.albumPhotos).toBeDefined();
      expect(exp?.albumPhotos?.length).toBe(2);

      // Ninguna foto debe tener isCover: true
      expect(exp?.albumPhotos?.every((p) => !p.isCover)).toBe(true);
    });
  });
});
