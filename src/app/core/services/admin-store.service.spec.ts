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
    };

    TestBed.configureTestingModule({
      providers: [
        AdminStoreService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
        { provide: NotificationService, useValue: mockNotification },
        { provide: ProviderStoreService, useValue: mockProviderStore },
        { provide: NewsletterService, useValue: {} },
        { provide: ExperienceService, useValue: { getClubProfile: vi.fn() } },
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
});
