import { TestBed } from '@angular/core/testing';
import { NewsletterService } from './newsletter.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';

describe('NewsletterService - recordWaitlistProspect', () => {
  let service: NewsletterService;
  let mockSupabase: any;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('CATAMARCA_SUPABASE_URL', 'https://prod-project.supabase.co');
    localStorage.setItem(
      'CATAMARCA_SUPABASE_ANON_KEY',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid_anon_key_for_tests_123456789',
    );

    mockSupabase = {
      rpc: vi.fn(),
      from: vi.fn().mockReturnValue({
        upsert: vi.fn(),
      }),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        NewsletterService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      ],
    });

    service = TestBed.inject(NewsletterService);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should succeed when RPC succeeds', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    const result = await service.recordWaitlistProspect('prospect@example.com');

    expect(result.success).toBe(true);
    expect(result.email).toBe('prospect@example.com');
    expect(service.errorMessage()).toBeNull();
    expect(service.lastProspectEmail()).toBe('prospect@example.com');
  });

  it('should succeed when RPC fails but fallback socios upsert succeeds', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC not available' } });
    const upsertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    mockSupabase.from.mockReturnValue({ upsert: upsertSpy });

    const result = await service.recordWaitlistProspect('prospect@example.com');

    expect(result.success).toBe(true);
    expect(result.email).toBe('prospect@example.com');
    expect(upsertSpy).toHaveBeenCalledWith(
      { email: 'prospect@example.com', membership_tier: 'waitlist' },
      { onConflict: 'email', ignoreDuplicates: true },
    );
    expect(service.errorMessage()).toBeNull();
    expect(service.lastProspectEmail()).toBe('prospect@example.com');
  });

  it('should fail and surface error message when both RPC and fallback upsert fail', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC not found' } });
    const upsertSpy = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Network connection failed' },
    });
    mockSupabase.from.mockReturnValue({ upsert: upsertSpy });

    const result = await service.recordWaitlistProspect('prospect@example.com');

    expect(result.success).toBe(false);
    expect(result.email).toBe('prospect@example.com');
    expect(result.message).toBeTruthy();
    expect(service.errorMessage()).toBe(result.message);
    expect(service.lastProspectEmail()).toBe('');
  });

  it('should fail and surface error message when Supabase throws an exception', async () => {
    mockSupabase.rpc.mockRejectedValue(new Error('Fatal connection timeout'));

    const result = await service.recordWaitlistProspect('prospect@example.com');

    expect(result.success).toBe(false);
    expect(result.email).toBe('prospect@example.com');
    expect(result.message).toBeTruthy();
    expect(service.errorMessage()).toBe(result.message);
    expect(service.lastProspectEmail()).toBe('');
  });
});

describe('NewsletterService - submitProviderApplication', () => {
  let service: NewsletterService;
  let mockSupabase: any;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('CATAMARCA_SUPABASE_URL', 'https://prod-project.supabase.co');
    localStorage.setItem(
      'CATAMARCA_SUPABASE_ANON_KEY',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid_anon_key_for_tests_123456789',
    );

    mockSupabase = {
      from: vi.fn(),
      rpc: vi.fn().mockResolvedValue({ data: { status: 'unregistered' }, error: null }),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        NewsletterService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      ],
    });

    service = TestBed.inject(NewsletterService);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should use insert on prestadores rather than upsert', async () => {
    const insertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const upsertSpy = vi.fn();
    mockSupabase.from.mockReturnValue({
      insert: insertSpy,
      upsert: upsertSpy,
    });

    const res = await service.submitProviderApplication({
      fullName: 'Guía Juan',
      category: 'guia_montaña',
      region: 'Puna',
      email: 'juan@guia.com',
      phone: '3834123456',
      website: 'https://guiajuan.com',
      description: 'Guía de alta montaña',
    });

    expect(res.success).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith('prestadores');
    expect(insertSpy).toHaveBeenCalledWith({
      email: 'juan@guia.com',
      name: 'Guía Juan',
      phone: '3834123456',
      category: 'guia_montaña',
      region: 'Puna',
      website: 'https://guiajuan.com',
      description: 'Guía de alta montaña',
      status: 'pendiente',
      active: false,
    });
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('should return failure when insert on prestadores fails', async () => {
    const insertSpy = vi.fn().mockResolvedValue({ data: null, error: { message: 'RLS violation' } });
    mockSupabase.from.mockReturnValue({
      insert: insertSpy,
    });

    const res = await service.submitProviderApplication({
      fullName: 'Guía Juan',
      category: 'guia_montaña',
      region: 'Puna',
      email: 'juan@guia.com',
      phone: '3834123456',
      website: 'https://guiajuan.com',
      description: 'Guía de alta montaña',
    });

    expect(res.success).toBe(false);
  });

  it('should securely detect existing pending application via RPC without SELECT or upsert', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: { status: 'pending' }, error: null });
    const insertSpy = vi.fn();
    mockSupabase.from.mockReturnValue({ insert: insertSpy });

    const res = await service.submitProviderApplication({
      fullName: 'Guía Existente',
      category: 'guia_montaña',
      region: 'Puna',
      email: 'pendiente@guia.com',
      phone: '3834123456',
      website: '',
      description: '',
    });

    expect(res.success).toBe(false);
    expect(res.alreadyRegistered).toBe(true);
    expect(res.message).toContain('revisión');
    expect(mockSupabase.rpc).toHaveBeenCalledWith('check_provider_status', {
      p_email: 'pendiente@guia.com',
    });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('should securely detect existing approved provider via RPC without SELECT or upsert', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: { status: 'approved' }, error: null });
    const insertSpy = vi.fn();
    mockSupabase.from.mockReturnValue({ insert: insertSpy });

    const res = await service.submitProviderApplication({
      fullName: 'Guía Aprobado',
      category: 'guia_montaña',
      region: 'Puna',
      email: 'aprobado@guia.com',
      phone: '3834123456',
      website: '',
      description: '',
    });

    expect(res.success).toBe(false);
    expect(res.alreadyRegistered).toBe(true);
    expect(res.message).toContain('ya pertenece a un prestador');
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('should handle duplicate key constraint on insert securely without throwing', async () => {
    const insertSpy = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint prestadores_email_key' },
    });
    mockSupabase.from.mockReturnValue({ insert: insertSpy });

    const res = await service.submitProviderApplication({
      fullName: 'Guía Juan',
      category: 'guia_montaña',
      region: 'Puna',
      email: 'juan@guia.com',
      phone: '3834123456',
      website: '',
      description: '',
    });

    expect(res.success).toBe(false);
    expect(res.alreadyRegistered).toBe(true);
    expect(res.message).toContain('Ya existe una postulación o registro');
  });
});

