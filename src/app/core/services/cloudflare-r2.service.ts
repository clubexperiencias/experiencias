import { Injectable, inject } from '@angular/core';
import { SUPABASE_CLIENT, isSupabaseConfigured } from '../supabase/supabase.client';

export interface ReceiptUploadResult {
  url: string;
  storageKey: string;
  provider: 'r2' | 'supabase' | 'local';
}
const DIRECT_SERVER_UPLOAD_MAX_BYTES = 3.2 * 1024 * 1024; // ~3.2 MB (bajo límite de payload JSON de Vercel)

@Injectable({
  providedIn: 'root',
})
export class CloudflareR2Service {
  private readonly supabase = inject(SUPABASE_CLIENT);

  /**
   * Sube un comprobante de pago (imagen o PDF) a Cloudflare R2 a través de /api/upload-receipt.
   * Si R2 aún no tiene credenciales configuradas o se ejecuta en ng serve local,
   * utiliza automáticamente el bucket 'comprobantes' de Supabase Storage como respaldo.
   */
  async uploadReceipt(file: File, reference: string): Promise<ReceiptUploadResult> {
    const safeRef = (reference || 'PAY').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();

    // 1. Intentar subida a Cloudflare R2 vía endpoint serverless (/api/upload-receipt)
    try {
      if (file.size <= DIRECT_SERVER_UPLOAD_MAX_BYTES) {
        const fileBase64 = await this.fileToBase64(file);
        const response = await fetch('/api/upload-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upload',
            reference: safeRef,
            fileName: file.name,
            mimeType: file.type,
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
        // Archivo entre 3.2 MB y 5 MB: usar Presigned PUT URL hacia Cloudflare R2
        const presignRes = await fetch('/api/upload-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'presign',
            reference: safeRef,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          }),
        });

        if (presignRes.ok) {
          const presignData = await presignRes.json();
          if (presignData?.success && presignData?.uploadUrl && presignData?.url) {
            const putRes = await fetch(presignData.uploadUrl, {
              method: 'PUT',
              headers: { 'Content-Type': file.type },
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
    } catch (err) {
      console.warn('[CloudflareR2Service] Fallback tras intento en /api/upload-receipt:', err);
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
            contentType: file.type,
            upsert: true,
          });

        if (!uploadErr) {
          const { data: pubData } = this.supabase.storage
            .from('comprobantes')
            .getPublicUrl(storageKey);

          if (pubData?.publicUrl) {
            return {
              url: pubData.publicUrl,
              storageKey,
              provider: 'supabase',
            };
          }
        } else {
          console.warn('[CloudflareR2Service] No se pudo subir a Supabase Storage:', uploadErr.message);
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
