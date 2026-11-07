const https = require('https');

function getEnvConfig() {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  const fromEmail = (
    process.env.RESEND_FROM_EMAIL ||
    'Experiencias Club <onboarding@resend.dev>'
  ).trim();
  const adminEmails = (
    process.env.ADMIN_NOTIFICATION_EMAILS ||
    'gonzagramaglia@gmail.com,vegvarel@gmail.com,patriciofacundodiaztillar@gmail.com'
  )
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  const verifiedProviderEmails = (
    process.env.PROVIDER_NOTIFICATION_EMAILS ||
    'patriciofacundodiaztillar@gmail.com,vegvarel@gmail.com,gonzagramaglia@gmail.com'
  )
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_PROD_URL ||
    process.env.PUBLIC_SUPABASE_URL ||
    ''
  ).trim();
  const supabaseServiceRoleKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    ''
  ).trim();
  const supabaseKey = (
    supabaseServiceRoleKey ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PROD_ANON_KEY ||
    ''
  ).trim();

  return {
    apiKey,
    fromEmail,
    adminEmails,
    verifiedProviderEmails,
    supabaseUrl,
    supabaseKey,
    supabaseServiceRoleKey,
  };
}

const rateLimitMap = new Map();
function checkRateLimit(key, maxLimit = 3, windowMs = 5 * 60 * 1000) {
  const now = Date.now();
  const history = rateLimitMap.get(key) || [];
  const valid = history.filter((ts) => now - ts < windowMs);
  if (valid.length >= maxLimit) {
    return false;
  }
  valid.push(now);
  rateLimitMap.set(key, valid);
  return true;
}

function getSupabaseUser(token, config) {
  return new Promise((resolve) => {
    if (!config.supabaseUrl || !config.supabaseKey || !token) {
      return resolve(null);
    }
    try {
      const url = new URL(`${config.supabaseUrl}/auth/v1/user`);
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'GET',
        headers: {
          apikey: config.supabaseKey,
          Authorization: `Bearer ${token}`,
        },
      };
      const req = https.request(options, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return resolve(null);
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const user = JSON.parse(data);
            resolve(user || null);
          } catch {
            resolve(null);
          }
        });
      });
      req.setTimeout(8000, () => {
        req.destroy();
        resolve(null);
      });
      req.on('error', () => resolve(null));
      req.end();
    } catch {
      resolve(null);
    }
  });
}

function verifySupabaseCallerAdmin(token, config) {
  return new Promise((resolve) => {
    getSupabaseUser(token, config).then((user) => {
      if (!user) return resolve(false);
      try {
        const email = (user?.email || '').trim().toLowerCase();
        if (!email) return resolve(false);

        if (config.adminEmails.map((e) => e.toLowerCase()).includes(email)) {
          return resolve(true);
        }

        const adminUrl = new URL(
          `${config.supabaseUrl}/rest/v1/administradores?email=eq.${encodeURIComponent(email)}&active=eq.true&select=id`,
        );
        const adminReq = https.request(
          {
            hostname: adminUrl.hostname,
            port: adminUrl.port || 443,
            path: adminUrl.pathname + adminUrl.search,
            method: 'GET',
            headers: {
              apikey: config.supabaseKey,
              Authorization: `Bearer ${token}`,
            },
          },
          (adminRes) => {
            let adminData = '';
            adminRes.on('data', (c) => (adminData += c));
            adminRes.on('end', () => {
              try {
                const records = JSON.parse(adminData);
                resolve(Array.isArray(records) && records.length > 0);
              } catch {
                resolve(false);
              }
            });
          },
        );
        adminReq.on('error', () => resolve(false));
        adminReq.end();
      } catch {
        resolve(false);
      }
    });
  });
}

function verifyPostulacionExists(email, config) {
  return new Promise((resolve) => {
    const privilegedKey = config.supabaseServiceRoleKey || config.supabaseKey;
    if (!config.supabaseUrl || !privilegedKey || !email) {
      return resolve({ status: 'error', error: 'Missing configuration or email' });
    }
    try {
      const cleanEmail = String(email).trim().toLowerCase();
      const url = new URL(
        `${config.supabaseUrl}/rest/v1/prestadores?email=eq.${encodeURIComponent(cleanEmail)}&select=id,name,agency,category,region,email,phone,website,description,status,active,notes,created_at&order=created_at.desc&limit=1`,
      );
      const req = https.request(
        {
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname + url.search,
          method: 'GET',
          headers: {
            apikey: privilegedKey,
            Authorization: `Bearer ${privilegedKey}`,
          },
        },
        (res) => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return resolve({
              status: 'error',
              error: `Database query returned HTTP ${res.statusCode}`,
            });
          }
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              const records = JSON.parse(data);
              if (!Array.isArray(records) || records.length === 0) {
                return resolve({ status: 'not_found' });
              }
              const record = records[0];
              if (!record || typeof record !== 'object') {
                return resolve({ status: 'not_found' });
              }
              resolve({
                status: 'found',
                record: {
                  ...record,
                  full_name: record.name || record.agency || '',
                },
              });
            } catch (err) {
              resolve({ status: 'error', error: err.message });
            }
          });
        },
      );
      req.setTimeout(8000, () => {
        req.destroy();
        resolve({ status: 'error', error: 'Database request timed out' });
      });
      req.on('error', (err) => resolve({ status: 'error', error: err.message }));
      req.end();
    } catch (err) {
      resolve({ status: 'error', error: err.message });
    }
  });
}

