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

  it('debería subir fotos al bucket experiencias de Supabase Storage con upsert false', async () => {
    const mockFile = new File(['file content'], 'foto.jpg', { type: 'image/jpeg' });

    const result = await service.uploadFile(mockFile, 'ALBUM');

    expect(result.provider).toBe('supabase');
    expect(result.url).toContain('experiencias');
    expect(mockSupabase.storage.from).toHaveBeenCalledWith('experiencias');
    const uploadSpy = mockSupabase.storage.from().upload;
    expect(uploadSpy).toHaveBeenCalledWith(
      expect.stringContaining('ALBUM-'),
      mockFile,
      expect.objectContaining({ upsert: false, contentType: 'image/jpeg' }),
    );
  });

  it('debería detectar contentType video/mp4 al subir videos aunque type venga vacío', async () => {
    const mockVideo = new File(['video content'], 'video-travesia.mp4', { type: '' });

    const result = await service.uploadFile(mockVideo, 'VIDEO');

    expect(result.provider).toBe('supabase');
    const uploadSpy = mockSupabase.storage.from().upload;
    expect(uploadSpy).toHaveBeenCalledWith(
      expect.stringContaining('VIDEO-'),
      mockVideo,
      expect.objectContaining({ upsert: false, contentType: 'video/mp4' }),
    );
  });

  it('debería recurrir al fallback backend si la subida directa falla por RLS', async () => {
    const mockFile = new File(['file content'], 'foto.jpg', { type: 'image/jpeg' });
    mockSupabase.storage.from().upload.mockResolvedValueOnce({
      data: null,
      error: { message: 'new row violates row-level security policy' },
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          url: 'https://prod-project.supabase.co/storage/v1/object/public/experiencias/fallback.jpg',
          storageKey: 'fallback.jpg',
        }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await service.uploadFile(mockFile, 'MEDIA');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/notify',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('STORAGE_UPLOAD'),
      }),
    );
    expect(result.url).toContain('fallback.jpg');
    vi.unstubAllGlobals();
  });

  it('debería recurrir a Blob URL en modo desarrollo si la subida directa y el fallback backend fallan por RLS', async () => {
    const mockFile = new File(['file content'], 'foto-dev.jpg', { type: 'image/jpeg' });
    mockSupabase.storage.from().upload.mockResolvedValueOnce({
      data: null,
      error: { message: 'new row violates row-level security policy' },
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await service.uploadFile(mockFile, 'ALBUM');

    expect(result.provider).toBe('local');
    expect(result.url).toMatch(/^blob:/);
    expect(result.storageKey).toContain('local/ALBUM-foto-dev.jpg');
    vi.unstubAllGlobals();
  });

  it('debería subir comprobantes al bucket comprobantes de Supabase Storage', async () => {
    const mockFile = new File(['file content'], 'comprobante.jpg', { type: 'image/jpeg' });

    const result = await service.uploadReceipt(mockFile, 'PAY');

    expect(result.provider).toBe('supabase');
    expect(result.url).toContain('https://prod-project.supabase.co/storage');
    expect(mockSupabase.storage.from).toHaveBeenCalledWith('comprobantes');
  });
});

