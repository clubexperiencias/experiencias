import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';

describe('StorageService', () => {
  let service: StorageService;
  let mockSupabase: any;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('CATAMARCA_SUPABASE_URL', 'https://prod-project.supabase.co');
    localStorage.setItem(
      'CATAMARCA_SUPABASE_ANON_KEY',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid_anon_key_for_tests_123456789',
    );

    mockSupabase = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ data: { path: 'test/foto.jpg' }, error: null }),
          getPublicUrl: vi.fn().mockReturnValue({
            data: { publicUrl: 'https://prod-project.supabase.co/storage/v1/object/public/experiencias/test/foto.jpg' },
          }),
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: 'https://prod-project.supabase.co/storage/v1/object/sign/comprobantes/test/comprobante.jpg?token=abc' },
            error: null,
          }),
        }),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        StorageService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      ],
    });

    service = TestBed.inject(StorageService);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('debería subir fotos al bucket experiencias de Supabase Storage', async () => {
    const mockFile = new File(['file content'], 'foto.jpg', { type: 'image/jpeg' });

    const result = await service.uploadFile(mockFile, 'ALBUM');

    expect(result.provider).toBe('supabase');
    expect(result.url).toContain('experiencias');
    expect(mockSupabase.storage.from).toHaveBeenCalledWith('experiencias');
  });

  it('debería subir comprobantes al bucket comprobantes de Supabase Storage', async () => {
    const mockFile = new File(['file content'], 'comprobante.jpg', { type: 'image/jpeg' });

    const result = await service.uploadReceipt(mockFile, 'PAY');

    expect(result.provider).toBe('supabase');
    expect(result.url).toContain('https://prod-project.supabase.co/storage');
    expect(mockSupabase.storage.from).toHaveBeenCalledWith('comprobantes');
  });
});

