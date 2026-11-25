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
   * Resuelve una URL firmada fresca y autorizada para acceder a un comprobante privado.
   */
  async getSignedReceiptUrl(storageKeyOrUrl: string, expiresIn = 3600): Promise<string> {
    if (!storageKeyOrUrl) return '';
    let storageKey = storageKeyOrUrl.trim();

    // Si es un Blob URL o Data URL local (desarrollo/offline), es directamente usable
    if (storageKey.startsWith('blob:') || storageKey.startsWith('data:')) {
      return storageKey;
    }

    if (storageKey.startsWith('storage://comprobantes/')) {
      storageKey = storageKey.replace('storage://comprobantes/', '');
    } else if (storageKey.startsWith('receipt://comprobantes/')) {
      storageKey = storageKey.replace('receipt://comprobantes/', '');
    }

    // Si viene como URL de Supabase Storage (firmada previa o pública), extraer el storageKey del bucket comprobantes
    const match = storageKey.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/comprobantes\/([^?#]+)/);
    if (match && match[1]) {
      storageKey = decodeURIComponent(match[1]);
    } else if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) {
      // Si es una URL http(s) externa que no pertenece al bucket comprobantes de supabase, retornarla directamente
      return storageKey;
    }

    if (!isSupabaseConfigured()) {
      return '';
    }
    try {
      const { data, error } = await this.supabase.storage
        .from('comprobantes')
        .createSignedUrl(storageKey, expiresIn);
      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    } catch (err) {
      console.warn('[StorageService] Error al generar signed URL de comprobante:', err);
    }
    return '';
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

    // 1. Si Supabase está configurado, subir directamente solo al bucket correspondiente
    if (isSupabaseConfigured()) {
      const resolvedContentType = this.resolveContentType(file);
      const { error: uploadErr } = await this.supabase.storage
        .from(primaryBucket)
        .upload(storageKey, file, {
          contentType: resolvedContentType,
          upsert: false,
        });

      if (uploadErr) {
        console.error(`[StorageService] Error al subir a ${primaryBucket}:`, uploadErr.message);

        // Fallback a API con service role (bypassea RLS) para archivos de hasta 4.5MB
        if (file.size <= 4.5 * 1024 * 1024) {
          const fallbackRes = await this.uploadViaBackendFallback(file, storageKey, primaryBucket, resolvedContentType);
          if (fallbackRes) {
            return fallbackRes;
          }
        }

        // Si estamos en entorno de desarrollo/local (!environment.production), permitir fallback a Blob URL para no bloquear pruebas si Supabase Storage no tiene las políticas RLS configuradas
        if (!environment.production) {
          console.warn(
            `[StorageService] Modo desarrollo: Falló la subida a Supabase (${uploadErr.message}). Se utiliza Blob URL temporal para pruebas.`,
          );
          return {
            url: URL.createObjectURL(file),
            storageKey: `local/${safeRef}-${file.name}`,
            provider: 'local',
          };
        }

        throw new Error(`No se pudo subir el archivo a Supabase Storage: ${uploadErr.message}`);
      }

      let resolvedUrl = '';
      if (primaryBucket === 'experiencias') {
        const { data: pubData } = this.supabase.storage
          .from('experiencias')
          .getPublicUrl(storageKey);
        resolvedUrl = pubData?.publicUrl || '';
      } else {
        // En comprobantes (privado), generar URL firmada temporal sin exponer acceso público
        const { data: signData, error: signErr } = await this.supabase.storage
          .from('comprobantes')
          .createSignedUrl(storageKey, 3600);
        resolvedUrl = (!signErr && signData?.signedUrl) ? signData.signedUrl : '';
      }

      // Si no hay URL firmada (ej: usuario anónimo o socio sin permiso SELECT en bucket privado),
      // proporcionar URI canónica del storage para que nunca viaje vacía a los RPC ni validaciones
      const finalUrl = resolvedUrl || `storage://comprobantes/${storageKey}`;

      return {
        url: finalUrl,
        storageKey,
        provider: 'supabase',
      };
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

  private resolveContentType(file: File): string {
    if (file.type && file.type !== 'application/octet-stream') {
      return file.type;
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    switch (ext) {
      case 'mp4': return 'video/mp4';
      case 'webm': return 'video/webm';
      case 'mov': return 'video/quicktime';
      case 'm4v': return 'video/x-m4v';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'png': return 'image/png';
      case 'webp': return 'image/webp';
      case 'gif': return 'image/gif';
      case 'pdf': return 'application/pdf';
      default: return file.type || 'application/octet-stream';
    }
  }

  private async uploadViaBackendFallback(
    file: File,
    storageKey: string,
    primaryBucket: 'experiencias' | 'comprobantes',
    contentType: string,
  ): Promise<StorageUploadResult | null> {
    try {
      const base64Data = await this.fileToBase64(file);
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'STORAGE_UPLOAD',
          data: {
            bucket: primaryBucket,
            storageKey,
            contentType,
            base64Data,
          },
        }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (json && json.success && json.url) {
        return {
          url: json.url,
          storageKey,
          provider: 'supabase',
        };
      }
    } catch (e) {
      console.warn('[StorageService] Error en fallback backend de subida:', e);
    }
    return null;
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }
}
