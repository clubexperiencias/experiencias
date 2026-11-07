/**
 * Utilidades para exportación y escape de datos CSV y resolución de URLs públicas.
 */

export function escapeCsv(val: unknown): string {
  if (val == null) return '""';
  if (typeof val === 'number') {
    return String(val);
  }
  let str = String(val);
  // Mitigación de inyecciones de fórmulas CSV en campos de texto
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export function getPublicExperienceUrl(exp: {
  publicUrl?: string;
  slug?: string;
  detailRoute?: string;
}): string {
  const slug = (exp.slug || '').trim();
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${window.location.origin}/experiencias/${slug}`;
    }
  }
  if (exp.publicUrl && /^https?:\/\//i.test(exp.publicUrl.trim())) {
    return exp.publicUrl.trim();
  }
  const route = exp.detailRoute || `/experiencias/${slug}`;
  return `https://experiencias.club${route.startsWith('/') ? '' : '/'}${route}`;
}

export function exportExperiencesToCsv(
  list: any[],
  isClubFn: (exp: any) => boolean,
  clubEmail: string,
): void {
  const headers = [
    'ID',
    'Slug',
    'Título',
    'Kicker',
    'Prestador',
    'Contacto Prestador',
    'Región',
    'Dificultad',
    'Duración',
    'Altitud (msnm)',
    'Arancel ARS',
    'Arancel USD',
    'Cupo Máx.',
    'Estado',
    'Ruta Web Oficial',
    'Fechas Programadas',
  ];

  const rows = [
    headers.map(escapeCsv).join(','),
    ...list.map((exp) => {
      const isClub = isClubFn(exp);
      const provider = isClub ? 'Club de Experiencias' : (exp.providerName || 'N/A');
      const contact = isClub
        ? clubEmail || 'admin@experiencias.club'
        : (exp.providerEmail || exp.providerPhone || 'N/A');
      const datesCount = Array.isArray(exp.dates) ? exp.dates.length : 0;
      const publicUrl = getPublicExperienceUrl(exp);

      return [
        escapeCsv(exp.id),
        escapeCsv(exp.slug),
        escapeCsv(exp.title),
        escapeCsv(exp.kicker || ''),
        escapeCsv(provider),
        escapeCsv(contact),
        escapeCsv(exp.region),
        escapeCsv(exp.difficulty),
        escapeCsv(exp.durationLabel || ''),
        escapeCsv(exp.altitudeMeters ?? 0),
        escapeCsv(exp.priceArs),
        escapeCsv(exp.priceUsd ?? ''),
        escapeCsv(exp.maxSpotsPerGroup),
        escapeCsv(
          exp.status === 'publicada'
            ? 'Publicada'
            : exp.status === 'oculta'
              ? 'Pausada'
              : exp.status === 'pendiente'
                ? 'Postulación'
                : exp.status === 'rechazada'
                  ? 'Rechazada'
                  : 'Borrador',
        ),
        escapeCsv(publicUrl),
        escapeCsv(datesCount > 0 ? `${datesCount} fecha(s)` : 'A coordinar'),
      ].join(',');
    }),
  ];

  const blob = new Blob(['\uFEFF' + rows.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `experiencias_web_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

