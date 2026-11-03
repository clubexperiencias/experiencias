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

  return { apiKey, fromEmail, adminEmails, verifiedProviderEmails };
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

function renderBaseLayout(contentHtml, preheaderText = '') {
  const safePreheader = escapeHtml(preheaderText);
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Experiencias Club</title>
  <style>
    body { margin: 0; padding: 0; background-color: #05070a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff; -webkit-font-smoothing: antialiased; }
    .email-wrapper { padding: 32px 12px; background-color: #05070a; }
    .email-container { max-width: 580px; margin: 0 auto; background: #0c0f16; border: 1px solid rgba(255, 204, 0, 0.22); border-radius: 4px; overflow: hidden; box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6); }
    .email-header { background: #080a0f; padding: 26px 32px; border-bottom: 1px solid rgba(255, 204, 0, 0.25); text-align: center; }
    .email-logo-text { font-size: 19px; font-weight: 800; letter-spacing: 0.14em; color: #ffffff; margin: 0; text-transform: uppercase; }
    .email-logo-sub { font-size: 10px; font-weight: 800; letter-spacing: 0.22em; color: #ffcc00; text-transform: uppercase; margin-top: 5px; display: block; }
    .email-body { padding: 36px 32px; }
    .card-title { font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 14px; line-height: 1.3; letter-spacing: -0.01em; }
    .card-lead { font-size: 15px; color: rgba(255, 255, 255, 0.84); line-height: 1.65; margin: 0 0 24px; }
    .data-table { width: 100%; border-collapse: collapse; margin: 22px 0 26px; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 204, 0, 0.18); border-radius: 3px; }
    .data-table td { padding: 12px 16px; border-bottom: 1px solid rgba(255, 204, 0, 0.1); font-size: 14px; }
    .data-table tr:last-child td { border-bottom: none; }
    .data-label { color: #ffcc00; font-weight: 700; width: 42%; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; }
    .data-value { color: #ffffff; font-weight: 600; text-align: right; }
    .data-mono { font-family: 'Courier New', Courier, monospace; letter-spacing: 0.06em; color: #ffcc00; font-weight: 700; }
    .voucher-box { background: rgba(255, 204, 0, 0.05); border: 1px solid #ffcc00; border-radius: 4px; padding: 20px 22px; margin: 24px 0; }
    .voucher-tag { font-size: 11px; font-weight: 800; letter-spacing: 0.14em; color: #ffcc00; text-transform: uppercase; }
    .voucher-code { font-size: 24px; font-weight: 800; color: #ffffff; margin: 8px 0; letter-spacing: 0.06em; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .btn-primary { display: inline-block; background-color: #ffcc00; color: #0a0b0e !important; font-size: 14px; font-weight: 800; text-decoration: none; padding: 14px 28px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.08em; margin: 12px 0; text-align: center; box-shadow: 0 4px 14px rgba(255, 204, 0, 0.25); }
    .btn-secondary { display: inline-block; background-color: transparent; border: 1px solid rgba(255, 204, 0, 0.4); color: #ffcc00 !important; font-size: 13px; font-weight: 700; text-decoration: none; padding: 10px 20px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.06em; margin: 8px 0; text-align: center; }
    .btn-whatsapp { display: inline-block; background-color: #25D366; color: #070d18 !important; font-size: 14px; font-weight: 800; text-decoration: none; padding: 13px 26px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.05em; margin: 10px 0; text-align: center; }
    .alert-box { background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 4px; padding: 16px 20px; color: #fca5a5; margin: 20px 0; font-size: 14px; line-height: 1.55; }
    .tips-list { margin: 18px 0; padding-left: 18px; font-size: 14px; color: rgba(255, 255, 255, 0.82); line-height: 1.7; }
    .tips-list li { margin-bottom: 8px; }
    .email-footer { background: #080a0f; padding: 24px 32px; text-align: center; font-size: 12px; color: rgba(255, 255, 255, 0.45); border-top: 1px solid rgba(255, 204, 0, 0.15); line-height: 1.6; }
    .email-footer a { color: #ffcc00; text-decoration: none; }
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
        <span class="email-logo-sub">CATAMARCA • EXPEDICIONES ANDINAS</span>
      </div>
      <div class="email-body">
        ${contentHtml}
      </div>
      <div class="email-footer">
        <p style="margin: 0 0 6px;">EXPERIENCIAS.CLUB • San Fernando del Valle de Catamarca, Argentina</p>
        <p style="margin: 0;"><a href="https://experiencias.club" target="_blank">experiencias.club</a> · Soporte y consultas: <a href="https://wa.me/5493515490431" target="_blank">+54 9 351 549-0431</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// 1. Template: Comprobante Recibido (Para el Usuario)
function templatePaymentSubmittedUser(sub) {
  const fullName = sub.fullName ? escapeHtml(sub.fullName) : 'Explorador';
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
      ¿Necesitás coordinar algo antes? Escribinos por <a href="https://wa.me/5493515490431" target="_blank" style="color: #ffcc00;">WhatsApp Oficial</a>.
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

// -----------------------------------------------------------------------------
// Handler Principal Serverless (Vercel)
// -----------------------------------------------------------------------------

module.exports = async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido. Usá POST.' });
  }

  try {
    const { type, data } = req.body || {};

    if (!type || !data) {
      return res.status(400).json({
        success: false,
        error: 'Cuerpo de solicitud incompleto. Se requiere type y data.',
      });
    }

    const config = getEnvConfig();
    const results = [];

    switch (type) {
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
