import { Injectable, inject } from '@angular/core';
import { SUPABASE_CLIENT, isSupabaseConfigured } from '../supabase/supabase.client';

export interface StorageUploadResult {
  url: string;
  storageKey: string;
  provider: 'r2' | 'supabase' | 'local';
}

export type ReceiptUploadResult = StorageUploadResult;

const DIRECT_SERVER_UPLOAD_MAX_BYTES = 3.5 * 1024 * 1024; // ~3.5 MB (bajo el límite body serverless de Vercel)

@Injectable({
  providedIn: 'root',
})
export class CloudflareR2Service {
  private readonly supabase = inject(SUPABASE_CLIENT);

  /**
   * Sube cualquier archivo o foto a Cloudflare R2 con respaldo en Supabase Storage.
   */
  async uploadFile(file: File, reference = 'MEDIA'): Promise<StorageUploadResult> {
    return this.uploadToCloudflare(file, reference);
  }

  /**
   * Sube un comprobante de pago a Cloudflare R2 con respaldo en Supabase Storage.
   */
  async uploadReceipt(file: File, reference = 'PAY'): Promise<StorageUploadResult> {
    return this.uploadToCloudflare(file, reference);
  }

  /**
   * Manejo unificado de subida: Cloudflare R2 (vía direct o presigned PUT) -> Supabase Storage -> Local fallback.
   */
  private async uploadToCloudflare(file: File, reference: string): Promise<StorageUploadResult> {
    const safeRef = (reference || 'MEDIA').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();

    // 1. Intentar subida a Cloudflare R2 vía serverless (/api/upload o /api/upload-receipt)
    try {
      const endpoints = ['/api/upload', '/api/upload-receipt'];

      for (const endpoint of endpoints) {
        try {
          if (file.size <= DIRECT_SERVER_UPLOAD_MAX_BYTES) {
            const fileBase64 = await this.fileToBase64(file);
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'upload',
                reference: safeRef,
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
                sizeBytes: file.size,
                fileBase64,
              }),
            });

            if (response.ok) {
              const data = await response.json();
              if (data?.success && data?.url) {
                return {
                  url: data.url,
                  storageKey: data.key || '',
                  provider: 'r2',
                };
              }
            }
          } else {
            // Archivo mayor a 3.5 MB: Presigned PUT URL directamente a Cloudflare R2
            const presignRes = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'presign',
                reference: safeRef,
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
                sizeBytes: file.size,
              }),
            });

            if (presignRes.ok) {
              const presignData = await presignRes.json();
              if (presignData?.success && presignData?.uploadUrl && presignData?.url) {
                const putRes = await fetch(presignData.uploadUrl, {
                  method: 'PUT',
                  headers: { 'Content-Type': file.type || 'application/octet-stream' },
                  body: file,
                });
                if (putRes.ok) {
                  return {
                    url: presignData.url,
                    storageKey: presignData.key || '',
                    provider: 'r2',
                  };
                }
              }
            }
          }
        } catch {
          // Continuar al siguiente endpoint o fallback
        }
      }
    } catch (err) {
      console.warn('[CloudflareR2Service] Fallback tras intento en R2 endpoints:', err);
    }

    // 2. Respaldo automático en Supabase Storage (bucket 'comprobantes')
    if (isSupabaseConfigured()) {
      try {
        const now = new Date();
        const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
        const cleanName = file.name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9._-]/g, '-');
        const storageKey = `${yearMonth}/${safeRef}-${Date.now()}-${cleanName}`;

        const { error: uploadErr } = await this.supabase.storage
          .from('comprobantes')
          .upload(storageKey, file, {
            contentType: file.type || 'application/octet-stream',
            upsert: true,
          });

        if (!uploadErr) {
          const { data: pubData } = this.supabase.storage
            .from('comprobantes')
            .getPublicUrl(storageKey);

          return {
            url: pubData?.publicUrl || storageKey,
            storageKey,
            provider: 'supabase',
          };
        } else {
          console.warn(
            '[CloudflareR2Service] No se pudo subir a Supabase Storage:',
            uploadErr.message,
          );
        }
      } catch (err) {
        console.warn('[CloudflareR2Service] Error en fallback Supabase Storage:', err);
      }
    }

    // 3. Respaldo final local (Data URL o Object URL) para entorno local sin conexión
    try {
      const dataUrl = await this.fileToDataUrl(file);
      return {
        url: dataUrl,
        storageKey: `local/${safeRef}-${file.name}`,
        provider: 'local',
      };
    } catch {
      return {
        url: URL.createObjectURL(file),
        storageKey: `local/${safeRef}-${file.name}`,
        provider: 'local',
      };
    }
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  private async fileToBase64(file: File): Promise<string> {
    const dataUrl = await this.fileToDataUrl(file);
    return dataUrl.replace(/^data:[^;]+;base64,/, '');
  }
}