function updateApplicationNotes(recordId, notesObject, config, expectedNotes) {
  return new Promise((resolve) => {
    const privilegedKey = config.supabaseServiceRoleKey || config.supabaseKey;
    if (!config.supabaseUrl || !privilegedKey || !recordId) {
      return resolve({ success: false, error: 'Missing configuration or recordId' });
    }
    try {
      const payload = JSON.stringify({ notes: JSON.stringify(notesObject) });
      let queryPath = `/rest/v1/prestadores?id=eq.${encodeURIComponent(recordId)}`;

      if (expectedNotes !== undefined) {
        if (expectedNotes === null) {
          queryPath += '&notes=is.null';
        } else {
          queryPath += `&notes=eq.${encodeURIComponent(String(expectedNotes))}`;
        }
      }

      const url = new URL(`${config.supabaseUrl}${queryPath}`);
      const req = https.request(
        {
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname + url.search,
          method: 'PATCH',
          headers: {
            apikey: privilegedKey,
            Authorization: `Bearer ${privilegedKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            Prefer: 'return=representation',
          },
        },
        (res) => {
          let rawBody = '';
          res.on('data', (chunk) => {
            rawBody += chunk;
          });
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const parsed = JSON.parse(rawBody);
                if (Array.isArray(parsed)) {
                  return resolve({
                    success: true,
                    count: parsed.length,
                    matched: parsed.length > 0,
                    rows: parsed,
                  });
                }
                return resolve({ success: true, count: 1, matched: true });
              } catch {
                return resolve({ success: true, count: 1, matched: true });
              }
            }
            resolve({
              success: false,
              statusCode: res.statusCode,
              error: rawBody || `HTTP ${res.statusCode}`,
            });
          });
        },
      );
      req.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
      req.setTimeout(8000, () => {
        req.destroy();
        resolve({ success: false, error: 'Request timed out' });
      });
      req.write(payload);
      req.end();
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
}

function verifyProviderAccess(email, config) {
  return new Promise((resolve) => {
    const privilegedKey = config.supabaseServiceRoleKey || config.supabaseKey;
    if (!config.supabaseUrl || !privilegedKey || !email) {
      return resolve(null);
    }
    try {
      const cleanEmail = String(email).trim().toLowerCase();
      const url = new URL(
        `${config.supabaseUrl}/rest/v1/prestadores?email=eq.${encodeURIComponent(cleanEmail)}&select=email,name,agency,status,active&limit=1`,
      );
      const req = https.request(
        {
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname + url.search,
          method: 'GET',
          headers: {
            apikey: privilegedKey,
            Authorization: `Bearer ${privilegedKey}`,
          },
        },
        (res) => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return resolve(null);
          }
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              const records = JSON.parse(data);
              if (!Array.isArray(records) || records.length === 0) {
                return resolve(null);
              }
              const record = records[0];
              if (!record || typeof record !== 'object') {
                return resolve(null);
              }
              resolve(record);
            } catch {
              resolve(null);
            }
          });
        },
      );
      req.setTimeout(8000, () => {
        req.destroy();
        resolve(null);
      });
      req.on('error', () => resolve(null));
      req.end();
    } catch {
      resolve(null);
    }
  });
}

function sendEmailViaResend({ apiKey, from, to, subject, html }) {
  return new Promise((resolve, reject) => {
    if (!apiKey) {
      console.warn('[api/notify] RESEND_API_KEY no configurada. Simulando envío a:', to);
      return resolve({ id: `sim-${Date.now()}`, simulated: true });
    }

    const payload = JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    const options = {
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            console.error('[api/notify] Error devuelto por Resend API:', parsed);
            reject(new Error(parsed.message || `Error HTTP ${res.statusCode} en Resend`));
          }
        } catch (err) {
          reject(new Error(`Respuesta inválida de Resend (${res.statusCode}): ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error('[api/notify] Error de conexión con Resend:', err);
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

// -----------------------------------------------------------------------------
// Plantillas HTML para Emails (Ultra Minimalistas • Brand Color #ffcc00)
// -----------------------------------------------------------------------------

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderBaseLayout(contentHtml, preheaderText = '', theme = 'gold') {
  const safePreheader = escapeHtml(preheaderText);
  const isBlue = theme === 'blue' || theme === 'prestador' || theme === 'provider';
  const accent = isBlue ? '#80b3ff' : '#ffcc00';
  const containerBorder = isBlue ? 'rgba(128, 179, 255, 0.28)' : 'rgba(255, 204, 0, 0.22)';
  const headerBorder = isBlue ? 'rgba(128, 179, 255, 0.28)' : 'rgba(255, 204, 0, 0.25)';
  const tableBorder = isBlue ? 'rgba(128, 179, 255, 0.22)' : 'rgba(255, 204, 0, 0.18)';
  const tableRowBorder = isBlue ? 'rgba(128, 179, 255, 0.12)' : 'rgba(255, 204, 0, 0.1)';
  const voucherBg = isBlue ? 'rgba(128, 179, 255, 0.08)' : 'rgba(255, 204, 0, 0.05)';
  const voucherBorder = isBlue ? '#80b3ff' : '#ffcc00';
  const btnPrimaryBg = isBlue ? '#80b3ff' : '#ffcc00';
  const btnPrimaryColor = '#050a14';
  const btnPrimaryShadow = isBlue ? 'rgba(128, 179, 255, 0.35)' : 'rgba(255, 204, 0, 0.25)';
  const btnSecBorder = isBlue ? 'rgba(128, 179, 255, 0.45)' : 'rgba(255, 204, 0, 0.4)';
  const footerBorder = isBlue ? 'rgba(128, 179, 255, 0.18)' : 'rgba(255, 204, 0, 0.15)';
  const subText = isBlue ? 'PORTAL DE PRESTADORES & GUÍAS' : 'CATAMARCA • EXPEDICIONES ANDINAS';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Experiencias Club</title>
  <style>
    body { margin: 0; padding: 0; background-color: #05070a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff; -webkit-font-smoothing: antialiased; }
    .email-wrapper { padding: 32px 12px; background-color: #05070a; }
    .email-container { max-width: 580px; margin: 0 auto; background: #0c0f16; border: 1px solid ${containerBorder}; border-radius: 4px; overflow: hidden; box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6); }
    .email-header { background: #080a0f; padding: 26px 32px; border-bottom: 1px solid ${headerBorder}; text-align: center; }
    .email-logo-text { font-size: 19px; font-weight: 800; letter-spacing: 0.14em; color: #ffffff; margin: 0; text-transform: uppercase; }
    .email-logo-sub { font-size: 10px; font-weight: 800; letter-spacing: 0.22em; color: ${accent}; text-transform: uppercase; margin-top: 5px; display: block; }
    .email-body { padding: 36px 32px; }
    .card-title { font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 14px; line-height: 1.3; letter-spacing: -0.01em; }
    .card-lead { font-size: 15px; color: rgba(255, 255, 255, 0.84); line-height: 1.65; margin: 0 0 24px; }
    .data-table { width: 100%; border-collapse: collapse; margin: 22px 0 26px; background: rgba(255, 255, 255, 0.02); border: 1px solid ${tableBorder}; border-radius: 3px; }
    .data-table td { padding: 12px 16px; border-bottom: 1px solid ${tableRowBorder}; font-size: 14px; }
    .data-table tr:last-child td { border-bottom: none; }
    .data-label { color: ${accent}; font-weight: 700; width: 42%; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; }
    .data-value { color: #ffffff; font-weight: 600; text-align: right; }
    .data-mono { font-family: 'Courier New', Courier, monospace; letter-spacing: 0.06em; color: ${accent}; font-weight: 700; }
    .voucher-box { background: ${voucherBg}; border: 1px solid ${voucherBorder}; border-radius: 4px; padding: 20px 22px; margin: 24px 0; }
    .voucher-tag { font-size: 11px; font-weight: 800; letter-spacing: 0.14em; color: ${accent}; text-transform: uppercase; }
    .voucher-code { font-size: 24px; font-weight: 800; color: #ffffff; margin: 8px 0; letter-spacing: 0.06em; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .btn-primary { display: inline-block; background-color: ${btnPrimaryBg}; color: ${btnPrimaryColor} !important; font-size: 14px; font-weight: 800; text-decoration: none; padding: 14px 28px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.08em; margin: 12px 0; text-align: center; box-shadow: 0 4px 14px ${btnPrimaryShadow}; }
    .btn-secondary { display: inline-block; background-color: transparent; border: 1px solid ${btnSecBorder}; color: ${accent} !important; font-size: 13px; font-weight: 700; text-decoration: none; padding: 10px 20px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.06em; margin: 8px 0; text-align: center; }
    .btn-whatsapp { display: inline-block; background-color: #25D366; color: #070d18 !important; font-size: 14px; font-weight: 800; text-decoration: none; padding: 13px 26px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.05em; margin: 10px 0; text-align: center; }
    .alert-box { background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 4px; padding: 16px 20px; color: #fca5a5; margin: 20px 0; font-size: 14px; line-height: 1.55; }
    .tips-list { margin: 18px 0; padding-left: 18px; font-size: 14px; color: rgba(255, 255, 255, 0.82); line-height: 1.7; }
    .tips-list li { margin-bottom: 8px; }
    .email-footer { background: #080a0f; padding: 24px 32px; text-align: center; font-size: 12px; color: rgba(255, 255, 255, 0.45); border-top: 1px solid ${footerBorder}; line-height: 1.6; }
    .email-footer a { color: ${accent}; text-decoration: none; }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${safePreheader}
  </div>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="email-header">
        <h1 class="email-logo-text">EXPERIENCIAS.CLUB</h1>
        <span class="email-logo-sub">${subText}</span>
      </div>
      <div class="email-body">
        ${contentHtml}
      </div>
      <div class="email-footer">
        <p style="margin: 0 0 6px;">Club de Experiencias • San Fernando del Valle de Catamarca, Argentina</p>
        <p style="margin: 0;"><a href="https://experiencias.club" target="_blank">https://experiencias.club</a> · Soporte y consultas: <a href="https://wa.me/5493515490431" target="_blank">+54 9 351 549-0431</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

const TRUSTED_PROVIDER_PHONES = {
  'patriciofacundodiaztillar@gmail.com': '5493834558812',
  'vegvarel@gmail.com': '5493515490431',
  'gonzagramaglia@gmail.com': '5493515490431',
};
const OFFICIAL_CLUB_SUPPORT_PHONE = '5493515490431';

function normalizeArgentinePhone(rawPhone) {
  if (!rawPhone) return OFFICIAL_CLUB_SUPPORT_PHONE;
  let digits = String(rawPhone).replace(/\D/g, '');
  if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }
  // Remove Argentina domestic mobile "15" prefix after trunk 0 or after area code
  if (digits.startsWith('15')) {
    digits = digits.substring(2);
  } else {
    digits = digits.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
  }

  if (digits.startsWith('54')) {
    if (!digits.startsWith('549')) {
      digits = '549' + digits.substring(2);
    }
    digits = digits.replace(/^(549\d{2,4})15(\d{6,8})$/, '$1$2');
    return digits;
  }

  return '549' + digits;
}

// 1. Template: Comprobante Recibido (Para el Usuario)
function templatePaymentSubmittedUser(sub) {
  const fullName = sub.fullName ? escapeHtml(sub.fullName) : 'Explorador';
  const providerEmail = (sub.providerEmail || '').trim().toLowerCase();
  const trustedPhone = TRUSTED_PROVIDER_PHONES[providerEmail] || OFFICIAL_CLUB_SUPPORT_PHONE;
  const waTarget = normalizeArgentinePhone(trustedPhone);
  const waUrl = `https://wa.me/${waTarget}`;

  const content = `
    <h2 class="card-title">Comprobante de pago recibido</h2>
    <p class="card-lead">
      Hola <strong>${fullName}</strong>, registramos tu comprobante de transferencia bancaria para <strong>${escapeHtml(sub.experienceTitle)}</strong>.
      Tus cupos se encuentran pre-reservados mientras el prestador oficial valida la acreditación.
    </p>

    <div class="voucher-box">
      <span class="voucher-tag">CÓDIGO DE RESERVA PROVISORIO</span>
      <div class="voucher-code">${escapeHtml(sub.reference)}</div>
      <div style="font-size: 13px; color: rgba(255,255,255,0.7); margin-top: 6px;">
        Conservá este código para consultar el estado de tu expedición.
      </div>
    </div>

    <table class="data-table">
      <tr>
        <td class="data-label">Experiencia</td>
        <td class="data-value">${escapeHtml(sub.experienceTitle)}</td>
      </tr>
      <tr>
        <td class="data-label">Fecha Programada</td>
        <td class="data-value">${escapeHtml(sub.date)}</td>
      </tr>
      <tr>
        <td class="data-label">Pasajeros</td>
        <td class="data-value">${escapeHtml(sub.participants)} persona(s)</td>
      </tr>
      <tr>
        <td class="data-label">Monto Transferido</td>
        <td class="data-value" style="color: #ffcc00; font-size: 15px; font-weight: 800;">$${Number(sub.amountArs).toLocaleString('es-AR')} ARS</td>
      </tr>
    </table>

    <p style="font-size: 14px; color: rgba(255,255,255,0.78); line-height: 1.6; margin: 20px 0;">
      En cuanto los fondos queden acreditados, recibirás por este medio tu <strong>voucher oficial definitivo</strong> con las coordenadas exactas de encuentro, horarios y ficha técnica del prestador.
    </p>

    <div style="text-align: center; margin: 28px 0 16px;">
      <a href="https://experiencias.club/perfil" class="btn-primary" target="_blank">Ver Mi Reserva</a>
    </div>

    <p style="text-align: center; font-size: 13px; color: rgba(255,255,255,0.5); margin: 0;">
      ¿Necesitás coordinar algo antes? Escribile por <a href="${waUrl}" target="_blank" style="color: #ffcc00; text-decoration: underline;">WhatsApp al prestador del servicio</a>.
    </p>
  `;

  return renderBaseLayout(content, `Comprobante recibido para ${sub.experienceTitle} (${sub.reference})`);
}

// 2. Template: Nuevo Comprobante a Validar (Para Admin y Prestadores)
function templatePaymentSubmittedAdmin(sub) {
  const content = `
    <h2 class="card-title">Nuevo Comprobante de Pago a Validar</h2>
    <p class="card-lead">
      Se cargó una nueva transferencia para la salida <strong>${sub.experienceTitle}</strong>.
    </p>

    <table class="data-table">
      <tr>
        <td class="data-label">Referencia</td>
        <td class="data-value data-mono">${sub.reference}</td>
      </tr>
      <tr>
        <td class="data-label">Socio / Pasajero</td>
        <td class="data-value">${sub.fullName}</td>
      </tr>
      <tr>
        <td class="data-label">Email</td>
        <td class="data-value">${sub.email}</td>
      </tr>
      <tr>
        <td class="data-label">Teléfono / WhatsApp</td>
        <td class="data-value">${sub.phone || '-'}</td>
      </tr>
      <tr>
        <td class="data-label">DNI</td>
        <td class="data-value">${sub.dni || '-'}</td>
      </tr>
      <tr>
        <td class="data-label">Experiencia</td>
        <td class="data-value">${sub.experienceTitle}</td>
      </tr>
      <tr>
        <td class="data-label">Fecha Programada</td>
        <td class="data-value">${sub.date}</td>
      </tr>
      <tr>
        <td class="data-label">Cupos Solicitados</td>
        <td class="data-value">${sub.participants} persona(s)</td>
      </tr>
      <tr>
        <td class="data-label">Importe Transferido</td>
        <td class="data-value" style="color: #ffcc00; font-weight: 800;">$${Number(sub.amountArs).toLocaleString('es-AR')} ARS</td>
      </tr>
      ${sub.receiptUrl && /^https?:\/\//i.test(String(sub.receiptUrl).trim()) ? `
      <tr>
        <td class="data-label">Comprobante de Pago</td>
        <td class="data-value"><a href="${escapeHtml(String(sub.receiptUrl).trim())}" target="_blank" rel="noopener noreferrer" style="color: #ffcc00; text-decoration: underline;">Abrir archivo adjunto</a></td>
      </tr>` : ''}
    </table>

    <div style="text-align: center; margin-top: 24px;">
      <a href="https://admin.experiencias.club/comprobantes" class="btn-primary" target="_blank">Abrir Panel de Control</a>
    </div>
  `;

  return renderBaseLayout(content, `[Nuevo Comprobante] ${sub.reference} · ${sub.experienceTitle} ($${Number(sub.amountArs).toLocaleString('es-AR')})`);
}

// 3. Template: Reserva Aprobada y Voucher (Para el Usuario)
function templatePaymentApprovedUser(sub) {
  const content = `
    <h2 class="card-title" style="color: #4ade80;">¡Tu reserva está confirmada! 🎉</h2>
    <p class="card-lead">
      Hola <strong>${sub.fullName || 'Explorador'}</strong>, tu transferencia bancaria para <strong>${sub.experienceTitle}</strong> fue verificada con éxito.
      ¡Ya tenés tu lugar asegurado para la expedición!
    </p>

    <div class="voucher-box" style="border-color: #4ade80; background: rgba(74, 222, 128, 0.08);">
      <span class="voucher-tag" style="color: #4ade80;">VOUCHER OFICIAL DE EXPEDICIÓN</span>
      <div class="voucher-code">${sub.reference}</div>
      <div style="font-size: 14px; color: #ffffff; margin-top: 6px;">
        <strong>Fecha:</strong> ${sub.date} · <strong>Pasajeros:</strong> ${sub.participants}
      </div>
    </div>

    <table class="data-table">
      <tr>
        <td class="data-label">Titular</td>
        <td class="data-value">${sub.fullName} (DNI ${sub.dni || '-'})</td>
      </tr>
      <tr>
        <td class="data-label">Punto de Encuentro</td>
        <td class="data-value">${sub.meetingPoint || 'Club Náutico Dique El Jumeal / Coordinado por prestador'}</td>
      </tr>
      <tr>
        <td class="data-label">Monto Acreditado</td>
        <td class="data-value" style="color: #ffcc00; font-weight: 800;">$${Number(sub.amountArs).toLocaleString('es-AR')} ARS (Total Pagado)</td>
      </tr>
    </table>

    <h3 style="font-size: 14px; margin: 24px 0 10px; color: #ffcc00; text-transform: uppercase; letter-spacing: 0.08em;">Recomendaciones para tu salida:</h3>
    <ul class="tips-list">
      <li><strong>Puntualidad:</strong> Presentate 15 minutos antes de la hora fijada en el punto de encuentro.</li>
      <li><strong>Indumentaria:</strong> Calzado cómodo o de trekking, ropa liviana con abrigo rompeviento y muda de recambio.</li>
      <li><strong>Hidratación & Sol:</strong> Botella de agua (mínimo 1.5 L), protector solar FPS 50+ y lentes de sol con filtro UV.</li>
      <li><strong>Contacto:</strong> Ante cualquier eventualidad podés comunicarte directamente con el prestador o la coordinación.</li>
    </ul>

    <div style="text-align: center; margin-top: 28px;">
      <a href="https://experiencias.club/perfil" class="btn-primary" target="_blank">Ver Mi Voucher en el Perfil</a>
    </div>
  `;

  return renderBaseLayout(content, `¡Reserva Confirmada! Voucher ${sub.reference} para ${sub.experienceTitle}`);
}

// 4. Template: Comprobante Rechazado (Para el Usuario)
function templatePaymentRejectedUser(sub) {
  const content = `
    <h2 class="card-title" style="color: #f87171;">Aviso sobre tu reserva en ${sub.experienceTitle}</h2>
    <p class="card-lead">
      Hola <strong>${sub.fullName || 'Explorador'}</strong>, no pudimos validar el comprobante de transferencia bancaria enviado para la reserva <strong>${sub.reference}</strong>.
    </p>

    <div class="alert-box">
      <strong>Motivo informado por el prestador:</strong><br/>
      ${sub.rejectionReason || 'El comprobante no es legible o el importe transferido no coincide con el total de la reserva.'}
    </div>

    <p style="font-size: 14px; color: rgba(255,255,255,0.78); line-height: 1.6;">
      No te preocupes: podés ingresar a tu perfil para subir el comprobante correcto o contactarnos directamente por WhatsApp para asistirte de inmediato y asegurar tus lugares.
    </p>

    <div style="text-align: center; margin-top: 24px;">
      <a href="https://wa.me/5493515490431?text=${encodeURIComponent(`Hola! Tuve un problema con mi comprobante de reserva ${sub.reference} en ${sub.experienceTitle}`)}" class="btn-whatsapp" target="_blank">
        Escribir por WhatsApp de Asistencia
      </a>
      <div style="margin-top: 14px;">
        <a href="https://experiencias.club/perfil" style="color: #ffcc00; font-size: 13px; text-decoration: underline;">Ir a Mi Perfil</a>
      </div>
    </div>
  `;

  return renderBaseLayout(content, `Aviso sobre tu comprobante de reserva ${sub.reference}`);
}

// 5. Template: Bienvenida a Nuevo Socio Emergente
function templateWelcomeMember(member) {
  const fullName = member.fullName ? escapeHtml(member.fullName) : 'Explorador';
  const position = member.position ? escapeHtml(member.position) : 100;
  const tier = escapeHtml(String(member.tier || 'Emergente').toUpperCase());

  const content = `
    <h2 class="card-title">¡Te damos la bienvenida al Club! 🏔️</h2>
    <p class="card-lead">
      Hola <strong>${fullName}</strong>, tu membresía oficial en <strong>EXPERIENCIAS.CLUB</strong> ha sido dada de alta con éxito.
      Ya formás parte de la comunidad andina de exploradores de Catamarca.
    </p>

    <div class="voucher-box">
      <span class="voucher-tag">CREDENCIAL DIGITAL OFICIAL</span>
      <div class="voucher-code">SOCIO #${position}</div>
      <div style="font-size: 13px; color: rgba(255,255,255,0.75); margin-top: 6px;">
        Categoría: <strong style="color: #ffcc00;">${tier}</strong>
      </div>
    </div>

    <h3 style="font-size: 14px; font-weight: 700; color: #ffcc00; text-transform: uppercase; letter-spacing: 0.08em; margin: 24px 0 12px;">
      Tus beneficios activos:
    </h3>

    <ul class="tips-list">
      <li><strong style="color: #ffffff;">Cupos prioritarios:</strong> Acceso anticipado a expediciones de alta montaña, salidas de luna llena y cupos limitados en Catamarca.</li>
      <li><strong style="color: #ffffff;">Tarifas preferenciales:</strong> Descuentos exclusivos con prestadores habilitados y alquiler de equipamiento técnico.</li>
      <li><strong style="color: #ffffff;">Comunidad andina:</strong> Conexión directa con otros socios y guías certificados para coordinar travesías en la Puna y valles.</li>
    </ul>

    <div style="text-align: center; margin: 30px 0 16px;">
      <a href="https://experiencias.club/perfil" class="btn-primary" target="_blank">Acceder a Mi Perfil</a>
    </div>

    <p style="text-align: center; font-size: 13px; color: rgba(255,255,255,0.5); margin: 0;">
      Podés consultar tus beneficios y credencial ingresando en <a href="https://experiencias.club" target="_blank" style="color: #ffcc00;">experiencias.club</a>.
    </p>
  `;

  return renderBaseLayout(content, `¡Bienvenido a EXPERIENCIAS.CLUB! Tu credencial de Socio #${member.position || ''}`);
}

// 6. Template: Aviso de Socio Ya Registrado (Para el Usuario)
function templateAlreadyRegisteredUser(data) {
  const fullName = data.fullName ? escapeHtml(data.fullName) : 'Explorador';
  const email = escapeHtml(data.email || '');
  const position = data.position ? escapeHtml(data.position) : '';
  const tier = data.tier ? escapeHtml(String(data.tier).toUpperCase()) : '';

  const content = `
    <h2 class="card-title">Ya formás parte del Club</h2>
    <p class="card-lead">
      Hola <strong>${fullName}</strong>, notamos que ingresaste tus datos para registrarte, pero tu correo (<strong>${email}</strong>) ya cuenta con una <strong>membresía activa</strong> en <strong>EXPERIENCIAS.CLUB</strong>.
    </p>

    <div class="voucher-box">
      <span class="voucher-tag">ESTADO DE CUENTA</span>
      <div class="voucher-code">${position ? `SOCIO #${position}` : 'MEMBRESÍA ACTIVA'}</div>
      <div style="font-size: 13px; color: rgba(255,255,255,0.75); margin-top: 6px;">
        ${tier ? `Categoría: <strong style="color: #ffcc00;">${tier}</strong> · ` : ''}No necesitás registrarte de nuevo.
      </div>
    </div>

    <p style="font-size: 14px; color: rgba(255,255,255,0.8); line-height: 1.6; margin: 20px 0;">
      Para ver las expediciones disponibles, consultar tus reservas o acceder a tu credencial digital, iniciá sesión directamente en la plataforma:
    </p>

    <div style="text-align: center; margin: 28px 0 16px;">
      <a href="https://experiencias.club/ingresar" class="btn-primary" target="_blank">Iniciar Sesión</a>
    </div>

    <p style="text-align: center; font-size: 13px; color: rgba(255,255,255,0.5); margin: 0;">
      ¿Tenés alguna consulta o necesitás ayuda con tu cuenta? Escribinos por <a href="https://wa.me/5493515490431" target="_blank" style="color: #ffcc00;">WhatsApp Oficial</a>.
    </p>
  `;

  return renderBaseLayout(content, `Ya contás con una membresía activa en EXPERIENCIAS.CLUB`);
}

// 7. Template: Postulación de Prestador Recibida (Para el Postulante)
function templateProviderApplicationSubmitted(data) {
  const fullName = data.fullName ? escapeHtml(data.fullName) : 'Prestador';
  const category = data.category ? escapeHtml(data.category) : 'Actividades y Guías';
  const region = data.region ? escapeHtml(data.region) : 'Catamarca';
  const phone = data.phone ? escapeHtml(data.phone) : '-';

  const content = `
    <h2 class="card-title">Postulación de Prestador Recibida</h2>
    <p class="card-lead">
      Hola <strong>${fullName}</strong>, recibimos tu solicitud para sumarte como prestador oficial y guía en <strong>EXPERIENCIAS.CLUB</strong>.
    </p>

    <div class="voucher-box">
      <span class="voucher-tag">ESTADO DE POSTULACIÓN</span>
      <div class="voucher-code" style="font-size: 19px; letter-spacing: 0.03em;">EN PROCESO DE EVALUACIÓN</div>
      <div style="font-size: 13px; color: rgba(255,255,255,0.75); margin-top: 6px;">
        Revisión técnica de habilitaciones y propuesta de salidas.
      </div>
    </div>

    <table class="data-table">
      <tr>
        <td class="data-label">Postulante</td>
        <td class="data-value">${fullName}</td>
      </tr>
      <tr>
        <td class="data-label">Rubro / Especialidad</td>
        <td class="data-value">${category}</td>
      </tr>
      <tr>
        <td class="data-label">Región / Zona</td>
        <td class="data-value">${region}</td>
      </tr>
      <tr>
        <td class="data-label">Teléfono de Contacto</td>
        <td class="data-value">${phone}</td>
      </tr>
    </table>

    <p style="font-size: 14px; color: rgba(255,255,255,0.82); line-height: 1.65; margin: 20px 0;">
      Nuestro equipo revisará tus datos y propuesta de expediciones. Una vez aprobada tu cuenta, recibirás un correo de confirmación con las instrucciones para ingresar al <strong>Portal de Prestadores</strong> mediante tu cuenta de Google.
    </p>

    <div style="text-align: center; margin: 28px 0 16px;">
      <a href="https://prestadores.experiencias.club" class="btn-primary" target="_blank">Portal de Prestadores</a>
    </div>

    <p style="text-align: center; font-size: 13px; color: rgba(255,255,255,0.5); margin: 0;">
      ¿Tenés dudas o querés adjuntar certificaciones adicionales? Escribinos a <a href="mailto:prestadores@experiencias.club" style="color: #80b3ff; text-decoration: underline;">prestadores@experiencias.club</a> o vía WhatsApp al <a href="https://wa.me/5493515490431" style="color: #80b3ff; text-decoration: underline;">+54 9 351 549-0431</a>.
    </p>
  `;

  return renderBaseLayout(content, `Recibimos tu postulación como prestador en EXPERIENCIAS.CLUB`, 'blue');
}

// 8. Template: Nueva Postulación de Prestador (Para Administradores)
function templateProviderApplicationAdmin(data) {
  const fullName = data.fullName ? escapeHtml(data.fullName) : 'Nuevo Postulante';
  const email = data.email ? escapeHtml(data.email) : '-';
  const phone = data.phone ? escapeHtml(data.phone) : '-';
  const category = data.category ? escapeHtml(data.category) : '-';
  const region = data.region ? escapeHtml(data.region) : '-';
  const website = data.website ? escapeHtml(data.website) : '-';
  const description = data.description ? escapeHtml(data.description) : '-';

  const content = `
    <h2 class="card-title">Nueva Postulación de Prestador</h2>
    <p class="card-lead">
      Se ha recibido una nueva solicitud para el panel de prestadores en <strong>EXPERIENCIAS.CLUB</strong>.
    </p>

    <table class="data-table">
      <tr>
        <td class="data-label">Nombre / Guía</td>
        <td class="data-value">${fullName}</td>
      </tr>
      <tr>
        <td class="data-label">Email</td>
        <td class="data-value">${email}</td>
      </tr>
      <tr>
        <td class="data-label">Teléfono / WhatsApp</td>
        <td class="data-value">${phone}</td>
      </tr>
      <tr>
        <td class="data-label">Especialidad</td>
        <td class="data-value">${category}</td>
      </tr>
      <tr>
        <td class="data-label">Región Operativa</td>
        <td class="data-value">${region}</td>
      </tr>
      <tr>
        <td class="data-label">Sitio / Redes</td>
        <td class="data-value">${website}</td>
      </tr>
      <tr>
        <td class="data-label">Descripción</td>
        <td class="data-value">${description}</td>
      </tr>
    </table>

    <div style="text-align: center; margin-top: 24px;">
      <a href="https://admin.experiencias.club/postulaciones" class="btn-primary" target="_blank">Revisar en Panel de Control</a>
    </div>
  `;

  return renderBaseLayout(content, `[Nueva Postulación Prestador] ${fullName} · ${category}`, 'blue');
}

// 9. Template: Cuenta de Prestador Aprobada (Para el Prestador)
function templateProviderApproved(data) {
  const fullName = data.fullName || data.name ? escapeHtml(data.fullName || data.name) : 'Prestador';
  const email = escapeHtml(data.email || '');

  const content = `
    <h2 class="card-title" style="color: #80b3ff;">¡Tu cuenta de Prestador ha sido aprobada! 🎉</h2>
    <p class="card-lead">
      Hola <strong>${fullName}</strong>, tu perfil de prestador oficial en <strong>EXPERIENCIAS.CLUB</strong> fue validado y activado por el equipo de administración.
    </p>

    <div class="voucher-box">
      <span class="voucher-tag">ACCESO HABILITADO</span>
      <div class="voucher-code" style="font-size: 21px;">PRESTADOR OFICIAL</div>
      <div style="font-size: 13px; color: rgba(255,255,255,0.75); margin-top: 6px;">
        Usuario autorizado: <strong style="color: #80b3ff;">${email}</strong>
      </div>
    </div>

    <h3 style="font-size: 14px; font-weight: 700; color: #80b3ff; text-transform: uppercase; letter-spacing: 0.08em; margin: 24px 0 12px;">
      Instrucciones para ingresar al portal:
    </h3>

    <ul class="tips-list">
      <li><strong>Enlace directo:</strong> Ingresá a <a href="https://prestadores.experiencias.club" target="_blank" style="color: #80b3ff; text-decoration: underline;">https://prestadores.experiencias.club</a> (o desde <a href="https://experiencias.club/prestadores/login" target="_blank" style="color: #80b3ff; text-decoration: underline;">/prestadores/login</a>).</li>
      <li><strong>Método de acceso:</strong> Hacé clic en <em>"Iniciar sesión con Google (Prestadores)"</em> utilizando esta cuenta (<strong>${email}</strong>). No necesitás recordar ninguna contraseña.</li>
      <li><strong>Gestión de salidas:</strong> Podrás cargar y proponer nuevas expediciones, fijar cupos y tarifas para los socios del club.</li>
      <li><strong>Comprobantes y transferencias:</strong> Revisá en tiempo real los comprobantes de transferencias enviados por los socios y coordiná las salidas.</li>
    </ul>

    <div style="text-align: center; margin: 30px 0 16px;">
      <a href="https://prestadores.experiencias.club" class="btn-primary" target="_blank">Ingresar al Portal de Prestadores</a>
    </div>

    <p style="text-align: center; font-size: 13px; color: rgba(255,255,255,0.5); margin: 0;">
      ¿Tenés consultas operativas o requerís soporte? Escribinos por WhatsApp al <a href="https://wa.me/5493515490431" target="_blank" style="color: #80b3ff; text-decoration: underline;">+54 9 351 549-0431</a> o a <a href="mailto:prestadores@experiencias.club" style="color: #80b3ff; text-decoration: underline;">prestadores@experiencias.club</a>.
    </p>
  `;

  return renderBaseLayout(content, `¡Tu cuenta de Prestador ha sido aprobada en EXPERIENCIAS.CLUB!`, 'blue');
}

// 10. Template: Nueva Propuesta de Experiencia (Para Administradores)
function templateExperienceProposalAdmin(data) {
  const title = escapeHtml(data.title || 'Nueva Experiencia');
  const providerName = escapeHtml(data.providerName || 'Prestador');
  const providerAgency = escapeHtml(data.providerAgency || '-');
  const providerEmail = escapeHtml(data.providerEmail || '-');
  const providerPhone = escapeHtml(data.providerPhone || '-');
  const region = escapeHtml(data.region || 'Catamarca');
  const difficulty = escapeHtml(data.difficulty || '-');
  const duration = escapeHtml(data.duration || '-');
  const priceArs = Number(data.priceArs || 0).toLocaleString('es-AR');
  const meetingPoint = escapeHtml(data.meetingPoint || '-');
  const itinerary = escapeHtml(data.itinerary || '-');

  const content = `
    <h2 class="card-title">Nueva Propuesta de Experiencia</h2>
    <p class="card-lead">
      El prestador <strong>${providerName}</strong> (${providerAgency}) ha enviado una nueva propuesta de expedición para revisión y publicación en <strong>EXPERIENCIAS.CLUB</strong>.
    </p>

    <table class="data-table">
      <tr>
        <td class="data-label">Experiencia</td>
        <td class="data-value"><strong>${title}</strong></td>
      </tr>
      <tr>
        <td class="data-label">Prestador</td>
        <td class="data-value">${providerName} &lt;${providerEmail}&gt; (${providerPhone})</td>
      </tr>
      <tr>
        <td class="data-label">Región</td>
        <td class="data-value">${region}</td>
      </tr>
      <tr>
        <td class="data-label">Dificultad / Duración</td>
        <td class="data-value">${difficulty} · ${duration}</td>
      </tr>
      <tr>
        <td class="data-label">Arancel por Persona</td>
        <td class="data-value">$${priceArs} ARS</td>
      </tr>
      <tr>
        <td class="data-label">Punto de Encuentro</td>
        <td class="data-value">${meetingPoint}</td>
      </tr>
      <tr>
        <td class="data-label">Itinerario</td>
        <td class="data-value">${itinerary}</td>
      </tr>
    </table>

    <div style="text-align: center; margin: 28px 0 16px;">
      <a href="https://admin.experiencias.club/propuestas" class="btn-primary" target="_blank">Revisar Propuesta en Administración</a>
    </div>
  `;

  return renderBaseLayout(content, `[Nueva Propuesta] ${data.title} · ${providerName}`, 'blue');
}

// 11. Template: Confirmación de Propuesta de Experiencia (Para el Prestador)
function templateExperienceProposalProvider(data) {
  const title = escapeHtml(data.title || 'tu experiencia');
  const providerName = escapeHtml(data.providerName || 'Prestador');

  const content = `
    <h2 class="card-title">Recibimos tu propuesta de experiencia</h2>
    <p class="card-lead">
      Hola <strong>${providerName}</strong>, recibimos la propuesta de <strong>"${title}"</strong> para el catálogo del Club de Experiencias.
    </p>

    <p style="font-size: 14px; color: rgba(255,255,255,0.82); line-height: 1.65; margin: 20px 0;">
      El equipo de administración revisará los detalles técnicos, itinerario y logística de la salida. Te notificaremos apenas la experiencia sea aprobada y habilitada para reservas de los socios.
    </p>

    <div style="text-align: center; margin: 28px 0 16px;">
      <a href="https://prestadores.experiencias.club/experiencias" class="btn-primary" target="_blank">Ver mis propuestas</a>
    </div>

    <p style="text-align: center; font-size: 13px; color: rgba(255,255,255,0.5); margin: 0;">
      ¿Necesitás ajustar algún dato o agregar material? Contactanos por WhatsApp al <a href="https://wa.me/5493515490431" target="_blank" style="color: #80b3ff; text-decoration: underline;">+54 9 351 549-0431</a>.
    </p>
  `;

  return renderBaseLayout(content, `Recibimos tu propuesta: ${data.title}`, 'blue');
}

// -----------------------------------------------------------------------------
// Handler Principal Serverless (Vercel)
// -----------------------------------------------------------------------------

module.exports = async function handler(req, res) {
  // Configurar CORS restringido a los orígenes oficiales del club
  const allowedOrigins = [
    'https://experiencias.club',
    'https://admin.experiencias.club',
    'https://prestadores.experiencias.club',
  ];
  const reqOrigin = req.headers.origin || req.headers.Origin || '';
  const isAllowedOrigin =
    allowedOrigins.includes(reqOrigin) ||
    /^https:\/\/[a-z0-9-]+-clubexperiencias\.vercel\.app$/.test(reqOrigin) ||
    /^https:\/\/[a-z0-9-]+-gonzagramaglias-projects\.vercel\.app$/.test(reqOrigin) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(reqOrigin);

  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', reqOrigin);
  } else if (!reqOrigin) {
    res.setHeader('Access-Control-Allow-Origin', 'https://experiencias.club');
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://experiencias.club');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido. Usá POST.' });
  }

  try {
    const { type, action, data } = req.body || {};
    const messageType = type || action;

    if (!messageType || !data) {
      return res.status(400).json({
        success: false,
        error: 'Cuerpo de solicitud incompleto. Se requiere type y data.',
      });
    }

    const config = getEnvConfig();
    const results = [];

    switch (messageType) {
      case 'PAYMENT_SUBMITTED': {
        // 1. Email al usuario
        if (data.email) {
          const userResult = await sendEmailViaResend({
            apiKey: config.apiKey,
            from: config.fromEmail,
            to: data.email,
            subject: `Recibimos tu comprobante para ${data.experienceTitle} (${data.reference})`,
            html: templatePaymentSubmittedUser(data),
          });
          results.push({ target: 'user', ...userResult });
        }

        // 2. Alerta a Administradores y al Prestador (restringido a destinatarios verificados)
        const recipients = [...config.adminEmails];
        if (data.providerEmail) {
          const normalizedProvider = String(data.providerEmail).trim().toLowerCase();
          const isVerified =
            config.adminEmails.some((a) => a.toLowerCase() === normalizedProvider) ||
            config.verifiedProviderEmails.includes(normalizedProvider);
          if (isVerified && !recipients.map((r) => r.toLowerCase()).includes(normalizedProvider)) {
            recipients.push(normalizedProvider);
          }
        }

        if (recipients.length > 0) {
          const adminResult = await sendEmailViaResend({
            apiKey: config.apiKey,
            from: config.fromEmail,
            to: recipients,
            subject: `[Nuevo Comprobante] ${data.reference} · ${data.experienceTitle} ($${Number(data.amountArs || 0).toLocaleString('es-AR')})`,
            html: templatePaymentSubmittedAdmin(data),
          });
          results.push({ target: 'admin', ...adminResult });
        }
        break;
      }

      case 'PAYMENT_APPROVED': {
        if (!data.email) {
          return res.status(400).json({ success: false, error: 'Falta email del socio.' });
        }
        const approvedResult = await sendEmailViaResend({
          apiKey: config.apiKey,
          from: config.fromEmail,
          to: data.email,
          subject: `¡Reserva Confirmada! Tu voucher para ${data.experienceTitle} (${data.reference})`,
          html: templatePaymentApprovedUser(data),
        });
        results.push({ target: 'user_approved', ...approvedResult });
        break;
      }

      case 'PAYMENT_REJECTED': {
        if (!data.email) {
          return res.status(400).json({ success: false, error: 'Falta email del socio.' });
        }
        const rejectedResult = await sendEmailViaResend({
          apiKey: config.apiKey,
          from: config.fromEmail,
          to: data.email,
          subject: `Aviso sobre tu reserva en ${data.experienceTitle} (${data.reference})`,
          html: templatePaymentRejectedUser(data),
        });
        results.push({ target: 'user_rejected', ...rejectedResult });
        break;
      }

      case 'WELCOME_MEMBER': {
        if (!data.email) {
          return res.status(400).json({ success: false, error: 'Falta email del socio.' });
        }
        const welcomeResult = await sendEmailViaResend({
          apiKey: config.apiKey,
          from: config.fromEmail,
          to: data.email,
          subject: `¡Bienvenido a EXPERIENCIAS.CLUB! Credencial de Socio #${data.position || ''}`,
          html: templateWelcomeMember(data),
        });
        results.push({ target: 'welcome_member', ...welcomeResult });
        break;
      }

      case 'ALREADY_REGISTERED': {
        if (!data.email) {
          return res.status(400).json({ success: false, error: 'Falta email del socio.' });
        }
        const alreadyRegisteredResult = await sendEmailViaResend({
          apiKey: config.apiKey,
          from: config.fromEmail,
          to: data.email,
          subject: `Ya contás con una membresía activa en EXPERIENCIAS.CLUB`,
          html: templateAlreadyRegisteredUser(data),
        });
        results.push({ target: 'already_registered', ...alreadyRegisteredResult });
        break;
      }

      case 'PROVIDER_APPLICATION_SUBMITTED': {
        if (!data.email) {
          return res.status(400).json({ success: false, error: 'Falta email del postulante.' });
        }

        const clientIp =
          req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
          req.socket?.remoteAddress ||
          'unknown';
        const rateLimitKey = `app_${String(data.email).trim().toLowerCase()}_${clientIp}`;
        if (!checkRateLimit(rateLimitKey, 3, 5 * 60 * 1000)) {
          return res.status(429).json({
            success: false,
            error: 'Demasiadas solicitudes enviadas. Por favor aguardá unos minutos.',
          });
        }

        const lookupResult = await verifyPostulacionExists(data.email, config);
        if (lookupResult.status === 'error') {
          return res.status(502).json({
            success: false,
            error: 'No se pudo verificar el registro de postulación por un problema de conexión con el servidor.',
          });
        }

        if (lookupResult.status === 'not_found' || !lookupResult.record) {
          return res.status(404).json({
            success: false,
            error: 'No se encontró un registro de postulación previo para este correo.',
          });
        }

        const applicationRecord = lookupResult.record;

        // Validar que el registro corresponda estrictamente a una postulación en estado pendiente
        if (applicationRecord.status !== 'pendiente') {
          return res.status(409).json({
            success: false,
            error: 'El registro no corresponde a una postulación pendiente de evaluación.',
          });
        }

        const verifiedEmail = String(applicationRecord.email || '').trim().toLowerCase();
        if (!verifiedEmail) {
          return res.status(400).json({
            success: false,
            error: 'El registro de postulación no posee una dirección de correo válida.',
          });
        }

        // Parsear notas para verificar y gestionar estado duradero y atómico de notificación
        let notesObj = {};
        if (applicationRecord.notes) {
          try {
            const parsed = JSON.parse(applicationRecord.notes);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              notesObj = parsed;
            } else {
              notesObj = { text: String(applicationRecord.notes) };
            }
          } catch {
            notesObj = { text: String(applicationRecord.notes) };
          }
        }

        // 1. Prevenir envíos duplicados si la postulación ya fue notificada previamente
        if (notesObj.application_notified_at) {
          return res.status(200).json({
            success: true,
            alreadyNotified: true,
            message: 'La postulación ya fue notificada previamente.',
          });
        }

        // 2. Prevenir envíos concurrentes entre distintos llamadores o IPs
        const inProgressAt = notesObj.application_notifying_at
          ? new Date(notesObj.application_notifying_at).getTime()
          : 0;
        const now = Date.now();
        if (inProgressAt && now - inProgressAt < 60 * 1000) {
          return res.status(409).json({
            success: false,
            error: 'Notificación de postulación en curso para esta solicitud.',
          });
        }

        // Marcar estado en curso duraderamente en Supabase de forma condicional al valor previo de notes
        const expectedNotes =
          applicationRecord.notes !== undefined ? applicationRecord.notes : null;

        const lockResult = await updateApplicationNotes(
          applicationRecord.id,
          { ...notesObj, application_notifying_at: new Date().toISOString() },
          config,
          expectedNotes,
        );

        if (!lockResult.success) {
          console.error('[Notify] Error registrando bloqueo de notificación en base de datos:', lockResult.error);
          return res.status(502).json({
            success: false,
            error: 'No se pudo registrar el bloqueo de notificación en la base de datos.',
          });
        }

        if (!lockResult.matched) {
          return res.status(409).json({
            success: false,
            error: 'Notificación de postulación en curso o ya modificada para esta solicitud.',
          });
        }

        const verifiedData = {
          fullName:
            applicationRecord.name ||
            applicationRecord.agency ||
            applicationRecord.full_name ||
            applicationRecord.fullName ||
            data.fullName ||
            'Prestador',
          category: applicationRecord.category || data.category || 'Prestador de Servicios Turísticos',
          region: applicationRecord.region || data.region || 'Catamarca',
          email: verifiedEmail,
          phone: applicationRecord.phone || data.phone || '',
          website: applicationRecord.website || data.website || '',
          description: applicationRecord.description || data.description || '',
        };

        let applicantResult = null;
        let applicantDeliverySuccess = Boolean(notesObj.application_applicant_notified_at);

        if (!applicantDeliverySuccess) {
          try {
            // 1. Email al postulante confirmando recepción y estado de evaluación
            applicantResult = await sendEmailViaResend({
              apiKey: config.apiKey,
              from: config.fromEmail,
              to: verifiedData.email,
              subject: `Recibimos tu postulación como prestador en EXPERIENCIAS.CLUB`,
              html: templateProviderApplicationSubmitted(verifiedData),
            });
            results.push({ target: 'applicant', ...applicantResult });
            if (applicantResult && !applicantResult.simulated) {
              applicantDeliverySuccess = true;
              notesObj.application_applicant_notified_at = new Date().toISOString();
            }
          } catch (deliveryErr) {
            console.warn('[Notify] Error enviando correo al postulante:', deliveryErr);
            applicantDeliverySuccess = false;
          }
        } else {
          results.push({ target: 'applicant', alreadySent: true });
        }

        // 2. Alerta a administradores
        const hasAdminEmails = Boolean(config.adminEmails && config.adminEmails.length > 0);
        let adminDeliverySuccess = !hasAdminEmails || Boolean(notesObj.application_admin_notified_at);

        if (hasAdminEmails && applicantDeliverySuccess && !notesObj.application_admin_notified_at) {
          try {
            const adminResult = await sendEmailViaResend({
              apiKey: config.apiKey,
              from: config.fromEmail,
              to: config.adminEmails,
              subject: `[Nueva Postulación Prestador] ${verifiedData.fullName} · ${verifiedData.category}`,
              html: templateProviderApplicationAdmin(verifiedData),
            });
            results.push({ target: 'admin', ...adminResult });
            if (adminResult && !adminResult.simulated) {
              adminDeliverySuccess = true;
              notesObj.application_admin_notified_at = new Date().toISOString();
            }
          } catch (adminErr) {
            console.warn('[Notify] Error enviando alerta a administradores:', adminErr);
            results.push({
              target: 'admin',
              error: adminErr instanceof Error ? adminErr.message : String(adminErr),
            });
            adminDeliverySuccess = false;
          }
        } else if (hasAdminEmails && notesObj.application_admin_notified_at) {
          results.push({ target: 'admin', alreadySent: true });
        }

        const bothDeliveriesSucceeded = applicantDeliverySuccess && adminDeliverySuccess;

        if (bothDeliveriesSucceeded) {
          // Marcar durablemente como notificada completada
          const finalNotes = { ...notesObj };
          delete finalNotes.application_notifying_at;
          finalNotes.application_notified_at = new Date().toISOString();
          const finalNotesResult = await updateApplicationNotes(applicationRecord.id, finalNotes, config);
          if (!finalNotesResult.success) {
            console.error('[Notify] Error persistiendo notas finales de postulación:', finalNotesResult.error);
          }
        } else {
          // Si falló el envío o fue simulado, persistir marcadores alcanzados y limpiar el bloqueo en curso para reintento
          const retryNotes = { ...notesObj };
          delete retryNotes.application_notifying_at;
          const cleanupResult = await updateApplicationNotes(applicationRecord.id, retryNotes, config);
          if (!cleanupResult.success) {
            console.error('[Notify] Error limpiando bloqueo de postulación en base de datos:', cleanupResult.error);
          }

          const isSimulated = Boolean(
            (applicantResult && applicantResult.simulated) ||
            (!config.apiKey && !applicantDeliverySuccess),
          );

          if (!isSimulated) {
            return res.status(502).json({
              success: false,
              error: 'No se pudo entregar el correo de notificación. Queda disponible para reintento.',
              results,
            });
          }
        }
        break;
      }

      case 'PROVIDER_APPROVED': {
        if (!data.email) {
          return res.status(400).json({ success: false, error: 'Falta email del prestador.' });
        }

        const authHeader = req.headers.authorization || req.headers.Authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

        if (!token) {
          return res.status(401).json({
            success: false,
            error: 'Acceso no autorizado: se requiere token de sesión de administrador.',
          });
        }

        const isAdmin = await verifySupabaseCallerAdmin(token, config);
        if (!isAdmin) {
          return res.status(403).json({
            success: false,
            error: 'Acceso denegado: se requieren permisos de administrador para aprobar.',
          });
        }

        const approvedResult = await sendEmailViaResend({
          apiKey: config.apiKey,
          from: config.fromEmail,
          to: data.email,
          subject: `¡Tu cuenta de Prestador ha sido aprobada en EXPERIENCIAS.CLUB!`,
          html: templateProviderApproved(data),
        });
        results.push({ target: 'provider_approved', ...approvedResult });
        break;
      }

      case 'CHECK_PROVIDER_STATUS': {
        const email = String(data?.email || '').trim().toLowerCase();
        if (!email) {
          return res.status(400).json({ success: false, error: 'Falta email.' });
        }

        // 1. Revisar estado en public.prestadores (incluye aprobados, dados de baja y postulaciones pendientes)
        const prestadorRecord = await verifyProviderAccess(email, config);
        if (prestadorRecord) {
          const status = (prestadorRecord.status || '').toLowerCase();
          if (
            status === 'dado_de_baja' ||
            status === 'rechazado' ||
            status === 'rechazada' ||
            (prestadorRecord.active === false && status !== 'pendiente')
          ) {
            return res.status(200).json({ success: true, status: 'inactive' });
          }
          if (status === 'aprobado' && prestadorRecord.active === true) {
            return res.status(200).json({ success: true, status: 'approved' });
          }
          return res.status(200).json({ success: true, status: 'pending' });
        }

        return res.status(200).json({ success: true, status: 'unregistered' });
      }

      case 'GET_ADMIN_APPLICATIONS': {
        const privilegedKey = config.supabaseServiceRoleKey || config.supabaseKey;
        if (!config.supabaseUrl || !privilegedKey) {
          return res.status(200).json({ success: false, prestadores: [], fundadores: [] });
        }

        try {
          const fetchSupabaseRows = (endpoint) => {
            return new Promise((resolve) => {
              const url = new URL(`${config.supabaseUrl}${endpoint}`);
              const req = https.request(
                {
                  hostname: url.hostname,
                  port: url.port || 443,
                  path: url.pathname + url.search,
                  method: 'GET',
                  headers: {
                    apikey: privilegedKey,
                    Authorization: `Bearer ${privilegedKey}`,
                  },
                },
                (response) => {
                  let body = '';
                  response.on('data', (chunk) => (body += chunk));
                  response.on('end', () => {
                    try {
                      if (response.statusCode >= 200 && response.statusCode < 300) {
                        const parsed = JSON.parse(body);
                        resolve(Array.isArray(parsed) ? parsed : []);
                      } else {
                        resolve([]);
                      }
                    } catch {
                      resolve([]);
                    }
                  });
                }
              );
              req.on('error', () => resolve([]));
              req.end();
            });
          };

          const [prestadores, fundadores] = await Promise.all([
            fetchSupabaseRows('/rest/v1/prestadores?select=*&order=created_at.desc'),
            fetchSupabaseRows('/rest/v1/postulaciones_fundadores?select=*&order=created_at.desc'),
          ]);

          return res.status(200).json({
            success: true,
            prestadores: Array.isArray(prestadores) ? prestadores : [],
            fundadores: Array.isArray(fundadores) ? fundadores : [],
          });
        } catch (err) {
          return res.status(200).json({ success: false, error: err.message, prestadores: [], fundadores: [] });
        }
      }

      case 'GET_AUTH_AVATARS': {
        const privilegedKey = config.supabaseServiceRoleKey || config.supabaseKey;
        if (!config.supabaseUrl || !privilegedKey) {
          return res.status(200).json({ success: false, avatars: {} });
        }

        try {
          const fetchAuthUsers = () => {
            return new Promise((resolve) => {
              const url = new URL(`${config.supabaseUrl}/auth/v1/admin/users?per_page=1000`);
              const req = https.request(
                {
                  hostname: url.hostname,
                  port: url.port || 443,
                  path: url.pathname + url.search,
                  method: 'GET',
                  headers: {
                    apikey: privilegedKey,
                    Authorization: `Bearer ${privilegedKey}`,
                  },
                },
                (response) => {
                  let body = '';
                  response.on('data', (chunk) => (body += chunk));
                  response.on('end', () => {
                    try {
                      if (response.statusCode >= 200 && response.statusCode < 300) {
                        const parsed = JSON.parse(body);
                        resolve(parsed?.users || []);
                      } else {
                        resolve([]);
                      }
                    } catch {
                      resolve([]);
                    }
                  });
                }
              );
              req.on('error', () => resolve([]));
              req.end();
            });
          };

          const users = await fetchAuthUsers();
          const avatarMap = {};
          if (Array.isArray(users)) {
            for (const u of users) {
              const meta = u.user_metadata || {};
              const idData = u.identities?.[0]?.identity_data || {};
              const avatar =
                meta.avatar_url ||
                meta.picture ||
                idData.avatar_url ||
                idData.picture ||
                '';
              if (avatar) {
                if (u.email) {
                  avatarMap[u.email.toLowerCase().trim()] = avatar;
                }
                if (u.id) {
                  avatarMap[u.id] = avatar;
                }
              }
            }
          }

          return res.status(200).json({ success: true, avatars: avatarMap });
        } catch (err) {
          return res.status(200).json({ success: false, avatars: {} });
        }
      }

      case 'EXPERIENCE_PROPOSAL_SUBMITTED': {
        if (!data?.title || !data?.providerEmail) {
          return res.status(400).json({
            success: false,
            error: 'Faltan datos de la propuesta o correo del prestador.',
          });
        }

        const authHeader = req.headers.authorization || req.headers.Authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

        if (!token) {
          return res.status(401).json({
            success: false,
            error: 'Acceso no autorizado: se requiere token de sesión.',
          });
        }

        const caller = await getSupabaseUser(token, config);
        if (!caller) {
          return res.status(401).json({
            success: false,
            error: 'Token de sesión inválido o expirado.',
          });
        }

        const callerEmail = (caller.email || '').trim().toLowerCase();
        const providerEmail = String(data.providerEmail).trim().toLowerCase();
        if (!callerEmail || callerEmail !== providerEmail) {
          return res.status(403).json({
            success: false,
            error: 'El correo del remitente no coincide con el usuario autenticado.',
          });
        }

        const accessRecord = await verifyProviderAccess(providerEmail, config);
        if (
          !accessRecord ||
          accessRecord.active === false ||
          String(accessRecord.status || '').toLowerCase() !== 'aprobado'
        ) {
          return res.status(403).json({
            success: false,
            error: 'La cuenta de prestador no está aprobada y activa.',
          });
        }

        const clientIp =
          req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
          req.socket?.remoteAddress ||
          'unknown';
        const rateLimitKey = `prop_${providerEmail}_${clientIp}`;
        if (!checkRateLimit(rateLimitKey, 3, 5 * 60 * 1000)) {
          return res.status(429).json({
            success: false,
            error: 'Demasiadas solicitudes enviadas. Por favor aguardá unos minutos.',
          });
        }

        // 1. Acuse de recibo al prestador
        const providerResult = await sendEmailViaResend({
          apiKey: config.apiKey,
          from: config.fromEmail,
          to: providerEmail,
          subject: `Recibimos tu propuesta de experiencia: ${data.title}`,
          html: templateExperienceProposalProvider(data),
        });
        results.push({ target: 'provider', ...providerResult });

        // 2. Alerta a administradores
        if (config.adminEmails && config.adminEmails.length > 0) {
          const adminResult = await sendEmailViaResend({
            apiKey: config.apiKey,
            from: config.fromEmail,
            to: config.adminEmails,
            subject: `[Nueva Propuesta de Experiencia] ${data.title} · ${data.providerName || 'Prestador'}`,
            html: templateExperienceProposalAdmin(data),
          });
          results.push({ target: 'admin', ...adminResult });
        }
        break;
      }

      default:
        return res.status(400).json({
          success: false,
          error: `Tipo de notificación no soportado: ${type}`,
        });
    }

    return res.status(200).json({
      success: true,
      type,
      results,
    });
  } catch (err) {
    console.error('[api/notify] Error procesando notificación:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error interno enviando notificación.',
    });
  }
};
