import { Injectable, inject } from '@angular/core';
import { SUPABASE_CLIENT, isSupabaseConfigured } from '../supabase/supabase.client';
import { environment } from '../../../environments/environment';

export interface StorageUploadResult {
  url: string;
  storageKey: string;
  provider: 'supabase' | 'local';
}

export type ReceiptUploadResult = StorageUploadResult;

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  /**
   * Sube cualquier archivo o foto al bucket 'experiencias' de Supabase Storage.
   */
  async uploadFile(file: File, reference = 'MEDIA'): Promise<StorageUploadResult> {
    return this.uploadToSupabaseStorage(file, reference, 'experiencias');
  }

  /**
   * Sube un comprobante de pago al bucket 'comprobantes' de Supabase Storage.
   */
  async uploadReceipt(file: File, reference = 'PAY'): Promise<StorageUploadResult> {
    return this.uploadToSupabaseStorage(file, reference, 'comprobantes');
  }

  /**
   * Subida nativa directa a Supabase Storage con validación de producción.
   */
  private async uploadToSupabaseStorage(
    file: File,
    reference: string,
    primaryBucket: 'experiencias' | 'comprobantes',
  ): Promise<StorageUploadResult> {
    const safeRef = (reference || 'MEDIA').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
    const now = new Date();
    const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const cleanName = file.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '-');
    const storageKey = `${yearMonth}/${safeRef}-${Date.now()}-${cleanName}`;

    // 1. Si Supabase está configurado, subir directamente al bucket correspondiente
    if (isSupabaseConfigured()) {
      const bucketsToTry =
        primaryBucket === 'experiencias'
          ? ['experiencias', 'comprobantes']
          : ['comprobantes', 'experiencias'];

      let lastError: Error | null = null;

      for (const bucket of bucketsToTry) {
        try {
          const { error: uploadErr } = await this.supabase.storage
            .from(bucket)
            .upload(storageKey, file, {
              contentType: file.type || 'application/octet-stream',
              upsert: true,
            });

          if (!uploadErr) {
            const { data: pubData } = this.supabase.storage
              .from(bucket)
              .getPublicUrl(storageKey);

            return {
              url: pubData?.publicUrl || storageKey,
              storageKey,
              provider: 'supabase',
            };
          } else {
            lastError = new Error(uploadErr.message);
          }
        } catch (err: unknown) {
          lastError = err instanceof Error ? err : new Error(String(err));
        }
      }

      // Si falló en Supabase Storage, registrar y propagar el error
      const errMsg = lastError?.message || 'Error desconocido al subir archivo';
      console.error('[StorageService] Error al subir a Supabase Storage:', errMsg);
      throw new Error(`No se pudo subir el archivo a Supabase Storage: ${errMsg}`);
    }

    // 2. En producción es crítico NO guardar en Base64/localStorage ni simular subidas falsas
    if (environment.production) {
      throw new Error(
        'El almacenamiento de Supabase no está configurado en producción. Por favor verifica las variables de entorno SUPABASE_URL y SUPABASE_ANON_KEY.',
      );
    }

    // 3. Fallback solo en desarrollo/demo local sin conexión:
    // Usamos Blob URL (que no consume cuota de 5MB de localStorage)
    console.warn(
      '[StorageService] Modo offline/desarrollo local: Supabase no está conectado. Se genera un Blob URL temporal.',
    );
    return {
      url: URL.createObjectURL(file),
      storageKey: `local/${safeRef}-${file.name}`,
      provider: 'local',
    };
  }
}

