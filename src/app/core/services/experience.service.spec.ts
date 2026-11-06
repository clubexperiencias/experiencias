import { TestBed } from '@angular/core/testing';
import {
  ExperienceService,
  RESERVED_EXPERIENCE_SLUGS,
  STORAGE_KEY,
  PRIVILEGED_STORAGE_KEY,
} from './experience.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';
import { Experience } from '../models/experience.model';

describe('ExperienceService', () => {
  let service: ExperienceService;
  let mockSupabase: any;

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
  });

  describe('createExperience', () => {
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

      // Privileged items are in PRIVILEGED_STORAGE_KEY
      const privRaw = localStorage.getItem(PRIVILEGED_STORAGE_KEY);
      expect(privRaw).toBeTruthy();
      const privParsed: Experience[] = JSON.parse(privRaw!);
      expect(privParsed.some((e) => e.id === 'exp-pend')).toBe(true);
    });

    it('should clear privileged proposal copies and reset state on clearPrivilegedCache', () => {
      localStorage.setItem('catamarca_admin_session_v1', JSON.stringify({ email: 'admin@experiencias.club' }));
      localStorage.setItem('catamarca_experience_requests_v1', JSON.stringify([{ id: 'req-1', status: 'pendiente' }]));
      localStorage.setItem('catamarca_provider_experiences_v5', JSON.stringify([{ id: 'prov-1', status: 'borrador' }]));
      localStorage.setItem(PRIVILEGED_STORAGE_KEY, JSON.stringify([{ id: 'exp-pend', status: 'pendiente' }]));

      service.clearPrivilegedCache();

      expect(localStorage.getItem(PRIVILEGED_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem('catamarca_experience_requests_v1')).toBeNull();
      expect(localStorage.getItem('catamarca_provider_experiences_v5')).toBeNull();
      expect(service.experiences().some((e) => e.status === 'pendiente')).toBe(false);
    });
  });
});
