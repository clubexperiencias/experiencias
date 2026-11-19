/**
 * Persistencia local en IndexedDB para archivos multimedia (fotos y videos)
 * de borradores de formularios, evitando los límites de cuota (~5 MB) y el
 * aislamiento entre pestañas de sessionStorage/localStorage (por ejemplo, al
 * volver de la vinculación OAuth de Mercado Pago).
 */

export interface PersistedMediaFile {
  blob?: Blob;
  name: string;
  type: string;
  lastModified?: number;
  dataUrl?: string;
}

export interface PersistedGalleryItem {
  id: string;
  name: string;
  blob?: Blob;
  type?: string;
  lastModified?: number;
  dataUrl?: string;
}

export interface PersistedMediaDraft {
  coverImage?: PersistedMediaFile | null;
  coverVideo?: PersistedMediaFile | null;
  featuredPhoto1?: PersistedMediaFile | null;
  featuredPhoto2?: PersistedMediaFile | null;
  galleryPhotos: PersistedGalleryItem[];
  updatedAt: number;
}

const DB_NAME = 'experiencias_media_drafts_db';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

function openMediaDraftDb(): Promise<IDBDatabase | null> {
  if (!isIndexedDbAvailable()) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveMediaDraftToDb(key: string, payload: PersistedMediaDraft): Promise<boolean> {
  const db = await openMediaDraftDb();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(payload, key);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
      tx.onabort = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

export async function loadMediaDraftFromDb(key: string): Promise<PersistedMediaDraft | null> {
  const db = await openMediaDraftDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const result = req.result as PersistedMediaDraft | undefined;
        db.close();
        resolve(result && typeof result === 'object' ? result : null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export async function clearMediaDraftFromDb(key: string): Promise<void> {
  const db = await openMediaDraftDb();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export function blobToFile(
  blob: Blob,
  name: string,
  type?: string,
  lastModified?: number,
): File {
  const fileType = type || blob.type || 'application/octet-stream';
  try {
    return new File([blob], name || 'archivo', {
      type: fileType,
      lastModified: lastModified || Date.now(),
    });
  } catch {
    // Fallback para navegadores antiguos sin constructor File
    const fallback = blob as File;
    return fallback;
  }
}

