import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Parsea una URL de red social; devuelve null si no es una URL http(s) válida con dominio. */
export function parseSocialUrl(raw: string | undefined | null): URL | null {
  const value = (raw || '').trim();
  if (!value) return null;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname.includes('.')) return null;
    return url;
  } catch {
    return null;
  }
}

/** Devuelve la URL completa (agrega https:// si falta) o '' si está vacía o es inválida. */
export function normalizeSocialUrl(raw: string | undefined | null): string {
  const value = (raw || '').trim();
  if (!value) return '';
  return parseSocialUrl(value)?.toString() ?? value;
}

/** Campo opcional: vacío es válido; si tiene contenido debe ser una URL http(s). */
export function socialUrlValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value || '').toString().trim();
  if (!value) return null;
  return parseSocialUrl(value) ? null : { socialUrl: true };
}

/** Extrae el usuario de la URL (ej. https://instagram.com/foo -> @foo). */
export function getSocialHandle(raw: string | undefined | null): string {
  const url = parseSocialUrl(raw);
  if (!url) return (raw || '').trim();
  const segment = url.pathname.split('/').filter(Boolean)[0];
  if (segment && !/\.php$/i.test(segment)) {
    let decoded = segment;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      // se conserva el segmento sin decodificar
    }
    return `@${decoded.replace(/^@/, '')}`;
  }
  return url.hostname.replace(/^www\./i, '');
}