describe('NewsletterService - registerSocio promotion update flow', () => {
  let service: NewsletterService;
  let mockSupabase: any;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('CATAMARCA_SUPABASE_URL', 'https://prod-project.supabase.co');
    localStorage.setItem(
      'CATAMARCA_SUPABASE_ANON_KEY',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid_anon_key_for_tests_123456789',
    );

    mockSupabase = {
      from: vi.fn(),
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'RPC not available' } }),
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { email: 'waitlist@example.com' } } },
        }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        NewsletterService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      ],
    });

    service = TestBed.inject(NewsletterService);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should reset loading state and return failure when update returns error', async () => {
    const existingWaitlist = {
      id: 'socio-123',
      email: 'waitlist@example.com',
      full_name: 'Existing Waitlist',
      dni: '12345678',
      phone: '3834000000',
      membership_tier: 'waitlist',
      position: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'socios') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: existingWaitlist, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'RLS check_socio_update_permissions failed' },
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await service.registerSocio({
      email: 'waitlist@example.com',
      fullName: 'Promoted Member',
      dni: '12345678',
      phone: '3834000000',
    });

    expect(res.success).toBe(false);
    expect(res.message).toContain('RLS check_socio_update_permissions failed');
    expect(service.isLoading()).toBe(false);
  });

  it('should reset loading state and return failure when update returns no row', async () => {
    const existingWaitlist = {
      id: 'socio-123',
      email: 'waitlist@example.com',
      full_name: 'Existing Waitlist',
      dni: '12345678',
      phone: '3834000000',
      membership_tier: 'waitlist',
      position: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'socios') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: existingWaitlist, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await service.registerSocio({
      email: 'waitlist@example.com',
      fullName: 'Promoted Member',
      dni: '12345678',
      phone: '3834000000',
    });

    expect(res.success).toBe(false);
    expect(res.message).toContain('No se pudo actualizar el registro de socio');
    expect(service.isLoading()).toBe(false);
  });

  it('should map returned row directly and report success when update succeeds', async () => {
    const existingWaitlist = {
      id: 'socio-123',
      email: 'waitlist@example.com',
      full_name: 'Existing Waitlist',
      dni: '12345678',
      phone: '3834000000',
      membership_tier: 'waitlist',
      position: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const promotedSocio = {
      id: 'socio-123',
      email: 'waitlist@example.com',
      full_name: 'Promoted Member',
      dni: '12345678',
      phone: '3834000000',
      membership_tier: 'emergente',
      position: 101,
      created_at: existingWaitlist.created_at,
      updated_at: new Date().toISOString(),
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'socios') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: existingWaitlist, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: promotedSocio,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await service.registerSocio({
      email: 'waitlist@example.com',
      fullName: 'Promoted Member',
      dni: '12345678',
      phone: '3834000000',
    });

    expect(res.success).toBe(true);
    expect(res.socio?.position).toBe(101);
    expect(res.socio?.membershipTier).toBe('emergente');
    expect(res.socio?.fullName).toBe('Promoted Member');
    expect(service.isLoading()).toBe(false);
  });

  it('should use ignoreDuplicates: true in isAuthenticated fallback upsert', async () => {
    const upsertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'usr-123', email: 'active-socio@example.com' },
        },
      },
    });
    mockSupabase.rpc.mockImplementation((fn: string) => {
      if (fn === 'record_waitlist_email') {
        return Promise.resolve({ error: { message: 'RPC failure' } });
      }
      if (fn === 'get_socio_by_session_or_token') {
        return Promise.resolve({
          data: {
            status: 'ok',
            socio: {
              id: 'socio-1',
              email: 'active-socio@example.com',
              membership_tier: 'activo',
            },
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
    mockSupabase.from.mockReturnValue({ upsert: upsertSpy });

    const authed = await service.isAuthenticated();

    expect(authed).toBe(true);
    expect(upsertSpy).toHaveBeenCalledWith(
      { email: 'active-socio@example.com', membership_tier: 'waitlist' },
      { onConflict: 'email', ignoreDuplicates: true },
    );
  });
});

