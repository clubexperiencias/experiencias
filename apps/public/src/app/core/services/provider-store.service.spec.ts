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
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ data: { path: 'receipts/test.jpg' }, error: null }),
          getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.test/receipt.jpg' } }),
          createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://cdn.test/signed.jpg' }, error: null }),
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

  describe('TransferSubmission status handling in submitTransfer and loadStoredSubmissions', () => {
    it('should assign pendiente status to newly created transfer payments', async () => {
      const exp: Partial<ProviderExperience> = {
        id: 'exp-kayak-test',
        slug: 'kayak-en-el-jumeal',
        title: 'Kayak en El Jumeal',
        status: 'publicada',
        priceArs: 15000,
        dates: ['2026-11-20'],
        capacityPerDate: 10,
      };
      (store as any)._experiences.set([exp]);

      const file = new File(['dummy-content'], 'comprobante.jpg', { type: 'image/jpeg' });
      const sub = await store.submitTransfer({
        experienceId: 'exp-kayak-test',
        date: '2026-11-20',
        participants: 1,
        fullName: 'Juan Pérez',
        email: 'juan@test.com',
        dni: '38123456',
        phone: '+5493834112233',
        receiptFile: file,
      });

      expect(sub.status).toBe('pendiente');
    });

    it('should preserve pendiente, aprobado, and rechazado statuses on loadStoredSubmissions without promoting unreviewed receipts', () => {
      const stored = [
        { id: 'sub-p1', amountArs: 10000, status: 'pendiente' },
        { id: 'sub-a1', amountArs: 20000, status: 'aprobado' },
        { id: 'sub-r1', amountArs: 30000, status: 'rechazado' },
        { id: 'sub-u1', amountArs: 40000, status: 'otro_o_vacio' },
      ];
      localStorage.setItem('catamarca_provider_submissions_v5', JSON.stringify(stored));

      const loaded = (store as any).loadStoredSubmissions();

      expect(loaded.find((s: any) => s.id === 'sub-p1')?.status).toBe('pendiente');
      expect(loaded.find((s: any) => s.id === 'sub-a1')?.status).toBe('aprobado');
      expect(loaded.find((s: any) => s.id === 'sub-r1')?.status).toBe('rechazado');
      expect(loaded.find((s: any) => s.id === 'sub-u1')?.status).toBe('pendiente');
    });

    it('should calculate confirmedRevenue using only approved submissions in providerStats', () => {
      const mockExp: Partial<ProviderExperience> = {
        id: 'exp-stats-1',
        providerId: 'prov-current',
        status: 'publicada',
      };
      (store as any)._experiences.set([mockExp]);
      (store as any)._currentProvider.set({ id: 'prov-current', email: 'prov@test.com' });

      (store as any)._submissions.set([
        { id: 'sub-1', experienceId: 'exp-stats-1', amountArs: 10000, participants: 2, status: 'aprobado', submittedAt: '2026-11-08T00:00:00.000Z' },
        { id: 'sub-2', experienceId: 'exp-stats-1', amountArs: 15000, participants: 3, status: 'pendiente', submittedAt: '2026-11-08T00:00:00.000Z' },
        { id: 'sub-3', experienceId: 'exp-stats-1', amountArs: 20000, participants: 4, status: 'rechazado', submittedAt: '2026-11-08T00:00:00.000Z' },
      ]);

      const stats = store.providerStats();
      expect(stats.confirmedRevenue).toBe(10000);
      expect(stats.pendingRevenue).toBe(15000);
      expect(stats.totalEnrolled).toBe(2);
      expect(stats.pendingReceiptsCount).toBe(1);
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
        name: 'Guía Andino',
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
        email: 'andino@test.com',
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
      const found = store.getProviderBySlug('guia-andino');
      expect(found?.id).toBe('prov-001');
    });

    it('should NOT match email local-part', () => {
      const found = store.getProviderBySlug('andino');
      expect(found).toBeUndefined();
    });
  });

  describe('adminUpdateProvider - remote notes preservation', () => {
    it('should preserve remote notes and pausedByBajaExpIds when updating unrelated provider fields', async () => {
      const existingProvider = {
        id: 'prov-001',
        name: 'Guía Juan',
        email: 'juan@test.com',
        phone: '12345',
        status: 'aprobado' as const,
        notes: '',
      };
      (store as any)._providers.set([existingProvider]);

      const remoteNotesJson = JSON.stringify({
        pausedByBajaExpIds: ['exp-1', 'exp-2'],
        text: 'Nota previa',
      });

      let capturedPayload: any = null;
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'prestadores') {
          return {
            select: vi.fn().mockImplementation((cols: string) => {
              if (cols === 'notes') {
                return {
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { notes: remoteNotesJson },
                      error: null,
                    }),
                  }),
                };
              }
              return {
                eq: vi.fn().mockResolvedValue({ data: [{ id: 'prov-001' }], error: null }),
              };
            }),
            update: vi.fn().mockImplementation((payload: any) => {
              capturedPayload = payload;
              return {
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({
                    data: [{ id: 'prov-001' }],
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
        };
      });

      const res = await store.adminUpdateProvider('juan@test.com', {
        phone: '5493834001122',
      });

      expect(res.success).toBe(true);
      expect(capturedPayload).toBeTruthy();
      expect(capturedPayload.phone).toBe('5493834001122');
      expect(capturedPayload.notes).toBeUndefined();
      const updated = store.allProviders().find((p) => p.email === 'juan@test.com');
      expect(updated?.notes).toBe(remoteNotesJson);
    });

    it('should treat updates.notes as full new value without merging missing remote keys when caller loaded remote notes', async () => {
      const initialNotesJson = JSON.stringify({
        pausedByBajaExpIds: ['exp-1'],
        extraKey: 'toDelete',
        text: 'nota original',
      });
      const existingProvider = {
        id: 'prov-002',
        name: 'Guía Maria',
        email: 'maria@test.com',
        phone: '12345',
        status: 'aprobado' as const,
        notes: initialNotesJson,
      };
      (store as any)._providers.set([existingProvider]);

      let capturedPayload: any = null;
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'prestadores') {
          return {
            select: vi.fn().mockImplementation((cols: string) => {
              if (cols === 'notes') {
                return {
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { notes: initialNotesJson },
                      error: null,
                    }),
                  }),
                };
              }
              return {
                eq: vi.fn().mockResolvedValue({ data: [{ id: 'prov-002' }], error: null }),
              };
            }),
            update: vi.fn().mockImplementation((payload: any) => {
              capturedPayload = payload;
              return {
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({
                    data: [{ id: 'prov-002' }],
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      // El caller envía una actualización explícita que eliminó pausedByBajaExpIds y extraKey
      const newNotesObj = { text: 'nota modificada' };
      const res = await store.adminUpdateProvider('maria@test.com', {
        notes: JSON.stringify(newNotesObj),
      });

      expect(res.success).toBe(true);
      expect(capturedPayload).toBeTruthy();
      const savedNotes = JSON.parse(capturedPayload.notes);
      expect(savedNotes).toEqual({ text: 'nota modificada' });
      expect(savedNotes.pausedByBajaExpIds).toBeUndefined();
      expect(savedNotes.extraKey).toBeUndefined();
    });

    it('should preserve pausedByBajaExpIds via shouldPreserveBajaIds only when caller had not loaded remote notes', async () => {
      const existingProvider = {
        id: 'prov-003',
        name: 'Guía Pedro',
        email: 'pedro@test.com',
        phone: '12345',
        status: 'aprobado' as const,
        notes: '', // local notes NO tenía pausedByBajaExpIds
      };
      (store as any)._providers.set([existingProvider]);

      const remoteNotesJson = JSON.stringify({
        pausedByBajaExpIds: ['exp-3', 'exp-4'],
        text: 'remoto',
      });

      let capturedPayload: any = null;
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'prestadores') {
          return {
            select: vi.fn().mockImplementation((cols: string) => {
              if (cols === 'notes') {
                return {
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { notes: remoteNotesJson },
                      error: null,
                    }),
                  }),
                };
              }
              return {
                eq: vi.fn().mockResolvedValue({ data: [{ id: 'prov-003' }], error: null }),
              };
            }),
            update: vi.fn().mockImplementation((payload: any) => {
              capturedPayload = payload;
              return {
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({
                    data: [{ id: 'prov-003' }],
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const res = await store.adminUpdateProvider('pedro@test.com', {
        notes: JSON.stringify({ text: 'nueva nota desde formulario ciego' }),
      });

      expect(res.success).toBe(true);
      expect(capturedPayload).toBeTruthy();
      const savedNotes = JSON.parse(capturedPayload.notes);
      expect(savedNotes.text).toBe('nueva nota desde formulario ciego');
      expect(savedNotes.pausedByBajaExpIds).toEqual(['exp-3', 'exp-4']);
    });
  });

  describe('loadProviderNotes', () => {
    it('should query Supabase for remote notes and update local provider when found', async () => {
      const prov = {
        id: 'prov-notes-1',
        name: 'Guía Test',
        email: 'guia-notes@test.com',
        phone: '123',
        status: 'aprobado' as const,
        notes: 'local note',
      };
      (store as any)._providers.set([prov]);

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'prestadores') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { notes: JSON.stringify({ pausedByBajaExpIds: ['exp-99'], text: 'remote' }) },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const notes = await store.loadProviderNotes('guia-notes@test.com');
      expect(notes).toBe(JSON.stringify({ pausedByBajaExpIds: ['exp-99'], text: 'remote' }));
      const updated = store.allProviders().find((p) => p.email === 'guia-notes@test.com');
      expect(updated?.notes).toBe(notes);
    });

    it('should return null when remote lookup fails or notes not found', async () => {
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'prestadores') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Not found' },
                }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const notes = await store.loadProviderNotes('inexistente@test.com');
      expect(notes).toBeNull();
    });
  });

  describe('loadProposalsFromSupabase - provider refresh and approval recognition', () => {
    it('should query published status and map remote status "publicada" to "aprobada", preserving approved requests', async () => {
      // Local proposals before refresh: an approved request from this provider and one from another provider
      const localApprovedReq: any = {
        id: 'prop-approved-local',
        title: 'Trekking Antofagasta',
        providerEmail: 'guia@test.com',
        status: 'aprobada',
        createdAt: '2026-10-01T10:00:00.000Z',
      };
      const otherProviderReq: any = {
        id: 'prop-other',
        title: 'Cabalgata Belén',
        providerEmail: 'otro@test.com',
        status: 'pendiente',
        createdAt: '2026-10-02T10:00:00.000Z',
      };
      (store as any)._experienceRequests.set([localApprovedReq, otherProviderReq]);

      let capturedStatuses: string[] = [];
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'experiencias') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockImplementation((col: string, values: string[]) => {
                capturedStatuses = values;
                return {
                  ilike: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: 'remote-pub-1',
                          title: 'Volcán Galán 4x4',
                          provider_email: 'guia@test.com',
                          status: 'publicada',
                          created_at: '2026-10-05T10:00:00.000Z',
                        },
                        {
                          id: 'remote-pend-1',
                          title: 'Ruta del Adobe',
                          provider_email: 'guia@test.com',
                          status: 'pendiente',
                          created_at: '2026-10-06T10:00:00.000Z',
                        },
                      ],
                      error: null,
                    }),
                  }),
                };
              }),
            }),
          };
        }
        if (table === 'prestadores') {
          return {
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
        };
      });

      await store.loadProposalsFromSupabase('guia@test.com');

      expect(capturedStatuses).toContain('publicada');
      expect(capturedStatuses).toContain('pendiente');
      expect(capturedStatuses).toContain('rechazada');

      const all = store.experienceRequests();
      // remote-pub-1 should be mapped to status: 'aprobada'
      const remotePub = all.find((r) => r.id === 'remote-pub-1');
      expect(remotePub).toBeTruthy();
      expect(remotePub?.status).toBe('aprobada');

      // remote-pend-1 should remain 'pendiente'
      const remotePend = all.find((r) => r.id === 'remote-pend-1');
      expect(remotePend).toBeTruthy();
      expect(remotePend?.status).toBe('pendiente');

      // localApprovedReq from same provider should be preserved
      const preservedLocal = all.find((r) => r.id === 'prop-approved-local');
      expect(preservedLocal).toBeTruthy();
      expect(preservedLocal?.status).toBe('aprobada');

      // otherProviderReq from different provider should also be preserved
      const preservedOther = all.find((r) => r.id === 'prop-other');
      expect(preservedOther).toBeTruthy();
    });

    it('should include "publicada" and "oculta" in statusFilter during global query so approved proposals remain in _experienceRequests', async () => {
      let capturedStatuses: string[] = [];
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'experiencias') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockImplementation((col: string, values: string[]) => {
                capturedStatuses = values;
                return {
                  order: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: 'global-pub-1',
                        title: 'Experiencia Oficial Aprobada',
                        provider_email: 'oficial@test.com',
                        status: 'publicada',
                        created_at: '2026-10-10T10:00:00.000Z',
                      },
                      {
                        id: 'global-paused-1',
                        title: 'Experiencia Aprobada Pausada',
                        provider_email: 'pausado@test.com',
                        status: 'oculta',
                        created_at: '2026-10-10T11:00:00.000Z',
                      },
                      {
                        id: 'global-pend-1',
                        title: 'Experiencia Nueva',
                        provider_email: 'otro@test.com',
                        status: 'pendiente',
                        created_at: '2026-10-11T10:00:00.000Z',
                      },
                      {
                        id: 'direct-created-1',
                        title: 'Experiencia Creada Directamente',
                        provider_email: '',
                        status: 'publicada',
                        created_at: '2026-10-12T10:00:00.000Z',
                      },
                      {
                        id: 'direct-created-paused',
                        title: 'Experiencia Directa Pausada',
                        provider_email: null,
                        status: 'oculta',
                        created_at: '2026-10-12T11:00:00.000Z',
                      },
                    ],
                    error: null,
                  }),
                };
              }),
            }),
          };
        }
        if (table === 'prestadores') {
          return {
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      await store.loadProposalsFromSupabase();

      expect(capturedStatuses).toEqual(['pendiente', 'rechazada', 'publicada', 'oculta']);
      const requests = store.experienceRequests();
      const approved = requests.find((r) => r.id === 'global-pub-1');
      expect(approved).toBeTruthy();
      expect(approved?.status).toBe('aprobada');
      const pausedApproved = requests.find((r) => r.id === 'global-paused-1');
      expect(pausedApproved).toBeTruthy();
      expect(pausedApproved?.status).toBe('aprobada');
      const direct1 = requests.find((r) => r.id === 'direct-created-1');
      expect(direct1).toBeUndefined();
      const directPaused = requests.find((r) => r.id === 'direct-created-paused');
      expect(directPaused).toBeUndefined();
    });
  });
});

