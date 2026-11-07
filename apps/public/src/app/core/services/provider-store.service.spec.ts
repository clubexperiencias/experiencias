import { TestBed } from '@angular/core/testing';
import { ProviderStoreService } from './provider-store.service';
import { ExperienceService } from './experience.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';
import { BANK_TRANSFER_DESTINATION, ProviderExperience } from '../models/bank-transfer.model';

describe('ProviderStoreService - Payment & Proposal Persistence', () => {
  let store: ProviderStoreService;
  let expService: ExperienceService;
  let mockSupabase: any;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('CATAMARCA_SUPABASE_URL', 'https://prod-project.supabase.co');
    localStorage.setItem(
      'CATAMARCA_SUPABASE_ANON_KEY',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid_anon_key_for_tests_123456789',
    );

    mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ data: [], error: null }),
        upsert: vi.fn().mockResolvedValue({ data: [], error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        in: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        ProviderStoreService,
        ExperienceService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      ],
    });

    store = TestBed.inject(ProviderStoreService);
    expService = TestBed.inject(ExperienceService);
  });

  describe('getPublicPaymentDetails', () => {
    it('should return official club payment destination for official club experiences', () => {
      const clubExp: Partial<ProviderExperience> = {
        slug: 'kayak',
        providerSlug: 'club-de-experiencias',
        providerName: 'Club de Experiencias',
        providerEmail: 'admin@experiencias.club',
      };

      const payment = store.getPublicPaymentDetails(clubExp as ProviderExperience);

      expect(payment.isOfficialClub).toBe(true);
      expect(payment.cbu).toBe('EXPERIENCIAS.CLUB.MP');
    });

    it('should return fallback club destination and hide private identifiers for anonymous visitors on third-party experiences', () => {
      vi.spyOn(expService, 'hasPrivilegedSession').mockReturnValue(false);

      const thirdPartyExp: Partial<ProviderExperience> = {
        slug: 'cabalgata-alturas',
        providerSlug: 'guia-pedro',
        providerName: 'Pedro Guía',
        providerEmail: 'pedro@andes.com',
        providerCbuAlias: 'PEDRO.PRIVADO.MP',
        providerCuitDni: '20-11223344-5',
        providerBankName: 'Banco Privado',
      };

      const payment = store.getPublicPaymentDetails(thirdPartyExp as ProviderExperience);

      expect(payment.isOfficialClub).toBe(true);
      expect(payment.cbu).toBe(BANK_TRANSFER_DESTINATION.cbu);
      expect(payment.cbu).not.toBe('PEDRO.PRIVADO.MP');
      expect(payment.taxId).toBe(BANK_TRANSFER_DESTINATION.taxId);
      expect(payment.taxId).not.toBe('20-11223344-5');
    });

    it('should expose provider settlement destination when session is privileged', () => {
      vi.spyOn(expService, 'hasPrivilegedSession').mockReturnValue(true);

      const thirdPartyExp: Partial<ProviderExperience> = {
        slug: 'cabalgata-alturas',
        providerSlug: 'guia-pedro',
        providerName: 'Pedro Guía',
        providerEmail: 'pedro@andes.com',
        providerCbuAlias: 'PEDRO.PRIVADO.MP',
        providerCuitDni: '20-11223344-5',
        providerBankName: 'Banco Privado',
      };

      const payment = store.getPublicPaymentDetails(thirdPartyExp as ProviderExperience);

      expect(payment.isOfficialClub).toBe(false);
      expect(payment.cbu).toBe('PEDRO.PRIVADO.MP');
      expect(payment.taxId).toBe('20-11223344-5');
      expect(payment.entity).toBe('Banco Privado');
    });
  });

  describe('submitExperienceRequest - banking isolation', () => {
    it('should not persist private banking identifiers into public experiencias row', async () => {
      let insertedExpPayload: any = null;
      let prestadoresUpdatePayload: any = null;

      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'experiencias') {
          return {
            upsert: vi.fn((payload: any) => {
              insertedExpPayload = payload;
              return Promise.resolve({ error: null });
            }),
          };
        }
        if (table === 'prestadores') {
          return {
            update: vi.fn((payload: any) => {
              prestadoresUpdatePayload = payload;
              return {
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({ data: [{ email: 'test@provider.com' }], error: null }),
                  then: (resolve: any) => resolve({ data: [{ email: 'test@provider.com' }], error: null }),
                }),
              };
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
        };
      });

      await store.submitExperienceRequest({
        providerId: 'prov-test',
        providerName: 'Test Provider',
        providerAgency: 'Agency Test',
        providerEmail: 'test@provider.com',
        providerPhone: '+5493834112233',
        providerCbuAlias: 'ALIAS.ISOLATED.MP',
        providerCuitDni: '20-99887766-5',
        providerBankName: 'Private Bank',
        title: 'Travesía Protegida',
        kicker: 'EXPERIENCIA',
        subheading: 'Subheading',
        region: 'Puna y Salares',
        difficulty: 'Baja',
        duration: '3 horas',
        capacity: 10,
        season: 'Todo el año',
        dates: '2026-12-01',
        priceArs: 50000,
        itinerary: 'Itinerario',
        meetingPoint: 'Punto',
        includedServices: 'Servicios',
        participantRequirements: 'Requisitos',
      });

      expect(insertedExpPayload).toBeDefined();
      expect(insertedExpPayload.provider_cbu_alias).toBeUndefined();
      expect(insertedExpPayload.provider_cuit_dni).toBeUndefined();
      expect(insertedExpPayload.provider_bank_name).toBeUndefined();

      expect(prestadoresUpdatePayload).toBeDefined();
      expect(prestadoresUpdatePayload.cbu_alias).toBe('ALIAS.ISOLATED.MP');
      expect(prestadoresUpdatePayload.cuit_dni).toBe('20-99887766-5');
      expect(prestadoresUpdatePayload.bank_name).toBe('Private Bank');
    });

    it('should read banking fields from prestadores table during approval flow', async () => {
      let createdExpCatalog: any = null;
      vi.spyOn(expService, 'createExperience').mockImplementation(async (exp: any) => {
        createdExpCatalog = exp;
      });

      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'prestadores') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    cbu_alias: 'PRESTADORES.BANK.ALIAS',
                    cuit_dni: '20-12345678-9',
                    bank_name: 'Banco Prestadores',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'experiencias') {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
        };
      });

      // Submit proposal first (in memory requests list)
      const req = await store.submitExperienceRequest({
        providerId: 'prov-approval-test',
        providerName: 'Approval Test',
        providerAgency: 'Agency Approval',
        providerEmail: 'approval@provider.com',
        providerPhone: '+5493834999999',
        title: 'Travesía Aprobación',
        kicker: 'EXPERIENCIA',
        subheading: 'Subheading',
        region: 'Valle Central',
        difficulty: 'Baja',
        duration: '2 horas',
        capacity: 8,
        season: 'Todo el año',
        dates: '2026-11-20',
        priceArs: 40000,
        itinerary: 'Itinerario',
        meetingPoint: 'Punto',
        includedServices: 'Servicios',
        participantRequirements: 'Requisitos',
      });

      const ok = await store.approveExperienceRequest(req.id);
      expect(ok).toBe(true);
      expect(createdExpCatalog).toBeDefined();
      expect(req.slug).toBeDefined();
      expect(createdExpCatalog.slug).toBe(req.slug);
      expect(createdExpCatalog.publicUrl).toBe(`https://experiencias.club/experiencias/${req.slug}`);
      expect(createdExpCatalog.providerCbuAlias).toBe('PRESTADORES.BANK.ALIAS');
      expect(createdExpCatalog.providerCuitDni).toBe('20-12345678-9');
      expect(createdExpCatalog.providerBankName).toBe('Banco Prestadores');
    });

    it('should generate a slug with stable id suffix and fallback for empty titles', async () => {
      let insertedExpPayload: any = null;
      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'experiencias') {
          return {
            upsert: vi.fn((payload: any) => {
              insertedExpPayload = payload;
              return Promise.resolve({ error: null });
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
        };
      });

      const req = await store.submitExperienceRequest({
        providerId: 'prov-slug-test',
        providerName: 'Slug Test',
        providerAgency: 'Agency',
        providerEmail: 'slug@provider.com',
        title: '!!! ??? ---',
        kicker: 'EXPERIENCIA',
        subheading: 'Subheading',
        region: 'Valle Central',
        difficulty: 'Baja',
        duration: '2 horas',
        capacity: 8,
        season: 'Todo el año',
        dates: '2026-11-20',
        priceArs: 40000,
        itinerary: 'Itinerario',
        meetingPoint: 'Punto',
        includedServices: 'Servicios',
        participantRequirements: 'Requisitos',
      });

      expect(req.slug).toBeDefined();
      expect(req.slug).toMatch(/^experiencia-[a-z0-9]+$/);
      expect(insertedExpPayload.slug).toBe(req.slug);
    });

    it('should use stored slug and custom publicUrl in approveExperienceRequest', async () => {
      let createdExpCatalog: any = null;
      vi.spyOn(expService, 'createExperience').mockImplementation(async (exp: any) => {
        createdExpCatalog = exp;
      });

      const req = await store.submitExperienceRequest({
        providerId: 'prov-stored-slug',
        providerName: 'Stored Slug',
        providerAgency: 'Agency',
        providerEmail: 'stored@provider.com',
        title: 'Travesía Especial',
        kicker: 'EXPERIENCIA',
        subheading: 'Subheading',
        region: 'Valle Central',
        difficulty: 'Baja',
        duration: '2 horas',
        capacity: 8,
        season: 'Todo el año',
        dates: '2026-11-20',
        priceArs: 40000,
        itinerary: 'Itinerario',
        meetingPoint: 'Punto',
        includedServices: 'Servicios',
        participantRequirements: 'Requisitos',
      });

      expect(req.slug).toBeDefined();
      const customUrl = 'https://experiencias.club/experiencias/custom-url-test';
      const ok = await store.approveExperienceRequest(req.id, customUrl);
      expect(ok).toBe(true);
      expect(createdExpCatalog.slug).toBe(req.slug);
      expect(createdExpCatalog.publicUrl).toBe(customUrl);
    });

    it('should rollback local state, save requests, and return false when expService.updateExperience fails during rejection', async () => {
      const testExp = {
        id: 'req-fail-test',
        slug: 'req-fail-test-slug',
        title: 'Fallo Rechazo',
        status: 'pendiente' as const,
      } as any;
      vi.spyOn(expService, 'experiences').mockReturnValue([testExp]);
      vi.spyOn(expService, 'updateExperience').mockRejectedValue(new Error('Remote update error'));

      const saveSpy = vi.spyOn(store as any, 'saveRequests');

      const req = await store.submitExperienceRequest({
        providerId: 'prov-fail-test',
        providerName: 'Fail Test',
        providerAgency: 'Agency',
        providerEmail: 'fail@provider.com',
        title: 'Fallo Rechazo',
        kicker: 'EXPERIENCIA',
        subheading: 'Subheading',
        region: 'Valle Central',
        difficulty: 'Baja',
        duration: '2 horas',
        capacity: 8,
        season: 'Todo el año',
        dates: '2026-11-20',
        priceArs: 40000,
        itinerary: 'Itinerario',
        meetingPoint: 'Punto',
        includedServices: 'Servicios',
        participantRequirements: 'Requisitos',
      });

      (store as any)._experienceRequests.update((list: any[]) =>
        list.map((r) => (r.id === req.id ? { ...r, id: 'req-fail-test', status: 'pendiente' } : r)),
      );

      const result = await store.rejectExperienceRequest('req-fail-test');

      expect(result).toBe(false);
      const restored = store.experienceRequests().find((r) => r.id === 'req-fail-test');
      expect(restored?.status).toBe('pendiente');
      expect(saveSpy).toHaveBeenCalled();
    });

    it('should update existing remote row and reload instead of calling createExperience when remoteRow exists', async () => {
      let updatedPayload: any = null;
      let updatedId: string | null = null;

      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'experiencias') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((_field: string, val: any) => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: val, slug: 'remote-slug-test', status: 'pendiente' },
                  error: null,
                }),
              })),
            })),
            update: vi.fn((payload: any) => ({
              eq: vi.fn((_field: string, val: any) => {
                updatedPayload = payload;
                updatedId = val;
                return Promise.resolve({ data: [], error: null });
              }),
            })),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
        };
      });

      const createSpy = vi.spyOn(expService, 'createExperience').mockResolvedValue(undefined);
      const reloadSpy = vi.spyOn(expService, 'reloadFromSupabase').mockResolvedValue(true);

      const req = await store.submitExperienceRequest({
        providerId: 'prov-remote-test',
        providerName: 'Remote Test',
        providerAgency: 'Agency',
        providerEmail: 'remote@provider.com',
        title: 'Travesía Remota',
        kicker: 'EXPERIENCIA',
        subheading: 'Subheading',
        region: 'Valle Central',
        difficulty: 'Baja',
        duration: '2 horas',
        capacity: 8,
        season: 'Todo el año',
        dates: '2026-11-20',
        priceArs: 40000,
        itinerary: 'Itinerario',
        meetingPoint: 'Punto',
        includedServices: 'Servicios',
        participantRequirements: 'Requisitos',
      });

      const ok = await store.approveExperienceRequest(
        req.id,
        'https://experiencias.club/experiencias/custom-remote',
        ['2026-12-01'],
      );
      expect(ok).toBe(true);
      expect(createSpy).not.toHaveBeenCalled();
      expect(reloadSpy).toHaveBeenCalled();
      expect(updatedId).toBe(req.id);
      expect(updatedPayload).toBeDefined();
      expect(updatedPayload.status).toBe('publicada');
      expect(updatedPayload.slug).toBe(req.slug);
      expect(updatedPayload.public_url).toBe('https://experiencias.club/experiencias/custom-remote');
      expect(updatedPayload.dates).toEqual(['2026-12-01']);
    });
  });

  describe('getProviderBySlug', () => {
    const sampleProviders = [
      {
        id: 'prov-001',
        name: 'Carlos Montaña',
        agency: 'Aconquija Expediciones',
        slug: 'aconquija',
        email: 'aconquija@test.com',
      },
      {
        id: 'prov-002',
        name: 'Aconquija Guía',
        agency: 'Otra Agencia',
        slug: 'aconquija-guia',
        email: 'guia@test.com',
      },
      {
        id: 'aconquija-guia-raw',
        name: 'Tercer Prestador',
        agency: 'Tercera Agencia',
        slug: 'tercero',
        email: 'carlos@test.com',
      },
    ];

    beforeEach(() => {
      (store as any)._providers.set(sampleProviders);
    });

    it('should prioritize exact slug match in first pass over agency/name fallbacks', () => {
      const found = store.getProviderBySlug('aconquija');
      expect(found?.id).toBe('prov-001');
    });

    it('should prioritize exact ID match in first pass', () => {
      const found = store.getProviderBySlug('prov-002');
      expect(found?.name).toBe('Aconquija Guía');
    });

    it('should resolve agency fallback in second pass when no exact slug or ID matches', () => {
      const found = store.getProviderBySlug('aconquija-expediciones');
      expect(found?.id).toBe('prov-001');
    });

    it('should resolve name fallback in second pass when no exact slug or ID matches', () => {
      const found = store.getProviderBySlug('carlos-montana');
      expect(found?.id).toBe('prov-001');
    });

    it('should NOT match email local-part', () => {
      const found = store.getProviderBySlug('carlos');
      expect(found).toBeUndefined();
    });
  });
});

