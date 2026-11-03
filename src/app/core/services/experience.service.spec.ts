import { TestBed } from '@angular/core/testing';
import { ExperienceService, RESERVED_EXPERIENCE_SLUGS } from './experience.service';
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

    it('should reject reserved slugs', async () => {
      for (const reserved of Array.from(RESERVED_EXPERIENCE_SLUGS)) {
        await expect(
          service.createExperience({ ...baseExp, slug: reserved }),
        ).rejects.toThrow(`El slug "${reserved}" está reservado por el sistema y no puede ser utilizado.`);
      }
    });

    it('should reject slugs already in use', async () => {
      const existingSlug = service.experiences()[0].slug;
      await expect(
        service.createExperience({ ...baseExp, slug: existingSlug }),
      ).rejects.toThrow(`Ya existe una experiencia con el slug "${existingSlug}".`);
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
});
