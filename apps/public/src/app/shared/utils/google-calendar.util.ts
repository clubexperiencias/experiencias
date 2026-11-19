/**
 * Genera un enlace oficial de Google Calendar (action=TEMPLATE) para que
 * socios y prestadores puedan agendar una experiencia comprada o en revisión
 * directamente en su calendario sin requerir OAuth adicional.
 */

export interface GoogleCalendarEventInput {
  title: string;
  date?: string | null; // YYYY-MM-DD (si no es fecha ISO válida, deja la fecha editable en Google Calendar)
  location?: string | null;
  details?: string | null;
  durationDays?: number;
}

function formatYmdCompact(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}${m}${d}`;
}

const SPANISH_MONTHS: Record<string, number> = {
  enero: 1,
  ene: 1,
  febrero: 2,
  feb: 2,
  marzo: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  mayo: 5,
  may: 5,
  junio: 6,
  jun: 6,
  julio: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  septiembre: 9,
  sep: 9,
  setiembre: 9,
  octubre: 10,
  oct: 10,
  noviembre: 11,
  nov: 11,
  diciembre: 12,
  dic: 12,
};

function parseFlexibleDate(raw?: string | null): { year: number; month: number; day: number } | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  // 1. ISO YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    return { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) };
  }

  // 2. DD/MM/YYYY
  const dmyMatch = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(trimmed);
  if (dmyMatch) {
    return { year: Number(dmyMatch[3]), month: Number(dmyMatch[2]), day: Number(dmyMatch[1]) };
  }

  // 3. Español: "25 de noviembre de 2026" o "25 nov 2026"
  const normalized = trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const esMatch = /(\d{1,2})\s+(?:de\s+)?([a-z]+)(?:\s+(?:de\s+)?(\d{4}))?/.exec(normalized);
  if (esMatch) {
    const day = Number(esMatch[1]);
    const month = SPANISH_MONTHS[esMatch[2]];
    const year = esMatch[3] ? Number(esMatch[3]) : new Date().getFullYear();
    if (month && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  }

  return null;
}

function buildAllDayDatesParam(isoDate?: string | null, durationDays = 1): string | null {
  const parsed = parseFlexibleDate(isoDate);
  if (!parsed) return null;
  const { year, month, day } = parsed;
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const startStr = formatYmdCompact(year, month, day);
  const endDate = new Date(Date.UTC(year, month - 1, day + Math.max(1, durationDays)));
  const endStr = formatYmdCompact(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth() + 1,
    endDate.getUTCDate(),
  );
  return `${startStr}/${endStr}`;
}

export function buildGoogleCalendarUrl(input: GoogleCalendarEventInput): string {
  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', (input.title || 'Experiencia · Experiencias Club').trim());

  const datesParam = buildAllDayDatesParam(input.date, input.durationDays || 1);
  if (datesParam) {
    params.set('dates', datesParam);
  }

  if (input.details?.trim()) {
    params.set('details', input.details.trim());
  }

  if (input.location?.trim()) {
    params.set('location', input.location.trim());
  }

  params.set('ctz', 'America/Argentina/Buenos_Aires');

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
