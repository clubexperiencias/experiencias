import { TestBed } from '@angular/core/testing';
import { CloudflareR2Service } from './cloudflare-r2.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';

describe('CloudflareR2Service', () => {
  let service: CloudflareR2Service;
  let mockSupabase: any;

  beforeEach(() => {
    localStorage.clear();

    mockSupabase = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ data: { path: 'fallback/test.jpg' }, error: null }),
          getPublicUrl: vi.fn().mockReturnValue({
            data: { publicUrl: 'https://supabase.co/storage/v1/object/public/comprobantes/fallback/test.jpg' },
          }),
        }),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        CloudflareR2Service,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      ],
    });

    service = TestBed.inject(CloudflareR2Service);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should upload directly to Cloudflare R2 via /api/upload for small files', async () => {
    const mockFile = new File(['small file content'], 'foto.jpg', { type: 'image/jpeg' });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        url: 'https://cdn.experiencias.club/experiencias/albumes/2026-11/ALBUM-123-foto.jpg',
        key: 'experiencias/albumes/2026-11/ALBUM-123-foto.jpg',
        provider: 'r2',
      }),
    } as Response);

    const result = await service.uploadFile(mockFile, 'ALBUM');

    expect(result.provider).toBe('r2');
    expect(result.url).toBe(
      'https://cdn.experiencias.club/experiencias/albumes/2026-11/ALBUM-123-foto.jpg',
    );
    expect(result.storageKey).toBe('experiencias/albumes/2026-11/ALBUM-123-foto.jpg');
  });

  it('should fallback to Supabase Storage if Cloudflare R2 upload fails', async () => {
    localStorage.setItem('CATAMARCA_SUPABASE_URL', 'https://prod-project.supabase.co');
    localStorage.setItem(
      'CATAMARCA_SUPABASE_ANON_KEY',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid_anon_key_for_tests_123456789',
    );

    const mockFile = new File(['file content'], 'comprobante.jpg', { type: 'image/jpeg' });

    // Simulate R2 server failure
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const result = await service.uploadReceipt(mockFile, 'PAY');

    expect(result.provider).toBe('supabase');
    expect(result.url).toContain('supabase.co/storage');
    expect(mockSupabase.storage.from).toHaveBeenCalledWith('comprobantes');
  });
});

