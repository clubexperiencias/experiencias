import { Pipe, PipeTransform } from '@angular/core';

const arsFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const dayFormatter = new Intl.DateTimeFormat('es-AR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

const longDayFormatter = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

@Pipe({ name: 'ars', standalone: true })
export class ArsPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return arsFormatter.format(value ?? 0).replace(/\$\s+/, '$');
  }
}

/** Formats `YYYY-MM-DD` calendar dates (no timezone shift) or ISO timestamps. */
@Pipe({ name: 'fecha', standalone: true })
export class FechaPipe implements PipeTransform {
  transform(value: string | null | undefined, style: 'corta' | 'larga' | 'hora' = 'corta'): string {
    if (!value) return '';
    try {
      if (style === 'hora') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? value : dateTimeFormatter.format(d);
      }
      const rawIso = `${value.slice(0, 10)}T00:00:00Z`;
      const date = new Date(rawIso);
      if (isNaN(date.getTime())) return value;
      return style === 'larga' ? longDayFormatter.format(date) : dayFormatter.format(date);
    } catch {
      return value || '';
    }
  }
}
