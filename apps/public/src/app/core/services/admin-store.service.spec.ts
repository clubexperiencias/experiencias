import { TestBed } from '@angular/core/testing';
import { AdminStoreService } from './admin-store.service';
import { ProviderStoreService } from './provider-store.service';
import { NotificationService } from './notification.service';
import { NewsletterService } from './newsletter.service';
import { ExperienceService } from './experience.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';

describe('AdminStoreService - Provider Status Update Flow', () => {
  let adminStore: AdminStoreService;
  let mockSupabase: any;
  let mockNotification: any;
  let mockProviderStore: any;

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
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
    };

    mockNotification = {
      notifyProviderApproved: vi.fn().mockResolvedValue({ success: true }),
    };

    mockProviderStore = {
      allProviders: vi.fn().mockReturnValue([]),
      experienceRequests: vi.fn().mockReturnValue([]),
      syncProviderStatusFromAdmin: vi.fn(),
      loadStoredProviders: vi.fn().mockReturnValue([]),
      reloadFromStorage: vi.fn(),
      syncClubProviderProfile: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AdminStoreService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
        { provide: NotificationService, useValue: mockNotification },
        { provide: ProviderStoreService, useValue: mockProviderStore },
        { provide: NewsletterService, useValue: {} },
        {
          provide: ExperienceService,
          useValue: { getClubProfile: vi.fn(), syncClubExperiencesWithProfile: vi.fn() },
        },
      ],
    });

    adminStore = TestBed.inject(AdminStoreService);
  });

  it('should succeed and notify when exactly 1 row is updated in prestadores', async () => {
    let capturedOptions: any = null;
    const mockUpdateQuery = {
      eq: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: any) => resolve({ data: [{ id: 'prov-1' }], count: 1, error: null })),
    };

    mockSupabase.from = vi.fn((table: string) => {
      if (table === 'prestadores') {
        return {
          update: vi.fn((payload: any, options: any) => {
            capturedOptions = options;
            return mockUpdateQuery;
          }),
        };
      }
      return {};
    });

    // Seed local application
    (adminStore as any)._applications.set([
      {
        id: 'prov-1',
        type: 'prestador',
        status: 'pendiente',
        email: 'guia@catamarca.com',
        fullName: 'Guía Catamarca',
      },
    ]);

    const result = await adminStore.updateApplicationStatus('prov-1', 'prestador', 'aprobado');

    expect(capturedOptions).toEqual({ count: 'exact' });
    expect(mockUpdateQuery.eq).toHaveBeenCalledWith('id', 'prov-1');
    expect(result).toBe(true);
    expect(mockNotification.notifyProviderApproved).toHaveBeenCalledWith({
      fullName: 'Guía Catamarca',
      email: 'guia@catamarca.com',
    });
    expect(mockProviderStore.syncProviderStatusFromAdmin).toHaveBeenCalled();
  });

  it('should fail and not notify when count is not 1 (e.g. 0 rows updated)', async () => {
    const mockUpdateQuery = {
      eq: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: any) => resolve({ data: [], count: 0, error: null })),
    };

    mockSupabase.from = vi.fn((table: string) => {
      if (table === 'prestadores') {
        return {
          update: vi.fn().mockReturnValue(mockUpdateQuery),
        };
      }
      return {};
    });

    (adminStore as any)._applications.set([
      {
        id: 'prov-non-existent',
        type: 'prestador',
        status: 'pendiente',
        email: 'unknown@catamarca.com',
        fullName: 'Desconocido',
      },
    ]);

    const result = await adminStore.updateApplicationStatus(
      'prov-non-existent',
      'prestador',
      'aprobado',
    );

    expect(result).toBe(false);
    expect(mockNotification.notifyProviderApproved).not.toHaveBeenCalled();
    expect(mockProviderStore.syncProviderStatusFromAdmin).not.toHaveBeenCalled();
  });

  it('should fail and not notify when Supabase returns an error', async () => {
    const mockUpdateQuery = {
      eq: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: any) =>
        resolve({ data: null, count: null, error: { message: 'RLS violation' } }),
      ),
    };

    mockSupabase.from = vi.fn((table: string) => {
      if (table === 'prestadores') {
        return {
          update: vi.fn().mockReturnValue(mockUpdateQuery),
        };
      }
      return {};
    });

    (adminStore as any)._applications.set([
      {
        id: 'prov-err',
        type: 'prestador',
        status: 'pendiente',
        email: 'err@catamarca.com',
        fullName: 'Error Test',
      },
    ]);

    const result = await adminStore.updateApplicationStatus('prov-err', 'prestador', 'aprobado');

    expect(result).toBe(false);
    expect(mockNotification.notifyProviderApproved).not.toHaveBeenCalled();
  });

  describe('loadAllMembers waitlist mapping', () => {
    it('should map waitlist members preserving dni, phone, and experiencesWishlist from RPC', async () => {
      mockSupabase.rpc = vi.fn().mockImplementation((fn: string) => {
        if (fn === 'get_admin_all_members') {
          return Promise.resolve({
            data: {
              socios: [],
              waitlist: [
                {
                  id: 'w-1',
                  email: 'prospecto@ejemplo.com',
                  fullName: 'Prospecto Completo',
                  dni: '30111222',
                  phone: '+5493834111222',
                  experiencesWishlist: ['exp-kayak', 'exp-cabalgata'],
                  experiencesOther: 'Trekking guiado',
                  googleLinked: true,
                  paymentsCount: 1,
                  createdAt: '2026-11-01T10:00:00Z',
                },
              ],
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      await adminStore.loadAllMembers();

      const members = adminStore.members();
      expect(members.length).toBe(1);
      const w = members[0];
      expect(w.id).toBe('w-1');
      expect(w.type).toBe('waitlist');
      expect(w.dni).toBe('30111222');
      expect(w.phone).toBe('+5493834111222');
      expect(w.experiencesWishlist).toEqual(['exp-kayak', 'exp-cabalgata']);
      expect(w.experiencesOther).toBe('Trekking guiado');
      expect(w.converted).toBe(true);
    });

    it('should fallback to placeholders and empty array when waitlist fields are missing or not an array', async () => {
      mockSupabase.rpc = vi.fn().mockImplementation((fn: string) => {
        if (fn === 'get_admin_all_members') {
          return Promise.resolve({
            data: {
              socios: [],
              waitlist: [
                {
                  id: 'w-2',
                  email: 'vacio@ejemplo.com',
                  fullName: '',
                  dni: null,
                  phone: undefined,
                  experiencesWishlist: 'invalid-string-not-array',
                  experiencesOther: null,
                  googleLinked: false,
                  paymentsCount: 0,
                  createdAt: '2026-11-02T10:00:00Z',
                },
              ],
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      await adminStore.loadAllMembers();

      const members = adminStore.members();
      expect(members.length).toBe(1);
      const w = members[0];
      expect(w.id).toBe('w-2');
      expect(w.dni).toBe('—');
      expect(w.phone).toBe('—');
      expect(w.experiencesWishlist).toEqual([]);
      expect(w.converted).toBe(false);
    });
  });

  describe('AdminStoreService - updateMemberProfile rollback and fallback flow', () => {
    const sampleMember = {
      id: 'usr-1234-uuid',
      email: 'socio@club.com',
      fullName: 'Socio Original',
      dni: '35123456',
      phone: '+5493834111222',
      membershipTier: 'activo' as const,
      type: 'socio' as const,
      position: 1,
      googleLinked: false,
      converted: true,
      experiencesWishlist: [],
      experiencesOther: '',
      paymentsCount: 1,
      totalSpentArs: 10000,
      createdAt: '2026-01-01T00:00:00Z',
    };

    beforeEach(() => {
      // Seed _members via internal signal by loading or setting
      (adminStore as any)._members.set([sampleMember]);
      localStorage.setItem('admin_members_cache', JSON.stringify([sampleMember]));
    });

    it('should successfully update member and persist when Supabase update succeeds with count 1', async () => {
      const eqSpy = vi.fn().mockResolvedValue({ error: null, count: 1 });
      const updateSpy = vi.fn().mockReturnValue({ eq: eqSpy });
      mockSupabase.from.mockReturnValue({ update: updateSpy });

      const res = await adminStore.updateMemberProfile('usr-1234-uuid', {
        fullName: 'Socio Actualizado',
        phone: '+5493834999999',
      });

      expect(res.success).toBe(true);
      const updated = adminStore.getMemberById('usr-1234-uuid');
      expect(updated?.fullName).toBe('Socio Actualizado');
      expect(updated?.phone).toBe('+5493834999999');
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: 'Socio Actualizado',
          phone: '+5493834999999',
        }),
        { count: 'exact' },
      );
      expect(eqSpy).toHaveBeenCalledWith('id', 'usr-1234-uuid');
    });

    it('should rollback _members and localStorage when primary update returns an error and cannot retry', async () => {
      const eqSpy = vi.fn().mockResolvedValue({
        error: { code: '42501', message: 'permission denied' },
        count: 0,
      });
      const updateSpy = vi.fn().mockReturnValue({ eq: eqSpy });
      mockSupabase.from.mockReturnValue({ update: updateSpy });

      const res = await adminStore.updateMemberProfile('usr-1234-uuid', {
        fullName: 'Nombre Fallido',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('permission denied');
      // Verificamos que se restauró el estado original
      const rolledBack = adminStore.getMemberById('usr-1234-uuid');
      expect(rolledBack?.fullName).toBe('Socio Original');
      const cached = JSON.parse(localStorage.getItem('admin_members_cache') || '[]');
      expect(cached[0].fullName).toBe('Socio Original');
    });

    it('should not retry by email on payload/constraint errors (e.g. 23505 unique violation) and rollback', async () => {
      const eqSpy = vi.fn().mockResolvedValue({
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
        count: 0,
      });
      const updateSpy = vi.fn().mockReturnValue({ eq: eqSpy });
      mockSupabase.from.mockReturnValue({ update: updateSpy });

      const res = await adminStore.updateMemberProfile('usr-1234-uuid', {
        email: 'existente@club.com',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('duplicate key');
      // No debe haberse llamado una segunda vez a eq('email', ...)
      expect(eqSpy).toHaveBeenCalledTimes(1);
      expect(eqSpy).toHaveBeenCalledWith('id', 'usr-1234-uuid');

      // Estado restaurado
      expect(adminStore.getMemberById('usr-1234-uuid')?.email).toBe('socio@club.com');
    });

    it('should rollback when update returns count 0 and email fallback also yields count 0', async () => {
      const eqSpy = vi
        .fn()
        .mockResolvedValueOnce({ error: null, count: 0 }) // Primario por id
        .mockResolvedValueOnce({ error: null, count: 0 }); // Fallback por email
      const updateSpy = vi.fn().mockReturnValue({ eq: eqSpy });
      mockSupabase.from.mockReturnValue({ update: updateSpy });

      const res = await adminStore.updateMemberProfile('usr-1234-uuid', {
        fullName: 'No Existe en DB',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('No se encontró el registro del socio');
      expect(eqSpy).toHaveBeenCalledTimes(2);

      // Estado restaurado
      expect(adminStore.getMemberById('usr-1234-uuid')?.fullName).toBe('Socio Original');
    });

    it('should succeed when primary ID query updates 0 rows but email fallback succeeds with count 1', async () => {
      const eqSpy = vi
        .fn()
        .mockResolvedValueOnce({ error: null, count: 0 }) // Primario por id no encontró nada
        .mockResolvedValueOnce({ error: null, count: 1 }); // Fallback por email encontró 1 fila
      const updateSpy = vi.fn().mockReturnValue({ eq: eqSpy });
      mockSupabase.from.mockReturnValue({ update: updateSpy });

      const res = await adminStore.updateMemberProfile('usr-1234-uuid', {
        fullName: 'Nombre Resuelto por Email',
      });

      expect(res.success).toBe(true);
      expect(eqSpy).toHaveBeenCalledTimes(2);
      expect(eqSpy).toHaveBeenNthCalledWith(1, 'id', 'usr-1234-uuid');
      expect(eqSpy).toHaveBeenNthCalledWith(2, 'email', 'socio@club.com');

      expect(adminStore.getMemberById('usr-1234-uuid')?.fullName).toBe('Nombre Resuelto por Email');
    });

    it('should invoke select(id) and rollback if returned rows array is empty', async () => {
      const selectSpy = vi.fn().mockResolvedValue({ error: null, data: [] });
      const eqSpy = vi.fn().mockReturnValue({ select: selectSpy });
      const updateSpy = vi.fn().mockReturnValue({ eq: eqSpy });
      mockSupabase.from.mockReturnValue({ update: updateSpy });

      const res = await adminStore.updateMemberProfile('usr-1234-uuid', {
        fullName: 'No Actualizado por Retorno Vacío',
      });

      expect(res.success).toBe(false);
      expect(selectSpy).toHaveBeenCalledWith('id');
      expect(adminStore.getMemberById('usr-1234-uuid')?.fullName).toBe('Socio Original');
      const cached = JSON.parse(localStorage.getItem('admin_members_cache') || '[]');
      expect(cached[0].fullName).toBe('Socio Original');
    });

    it('should invoke select(id) and succeed if returned rows array contains updated row', async () => {
      const selectSpy = vi.fn().mockResolvedValue({ error: null, data: [{ id: 'usr-1234-uuid' }] });
      const eqSpy = vi.fn().mockReturnValue({ select: selectSpy });
      const updateSpy = vi.fn().mockReturnValue({ eq: eqSpy });
      mockSupabase.from.mockReturnValue({ update: updateSpy });

      const res = await adminStore.updateMemberProfile('usr-1234-uuid', {
        fullName: 'Actualizado Con Select Id',
      });

      expect(res.success).toBe(true);
      expect(selectSpy).toHaveBeenCalledWith('id');
      expect(adminStore.getMemberById('usr-1234-uuid')?.fullName).toBe('Actualizado Con Select Id');
    });

    it('should rollback when an unhandled exception is thrown during persistence', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Crash de conexión');
      });

      const res = await adminStore.updateMemberProfile('usr-1234-uuid', {
        fullName: 'Nombre Crash',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Crash de conexión');
      expect(adminStore.getMemberById('usr-1234-uuid')?.fullName).toBe('Socio Original');
    });

    it('should derive type and position correctly from membershipTier and preserve payment-derived converted', async () => {
      const eqSpy = vi.fn().mockResolvedValue({ error: null, count: 1 });
      const updateSpy = vi.fn().mockReturnValue({ eq: eqSpy });
      mockSupabase.from.mockReturnValue({ update: updateSpy });

      // Transición a waitlist: debe derivar type = 'waitlist', position = undefined, payload position = null
      const resWaitlist = await adminStore.updateMemberProfile('usr-1234-uuid', {
        membershipTier: 'waitlist',
        converted: false as any, // Intento de alterar converted
      });

      expect(resWaitlist.success).toBe(true);
      const waitlistMember = adminStore.getMemberById('usr-1234-uuid');
      expect(waitlistMember?.type).toBe('waitlist');
      expect(waitlistMember?.position).toBeUndefined();
      // converted debe seguir siendo true (derivado de pagos)
      expect(waitlistMember?.converted).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          membership_tier: 'waitlist',
          position: null,
        }),
        { count: 'exact' },
      );

      // Transición de vuelta a socio activo con número de socio
      const resActivo = await adminStore.updateMemberProfile('usr-1234-uuid', {
        membershipTier: 'activo',
        position: 42,
      });

      expect(resActivo.success).toBe(true);
      const activeMember = adminStore.getMemberById('usr-1234-uuid');
      expect(activeMember?.type).toBe('socio');
      expect(activeMember?.position).toBe(42);
      expect(activeMember?.converted).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          membership_tier: 'activo',
          position: 42,
        }),
        { count: 'exact' },
      );
    });
  });

  describe('USD Exchange Rate Management', () => {
    it('should normalize accepted rates once and synchronize signal, localStorage, and club profile', () => {
      adminStore.setUsdExchangeRate(1450.75);
      expect(adminStore.usdExchangeRate()).toBe(1451);
      expect(adminStore.clubProfile().usdExchangeRate).toBe(1451);
      expect(localStorage.getItem('catamarca_usd_exchange_rate_v1')).toBe('1451');
    });

    it('should reject non-finite and non-positive rates without mutating existing rate', () => {
      adminStore.setUsdExchangeRate(1350);
      expect(adminStore.usdExchangeRate()).toBe(1350);

      adminStore.setUsdExchangeRate(0);
      expect(adminStore.usdExchangeRate()).toBe(1350);

      adminStore.setUsdExchangeRate(-200);
      expect(adminStore.usdExchangeRate()).toBe(1350);

      adminStore.setUsdExchangeRate(NaN);
      expect(adminStore.usdExchangeRate()).toBe(1350);

      adminStore.setUsdExchangeRate(Infinity);
      expect(adminStore.usdExchangeRate()).toBe(1350);

      adminStore.setUsdExchangeRate(0.4);
      expect(adminStore.usdExchangeRate()).toBe(1350);
    });

    it('should consistently use validated rounded rate in signal, merged data, and notes on updateClubProfile success', async () => {
      let capturedPayload: any = null;
      (adminStore as any).supabase.from = vi.fn().mockReturnValue({
        update: vi.fn().mockImplementation((payload: any) => {
          capturedPayload = payload;
          return {
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: [{ ...payload, id: 'club-1' }], error: null }),
            }),
          };
        }),
      });

      const res = await adminStore.updateClubProfile({ usdExchangeRate: 1550.6 });
      expect(res.success).toBe(true);
      expect(adminStore.usdExchangeRate()).toBe(1551);
      expect(adminStore.clubProfile().usdExchangeRate).toBe(1551);
      const notes = JSON.parse(capturedPayload.notes);
      expect(notes.usd_exchange_rate).toBe(1551);
    });

    it('should keep USD exchange rate unchanged if updateClubProfile fails on database write', async () => {
      adminStore.setUsdExchangeRate(1300);
      expect(adminStore.usdExchangeRate()).toBe(1300);

      (adminStore as any).supabase.from = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database connection failed' } }),
          }),
        }),
      });

      const res = await adminStore.updateClubProfile({ usdExchangeRate: 1600 });
      expect(res.success).toBe(false);
      expect(adminStore.usdExchangeRate()).toBe(1300);
      expect(adminStore.clubProfile().usdExchangeRate).toBe(1300);
    });
  });
});
